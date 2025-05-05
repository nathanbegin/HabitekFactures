import eventlet
# Must monkey-patch before any other imports for eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import os
import sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Initialisation de SocketIO en mode eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@socketio.on('connect')
def on_connect():
    print(f"🔌 Client connecté : {request.sid}")


UPLOAD_FOLDER = "backend/uploads"
DB_FOLDER = "backend/databases"
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "schema.sql")

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)

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
    return "Flask fonctionne sur Render ✅"

@app.route("/api/factures", methods=["GET"])
def get_factures():
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    rows = conn.execute("SELECT * FROM factures").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    file = request.files.get("fichier")
    if file is None:
        return jsonify({"error": "Aucun fichier envoyé"}), 400
    data = request.form
    annee = data.get("annee")
    if not annee:
        return jsonify({"error": "Champ 'annee' manquant"}), 400
    conn = get_connection(annee)

    count = conn.execute(
        "SELECT COUNT(*) FROM factures WHERE type = ?", (data.get("type"),)
    ).fetchone()[0]
    numero = count + 1

    filename = secure_filename(
        f"{annee}-{data.get('type')}-{numero}-UBR-{data.get('ubr')}-{file.filename}"
    )
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    sql = """
    INSERT INTO factures (
        annee,
        type,
        ubr,
        fournisseur,
        description,
        montant,
        statut,
        fichier_nom,
        numero,
        date_ajout
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        annee,
        data.get("type"),
        data.get("ubr"),
        data.get("fournisseur"),
        data.get("description"),
        float(data.get("montant", 0)),
        data.get("statut"),
        filename,
        numero,
        datetime.now().isoformat()
    )
    conn.execute(sql, params)
    conn.commit()

    # Émettre un événement WebSocket pour notifier tous les clients
    new_facture = conn.execute(
        "SELECT * FROM factures WHERE id = last_insert_rowid()"
    ).fetchone()
    socketio.emit('new_facture', dict(new_facture))
    conn.close()
    return jsonify(dict(new_facture)), 201

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    row = conn.execute(
        "SELECT fichier_nom FROM factures WHERE id = ?", (id,)
    ).fetchone()
    conn.close()
    if row and row["fichier_nom"]:
        return send_from_directory(
            app.config["UPLOAD_FOLDER"], row["fichier_nom"], as_attachment=True
        )
    return jsonify({"error": "Fichier non trouvé"}), 404

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    facture = conn.execute(
        "SELECT * FROM factures WHERE id = ?", (id,)
    ).fetchone()
    if not facture:
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    filepath = os.path.join(app.config["UPLOAD_FOLDER"], facture["fichier_nom"])
    if os.path.exists(filepath):
        os.remove(filepath)

    conn.execute("DELETE FROM factures WHERE id = ?", (id,))
    conn.commit()
    socketio.emit('delete_facture', {'id': id})
    conn.close()
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    data = request.get_json() or {}
    annee = data.get("annee") or datetime.now().year
    conn = get_connection(annee)

    allowed = ["type", "ubr", "fournisseur", "description", "montant", "statut"]
    fields, values = [], []
    for key in allowed:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        conn.close()
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    values.append(id)
    sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = ?"
    conn.execute(sql, values)
    conn.commit()

    facture = conn.execute(
        "SELECT * FROM factures WHERE id = ?", (id,)
    ).fetchone()
    socketio.emit('update_facture', dict(facture))
    conn.close()
    return jsonify(dict(facture)), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
