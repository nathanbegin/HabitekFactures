
# Application de gestion de factures — Club Habitec

## Structure
- `backend/`: Contient le serveur Flask
- `uploads/`: Dossier de stockage des fichiers PDF
- `databases/`: Une base SQLite par année
- `templates/schema.sql`: Schéma de base de données utilisé pour chaque nouvelle année
- `frontend/`: Application React minimaliste

## Installation
### Backend (Flask)
1. Installer les dépendances :
   pip install flask flask-cors

2. Lancer le serveur :
   python backend/app.py

### Frontend (React)
1. Installer les dépendances :
   npm install

2. Lancer :
   npm run dev

## Fonctionnalités
- Ajout, lecture, téléchargement de factures PDF
- Une base de données distincte par année
- Auto-création des bases à partir du modèle `schema.sql`
