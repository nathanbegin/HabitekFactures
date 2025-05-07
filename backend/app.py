import eventlet
# Monkey-patch pour eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import sqlite3
from datetime import datetime
import csv  # Import the csv module
import io   # Import the io module for in-memory text handling

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

# Dossiers
UPLOAD_FOLDER = "backend/uploads"
DB_FOLDER     = "backend/databases"
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "schema.sql")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

def get_db_path(annee):
    return os.path.join(DB_FOLDER, f"{annee}.db")

def init_db_if_needed(annee):
    db_path = get_db_path(annee)
    if not os.path.exists(db_path):
        with open(TEMPLATE_PATH, "r") as f:
            schema = f.read()
        conn = sqlite3.connect(db_path)
        conn.executescript(schema)
        conn.commit()
        conn.close()
    return db_path

def get_connection(annee):
    init_db_if_needed(annee)
    conn = sqlite3.connect(get_db_path(annee))
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/")
def home():
    return "Flask fonctionne ✅"

@app.route("/api/factures", methods=["GET"])
def get_factures():
    annee = request.args.get("annee", str(datetime.now().year)) # Ensure annee is string
    conn = get_connection(annee)
    rows = conn.execute("SELECT * FROM factures ORDER BY id DESC").fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return jsonify(result)

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    file = request.files.get("fichier")
    data = request.form
    annee = data.get("annee")
    if not file or not annee:
        return jsonify({"error": "Fichier ou année manquant(e)"}), 400

    conn = get_connection(annee)
    # Get count for the specific type within the year's database
    count  = conn.execute(
        "SELECT COUNT(*) FROM factures WHERE type = ?", (data.get("type"),)
    ).fetchone()[0]
    numero = count + 1

    # Create a more robust filename to avoid conflicts and include relevant info
    original_filename, file_extension = os.path.splitext(secure_filename(file.filename))
    filename = secure_filename(
        f"{annee}_{data.get('type')}_{numero}_UBR_{data.get('ubr')}_{original_filename}{file_extension}"
    )
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    try:
        file.save(filepath)
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Erreur lors de l'enregistrement du fichier : {e}"}), 500


    sql = """
    INSERT INTO factures (
      annee, type, ubr, fournisseur, description,
      montant, statut, fichier_nom, numero, date_ajout
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        annee,
        data.get("type"),
        data.get("ubr"),
        data.get("fournisseur"),
        data.get("description"),
        float(data.get("montant", 0)), # Ensure montant is float
        data.get("statut"),
        filename,
        numero,
        datetime.now().isoformat()
    )
    try:
        conn.execute(sql, params)
        conn.commit()
        new_f = conn.execute("SELECT * FROM factures WHERE id = last_insert_rowid()").fetchone()
        facture = dict(new_f)
        conn.close()
        socketio.emit('new_facture', facture)
        return jsonify(facture), 201
    except Exception as e:
        conn.rollback() # Rollback changes if insertion fails
        conn.close()
        # Clean up the saved file if DB insertion failed
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Erreur lors de l'enregistrement en base de données : {e}"}), 500


@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    annee = request.args.get("annee", str(datetime.now().year)) # Ensure annee is string
    conn = get_connection(annee)
    row  = conn.execute("SELECT fichier_nom FROM factures WHERE id = ?", (id,)).fetchone()
    conn.close()
    if not row or not row["fichier_nom"]:
        return jsonify({"error": "Fichier non trouvé"}), 404
    # Ensure the filename is secure even for sending
    safe_filename = secure_filename(row["fichier_nom"])
    return send_from_directory(app.config["UPLOAD_FOLDER"], safe_filename, as_attachment=True)


@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    annee = request.args.get("annee", str(datetime.now().year)) # Ensure annee is string
    conn  = get_connection(annee)
    row   = conn.execute("SELECT * FROM factures WHERE id = ?", (id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Supprime le fichier
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], secure_filename(row["fichier_nom"])) # Use secure_filename here too
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"Error deleting file {filepath}: {e}") # Log error but don't stop deletion


    conn.execute("DELETE FROM factures WHERE id = ?", (id,))
    conn.commit()
    conn.close()

    socketio.emit('delete_facture', {'id': id})
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    data  = request.get_json() or {}
    annee = data.get("annee", str(datetime.now().year)) # Ensure annee is string
    conn  = get_connection(annee)

    allowed = ["type","ubr","fournisseur","description","montant","statut"]
    fields, vals = [], []
    for key in allowed:
        if key in data:
            fields.append(f"{key} = ?")
            vals.append(data[key])

    # Convert montant to float if it's being updated
    if 'montant' in data:
        try:
            vals[fields.index('montant = ?')] = float(data['montant'])
        except (ValueError, IndexError):
             conn.close()
             return jsonify({"error": "Montant invalide"}), 400


    if not fields:
        conn.close()
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    vals.append(id)
    sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = ?"
    try:
        conn.execute(sql, vals)
        conn.commit()
        updated = conn.execute("SELECT * FROM factures WHERE id = ?", (id,)).fetchone()
        facture = dict(updated)
        conn.close()
        socketio.emit('update_facture', facture)
        return jsonify(facture), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Erreur lors de la mise à jour : {e}"}), 500


# New route for CSV export
@app.route("/api/factures/export-csv", methods=["GET"])
def export_factures_csv():
    annee = request.args.get("annee", str(datetime.now().year)) # Get year from query params
    conn = None # Initialize conn to None
    try:
        conn = get_connection(annee)
        cursor = conn.execute("SELECT * FROM factures ORDER BY id DESC")

        # Use io.StringIO to write CSV to memory
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)

        # Write header row (column names)
        # Get column names from cursor description
        header = [description[0] for description in cursor.description]
        csv_writer.writerow(header)

        # Write data rows
        for row in cursor.fetchall():
            # Convert row (sqlite3.Row) to a list of values
            csv_writer.writerow(list(row))

        # Get the CSV content from the buffer
        csv_content = csv_buffer.getvalue()

        # Create a Flask Response
        response = Response(csv_content, mimetype='text/csv')
        # Set the Content-Disposition header to trigger download
        response.headers.set("Content-Disposition", "attachment", filename=f"factures_{annee}.csv")

        return response

    except sqlite3.Error as e:
        print(f"Database error during CSV export: {e}")
        return jsonify({"error": "Erreur lors de l'accès à la base de données pour l'exportation."}), 500
    except Exception as e:
        print(f"An error occurred during CSV export: {e}")
        return jsonify({"error": "Une erreur est survenue lors de l'exportation CSV."}), 500
    finally:
        # Ensure the connection is closed even if an error occurs
        if conn:
            conn.close()


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    # Use socketio.run for the app to handle WebSocket connections
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)