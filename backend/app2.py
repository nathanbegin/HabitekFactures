#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import json
import pytz
import bcrypt
import jwt
import traceback
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone, date, timedelta
from functools import wraps

import psycopg2
import psycopg2.extras
from psycopg2.errors import UniqueViolation

from flask import (
    Flask, request, jsonify, send_from_directory, g
)
from werkzeug.utils import secure_filename

# --- WebSocket / Socket.IO ---
import eventlet
eventlet.monkey_patch()  # patches stdlib for cooperative sockets/fs
from flask_socketio import SocketIO

# -----------------------------------------------------------------------------
# Configuration de l'app
# -----------------------------------------------------------------------------
app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

# Secret pour JWT (comme ta version originale)
SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-prod')
JWT_ALG = 'HS256'
JWT_EXPIRES_MIN = int(os.environ.get('JWT_EXPIRES_MIN', '60'))

# Socket.IO
socketio = SocketIO(
    app,
    async_mode="eventlet",
    cors_allowed_origins=os.environ.get("CORS_ALLOW_ORIGINS", "*"),
    json=json
)

# Timezone locale (année financière dépend du mois local)
MONTREAL_TIMEZONE = pytz.timezone("America/Toronto")

# Connexion BD
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://minio:Habitek2025@localhost:5432/habitek_tresorerie"
)

# Racine de stockage des fichiers (fixe comme demandé)
APP_STORAGE_ROOT = os.path.abspath("backend/uploads")

def _ensure_dir(p: str):
    os.makedirs(p, exist_ok=True)

# Crée les dossiers de tête
_ensure_dir(APP_STORAGE_ROOT)
_ensure_dir(os.path.join(APP_STORAGE_ROOT, "factures"))
_ensure_dir(os.path.join(APP_STORAGE_ROOT, "cdd"))

# -----------------------------------------------------------------------------
# Helpers fichiers / arborescence
# -----------------------------------------------------------------------------
def _fy_dir_for_factures(financial_year: int) -> str:
    p = os.path.join(APP_STORAGE_ROOT, "factures", str(financial_year))
    _ensure_dir(p)
    return p

def _fy_dir_for_cdd(financial_year: int, generated: bool = False) -> str:
    base = os.path.join(APP_STORAGE_ROOT, "cdd", str(financial_year))
    _ensure_dir(base)
    if generated:
        gen = os.path.join(base, "generated")
        _ensure_dir(gen)
        return gen
    return base

def _safe_slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", (s or "").strip())[:60]

# -----------------------------------------------------------------------------
# Connexion DB
# -----------------------------------------------------------------------------
def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        app.logger.error(f"DB connection error: {e}")
        return None

# -----------------------------------------------------------------------------
# Utilitaires divers
# -----------------------------------------------------------------------------
def fiscal_year_of(dt_utc: datetime) -> int:
    """Année financière: 1er mai -> 30 avril."""
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    mtl = dt_utc.astimezone(MONTREAL_TIMEZONE)
    return mtl.year if mtl.month >= 5 else (mtl.year - 1)

def convert_to_json_serializable(obj):
    if isinstance(obj, (datetime, )):
        if obj.tzinfo is None:
            return obj.replace(tzinfo=timezone.utc).isoformat()
        return obj.isoformat()
    if isinstance(obj, (date, )):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return obj

# -----------------------------------------------------------------------------
# Auth (login -> JWT -> Authorization: Bearer)
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def check_password(password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def make_access_token(uid: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'user_id': uid,
        'role': role or '',
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(minutes=JWT_EXPIRES_MIN)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALG)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALG])

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if parts and parts[0].lower() == 'bearer' and len(parts) == 2:
                token = parts[1]
            else:
                return jsonify({"error": "Format d'en-tête Authorization invalide"}), 401
        if not token:
            return jsonify({"error": "Token manquant"}), 401

        try:
            data = decode_access_token(token)
            g.user_id = data.get('user_id')
            g.user_role = data.get('role') or ''
            if not g.user_id:
                return jsonify({"error": "Token invalide"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expiré"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Token invalide"}), 401
        except Exception:
            return jsonify({"error": "Erreur de validation du token"}), 500
        return f(*args, **kwargs)
    return decorated

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_roles = [r.strip().lower() for r in (g.user_role or '').split(',') if r.strip()]
            ok = any((ar.lower() in user_roles) for ar in allowed_roles)
            if not ok:
                return jsonify({"error": "Accès refusé: rôle insuffisant", "required": allowed_roles}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# -----------------------------------------------------------------------------
# Healthcheck
# -----------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})

# -----------------------------------------------------------------------------
# Inscription publique (User)
# -----------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
PWD_RE_LETTER = re.compile(r"[A-Za-z]")
PWD_RE_DIGIT  = re.compile(r"\d")

def _validate_registration_input(prenom, nom, courriel, password):
    if not prenom or not nom or not courriel or not password:
        return "Champs requis: prenom, nom, courriel, password"
    if not EMAIL_RE.match(courriel):
        return "Courriel invalide"
    if len(password) < 8 or not PWD_RE_LETTER.search(password) or not PWD_RE_DIGIT.search(password):
        return "Mot de passe trop faible (min 8, au moins 1 lettre et 1 chiffre)"
    return None

@app.route("/api/register", methods=["POST"])
def register_user_public():
    data = request.get_json() or {}
    prenom   = (data.get("prenom") or data.get("prénom") or "").strip()
    nom      = (data.get("nom") or "").strip()
    courriel = (data.get("courriel") or "").strip()
    password = data.get("password") or ""

    err = _validate_registration_input(prenom, nom, courriel, password)
    if err:
        return jsonify({"error": err}), 400

    try:
        pwd_hash = hash_password(password)
    except Exception:
        return jsonify({"error": "Impossible de hacher le mot de passe"}), 500

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500

    cur = conn.cursor()
    try:
        role = "soumetteur"
        cur.execute("""
            INSERT INTO app_user ("prénom", "nom", courriel, password_hash, rôle)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING uid, "prénom", "nom", courriel, rôle
        """, (prenom, nom, courriel, pwd_hash, role))
        row = cur.fetchone()
        conn.commit()

        uid, prenom_db, nom_db, courriel_db, role_db = row
        token = make_access_token(uid, role_db)

        user_payload = {"uid": uid, "prenom": prenom_db, "nom": nom_db, "courriel": courriel_db, "role": role_db}
        # WebSocket event
        socketio.emit("user.created", {"user": user_payload}, namespace="/")

        return jsonify({"message": "Utilisateur créé", "user": user_payload, "token": token}), 201

    except UniqueViolation:
        conn.rollback()
        return jsonify({"error": "Un utilisateur avec ce courriel existe déjà"}), 409
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Échec création utilisateur", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

# Changer mot de passe (modification utilisateur)
@app.route("/api/users/<int:uid>/password", methods=["PATCH"])
@token_required
def change_password(uid):
    data = request.get_json() or {}
    new_pw = data.get("password") or ""
    if not new_pw:
        return jsonify({"error": "password requis"}), 400

    is_self = (g.user_id == uid)
    user_roles = [r.strip().lower() for r in (g.user_role or '').split(',') if r.strip()]
    is_mgr = ('gestionnaire' in user_roles)
    if not (is_self or is_mgr):
        return jsonify({"error": "Accès refusé"}), 403

    try:
        new_hash = hash_password(new_pw)
    except Exception:
        return jsonify({"error": "Impossible de hacher le mot de passe"}), 500

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("UPDATE app_user SET password_hash=%s WHERE uid=%s RETURNING uid", (new_hash, uid))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify({"error":"Utilisateur introuvable"}), 404
        conn.commit()
        socketio.emit("user.updated", {"uid": uid}, namespace="/")
        return jsonify({"message":"Mot de passe mis à jour"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error":"Échec mise à jour", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

# Suppression utilisateur (admin)
@app.route("/api/users/<int:uid>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def delete_user(uid):
    if uid == g.user_id:
        return jsonify({"error":"Impossible de supprimer votre propre compte"}), 400
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM app_user WHERE uid=%s RETURNING uid", (uid,))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify({"error":"Utilisateur introuvable"}), 404
        conn.commit()
        socketio.emit("user.deleted", {"uid": uid}, namespace="/")
        return jsonify({"message":"Utilisateur supprimé"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error":"Échec suppression utilisateur","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# -----------------------------------------------------------------------------
# Login & Me
# -----------------------------------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or data.get("username") or "").strip()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Courriel et mot de passe requis"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT uid, password_hash, rôle, courriel, "prénom", "nom"
            FROM app_user
            WHERE lower(courriel) = lower(%s)
        """, (email,))
        row = cur.fetchone()
        if row and check_password(password, row[1]):
            uid, _, role, courriel, prenom, nom = row
            token = make_access_token(uid, role or '')
            return jsonify({
                "token": token,
                "user_id": uid,
                "user_role": role or '',
                "user": {"uid": uid, "prenom": prenom, "nom": nom, "courriel": courriel, "role": role or ''}
            }), 200
        else:
            return jsonify({"error": "Identifiants invalides"}), 401
    except Exception as e:
        print(f"Erreur login: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la connexion"}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/me", methods=["GET"])
@token_required
def me():
    return jsonify({"user_id": g.user_id, "roles": g.user_role}), 200

# -----------------------------------------------------------------------------
# FACTURES
# -----------------------------------------------------------------------------
@app.route('/api/factures', methods=['POST'])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def upload_facture():
    data = request.form if request.form else (request.get_json() or {})
    if not data:
        return jsonify({"error": "Aucune donnée fournie"}), 400

    date_facture    = data.get('date_facture')
    fournisseur     = data.get('fournisseur')
    description     = data.get('description')
    montant         = data.get('montant')
    devise          = data.get('devise')
    statut          = data.get('statut', 'soumise')
    categorie_in    = data.get('categorie') or data.get('catégorie')
    ligne_budgetaire= data.get('ligne_budgetaire')
    type_           = data.get('type')
    ubr             = data.get('ubr')
    poste_budgetaire= data.get('poste_budgetaire')
    ref_cdd         = data.get('ref_cdd')

    if not all([date_facture, fournisseur, montant, devise]):
        return jsonify({"error": "Champs requis: date_facture, fournisseur, montant, devise"}), 400
    try:
        datetime.strptime(date_facture, '%Y-%m-%d')
    except ValueError:
        return jsonify({"error": "date_facture invalide (AAAA-MM-JJ)"}), 400
    try:
        montant = Decimal(str(montant))
        if montant < 0:
            return jsonify({"error": "montant doit être >= 0"}), 400
    except InvalidOperation:
        return jsonify({"error": "montant invalide"}), 400

    file = request.files.get('fichier')
    saved_path = None

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(f"""
            INSERT INTO factures (
              date_facture, fournisseur, description, montant, devise, statut,
              "catégorie", ligne_budgetaire, type, ubr, poste_budgetaire,
              uid_soumetteur, ref_cdd
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, fid, financial_year, date_soumise;
        """, (
            date_facture, fournisseur, description, montant, devise, statut,
            categorie_in, ligne_budgetaire, type_, ubr, poste_budgetaire,
            str(g.user_id), ref_cdd
        ))
        invoice = cur.fetchone()
        invoice_id = invoice["id"]
        fid = invoice["fid"]
        fin_year = invoice["financial_year"]
        date_soumise = invoice["date_soumise"] or datetime.now(timezone.utc)

        if file and file.filename:
            cur.execute("SELECT COALESCE(MAX(file_index),0)+1 AS next_idx FROM factures_pj WHERE invoice_pk=%s", (invoice_id,))
            next_idx = (cur.fetchone() or {"next_idx": 1})["next_idx"] or 1
            ts = (date_soumise if isinstance(date_soumise, datetime) else datetime.now(timezone.utc)).strftime("%Y%m%d")
            base = f"Habitek_{fid}_{_safe_slug(fournisseur)}_{ts}_{str(next_idx).zfill(2)}"
            ext = os.path.splitext(file.filename)[1] or ".pdf"
            filename = secure_filename(base + ext)
            target_dir = _fy_dir_for_factures(fin_year)
            saved_path = os.path.join(target_dir, filename)
            file.save(saved_path)
            cur.execute("""
                INSERT INTO factures_pj (invoice_pk, file_index, file_path)
                VALUES (%s, %s, %s)
            """, (invoice_id, next_idx, saved_path))

        conn.commit()
        payload = {"id": invoice_id, "fid": fid, "financial_year": fin_year}
        socketio.emit("facture.created", payload, namespace="/")
        return jsonify({"message": "Facture créée", **payload}), 201

    except Exception as e:
        conn.rollback()
        if saved_path and os.path.exists(saved_path):
            try: os.remove(saved_path)
            except: pass
        traceback.print_exc()
        return jsonify({"error": "Échec création facture", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/api/factures', methods=['GET'])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def get_factures():
    fy = request.args.get('fy', type=int)
    if fy is None:
        fy = fiscal_year_of(datetime.now(timezone.utc))

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT
              f.id, f.fid, f.financial_year, f.date_facture, f.date_soumise, f.date_derniere_modif,
              f.fournisseur, f.description, f.montant, f.devise, f.statut,
              f."catégorie" AS categorie, f.ligne_budgetaire, f.type, f.ubr, f.poste_budgetaire,
              f.uid_soumetteur, f.uid_approbateur, f.ref_cdd,
              cd.cid AS compte_cid, cd.mode, cd.type_cdd_int,
              (cd."prénom_demandeur" || ' ' || cd."nom_demandeur") AS demandeur
            FROM factures f
            LEFT JOIN compte_depenses cd ON cd.cid = f.ref_cdd
            WHERE f.financial_year = %s
            ORDER BY f.date_facture DESC, f.id DESC
        """, (fy,))
        rows = cur.fetchall()
        return jsonify([{k: convert_to_json_serializable(v) for k, v in dict(r).items()} for r in rows]), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":"Échec de lecture", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/factures/<int:invoice_id>/pieces", methods=["GET"])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def list_facture_pieces(invoice_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT file_index, file_path, uploaded_at
            FROM factures_pj
            WHERE invoice_pk=%s
            ORDER BY file_index
        """, (invoice_id,))
        rows = cur.fetchall()
        items = [{"file_index": r[0], "file_path": r[1], "uploaded_at": r[2].isoformat() if r[2] else None} for r in rows]
        return jsonify(items), 200
    finally:
        cur.close(); conn.close()

@app.route("/api/factures/<int:invoice_id>/pieces/<int:file_index>", methods=["GET"])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def download_facture_piece(invoice_id, file_index):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT file_path FROM factures_pj
            WHERE invoice_pk=%s AND file_index=%s
        """, (invoice_id, file_index))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Pièce jointe introuvable"}), 404
        path = row[0]
        if not path or not os.path.exists(path):
            return jsonify({"error":"Fichier manquant sur le disque"}), 404
        return send_from_directory(
            os.path.dirname(path),
            os.path.basename(path),
            as_attachment=True,
            download_name=os.path.basename(path)
        )
    finally:
        cur.close(); conn.close()

@app.route("/api/factures/<int:fid>", methods=["PATCH"])
@token_required
@role_required(['gestionnaire', 'approbateur'])
def patch_facture(fid):
    content_type = (request.headers.get("Content-Type") or "").lower()
    data = {}
    if "application/json" in content_type:
        data = request.get_json() or {}
    elif "multipart/form-data" in content_type:
        data = request.form.to_dict()
    if not data:
        return jsonify({"message":"Aucun changement"}), 200

    allowed = {
        "date_facture","fournisseur","description","montant","devise","statut",
        "categorie","catégorie","ligne_budgetaire","type","ubr","poste_budgetaire","ref_cdd",
        "uid_approbateur"
    }

    if "montant" in data and data["montant"] not in (None, ""):
        try:
            val = Decimal(str(data["montant"]))
            if val < 0:
                return jsonify({"error":"montant doit être >= 0"}), 400
            data["montant"] = val
        except InvalidOperation:
            return jsonify({"error":"montant invalide"}), 400
    if "date_facture" in data and data["date_facture"]:
        try: datetime.strptime(str(data["date_facture"]), "%Y-%m-%d")
        except ValueError: return jsonify({"error":"date_facture invalide (AAAA-MM-JJ)"}), 400

    data.setdefault("uid_approbateur", str(g.user_id))
    if "categorie" in data and "catégorie" not in data:
        data["catégorie"] = data.pop("categorie")

    sets, vals = [], []
    for k, v in data.items():
        if k in allowed:
            if k == "catégorie":
                sets.append("\"catégorie\"=%s")
            else:
                sets.append(f"{k}=%s")
            vals.append(v)

    if not sets:
        return jsonify({"message": "Aucun champ autorisé fourni"}), 200

    sql = f"UPDATE factures SET {', '.join(sets)} WHERE id=%s RETURNING id, fid"
    vals.append(fid)

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute(sql, tuple(vals))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify({"error":"Facture introuvable"}), 404
        conn.commit()
        payload = {"id": row[0], "fid": row[1]}
        socketio.emit("facture.updated", payload, namespace="/")
        return jsonify(payload), 200
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec mise à jour", "details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/factures/<int:invoice_id>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def delete_facture(invoice_id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("SELECT file_path FROM factures_pj WHERE invoice_pk=%s ORDER BY file_index", (invoice_id,))
        paths = [r[0] for r in cur.fetchall()]

        cur.execute("DELETE FROM factures WHERE id=%s RETURNING id, fid", (invoice_id,))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify({"error":"Facture introuvable"}), 404

        conn.commit()

        for p in paths:
            try:
                if p and os.path.exists(p): os.remove(p)
            except Exception as e:
                app.logger.warning(f"Suppression fichier échouée ({p}): {e}")

        payload = {"id": row[0], "fid": row[1]}
        socketio.emit("facture.deleted", payload, namespace="/")
        return jsonify({"message": "Facture supprimée", **payload}), 200
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec suppression", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()


# -----------------------------------------------------------------------------
# Budget PIN (pour accès en écriture au budget)
# -----------------------------------------------------------------------------
@app.route("/api/budget/verify-pin", methods=["POST"])
@token_required  # Auth requise (même stratégie que le reste)
def verify_budget_pin():
    data = request.get_json(silent=True) or {}
    pin = str(data.get("pin") or "").strip()
    if not pin:
        return jsonify({"error": "pin requis"}), 400

    if pin == BUDGET_PIN:
        return jsonify({"valid": True}), 200
    return jsonify({"valid": False}), 401


# -----------------------------------------------------------------------------
# COMPTES DE DÉPENSES (CDD)
# -----------------------------------------------------------------------------
CID_RE = re.compile(r"^C\d{4}-HABITEK\d{3}$")

@app.route("/api/depense-comptes", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def create_compte_depense():
    data = request.get_json() or {}
    mode = data.get("mode")
    type_cdd_int = data.get("type_cdd_int")
    prenom = data.get("prénom_demandeur") or data.get("demandeur_prenom")
    nom = data.get("nom_demandeur") or data.get("demandeur_nom")
    date_soumis = data.get("date_soumis")

    if not prenom or not nom:
        return jsonify({"error":"prénom_demandeur et nom_demandeur requis"}), 400
    if date_soumis:
        try: datetime.strptime(date_soumis, "%Y-%m-%d")
        except ValueError: return jsonify({"error":"date_soumis invalide (AAAA-MM-JJ)"}), 400
    if type_cdd_int not in (None, 0, 1):
        return jsonify({"error":"type_cdd_int doit être 0 ou 1"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO compte_depenses (mode, type_cdd_int, "prénom_demandeur", "nom_demandeur", date_soumis)
            VALUES (%s,%s,%s,%s, COALESCE(%s::date, CURRENT_DATE))
            RETURNING id, cid, financial_year, "prénom_demandeur" AS prenom_demandeur, "nom_demandeur" AS nom_demandeur, date_soumis;
        """, (mode, type_cdd_int, prenom, nom, date_soumis))
        row = cur.fetchone()
        conn.commit()
        payload = {k: convert_to_json_serializable(v) for k, v in dict(row).items()}
        socketio.emit("cdd.created", payload, namespace="/")
        return jsonify(payload), 201
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Erreur création compte_depense","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes", methods=["GET"])
@token_required
@role_required(['gestionnaire'])
def list_comptes_depenses():
    q = request.args.get("q", "").strip()
    fy = request.args.get("fy", type=int)

    params = []
    where = []

    query = """
        SELECT cd.*,
               (SELECT COUNT(*) FROM factures f WHERE f.ref_cdd = cd.cid) AS factures_count
        FROM compte_depenses cd
    """
    if fy is not None:
        where.append("cd.financial_year = %s"); params.append(fy)
    if q:
        where.append("(cd.cid ILIKE %s OR cd.\"prénom_demandeur\" ILIKE %s OR cd.\"nom_demandeur\" ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    if where: query += " WHERE " + " AND ".join(where)
    query += " ORDER BY cd.date_soumis DESC, cd.id DESC"

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return jsonify([{k: convert_to_json_serializable(v) for k, v in dict(r).items()} for r in rows]), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":"Erreur lecture","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes/<string:cid>", methods=["GET"])
@token_required
@role_required(['gestionnaire'])
def get_compte_depense(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT id, cid, financial_year, mode, type_cdd_int,
                   "prénom_demandeur" AS prenom_demandeur,
                   "nom_demandeur" AS nom_demandeur,
                   date_soumis
            FROM compte_depenses WHERE cid=%s
        """, (cid,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Compte introuvable"}), 404

        cur.execute("""
            SELECT f.id, f.fid, f.date_facture, f.fournisseur, f.montant, f.devise, f.statut
            FROM factures f
            WHERE f.ref_cdd = %s
            ORDER BY f.date_facture DESC, f.id DESC
        """, (cid,))
        factures = cur.fetchall()

        item = {k: convert_to_json_serializable(v) for k, v in dict(row).items()}
        item["factures"] = [{k: convert_to_json_serializable(v) for k, v in dict(fr).items()} for fr in factures]
        return jsonify(item), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":"Erreur lecture compte","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes/<string:cid>", methods=["PATCH"])
@token_required
@role_required(['gestionnaire'])
def patch_compte_depense(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400

    data = request.get_json() or {}
    allowed = {"mode","type_cdd_int","prénom_demandeur","nom_demandeur","date_soumis"}

    sets, vals = [], []
    for k, v in data.items():
        if k in allowed:
            if k == "type_cdd_int" and v not in (None, 0, 1):
                return jsonify({"error":"type_cdd_int doit être 0 ou 1"}), 400
            if k == "date_soumis" and v:
                try: datetime.strptime(v, "%Y-%m-%d")
                except ValueError: return jsonify({"error":"date_soumis invalide (AAAA-MM-JJ)"}), 400
            if k in ("prénom_demandeur","nom_demandeur"):
                sets.append(f"\"{k}\"=%s")
            else:
                sets.append(f"{k}=%s")
            vals.append(v)
    if not sets:
        return jsonify({"message":"Aucun changement"}), 200

    sql = f"UPDATE compte_depenses SET {', '.join(sets)} WHERE cid=%s RETURNING id, cid"
    vals.append(cid)

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute(sql, tuple(vals))
        row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify({"error":"Compte introuvable"}), 404
        conn.commit()
        payload = {"id": row[0], "cid": row[1]}
        socketio.emit("cdd.updated", payload, namespace="/")
        return jsonify(payload), 200
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec mise à jour", "details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes/<string:cid>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def delete_compte_depense(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM compte_depenses WHERE cid=%s", (cid,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Compte introuvable"}), 404
        expense_id = row[0]

        cur.execute("SELECT file_path FROM cdd_pj WHERE expense_pk=%s ORDER BY file_index", (expense_id,))
        paths = [r[0] for r in cur.fetchall()]

        cur.execute("DELETE FROM compte_depenses WHERE id=%s RETURNING id", (expense_id,))
        r = cur.fetchone()
        if not r:
            conn.rollback()
            return jsonify({"error":"Suppression impossible"}), 400

        conn.commit()

        for p in paths:
            try:
                if p and os.path.exists(p): os.remove(p)
            except Exception as e:
                app.logger.warning(f"Suppression fichier CDD échouée ({p}): {e}")

        payload = {"id": expense_id, "cid": cid}
        socketio.emit("cdd.deleted", payload, namespace="/")
        return jsonify({"message":"Compte supprimé", **payload}), 200
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec suppression", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

# Upload PJ CDD
@app.route("/api/depense-comptes/<string:cid>/pieces", methods=["POST"])
@token_required
@role_required(['gestionnaire','soumetteur','approbateur'])
def upload_cdd_piece(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400
    file = request.files.get("fichier")
    if not file or not file.filename:
        return jsonify({"error":"Aucun fichier"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute('SELECT id, financial_year, "prénom_demandeur" AS prenom, "nom_demandeur" AS nom FROM compte_depenses WHERE cid=%s', (cid,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Compte de dépense introuvable"}), 404
        expense_id, fin_year, prenom, nom = row["id"], row["financial_year"], row["prenom"], row["nom"]

        cur.execute("SELECT COALESCE(MAX(file_index),0)+1 FROM cdd_pj WHERE expense_pk=%s", (expense_id,))
        next_idx = cur.fetchone()[0] or 1

        base = f"{cid}_{_safe_slug(prenom)}_{_safe_slug(nom)}_{str(next_idx).zfill(2)}"
        ext = os.path.splitext(file.filename)[1] or ".pdf"
        filename = secure_filename(base + ext)

        target_dir = _fy_dir_for_cdd(fin_year, generated=False)
        full_path = os.path.join(target_dir, filename)
        file.save(full_path)

        cur.execute("""
            INSERT INTO cdd_pj (expense_pk, file_index, file_path)
            VALUES (%s, %s, %s)
        """, (expense_id, next_idx, full_path))
        conn.commit()

        # (optionnel) notifier un ajout de pièce jointe
        socketio.emit("cdd.attachment.added", {"cid": cid, "file_index": next_idx}, namespace="/")

        return jsonify({"message":"Pièce ajoutée","file_index":next_idx,"path":full_path}), 201
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec upload CDD","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes/<string:cid>/pieces", methods=["GET"])
@token_required
@role_required(['gestionnaire','soumetteur','approbateur'])
def list_cdd_pieces(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM compte_depenses WHERE cid=%s", (cid,))
        row = cur.fetchone()
        if not row: return jsonify({"error":"Compte introuvable"}), 404
        expense_id = row[0]
        cur.execute("""
            SELECT file_index, file_path, uploaded_at
            FROM cdd_pj WHERE expense_pk=%s ORDER BY file_index
        """, (expense_id,))
        items = [{"file_index": r[0], "file_path": r[1], "uploaded_at": r[2].isoformat() if r[2] else None} for r in cur.fetchall()]
        return jsonify(items), 200
    finally:
        cur.close(); conn.close()

@app.route("/api/depense-comptes/<string:cid>/pieces/<int:file_index>", methods=["GET"])
@token_required
@role_required(['gestionnaire','soumetteur','approbateur'])
def download_cdd_piece(cid, file_index):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM compte_depenses WHERE cid=%s", (cid,))
        row = cur.fetchone()
        if not row: return jsonify({"error":"Compte introuvable"}), 404
        expense_id = row[0]
        cur.execute("""
            SELECT file_path FROM cdd_pj
            WHERE expense_pk=%s AND file_index=%s
        """, (expense_id, file_index))
        r = cur.fetchone()
        if not r: return jsonify({"error":"Pièce jointe introuvable"}), 404
        path = r[0]
        if not path or not os.path.exists(path):
            return jsonify({"error":"Fichier manquant sur le disque"}), 404
        return send_from_directory(
            os.path.dirname(path),
            os.path.basename(path),
            as_attachment=True,
            download_name=os.path.basename(path)
        )
    finally:
        cur.close(); conn.close()

# Sauvegarder un PDF CDD généré par l'app
@app.route("/api/depense-comptes/<string:cid>/generated-pdf", methods=["POST"])
@token_required
@role_required(['gestionnaire','approbateur'])
def save_generated_cdd_pdf(cid):
    if not CID_RE.match(cid):
        return jsonify({"error":"cid invalide (CYYYY-HABITEK###)"}), 400

    file = request.files.get("pdf")
    pdf_b64 = None
    if not file:
        body = request.get_json(silent=True) or {}
        pdf_b64 = body.get("pdf_base64")
    if not file and not pdf_b64:
        return jsonify({"error":"Envoyer 'pdf' (multipart) ou 'pdf_base64' (JSON)"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT id, financial_year FROM compte_depenses WHERE cid=%s", (cid,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Compte de dépense introuvable"}), 404
        expense_id, fin_year = row["id"], row["financial_year"]

        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        filename = secure_filename(f"CDD_{cid}_{today}.pdf")
        target_dir = _fy_dir_for_cdd(fin_year, generated=True)
        full_path = os.path.join(target_dir, filename)

        if file:
            file.save(full_path)
        else:
            import base64
            try:
                content = base64.b64decode(pdf_b64)
            except Exception:
                return jsonify({"error":"pdf_base64 invalide"}), 400
            with open(full_path, "wb") as f:
                f.write(content)

        cur.execute("SELECT COALESCE(MAX(file_index),0)+1 FROM cdd_pj WHERE expense_pk=%s", (expense_id,))
        next_idx = cur.fetchone()[0] or 1
        cur.execute("""
            INSERT INTO cdd_pj (expense_pk, file_index, file_path)
            VALUES (%s, %s, %s)
        """, (expense_id, next_idx, full_path))
        conn.commit()

        socketio.emit("cdd.attachment.added", {"cid": cid, "file_index": next_idx, "generated": True}, namespace="/")
        return jsonify({"message":"PDF généré sauvegardé","path":full_path,"file_index":next_idx}), 201
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error":"Échec sauvegarde PDF","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# -----------------------------------------------------------------------------
# BUDGETS
# -----------------------------------------------------------------------------
FY_RE = re.compile(r"^\d{4}$")

def _norm_fy(fy):
    if fy is None:
        return None
    if isinstance(fy, int):
        fy = str(fy)
    fy = (fy or "").strip()
    if not FY_RE.match(fy):
        raise ValueError("financial_year doit être 'YYYY'")
    return fy

@app.route("/api/budgets", methods=["GET"])
@token_required
def list_budgets():
    fy = request.args.get("fy")
    fund_type = request.args.get("fund_type")
    revenue_type = request.args.get("revenue_type")
    contains = request.args.get("contains") == "1"

    where, params = [], []

    try:
        if fy:
            fy = _norm_fy(fy)
            where.append("financial_year = %s")
            params.append(fy)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if fund_type:
        if contains:
            where.append("fund_type ILIKE %s"); params.append(f"%{fund_type}%")
        else:
            where.append("fund_type = %s"); params.append(fund_type)

    if revenue_type:
        if contains:
            where.append("revenue_type ILIKE %s"); params.append(f"%{revenue_type}%")
        else:
            where.append("revenue_type = %s"); params.append(revenue_type)

    sql = """
        SELECT id, financial_year, fund_type, revenue_type, amount, date_added
        FROM budgets
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY financial_year DESC, fund_type, revenue_type, id DESC"

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        items = [{k: convert_to_json_serializable(v) for k,v in dict(r).items()} for r in rows]
        return jsonify(items), 200
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":"Échec lecture budgets","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def create_budget():
    data = request.get_json() or {}
    fy   = data.get("financial_year")
    ftyp = (data.get("fund_type") or "").strip()
    rtyp = (data.get("revenue_type") or "").strip()
    amt  = data.get("amount")

    try:
        fy = _norm_fy(fy)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if not ftyp or not rtyp:
        return jsonify({"error":"fund_type et revenue_type sont requis"}), 400
    try:
        amt = Decimal(str(amt))
    except Exception:
        return jsonify({"error":"amount invalide"}), 400

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO budgets (financial_year, fund_type, revenue_type, amount)
            VALUES (%s,%s,%s,%s)
            RETURNING id, financial_year, fund_type, revenue_type, amount, date_added
        """, (fy, ftyp, rtyp, amt))
        row = cur.fetchone()
        conn.commit()
        payload = {k: convert_to_json_serializable(v) for k,v in dict(row).items()}
        socketio.emit("budget.created", payload, namespace="/")
        return jsonify(payload), 201
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Échec création budget","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets/<int:bid>", methods=["PATCH"])
@token_required
@role_required(['gestionnaire'])
def update_budget(bid):
    data = request.get_json() or {}
    allowed = {"financial_year","fund_type","revenue_type","amount"}
    sets, vals = [], []

    if "financial_year" in data:
        try:
            fy = _norm_fy(data["financial_year"])
            sets.append("financial_year=%s"); vals.append(fy)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if "fund_type" in data:
        sets.append("fund_type=%s"); vals.append((data["fund_type"] or "").strip())

    if "revenue_type" in data:
        sets.append("revenue_type=%s"); vals.append((data["revenue_type"] or "").strip())

    if "amount" in data:
        try:
            amt = Decimal(str(data["amount"]))
        except Exception:
            return jsonify({"error":"amount invalide"}), 400
        sets.append("amount=%s"); vals.append(amt)

    if not sets:
        return jsonify({"message":"Aucun changement"}), 200

    sql = f"UPDATE budgets SET {', '.join(sets)} WHERE id=%s RETURNING id, financial_year, fund_type, revenue_type, amount, date_added"
    vals.append(bid)

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(sql, tuple(vals))
        row = cur.fetchone()
        if not row:
            conn.rollback(); return jsonify({"error":"Budget introuvable"}), 404
        conn.commit()
        payload = {k: convert_to_json_serializable(v) for k,v in dict(row).items()}
        socketio.emit("budget.updated", payload, namespace="/")
        return jsonify(payload), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Échec mise à jour budget","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets/<int:bid>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def delete_budget(bid):
    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM budgets WHERE id=%s RETURNING id", (bid,))
        row = cur.fetchone()
        if not row:
            conn.rollback(); return jsonify({"error":"Budget introuvable"}), 404
        conn.commit()
        socketio.emit("budget.deleted", {"id": bid}, namespace="/")
        return jsonify({"message":"Budget supprimé", "id": bid}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Échec suppression budget","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets/fund-types", methods=["GET"])
@token_required
def distinct_fund_types():
    fy = request.args.get("fy")
    try:
        if fy: fy = _norm_fy(fy)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor()
    try:
        if fy:
            cur.execute("SELECT DISTINCT fund_type FROM budgets WHERE financial_year=%s ORDER BY fund_type", (fy,))
        else:
            cur.execute("SELECT DISTINCT fund_type FROM budgets ORDER BY fund_type")
        return jsonify([r[0] for r in cur.fetchall()]), 200
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets/revenue-types", methods=["GET"])
@token_required
def distinct_revenue_types():
    fy = request.args.get("fy")
    try:
        if fy: fy = _norm_fy(fy)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor()
    try:
        if fy:
            cur.execute("SELECT DISTINCT revenue_type FROM budgets WHERE financial_year=%s ORDER BY revenue_type", (fy,))
        else:
            cur.execute("SELECT DISTINCT revenue_type FROM budgets ORDER BY revenue_type")
        return jsonify([r[0] for r in cur.fetchall()]), 200
    finally:
        cur.close(); conn.close()

@app.route("/api/budgets/summary", methods=["GET"])
@token_required
def budgets_summary():
    fy = request.args.get("fy")
    try:
        if fy: fy = _norm_fy(fy)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = get_db_connection()
    if not conn: return jsonify({"error":"DB indisponible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        if fy:
            cur.execute("""
                SELECT SUM(amount) AS total,
                       SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) AS total_positive,
                       SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS total_negative
                FROM budgets
                WHERE financial_year=%s
            """, (fy,))
        else:
            cur.execute("""
                SELECT financial_year,
                       SUM(amount) AS total,
                       SUM(CASE WHEN amount >= 0 THEN amount ELSE 0 END) AS total_positive,
                       SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS total_negative
                FROM budgets
                GROUP BY financial_year
                ORDER BY financial_year DESC
            """)
        total_block = cur.fetchall()

        if fy:
            cur.execute("""
                SELECT fund_type, SUM(amount) AS total
                FROM budgets
                WHERE financial_year=%s
                GROUP BY fund_type
                ORDER BY fund_type
            """, (fy,))
        else:
            cur.execute("""
                SELECT financial_year, fund_type, SUM(amount) AS total
                FROM budgets
                GROUP BY financial_year, fund_type
                ORDER BY financial_year DESC, fund_type
            """)
        by_fund = cur.fetchall()

        if fy:
            cur.execute("""
                SELECT revenue_type, SUM(amount) AS total
                FROM budgets
                WHERE financial_year=%s
                GROUP BY revenue_type
                ORDER BY revenue_type
            """, (fy,))
        else:
            cur.execute("""
                SELECT financial_year, revenue_type, SUM(amount) AS total
                FROM budgets
                GROUP BY financial_year, revenue_type
                ORDER BY financial_year DESC, revenue_type
            """)
        by_rev = cur.fetchall()

        def ser(rows):
            return [{k: convert_to_json_serializable(v) for k,v in dict(r).items()} for r in rows]

        return jsonify({
            "filter_financial_year": fy,
            "totals": ser(total_block),
            "by_fund_type": ser(by_fund),
            "by_revenue_type": ser(by_rev)
        }), 200
    except Exception as e:
        traceback.print_exc(); return jsonify({"error":"Échec summary budgets","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# -----------------------------------------------------------------------------
# Run (dev)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", "5000"))
    debug = True if os.environ.get("FLASK_DEBUG", "1") == "1" else False
    # Démarrage via Socket.IO (eventlet)
    socketio.run(app, host=host, port=port, debug=debug)
