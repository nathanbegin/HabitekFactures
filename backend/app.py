import eventlet
# Monkey-patch nécessaire pour eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import sqlite3
import json
from datetime import datetime

app = Flask(__name__)
# Limite de 100 Mo par requête
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

# CORS pour tout /api/*
CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Content-Disposition"])

# SocketIO en mode eventlet
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

# Dossiers de stockage
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
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    rows = conn.execute("SELECT * FROM factures ORDER BY id DESC").fetchall()
    factures = []
    for row in rows:
        d = dict(row)
        # Parse JSON stocké en base
        try:
            d["fichiers"] = json.loads(d.get("fichiers","[]"))
        except:
            d["fichiers"] = []
        factures.append(d)
    conn.close()
    return jsonify(factures)

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    data  = request.form
    annee = data.get("annee")
    files = request.files.getlist("fichiers")
    if not files or not annee:
        return jsonify({"error": "Champs manquants"}), 400

    conn = get_connection(annee)
    # Numérotation
    count  = conn.execute("SELECT COUNT(*) FROM factures WHERE type = ?", (data.get("type"),)).fetchone()[0]
    numero = count + 1

    saved = []
    for file in files:
        filename = secure_filename(
            f"{annee}-{data.get('type')}-{numero}-UBR-{data.get('ubr')}-{file.filename}"
        )
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)
        saved.append(filename)

    # On stocke la liste JSON des noms de fichiers
    sql = """
        INSERT INTO factures
          (annee, type, ubr, fournisseur, description, montant,
           statut, fichiers, numero, date_ajout)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (
        annee,
        data.get("type"),
        data.get("ubr"),
        data.get("fournisseur"),
        data.get("description"),
        float(data.get("montant", 0)),
        data.get("statut"),
        json.dumps(saved),
        numero,
        datetime.now().isoformat()
    )
    conn.execute(sql, params)
    conn.commit()

    new_f = conn.execute("SELECT * FROM factures WHERE id = last_insert_rowid()").fetchone()
    fact = dict(new_f)
    fact["fichiers"] = saved
    conn.close()

    # Émission via WebSocket
    socketio.emit('new_facture', fact)
    return jsonify(fact), 201

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    annee    = request.args.get("annee", datetime.now().year)
    filename = request.args.get("filename")
    if not filename:
        return jsonify({"error": "Param 'filename' manquant"}), 400

    conn = get_connection(annee)
    row  = conn.execute("SELECT fichiers FROM factures WHERE id = ?", (id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Facture non trouvée"}), 404

    try:
        files = json.loads(row["fichiers"])
    except:
        files = []

    if filename not in files:
        return jsonify({"error": "Fichier non enregistré"}), 404

    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    annee = request.args.get("annee", datetime.now().year)
    conn  = get_connection(annee)
    row   = conn.execute("SELECT * FROM factures WHERE id = ?", (id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Supprimer les fichiers physiquement
    try:
        files = json.loads(row["fichiers"])
    except:
        files = []
    for fname in files:
        p = os.path.join(app.config["UPLOAD_FOLDER"], fname)
        if os.path.exists(p):
            os.remove(p)

    conn.execute("DELETE FROM factures WHERE id = ?", (id,))
    conn.commit()
    conn.close()

    socketio.emit('delete_facture', {'id': id})
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    data = request.get_json() or {}
    annee = data.get("annee", datetime.now().year)
    conn  = get_connection(annee)

    allowed = ["type","ubr","fournisseur","description","montant","statut"]
    fields, vals = [], []
    for key in allowed:
        if key in data:
            fields.append(f"{key} = ?")
            vals.append(data[key])
    if not fields:
        conn.close()
        return jsonify({"error": "Rien à mettre à jour"}), 400

    vals.append(id)
    sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = ?"
    conn.execute(sql, vals)
    conn.commit()

    frow = conn.execute("SELECT * FROM factures WHERE id = ?", (id,)).fetchone()
    fact = dict(frow)
    try:
        fact["fichiers"] = json.loads(fact.get("fichiers","[]"))
    except:
        fact["fichiers"] = []
    conn.close()

    socketio.emit('update_facture', fact)
    return jsonify(fact), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
