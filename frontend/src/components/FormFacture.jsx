// src/components/FormFacture.jsx
import React, { useEffect, useMemo, useState } from 'react';

// Options “métier” (adapte si besoin)
const TYPE_OPTIONS = ['Matériaux', 'Services'];
const STATUT_OPTIONS = ['Soumis', 'Approuve', 'Rejete', 'Paye'];
const DEVISES = ['CAD', 'USD', 'EUR'];

export default function FormFacture({
  // en création: onSubmit reçoit un FormData (multipart)
  // en édition: onSubmit reçoit un objet JSON “patch”
  onSubmit,
  // données existantes en édition
  initialData = null,
  // force le mode édition
  isEditMode = false,
  // props éventuelles utilisées en création
  annee,
  setAnnee,
}) {
  // Helper pour normaliser la date → 'YYYY-MM-DD'
  const toInputDate = (isoOrSql) => {
    if (!isoOrSql) return '';
    try {
      const d = new Date(isoOrSql);
      if (Number.isNaN(d.getTime())) return '';
      // À cause des TZ, mieux vaut lire les 10 premiers chars si déjà 'YYYY-MM-DD'
      const raw = String(isoOrSql);
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  // État des champs (création par défaut, écrasé par initialData en édition)
  const [numeroFacture, setNumeroFacture] = useState('');
  const [dateFacture, setDateFacture] = useState('');
  const [typeFacture, setTypeFacture] = useState(TYPE_OPTIONS[0]);
  const [ubr, setUbr] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState('');
  const [devise, setDevise] = useState(DEVISES[0]);
  const [statut, setStatut] = useState(STATUT_OPTIONS[0]);
  const [categorie, setCategorie] = useState('');
  const [ligneBudgetaire, setLigneBudgetaire] = useState('');

  // Création uniquement : fichier
  const [fichier, setFichier] = useState(null);

  // Nom du fichier actuel (édition)
  const currentFilename = useMemo(() => {
    if (!initialData?.chemin_fichier) return '';
    const parts = String(initialData.chemin_fichier).split('/');
    return parts[parts.length - 1] || '';
  }, [initialData]);

  // Pré-remplissage en édition
  useEffect(() => {
    if (!isEditMode || !initialData) return;

    setNumeroFacture(initialData.numero_facture ?? '');
    setDateFacture(toInputDate(initialData.date_facture));
    setTypeFacture(initialData.type_facture ?? TYPE_OPTIONS[0]);
    setUbr(initialData.ubr ?? '');
    setFournisseur(initialData.fournisseur ?? '');
    setDescription(initialData.description ?? '');
    setMontant(initialData.montant != null ? String(initialData.montant) : '');
    setDevise(initialData.devise ?? DEVISES[0]);
    setStatut(initialData.statut ?? STATUT_OPTIONS[0]);
    setCategorie(initialData.categorie ?? '');
    setLigneBudgetaire(initialData.ligne_budgetaire ?? '');
    setFichier(null); // on n’édite pas la PJ ici
  }, [isEditMode, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isEditMode) {
      // → PATCH JSON (sans numero_facture)
      const patch = {
        date_facture: dateFacture || null,
        type_facture: typeFacture || null,
        ubr: ubr || null,
        fournisseur: fournisseur || null,
        description: description || null,
        montant: montant || null,
        devise: devise || null,
        statut: statut || null,
        categorie: categorie || null,
        ligne_budgetaire: ligneBudgetaire || null,
      };
      onSubmit(patch);
      return;
    }

    // → Création : multipart (numero auto en DB, ne pas l’envoyer)
    const fd = new FormData();
    if (annee) fd.append('annee', annee);

    fd.append('date_facture', dateFacture);
    fd.append('type', typeFacture); // POST backend lit “type” (alias de type_facture)
    fd.append('ubr', ubr);
    fd.append('fournisseur', fournisseur);
    fd.append('description', description);
    fd.append('montant', montant);
    fd.append('devise', devise);
    fd.append('statut', statut);
    fd.append('categorie', categorie);
    fd.append('ligne_budgetaire', ligneBudgetaire);
    if (fichier) fd.append('fichier', fichier);

    onSubmit(fd);
    // reset minimal si besoin
    // set… (au besoin)
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* En création, tu peux garder un champ année si tu veux l’afficher */}
      {!isEditMode && typeof annee !== 'undefined' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Année</label>
          <input
            type="number"
            value={annee}
            onChange={(e) => setAnnee?.(e.target.value)}
            className="mt-1 w-full border rounded p-2"
          />
        </div>
      )}

      {/* numero_facture visible mais non éditable en édition */}
      {isEditMode && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Numéro de facture</label>
          <input
            type="text"
            value={numeroFacture}
            disabled
            className="mt-1 w-full border rounded p-2 bg-gray-100 cursor-not-allowed"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Date de facture</label>
        <input
          type="date"
          value={dateFacture}
          onChange={(e) => setDateFacture(e.target.value)}
          required
          className="mt-1 w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <select
          value={typeFacture}
          onChange={(e) => setTypeFacture(e.target.value)}
          className="mt-1 w-full border rounded p-2"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">UBR (optionnel)</label>
        <input
          type="text"
          value={ubr}
          onChange={(e) => setUbr(e.target.value)}
          className="mt-1 w-full border rounded p-2"
          placeholder="HABITEK123..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Fournisseur</label>
        <input
          type="text"
          value={fournisseur}
          onChange={(e) => setFournisseur(e.target.value)}
          required
          className="mt-1 w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full border rounded p-2"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Montant</label>
          <input
            type="number"
            step="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
            className="mt-1 w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Devise</label>
          <select
            value={devise}
            onChange={(e) => setDevise(e.target.value)}
            className="mt-1 w-full border rounded p-2"
          >
            {DEVISES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Le statut peut être modifié en édition (gestionnaire/approbateur),
          En création tu peux le laisser à "Soumis" par défaut */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Statut</label>
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="mt-1 w-full border rounded p-2"
        >
          {STATUT_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Catégorie</label>
          <input
            type="text"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className="mt-1 w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Ligne budgétaire</label>
          <input
            type="text"
            value={ligneBudgetaire}
            onChange={(e) => setLigneBudgetaire(e.target.value)}
            className="mt-1 w-full border rounded p-2"
          />
        </div>
      </div>

      {/* Création : upload ; Édition : on affiche juste le nom du fichier actuel */}
      {!isEditMode ? (
        <div>
          <label className="block text-sm font-medium text-gray-700">Pièce jointe (optionnel)</label>
          <input
            type="file"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700">Pièce jointe actuelle</label>
          <div className="mt-1 w-full border rounded p-2 bg-gray-50 text-sm">
            {currentFilename || '—'}
          </div>
          {/* Si tu ajoutes plus tard un endpoint dédié pour changer la PJ,
              on pourra ajouter un input file ici et appeler cet endpoint séparément. */}
        </div>
      )}

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        {isEditMode ? 'Enregistrer les modifications' : 'Ajouter la facture'}
      </button>
    </form>
  );
}
