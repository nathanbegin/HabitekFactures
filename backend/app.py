import eventlet
# Appliquer le monkey-patch d’Eventlet avant tout autre import
eventlet.monkey_patch()

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from decimal import Decimal
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from datetime import datetime

# Création de l’application Flask
app = Flask(__name__)

# Configuration CORS pour exposer Content-Disposition sur les endpoints de factures
CORS(
    app,
    resources={ r"/api/factures/*": {
        "origins": "*",
        "expose_headers": ["Content-Disposition"]
    }}
)

# Initialisation de Flask-SocketIO en mode eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Compteur global du nombre de clients WebSocket connectés
client_count = 0

@socketio.on('connect')
def handle_connect():
    global client_count
    client_count += 1
    print(f"🔌 Client connecté: {request.sid} — total = {client_count}")
    socketio.emit('client_count', client_count)

@socketio.on('disconnect')
def handle_disconnect():
    global client_count
    client_count -= 1
    print(f"❌ Client déconnecté: {request.sid} — total = {client_count}")
    socketio.emit('client_count', client_count)

# URL de connexion PostgreSQL fournie par Render
DATABASE_URL = os.environ['DATABASE_URL']

def get_connection():
    """
    Ouvre et retourne une connexion psycopg2 vers PostgreSQL,
    en forçant SSL et en utilisant RealDictCursor.
    """
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db_postgres():
    """
    Crée la table factures si elle n'existe pas déjà.
    """
    ddl = """
    CREATE TABLE IF NOT EXISTS factures (
      id          SERIAL      PRIMARY KEY,
      annee       INTEGER     NOT NULL,
      type        TEXT,
      ubr         TEXT,
      fournisseur TEXT,
      description TEXT,
      montant     NUMERIC,
      statut      TEXT,
      fichier_nom TEXT,
      numero      INTEGER,
      date_ajout  TIMESTAMP
    );
    """
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute(ddl)
    conn.commit()
    cur.close()
    conn.close()

# Initialisation de la table à chaque démarrage
init_db_postgres()

# Dossier de stockage des fichiers uploadés
UPLOAD_FOLDER = "backend/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return "Flask fonctionne sur Render ✅"

@app.route("/api/factures", methods=["GET"])
def get_factures():
    """
    Récupère toutes les factures pour l'année demandée.
    Convertit les Decimal en float pour JSON.
    """
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT * FROM factures WHERE annee = %s ORDER BY id DESC",
        (annee,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    # Conversion Decimal → float
    result = [
        {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}
        for row in rows
    ]
    return jsonify(result)

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    """
    Upload et insertion d'une nouvelle facture :
    - Vérifie la présence du fichier et des champs requis.
    - Génère un nom de fichier sécurisé.
    - Sauvegarde le fichier sur disque.
    - Insère la facture en DB avec RETURNING *.
    - Émet l’événement 'new_facture' à tous les clients.
    """
    file = request.files.get("fichier")
    if not file:
        return jsonify({"error": "Aucun fichier envoyé"}), 400

    data = request.form
    annee = data.get("annee")
    if not annee:
        return jsonify({"error": "Champ 'annee' manquant"}), 400

    # Préparation du nom de fichier
    ext = os.path.splitext(file.filename)[1] or ".pdf"
    filename = secure_filename(
        f"{annee}-{data.get('type')}-{data.get('ubr')}-"
        f"{data.get('fournisseur')}-{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
    )
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Calcul du numéro séquentiel
    cur.execute(
        "SELECT COUNT(*) FROM factures WHERE annee = %s AND type = %s",
        (annee, data.get("type"))
    )
    count = cur.fetchone()['count']
    numero = count + 1

    # Insertion en base et récupération de la nouvelle ligne
    sql = """
        INSERT INTO factures (
            annee, type, ubr, fournisseur,
            description, montant, statut,
            fichier_nom, numero, date_ajout
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s
        )
        RETURNING *;
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
        datetime.now()
    )
    cur.execute(sql, params)
    new_facture = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    # Conversion Decimal → float avant émission
    for k, v in new_facture.items():
        if isinstance(v, Decimal):
            new_facture[k] = float(v)

    socketio.emit('new_facture', new_facture)
    return jsonify(new_facture), 201

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    """
    Téléchargement du fichier d'une facture par ID.
    """
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row and row['fichier_nom']:
        return send_from_directory(
            app.config["UPLOAD_FOLDER"],
            row['fichier_nom'],
            as_attachment=True
        )
    return jsonify({"error": "Fichier non trouvé"}), 404

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    """
    Suppression d'une facture et de son fichier associé.
    """
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Suppression du fichier physique
    if row['fichier_nom']:
        path = os.path.join(app.config["UPLOAD_FOLDER"], row['fichier_nom'])
        if os.path.exists(path):
            os.remove(path)

    # Suppression en base
    cur.execute("DELETE FROM factures WHERE id = %s", (id,))
    conn.commit()
    cur.close()
    conn.close()

    socketio.emit('delete_facture', {'id': id})
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    """
    Mise à jour dynamique des champs autorisés d'une facture.
    """
    data = request.get_json() or {}
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    allowed = ["type", "ubr", "fournisseur", "description", "montant", "statut"]
    fields, values = [], []
    for key in allowed:
        if key in data:
            fields.append(f"{key} = %s")
            values.append(data[key])

    if not fields:
        cur.close()
        conn.close()
        return jsonify({"error": "Aucun champ à mettre à jour"}), 400

    values.append(id)
    sql = f"UPDATE factures SET {', '.join(fields)} WHERE id = %s RETURNING *;"
    cur.execute(sql, values)
    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    # Conversion Decimal → float
    for k, v in updated.items():
        if isinstance(v, Decimal):
            updated[k] = float(v)

    socketio.emit('update_facture', updated)
    return jsonify(updated), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    # Autoriser Werkzeug malgré l’avertissement de production
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
