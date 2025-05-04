
CREATE TABLE IF NOT EXISTS factures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annee INTEGER,
  type TEXT,
  ubr TEXT,
  fournisseur TEXT,
  description TEXT,
  montant REAL,
  statut TEXT,
  fichier_nom TEXT,
  numero INTEGER,
  date_ajout TEXT
);
