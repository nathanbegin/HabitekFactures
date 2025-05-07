import eventlet
# Monkey-patch pour eventlet
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

app = Flask(__name__)
# Limite à 2 GB
app.config['MAX_CONTENT_LENGTH'] = 2048 * 1024 * 1024

# CORS pour toutes les routes /api/*
CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Content-Disposition"])

# SocketIO avec compteur de clients
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
client_count = 0

@socketio.on('connect')
def handle_connect():
    global client_count
    client_count += 1
    emit('client_count', client_count, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    global client_count
    client_count -= 1
    emit('client_count', client_count, broadcast=True)

# Dossier pour les uploads
UPLOAD_FOLDER = "backend/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# URL de connexion PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://minio:Habitek2025@localhost:5432/factures_db")

def get_db_connection():
    """Établit une connexion à la base de données PostgreSQL."""
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
    """Initialise la base de données PostgreSQL en créant la table factures si elle n'existe pas."""
    conn = get_db_connection()
    if conn is None:
        print("Échec de la connexion à la base de données, impossible d'initialiser les tables.")
        return

    cursor = conn.cursor()
    try:
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
        # Création de la table budgets
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

# Initialiser la base de données au démarrage
init_db()

# Fonction utilitaire pour convertir les types non sérialisables JSON
def convert_to_json_serializable(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj

@app.route("/")
def home():
    return "Flask fonctionne ✅"

@app.route("/api/factures", methods=["POST"])
def upload_facture():
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
    annee = request.args.get("annee", str(datetime.now().year))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        # On récupère le nom de fichier en base
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
            # Mettre à jour la BD pour nullifier fichier_nom
            cursor.execute(
                "UPDATE factures SET fichier_nom = NULL WHERE id = %s AND annee = %s",
                (id, annee)
            )
            conn.commit()
            return jsonify({"warning": "La facture n'existe plus sur le système"}), 404

        # Tout va bien : on renvoie le fichier
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

        # Supprimer le fichier uniquement si fichier_nom est non NULL et non vide
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

@app.route("/api/budgets", methods=["GET"])
def get_budgets():
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
        print("Erreur GET /api/budgets :", e)
        return jsonify({"error": "Impossible de récupérer les budgets"}), 500

    finally:
        cur.close()
        conn.close()


@app.route("/api/budgets", methods=["POST"])
def create_budget():
    data = request.get_json() or {}
    # champs obligatoires
    for f in ("financial_year", "fund_type", "revenue_type", "amount"):
        if not data.get(f):
            return jsonify({"error": f"Le champ '{f}' est requis"}), 400

    # validation fund_type
    if data["fund_type"] not in ("fonds de type 1", "fonds de type 3"):
        return jsonify({
            "error": "fund_type invalide (‘fonds de type 1’ ou ‘fonds de type 3’ attendu)"
        }), 400

    # conversion amount
    try:
        amt = float(data["amount"])
    except ValueError:
        return jsonify({"error": "Montant invalide"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO budgets
               (financial_year, fund_type, revenue_type, amount)
            VALUES (%s, %s, %s, %s)
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
        print("Erreur POST /api/budgets :", e)
        return jsonify({"error": "Impossible de créer le budget"}), 500

    finally:
        cur.close()
        conn.close()


@app.route("/api/budgets/<int:id>", methods=["PUT"])
def update_budget(id):
    data = request.get_json() or {}
    allowed = ["financial_year", "fund_type", "revenue_type", "amount"]
    fields, vals = [], []

    for f in allowed:
        if f in data:
            if f == "fund_type" and data[f] not in ("fonds de type 1", "fonds de type 3"):
                return jsonify({
                    "error": "fund_type invalide (‘fonds de type 1’ ou ‘fonds de type 3’ attendu)"
                }), 400
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
        print("Erreur PUT /api/budgets/:id :", e)
        return jsonify({"error": "Impossible de mettre à jour le budget"}), 500

    finally:
        cur.close()
        conn.close()


@app.route("/api/budgets/<int:id>", methods=["DELETE"])
def delete_budget(id):
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

@app.route("/api/budgets/revenue-types", methods=["GET"])
def get_revenue_types():
    # si statique, sinon tirer dynamiquement de la base
    types = {
      "fonds de type 1": ["Type A", "Type B"],
      "fonds de type 3": ["Type C", "Type D"]
    }
    return jsonify(types), 200


@app.route("/api/budgets/verify-pin", methods=["POST"])
def verify_pin():
    data = request.get_json() or {}
    PIN_CORRECT = "1234"  # à sécuriser en config/env
    ok = data.get("pin") == PIN_CORRECT
    return jsonify({"success": ok}), (200 if ok else 401)


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)