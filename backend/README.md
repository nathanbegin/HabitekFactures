
# Habitek Trésorerie — Guide d’utilisation de l’API

Backend Flask + PostgreSQL + Socket.IO (temps réel) pour la gestion des **budgets**, **comptes de dépenses (CDD)** et **factures**.

---

## 🧰 Prérequis

- **Python 3.9+**
- **PostgreSQL 12+**
- Accès réseau au serveur Postgres (ou local)
- Outils build (si `psycopg2` compile depuis sources)

---

## 🚀 Installation & Démarrage

1) **Cloner & créer l’environnement**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

2) **Configurer la base de données**

- Variable **`DATABASE_URL`** (ou valeur par défaut dans le code) :
  - Exemple : `postgresql://minio:Habitek2025@localhost:5432/habitek_tresorerie`

> Si l’utilisateur n’a pas le droit de créer la DB : créez-la manuellement (en `psql` en tant que superuser) puis relancez le script.

3) **Initialiser le schéma**

```bash
python backend/create_database.py
```

4) **Démarrer l’API**

- Dev simple :
  ```bash
  FLASK_DEBUG=1 python app.py
  ```
- Dev/Prod avec workers Socket.IO :
  ```bash
  gunicorn -k eventlet -w 1 app:app
  ```

5) **(Optionnel) Configuration du stockage**

- Variable / constante : `APP_STORAGE_ROOT`
  - Recommandé : un chemin absolu, p. ex. `uploads/` à côté de `app.py`.
- Arborescence générée automatiquement :
  - `APP_STORAGE_ROOT/cdd/<FY>/...`
  - `APP_STORAGE_ROOT/factures/<FY>/...`

> FY = **année financière** : du **1er mai** au **30 avril** (ex. FY **2025** = 1 mai 2024 → 30 avril 2025).

6) **(Optionnel) PIN Budget**

- Version simple (hardcodé dans `app.py`) : `BUDGET_PIN = "123456"`

---

## 🔐 Authentification (JWT)

- `POST /api/login` renvoie un **token JWT**.
- Envoyer `Authorization: Bearer <token>` sur toutes les routes protégées.
- `POST /api/register` est **public** pour l’inscription.

---

## 📡 WebSocket (temps réel)

- **URL** : même origine que l’API (ex. `http://localhost:5000`)
- **Namespace** : `/`
- Événements émis :
  - `user.created`, `user.updated`, `user.deleted`
  - `budget.created`, `budget.updated`, `budget.deleted`
  - `cdd.created`, `cdd.updated`, `cdd.deleted`, `cdd.attachment.added`
  - `facture.created`, `facture.updated`, `facture.deleted`

Exemple Client JS :
```js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000", { transports: ["websocket"] });
socket.on("connect", () => console.log("WS connected"));
["budget.created","budget.updated","budget.deleted",
 "cdd.created","cdd.updated","cdd.deleted","cdd.attachment.added",
 "facture.created","facture.updated","facture.deleted",
 "user.created","user.updated","user.deleted"
].forEach(evt => socket.on(evt, payload => console.log("WS", evt, payload)));
```

---

## 🧪 Testeur d’API (script)

Un script de test automatisé couvre tous les endpoints, y compris les événements temps réel : **`api_tester.py`**.

Exemple d’exécution :
```bash
python3 api_tester.py \
  --base-url http://localhost:5000 \
  --register-public \
  --prenom Alice --nom Dupont \
  --email alice@example.org --password Test1234 \
  --budget-pin 123456 \
  --ws \
  --cleanup-mode ask
```

- `--cleanup-mode ask|yes|no` : propose/supprime les données créées et **teste les DELETE** (ordre : factures → CDD → budgets).

---

## 📚 Endpoints

### Santé
#### `GET /api/health` (public)
- **200** → `{"status":"ok"}`

---

### Authentification
#### `POST /api/register` (public)
**Body JSON**
```json
{ "prenom":"Alice", "nom":"Dupont", "courriel":"alice@example.org", "password":"Test1234" }
```
**Réponses**
- **201** → `{"token":"<JWT>","user":{...}}` + WS `user.created`
- **409** → `{"error":"Utilisateur existe déjà"}`

#### `POST /api/login` (public)
**Body JSON** `{"email":"alice@example.org","password":"Test1234"}`  
**200** → `{"token":"<JWT>","user":{...}}`

---

### Budget — Vérification PIN
#### `POST /api/budget/verify-pin` (JWT)
**Body JSON** `{"pin":"123456"}`  
**200** → `{"valid":true}`  |  **401** → `{"valid":false}`  |  **400** → `{"error":"pin requis"}`

---

### Budgets
#### `POST /api/budgets` (JWT)
**Body JSON**
```json
{
  "financial_year":"2025",
  "fund_type":"Fonctionnement",
  "revenue_type":"Cotisations",
  "amount":12345.67
}
```
**201** → objet budget + WS `budget.created`

#### `GET /api/budgets` (JWT)
Params : `?fy=2025` (optionnel)  
**200** → `[{...}]`

#### `GET /api/budgets/fund-types` (JWT)
**200** → `["Fonctionnement", ...]`

#### `GET /api/budgets/revenue-types` (JWT)
**200** → `["Cotisations", ...]`

#### `GET /api/budgets/summary` (JWT)
Params : `?fy=2025` (optionnel)  
**200** → `{ "filter_financial_year":"2025", "totals":..., "by_fund_type":[...], "by_revenue_type":[...] }`

#### `PATCH /api/budgets/{id}` (JWT)
**Body JSON** (ex.) `{"amount":23456.78}`  
**200** → objet mis à jour + WS `budget.updated`

#### `DELETE /api/budgets/{id}` (JWT)
**200** → `{"deleted":true}` + WS `budget.deleted`

---

### Comptes de dépenses (CDD)
#### `POST /api/depense-comptes` (JWT)
**Body JSON**
```json
{
  "mode":"virement",
  "type_cdd_int":0,
  "prénom_demandeur":"Jean",
  "nom_demandeur":"Valjean",
  "date_soumis":"2025-09-29"
}
```
**201** → CDD + WS `cdd.created`

#### `GET /api/depense-comptes` (JWT)
Params : `?fy=2025` (optionnel), `?q=...` (optionnel)  
**200** → `[{...}]`

#### `GET /api/depense-comptes/{cid}` (JWT)
**200** → CDD

#### `POST /api/depense-comptes/{cid}/pieces` (JWT, multipart/form-data)
Champ fichier : `fichier=@/chemin/vers/doc.pdf`  
**201** → `{ "file_index":1, "path": "...", "message":"Pièce ajoutée" }` + WS `cdd.attachment.added`

#### `GET /api/depense-comptes/{cid}/pieces` (JWT)
**200** → `[ { "file_index":1, "filename":"...", "size":..., "generated":false }, ... ]`

#### `GET /api/depense-comptes/{cid}/pieces/{index}` (JWT)
**200** → binaire `application/pdf`

#### `POST /api/depense-comptes/{cid}/generated-pdf` (JWT)
**Body JSON** `{"pdf_base64":"<BASE64>"}`  
**201** → `{ "file_index":2, "generated":true, ... }` + WS `cdd.attachment.added`

#### `PATCH /api/depense-comptes/{cid}` (JWT)
**Body JSON** (ex.) `{"mode":"cheque","type_cdd_int":1}`  
**200** → CDD mis à jour + WS `cdd.updated`

#### `DELETE /api/depense-comptes/{cid}` (JWT)
**200** → `{"deleted":true}` + WS `cdd.deleted`  
> ⚠️ Supprimer d’abord les **factures** qui référencent ce CDD (`ref_cdd`).

---

### Factures
#### `POST /api/factures` (JWT, multipart/form-data)
Champs **texte** :
- `date_facture` (YYYY-MM-DD)
- `fournisseur`, `description`
- `montant` (ex. `"57.90"`), `devise` (ex. `"CAD"`), `statut`
- `ref_cdd` (optionnel, CID d’un CDD existant)

Champ **fichier** : `fichier=@/chemin/vers/facture.pdf`

**201** → objet facture + WS `facture.created`

#### `GET /api/factures` (JWT)
Params : `?fy=2025` (optionnel)  
**200** → `[{...}]`

#### `GET /api/factures/{id}/pieces` (JWT)
**200** → `[{"file_index":1,"filename":"...","size":...}]`

#### `GET /api/factures/{id}/pieces/{index}` (JWT)
**200** → binaire `application/pdf`

#### `PATCH /api/factures/{id}` (JWT)
**Body JSON** (ex.) `{"statut":"approuvée"}`  
**200** → facture mise à jour + WS `facture.updated`

#### `DELETE /api/factures/{id}` (JWT)
**200** → `{"deleted":true}` + WS `facture.deleted`

---

### Utilisateurs
#### `PATCH /api/users/{uid}/password` (JWT)
**Body JSON** `{"password":"NewPass123"}`  
**200** → `{"updated":true}` + WS `user.updated`

---

## ⚠️ Codes d’erreur (format)

- **400** Bad Request → `{"error":"...", "details":"..."}`
- **401** Unauthorized → `{"error":"..."}` ou `{"valid": false}`
- **403** Forbidden → `{"error":"..."}`
- **404** Not Found → `{"error":"..."}`
- **409** Conflict → `{"error":"..."}`
- **500** Internal Server Error → `{"error":"...", "details":"..."}`

---

## 🗂️ Stockage des fichiers

- **CDD** : `APP_STORAGE_ROOT/cdd/<FY>/<CID>_Nom_Prenom_##.pdf`
- **Factures** : `APP_STORAGE_ROOT/factures/<FY>/F<FY>_<ID>_##.pdf`
- **PDF générés** (CDD) marqués `generated: true` dans les métadonnées.

> Si `uploads/` existe déjà, l’app **réutilise** le dossier (création récursive si manquant).

---

## 🧯 Dépannage (FAQ)

- **`permission denied to create database`**  
  → Créez la base manuellement via un rôle superuser, ou donnez le droit `CREATEDB` au rôle utilisé.

- **`Server.emit() got an unexpected keyword argument 'broadcast'`**  
  → En Flask-SocketIO 5.x, retirez `broadcast=True` et utilisez simplement `socketio.emit("evt", payload, namespace="/")`.

- **`fk_factures_ref_cdd` violée** lors de la création/suppression  
  → Ne **supprimez pas** un CDD référencé par des factures ; supprimez d’abord les factures.

---

## 📄 Licence

Interne Habitek — usage privé.
