import eventlet
# Monkey-patch pour eventlet : applique des modifications aux bibliothèques Python standard
# pour les rendre compatibles avec l'exécution asynchrone d'eventlet.
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import psycopg2
import psycopg2.extras
from datetime import datetime
import csv
import io
from urllib.parse import urlparse
from decimal import Decimal

# Initialisation de l'application Flask
app = Flask(__name__)
# Limite la taille des fichiers uploadés à 2 Go
app.config['MAX_CONTENT_LENGTH'] = 2048 * 1024 * 1024

# Configuration de CORS pour permettre les requêtes cross-origin sur les routes /api/*
CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Content-Disposition"])

# Initialisation de SocketIO pour la communication en temps réel
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
# Compteur global du nombre de clients connectés via SocketIO
client_count = 0

# Dictionnaire de mappage pour normaliser les types de fonds entre le front et la base de données
FUND_TYPE_MAP = {
    "Fond 1":         "fonds de type 1",
    "fonds de type 1":"fonds de type 1",
    "Fond 3":         "fonds de type 3",
    "fonds de type 3":"fonds de type 3",
}

def normalize_fund_type(raw: str) -> str:
    """
    Normalise le type de fonds reçu du front-end pour correspondre aux valeurs attendues en base.
    Args:
        raw (str): Type de fonds brut (ex: 'Fond 1', 'fonds de type 3').
    Returns:
        str: Type de fonds normalisé.
    Raises:
        ValueError: Si le type de fonds est invalide.
    """
    normalized = FUND_TYPE_MAP.get(raw)
    if not normalized:
        raise ValueError(f"Type de fonds invalide: {raw!r}")
    return normalized

@socketio.on('connect')
def handle_connect():
    """
    Gère la connexion d'un nouveau client via SocketIO.
    - Incrémente le compteur de clients.
    - Diffuse le nouveau nombre de clients connectés à tous les clients.
    """
    global client_count
    client_count += 1
    emit('client_count', client_count, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    """
    Gère la déconnexion d'un client via SocketIO.
    - Décrémente le compteur de clients.
    - Diffuse le nouveau nombre de clients connectés à tous les clients.
    """
    global client_count
    client_count -= 1
    emit('client_count', client_count, broadcast=True)

# Configuration du dossier pour stocker les fichiers uploadés
UPLOAD_FOLDER = "backend/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Crée le dossier s'il n'existe pas
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# URL de connexion à la base de données PostgreSQL, récupérée depuis une variable d'environnement
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://minio:Habitek2025@localhost:5432/factures_db")

def get_db_connection():
    """
    Établit une connexion à la base de données PostgreSQL.
    Returns:
        psycopg2.connection: Connexion à la base, ou None en cas d'erreur.
    """
    try:
        url = urlparse(DATABASE_URL)
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        return conn
    except psycopg2.Error as e:
        print(f"Erreur de connexion à PostgreSQL : {e}")
        return None

def init_db():
    """
    Initialise la base de données en créant les tables 'factures' et 'budgets' si elles n'existent pas.
    - Table 'factures' : stocke les informations des factures (année, type, montant, fichier, etc.).
    - Table 'budgets' : stocke les budgets (année financière, type de fonds, revenus, montant).
    """
    conn = get_db_connection()
    if conn is None:
        print("Échec de la connexion à la base de données, impossible d'initialiser les tables.")
        return

    cursor = conn.cursor()
    try:
        # Création de la table 'factures'
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factures (
                id SERIAL PRIMARY KEY,
                annee VARCHAR(4) NOT NULL,
                type VARCHAR(50) NOT NULL,
                ubr VARCHAR(50),
                fournisseur VARCHAR(255),
                description TEXT,
                montant DECIMAL(10,2) NOT NULL,
                statut VARCHAR(50) NOT NULL,
                fichier_nom VARCHAR(255),
                numero INTEGER,
                date_ajout TIMESTAMP NOT NULL
            );
        """)
        # Création de la table 'budgets'
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                financial_year VARCHAR(4) NOT NULL,
                fund_type VARCHAR(50) NOT NULL,
                revenue_type VARCHAR(255) NOT NULL,
                amount NUMERIC(10,2) NOT NULL,
                date_added TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
            );
        """)
        
        conn.commit()
        print("Tableau de factures vérifié/créé.")
        print("Tableau de budgets vérifié/créé.")
    except psycopg2.Error as e:
        print(f"Erreur d'initialisation de la base de données : {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

# Initialisation de la base de données au démarrage de l'application
init_db()

def convert_to_json_serializable(obj):
    """
    Convertit les types non sérialisables en JSON (Decimal, datetime) pour les réponses API.
    Args:
        obj: Objet à convertir.
    Returns:
        Objet sérialisable en JSON.
    """
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

@app.route("/")
def home():
    """
    Route racine de l'application.
    - Retourne un message simple pour confirmer que l'application Flask fonctionne.
    """
    return "Flask fonctionne ✅"

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    """
    Crée une nouvelle facture et enregistre un fichier associé si fourni.
    - Valide les champs obligatoires (année, type, montant).
    - Génère un numéro unique pour la facture en fonction du type et de l'année.
    - Sauvegarde le fichier uploadé avec un nom sécurisé.
    - Insère les données en base et notifie les clients via SocketIO.
    Returns:
        JSON: Données de la facture créée ou message d'erreur.
    """
    file = request.files.get("fichier")
    data = request.form
    annee = data.get("annee")
    print(f"Données reçues : annee={annee}, fichier={file}")  # Débogage

    # Validation des données obligatoires
    if not annee or not data.get("type") or not data.get("montant"):
        return jsonify({"error": "Données obligatoires manquantes (année, type, montant)."}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    filepath = None
    filename = None
    try:
        # Compter les factures du même type pour générer le numéro
        cursor.execute("SELECT COUNT(*) FROM factures WHERE annee = %s AND type = %s", 
                       (annee, data.get("type")))
        count = cursor.fetchone()[0]
        numero = count + 1

        # Gérer le fichier s'il est fourni
        if file and file.filename:
            print(f"Tentative de sauvegarde du fichier : {file.filename}")  # Débogage
            original_filename, file_extension = os.path.splitext(secure_filename(file.filename))
            filename = secure_filename(
                f"{annee}_{data.get('type')}_{numero}_UBR_{data.get('ubr', 'N-A')}_{original_filename}{file_extension}"
            )
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            try:
                file.save(filepath)
                print(f"Fichier sauvegardé : {filepath}")  # Débogage
                if not os.path.exists(filepath):
                    print(f"Erreur : le fichier {filepath} n'a pas été créé.")  # Débogage
                    return jsonify({"error": "Échec de la sauvegarde du fichier."}), 500
            except Exception as e:
                print(f"Erreur lors de la sauvegarde du fichier : {e}")  # Débogage
                return jsonify({"error": f"Erreur lors de l'enregistrement du fichier : {e}"}), 500
        else:
            print("Aucun fichier fourni ou fichier vide.")  # Débogage

        # Valider le montant
        try:
            montant = float(data.get("montant"))
        except ValueError:
            print("Erreur : Montant invalide.")  # Débogage
            return jsonify({"error": "Montant invalide."}), 400

        # Insérer la facture
        sql = """
        INSERT INTO factures (
            annee, type, ubr, fournisseur, description,
            montant, statut, fichier_nom, numero, date_ajout
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        params = (
            annee,
            data.get("type"),
            data.get("ubr"),
            data.get("fournisseur"),
            data.get("description"),
            montant,
            data.get("statut"),
            filename,  # Peut être None si aucun fichier
            numero,
            datetime.now()
        )
        cursor.execute(sql, params)
        new_id = cursor.fetchone()[0]
        conn.commit()

        # Récupérer la facture insérée
        dict_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        dict_cursor.execute("SELECT * FROM factures WHERE id = %s", (new_id,))
        new_f = dict_cursor.fetchone()
        facture = {key: convert_to_json_serializable(value) for key, value in dict(new_f).items()}  # Convertir Decimal et datetime
        dict_cursor.close()

        socketio.emit('new_facture', facture)
        return jsonify(facture), 201
    except psycopg2.Error as e:
        conn.rollback()
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        print(f"Erreur PostgreSQL lors de l'enregistrement de la facture : {e}")  # Débogage
        return jsonify({"error": f"Erreur lors de l'enregistrement en base de données : {e}"}), 500
    except Exception as e:
        conn.rollback()
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        print(f"Erreur inattendue lors de l'enregistrement de la facture : {e}")  # Débogage
        return jsonify({"error": f"Une erreur est survenue : {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures", methods=["GET"])
def get_factures():
    """
    Récupère la liste des factures pour une année donnée.
    - Par défaut, utilise l'année en cours si aucune année n'est spécifiée.
    - Retourne les factures triées par ID (du plus récent au plus ancien).
    Returns:
        JSON: Liste des factures ou message d'erreur.
    """
    annee = request.args.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))
        rows = cursor.fetchall()
        # Convertir Decimal et datetime pour toutes les factures
        result = [{key: convert_to_json_serializable(value) for key, value in dict(row).items()} for row in rows]
        return jsonify(result)
    except psycopg2.Error as e:
        print(f"Erreur PostgreSQL lors de la récupération des factures : {e}")
        return jsonify({"error": "Erreur lors de l'accès aux factures."}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    """
    Récupère le fichier associé à une facture spécifique.
    - Vérifie si la facture existe et si le fichier est toujours présent.
    - Met à jour la base si le fichier est manquant (fichier_nom = NULL).
    - Retourne le fichier en tant que pièce jointe.
    Args:
        id (int): ID de la facture.
    Returns:
        Fichier ou message d'erreur JSON.
    """
    annee = request.args.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        # Récupérer le nom du fichier en base
        cursor.execute(
            "SELECT fichier_nom FROM factures WHERE id = %s AND annee = %s",
            (id, annee)
        )
        row = cursor.fetchone()

        # Si pas de ligne ou fichier_nom déjà NULL
        if not row or not row[0]:
            return jsonify({"warning": "La facture n'existe plus sur le système"}), 404

        filename = secure_filename(row[0])
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)

        # Si le fichier a été supprimé du système de fichiers
        if not os.path.exists(filepath):
            # Mettre à jour la base pour nullifier fichier_nom
            cursor.execute(
                "UPDATE factures SET fichier_nom = NULL WHERE id = %s AND annee = %s",
                (id, annee)
            )
            conn.commit()
            return jsonify({"warning": "La facture n'existe plus sur le système"}), 404

        # Retourner le fichier
        return send_from_directory(
            app.config["UPLOAD_FOLDER"],
            filename,
            as_attachment=True
        )

    except psycopg2.Error as e:
        print(f"Erreur PostgreSQL lors de la récupération du fichier : {e}")
        return jsonify({"error": "Erreur lors de l'accès au fichier."}), 500

    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    """
    Supprime une facture et son fichier associé (si existant).
    - Supprime le fichier du système de fichiers si présent.
    - Supprime l'entrée de la base de données.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID de la facture.
    Returns:
        JSON: Message de confirmation ou erreur.
    """
    annee = request.args.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT fichier_nom FROM factures WHERE id = %s AND annee = %s", (id, annee))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Facture non trouvée"}), 404

        # Supprimer le fichier si existant
        if row[0]:
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], secure_filename(row[0]))
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"Fichier supprimé : {filepath}")  # Débogage
                except Exception as e:
                    print(f"Erreur lors de la suppression du fichier {filepath} : {e}")  # Débogage

        cursor.execute("DELETE FROM factures WHERE id = %s AND annee = %s", (id, annee))
        if cursor.rowcount == 0:
            return jsonify({"error": "Facture non trouvée après tentative de suppression"}), 404
        conn.commit()

        socketio.emit('delete_facture', {'id': id})
        return jsonify({"message": "Facture supprimée"}), 200
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Erreur PostgreSQL lors de la suppression de la facture : {e}")
        return jsonify({"error": f"Erreur lors de la suppression : {e}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Erreur inattendue lors de la suppression de la facture : {e}")
        return jsonify({"error": f"Une erreur est survenue : {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    """
    Met à jour les champs d'une facture existante.
    - Valide les champs modifiables (type, ubr, fournisseur, description, montant, statut).
    - Construit dynamiquement la requête SQL pour les champs fournis.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID de la facture.
    Returns:
        JSON: Données de la facture mise à jour ou message d'erreur.
    """
    data = request.get_json() or {}
    annee = data.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        allowed = ["type", "ubr", "fournisseur", "description", "montant", "statut"]
        fields, vals = [], []
        for key in allowed:
            if key in data:
                fields.append(f"{key} = %s")
                if key == "montant":
                    try:
                        vals.append(float(data[key]))
                    except ValueError:
                        return jsonify({"error": "Montant invalide"}), 400
                else:
                    vals.append(data[key])

        if not fields:
            return jsonify({"error": "Aucun champ à mettre à jour"}), 400

        vals.append(id)
        vals.append(annee)
        sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = %s AND annee = %s RETURNING *"
        cursor.execute(sql, vals)
        updated = cursor.fetchone()
        if not updated:
            return jsonify({"error": "Facture non trouvée"}), 404
        conn.commit()
        facture = {key: convert_to_json_serializable(value) for key, value in dict(updated).items()}  # Convertir Decimal et datetime
        socketio.emit('update_facture', facture)
        return jsonify(facture), 200
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Erreur PostgreSQL lors de la mise à jour de la facture : {e}")
        return jsonify({"error": f"Erreur lors de la mise à jour : {e}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Erreur inattendue lors de la mise à jour de la facture : {e}")
        return jsonify({"error": f"Une erreur est survenue : {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures/export-csv", methods=["GET"])
def export_factures_csv():
    """
    Exporte les factures d'une année donnée au format CSV.
    - Récupère toutes les factures pour l'année spécifiée.
    - Génère un fichier CSV avec les en-têtes et les données.
    - Retourne le CSV en tant que pièce jointe.
    Returns:
        Response: Fichier CSV ou message d'erreur JSON.
    """
    annee = request.args.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))
        rows = cursor.fetchall()

        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        header = [desc[0] for desc in cursor.description]
        csv_writer.writerow(header)
        for row in rows:
            csv_writer.writerow(row)

        csv_content = csv_buffer.getvalue()
        response = Response(csv_content, mimetype='text/csv')
        response.headers.set("Content-Disposition", "attachment", filename=f"factures_{annee}.csv")
        return response
    except psycopg2.Error as e:
        print(f"Erreur PostgreSQL lors de l'exportation CSV : {e}")
        return jsonify({"error": "Erreur lors de l'accès à la base de données pour l'exportation."}), 500
    finally:
        cursor.close()
        conn.close()

# -------------------------------
#       Routes CRUD pour budgets
# -------------------------------

@app.route("/api/budget", methods=["GET"])
def get_budgets():
    """
    Récupère la liste des budgets pour une année financière donnée.
    - Par défaut, utilise l'année en cours si non spécifiée.
    - Retourne les budgets triés par ID (du plus récent au plus ancien).
    Returns:
        JSON: Liste des budgets ou message d'erreur.
    """
    year = request.args.get("financial_year", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            SELECT * 
              FROM budgets
             WHERE financial_year = %s
             ORDER BY id DESC
        """, (year,))
        rows = cur.fetchall()
        data = [
            {k: convert_to_json_serializable(v) for k, v in dict(row).items()}
            for row in rows
        ]
        return jsonify(data), 200

    except psycopg2.Error as e:
        print("Erreur GET /api/budget :", e)
        return jsonify({"error": "Impossible de récupérer les budgets"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget", methods=["POST"])
def create_budget():
    """
    Crée un nouveau budget.
    - Valide les champs obligatoires (année financière, type de fonds, type de revenu, montant).
    - Normalise le type de fonds via `normalize_fund_type`.
    - Insère le budget en base et notifie les clients via SocketIO.
    Returns:
        JSON: Données du budget créé ou message d'erreur.
    """
    data = request.get_json() or {}
    print("DEBUG create_budget payload:", data)

    # Validation des champs obligatoires
    for f in ("financial_year", "fund_type", "revenue_type", "amount"):
        if not data.get(f):
            return jsonify({"error": f"Le champ '{f}' est requis"}), 400

    # Normalisation du type de fonds
    try:
        data["fund_type"] = normalize_fund_type(data["fund_type"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Conversion du montant
    try:
        amt = float(data["amount"])
    except ValueError:
        return jsonify({"error": "Montant invalide"}), 400

    # Insertion en base
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO budgets
              (financial_year, fund_type, revenue_type, amount)
            VALUES (%s,%s,%s,%s)
            RETURNING *
        """, (
            data["financial_year"],
            data["fund_type"],
            data["revenue_type"],
            amt
        ))
        new_row = cur.fetchone()
        conn.commit()
        budget = {k: convert_to_json_serializable(v) for k, v in dict(new_row).items()}
        socketio.emit("new_budget", budget)
        return jsonify(budget), 201

    except psycopg2.Error as e:
        conn.rollback()
        print("Erreur POST /api/budget :", e)
        return jsonify({"error": "Impossible de créer le budget"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget/<int:id>", methods=["PUT"])
def update_budget(id):
    """
    Met à jour un budget existant.
    - Valide les champs modifiables (année financière, type de fonds, type de revenu, montant).
    - Normalise le type de fonds si fourni.
    - Construit dynamiquement la requête SQL pour les champs modifiés.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID du budget.
    Returns:
        JSON: Données du budget mis à jour ou message d'erreur.
    """
    data = request.get_json() or {}
    allowed = ["financial_year", "fund_type", "revenue_type", "amount"]
    fields, vals = [], []

    # Normalisation du type de fonds si présent
    if "fund_type" in data:
        try:
            data["fund_type"] = normalize_fund_type(data["fund_type"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Préparation des champs à mettre à jour
    for f in allowed:
        if f in data:
            if f == "amount":
                try:
                    vals.append(float(data[f]))
                except ValueError:
                    return jsonify({"error": "Montant invalide"}), 400
            else:
                vals.append(data[f])
            fields.append(f"{f} = %s")

    if not fields:
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    # Exécution de la mise à jour
    vals.append(id)
    sql = f"""
        UPDATE budgets
           SET {', '.join(fields)}
         WHERE id = %s
      RETURNING *
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(sql, vals)
        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "Budget non trouvé"}), 404
        conn.commit()

        budget = {k: convert_to_json_serializable(v) for k, v in dict(updated).items()}
        socketio.emit("update_budget", budget)
        return jsonify(budget), 200

    except psycopg2.Error as e:
        conn.rollback()
        print("Erreur PUT /api/budget/:id :", e)
        return jsonify({"error": "Impossible de mettre à jour le budget"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget/<int:id>", methods=["DELETE"])
def delete_budget(id):
    """
    Supprime un budget existant.
    - Supprime l'entrée de la base de données.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID du budget.
    Returns:
        JSON: Message de confirmation ou erreur.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500

    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM budgets WHERE id = %s RETURNING id", (id,))
        if cur.fetchone() is None:
            return jsonify({"error": "Budget non trouvé"}), 404
        conn.commit()

        socketio.emit("delete_budget", {"id": id})
        return jsonify({"message": "Budget supprimé"}), 200

    except psycopg2.Error as e:
        conn.rollback()
        print("Erreur DELETE /api/budgets/:id :", e)
        return jsonify({"error": "Impossible de supprimer le budget"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget/revenue-types", methods=["GET"])
def get_revenue_types_alias():
    """
    Retourne les types de revenus possibles pour chaque type de fonds.
    - Fournit une liste statique des types de revenus associés aux fonds 1 et 3.
    Returns:
        JSON: Dictionnaire des types de revenus par fonds.
    """
    revenue_types = {
        "Fond 1": [
            "Subvention Services à la vie étudiante",
            "Travail étudiant au compte de club pour un service ou un département",
            "Subvention au club pour la participation aux portes ouvertes",
            "Autre revenu interne"
        ],
        "Fond 3": [
            "Dons",
            "Levée de fonds",
            "Bourses d'entreprises ou d'organismes"
        ]
    }
    return jsonify(revenue_types), 200

@app.route("/api/budget/verify-pin", methods=["POST"])
def verify_pin():
    """
    Vérifie un code PIN fourni par l'utilisateur.
    - Compare le PIN reçu avec un PIN statique (non sécurisé, à améliorer).
    Returns:
        JSON: Résultat de la vérification (succès ou échec).
    """
    data = request.get_json() or {}
    PIN_CORRECT = "1234"  # TODO: Sécuriser en variable d'environnement
    ok = data.get("pin") == PIN_CORRECT
    return jsonify({"success": ok}), (200 if ok else 401)

if __name__ == '__main__':
    """
    Point d'entrée de l'application.
    - Lance le serveur Flask avec SocketIO sur le port spécifié (par défaut 5000).
    - Accepte les connexions depuis toutes les interfaces réseau (0.0.0.0).
    """
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)