import eventlet
# Monkey-patch pour eventlet : applique des modifications aux bibliothèques Python standard
# pour les rendre compatibles avec l'exécution asynchrone d'eventlet.
eventlet.monkey_patch()

from flask import Flask, request, jsonify, send_from_directory, Response,g
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import os
import re
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta, timezone, date
import csv
import io
from urllib.parse import urlparse
from decimal import Decimal, InvalidOperation
import bcrypt # Pour le hachage des mots de passe
import jwt # Pour les JSON Web Tokens
from functools import wraps # Utile pour créer des décorateurs Flask
import traceback
import json
from json import JSONEncoder # Importez JSONEncoder de Flask
import pytz

# Classe CustomJSONEncoder pour gérer la sérialisation de types non-standards
class CustomJSONEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            # Si datetime naïf, on l’assume en UTC
            if obj.tzinfo is None:
                obj = obj.replace(tzinfo=timezone.utc)
            # On force une ISO 8601 en UTC avec 'Z'
            return obj.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
            return obj.isoformat()
        if isinstance(obj, date): # Pour gérer les objets date si vous en avez (pas seulement datetime)
            return obj.isoformat()
        if isinstance(obj, Decimal):
            # Convertit les objets Decimal en chaîne (pour éviter la perte de précision)
            return str(obj)
        return super().default(obj) # Laisse l'encodeur par défaut gérer les autres types

# Initialisation de l'application Flask
app = Flask(__name__)

# Définissez le fuseau horaire de Montréal
MONTREAL_TIMEZONE = pytz.timezone('America/Montreal')
# # --- DEBUG FUSEAUX HORAIRE ---
# print("DEBUG UTC:", datetime.utcnow().isoformat())
# print("DEBUG Local:", datetime.now().isoformat())
# print("DEBUG Montréal:", MONTREAL_TIMEZONE.localize(datetime.now()).isoformat())
# # ----------------------------
# Limite la taille des fichiers uploadés à 2 Go
app.config['MAX_CONTENT_LENGTH'] = 2048 * 1024 * 1024
# Appliquer l'encodeur JSON personnalisé à l'application Flask
app.json_encoder = CustomJSONEncoder # Ajoutez cette ligne

# Configuration de CORS pour permettre les requêtes cross-origin sur les routes /api/*
CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=["Content-Disposition"])

# Initialisation de SocketIO pour la communication en temps réel
# socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet", json=app.json)
# Compteur global du nombre de clients connectés via SocketIO
client_count = 0

# Ajoutez ceci après la configuration de SocketIO
# Clé secrète pour signer les tokens - **À METTRE IMPÉRATIVEMENT DANS UNE VARIABLE D'ENVIRONNEMENT EN PRODUCTION**
# Utilisez `os.environ.get('SECRET_KEY', 'une_valeur_par_defaut_pour_dev')`
# Cette clé DOIT ÊTRE UNIQUE ET SECRÈTE. Ne la poussez PAS dans un dépôt public telle quelle.
SECRET_KEY = os.environ.get('SECRET_KEY', 'votre_super_cle_secrete_a_changer_absolument_en_prod_12345')
# !!! REMPLACEZ 'votre_super_cle_secrete_a_changer_absolument_en_prod_12345' par une clé aléatoire et complexe !!!
# En production, définissez une variable d'environnement SECRET_KEY sur votre serveur/service d'hébergement.


# Configuration du dossier pour stocker les fichiers uploadés
UPLOAD_FOLDER = "backend/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Crée le dossier s'il n'existe pas
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# URL de connexion à la base de données PostgreSQL, récupérée depuis une variable d'environnement
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://minio:Habitek2025@localhost:5432/factures_db")



# # Classe CustomJSONEncoder pour gérer la sérialisation de types non-standards
# class CustomJSONEncoder(JSONEncoder):
#     def default(self, obj):
#         if isinstance(obj, datetime):
#             # Formate les objets datetime en chaîne ISO 8601
#             return obj.isoformat()
#         if isinstance(obj, date): # Pour gérer les objets date si vous en avez (pas seulement datetime)
#             return obj.isoformat()
#         if isinstance(obj, Decimal):
#             # Convertit les objets Decimal en chaîne (pour éviter la perte de précision)
#             return str(obj)
#         return super().default(obj) # Laisse l'encodeur par défaut gérer les autres types


# Fonctions pour gérer le hachage et la vérification des mots de passe
def hash_password(password: str) -> str:
    """Hache un mot de passe en utilisant bcrypt."""
    # Génère un salt et hache le mot de passe. 12 est le coût (plus élevé = plus sûr, mais plus lent)
    salt = bcrypt.gensalt(12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def check_password(password: str, hashed_password: str) -> bool:
    """Vérifie si un mot de passe correspond à un hachage bcrypt."""
    # Gère le cas où le hachage stocké est None ou vide
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"Erreur lors de la vérification du mot de passe: {e}")
        return False # Éviter les exceptions en cas de hachage mal formé

# Modifiez le décorateur token_required existant
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Extraire le token de l'en-tête Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            parts = auth_header.split()
            # Vérifier que le format est "Bearer token"
            if parts[0].lower() == 'bearer' and len(parts) == 2:
                token = parts[1]
            else:
                 return jsonify({"error": "Format d'en-tête Authorization invalide"}), 401


        if not token:
            return jsonify({"error": "Token manquant"}), 401

        try:
            # Décode le token. `verify=True` est par défaut.
            # Assurez-vous que SECRET_KEY est une chaîne d'octets si jwt.decode le requiert dans votre version
            # data = jwt.decode(token, SECRET_KEY.encode('utf-8'), algorithms=['HS256']) # Optionnel selon version PyJWT
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])


            g.user_id = data.get('user_id')
            g.user_role = data.get('role') # Extraire le rôle du token

            # Vérifier que les informations nécessaires sont présentes dans le token
            if not g.user_id or not g.user_role:
                 # Token valide mais payload incomplet (ex: ancien token sans rôle)
                 print(f"Token valide mais payload incomplet: {data}")
                 return jsonify({"error": "Token invalide ou obsolète"}), 401

        except jwt.ExpiredSignatureError:
            print("Erreur: Token expiré")
            return jsonify({"error": "Token expiré"}), 401
        except jwt.InvalidSignatureError:
            print("Erreur: Signature de token invalide")
            return jsonify({"error": "Token invalide"}), 401
        except jwt.InvalidTokenError: # Capturer d'autres erreurs de token
             print(f"Erreur: Token invalide - {e}")
             return jsonify({"error": "Token invalide"}), 401
        except Exception as e:
            print(f"Erreur inattendue lors de la validation du token: {e}")
            return jsonify({"error": "Erreur de validation du token"}), 500 # Erreur interne

        return f(*args, **kwargs)
    return decorated

def role_required(allowed_roles):
    """
    Décorateur pour restreindre l'accès à une route aux utilisateurs avec certains rôles.
    Args:
        allowed_roles (list): Liste des rôles autorisés (ex: ['gestionnaire', 'approbateur']).
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # S'assurer que token_required a été exécuté avant et a stocké g.user_role
            if not hasattr(g, 'user_role') or g.user_role not in allowed_roles:
                print(f"Accès refusé: User ID {g.user_id}, Rôle '{getattr(g, 'user_role', 'N/A')}' non autorisé. Rôles requis: {allowed_roles}")
                return jsonify({"error": "Accès refusé: rôle insuffisant"}), 403 # Forbidden
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Dictionnaire de mappage pour normaliser les types de fonds entre le front et la base de données
FUND_TYPE_MAP = {
    "Fond 1":         "fonds de type 1",
    "fonds de type 1":"fonds de type 1",
    "Fond 3":         "fonds de type 3",
    "fonds de type 3":"fonds de type 3",
}

def normalize_fund_type(raw: str) -> str:
    """
    Normalise le type de fonds reçu du front-end pour correspondre aux valeurs attendues en base.
    Args:
        raw (str): Type de fonds brut (ex: 'Fond 1', 'fonds de type 3').
    Returns:
        str: Type de fonds normalisé.
    Raises:
        ValueError: Si le type de fonds est invalide.
    """
    normalized = FUND_TYPE_MAP.get(raw)
    if not normalized:
        raise ValueError(f"Type de fonds invalide: {raw!r}")
    return normalized


@socketio.on('connect')
def handle_connect(auth):  # 👈 Ajoutez le paramètre `auth`
    token = auth.get('token') if auth else None  # 👈 Récupérez le token depuis `auth`

    if not token:
        print("Socket connection refused: No token provided.")
        return False

    try:
        # Valider le token
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = data.get('user_id')
        user_role = data.get('role')

        if not user_id or not user_role:
            print("Socket connection refused: Invalid token payload.")
            return False

        # Stocker les infos dans la session Socket.IO
        request.sid_user_id = user_id  # Utilisez un attribut personnalisé
        request.sid_user_role = user_role

        global client_count
        client_count += 1
        print(f"Client connecté (ID: {user_id}, Rôle: {user_role}), count: {client_count}")
        emit('client_count', client_count, broadcast=True)

    except jwt.ExpiredSignatureError:
        print("Socket connection refused: Token expired.")
        return False
    except (jwt.InvalidTokenError, Exception) as e:
        print(f"Socket connection refused: Token error - {str(e)}")
        return False

# vérifier si la session est authentifiée et éventuellement vérifier le rôle :
@socketio.on('some_protected_event')
def handle_protected_event(data):
    user_id = request.sid.get('user_id')
    user_role = request.sid.get('user_role') # Récupérer le rôle

    if not user_id or not user_role:
        emit('error', {'message': 'Socket non authentifié'}, room=request.sid) # Envoyer l'erreur uniquement à ce client
        return False

    # Exemple: autoriser l'événement seulement pour les gestionnaires
    # if user_role != 'gestionnaire':
    #     emit('error', {'message': 'Accès Socket refusé: rôle insuffisant'}, room=request.sid)
    #     return False

    print(f"Protected event from user ID: {user_id} (Role: {user_role})")
    # Logique de l'événement protégé ici
    pass



@socketio.on('disconnect')
def handle_disconnect():
    """
    Gère la déconnexion d'un client via SocketIO.
    - Décrémente le compteur de clients.
    - Diffuse le nouveau nombre de clients connectés à tous les clients.
    """
    global client_count
    client_count -= 1
    emit('client_count', client_count, broadcast=True)



def get_db_connection():
    """
    Établit une connexion à la base de données PostgreSQL.
    Returns:
        psycopg2.connection: Connexion à la base, ou None en cas d'erreur.
    """
    try:
        url = urlparse(DATABASE_URL)
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        #############
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET TIME ZONE 'UTC';")
            # print("Fuseau horaire de la session de base de données configuré sur UTC.") # Optionnel pour le débogage
        except psycopg2.Error as e:
            print(f"Échec de la configuration du fuseau horaire de la session sur UTC : {e}")
            # Gérer l'erreur : fermer la connexion et retourner None, ou lever une exception
            conn.close()
            return None
        return conn
    except psycopg2.Error as e:
        print(f"Erreur de connexion à PostgreSQL : {e}")
        return None


def init_db():
    """
    Initialise la base de données en créant les tables 'factures', 'budgets' et 'users' si elles n'existent pas.
    """
    conn = get_db_connection()
    if conn is None:
        print("Échec de la connexion à la base de données, impossible d'initialiser les tables.")
        return

    cursor = conn.cursor()
    try:
        # Création de la table 'factures' (doit déjà exister)   
        cursor.execute("""
                CREATE TABLE IF NOT EXISTS factures (
                    id SERIAL PRIMARY KEY,
                    numero_facture VARCHAR(255) UNIQUE NOT NULL,
                    date_facture DATE NOT NULL,
                    fournisseur VARCHAR(255) NOT NULL,
                    description TEXT,
                    montant DECIMAL(10, 2) NOT NULL,
                    devise VARCHAR(10) NOT NULL,
                    statut VARCHAR(50) NOT NULL DEFAULT 'soumis', -- soumis, approuve, rejete, paye
                    type_facture VARCHAR(255),
                    ubr VARCHAR(255),  
                    chemin_fichier VARCHAR(255),
                    id_soumetteur INTEGER REFERENCES users(id), -- Existing column
                    date_soumission TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Existing column
                    -- New columns added below
                    created_by INTEGER REFERENCES users(id),
                    last_modified_by INTEGER REFERENCES  users(id),
                    last_modified_timestamp TIMESTAMPTZ,
                    categorie VARCHAR(255), -- Adjust size as needed
                    ligne_budgetaire VARCHAR(255) -- Adjust size as needed
                );
            """)

        # Création de la table 'budgets' (doit déjà exister)
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

        # *** AJOUT DE LA TABLE USERS ***
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL, -- Ajout de l'adresse courriel
                role VARCHAR(50) NOT NULL DEFAULT 'soumetteur', -- Ajout du rôle, par défaut 'soumetteur'
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT valid_role CHECK (role IN ('soumetteur', 'gestionnaire', 'approbateur')) -- Contrainte pour limiter les valeurs de rôle
            );
        """)

        conn.commit()
        print("Tableau de factures vérifié/créé.")
        print("Tableau de budgets vérifié/créé.")
        print("Tableau d'utilisateurs vérifié/créé.") # Confirmation pour la nouvelle table

    except psycopg2.Error as e:
        print(f"Erreur d'initialisation de la base de données : {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()



# Initialisation de la base de données au démarrage de l'application
init_db()


def convert_to_json_serializable(obj):
    """
    Convertit les types non sérialisables en JSON (Decimal, datetime) pour les réponses API.
    Args:
        obj: Objet à convertir.
    Returns:
        Objet sérialisable en JSON.
    """
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
      # On considère que les datetime sans tzinfo sont UTC
       if obj.tzinfo is None:
           obj = obj.replace(tzinfo=timezone.utc)
       # Toujours émettre en UTC avec 'Z'
       return obj.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    return obj

@app.route("/")
def home():
    """
    Route racine de l'application.
    - Retourne un message simple pour confirmer que l'application Flask fonctionne.
    """
    return "Flask fonctionne ✅"




# @app.route('/api/factures', methods=['POST'])
# @token_required
# @role_required(['soumetteur', 'gestionnaire', 'approbateur'])
# def upload_facture():
#     # Récupérer les données JSON de la requête
#     # Tente d'abord de récupérer du formulaire (multipart/form-data), puis du JSON
#     # data = request.form.to_dict()
#     data = request.form
#     if not data:
#         data = request.get_json()
#         if not data:
#             return jsonify({"error": "Aucune donnée fournie ou format incorrect"}), 400

#     # --- DÉBUT DES LIGNES DE DÉBOGAGE AJOUTÉES ---
#     print(f"\n--- DEBUG POST /api/factures ---")
#     print(f"DEBUG: Type de requête Content-Type: {request.headers.get('Content-Type')}")
#     print(f"DEBUG: Contenu de request.form: {request.form}") # Affiche les champs du formulaire
#     print(f"DEBUG: Contenu de request.files: {request.files}") # Affiche les fichiers
#     # --- FIN DES LIGNES DE DÉBOGAGE AJOUTÉES ---

#     # Extraction des champs requis de la facture
#     numero_facture = data.get('numero_facture')
#     date_facture = data.get('date_facture')
#     fournisseur = data.get('fournisseur')
#     description = data.get('description')
#     montant = data.get('montant')
#     devise = data.get('devise')
#     statut = data.get('statut', 'soumis') # Statut par défaut 'soumis'
#     categorie = data.get('categorie')
#     ligne_budgetaire = data.get('ligne_budgetaire')
#     type_= data.get('type')
#     ubr = data.get('ubr')


#     # --- Début de la gestion optionnelle du fichier ---
#     file_path = None # Initialiser le chemin du fichier à None
    
#     file = request.files.get('fichier') # Utiliser .get() pour éviter une erreur si la clé 'fichier' n'est pas présente

    
#     if (file and file.filename != ''):
#         print(f"DEBUG: Condition 'file and file.filename != ''' est VRAIE.")
#         filename = secure_filename(file.filename)
#         upload_folder = app.config['UPLOAD_FOLDER']

#         # --- DÉBOGAGE DU CHEMIN ET CRÉATION DE DOSSIER ---
#         print(f"DEBUG: UPLOAD_FOLDER configuré: {upload_folder}")
#         # Assurez-vous que le répertoire de téléversement existe
#         os.makedirs(upload_folder, exist_ok=True) # Cette ligne crée le dossier s'il n'existe pas
#         print(f"DEBUG: Le dossier de téléversement '{upload_folder}' a été vérifié/créé.")
#         # --- FIN DÉBOGAGE DU CHEMIN ---

#         file_path = os.path.join(upload_folder, filename)
#         print(f"DEBUG: Chemin complet où le fichier sera sauvegardé: {file_path}")

#         try:
#             file.save(file_path)
#             print(f"DEBUG: Fichier '{filename}' sauvegardé avec succès dans '{file_path}'")
#         except Exception as e:
#             print(f"DEBUG ERROR: Échec de la sauvegarde du fichier: {e}")
#             traceback.print_exc() # Cela imprimera le traceback complet de l'erreur
#             return jsonify({"error": "Échec de la sauvegarde du fichier", "details": str(e)}), 500
#     else:
#         print("DEBUG: Condition 'file and file.filename != ''' est FAUSSE. Pas de fichier à sauvegarder.")
#     # --- Fin de la gestion optionnelle du fichier ---


#     # Vérifier si les champs requis (hors fichier) sont présents
#     if not all([numero_facture, date_facture, fournisseur, montant, devise, categorie, ligne_budgetaire]):
#         # Le chemin_fichier n'est plus requis ici
#         return jsonify({"error": "Champs requis manquants (numero_facture, date_facture, fournisseur, montant, devise, categorie, ligne_budgetaire)"}), 400


#     # Validation basique du format de la date (ajuster selon votre besoin)
#     try:
#         datetime.strptime(date_facture, '%Y-%m-%d')
#     except ValueError:
#         # Supprimer le fichier sauvegardé s'il y a une erreur de date après la sauvegarde
#         if file_path and os.path.exists(file_path):
#              os.remove(file_path)
#         return jsonify({"error": "Format de date invalide. Utilisez AAAA-MM-JJ"}), 400

#     # Convertir le montant en Decimal
#     try:
#         montant = Decimal(montant)
#     except InvalidOperation:
#          # Supprimer le fichier sauvegardé s'il y a une erreur de montant après la sauvegarde
#         if file_path and os.path.exists(file_path):
#              os.remove(file_path)
#         return jsonify({"error": "Format de montant invalide"}), 400


#     conn = get_db_connection()
#     # cur = conn.cursor()
#     cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
#     try:
#         # Vérifier s'il existe déjà une facture avec le même numéro
#         cur.execute("SELECT id FROM factures WHERE numero_facture = %s", (numero_facture,))
#         if cur.fetchone():
#             # Si le numéro de facture existe déjà, supprimer le fichier sauvegardé (s'il y en a un)
#             if file_path and os.path.exists(file_path):
#                 os.remove(file_path)
#             return jsonify({"error": f"Le numéro de facture {numero_facture} existe déjà"}), 409

#        # Date de soumission actuelle (assurée d'être en UTC)
#         # Crée un datetime conscient du fuseau horaire de Montréal, puis le convertit en UTC
#         now_aware_local = MONTREAL_TIMEZONE.localize(datetime.now(), is_dst=None)
#         date_soumission_utc = now_aware_local.astimezone(pytz.utc)  
    
#         # Insérer la nouvelle facture dans la base de données
#         # Inclure les NOUVEAUX champs: created_by, categorie, ligne_budgetaire  
#         # created_by est l'utilisateur actuellement authentifié (via g.user_id)
#         # Utiliser la variable file_path qui sera None si aucun fichier n'a été uploadé
#         print(f"\n--- DEBUG: Types des paramètres pour l'INSERT ---")
#         print(f"DEBUG: numero_facture: Type={type(numero_facture)}, Value='{numero_facture}'")
#         print(f"DEBUG: date_facture: Type={type(date_facture)}, Value='{date_facture}'")
#         print(f"DEBUG: fournisseur: Type={type(fournisseur)}, Value='{fournisseur}'")
#         print(f"DEBUG: description: Type={type(description)}, Value='{description}'")
#         print(f"DEBUG: montant: Type={type(montant)}, Value='{montant}'")
#         print(f"DEBUG: devise: Type={type(devise)}, Value='{devise}'")
#         print(f"DEBUG: statut: Type={type(statut)}, Value='{statut}'")
#         print(f"DEBUG: type: Type={type(type_)}, Value='{type_}'")
#         print(f"DEBUG: type: Type={type(ubr)}, Value='{ubr}'")
#         print(f"DEBUG: file_path: Type={type(file_path)}, Value='{file_path}'")
#         print(f"DEBUG: g.user_id (id_soumetteur): Type={type(g.user_id)}, Value='{g.user_id}'")
#         print(f"DEBUG: date_soumission_utc: Type={type(date_soumission_utc)}, Value='{date_soumission_utc}'")
#         print(f"DEBUG: g.user_id (created_by): Type={type(g.user_id)}, Value='{g.user_id}'")
#         print(f"DEBUG: categorie: Type={type(categorie)}, Value='{categorie}'")
#         print(f"DEBUG: ligne_budgetaire: Type={type(ligne_budgetaire)}, Value='{ligne_budgetaire}'")
#         print(f"--- FIN DEBUG: Types des paramètres ---")
#         cur.execute(
#             """
#             INSERT INTO factures (
#                 numero_facture, date_facture, fournisseur, description, montant, devise,
#                 statut, type_facture, ubr, chemin_fichier, id_soumetteur, date_soumission,
#                 created_by, categorie, ligne_budgetaire
#             ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
#             RETURNING id;
#             """,
#             (numero_facture, date_facture, fournisseur, description, montant, devise,
#              statut,type_, ubr, file_path, g.user_id, date_soumission_utc,
#              g.user_id, categorie, ligne_budgetaire) # file_path sera None ou le chemin du fichier
#         )
#         facture_id = cur.fetchone()[0]
#         conn.commit()

#         # --- Récupérer la facture nouvellement créée pour l'émettre via SocketIO ---
#         # Inclure les NOUVEAUX champs et les jointures pour les noms d'utilisateur associés
#         cur.execute(
#             """
#             SELECT
#                 f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
#                 f.statut, f.type_facture, f.ubr, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
#                 f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
#                 u.username as soumetteur_username, uc.username as created_by_username, um.username as last_modified_by_username
#             FROM factures f
#             JOIN users u ON f.id_soumetteur = u.id
#             LEFT JOIN users uc ON f.created_by = uc.id -- Joindre pour le nom d'utilisateur de created_by
#             LEFT JOIN users um ON f.last_modified_by = um.id -- Joindre pour le nom d'utilisateur de last_modified_by
#             WHERE f.id = %s
#             """, (facture_id,)
#         )
#         new_facture = cur.fetchone()

#         if new_facture:
#              # Convertir la ligne de résultat en dictionnaire pour un accès plus facile
#             new_facture_dict = dict(new_facture)
#             # Convertir les types non sérialisables en JSON
#             #serializable_facture = convert_to_json_serializable(new_facture_dict)
#             # Émettre l'événement SocketIO
#             # --- CRITICAL DEBUG LINE ---
#             try:
#                 # Explicitly use app.json_encoder to see what it produces
#                 json_payload_to_emit = json.dumps(new_facture_dict, cls=app.json_encoder)
#                 print(f"\n--- DEBUG BACKEND: JSON payload as processed by CustomJSONEncoder (BEFORE SocketIO emit) ---\n{json_payload_to_emit}\n--- END DEBUG ---")
#             except Exception as e:
#                 print(f"DEBUG BACKEND ERROR: CustomJSONEncoder test failed to serialize DictRow: {e}")
#                 import traceback # Ensure this is imported
#                 traceback.print_exc()
#             # --- END CRITICAL DEBUG LINE ---
#             new_facture_dict = dict(new_facture)
#             new_facture_dict['annee'] = date_facture[:4]  # extrait l'année en string à partir de 'YYYY-MM-DD'
#             socketio.emit('new_facture', new_facture_dict)

#         # --- Fin de la récupération et émission SocketIO ---


#         return jsonify({"message": "Facture créée avec succès (fichier joint optionnel)", "id": facture_id}), 201

#     except psycopg2.errors.UniqueViolation:
#         conn.rollback()
#         # Supprimer le fichier sauvegardé (s'il y en a un) en cas d'erreur de violation unique
#         if file_path and os.path.exists(file_path):
#             os.remove(file_path)
#         print(f"DEBUG: UniqueViolation catch: Le numéro de facture {numero_facture} existe déjà.") # Debug précis
#         traceback.print_exc() # Ajoutez le traceback ici aussi pour ce cas spécifique
#         return jsonify({"error": f"Une facture avec le numéro {numero_facture} existe déjà."}), 409
#     except Exception as e:
#         conn.rollback()
#         # Supprimer le fichier sauvegardé (s'il y en a un) en cas d'autre erreur de base de données
#         if file_path and os.path.exists(file_path):
#             os.remove(file_path)
#         print(f"Erreur de base de données (CAPTURE GÉNÉRIQUE): {e}")
#         # C'EST LA LIGNE CLÉ QUE NOUS VOULONS VÉRIFIER : assurez-vous qu'elle est là et que son output est capturé.
#         traceback.print_exc()
#         return jsonify({"error": "Échec de la sauvegarde de la facture dans la base de données.", "details": str(e)}), 500
#     finally:
#         cur.close()
#         conn.close()

@app.route('/api/factures', methods=['POST'])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def upload_facture():
    # 1) Récup données
    data = request.form if request.form else (request.get_json() or {})
    if not data:
        return jsonify({"error": "Aucune donnée fournie ou format incorrect"}), 400

    print(f"\n--- DEBUG POST /api/factures ---")
    print(f"DEBUG: Content-Type: {request.headers.get('Content-Type')}")
    print(f"DEBUG: request.form: {request.form}")
    print(f"DEBUG: request.files: {request.files}")

    # 2) Extraire (SANS numero_facture — read-only)
    #    -> on lit la valeur mais on ne l'utilise plus
    _numero_facture_client = data.get('numero_facture')  # ignoré
    date_facture   = data.get('date_facture')
    fournisseur    = data.get('fournisseur')
    description    = data.get('description')
    montant        = data.get('montant')
    devise         = data.get('devise')
    statut         = data.get('statut', 'soumis')
    categorie      = data.get('categorie')
    ligne_budgetaire = data.get('ligne_budgetaire')
    type_          = data.get('type')
    ubr            = data.get('ubr')

    # 3) Upload fichier (inchangé)
    file_path = None
    file = request.files.get('fichier')
    if file and file.filename != '':
        filename = secure_filename(file.filename)
        upload_folder = app.config['UPLOAD_FOLDER']
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, filename)
        try:
            file.save(file_path)
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": "Échec de la sauvegarde du fichier", "details": str(e)}), 500

    # 4) Champs requis (NE PLUS inclure numero_facture)
    if not all([date_facture, fournisseur, montant, devise, categorie, ligne_budgetaire]):
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"error": "Champs requis manquants (date_facture, fournisseur, montant, devise, categorie, ligne_budgetaire)"}), 400

    # 5) Validations
    try:
        datetime.strptime(date_facture, '%Y-%m-%d')
    except ValueError:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"error": "Format de date invalide. Utilisez AAAA-MM-JJ"}), 400

    try:
        montant = Decimal(montant)
    except InvalidOperation:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({"error": "Format de montant invalide"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # 6) (SUPPRIMÉ) Vérif d'unicité du numero_facture — la DB gère via séquence + UNIQUE

        # 7) Timestamps cohérents (UTC)
        now_aware_local = MONTREAL_TIMEZONE.localize(datetime.now(), is_dst=None)
        date_soumission_utc = now_aware_local.astimezone(pytz.utc)

        print(f"\n--- DEBUG: Types pour INSERT (sans numero_facture) ---")
        print(f"date_facture={date_facture} fournisseur={fournisseur} montant={montant} devise={devise}")
        print(f"statut={statut} type={type_} ubr={ubr} file_path={file_path}")
        print(f"id_soumetteur={g.user_id} date_soumission_utc={date_soumission_utc}")
        print(f"categorie={categorie} ligne_budgetaire={ligne_budgetaire}")
        print(f"--- FIN DEBUG ---")

        # 8) INSERT SANS numero_facture (DEFAULT séquence en DB)
        cur.execute(
            """
            INSERT INTO factures (
                date_facture, fournisseur, description, montant, devise,
                statut, type_facture, ubr, chemin_fichier, id_soumetteur, date_soumission,
                created_by, categorie, ligne_budgetaire
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (date_facture, fournisseur, description, montant, devise,
             statut, type_, ubr, file_path, g.user_id, date_soumission_utc,
             g.user_id, categorie, ligne_budgetaire)
        )
        facture_id = cur.fetchone()[0]
        conn.commit()

        # 9) Relecture + emit (inchangé)
        cur.execute(
            """
            SELECT
                f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
                f.statut, f.type_facture, f.ubr, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
                f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
                u.username as soumetteur_username, uc.username as created_by_username, um.username as last_modified_by_username
            FROM factures f
            JOIN users u ON f.id_soumetteur = u.id
            LEFT JOIN users uc ON f.created_by = uc.id
            LEFT JOIN users um ON f.last_modified_by = um.id
            WHERE f.id = %s
            """, (facture_id,)
        )
        new_facture = cur.fetchone()

        if new_facture:
            new_facture_dict = dict(new_facture)
            try:
                json.dumps(new_facture_dict, cls=app.json_encoder)  # test sérialisation
            except Exception:
                traceback.print_exc()

            # Ajout 'annee' dérivée de date_facture (ex: "2025")
            new_facture_dict['annee'] = (date_facture or '')[:4]
            socketio.emit('new_facture', new_facture_dict)

        return jsonify({"message": "Facture créée avec succès (fichier joint optionnel)", "id": facture_id}), 201

    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        traceback.print_exc()
        # Cette erreur ne devrait plus venir du numero_facture côté client,
        # mais on la garde par prudence (autres contraintes uniques éventuelles).
        return jsonify({"error": "Violation d’unicité détectée"}), 409

    except Exception as e:
        conn.rollback()
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        traceback.print_exc()
        return jsonify({"error": "Échec de la sauvegarde de la facture dans la base de données.", "details": str(e)}), 500

    finally:
        cur.close()
        conn.close()





#OLD VERSION 2025-09-22
# @app.route('/api/factures', methods=['GET'])
# @token_required
# @role_required(['soumetteur', 'gestionnaire', 'approbateur']) # Tous peuvent lister les factures
# def get_factures():
#     """
#     Récupère la liste des factures pour une année donnée.
#     - Par défaut, utilise l'année en cours si aucune année n'est spécifiée.
#     - Inclut les nouvelles colonnes et les noms d'utilisateur associés.
#     - Retourne les factures triées par date_facture (du plus récent au plus ancien).
#     Returns:
#         JSON: Liste des factures ou message d'erreur.
#     """
#     # Récupérer l'année depuis les arguments de la requête, par défaut l'année courante
#     year = request.args.get('year', type=int, default=datetime.now().year)

#     conn = get_db_connection()
#     if conn is None:
#         return jsonify({"error": "Erreur de connexion à la base de données"}), 500

#     # Utiliser DictCursor pour que les résultats soient accessibles par nom de colonne
#     cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
#     try:
#         # --- Requête SELECT mise à jour pour inclure les nouvelles colonnes et les noms d'utilisateur ---
#         cur.execute(
#             """
#             SELECT
#                 f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
#                 f.statut, f.type_facture, f.ubr, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
#                 f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
#                 u.username as soumetteur_username, uc.username as created_by_username, um.username as last_modified_by_username
#             FROM factures f
#             JOIN users u ON f.id_soumetteur = u.id           -- Joindre pour le nom d'utilisateur du soumetteur
#             LEFT JOIN users uc ON f.created_by = uc.id        -- Joindre pour le nom d'utilisateur de created_by
#             LEFT JOIN users um ON f.last_modified_by = um.id  -- Joindre pour le nom d'utilisateur de last_modified_by
#             WHERE EXTRACT(YEAR FROM date_facture) = %s
#             ORDER BY date_facture DESC -- Tri par date de facture
#             """, (year,) # Filtrer par année
#         )
#         factures = cur.fetchall() # Récupérer toutes les lignes

#         # Convertir chaque ligne (DictRow) en dictionnaire et rendre JSON sérialisable
#         factures_list = [convert_to_json_serializable(dict(row)) for row in factures]

#         print(factures_list)

#         return jsonify(factures_list), 200 # Retourner la liste des factures

#     except Exception as e:
#         print(f"Erreur de base de données lors de la récupération des factures : {e}")
#         return jsonify({"error": "Échec de la récupération des factures.", "details": str(e)}), 500
#     finally:
#         # Fermer le curseur et la connexion
#         cur.close()
#         conn.close()

@app.route('/api/factures', methods=['GET'])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def get_factures():
    """
    Liste les factures pour une année donnée (year=YYYY).
    - Filtre par plage de dates [YYYY-01-01, (YYYY+1)-01-01)
    - Jointure optionnelle sur comptes_depenses si la table existe.
    """
    # 1) Param année (par défaut: année courante)
    year = request.args.get('year', type=int, default=datetime.now().year)
    start = date(year, 1, 1)
    end   = date(year + 1, 1, 1)

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500

    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        # 2) Requête avec LEFT JOIN comptes_depenses (si table dispo)
        sql_with_join = """
            SELECT
                f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
                f.statut, f.type_facture, f.ubr, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
                f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
                u.username AS soumetteur_username, uc.username AS created_by_username, um.username AS last_modified_by_username,
                cd.id AS compte_depense_id, cd.mode AS compte_depense_mode, cd.global_ubr AS compte_depense_global_ubr,
                (cd.demandeur_prenom || ' ' || cd.demandeur_nom) AS compte_depense_label
            FROM factures f
            JOIN users u  ON f.id_soumetteur     = u.id
            LEFT JOIN users uc ON f.created_by   = uc.id
            LEFT JOIN users um ON f.last_modified_by = um.id
            LEFT JOIN comptes_depenses cd ON cd.id = f.compte_depense_id
            WHERE f.date_facture >= %s AND f.date_facture < %s
            ORDER BY f.date_facture DESC, f.id DESC
        """
        cur.execute(sql_with_join, (start, end))
        rows = cur.fetchall()

    except errors.UndefinedTable:
        # 3) Fallback sans la table comptes_depenses (avant sa création)
        conn.rollback()
        sql_no_join = """
            SELECT
                f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
                f.statut, f.type_facture, f.ubr, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
                f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
                u.username AS soumetteur_username, uc.username AS created_by_username, um.username AS last_modified_by_username
            FROM factures f
            JOIN users u  ON f.id_soumetteur     = u.id
            LEFT JOIN users uc ON f.created_by   = uc.id
            LEFT JOIN users um ON f.last_modified_by = um.id
            WHERE f.date_facture >= %s AND f.date_facture < %s
            ORDER BY f.date_facture DESC, f.id DESC
        """
        cur.execute(sql_no_join, (start, end))
        rows = cur.fetchall()

    except Exception as e:
        print(f"Erreur de base de données lors de la récupération des factures : {e}")
        return jsonify({"error": "Échec de la récupération des factures.", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()

    # 4) Sérialisation
    factures_list = [convert_to_json_serializable(dict(r)) for r in rows]
    return jsonify(factures_list), 200

@app.route("/api/factures/<int:id>/fichier", methods=["GET"])
@token_required
@role_required(['soumetteur', 'gestionnaire', 'approbateur'])
def get_file(id):
    """
    Récupère le fichier associé à une facture spécifique.
    """
    # annee = request.args.get("annee", str(datetime.now().year))
    # print(f"L'année de la recherche est :{annee}") # This `annee` is not used in the DB query, but could be used for file path

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()
    try:
        # Retrieve the file path from the database
        cursor.execute(
            "SELECT chemin_fichier FROM factures WHERE id = %s",
            (id,) # Corrected: Ensure it's a tuple for psycopg2
        )
        row = cursor.fetchone()
        print(f"La row de la recherche est :{row}")

        # If no row or file path is NULL
        if not row or not row[0]:
            return jsonify({"warning": "La facture n'existe plus sur le système ou aucun fichier n'y est associé."}), 404

        # The 'filepath' from DB is actually the 'relative_path_with_filename'
        relative_path_with_filename = row[0]
        print(f"Le chemin relatif complet est :{relative_path_with_filename}")

        # Construct the full absolute path on the server
        # It's better to explicitly join with app.root_path if UPLOAD_FOLDER is relative
        # or ensure UPLOAD_FOLDER itself is absolute and base the path from there.
        # Assuming UPLOAD_FOLDER is a base directory like 'uploads' and 'relative_path_with_filename'
        # already includes the year subfolder (e.g., '2025/invoice.pdf')
        # Let's assume UPLOAD_FOLDER is the top-level 'uploads' directory
        base_upload_dir = app.config["UPLOAD_FOLDER"]
        if not os.path.isabs(base_upload_dir):
            base_upload_dir = os.path.join(app.root_path, base_upload_dir)

        full_absolute_filepath = os.path.join(app.root_path, relative_path_with_filename)
        print(f"Le chemin absolu complet est :{full_absolute_filepath}")

        # If the file has been deleted from the file system
        if not os.path.exists(full_absolute_filepath):
            # Update DB to nullify chemin_fichier
            cursor.execute(
                "UPDATE factures SET chemin_fichier = NULL WHERE id = %s",
                (id,) # Corrected: Ensure it's a tuple for psycopg2
            )
            conn.commit()
            return jsonify({"warning": "Le fichier physique de la facture n'existe plus sur le système."}), 404

        # Correctly get the directory and filename for send_from_directory
        directory_to_serve_from = os.path.dirname(full_absolute_filepath)
        filename_to_serve = os.path.basename(full_absolute_filepath)
        
        print(f"Le répertoire à servir est :{directory_to_serve_from}")
        print(f"Le nom de fichier à servir est :{filename_to_serve}")

        # Return the file for download
        return send_from_directory(
            directory_to_serve_from, # Pass the directory path
            filename_to_serve,       # Pass only the filename
            as_attachment=True,
            download_name=filename_to_serve # Suggest the original filename to the browser
        )

    except psycopg2.Error as e:
        conn.rollback()
        print(f"Erreur PostgreSQL lors de la récupération du fichier : {e}")
        return jsonify({"error": "Erreur lors de l'accès au fichier dans la base de données."}), 500
    except Exception as e:
        conn.rollback() # Rollback in case of non-PostgreSQL errors too
        print(f"Erreur inattendue lors de la récupération du fichier : {e}")
        import traceback # Import traceback at the top of your file
        traceback.print_exc() # Print full traceback for debugging
        return jsonify({"error": f"Une erreur inattendue est survenue lors du téléchargement : {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()
        



@app.route("/api/factures/<int:fid>", methods=["PATCH"])
@token_required
@role_required(['gestionnaire', 'approbateur'])
def patch_facture(fid):
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Aucune donnée"}), 400
    if "numero_facture" in data:
        return jsonify({"error": "numero_facture est en lecture seule"}), 400

    allowed = {
        "date_facture", "fournisseur", "description", "montant", "devise",
        "statut", "type_facture", "ubr", "chemin_fichier",
        "categorie", "ligne_budgetaire",
        "compte_depense_id"  # NEW: lier/délier un compte de dépense (colonne TEXT)
    }

    # --- Validations/normalisations ---
    # Montant -> Decimal (si fourni)
    if "montant" in data:
        try:
            data["montant"] = Decimal(str(data["montant"]))
        except InvalidOperation:
            return jsonify({"error": "Format de montant invalide"}), 400

    # Date (si fournie)
    if "date_facture" in data:
        try:
            datetime.strptime(str(data["date_facture"]), "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Format date_facture invalide (AAAA-MM-JJ)"}), 400

    # NEW: compte_depense_id (TEXT) — accepter null/"" pour délier, sinon valider 'HABITEK###'
    if "compte_depense_id" in data:
        v = data["compte_depense_id"]
        if v in (None, "", "null", "None"):
            data["compte_depense_id"] = None
        else:
            if not re.match(r"^HABITEK\d{3,}$", str(v)):
                return jsonify({"error": "compte_depense_id doit suivre le format HABITEK###"}), 400

    # Construction dynamique du SET
    sets, vals = [], []
    for k, v in data.items():
        if k in allowed:
            sets.append(f"{k} = %s")
            vals.append(v)

    if not sets:
        return jsonify({"error": "Aucun champ modifiable"}), 400

    # Audit
    sets.append("last_modified_by = %s")
    vals.append(g.user_id)
    sets.append("last_modified_timestamp = (now() at time zone 'utc')")

    vals.append(fid)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(f"""
            UPDATE factures
            SET {", ".join(sets)}
            WHERE id = %s
            RETURNING *;
        """, vals)
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Facture introuvable"}), 404

        conn.commit()
        updated = {k: convert_to_json_serializable(v) for k, v in dict(row).items()}
        socketio.emit("update_facture", updated)  # UI écoute déjà
        return jsonify(updated), 200

    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        return jsonify({"error": "Erreur lors de la mise à jour", "details": str(e)}), 500
    finally:
        cur.close(); conn.close()













@app.route("/api/factures/<int:id>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire', 'approbateur']) # Seuls gestionnaire et approbateur peuvent supprimer
def delete_facture(id):
    """
    Supprime une facture et son fichier associé (si existant).
    - Supprime le fichier du système de fichiers si présent.
    - Supprime l'entrée de la base de données.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID de la facture.
    Returns:
        JSON: Message de confirmation ou erreur.
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    # Conservez le curseur par défaut ici, car nous voulons une tuple (row[0])
    cursor = conn.cursor()
    try:
        # Assurez-vous que l'année n'est PAS dans la requête SELECT ou DELETE
        # puisque la colonne 'annee' n'existe pas dans la table 'factures'.
        # L'ID est suffisant pour la suppression.
        cursor.execute("SELECT chemin_fichier FROM factures WHERE id = %s", (id,))
        row = cursor.fetchone()

        if not row:
            # Si aucune ligne n'est trouvée, la facture n'existe pas
            return jsonify({"error": "Facture non trouvée"}), 404

        file_path_from_db = row[0] # chemin_fichier est le premier (et seul) élément du tuple

        # Supprimer le fichier si existant
        if file_path_from_db:
            # IMPORTANT: secure_filename NE DOIT PAS être utilisé ici.
            # chemin_fichier devrait déjà être le chemin relatif ou complet sécurisé.
            # Si chemin_fichier est comme 'backend/uploads/nom_du_fichier.pdf', utilisez-le directement.
            # Si chemin_fichier est JUSTE 'nom_du_fichier.pdf', alors utilisez os.path.join.
            
            # Je suppose ici que 'chemin_fichier' dans la BD est le chemin relatif depuis la racine du projet,
            # ou un chemin absolu. Si c'est un chemin relatif au dossier d'upload, alors os.path.join est utile.
            # Pour la cohérence avec votre log "Chemin complet où le fichier sera sauvegardé: backend/uploads/...",
            # il est probable que chemin_fichier contienne déjà ce chemin relatif.

            filepath_to_delete = file_path_from_db # Utilisez le chemin exact de la BD
            
            # Si votre DB stocke juste le nom de fichier (ex: 'mon_doc.pdf'), et non 'backend/uploads/mon_doc.pdf',
            # ALORS décommentez la ligne suivante et commentez celle au-dessus:
            # filepath_to_delete = os.path.join(app.config["UPLOAD_FOLDER"], file_path_from_db)


            if os.path.exists(filepath_to_delete):
                try:
                    os.remove(filepath_to_delete)
                    print(f"Fichier supprimé : {filepath_to_delete}")
                except Exception as e:
                    print(f"Erreur lors de la suppression du fichier {filepath_to_delete} : {e}")
            else:
                print(f"Avertissement: Fichier physique non trouvé à {filepath_to_delete}, mais l'entrée de la BD sera supprimée.")


        # Supprimer l'entrée de la base de données
        cursor.execute("DELETE FROM factures WHERE id = %s", (id,))
        if cursor.rowcount == 0:
            # Cela ne devrait pas arriver si la facture a été trouvée juste avant,
            # à moins d'une suppression concurrente.
            return jsonify({"error": "Facture non trouvée après tentative de suppression"}), 404
        conn.commit()

        socketio.emit('delete_facture', {'id': id})
        return jsonify({"message": "Facture supprimée"}), 200

    except psycopg2.Error as e:
        conn.rollback()
        print(f"Erreur PostgreSQL lors de la suppression de la facture : {e}")
        # traceback.print_exc() # Décommentez pour un débogage plus détaillé si besoin
        return jsonify({"error": f"Erreur lors de la suppression : {e}"}), 500
    except Exception as e:
        conn.rollback()
        print(f"Erreur inattendue lors de la suppression de la facture : {e}")
        # traceback.print_exc() # Décommentez pour un débogage plus détaillé si besoin
        return jsonify({"error": f"Une erreur est survenue : {str(e)}"}), 500
    finally:
        cursor.close()
        conn.close()



@app.route('/api/factures/<int:id>', methods=['PUT'])
@token_required
# @role_required(['gestionnaire', 'approbateur']) # S'assurer que seuls ces rôles peuvent modifier
def update_facture(id):
    # Tente d'abord de récupérer du formulaire (multipart/form-data), puis du JSON
    data = request.form
    if not data:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Aucune donnée fournie ou format incorrect"}), 400

    # Récupérer les champs de la requête, y compris les nouveaux
    numero_facture = data.get('numero_facture')
    date_facture = data.get('date_facture')
    fournisseur = data.get('fournisseur')
    description = data.get('description')
    montant = data.get('montant')
    devise = data.get('devise')
    statut = data.get('statut') # Permettre la mise à jour du statut
    categorie = data.get('categorie')
    ligne_budgetaire = data.get('ligne_budgetaire')

    # Indicateur pour supprimer le fichier existant
    remove_file = data.get('remove_file', '').lower() == 'true'

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # --- Contrôle d'accès : seul le créateur ou un gestionnaire peut modifier ---
    cur.execute("SELECT id_soumetteur FROM factures WHERE id = %s", (id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Facture non trouvée"}), 404
    owner_id = row['id_soumetteur']
    # si ce n'est pas le créateur et pas un gestionnaire, on bloque
    if g.user_id != owner_id and g.user_role != 'gestionnaire':        
            return jsonify({"error": "Accès refusé: pas les droits de modification"}), 403
    # --------------------------------------------------------------------------
    try:
        # --- Début de la gestion du fichier lors de la mise à jour ---
        current_file_path = None
        new_file_path = None
        file = request.files.get('fichier') # Tenter de récupérer un nouveau fichier uploadé

        # Récupérer le chemin du fichier existant avant toute modification
        cur.execute("SELECT chemin_fichier FROM factures WHERE id = %s", (id,))
        result = cur.fetchone()
        if result:
            current_file_path = result[0]
        else:
             # Facture non trouvée, même avant de tenter le UPDATE
            return jsonify({"error": "Facture non trouvée"}), 404


        # Cas 1: Un nouveau fichier est uploadé
        if file and file.filename != '':
            # Assurer que le nom de fichier est sécurisé
            filename = secure_filename(file.filename)
            # Créer le chemin complet pour sauvegarder le nouveau fichier
            new_file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            try:
                 # Sauvegarder le nouveau fichier
                file.save(new_file_path)
                # Le chemin_fichier sera mis à jour avec new_file_path dans la requête UPDATE ci-dessous
            except Exception as e:
                print(f"Erreur lors de la sauvegarde du nouveau fichier: {e}")
                return jsonify({"error": "Échec de la sauvegarde du nouveau fichier", "details": str(e)}), 500

        # Cas 2: L'utilisateur demande la suppression du fichier existant SANS en uploader un nouveau
        elif remove_file:
             # Le chemin_fichier sera mis à NULL dans la requête UPDATE ci-dessous
             new_file_path = None # S'assurer que new_file_path est None pour la mise à jour de la DB

        # Si un nouveau fichier a été sauvegardé ou si l'utilisateur a demandé la suppression
        # et qu'il existait un fichier précédent, supprimer l'ancien fichier.
        if (new_file_path is not None or remove_file) and current_file_path and os.path.exists(current_file_path):
            try:
                os.remove(current_file_path)
                print(f"Ancien fichier supprimé: {current_file_path}")
            except Exception as e:
                 print(f"Avertissement: Échec de la suppression de l'ancien fichier {current_file_path}: {e}")
                 # Ne pas bloquer la mise à jour si la suppression de l'ancien fichier échoue

        # --- Fin de la gestion du fichier lors de la mise à jour ---


        # --- Début de la construction de la requête UPDATE ---
        updates = []
        values = []

        # Ajouter les champs si présents dans les données reçues
        if numero_facture is not None:
            updates.append("numero_facture = %s")
            values.append(numero_facture)
        if date_facture is not None:
            # Validation basique du format de la date (ajuster selon votre besoin)
            try:
                datetime.strptime(date_facture, '%Y-%m-%d')
                updates.append("date_facture = %s")
                values.append(date_facture)
            except ValueError:
                 # Supprimer le nouveau fichier sauvegardé s'il y a une erreur de date
                 if new_file_path and os.path.exists(new_file_path):
                      os.remove(new_file_path)
                 return jsonify({"error": "Format de date invalide pour la mise à jour. Utilisez AAAA-MM-JJ"}), 400
        if fournisseur is not None:
            updates.append("fournisseur = %s")
            values.append(fournisseur)
        if description is not None:
            updates.append("description = %s")
            values.append(description)
        if montant is not None:
            # Convertir le montant en Decimal
            try:
                montant = Decimal(montant)
                updates.append("montant = %s")
                values.append(montant)
            except InvalidOperation:
                 # Supprimer le nouveau fichier sauvegardé s'il y a une erreur de montant
                 if new_file_path and os.path.exists(new_file_path):
                      os.remove(new_file_path)
                 return jsonify({"error": "Format de montant invalide pour la mise à jour"}), 400
        if devise is not None:
            updates.append("devise = %s")
            values.append(devise)
        if statut is not None:
            updates.append("statut = %s")
            values.append(statut)
        # Ajouter les NOUVEAUX champs si présents
        if categorie is not None:
            updates.append("categorie = %s")
            values.append(categorie)
        if ligne_budgetaire is not None:
            updates.append("ligne_budgetaire = %s")
            values.append(ligne_budgetaire)

        # Si un nouveau fichier a été uploadé OU si la suppression a été demandée, mettre à jour chemin_fichier
        if new_file_path is not None or remove_file:
             updates.append("chemin_fichier = %s")
             values.append(new_file_path) # new_file_path sera le chemin ou None

        # Mettre à jour automatiquement last_modified_by et last_modified_timestamp
        # Crée un datetime conscient du fuseau horaire de Montréal, puis le convertit en UTC
        now_aware_local = MONTREAL_TIMEZONE.localize(datetime.now(), is_dst=None)
        last_modified_dt_utc = now_aware_local.astimezone(pytz.utc)

        updates.append("last_modified_by = %s")
        values.append(g.user_id)
        updates.append("last_modified_timestamp = %s") # <-- Utilisez un placeholder pour la date UTC
        values.append(last_modified_dt_utc) # <-- Utilisez la variable UTC


        if not updates:
            return jsonify({"message": "Aucun champ fourni pour la mise à jour"}), 400

        # Construire la requête UPDATE finale
        update_query = "UPDATE factures SET " + ", ".join(updates) + " WHERE id = %s RETURNING id;"
        values.append(id) # Ajouter l'ID de la facture à la fin des valeurs


        cur.execute(update_query, tuple(values))

        updated_row_id = cur.fetchone()
        if updated_row_id is None:
            conn.rollback()
            # Si la facture n'est pas trouvée APRES la tentative de mise à jour, supprimer le nouveau fichier si sauvegardé
            if new_file_path and os.path.exists(new_file_path):
                 os.remove(new_file_path)
            return jsonify({"error": "Facture non trouvée"}), 404

        conn.commit()

        # --- Récupérer la facture mise à jour pour l'émettre via SocketIO ---
        # Inclure tous les champs et les jointures pour les noms d'utilisateur associés
        cur.execute(
            """
            SELECT
                f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
                f.statut, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
                f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
                u.username as soumetteur_username, uc.username as created_by_username, um.username as last_modified_by_username
            FROM factures f
            JOIN users u ON f.id_soumetteur = u.id
            LEFT JOIN users uc ON f.created_by = uc.id -- Joindre pour le nom d'utilisateur de created_by
            LEFT JOIN users um ON f.last_modified_by = um.id -- Joindre pour le nom d'utilisateur de last_modified_by
            WHERE f.id = %s
            """, (id,)
        )
        updated_facture = cur.fetchone()

        if updated_facture:
            # Convertir la ligne de résultat en dictionnaire
            updated_facture_dict = dict(updated_facture)
            date_obj = updated_facture_dict.get('date_facture')
            if hasattr(date_obj, 'year'):
                updated_facture_dict['annee'] = str(date_obj.year)
            else:
                updated_facture_dict['annee'] = str(date_obj)[:4]
            socketio.emit('update_facture', updated_facture_dict)

        # --- Fin de la récupération et émission SocketIO ---

        return jsonify({"message": "Facture mise à jour avec succès"}), 200

    except psycopg2.errors.UniqueViolation:
        conn.rollback()
         # Supprimer le nouveau fichier sauvegardé s'il y a une erreur de violation unique
        if new_file_path and os.path.exists(new_file_path):
             os.remove(new_file_path)
        return jsonify({"error": f"Une facture avec le numéro {numero_facture} existe déjà."}), 409
    except Exception as e:
        conn.rollback()
         # Supprimer le nouveau fichier sauvegardé en cas d'autre erreur
        if new_file_path and os.path.exists(new_file_path):
             os.remove(new_file_path)
        print(f"Erreur de base de données lors de la mise à jour: {e}")
        return jsonify({"error": "Échec de la mise à jour de la facture.", "details": str(e)}), 500
    finally:
        cur.close()
        conn.close()



@app.route('/api/factures/export-csv', methods=['GET'])
@token_required
@role_required(['gestionnaire', 'approbateur']) # Seuls gestionnaire et approbateur peuvent exporter
def export_factures_csv():
    """
    Exporte les factures d'une année donnée au format CSV.
    - Inclut les nouvelles colonnes et les noms d'utilisateur associés.
    - Récupère toutes les factures pour l'année spécifiée.
    - Génère un fichier CSV avec les en-têtes et les données.
    - Retourne le CSV en tant que pièce jointe.
    Returns:
        Response: Fichier CSV ou message d'erreur JSON.
    """
    # Récupérer l'année depuis les arguments de la requête, par défaut l'année courante
    year = request.args.get('year', type=int, default=datetime.now().year)

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500

    # Utiliser un curseur standard car csv.writer gère l'itération sur les lignes
    cur = conn.cursor()
    try:
        # --- Requête SELECT mise à jour pour inclure les nouvelles colonnes et les noms d'utilisateur ---
        # Assurez-vous que l'ordre des colonnes ici correspond à l'ordre dans l'en-tête CSV ci-dessous
        cur.execute(
             """
            SELECT
                f.id, f.numero_facture, f.date_facture, f.fournisseur, f.description, f.montant, f.devise,
                f.statut, f.chemin_fichier, f.id_soumetteur, f.date_soumission,
                f.created_by, f.last_modified_by, f.last_modified_timestamp, f.categorie, f.ligne_budgetaire,
                u.username as soumetteur_username, uc.username as created_by_username, um.username as last_modified_by_username
            FROM factures f
            JOIN users u ON f.id_soumetteur = u.id           -- Joindre pour le nom d'utilisateur du soumetteur
            LEFT JOIN users uc ON f.created_by = uc.id        -- Joindre pour le nom d'utilisateur de created_by
            LEFT JOIN users um ON f.last_modified_by = um.id  -- Joindre pour le nom d'utilisateur de last_modified_by
            WHERE EXTRACT(YEAR FROM date_facture) = %s
            ORDER BY date_facture DESC -- Tri par date de facture
            """, (year,) # Filtrer par année
        )
        factures = cur.fetchall() # Récupérer toutes les lignes

        # Si aucune facture n'est trouvée, retourner un fichier CSV avec seulement l'en-tête
        # ou un message d'erreur selon ce qui est préféré. Ici, un en-tête vide est retourné.
        if not factures:
             header = [
                "ID", "Numero Facture", "Date Facture", "Fournisseur", "Description", "Montant", "Devise",
                "Statut", "Chemin Fichier", "ID Soumetteur", "Date Soumission",
                "Created By ID", "Last Modified By ID", "Last Modified Timestamp", "Categorie", "Ligne Budgetaire",
                "Soumetteur Username", "Created By Username", "Last Modified By Username" # Nouveaux en-têtes
            ]
             csv_buffer = io.StringIO()
             csv_writer = csv.writer(csv_buffer)
             csv_writer.writerow(header)
             output = Response(csv_buffer.getvalue(), mimetype='text/csv')
             output.headers.set("Content-Disposition", "attachment", filename=f"factures_{year}.csv")
             return output # Retourne l'en-tête CSV vide

        # --- Écrire les données dans un buffer CSV en mémoire ---
        si = io.StringIO() # Utiliser StringIO pour écrire le CSV en mémoire
        cw = csv.writer(si)

        # Écrire la ligne d'en-tête - mise à jour pour inclure les nouvelles colonnes et noms d'utilisateur
        header = [
            "ID", "Numero Facture", "Date Facture", "Fournisseur", "Description", "Montant", "Devise",
            "Statut", "Chemin Fichier", "ID Soumetteur", "Date Soumission",
            "Created By ID", "Last Modified By ID", "Last Modified Timestamp", "Categorie", "Ligne Budgetaire",
            "Soumetteur Username", "Created By Username", "Last Modified By Username" # Nouveaux en-têtes
        ]
        cw.writerow(header)

        # Écrire les lignes de données
        for row in factures:
            # Convertir les valeurs None en chaînes vides pour la compatibilité CSV
            # Assurez-vous que l'ordre des éléments dans row correspond à l'ordre de l'en-tête
            row_data = ["" if col is None else str(col) for col in row]
            cw.writerow(row_data)

        # --- Préparer la réponse HTTP avec le contenu CSV ---
        output = Response(si.getvalue(), mimetype='text/csv')
        output.headers["Content-Disposition"] = f"attachment; filename=factures_{year}.csv"
        output.headers["Content-type"] = "text/csv"
        return output # Retourne la réponse avec le fichier CSV

    except Exception as e:
        print(f"Erreur de base de données lors de l'exportation CSV : {e}")
        return jsonify({"error": "Échec de l'exportation des factures.", "details": str(e)}), 500
    finally:
        # Fermer le curseur et la connexion
        cur.close()
        conn.close()





# -------------------------------
#       Routes CRUD pour budgets
# -------------------------------

@app.route("/api/budget", methods=["GET"])
@token_required
@role_required(['gestionnaire', 'approbateur']) # Seuls gestionnaire et approbateur peuvent voir le budget
def get_budgets():
    """
    Récupère la liste des budgets pour une année financière donnée.
    - Par défaut, utilise l'année en cours si non spécifiée.
    - Retourne les budgets triés par ID (du plus récent au plus ancien).
    Returns:
        JSON: Liste des budgets ou message d'erreur.
    """
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
        print("Erreur GET /api/budget :", e)
        return jsonify({"error": "Impossible de récupérer les budgets"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget", methods=["POST"])
@token_required
@role_required(['gestionnaire']) # Seuls les gestionnaires peuvent créer des entrées budget
def create_budget():
    """
    Crée un nouveau budget.
    - Valide les champs obligatoires (année financière, type de fonds, type de revenu, montant).
    - Normalise le type de fonds via `normalize_fund_type`.
    - Insère le budget en base et notifie les clients via SocketIO.
    Returns:
        JSON: Données du budget créé ou message d'erreur.
    """
    data = request.get_json() or {}
    print("DEBUG create_budget payload:", data)

    # Validation des champs obligatoires
    for f in ("financial_year", "fund_type", "revenue_type", "amount"):
        if not data.get(f):
            return jsonify({"error": f"Le champ '{f}' est requis"}), 400

    # Normalisation du type de fonds
    try:
        data["fund_type"] = normalize_fund_type(data["fund_type"])
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Conversion du montant
    try:
        amt = float(data["amount"])
    except ValueError:
        return jsonify({"error": "Montant invalide"}), 400

    # Insertion en base
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Connexion DB impossible"}), 500
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO budgets
              (financial_year, fund_type, revenue_type, amount)
            VALUES (%s,%s,%s,%s)
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
        print("Erreur POST /api/budget :", e)
        return jsonify({"error": "Impossible de créer le budget"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget/<int:id>", methods=["PUT"])
@token_required
@role_required(['gestionnaire']) # Seuls les gestionnaires peuvent modifier des entrées budget
def update_budget(id):
    """
    Met à jour un budget existant.
    - Valide les champs modifiables (année financière, type de fonds, type de revenu, montant).
    - Normalise le type de fonds si fourni.
    - Construit dynamiquement la requête SQL pour les champs modifiés.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID du budget.
    Returns:
        JSON: Données du budget mis à jour ou message d'erreur.
    """
    data = request.get_json() or {}
    allowed = ["financial_year", "fund_type", "revenue_type", "amount"]
    fields, vals = [], []

    # Normalisation du type de fonds si présent
    if "fund_type" in data:
        try:
            data["fund_type"] = normalize_fund_type(data["fund_type"])
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    # Préparation des champs à mettre à jour
    for f in allowed:
        if f in data:
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

    # Exécution de la mise à jour
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
        print("Erreur PUT /api/budget/:id :", e)
        return jsonify({"error": "Impossible de mettre à jour le budget"}), 500

    finally:
        cur.close()
        conn.close()

@app.route("/api/budget/<int:id>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire']) # Seuls les gestionnaires peuvent supprimer des entrées budget
def delete_budget(id):
    """
    Supprime un budget existant.
    - Supprime l'entrée de la base de données.
    - Notifie les clients via SocketIO.
    Args:
        id (int): ID du budget.
    Returns:
        JSON: Message de confirmation ou erreur.
    """
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

@app.route("/api/budget/revenue-types", methods=["GET"])
@token_required # Nécessite d'être connecté pour voir les types de revenus
# Pas de rôle spécifique requis, tout utilisateur connecté peut potentiellement voir
def get_revenue_types_alias():
    """
    Retourne les types de revenus possibles pour chaque type de fonds.
    - Fournit une liste statique des types de revenus associés aux fonds 1 et 3.
    Returns:
        JSON: Dictionnaire des types de revenus par fonds.
    """
    revenue_types = {
        "Fond 1": [
            "Subvention Services à la vie étudiante",
            "Travail étudiant au compte de club pour un service ou un département",
            "Subvention au club pour la participation aux portes ouvertes",
            "Autre revenu interne"
        ],
        "Fond 3": [
            "Dons",
            "Levée de fonds",
            "Bourses d'entreprises ou d'organismes"
        ]
    }
    return jsonify(revenue_types), 200

@app.route("/api/budget/verify-pin", methods=["POST"])
@token_required # Nécessite d'être connecté pour vérifier le PIN
@role_required(['gestionnaire']) # Seuls les gestionnaires utilisent le PIN pour certaines actions budgetaires
def verify_pin():
    """
    Vérifie un code PIN fourni par l'utilisateur.
    - Compare le PIN reçu avec un PIN statique (non sécurisé, à améliorer).
    Returns:
        JSON: Résultat de la vérification (succès ou échec).
    """
    data = request.get_json() or {}
    PIN_CORRECT = "1234"  # TODO: Sécuriser en variable d'environnement
    ok = data.get("pin") == PIN_CORRECT
    return jsonify({"success": ok}), (200 if ok else 401)

@app.route("/api/register", methods=["POST"])
def register_user():
    """
    Crée un nouvel utilisateur avec le rôle par défaut 'soumetteur'.
    Requiert username, email et password.
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    email = data.get("email")

    if not username or not password or not email:
        return jsonify({"error": "Nom d'utilisateur, mot de passe et courriel requis"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()

    try:
        # Vérifier si l'utilisateur ou l'email existent déjà
        cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
        if cursor.fetchone():
            return jsonify({"error": "Nom d'utilisateur ou courriel déjà utilisé"}), 409 # Conflict

        hashed_password = hash_password(password)

        # Insérer le nouvel utilisateur avec le rôle par défaut 'soumetteur'
        # Pas besoin de spécifier le rôle ici si le DEFAULT 'soumetteur' est bien configuré dans la table
        cursor.execute(
            "INSERT INTO users (username, password_hash, email) VALUES (%s, %s, %s) RETURNING id, username, email, role",
            (username, hashed_password, email)
        )
        new_user = cursor.fetchone()
        conn.commit()

        # Retourner les informations de base du nouvel utilisateur (sans le hash du mot de passe)
        user_data = {
            "id": new_user[0],
            "username": new_user[1],
            "email": new_user[2],
            "role": new_user[3] # Le rôle retourné sera 'soumetteur' grâce au RETURNING
        }
        return jsonify(user_data), 201

    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'enregistrement de l'utilisateur: {e}")
        return jsonify({"error": "Une erreur est survenue lors de l'enregistrement"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/login", methods=["POST"])
def login():
    """
    Authentifie un utilisateur et retourne un JWT incluant son ID et son rôle.
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Nom d'utilisateur et mot de passe requis"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor()

    try:
        # Sélectionner aussi le rôle de l'utilisateur
        cursor.execute("SELECT id, password_hash, role FROM users WHERE username = %s", (username,))
        user_row = cursor.fetchone()

        if user_row and check_password(password, user_row[1]):
            user_id = user_row[0]
            user_role = user_row[2] # Récupérer le rôle

            # Générer le token incluant l'ID utilisateur et le rôle
            payload = {
                'user_id': user_id,
                'role': user_role,
                # Conversion en timestamp Unix entier
                'exp': int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp())
            }
            # Encode the token bytes to a string for the response
            token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
            expiration_timestamp = payload['exp']
            expiration_date = datetime.fromtimestamp(expiration_timestamp)
            
            print("\n=== Token généré ===")
            print(f"User ID    : {user_id}")
            print(f"Rôle       : {user_role}")
            print(f"Expiration : {expiration_date.strftime('%Y-%m-%d %H:%M:%S %Z')} (UTC)")
            print("====================\n")


            # Retourner le token et les informations de l'utilisateur (ID, rôle)
            return jsonify({"token": token, "user_id": user_id, "user_role": user_role}), 200 # JWT is now a string

        else:
            # Message d'erreur générique pour des raisons de sécurité   
            return jsonify({"error": "Identifiants invalides"}), 401

    except Exception as e:
        print(f"Erreur lors de la connexion: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la connexion"}), 500
    finally:
        cursor.close()
        conn.close()
# Ajoutez ces routes pour la gestion des utilisateurs

@app.route("/api/users", methods=["GET"])
@token_required
@role_required(['gestionnaire']) # Seuls les gestionnaires peuvent lister les utilisateurs
def get_users():
    """
    Récupère la liste de tous les utilisateurs (uniquement pour les gestionnaires).
    """
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        # Sélectionner les utilisateurs, EXCLURE le password_hash
        cursor.execute("SELECT id, username, email, role, created_at FROM users ORDER BY username")
        users = cursor.fetchall()
        # Convertir en un format JSON sérialisable
        users_list = [{key: convert_to_json_serializable(value) for key, value in dict(user).items()} for user in users]
        return jsonify(users_list), 200

    except Exception as e:
        print(f"Erreur lors de la récupération des utilisateurs: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la récupération des utilisateurs"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route("/api/users/<int:user_id>", methods=["PUT"])
@token_required
@role_required(['gestionnaire']) # Seuls les gestionnaires peuvent modifier les utilisateurs
def update_user(user_id):
    """
    Met à jour les informations d'un utilisateur (principalement le rôle) par un gestionnaire.
    """
    data = request.get_json() or {}
    # Pour cet endpoint, on s'attend principalement à mettre à jour le rôle
    new_role = data.get("role")
    # Vous pourriez ajouter la modification d'autres champs ici si nécessaire,
    # mais assurez-vous de ne pas permettre la modification du password_hash via cet endpoint sans vérification.

    if not new_role:
        return jsonify({"error": "Rôle requis pour la mise à jour"}), 400

    # Valider que le nouveau rôle est valide
    if new_role not in ['soumetteur', 'gestionnaire', 'approbateur']:
         return jsonify({"error": "Rôle invalide"}), 400

    # Optionnel mais recommandé : Empêcher un gestionnaire de modifier son propre rôle via cette route
    # Si vous voulez permettre un super-admin plus tard, cette logique devra être ajustée
    from flask import g # S'assurer que g est importé
    if g.user_id == user_id:
         return jsonify({"error": "Vous ne pouvez pas modifier votre propre rôle via cette fonction."}), 400 # Forbidden


    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cursor.execute("UPDATE users SET role = %s WHERE id = %s RETURNING id, username, email, role", (new_role, user_id))
        updated_user = cursor.fetchone()

        if not updated_user:
            return jsonify({"error": "Utilisateur non trouvé"}), 404

        conn.commit()
        user_data = {key: convert_to_json_serializable(value) for key, value in dict(updated_user).items()}
        # Potentiellement émettre un événement SocketIO pour notifier les autres clients (ex: si l'utilisateur mis à jour est connecté)

        return jsonify(user_data), 200

    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de la mise à jour de l'utilisateur {user_id}: {e}")
        return jsonify({"error": "Une erreur est survenue lors de la mise à jour de l'utilisateur"}), 500
    finally:
        cursor.close()
        conn.close()

# Vous pourriez vouloir ajouter une route DELETE /api/users/<int:user_id> pour supprimer des utilisateurs (uniquement gestionnaire)
@app.route("/api/users/<int:user_id>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])  # Seuls les gestionnaires peuvent supprimer un utilisateur
def delete_user(user_id):
    """
    Supprime un utilisateur par son ID.
    - Empêche un gestionnaire de se supprimer lui-même.
    """
    if g.user_id == user_id:
        return jsonify({"error": "Vous ne pouvez pas supprimer votre propre compte."}), 403

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Erreur de connexion à la base de données"}), 500
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Utilisateur non trouvé"}), 404
        conn.commit()
        # Optionnel : émettre un événement SocketIO pour notifier les autres clients
        socketio.emit("delete_user", {"id": user_id})
        return jsonify({"message": "Utilisateur supprimé"}), 200
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de la suppression de l'utilisateur {user_id}: {e}")
        return jsonify({"error": "Impossible de supprimer l'utilisateur"}), 500
    finally:
        cur.close()
        conn.close()
# Assurez-vous alors de gérer la suppression des factures et budgets associés si nécessaire, ou d'empêcher la suppression si des données y sont liées.

#### ENDPOINTS API POUR LA GESTION DES COMPTES DE DÉPENSES

# --- 1) CRÉER UN COMPTE ---
@app.route("/api/depense-comptes", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def create_compte_depense():
    data = request.get_json() or {}
    mode = data.get("mode")
    demandeur_prenom = data.get("demandeur_prenom")
    demandeur_nom = data.get("demandeur_nom")
    global_ubr = data.get("global_ubr")
    date_soumis = data.get("date_soumis")  # optionnel YYYY-MM-DD

    if mode not in ("global_ubr", "distinct_ubr"):
        return jsonify({"error":"mode invalide (global_ubr | distinct_ubr)"}), 400
    if mode == "global_ubr" and not global_ubr:
        return jsonify({"error":"global_ubr requis pour mode=global_ubr"}), 400
    if not demandeur_prenom or not demandeur_nom:
        return jsonify({"error":"demandeur_prenom et demandeur_nom requis"}), 400
    if date_soumis:
        try: datetime.strptime(date_soumis, "%Y-%m-%d")
        except ValueError: return jsonify({"error":"date_soumis invalide (AAAA-MM-JJ)"}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("""
            INSERT INTO public.comptes_depenses (mode, global_ubr, demandeur_prenom, demandeur_nom, date_soumis)
            VALUES (%s, %s, %s, %s, COALESCE(%s, CURRENT_DATE))
            RETURNING *;
        """, (mode, global_ubr, demandeur_prenom, demandeur_nom, date_soumis))
        row = cur.fetchone(); conn.commit()
        item = {k: convert_to_json_serializable(v) for k,v in dict(row).items()}
        socketio.emit("depense_compte_new", item, broadcast=True)
        return jsonify(item), 201
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur création compte_depense","details":str(e)}), 500
    finally:
        cur.close(); conn.close()
# --- 2) LISTER LES COMPTES ---
@app.route("/api/depense-comptes", methods=["GET"])
@token_required
@role_required(['gestionnaire'])
def list_comptes_depenses():
    q = request.args.get("q","").strip()
    mode = request.args.get("mode","").strip()
    dfrom = request.args.get("from","").strip()
    dto   = request.args.get("to","").strip()

    params, where = [], []
    if q:
        where.append("(cd.id ILIKE %s OR cd.demandeur_prenom ILIKE %s OR cd.demandeur_nom ILIKE %s)")
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]
    if mode in ("global_ubr","distinct_ubr"):
        where.append("cd.mode = %s"); params.append(mode)
    if dfrom:
        try: datetime.strptime(dfrom, "%Y-%m-%d")
        except ValueError: return jsonify({"error":"from invalide (AAAA-MM-JJ)"}), 400
        where.append("cd.date_soumis >= %s"); params.append(dfrom)
    if dto:
        try: datetime.strptime(dto, "%Y-%m-%d")
        except ValueError: return jsonify({"error":"to invalide (AAAA-MM-JJ)"}), 400
        where.append("cd.date_soumis <= %s"); params.append(dto)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(f"""
            SELECT cd.*,
                   (SELECT COUNT(*) FROM public.factures f WHERE f.compte_depense_id = cd.id) AS factures_count
            FROM public.comptes_depenses cd
            {where_sql}
            ORDER BY cd.created_at DESC, cd.id ASC;
        """, tuple(params))
        rows = cur.fetchall()
        items = [{k: convert_to_json_serializable(v) for k,v in dict(r).items()} for r in rows]
        return jsonify(items), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":"Erreur listage comptes","details":str(e)}), 500
    finally:
        cur.close(); conn.close()


# --- 3) DÉTAIL D’UN COMPTE ---
@app.route("/api/depense-comptes/<string:cid>", methods=["GET"])
@token_required
@role_required(['gestionnaire'])
def get_compte_depense(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT * FROM public.comptes_depenses WHERE id = %s", (cid,))
        row = cur.fetchone()
        if not row: return jsonify({"error":"Compte introuvable"}), 404
        cur.execute("""
            SELECT f.id, f.numero_facture, f.date_facture, f.fournisseur, f.montant, f.devise, f.statut
            FROM public.factures f
            WHERE f.compte_depense_id = %s
            ORDER BY f.date_facture DESC, f.id DESC
        """, (cid,))
        factures = cur.fetchall()
        item = {k: convert_to_json_serializable(v) for k,v in dict(row).items()}
        item["factures"] = [{k: convert_to_json_serializable(v) for k,v in dict(fr).items()} for fr in factures]
        return jsonify(item), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error":"Erreur lecture compte","details":str(e)}), 500
    finally:
        cur.close(); conn.close()



# --- 4) MODIFIER UN COMPTE ---
@app.route("/api/depense-comptes/<string:cid>", methods=["PATCH"])
@token_required
@role_required(['gestionnaire'])
def patch_compte_depense(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    data = request.get_json() or {}
    if not data: return jsonify({"error":"Aucune donnée"}), 400

    allowed = {"mode","global_ubr","demandeur_prenom","demandeur_nom","date_soumis"}
    if "mode" in data and data["mode"] not in ("global_ubr","distinct_ubr"):
        return jsonify({"error":"mode invalide"}), 400
    if "date_soumis" in data:
        try: datetime.strptime(str(data["date_soumis"]), "%Y-%m-%d")
        except ValueError: return jsonify({"error":"date_soumis invalide (AAAA-MM-JJ)"}), 400

    sets, vals = [], []
    for k,v in data.items():
        if k in allowed:
            sets.append(f"{k} = %s"); vals.append(v)
    if not sets: return jsonify({"error":"Aucun champ modifiable"}), 400

    if ("mode" in data and data["mode"] == "global_ubr") and (not data.get("global_ubr")):
        return jsonify({"error":"global_ubr requis lorsque mode=global_ubr"}), 400

    sets.append("updated_at = now() at time zone 'utc'")
    vals.append(cid)

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(f"UPDATE public.comptes_depenses SET {', '.join(sets)} WHERE id = %s RETURNING *;", vals)
        row = cur.fetchone()
        if not row: return jsonify({"error":"Compte introuvable"}), 404
        conn.commit()
        item = {k: convert_to_json_serializable(v) for k,v in dict(row).items()}
        socketio.emit("depense_compte_update", item, broadcast=True)
        return jsonify(item), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur mise à jour compte","details":str(e)}), 500
    finally:
        cur.close(); conn.close()


# --- 5) SUPPRIMER UN COMPTE ---
@app.route("/api/depense-comptes/<string:cid>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def delete_compte_depense(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("DELETE FROM public.comptes_depenses WHERE id = %s RETURNING %s;", (cid, cid))
        gone = cur.fetchone()
        if not gone: return jsonify({"error":"Compte introuvable"}), 404
        conn.commit()
        socketio.emit("depense_compte_delete", {"id": cid}, broadcast=True)
        return jsonify({"deleted_id": cid}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur suppression compte","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# --- 6) ATTACHER PLUSIEURS FACTURES ---
@app.route("/api/depense-comptes/<string:cid>/factures", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def attach_factures_to_compte(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    data = request.get_json() or {}
    ids = data.get("facture_ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error":"facture_ids doit être une liste non vide"}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT 1 FROM public.comptes_depenses WHERE id = %s", (cid,))
        if not cur.fetchone(): return jsonify({"error":"Compte introuvable"}), 404

        cur.execute("""
            UPDATE public.factures
            SET compte_depense_id = %s
            WHERE id = ANY(%s)
            RETURNING id;
        """, (cid, ids))
        changed = [r[0] for r in cur.fetchall()]
        conn.commit()

        for fid in changed:
            socketio.emit("update_facture", {"id": fid}, broadcast=True)
        return jsonify({"attached": changed, "count": len(changed)}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur d’attache des factures","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# --- 6) ATTACHER PLUSIEURS FACTURES ---
@app.route("/api/depense-comptes/<string:cid>/factures", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def attach_factures_to_compte(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    data = request.get_json() or {}
    ids = data.get("facture_ids") or []
    if not isinstance(ids, list) or not ids:
        return jsonify({"error":"facture_ids doit être une liste non vide"}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT 1 FROM public.comptes_depenses WHERE id = %s", (cid,))
        if not cur.fetchone(): return jsonify({"error":"Compte introuvable"}), 404

        cur.execute("""
            UPDATE public.factures
            SET compte_depense_id = %s
            WHERE id = ANY(%s)
            RETURNING id;
        """, (cid, ids))
        changed = [r[0] for r in cur.fetchall()]
        conn.commit()

        for fid in changed:
            socketio.emit("update_facture", {"id": fid}, broadcast=True)
        return jsonify({"attached": changed, "count": len(changed)}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur d’attache des factures","details":str(e)}), 500
    finally:
        cur.close(); conn.close()
# --- 7) DÉTACHER UNE FACTURE ---
@app.route("/api/depense-comptes/<string:cid>/factures/<int:fid>", methods=["DELETE"])
@token_required
@role_required(['gestionnaire'])
def detach_facture_from_compte(cid, fid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE public.factures
            SET compte_depense_id = NULL
            WHERE id = %s AND compte_depense_id = %s
            RETURNING id;
        """, (fid, cid))
        row = cur.fetchone()
        if not row:
            return jsonify({"error":"Aucune facture détachée (id inexistant ou non liée à ce compte)"}), 404
        conn.commit()
        socketio.emit("update_facture", {"id": fid}, broadcast=True)
        return jsonify({"detached_id": fid}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur de détache","details":str(e)}), 500
    finally:
        cur.close(); conn.close()

# --- 8) APPLIQUER L’UBR GLOBAL ---
@app.route("/api/depense-comptes/<string:cid>/appliquer-global-ubr", methods=["POST"])
@token_required
@role_required(['gestionnaire'])
def apply_global_ubr(cid):
    if not re.match(r"^HABITEK\d{3,}$", cid):
        return jsonify({"error":"id invalide (HABITEK###)"}), 400
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute("SELECT mode, global_ubr FROM public.comptes_depenses WHERE id = %s", (cid,))
        row = cur.fetchone()
        if not row: return jsonify({"error":"Compte introuvable"}), 404
        if row["mode"] != "global_ubr" or not row["global_ubr"]:
            return jsonify({"error":"Ce compte n'est pas en mode global_ubr ou global_ubr manquant"}), 400

        cur.execute("""
            UPDATE public.factures
            SET ubr = %s
            WHERE compte_depense_id = %s
            RETURNING id;
        """, (row["global_ubr"], cid))
        changed = [r[0] for r in cur.fetchall()]
        conn.commit()

        for fid in changed:
            socketio.emit("update_facture", {"id": fid}, broadcast=True)
        return jsonify({"updated_count": len(changed), "facture_ids": changed, "applied_ubr": row["global_ubr"]}), 200
    except Exception as e:
        conn.rollback(); traceback.print_exc()
        return jsonify({"error":"Erreur application UBR global","details":str(e)}), 500
    finally:
        cur.close(); conn.close()





if __name__ == '__main__':
    """
    Point d'entrée de l'application.
    - Lance le serveur Flask avec SocketIO sur le port spécifié (par défaut 5000).
    - Accepte les connexions depuis toutes les interfaces réseau (0.0.0.0).
    """
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
