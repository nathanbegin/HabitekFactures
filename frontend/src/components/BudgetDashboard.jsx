/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// -----------------------------------
// Initialisation de Chart.js
// -----------------------------------

// Enregistrement des composants nécessaires pour les graphiques en anneau
ChartJS.register(ArcElement, Tooltip, Legend);

// -----------------------------------
// Fonctions Utilitaires
// -----------------------------------

/**
 * Formate une valeur monétaire en dollars avec deux décimales et séparation des milliers.
 * @param {number|string} value - Valeur à formater (peut être une chaîne ou un nombre).
 * @returns {string} Valeur formatée (ex: "1 234.56$" ou "-1 234.56$").
 */
export function formatCurrency(value) {
  const v = Number(value) || 0;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  // Force deux décimales et sépare les milliers par un espace
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${withThousands}.${decPart}$`;
}

// -----------------------------------
// Composant PinModal
// -----------------------------------

/**
 * Modale pour saisir et vérifier un code PIN avant d'exécuter une action protégée.
 * Affiche un champ de saisie pour le PIN et des boutons pour valider ou annuler.
 * @param {Object} props - Propriétés du composant.
 * @param {boolean} props.show - Indique si la modale doit être affichée.
 * @param {Function} props.onVerify - Fonction appelée avec le PIN saisi lors de la soumission.
 * @param {Function} props.onCancel - Fonction appelée pour fermer la modale sans action.
 * @param {string} props.actionLabel - Étiquette décrivant l'action (ex: "ajouter", "modifier").
 * @returns {JSX.Element|null} Modale JSX ou null si non affichée.
 */
function PinModal({ show, onVerify, onCancel, actionLabel }) {
  // État pour stocker le PIN saisi
  const [inputPin, setInputPin] = useState('');

  /**
   * Gère la soumission du formulaire de PIN.
   * - Empêche le rechargement de la page.
   * - Appelle onVerify avec le PIN saisi.
   * - Réinitialise le champ de saisie.
   * @param {Object} e - Événement de soumission du formulaire.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    onVerify(inputPin);
    setInputPin(''); // Réinitialise le champ après soumission
  };

  // Ne rend rien si la modale n'est pas affichée
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Entrer le PIN pour {actionLabel}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <input
            type="password"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            className="p-2 border rounded w-full"
            placeholder="PIN"
            required
          />
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Vérifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------
// Composant BudgetDashboard
// -----------------------------------

/**
 * Tableau de bord pour la gestion budgétaire.
 * Affiche des graphiques de répartition des fonds et des dépenses, un formulaire pour ajouter des entrées,
 * et une liste des entrées budgétaires avec options de modification et suppression.
 * @param {Object} props - Propriétés du composant.
 * @param {string} props.anneeFinanciere - Année financière courante.
 * @param {Function} props.fetchBudget - Fonction pour récupérer les données budgétaires.
 * @param {Function} props.addBudgetEntry - Fonction pour ajouter une entrée budgétaire.
 * @param {Function} props.updateBudgetEntry - Fonction pour mettre à jour une entrée budgétaire.
 * @param {Function} props.deleteBudgetEntry - Fonction pour supprimer une entrée budgétaire.
 * @param {Function} props.verifyPin - Fonction pour vérifier un code PIN.
 * @param {Array} props.factures - Liste des factures (non utilisée directement, remplacée par localFactures).
 * @returns {JSX.Element} Tableau de bord JSX.
 */
function BudgetDashboard({
  anneeFinanciere,
  fetchBudget,
  addBudgetEntry,
  updateBudgetEntry,
  deleteBudgetEntry,
  verifyPin,
  factures,
}) {
  // -----------------------------------
  // Gestion des États
  // -----------------------------------

  // Liste des entrées budgétaires
  const [budgetEntries, setBudgetEntries] = useState([]);
  // Types de revenus par fond
  const [revenueTypes, setRevenueTypes] = useState({});
  // Indique si le formulaire d'ajout est actif
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  // Données du formulaire pour une nouvelle entrée
  const [newEntryData, setNewEntryData] = useState({
    fund_type: 'Fond 1',
    revenue_type: '',
    amount: '',
  });
  // ID de l'entrée en cours de modification
  const [editingEntryId, setEditingEntryId] = useState(null);
  // Données de l'entrée en cours de modification
  const [editedEntryData, setEditedEntryData] = useState(null);
  // Indique si la modale PIN est affichée
  const [showPinModal, setShowPinModal] = useState(false);
  // Action protégée par PIN (add, edit, delete)
  const [pinAction, setPinAction] = useState(null);
  // Entrée associée à l'action protégée
  const [pinEntryToModify, setPinEntryToModify] = useState(null);
  // Liste locale des factures pour l'année financière
  const [localFactures, setLocalFactures] = useState([]);

  // -----------------------------------
  // Constantes
  // -----------------------------------

  // URL de l'API pour les requêtes
  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  // -----------------------------------
  // Chargement des Données
  // -----------------------------------

  /**
   * Charge les données budgétaires, les factures, et les types de revenus au montage et à chaque changement d'année financière.
   * - Récupère les entrées budgétaires via fetchBudget.
   * - Récupère les factures pour l'année financière courante.
   * - Récupère les types de revenus pour les fonds.
   */
  useEffect(() => {
    // Chargement des données budgétaires
    fetchBudget(anneeFinanciere).then((data) => {
      if (data) {
        // Conversion des montants en nombres flottants
        const processed = data.map((e) => ({
          ...e,
          amount: parseFloat(e.amount),
        }));
        setBudgetEntries(processed);
      } else {
        setBudgetEntries([]);
      }
    });

    // Chargement des factures
    fetch(`${API_URL}/api/factures?annee=${anneeFinanciere}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data) =>
        setLocalFactures(
          data.map((f) => ({
            ...f,
            montant: parseFloat(f.montant),
          }))
        )
      )
      .catch(() => setLocalFactures([]));

    /**
     * Récupère les types de revenus pour chaque fond.
     * - Met à jour l'état revenueTypes avec les données reçues.
     * - Définit un type de revenu par défaut pour le formulaire d'ajout.
     */
    const fetchRevenueTypes = async () => {
      try {
        const res = await fetch(`${API_URL}/api/budget/revenue-types`);
        if (!res.ok) throw new Error(`Erreur HTTP ! statut: ${res.status}`);
        const data = await res.json();
        setRevenueTypes(data);
        if (data['Fond 1'] && data['Fond 1'].length > 0) {
          setNewEntryData((prev) => ({ ...prev, revenue_type: data['Fond 1'][0] }));
        }
      } catch (e) {
        console.error('Erreur lors de la récupération des types de revenus :', e);
        alert('Erreur lors du chargement des types de revenus.');
      }
    };
    fetchRevenueTypes();
  }, [anneeFinanciere, fetchBudget, API_URL]);

  // -----------------------------------
  // Gestion des Formulaires
  // -----------------------------------

  /**
   * Gère les changements dans le formulaire d'ajout d'entrée budgétaire.
   * - Met à jour l'état newEntryData avec la nouvelle valeur.
   * - Si le type de fond change, met à jour le type de revenu par défaut.
   * @param {Object} e - Événement de changement (input ou select).
   */
  const handleNewEntryChange = (e) => {
    const { name, value } = e.target;
    setNewEntryData((prev) => ({ ...prev, [name]: value }));
    if (name === 'fund_type') {
      const newFundTypes = revenueTypes[value] || [];
      setNewEntryData((prev) => ({
        ...prev,
        revenue_type: newFundTypes.length > 0 ? newFundTypes[0] : '',
      }));
    }
  };

  /**
   * Gère les changements dans le formulaire de modification d'entrée budgétaire.
   * - Met à jour l'état editedEntryData avec la nouvelle valeur.
   * - Si le type de fond change, met à jour le type de revenu par défaut.
   * @param {Object} e - Événement de changement (input ou select).
   */
  const handleEditedEntryChange = (e) => {
    const { name, value } = e.target;
    setEditedEntryData((prev) => {
      const updatedData = { ...prev, [name]: value };
      if (name === 'fund_type') {
        const newFundTypes = revenueTypes[value] || [];
        updatedData.revenue_type = newFundTypes.length > 0 ? newFundTypes[0] : '';
      }
      return updatedData;
    });
  };

  // -----------------------------------
  // Gestion du PIN
  // -----------------------------------

  /**
   * Demande une vérification de PIN pour une action protégée.
   * - Configure l'action et l'entrée concernée, puis affiche la modale PIN.
   * @param {string} action - Action à protéger ('add', 'edit', 'delete').
   * @param {Object|number|null} entry - Données de l'entrée ou ID pour l'action (optionnel).
   */
  const requestPin = (action, entry = null) => {
    setPinAction(action);
    setPinEntryToModify(entry);
    setShowPinModal(true);
  };

  /**
   * Gère la vérification du PIN saisi.
   * - Vérifie le PIN via verifyPin.
   * - Exécute l'action correspondante si le PIN est correct.
   * - Affiche une erreur si le PIN est incorrect.
   * @param {string} inputPin - PIN saisi par l'utilisateur.
   * @returns {Promise<void>}
   */
  const handlePinVerified = async (inputPin) => {
    const isCorrect = await verifyPin(inputPin);
    if (isCorrect) {
      setShowPinModal(false);
      if (pinAction === 'add') {
        executeAddEntry();
      } else if (pinAction === 'edit') {
        executeEditEntry(pinEntryToModify);
      } else if (pinAction === 'delete') {
        executeEditEntry(pinEntryToModify);
      }
    } else {
      alert('PIN incorrect.');
    }
    resetPinFlow();
  };

  /**
   * Annule la saisie du PIN et ferme la modale.
   * - Réinitialise les états liés au PIN.
   */
  const handlePinCancel = () => {
    setShowPinModal(false);
    resetPinFlow();
  };

  /**
   * Réinitialise les états liés à la vérification du PIN.
   * - Efface l'action et l'entrée concernée.
   */
  const resetPinFlow = () => {
    setPinAction(null);
    setPinEntryToModify(null);
  };

  // -----------------------------------
  // Exécution des Actions
  // -----------------------------------

  /**
   * Ajoute une nouvelle entrée budgétaire.
   * - Appelle addBudgetEntry avec les données du formulaire.
   * - Réinitialise le formulaire et recharge les données budgétaires en cas de succès.
   * @returns {Promise<void>}
   */
  const executeAddEntry = async () => {
    const success = await addBudgetEntry(newEntryData);
    if (success) {
      setIsAddingEntry(false);
      setNewEntryData({
        fund_type: 'Fond 1',
        revenue_type:
          revenueTypes['Fond 1'] && revenueTypes['Fond 1'].length > 0
            ? revenueTypes['Fond 1'][0]
            : '',
        amount: '',
      });
      fetchBudget(anneeFinanciere).then((data) => {
        if (data) {
          const processedData = data.map((entry) => ({
            ...entry,
            amount: parseFloat(entry.amount),
          }));
          setBudgetEntries(processedData);
        } else {
          setBudgetEntries([]);
        }
      });
    }
  };

  /**
   * Met à jour une entrée budgétaire existante.
   * - Appelle updateBudgetEntry avec les données modifiées.
   * - Réinitialise le mode édition et recharge les données en cas de succès.
   * @param {Object} editedData - Données modifiées de l'entrée.
   * @returns {Promise<void>}
   */
  const executeEditEntry = async (editedData) => {
    const success = await updateBudgetEntry(editingEntryId, editedData);
    if (success) {
      setEditingEntryId(null);
      setEditedEntryData(null);
      fetchBudget(anneeFinanciere).then((data) => {
        if (data) {
          const processedData = data.map((entry) => ({
            ...entry,
            amount: parseFloat(entry.amount),
          }));
          setBudgetEntries(processedData);
        } else {
          setBudgetEntries([]);
        }
      });
    }
  };

  /**
   * Supprime une entrée budgétaire.
   * - Appelle deleteBudgetEntry avec l'ID de l'entrée.
   * - Recharge les données budgétaires en cas de succès.
   * @param {number} entryId - ID de l'entrée à supprimer.
   * @returns {Promise<void>}
   */
  const executeDeleteEntry = async (entryId) => {
    const success = await deleteBudgetEntry(entryId);
    if (success) {
      fetchBudget(anneeFinanciere).then((data) => {
        if (data) {
          const processedData = data.map((entry) => ({
            ...entry,
            amount: parseFloat(entry.amount),
          }));
          setBudgetEntries(processedData);
        } else {
          setBudgetEntries([]);
        }
      });
    }
  };

  // -----------------------------------
  // Gestion des Événements
  // -----------------------------------

  /**
   * Gère la soumission du formulaire d'ajout d'entrée budgétaire.
   * - Valide les champs requis et le format du montant.
   * - Demande une vérification de PIN avant d'ajouter l'entrée.
   * @param {Object} e - Événement de soumission du formulaire.
   */
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (
      !newEntryData.fund_type ||
      !newEntryData.revenue_type ||
      newEntryData.amount === '' ||
      newEntryData.amount === null
    ) {
      alert('Veuillez remplir tous les champs.');
      return;
    }
    if (isNaN(parseFloat(newEntryData.amount))) {
      alert('Le montant doit être un nombre valide.');
      return;
    }
    requestPin('add');
  };

  /**
   * Active le mode édition pour une entrée budgétaire.
   * - Configure l'ID et les données de l'entrée à modifier.
   * @param {Object} entry - Entrée budgétaire à modifier.
   */
  const handleEditClick = (entry) => {
    setEditingEntryId(entry.id);
    setEditedEntryData({
      ...entry,
      amount: String(entry.amount),
    });
  };

  /**
   * Gère la soumission du formulaire de modification d'entrée budgétaire.
   * - Valide les champs requis et le format du montant.
   * - Demande une vérification de PIN avant de modifier l'entrée.
   * @param {Object} e - Événement de soumission du formulaire.
   */
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (
      !editedEntryData.fund_type ||
      !editedEntryData.revenue_type ||
      editedEntryData.amount === '' ||
      editedEntryData.amount === null
    ) {
      alert('Veuillez remplir tous les champs.');
      return;
    }
    if (isNaN(parseFloat(editedEntryData.amount))) {
      alert('Le montant doit être un nombre valide.');
      return;
    }
    requestPin('edit', editedEntryData);
  };

  /**
   * Gère la demande de suppression d'une entrée budgétaire.
   * - Affiche une confirmation, puis demande une vérification de PIN.
   * @param {number} entryId - ID de l'entrée à supprimer.
   */
  const handleDeleteClick = (entryId) => {
    if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette entrée budgétaire ?')) {
      requestPin('delete', entryId);
    }
  };

  // -----------------------------------
  // Traitement des Données pour les Graphiques
  // -----------------------------------

  // Calcule les totaux budgétaires par type de fond
  const budgetTotals = budgetEntries.reduce((totals, entry) => {
    const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
    if (!isNaN(amount)) {
      totals[entry.fund_type] = (totals[entry.fund_type] || 0) + amount;
    }
    return totals;
  }, {});

  // Données pour le graphique des fonds
  const budgetChartData = {
    labels: Object.keys(budgetTotals),
    datasets: [
      {
        data: Object.values(budgetTotals),
        backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)'],
        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'],
        borderWidth: 1,
      },
    ],
  };

  // Calcule les totaux des dépenses par type de facture
  const relevantFactures = localFactures;
  const expenseTotals = relevantFactures.reduce((totals, facture) => {
    if (!facture.type) return totals;
    totals[facture.type] = (totals[facture.type] || 0) + facture.montant;
    return totals;
  }, {});

  // Données pour le graphique des dépenses
  const expenseChartData = {
    labels: Object.keys(expenseTotals),
    datasets: [
      {
        data: Object.values(expenseTotals),
        backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)'],
        borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
        borderWidth: 1,
      },
    ],
  };

  // Options communes pour les graphiques
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((sum, current) => sum + current, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ${value.toFixed(2)}$ (${percentage}%)`;
          },
        },
      },
    },
  };

  // -----------------------------------
  // Rendu
  // -----------------------------------

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <h2 className="text-2xl font-bold text-blue-600">Gestion du Budget</h2>
      <p className="text-gray-700">
        Exercice Financier : {anneeFinanciere} - {parseInt(anneeFinanciere) + 1}
      </p>

      {/* Graphique et résumé des fonds */}
      <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
        <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
          {Object.keys(budgetTotals).length ? (
            <Pie data={budgetChartData} options={chartOptions} />
          ) : (
            <p className="text-gray-500">
              Aucune donnée budgétaire pour cet exercice pour afficher le diagramme.
            </p>
          )}
        </div>
        <div className="w-full md:w-1/2">
          <h3 className="text-lg font-semibold mb-4">Répartition par Fond</h3>
          <ul className="space-y-2">
            {Object.keys(budgetTotals).length ? (
              Object.keys(budgetTotals).map((fund) => (
                <li key={fund} className="flex justify-between">
                  <span className="text-gray-700">{fund} :</span>
                  <span
                    className={`font-bold ${
                      budgetTotals[fund] < 0 ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {formatCurrency(budgetTotals[fund])}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">Aucune donnée disponible.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Graphique et résumé des dépenses */}
      <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
        <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
          {Object.keys(expenseTotals).length ? (
            <Pie data={expenseChartData} options={chartOptions} />
          ) : (
            <p className="text-gray-500">
              Aucune dépense pour cet exercice pour afficher le diagramme.
            </p>
          )}
        </div>
        <div className="w-full md:w-1/2">
          <h3 className="text-lg font-semibold mb-4">Répartition des Dépenses par Type</h3>
          <ul className="space-y-2">
            {Object.keys(expenseTotals).length ? (
              Object.keys(expenseTotals).map((type) => (
                <li key={type} className="flex justify-between">
                  <span className="text-gray-700">{type} :</span>
                  <span
                    className={`font-bold ${
                      expenseTotals[type] < 0 ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {formatCurrency(expenseTotals[type])}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-gray-500">Aucune dépense disponible.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Formulaire d'ajout d'entrée budgétaire */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Ajouter une entrée budgétaire</h3>
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Année Financière</label>
            <p className="mt-1 p-2 border rounded bg-gray-100">{anneeFinanciere}</p>
          </div>
          <div>
            <label htmlFor="fund_type" className="block text-sm font-medium text-gray-700">
              Fond
            </label>
            <select
              id="fund_type"
              name="fund_type"
              value={newEntryData.fund_type}
              onChange={handleNewEntryChange}
              className="mt-1 w-full p-2 border rounded text-gray-700"
              required
            >
              {Object.keys(revenueTypes).map((fund) => (
                <option key={fund} value={fund}>
                  {fund}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="revenue_type" className="block text-sm font-medium text-gray-700">
              Type de Revenu
            </label>
            <select
              id="revenue_type"
              name="revenue_type"
              value={newEntryData.revenue_type}
              onChange={handleNewEntryChange}
              className="mt-1 w-full p-2 border rounded text-gray-700"
              required
            >
              {revenueTypes[newEntryData.fund_type]?.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )) || <option value="">Chargement...</option>}
            </select>
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Montant
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={newEntryData.amount}
              onChange={handleNewEntryChange}
              className="mt-1 w-full p-2 border rounded"
              placeholder="Montant"
              step="0.01"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
          >
            Ajouter l'entrée
          </button>
        </form>
      </div>

      {/* Liste des entrées budgétaires */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Entrées Budgétaires</h3>
        {budgetEntries.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {budgetEntries.map((entry) => (
              <li key={entry.id} className="py-4">
                {editingEntryId === entry.id ? (
                  <form onSubmit={handleEditSubmit} className="space-y-3">
                    <p className="text-sm font-semibold text-gray-600">
                      Modification (ID: {entry.id})
                    </p>
                    <div>
                      <label
                        htmlFor={`edit_fund_type_${entry.id}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Fond
                      </label>
                      <select
                        id={`edit_fund_type_${entry.id}`}
                        name="fund_type"
                        value={editedEntryData?.fund_type || ''}
                        onChange={handleEditedEntryChange}
                        className="mt-1 w-full p-2 border rounded text-gray-700"
                        required
                      >
                        {Object.keys(revenueTypes).map((fund) => (
                          <option key={fund} value={fund}>
                            {fund}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`edit_revenue_type_${entry.id}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Type de Revenu
                      </label>
                      <select
                        id={`edit_revenue_type_${entry.id}`}
                        name="revenue_type"
                        value={editedEntryData?.revenue_type || ''}
                        onChange={handleEditedEntryChange}
                        className="mt-1 w-full p-2 border rounded text-gray-700"
                        required
                      >
                        {revenueTypes[editedEntryData?.fund_type]?.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        )) || <option value="">Chargement...</option>}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`edit_amount_${entry.id}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        Montant
                      </label>
                      <input
                        type="number"
                        id={`edit_amount_${entry.id}`}
                        name="amount"
                        value={editedEntryData?.amount || ''}
                        onChange={handleEditedEntryChange}
                        className="mt-1 w-full p-2 border rounded text-gray-700"
                        placeholder="Montant"
                        step="0.01"
                        required
                      />
                    </div>
                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setEditingEntryId(null)}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-800 font-semibold">
                        {entry.revenue_type} ({entry.fund_type})
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(entry.date_added).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`${
                          entry.amount < 0 ? 'text-red-600' : 'text-gray-800'
                        } font-bold mr-4`}
                      >
                        {formatCurrency(entry.amount)}
                      </span>
                      <button
                        onClick={() => handleEditClick(entry)}
                        className="text-blue-500 hover:text-blue-700 text-sm mr-2"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteClick(entry.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-gray-500">
            Aucune entrée budgétaire pour cet exercice financier.
          </p>
        )}
      </div>

      {/* Modale de vérification du PIN */}
      <PinModal
        show={showPinModal}
        onVerify={handlePinVerified}
        onCancel={handlePinCancel}
        actionLabel={
          pinAction === 'add'
            ? 'ajouter'
            : pinAction === 'edit'
            ? 'modifier'
            : pinAction === 'delete'
            ? 'supprimer'
            : ''
        }
      />
    </div>
  );
}

export default BudgetDashboard;