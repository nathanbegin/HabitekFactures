import eventlet
# Applique le monkey-patch d’Eventlet AVANT tout autre import
# pour que les modules standard (socket, threading, etc.) soient compatibles
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import sqlite3
from datetime import datetime

# Création de l’application Flask
app = Flask(__name__)

# Configuration de CORS pour exposer l’en-tête Content-Disposition sur les routes /api/factures/*
CORS(
    app,
    resources={
        r"/api/factures/*": {
            "origins": "*",
            "expose_headers": ["Content-Disposition"]
        }
    }
)

# Initialisation de Flask-SocketIO en mode eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Compteur global du nombre de clients WebSocket connectés
client_count = 0

# Premier handler sur l’événement de connexion (affiche le SID)
@socketio.on('connect')
def on_connect():
    print(f"🔌 Client connecté : {request.sid}")

# Deuxième handler sur l’événement de connexion (gère le compteur)
@socketio.on('connect')
def handle_connect():
    global client_count
    client_count += 1
    print(f"🔌 Client connecté: {request.sid} — total = {client_count}")
    # Envoie à tous les clients la nouvelle valeur du compteur
    socketio.emit('client_count', client_count)

# Définition accidentelle d’une fonction handle_connect() non liée à un événement
# (cette définition n’est pas décorée par @socketio.on et sera ignorée)
def handle_connect():
    global client_count
    client_count += 1
    print(f"🔌 Client connecté: {request.sid} — total = {client_count}")
    socketio.emit('client_count', client_count)

# Handler sur l’événement de déconnexion
@socketio.on('disconnect')
def handle_disconnect():
    global client_count
    client_count -= 1
    print(f"❌ Client déconnecté: {request.sid} — total = {client_count}")
    socketio.emit('client_count', client_count)

# Chemins des dossiers de stockage
UPLOAD_FOLDER = "backend/uploads"
DB_FOLDER     = "backend/databases"
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "schema.sql")

# Création des dossiers si ils n'existent pas
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)

def get_db_path(annee):
    """
    Retourne le chemin du fichier SQLite pour l'année donnée.
    ex: backend/databases/2025.db
    """
    return os.path.join(DB_FOLDER, f"{annee}.db")

def init_db_if_needed(annee):
    """
    Initialise la base de données pour l'année si elle n'existe pas :
    - lit le fichier schema.sql
    - exécute le script de création
    """
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
    """
    Ouvre une connexion SQLite sur la DB de l'année,
    en initialisant la base si nécessaire, et configure row_factory.
    """
    init_db_if_needed(annee)
    conn = sqlite3.connect(get_db_path(annee))
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/")
def home():
    # Route racine pour vérifier que l’app tourne
    return "Flask fonctionne sur Render ✅"

@app.route("/api/factures", methods=["GET"])
def get_factures():
    """
    Récupère toutes les factures pour l'année passée en query param.
    Retourne un JSON listant chaque ligne de la table factures.
    """
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    rows = conn.execute("SELECT * FROM factures").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    """
    Upload d’une nouvelle facture :
    1. Vérifie la présence du fichier dans request.files
    2. Récupère les données du formulaire (annee, type, ubr, etc.)
    3. Calcule le numéro séquentiel (count + 1)
    4. Génère un nom de fichier sécurisé
    5. Sauvegarde le fichier sur disque
    6. Insère la ligne dans la DB
    7. Émet un événement WebSocket 'new_facture' à tous les clients
    """
    file = request.files.get("fichier")
    if not file:
        return jsonify({"error": "Aucun fichier envoyé"}), 400

    data = request.form
    annee = data.get("annee")
    if not annee:
        return jsonify({"error": "Champ 'annee' manquant"}), 400

    conn = get_connection(annee)
    # Calcul du numéro de facture
    count  = conn.execute(
        "SELECT COUNT(*) FROM factures WHERE type = ?",
        (data.get("type"),)
    ).fetchone()[0]
    numero = count + 1

    # Construction du nom de fichier final
    filename = secure_filename(
        f"{annee}-{data['type']}-{numero}-UBR-{data['ubr']}-{file.filename}"
    )
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    # Préparation et exécution de la requête INSERT
    sql = """
    INSERT INTO factures (
        annee, type, ubr, fournisseur,
        description, montant, statut,
        fichier_nom, numero, date_ajout
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

    # Récupération de la nouvelle ligne et émission WebSocket
    new_facture = conn.execute(
        "SELECT * FROM factures WHERE id = last_insert_rowid()"
    ).fetchone()
    socketio.emit('new_facture', dict(new_facture))

    conn.close()
    return jsonify(dict(new_facture)), 201

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    """
    Téléchargement d’un fichier de facture :
    - Recherche du nom de fichier en DB
    - Renvoi du fichier en tant qu’attachement
    """
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    row = conn.execute(
        "SELECT fichier_nom FROM factures WHERE id = ?", (id,)
    ).fetchone()
    conn.close()
    if row and row["fichier_nom"]:
        return send_from_directory(
            app.config["UPLOAD_FOLDER"],
            row["fichier_nom"],
            as_attachment=True
        )
    return jsonify({"error": "Fichier non trouvé"}), 404

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    """
    Suppression d’une facture :
    - Vérifie l’existence en DB
    - Supprime le fichier du disque
    - Supprime la ligne en DB
    - Émet l’événement WebSocket 'delete_facture'
    """
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    facture = conn.execute(
        "SELECT * FROM factures WHERE id = ?", (id,)
    ).fetchone()
    if not facture:
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Suppression du fichier physique
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], facture["fichier_nom"])
    if os.path.exists(filepath):
        os.remove(filepath)

    # Suppression de la ligne DB
    conn.execute("DELETE FROM factures WHERE id = ?", (id,))
    conn.commit()
    socketio.emit('delete_facture', {'id': id})
    conn.close()
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    """
    Mise à jour d’une facture :
    - Récupère les champs autorisés dans le JSON
    - Construit dynamiquement la requête UPDATE
    - Exécute et commit
    - Émet l’événement WebSocket 'update_facture'
    """
    data = request.get_json() or {}
    annee = data.get("annee") or datetime.now().year
    conn = get_connection(annee)

    # Construction des listes de champs et valeurs
    allowed = ["type", "ubr", "fournisseur", "description", "montant", "statut"]
    fields, values = [], []
    for key in allowed:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if not fields:
        conn.close()
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    # Ajout de l’ID en paramètre final pour le WHERE
    values.append(id)
    sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = ?"
    conn.execute(sql, values)
    conn.commit()

    # Lecture de la facture mise à jour et émission WebSocket
    facture = conn.execute(
        "SELECT * FROM factures WHERE id = ?", (id,)
    ).fetchone()
    socketio.emit('update_facture', dict(facture))
    conn.close()
    return jsonify(dict(facture)), 200

if __name__ == '__main__':
    # Point d’entrée : démarre le serveur SocketIO/Werkzeug
    port = int(os.environ.get("PORT", 5000))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        allow_unsafe_werkzeug=True  # Permet d’ignorer l’avertissement de prod
    )
