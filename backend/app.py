
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)

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
    file = request.files["fichier"]
    data = request.form
    annee = data["annee"]
    conn = get_connection(annee)

    count = conn.execute("SELECT COUNT(*) FROM factures WHERE type=?", (data["type"],)).fetchone()[0]
    numero = count + 1

    filename = secure_filename(f"{annee}-{data['type']}-{numero}-UBR-{data['ubr']}-{file.filename}")
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    conn.execute("""INSERT INTO factures 
        (annee, type, ubr, fournisseur, description, montant, statut, fichier_nom, numero, date_ajout)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
        annee, data["type"], data["ubr"], data["fournisseur"], data["description"],
        float(data["montant"]), data["statut"], filename, numero, datetime.now().isoformat()
    ))
    conn.commit()
    facture = conn.execute("SELECT * FROM factures WHERE id = last_insert_rowid()").fetchone()
    conn.close()
    return jsonify(dict(facture))

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
def get_file(id):
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    row = conn.execute("SELECT fichier_nom FROM factures WHERE id=?", (id,)).fetchone()
    conn.close()
    if row:
        return send_from_directory(app.config["UPLOAD_FOLDER"], row["fichier_nom"], as_attachment=True)
    return "Fichier non trouvé", 404

@app.route("/api/factures/<int:id>", methods=["DELETE"])
def delete_facture(id):
    annee = request.args.get("annee", datetime.now().year)
    conn = get_connection(annee)
    facture = conn.execute("SELECT * FROM factures WHERE id=?", (id,)).fetchone()
    if not facture:
        conn.close()
        return jsonify({"error": "Facture non trouvée"}), 404

    # Supprimer le fichier s'il existe
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], facture["fichier_nom"])
    if os.path.exists(filepath):
        os.remove(filepath)

    # Supprimer la ligne de la base de données
    conn.execute("DELETE FROM factures WHERE id=?", (id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Facture supprimée"}), 200


@app.route("/api/factures/<int:id>", methods=["PUT"])
def update_facture(id):
    data = request.get_json()
    annee = data.get("annee") or datetime.now().year
    conn = get_connection(annee)

    # Construire dynamiquement la requête UPDATE selon les champs fournis
    allowed = ["type","ubr","fournisseur","description","montant","statut"]
    fields = []
    values = []
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

    facture = conn.execute("SELECT * FROM factures WHERE id = ?", (id,)).fetchone()
    conn.close()
    return jsonify(dict(facture))


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

