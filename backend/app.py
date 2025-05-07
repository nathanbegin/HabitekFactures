import eventlet
# Monkey-patch pour eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import psycopg2
import psycopg2.extras # Pour DictCursor
from datetime import datetime
import csv
import io
from urllib.parse import urlparse # Pour parser l'URL de la base de données

app = Flask(__name__)
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

# Dossiers
UPLOAD_FOLDER = "backend/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Get Database URL from environment variable or use default
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://minio:Habitek2025@localhost:5432/factures_db")

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    conn = None
    try:
        # Parse the DATABASE_URL
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
        print(f"Database connection error: {e}")
        return None

# --- Database Initialization (Basic) ---
def init_db():
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to database, cannot initialize tables.")
        return

    cursor = conn.cursor()
    try:
        # Create factures table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factures (
                id SERIAL PRIMARY KEY,
                annee VARCHAR(4) NOT NULL,
                type VARCHAR(50) NOT NULL,
                ubr VARCHAR(50),
                fournisseur VARCHAR(255),
                description TEXT,
                montant DECIMAL(10, 2) NOT NULL,
                statut VARCHAR(50) NOT NULL,
                fichier_nom VARCHAR(255),
                numero INTEGER,
                date_ajout TIMESTAMP NOT NULL
            );
        """)

        # Create budgets table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                financial_year VARCHAR(4) NOT NULL,
                fund_type VARCHAR(50) NOT NULL CHECK (fund_type IN ('Fond 1', 'Fond 3')),
                revenue_type VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                date_added TIMESTAMP NOT NULL
            );
        """)

        conn.commit()
        print("Database tables checked/created.")
    except psycopg2.Error as e:
        conn.rollback()
        print(f"Database initialization error: {e}")
    except Exception as e:
        conn.rollback()
        print(f"An unexpected error occurred during database initialization: {e}")
    finally:
        cursor.close()
        conn.close()

# Initialize database on startup
init_db()

# Helper function to get the financial year (May 1st to April 30th)
def get_financial_year(date=None):
    if date is None:
        date = datetime.now()
    if date.month >= 5:
        return str(date.year)
    else:
        return str(date.year - 1)

@app.route("/")
def home():
    return "Flask fonctionne ✅"

# --- Factures Endpoints ---

@app.route("/api/factures", methods=["GET"])
def get_factures():
    annee = request.args.get("annee", str(get_financial_year()))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    except psycopg2.Error as e:
        print(f"Database error fetching factures: {e}")
        return jsonify({"error": "Erreur lors de l'accès aux factures."}), 500
    except Exception as e:
        print(f"An unexpected error occurred fetching factures: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la récupération des factures."}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    # Data comes from form, including file
    file = request.files.get("fichier")
    data = request.form
    annee = data.get("annee")

    # Log received data for debugging
    print(f"Received facture data: {data.to_dict()}")
    if file:
        print(f"Received file: {file.filename}, size: {file.content_length}")

    # Basic validation
    if not annee or not data.get("type") or data.get("montant") is None:
        print("Validation failed: Missing required fields (annee, type, montant)")
        return jsonify({"error": "Données de facture manquantes (année, type, montant)."}), 400

    try:
        montant = float(data.get("montant"))
        print(f"Validated montant: {montant}")
    except ValueError as e:
        print(f"Validation failed: Invalid montant - {e}")
        return jsonify({"error": "Montant invalide."}), 400

    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to database")
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()

    filepath = None
    try:
        # Get count for the specific type within the year
        cursor.execute(
            "SELECT COUNT(*) FROM factures WHERE annee = %s AND type = %s", (annee, data.get("type"),)
        )
        count = cursor.fetchone()[0]
        numero = count + 1
        print(f"Calculated numero: {numero} for type {data.get('type')} in year {annee}")

        filename = None
        if file:
            original_filename, file_extension = os.path.splitext(secure_filename(file.filename))
            filename = secure_filename(
                f"{annee}_{data.get('type')}_{numero}_UBR_{data.get('ubr', 'N-A')}_{original_filename}{file_extension}"
            )
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            print(f"Attempting to save file to: {filepath}")
            try:
                # Verify write permissions
                if not os.access(app.config["UPLOAD_FOLDER"], os.W_OK):
                    raise PermissionError(f"No write permission for {app.config['UPLOAD_FOLDER']}")
                file.save(filepath)
                print(f"File saved successfully: {filepath}")
            except Exception as e:
                print(f"Error saving file: {e}")
                return jsonify({"error": f"Erreur lors de l'enregistrement du fichier : {str(e)}"}), 500

        # Validate montant against DECIMAL(10,2)
        if montant > 99999999.99:
            print(f"Validation failed: Montant {montant} exceeds DECIMAL(10,2) limit")
            return jsonify({"error": "Montant dépasse la limite autorisée (max 99999999.99)."}), 400

        sql = """
        INSERT INTO factures (
          annee, type, ubr, fournisseur, description,
          montant, statut, fichier_nom, numero, date_ajout
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """
        params = (
            annee,
            data.get("type"),
            data.get("ubr"),
            data.get("fournisseur"),
            data.get("description"),
            montant,
            data.get("statut"),
            filename,
            numero,
            datetime.now()
        )
        print(f"Executing SQL: {sql % params}")
        cursor.execute(sql, params)
        new_id = cursor.fetchone()[0]
        conn.commit()
        print(f"Inserted facture with ID: {new_id}")

        # Fetch the newly inserted row
        dict_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        dict_cursor.execute("SELECT * FROM factures WHERE id = %s", (new_id,))
        new_f = dict_cursor.fetchone()
        facture = dict(new_f)
        dict_cursor.close()

        socketio.emit('new_facture', facture)
        return jsonify(facture), 201
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error uploading facture: {e}")
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Erreur lors de l'enregistrement en base de données : {str(e)}"}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred uploading facture: {e}")
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Une erreur est survenue lors de l'ajout de la facture : {str(e)}"}), 500
    finally:
        cursor.close()
        if conn:
            conn.close()

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
        row = cursor.fetchone()
        if not row or not row[0]:
            return jsonify({"error": "Fichier non trouvé en base de données"}), 404
        filename = row[0]
        safe_filename = secure_filename(filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

        if not os.path.exists(filepath):
            print(f"Physical file not found for facture {id}: {filepath}")
            return jsonify({"error": "Fichier physique non trouvé sur le serveur"}), 404

        return send_from_directory(app.config["UPLOAD_FOLDER"], safe_filename, as_attachment=True)
    except psycopg2.Error as e:
        print(f"Database error fetching file info: {e}")
        return jsonify({"error": "Erreur lors de l'accès aux informations du fichier."}), 500
    except Exception as e:
        print(f"An unexpected error occurred fetching file: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la récupération du fichier."}), 500
    finally:
        cursor.close()
        if conn:
            conn.close()

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    filename = None

    try:
        cursor.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Facture non trouvée en base de données"}), 404
        filename = row[0]

        cursor.execute("DELETE FROM factures WHERE id = %s RETURNING id;", (id,))
        deleted_id = cursor.fetchone()
        conn.commit()

        if deleted_id is None:
            return jsonify({"error": "Facture non trouvée après tentative de suppression."}), 404

        if filename:
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], secure_filename(filename))
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"File {filepath} deleted.")
                except Exception as e:
                    print(f"Error deleting file {filepath}: {e}")

        socketio.emit('delete_facture', {'id': id})
        return jsonify({"message": "Facture supprimée"}), 200
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error deleting facture: {e}")
        return jsonify({"error": "Erreur de base de données lors de la suppression."}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred deleting facture: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la suppression."}), 500
    finally:
        cursor.close()
        if conn:
            conn.close()

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    data = request.get_json() or {}
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cursor.execute("SELECT * FROM factures WHERE id = %s", (id,))
        facture = cursor.fetchone()
        if not facture:
            return jsonify({"error": "Facture non trouvée"}), 404

        update_fields = []
        update_values = []

        allowed = ["type", "ubr", "fournisseur", "description", "montant", "statut"]
        for key in allowed:
            if key in data:
                update_fields.append(f"{key} = %s")
                if key == 'montant':
                    try:
                        update_values.append(float(data[key]))
                    except ValueError:
                        return jsonify({"error": "Montant invalide pour le champ montant."}), 400
                else:
                    update_values.append(data[key])

        if not update_fields:
            return jsonify({"error": "Aucun champ à mettre à jour"}), 400

        sql = f"UPDATE factures SET {', '.join(update_fields)} WHERE id = %s RETURNING *;"
        update_values.append(id)

        cursor.execute(sql, update_values)
        updated_facture = cursor.fetchone()
        conn.commit()

        if not updated_facture:
            return jsonify({"error": "Erreur lors de la récupération de l'entrée mise à jour après update."}), 500

        facture = dict(updated_facture)

        socketio.emit('update_facture', facture)
        return jsonify(facture), 200
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error updating facture: {e}")
        return jsonify({"error": f"Erreur de base de données lors de la mise à jour : {e}"}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred updating facture: {e}")
        return jsonify({"error": f"Une erreur est survenue lors de la mise à jour : {e}"}), 500
    finally:
        cursor.close()
        if conn:
            conn.close()

# Route for CSV export
@app.route("/api/factures/export-csv", methods=["GET"])
def export_factures_csv():
    annee = request.args.get("annee", str(get_financial_year()))
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))

        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        header = [description[0] for description in cursor.description]
        csv_writer.writerow(header)

        for row in cursor.fetchall():
            csv_writer.writerow(row)

        csv_content = csv_buffer.getvalue()

        response = Response(csv_content, mimetype='text/csv')
        response.headers.set("Content-Disposition", "attachment", filename=f"factures_{annee}.csv")

        return response
    except psycopg2.Error as e:
        print(f"Database error during CSV export: {e}")
        return jsonify({"error": "Erreur lors de l'accès à la base de données pour l'exportation."}), 500
    except Exception as e:
        print(f"An unexpected error occurred during CSV export: {e}")
        return jsonify({"error": "Une erreur est survenue lors de l'exportation CSV."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- Budget Management Endpoints ---

REVENUE_TYPES = {
    'Fond 1': [
        'Subvention Services à la vie étudiante',
        'Travail étudiant au compte de club',
        'Subvention club participation portes ouvertes',
        'Toute réquisition interne dont l\'UBR de provenance est un fonds 1'
    ],
    'Fond 3': [
        'Dons',
        'Levée de fonds',
        'Bourses d\'entreprises ou d\'organismes',
        'LOJIQ - FORCE AVENIR - J. ARMAND BOMBARDIER'
    ]
}

@app.route("/api/budget/revenue-types", methods=["GET"])
def get_revenue_types():
    return jsonify(REVENUE_TYPES)

@app.route("/api/budget", methods=["GET"])
def get_budget_entries():
    financial_year = request.args.get("annee", str(get_financial_year()))
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute("SELECT * FROM budgets WHERE financial_year = %s ORDER BY date_added DESC", (financial_year,))
        rows = cursor.fetchall()
        result = [dict(row) for row in rows]
        return jsonify(result)
    except psycopg2.OperationalError as e:
        if "relation \"budgets\" does not exist" in str(e):
            return jsonify([]), 200
        else:
            print(f"Database operational error fetching budget: {e}")
            return jsonify({"error": "Erreur de base de données lors de la récupération du budget."}), 500
    except psycopg2.Error as e:
        print(f"Database error fetching budget: {e}")
        return jsonify({"error": "Erreur lors de l'accès à la base de données pour le budget."}), 500
    except Exception as e:
        print(f"An unexpected error occurred fetching budget: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la récupération du budget."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/api/budget", methods=["POST"])
def add_budget_entry():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie."}), 400

    financial_year = data.get("financial_year")
    fund_type = data.get("fund_type")
    revenue_type = data.get("revenue_type")
    amount = data.get("amount")

    if not all([financial_year, fund_type, revenue_type, amount is not None]):
        return jsonify({"error": "Données budgétaires manquantes (financial_year, fund_type, revenue_type, amount)."}), 400

    conn = None
    cursor = None
    try:
        amount = float(amount)

        if fund_type not in REVENUE_TYPES:
            return jsonify({"error": "Type de fond invalide."}), 400
        if revenue_type not in REVENUE_TYPES[fund_type]:
            return jsonify({"error": "Type de revenu invalide pour le fond sélectionné."}), 400

        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        sql = """
        INSERT INTO budgets (financial_year, fund_type, revenue_type, amount, date_added)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
        """
        params = (financial_year, fund_type, revenue_type, amount, datetime.now())
        cursor.execute(sql, params)
        new_entry_id = cursor.fetchone()[0]
        conn.commit()

        cursor.execute("SELECT * FROM budgets WHERE id = %s", (new_entry_id,))
        new_entry = cursor.fetchone()

        return jsonify(dict(new_entry)), 201
    except ValueError:
        return jsonify({"error": "Montant invalide."}), 400
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error adding budget entry: {e}")
        return jsonify({"error": "Erreur de base de données lors de l'ajout de l'entrée budgétaire."}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred adding budget entry: {e}")
        return jsonify({"error": "Une erreur est survenue lors de l'ajout de l'entrée budgétaire."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/api/budget/<int:entry_id>", methods=["PUT"])
def update_budget_entry(entry_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour."}), 400

    financial_year = data.get("financial_year")
    if not financial_year:
        return jsonify({"error": "Année financière manquante dans les données de mise à jour."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute("SELECT * FROM budgets WHERE id = %s", (entry_id,))
        existing_entry = cursor.fetchone()
        if not existing_entry:
            return jsonify({"error": "Entrée budgétaire non trouvée."}), 404

        update_fields = []
        update_values = []

        allowed_fields = ['fund_type', 'revenue_type', 'amount']
        for field in allowed_fields:
            if field in data:
                if field == 'amount':
                    try:
                        update_values.append(float(data[field]))
                    except ValueError:
                        return jsonify({"error": "Montant invalide pour le champ montant."}), 400
                elif field == 'fund_type':
                    if data[field] not in REVENUE_TYPES:
                        return jsonify({"error": "Type de fond invalide."}), 400
                    update_values.append(data[field])
                elif field == 'revenue_type':
                    current_fund_type = data.get('fund_type', existing_entry['fund_type'])
                    if current_fund_type not in REVENUE_TYPES or data[field] not in REVENUE_TYPES[current_fund_type]:
                        return jsonify({"error": "Type de revenu invalide pour le type de fond."}), 400
                    update_values.append(data[field])
                else:
                    update_values.append(data[field])
                update_fields.append(f"{field} = %s")

        if not update_fields:
            return jsonify({"error": "Aucun champ valide à mettre à jour."}), 400

        sql = f"UPDATE budgets SET {', '.join(update_fields)} WHERE id = %s RETURNING *;"
        update_values.append(entry_id)

        cursor.execute(sql, update_values)
        updated_entry = cursor.fetchone()
        conn.commit()

        if not updated_entry:
            return jsonify({"error": "Erreur lors de la récupération de l'entrée mise à jour après update."}), 500

        return jsonify(dict(updated_entry)), 200
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error updating budget entry: {e}")
        return jsonify({"error": "Erreur de base de données lors de la mise à jour de l'entrée budgétaire."}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred updating budget entry: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la mise à jour de l'entrée budgétaire."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route("/api/budget/<int:entry_id>", methods=["DELETE"])
def delete_budget_entry(entry_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor()

        cursor.execute("DELETE FROM budgets WHERE id = %s RETURNING id;", (entry_id,))
        deleted_id = cursor.fetchone()
        conn.commit()

        if deleted_id is None:
            return jsonify({"error": "Entrée budgétaire non trouvée."}), 404

        return jsonify({"message": "Entrée budgétaire supprimée avec succès."}), 200
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error deleting budget entry: {e}")
        return jsonify({"error": "Erreur de base de données lors de la suppression de l'entrée budgétaire."}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred deleting budget entry: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la suppression de l'entrée budgétaire."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

PIN = "1234"

@app.route("/api/budget/verify-pin", methods=["POST"])
def verify_pin():
    data = request.get_json()
    provided_pin = data.get("pin")

    if provided_pin == PIN:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"success": False, "message": "PIN incorrect."}), 401

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True, debug=True)