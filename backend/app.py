import logging
import eventlet
# Appliquer le monkey-patch d’Eventlet AVANT tout autre import
eventlet.monkey_patch()

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
from datetime import datetime

# --- CONFIGURATION DU LOGGER ---
# Affiche tout niveau DEBUG et plus
logging.basicConfig(level=logging.DEBUG,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
# On utilisera app.logger pour les logs Flask
# -----------------------------------

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

# CORS : exposer Content-Disposition sur les endpoints de factures
CORS(
    app,
    resources={ r"/api/factures/*": {
        "origins": "*",
        "expose_headers": ["Content-Disposition"]
    }}
)

# SocketIO en mode eventlet avec logging activé
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=True,           # logs socket.io
    engineio_logger=True   # logs engine.io
)

# Compteur global WebSocket
client_count = 0

@socketio.on('connect')
def handle_connect():
    global client_count
    client_count += 1
    app.logger.debug("WS connect reçu : SID=%s — total clients=%d", request.sid, client_count)
    # On notifie tous les clients du nouveau compte
    socketio.emit('client_count', client_count)
    app.logger.debug("Émission event client_count: %d", client_count)

@socketio.on('disconnect')
def handle_disconnect():
    global client_count
    client_count -= 1
    app.logger.debug("WS disconnect reçu : SID=%s — total clients=%d", request.sid, client_count)
    socketio.emit('client_count', client_count)
    app.logger.debug("Émission event client_count: %d", client_count)

# URL PostgreSQL fournie par Render
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    app.logger.error("La variable d'environnement DATABASE_URL n'est pas définie !")
else:
    app.logger.debug("DATABASE_URL trouvée : %s", DATABASE_URL)

def get_connection():
    """
    Ouvre et retourne une connexion psycopg2 vers PostgreSQL,
    en forçant SSL et en utilisant RealDictCursor.
    """
    app.logger.debug("Tentative de connexion à PostgreSQL…")
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        app.logger.debug("Connexion PostgreSQL établie avec succès")
        return conn
    except Exception as e:
        app.logger.error("Erreur de connexion PostgreSQL : %s", e, exc_info=True)
        raise

def init_db_postgres():
    """
    Crée la table factures si elle n'existe pas déjà.
    """
    app.logger.debug("Initialisation de la table factures si nécessaire")
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
    app.logger.debug("Table factures prête")

# On initialise la table au démarrage
init_db_postgres()

# Dossier de stockage des uploads
UPLOAD_FOLDER = "backend/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.logger.debug("Répertoire d'uploads : %s", UPLOAD_FOLDER)

@app.route("/")
def home():
    app.logger.debug("GET /")
    return "Flask fonctionne sur Render ✅"

@app.route("/api/factures", methods=["GET"])
def get_factures():
    annee = request.args.get("annee", datetime.now().year)
    app.logger.debug("GET /api/factures?annee=%s", annee)

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT * FROM factures WHERE annee = %s ORDER BY id DESC",
        (annee,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    app.logger.debug("→ %d factures récupérées", len(rows))

    return jsonify(rows)

@app.route("/api/factures", methods=["POST"])
def upload_facture():
    app.logger.debug("POST /api/factures reçu")
    file = request.files.get("fichier")
    if not file:
        app.logger.warning("Aucun fichier dans la requête")
        return jsonify({"error": "Aucun fichier envoyé"}), 400

    data = request.form
    annee = data.get("annee")
    if not annee:
        app.logger.warning("Champ 'annee' manquant dans form-data")
        return jsonify({"error": "Champ 'annee' manquant"}), 400

    # Préparation du nom de fichier
    ext = os.path.splitext(file.filename)[1] or ".pdf"
    filename = secure_filename(
        f"{annee}-{data.get('type')}-{data.get('ubr')}-"
        f"{data.get('fournisseur')}-{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
    )
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)
    app.logger.debug("Fichier sauvegardé sur disque : %s", filepath)

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    # Calcul du numéro séquentiel
    cur.execute(
        "SELECT COUNT(*) AS count FROM factures WHERE annee = %s AND type = %s",
        (annee, data.get("type"))
    )
    count = cur.fetchone()['count']
    numero = count + 1
    app.logger.debug("Numéro de facture calculé : %d", numero)

    # Insertion en base et retour de la ligne
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
    app.logger.debug("Nouvelle facture insérée : %r", new_facture)

    socketio.emit('new_facture', new_facture)
    app.logger.debug("Émission event new_facture")
    return jsonify(new_facture), 201

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    app.logger.debug("GET /api/factures/%d/fichier", id)
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row and row['fichier_nom']:
        app.logger.debug("Envoi du fichier : %s", row['fichier_nom'])
        return send_from_directory(
            app.config["UPLOAD_FOLDER"],
            row['fichier_nom'],
            as_attachment=True
        )
    app.logger.warning("Fichier non trouvé pour id=%d", id)
    return jsonify({"error": "Fichier non trouvé"}), 404

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    app.logger.debug("DELETE /api/factures/%d", id)
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT fichier_nom FROM factures WHERE id = %s", (id,))
    row = cur.fetchone()
    if not row:
        app.logger.warning("Facture non trouvée pour suppression id=%d", id)
        cur.close()
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Suppression du fichier
    if row['fichier_nom']:
        path = os.path.join(app.config["UPLOAD_FOLDER"], row['fichier_nom'])
        if os.path.exists(path):
            os.remove(path)
            app.logger.debug("Fichier supprimé du disque : %s", path)

    cur.execute("DELETE FROM factures WHERE id = %s", (id,))
    conn.commit()
    cur.close()
    conn.close()
    app.logger.debug("Facture id=%d supprimée de la base", id)

    socketio.emit('delete_facture', {'id': id})
    app.logger.debug("Émission event delete_facture")
    return jsonify({"message": "Facture supprimée"}), 200

@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    app.logger.debug("PUT /api/factures/%d", id)
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
        app.logger.warning("Aucun champ à mettre à jour pour id=%d", id)
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
    app.logger.debug("Facture id=%d mise à jour : %r", id, updated)

    socketio.emit('update_facture', updated)
    app.logger.debug("Émission event update_facture")
    return jsonify(updated), 200

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.logger.info("Démarrage du serveur sur le port %d", port)
    # Autoriser Werkzeug malgré l’avertissement de prod
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        allow_unsafe_werkzeug=True
    )
