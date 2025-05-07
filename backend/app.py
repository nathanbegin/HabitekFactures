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
# DB_FOLDER et TEMPLATE_PATH ne sont plus nécessaires pour PostgreSQL

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Get Database URL from environment variable or use default
# THIS IS WHERE THE DATABASE CONNECTION STRING IS DEFINED
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://minio:Habitek2025@localhost:5432/factures_db")


def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    conn = None
    try:
        # Parse the DATABASE_URL
        url = urlparse(DATABASE_URL)
        conn = psycopg2.connect(
            database=url.path[1:], # Remove the leading slash
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        # Return connection with DictCursor to fetch rows as dictionaries by default
        # Use cursor_factory=psycopg2.extras.RealDictCursor for case-sensitive keys
        return conn
    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
        # In a real app, you might want to log this and/or return an error response
        # Raising the exception might be better to be caught in route handlers
        # raise e
        return None # Return None if connection fails

# --- Database Initialization (Basic) ---
# In a real application, use proper schema migration tools (Alembic, Flask-Migrate)
# This function is called once on app startup
def init_db():
    conn = get_db_connection()
    if conn is None:
        print("Failed to connect to database, cannot initialize tables.")
        return

    cursor = conn.cursor()
    try:
        # Create factures table if it doesn't exist
        # Using VARCHAR for annee, DECIMAL for montant, TIMESTAMP for date_ajout
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS factures (
                id SERIAL PRIMARY KEY,
                annee VARCHAR(4) NOT NULL, -- Calendar/Financial year identifier
                type VARCHAR(50) NOT NULL,
                ubr VARCHAR(50),
                fournisseur VARCHAR(255),
                description TEXT,
                montant DECIMAL(10, 2) NOT NULL,
                statut VARCHAR(50) NOT NULL,
                fichier_nom VARCHAR(255),
                numero INTEGER, -- Consider if 'numero' is still needed or derived
                date_ajout TIMESTAMP NOT NULL
            );
        """)

        # Create budgets table if it doesn't exist (renamed from budget_entries)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS budgets ( -- Renamed table to 'budgets'
                id SERIAL PRIMARY KEY,
                financial_year VARCHAR(4) NOT NULL, -- Store as 'YYYY'
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
# This is the starting year of the financial exercise
def get_financial_year(date=None):
    if date is None:
        date = datetime.now()
    # Financial year starts May 1st (month 5)
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
    # Get the year (acting as financial year identifier) from query params
    annee = request.args.get("annee", str(get_financial_year()))
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    # Use DictCursor for fetching rows as dictionaries
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # Filter factures by 'annee' column (assuming 'annee' in factures table is the financial year start)
        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))
        rows = cursor.fetchall()
        # Convert DictRow objects to standard dictionaries for jsonify
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
    # Get annee from form data (frontend should send the selected financial year)
    annee = data.get("annee")

    # Basic validation
    if not annee or not data.get("type") or data.get("montant") is None:
         return jsonify({"error": "Données de facture manquantes (année, type, montant)."}), 400

    try:
        montant = float(data.get("montant"))
    except ValueError:
         return jsonify({"error": "Montant invalide."}), 400


    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor() # Use regular cursor for non-select that need RETURNING

    filepath = None # Initialize filepath
    try:
        # Get count for the specific type within the year
        cursor.execute(
            "SELECT COUNT(*) FROM factures WHERE annee = %s AND type = %s", (annee, data.get("type"),)
        )
        count = cursor.fetchone()[0]
        numero = count + 1

        filename = None
        if file:
            original_filename, file_extension = os.path.splitext(secure_filename(file.filename))
            filename = secure_filename(
                f"{annee}_{data.get('type')}_{numero}_UBR_{data.get('ubr', 'N-A')}_{original_filename}{file_extension}"
            )
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            try:
                file.save(filepath)
            except Exception as e:
                print(f"Error saving file: {e}")
                return jsonify({"error": f"Erreur lors de l'enregistrement du fichier : {e}"}), 500


        sql = """
        INSERT INTO factures (
          annee, type, ubr, fournisseur, description,
          montant, statut, fichier_nom, numero, date_ajout
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id; -- Get the inserted ID
        """
        params = (
            annee,
            data.get("type"),
            data.get("ubr"),
            data.get("fournisseur"),
            data.get("description"),
            montant, # Use the validated float amount
            data.get("statut"),
            filename, # Will be None if no file uploaded
            numero,
            datetime.now() # Use datetime object for TIMESTAMP
        )
        cursor.execute(sql, params)
        new_id = cursor.fetchone()[0] # Get the returned id
        conn.commit()

        # Fetch the newly inserted row using DictCursor for easier JSON conversion
        dict_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        dict_cursor.execute("SELECT * FROM factures WHERE id = %s", (new_id,))
        new_f = dict_cursor.fetchone()
        facture = dict(new_f) # Convert DictRow to dict
        dict_cursor.close()


        socketio.emit('new_facture', facture)
        return jsonify(facture), 201
    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"Database error uploading facture: {e}")
        # Clean up the saved file if DB insertion failed
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Erreur lors de l'enregistrement en base de données : {e}"}), 500
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"An unexpected error occurred uploading facture: {e}")
        # Clean up the saved file if DB insertion failed
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Une erreur est survenue lors de l'ajout de la facture : {e}"}), 500
    finally:
        cursor.close()
        if conn:
            conn.close()


@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    # annee = request.args.get("annee", str(get_financial_year())) # Year might be needed if IDs are not unique across years
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        # Fetch filename by id (assuming id is unique across all factures)
        cursor.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
        row = cursor.fetchone()
        if not row or not row[0]:
            return jsonify({"error": "Fichier non trouvé en base de données"}), 404
        filename = row[0]
        safe_filename = secure_filename(filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

        # Check if the file exists physically
        if not os.path.exists(filepath):
             # You might want to clear the fichier_nom in the DB if the file is missing
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
    # annee = request.args.get("annee", str(get_financial_year())) # Year might be needed if IDs are not unique across years
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    filename = None # Initialize filename

    try:
        # Fetch the filename before deleting the DB row
        cursor.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Facture non trouvée en base de données"}), 404
        filename = row[0]

        # Delete the database row
        cursor.execute("DELETE FROM factures WHERE id = %s RETURNING id;", (id,)) # Use RETURNING to check if deleted
        deleted_id = cursor.fetchone()
        conn.commit()

        if deleted_id is None: # Should not happen if row was found, but good practice
             return jsonify({"error": "Facture non trouvée après tentative de suppression."}), 404


        # Supprime le fichier physique après la suppression en base de données
        if filename:
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], secure_filename(filename))
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"File {filepath} deleted.")
                except Exception as e:
                    print(f"Error deleting file {filepath}: {e}") # Log error but don't stop deletion


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
    data  = request.get_json() or {}
    # annee = data.get("annee", str(get_financial_year())) # Year might be needed if IDs are not globally unique
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        # Check if the facture exists
        cursor.execute("SELECT * FROM factures WHERE id = %s", (id,))
        facture = cursor.fetchone()
        if not facture:
            return jsonify({"error": "Facture non trouvée"}), 404

        update_fields = []
        update_values = []

        allowed = ["type","ubr","fournisseur","description","montant","statut"]
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
             # This case should ideally not happen if the initial SELECT found the facture
             return jsonify({"error": "Erreur lors de la r\u00e9cup\u00e9ration de l'entr\u00e9e mise \u00e0 jour apr\u00e8s update."}), 500

        # Convert DictRow to dict
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
    # Get the year (acting as financial year identifier) from query params
    annee = request.args.get("annee", str(get_financial_year()))
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
            return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        # Use regular cursor for csv writer
        cursor = conn.cursor()

        # Fetch data for the specified year
        cursor.execute("SELECT * FROM factures WHERE annee = %s ORDER BY id DESC", (annee,))

        # Use io.StringIO to write CSV to memory
        csv_buffer = io.StringIO()
        # Use the database connection's encoding for the buffer if possible,
        # or a standard like utf-8. Assuming default UTF-8 for now.
        csv_writer = csv.writer(csv_buffer)

        # Write header row (column names)
        # Get column names from cursor description
        header = [description[0] for description in cursor.description]
        csv_writer.writerow(header)

        # Write data rows
        for row in cursor.fetchall():
            # Psycopg2 rows are tuples by default, which is fine for csv.writer.
            csv_writer.writerow(row)

        # Get the CSV content from the buffer
        csv_content = csv_buffer.getvalue()

        # Create a Flask Response
        response = Response(csv_content, mimetype='text/csv')
        # Set the Content-Disposition header to trigger download
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

# Define revenue types based on your description
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
    """Returns the predefined list of revenue types."""
    return jsonify(REVENUE_TYPES)

@app.route("/api/budget", methods=["GET"])
def get_budget_entries():
    """Fetches budget entries for a given financial year."""
    # Use the provided 'annee' from the frontend as the financial year identifier
    financial_year = request.args.get("annee", str(get_financial_year()))

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
             return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Select entries for the specified financial year from the 'budgets' table
        cursor.execute("SELECT * FROM budgets WHERE financial_year = %s ORDER BY date_added DESC", (financial_year,)) # Renamed table to 'budgets'
        rows = cursor.fetchall()
        result = [dict(row) for row in rows] # Convert DictRow to dict
        return jsonify(result)
    except psycopg2.OperationalError as e:
         # Handle case where budgets table might not exist yet
         if "relation \"budgets\" does not exist" in str(e): # Updated table name in error check
             return jsonify([]), 200 # Return empty list if table doesn't exist
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
    """Adds a new budget entry."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie."}), 400

    # Validate input data
    financial_year = data.get("financial_year")
    fund_type = data.get("fund_type")
    revenue_type = data.get("revenue_type")
    amount = data.get("amount")

    # Ensure required fields are present
    if not all([financial_year, fund_type, revenue_type, amount is not None]):
         return jsonify({"error": "Données budgétaires manquantes (financial_year, fund_type, revenue_type, amount)."}), 400

    conn = None
    cursor = None
    try:
        # Validate and convert amount
        amount = float(amount)

        # Validate fund type and revenue type
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
        RETURNING id; -- Get the inserted ID
        """
        params = (financial_year, fund_type, revenue_type, amount, datetime.now())
        cursor.execute(sql, params)
        new_entry_id = cursor.fetchone()[0] # Get the returned id
        conn.commit()

        # Fetch the newly inserted row
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
        print(f"An unexpected error occurred adding budget entry: {e}")
        return jsonify({"error": "Une erreur est survenue lors de l'ajout de l'entrée budgétaire."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.route("/api/budget/<int:entry_id>", methods=["PUT"])
def update_budget_entry(entry_id):
    """Updates an existing budget entry."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour."}), 400

    # PIN check logic would be implemented here or preferably on critical actions
    # For now, based on user request, the primary check is frontend.
    # A backend check would involve hashing and comparing, not plain text.
    # Assuming frontend sends all necessary data, including financial_year

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

        # Fetch the existing entry to validate fund_type/revenue_type if they are updated
        cursor.execute("SELECT * FROM budgets WHERE id = %s", (entry_id,)) # Renamed table to 'budgets'
        existing_entry = cursor.fetchone()
        if not existing_entry:
             return jsonify({"error": "Entrée budgétaire non trouvée."}), 404

        update_fields = []
        update_values = []

        # Allowed fields to update
        allowed_fields = ['fund_type', 'revenue_type', 'amount']

        for field in allowed_fields:
            if field in data:
                if field == 'amount':
                    try:
                        update_values.append(float(data[field]))
                    except ValueError:
                         return jsonify({"error": "Montant invalide pour le champ montant."}), 400
                elif field == 'fund_type':
                     if data[field] not in REVENUE_TYPES: # Validate against main REVENUE_TYPES keys
                          return jsonify({"error": "Type de fond invalide."}), 400
                     update_values.append(data[field])
                elif field == 'revenue_type':
                     # Validate revenue type against the selected fund type (either original or updated)
                     current_fund_type = data.get('fund_type', existing_entry['fund_type'])
                     if current_fund_type not in REVENUE_TYPES or data[field] not in REVENUE_TYPES[current_fund_type]:
                          return jsonify({"error": "Type de revenu invalide pour le type de fond."}), 400
                     update_values.append(data[field])
                else:
                     update_values.append(data[field])
                update_fields.append(f"{field} = %s") # Use %s for psycopg2 placeholders

        if not update_fields:
            return jsonify({"error": "Aucun champ valide à mettre à jour."}), 400

        sql = f"UPDATE budgets SET {', '.join(update_fields)} WHERE id = %s RETURNING *;" # Renamed table to 'budgets'
        update_values.append(entry_id)

        cursor.execute(sql, update_values)
        updated_entry = cursor.fetchone()
        conn.commit()

        if not updated_entry:
             # This case should ideally not happen if the initial SELECT found the entry
             return jsonify({"error": "Erreur lors de la r\u00e9cup\u00e9ration de l'entr\u00e9e mise \u00e0 jour apr\u00e8s update."}), 500


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
    """Deletes a budget entry."""
    # PIN check logic here or preferably on critical actions
    # Assuming frontend sends the financial_year needed to locate the DB

    # While financial_year might be used in the frontend to select the view,
    # with a single PostgreSQL DB, the id is likely sufficient assuming global uniqueness for budget entries.
    # If not, you'd need to include financial_year in the WHERE clause.
    # financial_year = request.args.get("annee") # Keep if needed for uniqueness scope


    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if conn is None:
             return jsonify({"error": "Erreur de connexion à la base de données"}), 500
        cursor = conn.cursor()

        cursor.execute("DELETE FROM budgets WHERE id = %s RETURNING id;", (entry_id,)) # Renamed table to 'budgets', added RETURNING
        deleted_id = cursor.fetchone()
        conn.commit()

        if deleted_id is None: # Check if anything was actually deleted
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


# Example PIN (WARNING: Hardcoded PIN is insecure for production)
PIN = "1234"

@app.route("/api/budget/verify-pin", methods=["POST"])
def verify_pin():
    """Verifies the PIN for authorizing modifications."""
    data = request.get_json()
    provided_pin = data.get("pin")

    # In a real application, use hashed passwords and secure comparison
    # Do NOT use plain text PIN comparison in production
    if provided_pin == PIN:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"success": False, "message": "PIN incorrect."}), 401


if __name__ == '__main__':
    # Use a production-ready server like Gunicorn or uWSGI in production
    # eventlet is used here due to socketio async_mode="eventlet"
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on port {port}")
    # Debug mode should be False in production
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True, debug=True) # Set debug=False for production