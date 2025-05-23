// /* eslint-disable no-unused-vars */
// import React, { useState, useEffect } from 'react';
// import { Pie } from 'react-chartjs-2';
// import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// // -----------------------------------
// // Initialisation de Chart.js
// // -----------------------------------

// // Enregistrement des composants nécessaires pour les graphiques en anneau
// ChartJS.register(ArcElement, Tooltip, Legend);

// // -----------------------------------
// // Fonctions Utilitaires
// // -----------------------------------

// /**
//  * Formate une valeur monétaire en dollars avec deux décimales et séparation des milliers.
//  * @param {number|string} value - Valeur à formater (peut être une chaîne ou un nombre).
//  * @returns {string} Valeur formatée (ex: "1 234.56$" ou "-1 234.56$").
//  */
// export function formatCurrency(value) {
//   const v = Number(value) || 0;
//   const sign = v < 0 ? '-' : '';
//   const abs = Math.abs(v);
//   // Force deux décimales et sépare les milliers par un espace
//   const [intPart, decPart] = abs.toFixed(2).split('.');
//   const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
//   return `${sign}${withThousands}.${decPart}$`;
// }

// // -----------------------------------
// // Composant PinModal
// // -----------------------------------

// /**
//  * Modale pour saisir et vérifier un code PIN avant d'exécuter une action protégée.
//  * Affiche un champ de saisie pour le PIN et des boutons pour valider ou annuler.
//  * @param {Object} props - Propriétés du composant.
//  * @param {boolean} props.show - Indique si la modale doit être affichée.
//  * @param {Function} props.onVerify - Fonction appelée avec le PIN saisi lors de la soumission.
//  * @param {Function} props.onCancel - Fonction appelée pour fermer la modale sans action.
//  * @param {string} props.actionLabel - Étiquette décrivant l'action (ex: "ajouter", "modifier").
//  * @returns {JSX.Element|null} Modale JSX ou null si non affichée.
//  */
// function PinModal({ show, onVerify, onCancel, actionLabel }) {
//   // État pour stocker le PIN saisi
//   const [inputPin, setInputPin] = useState('');

//   /**
//    * Gère la soumission du formulaire de PIN.
//    * - Empêche le rechargement de la page.
//    * - Appelle onVerify avec le PIN saisi.
//    * - Réinitialise le champ de saisie.
//    * @param {Object} e - Événement de soumission du formulaire.
//    */
//   const handleSubmit = (e) => {
//     e.preventDefault();
//     onVerify(inputPin);
//     setInputPin(''); // Réinitialise le champ après soumission
//   };

//   // Ne rend rien si la modale n'est pas affichée
//   if (!show) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
//       <div className="bg-white p-6 rounded-lg shadow-xl">
//         <h3 className="text-lg font-semibold mb-4">Entrer le PIN pour {actionLabel}</h3>
//         <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
//           <input
//             type="password"
//             value={inputPin}
//             onChange={(e) => setInputPin(e.target.value)}
//             className="p-2 border rounded w-full"
//             placeholder="PIN"
//             required
//           />
//           <div className="flex justify-end space-x-4">
//             <button
//               type="button"
//               onClick={onCancel}
//               className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
//             >
//               Annuler
//             </button>
//             <button
//               type="submit"
//               className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//             >
//               Vérifier
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// // -----------------------------------
// // Composant BudgetDashboard
// // -----------------------------------

// /**
//  * Tableau de bord pour la gestion budgétaire.
//  * Affiche des graphiques de répartition des fonds et des dépenses, un formulaire pour ajouter des entrées,
//  * et une liste des entrées budgétaires avec options de modification et suppression.
//  * @param {Object} props - Propriétés du composant.
//  * @param {string} props.anneeFinanciere - Année financière courante.
//  * @param {Function} props.fetchBudget - Fonction pour récupérer les données budgétaires.
//  * @param {Function} props.addBudgetEntry - Fonction pour ajouter une entrée budgétaire.
//  * @param {Function} props.updateBudgetEntry - Fonction pour mettre à jour une entrée budgétaire.
//  * @param {Function} props.deleteBudgetEntry - Fonction pour supprimer une entrée budgétaire.
//  * @param {Function} props.verifyPin - Fonction pour vérifier un code PIN.
//  * @param {Array} props.factures - Liste des factures (non utilisée directement, remplacée par localFactures).
//  * @returns {JSX.Element} Tableau de bord JSX.
//  */
// function BudgetDashboard({
//   anneeFinanciere,
//   fetchBudget,
//   addBudgetEntry,
//   updateBudgetEntry,
//   deleteBudgetEntry,
//   verifyPin,
//   factures,
// }) {
//   // -----------------------------------
//   // Gestion des États
//   // -----------------------------------

//   // Liste des entrées budgétaires
//   const [budgetEntries, setBudgetEntries] = useState([]);
//   // Types de revenus par fond
//   const [revenueTypes, setRevenueTypes] = useState({});
//   // Indique si le formulaire d'ajout est actif
//   const [isAddingEntry, setIsAddingEntry] = useState(false);
//   // Données du formulaire pour une nouvelle entrée
//   const [newEntryData, setNewEntryData] = useState({
//     fund_type: 'Fond 1',
//     revenue_type: '',
//     amount: '',
//   });
//   // ID de l'entrée en cours de modification
//   const [editingEntryId, setEditingEntryId] = useState(null);
//   // Données de l'entrée en cours de modification
//   const [editedEntryData, setEditedEntryData] = useState(null);
//   // Indique si la modale PIN est affichée
//   const [showPinModal, setShowPinModal] = useState(false);
//   // Action protégée par PIN (add, edit, delete)
//   const [pinAction, setPinAction] = useState(null);
//   // Entrée associée à l'action protégée
//   const [pinEntryToModify, setPinEntryToModify] = useState(null);
//   // Liste locale des factures pour l'année financière
//   const [localFactures, setLocalFactures] = useState([]);

//   // -----------------------------------
//   // Constantes
//   // -----------------------------------

//   // URL de l'API pour les requêtes
//   const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

//   // -----------------------------------
//   // Chargement des Données
//   // -----------------------------------

//   /**
//    * Charge les données budgétaires, les factures, et les types de revenus au montage et à chaque changement d'année financière.
//    * - Récupère les entrées budgétaires via fetchBudget.
//    * - Récupère les factures pour l'année financière courante.
//    * - Récupère les types de revenus pour les fonds.
//    */
//   useEffect(() => {
//     // Chargement des données budgétaires
//     fetchBudget(anneeFinanciere).then((data) => {
//       if (data) {
//         // Conversion des montants en nombres flottants
//         const processed = data.map((e) => ({
//           ...e,
//           amount: parseFloat(e.amount),
//         }));
//         setBudgetEntries(processed);
//       } else {
//         setBudgetEntries([]);
//       }
//     });

//     // Chargement des factures
//     fetch(`${API_URL}/api/factures?annee=${anneeFinanciere}`)
//       .then((r) => {
//         if (!r.ok) throw new Error(r.statusText);
//         return r.json();
//       })
//       .then((data) =>
//         setLocalFactures(
//           data.map((f) => ({
//             ...f,
//             montant: parseFloat(f.montant),
//           }))
//         )
//       )
//       .catch(() => setLocalFactures([]));

//     /**
//      * Récupère les types de revenus pour chaque fond.
//      * - Met à jour l'état revenueTypes avec les données reçues.
//      * - Définit un type de revenu par défaut pour le formulaire d'ajout.
//      */
//     const fetchRevenueTypes = async () => {
//       try {
//         const res = await fetch(`${API_URL}/api/budget/revenue-types`);
//         if (!res.ok) throw new Error(`Erreur HTTP ! statut: ${res.status}`);
//         const data = await res.json();
//         setRevenueTypes(data);
//         if (data['Fond 1'] && data['Fond 1'].length > 0) {
//           setNewEntryData((prev) => ({ ...prev, revenue_type: data['Fond 1'][0] }));
//         }
//       } catch (e) {
//         console.error('Erreur lors de la récupération des types de revenus :', e);
//         alert('Erreur lors du chargement des types de revenus.');
//       }
//     };
//     fetchRevenueTypes();
//   }, [anneeFinanciere, fetchBudget, API_URL]);

//   // -----------------------------------
//   // Gestion des Formulaires
//   // -----------------------------------

//   /**
//    * Gère les changements dans le formulaire d'ajout d'entrée budgétaire.
//    * - Met à jour l'état newEntryData avec la nouvelle valeur.
//    * - Si le type de fond change, met à jour le type de revenu par défaut.
//    * @param {Object} e - Événement de changement (input ou select).
//    */
//   const handleNewEntryChange = (e) => {
//     const { name, value } = e.target;
//     setNewEntryData((prev) => ({ ...prev, [name]: value }));
//     if (name === 'fund_type') {
//       const newFundTypes = revenueTypes[value] || [];
//       setNewEntryData((prev) => ({
//         ...prev,
//         revenue_type: newFundTypes.length > 0 ? newFundTypes[0] : '',
//       }));
//     }
//   };

//   /**
//    * Gère les changements dans le formulaire de modification d'entrée budgétaire.
//    * - Met à jour l'état editedEntryData avec la nouvelle valeur.
//    * - Si le type de fond change, met à jour le type de revenu par défaut.
//    * @param {Object} e - Événement de changement (input ou select).
//    */
//   const handleEditedEntryChange = (e) => {
//     const { name, value } = e.target;
//     setEditedEntryData((prev) => {
//       const updatedData = { ...prev, [name]: value };
//       if (name === 'fund_type') {
//         const newFundTypes = revenueTypes[value] || [];
//         updatedData.revenue_type = newFundTypes.length > 0 ? newFundTypes[0] : '';
//       }
//       return updatedData;
//     });
//   };

//   // -----------------------------------
//   // Gestion du PIN
//   // -----------------------------------

//   /**
//    * Demande une vérification de PIN pour une action protégée.
//    * - Configure l'action et l'entrée concernée, puis affiche la modale PIN.
//    * @param {string} action - Action à protéger ('add', 'edit', 'delete').
//    * @param {Object|number|null} entry - Données de l'entrée ou ID pour l'action (optionnel).
//    */
//   const requestPin = (action, entry = null) => {
//     setPinAction(action);
//     setPinEntryToModify(entry);
//     setShowPinModal(true);
//   };

//   /**
//    * Gère la vérification du PIN saisi.
//    * - Vérifie le PIN via verifyPin.
//    * - Exécute l'action correspondante si le PIN est correct.
//    * - Affiche une erreur si le PIN est incorrect.
//    * @param {string} inputPin - PIN saisi par l'utilisateur.
//    * @returns {Promise<void>}
//    */
//   const handlePinVerified = async (inputPin) => {
//     const isCorrect = await verifyPin(inputPin);
//     if (isCorrect) {
//       setShowPinModal(false);
//       if (pinAction === 'add') {
//         executeAddEntry();
//       } else if (pinAction === 'edit') {
//         executeEditEntry(pinEntryToModify);
//       } else if (pinAction === 'delete') {
//         executeEditEntry(pinEntryToModify);
//       }
//     } else {
//       alert('PIN incorrect.');
//     }
//     resetPinFlow();
//   };

//   /**
//    * Annule la saisie du PIN et ferme la modale.
//    * - Réinitialise les états liés au PIN.
//    */
//   const handlePinCancel = () => {
//     setShowPinModal(false);
//     resetPinFlow();
//   };

//   /**
//    * Réinitialise les états liés à la vérification du PIN.
//    * - Efface l'action et l'entrée concernée.
//    */
//   const resetPinFlow = () => {
//     setPinAction(null);
//     setPinEntryToModify(null);
//   };

//   // -----------------------------------
//   // Exécution des Actions
//   // -----------------------------------

//   /**
//    * Ajoute une nouvelle entrée budgétaire.
//    * - Appelle addBudgetEntry avec les données du formulaire.
//    * - Réinitialise le formulaire et recharge les données budgétaires en cas de succès.
//    * @returns {Promise<void>}
//    */
//   const executeAddEntry = async () => {
//     const success = await addBudgetEntry(newEntryData);
//     if (success) {
//       setIsAddingEntry(false);
//       setNewEntryData({
//         fund_type: 'Fond 1',
//         revenue_type:
//           revenueTypes['Fond 1'] && revenueTypes['Fond 1'].length > 0
//             ? revenueTypes['Fond 1'][0]
//             : '',
//         amount: '',
//       });
//       fetchBudget(anneeFinanciere).then((data) => {
//         if (data) {
//           const processedData = data.map((entry) => ({
//             ...entry,
//             amount: parseFloat(entry.amount),
//           }));
//           setBudgetEntries(processedData);
//         } else {
//           setBudgetEntries([]);
//         }
//       });
//     }
//   };

//   /**
//    * Met à jour une entrée budgétaire existante.
//    * - Appelle updateBudgetEntry avec les données modifiées.
//    * - Réinitialise le mode édition et recharge les données en cas de succès.
//    * @param {Object} editedData - Données modifiées de l'entrée.
//    * @returns {Promise<void>}
//    */
//   const executeEditEntry = async (editedData) => {
//     const success = await updateBudgetEntry(editingEntryId, editedData);
//     if (success) {
//       setEditingEntryId(null);
//       setEditedEntryData(null);
//       fetchBudget(anneeFinanciere).then((data) => {
//         if (data) {
//           const processedData = data.map((entry) => ({
//             ...entry,
//             amount: parseFloat(entry.amount),
//           }));
//           setBudgetEntries(processedData);
//         } else {
//           setBudgetEntries([]);
//         }
//       });
//     }
//   };

//   /**
//    * Supprime une entrée budgétaire.
//    * - Appelle deleteBudgetEntry avec l'ID de l'entrée.
//    * - Recharge les données budgétaires en cas de succès.
//    * @param {number} entryId - ID de l'entrée à supprimer.
//    * @returns {Promise<void>}
//    */
//   const executeDeleteEntry = async (entryId) => {
//     const success = await deleteBudgetEntry(entryId);
//     if (success) {
//       fetchBudget(anneeFinanciere).then((data) => {
//         if (data) {
//           const processedData = data.map((entry) => ({
//             ...entry,
//             amount: parseFloat(entry.amount),
//           }));
//           setBudgetEntries(processedData);
//         } else {
//           setBudgetEntries([]);
//         }
//       });
//     }
//   };

//   // -----------------------------------
//   // Gestion des Événements
//   // -----------------------------------

//   /**
//    * Gère la soumission du formulaire d'ajout d'entrée budgétaire.
//    * - Valide les champs requis et le format du montant.
//    * - Demande une vérification de PIN avant d'ajouter l'entrée.
//    * @param {Object} e - Événement de soumission du formulaire.
//    */
//   const handleAddSubmit = (e) => {
//     e.preventDefault();
//     if (
//       !newEntryData.fund_type ||
//       !newEntryData.revenue_type ||
//       newEntryData.amount === '' ||
//       newEntryData.amount === null
//     ) {
//       alert('Veuillez remplir tous les champs.');
//       return;
//     }
//     if (isNaN(parseFloat(newEntryData.amount))) {
//       alert('Le montant doit être un nombre valide.');
//       return;
//     }
//     requestPin('add');
//   };

//   /**
//    * Active le mode édition pour une entrée budgétaire.
//    * - Configure l'ID et les données de l'entrée à modifier.
//    * @param {Object} entry - Entrée budgétaire à modifier.
//    */
//   const handleEditClick = (entry) => {
//     setEditingEntryId(entry.id);
//     setEditedEntryData({
//       ...entry,
//       amount: String(entry.amount),
//     });
//   };

//   /**
//    * Gère la soumission du formulaire de modification d'entrée budgétaire.
//    * - Valide les champs requis et le format du montant.
//    * - Demande une vérification de PIN avant de modifier l'entrée.
//    * @param {Object} e - Événement de soumission du formulaire.
//    */
//   const handleEditSubmit = (e) => {
//     e.preventDefault();
//     if (
//       !editedEntryData.fund_type ||
//       !editedEntryData.revenue_type ||
//       editedEntryData.amount === '' ||
//       editedEntryData.amount === null
//     ) {
//       alert('Veuillez remplir tous les champs.');
//       return;
//     }
//     if (isNaN(parseFloat(editedEntryData.amount))) {
//       alert('Le montant doit être un nombre valide.');
//       return;
//     }
//     requestPin('edit', editedEntryData);
//   };

//   /**
//    * Gère la demande de suppression d'une entrée budgétaire.
//    * - Affiche une confirmation, puis demande une vérification de PIN.
//    * @param {number} entryId - ID de l'entrée à supprimer.
//    */
//   const handleDeleteClick = (entryId) => {
//     if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette entrée budgétaire ?')) {
//       requestPin('delete', entryId);
//     }
//   };

//   // -----------------------------------
//   // Traitement des Données pour les Graphiques
//   // -----------------------------------

//   // Calcule les totaux budgétaires par type de fond
//   const budgetTotals = budgetEntries.reduce((totals, entry) => {
//     const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
//     if (!isNaN(amount)) {
//       totals[entry.fund_type] = (totals[entry.fund_type] || 0) + amount;
//     }
//     return totals;
//   }, {});

//   // Données pour le graphique des fonds
//   const budgetChartData = {
//     labels: Object.keys(budgetTotals),
//     datasets: [
//       {
//         data: Object.values(budgetTotals),
//         backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)'],
//         borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'],
//         borderWidth: 1,
//       },
//     ],
//   };

//   // Calcule les totaux des dépenses par type de facture
//   const relevantFactures = localFactures;
//   const expenseTotals = relevantFactures.reduce((totals, facture) => {
//     if (!facture.type) return totals;
//     totals[facture.type] = (totals[facture.type] || 0) + facture.montant;
//     return totals;
//   }, {});

//   // Données pour le graphique des dépenses
//   const expenseChartData = {
//     labels: Object.keys(expenseTotals),
//     datasets: [
//       {
//         data: Object.values(expenseTotals),
//         backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)'],
//         borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
//         borderWidth: 1,
//       },
//     ],
//   };

//   // Options communes pour les graphiques
//   const chartOptions = {
//     responsive: true,
//     maintainAspectRatio: true,
//     plugins: {
//       legend: { position: 'top' },
//       tooltip: {
//         callbacks: {
//           label: function (context) {
//             const label = context.label || '';
//             const value = context.raw || 0;
//             const total = context.dataset.data.reduce((sum, current) => sum + current, 0);
//             const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
//             return `${label}: ${value.toFixed(2)}$ (${percentage}%)`;
//           },
//         },
//       },
//     },
//   };

//   // -----------------------------------
//   // Rendu
//   // -----------------------------------

//   return (
//     <div className="space-y-6">
//       {/* En-tête */}
//       <h2 className="text-2xl font-bold text-blue-600">Gestion du Budget</h2>
//       <p className="text-gray-700">
//         Exercice Financier : {anneeFinanciere} - {parseInt(anneeFinanciere) + 1}
//       </p>

//       {/* Graphique et résumé des fonds */}
//       <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
//         <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
//           {Object.keys(budgetTotals).length ? (
//             <Pie data={budgetChartData} options={chartOptions} />
//           ) : (
//             <p className="text-gray-500">
//               Aucune donnée budgétaire pour cet exercice pour afficher le diagramme.
//             </p>
//           )}
//         </div>
//         <div className="w-full md:w-1/2">
//           <h3 className="text-lg font-semibold mb-4">Répartition par Fond</h3>
//           <ul className="space-y-2">
//             {Object.keys(budgetTotals).length ? (
//               Object.keys(budgetTotals).map((fund) => (
//                 <li key={fund} className="flex justify-between">
//                   <span className="text-gray-700">{fund} :</span>
//                   <span
//                     className={`font-bold ${
//                       budgetTotals[fund] < 0 ? 'text-red-600' : 'text-gray-800'
//                     }`}
//                   >
//                     {formatCurrency(budgetTotals[fund])}
//                   </span>
//                 </li>
//               ))
//             ) : (
//               <li className="text-gray-500">Aucune donnée disponible.</li>
//             )}
//           </ul>
//         </div>
//       </div>

//       {/* Graphique et résumé des dépenses */}
//       <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
//         <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
//           {Object.keys(expenseTotals).length ? (
//             <Pie data={expenseChartData} options={chartOptions} />
//           ) : (
//             <p className="text-gray-500">
//               Aucune dépense pour cet exercice pour afficher le diagramme.
//             </p>
//           )}
//         </div>
//         <div className="w-full md:w-1/2">
//           <h3 className="text-lg font-semibold mb-4">Répartition des Dépenses par Type</h3>
//           <ul className="space-y-2">
//             {Object.keys(expenseTotals).length ? (
//               Object.keys(expenseTotals).map((type) => (
//                 <li key={type} className="flex justify-between">
//                   <span className="text-gray-700">{type} :</span>
//                   <span
//                     className={`font-bold ${
//                       expenseTotals[type] < 0 ? 'text-red-600' : 'text-gray-800'
//                     }`}
//                   >
//                     {formatCurrency(expenseTotals[type])}
//                   </span>
//                 </li>
//               ))
//             ) : (
//               <li className="text-gray-500">Aucune dépense disponible.</li>
//             )}
//           </ul>
//         </div>
//       </div>

//       {/* Formulaire d'ajout d'entrée budgétaire */}
//       <div className="bg-white p-6 rounded-lg shadow-md">
//         <h3 className="text-lg font-semibold mb-4">Ajouter une entrée budgétaire</h3>
//         <form onSubmit={handleAddSubmit} className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700">Année Financière</label>
//             <p className="mt-1 p-2 border rounded bg-gray-100">{anneeFinanciere}</p>
//           </div>
//           <div>
//             <label htmlFor="fund_type" className="block text-sm font-medium text-gray-700">
//               Fond
//             </label>
//             <select
//               id="fund_type"
//               name="fund_type"
//               value={newEntryData.fund_type}
//               onChange={handleNewEntryChange}
//               className="mt-1 w-full p-2 border rounded text-gray-700"
//               required
//             >
//               {Object.keys(revenueTypes).map((fund) => (
//                 <option key={fund} value={fund}>
//                   {fund}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div>
//             <label htmlFor="revenue_type" className="block text-sm font-medium text-gray-700">
//               Type de Revenu
//             </label>
//             <select
//               id="revenue_type"
//               name="revenue_type"
//               value={newEntryData.revenue_type}
//               onChange={handleNewEntryChange}
//               className="mt-1 w-full p-2 border rounded text-gray-700"
//               required
//             >
//               {revenueTypes[newEntryData.fund_type]?.map((type) => (
//                 <option key={type} value={type}>
//                   {type}
//                 </option>
//               )) || <option value="">Chargement...</option>}
//             </select>
//           </div>
//           <div>
//             <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
//               Montant
//             </label>
//             <input
//               type="number"
//               id="amount"
//               name="amount"
//               value={newEntryData.amount}
//               onChange={handleNewEntryChange}
//               className="mt-1 w-full p-2 border rounded"
//               placeholder="Montant"
//               step="0.01"
//               required
//             />
//           </div>
//           <button
//             type="submit"
//             className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
//           >
//             Ajouter l'entrée
//           </button>
//         </form>
//       </div>

//       {/* Liste des entrées budgétaires */}
//       <div className="bg-white p-6 rounded-lg shadow-md">
//         <h3 className="text-lg font-semibold mb-4">Entrées Budgétaires</h3>
//         {budgetEntries.length > 0 ? (
//           <ul className="divide-y divide-gray-200">
//             {budgetEntries.map((entry) => (
//               <li key={entry.id} className="py-4">
//                 {editingEntryId === entry.id ? (
//                   <form onSubmit={handleEditSubmit} className="space-y-3">
//                     <p className="text-sm font-semibold text-gray-600">
//                       Modification (ID: {entry.id})
//                     </p>
//                     <div>
//                       <label
//                         htmlFor={`edit_fund_type_${entry.id}`}
//                         className="block text-sm font-medium text-gray-700"
//                       >
//                         Fond
//                       </label>
//                       <select
//                         id={`edit_fund_type_${entry.id}`}
//                         name="fund_type"
//                         value={editedEntryData?.fund_type || ''}
//                         onChange={handleEditedEntryChange}
//                         className="mt-1 w-full p-2 border rounded text-gray-700"
//                         required
//                       >
//                         {Object.keys(revenueTypes).map((fund) => (
//                           <option key={fund} value={fund}>
//                             {fund}
//                           </option>
//                         ))}
//                       </select>
//                     </div>
//                     <div>
//                       <label
//                         htmlFor={`edit_revenue_type_${entry.id}`}
//                         className="block text-sm font-medium text-gray-700"
//                       >
//                         Type de Revenu
//                       </label>
//                       <select
//                         id={`edit_revenue_type_${entry.id}`}
//                         name="revenue_type"
//                         value={editedEntryData?.revenue_type || ''}
//                         onChange={handleEditedEntryChange}
//                         className="mt-1 w-full p-2 border rounded text-gray-700"
//                         required
//                       >
//                         {revenueTypes[editedEntryData?.fund_type]?.map((type) => (
//                           <option key={type} value={type}>
//                             {type}
//                           </option>
//                         )) || <option value="">Chargement...</option>}
//                       </select>
//                     </div>
//                     <div>
//                       <label
//                         htmlFor={`edit_amount_${entry.id}`}
//                         className="block text-sm font-medium text-gray-700"
//                       >
//                         Montant
//                       </label>
//                       <input
//                         type="number"
//                         id={`edit_amount_${entry.id}`}
//                         name="amount"
//                         value={editedEntryData?.amount || ''}
//                         onChange={handleEditedEntryChange}
//                         className="mt-1 w-full p-2 border rounded text-gray-700"
//                         placeholder="Montant"
//                         step="0.01"
//                         required
//                       />
//                     </div>
//                     <div className="flex justify-end space-x-2 mt-4">
//                       <button
//                         type="button"
//                         onClick={() => setEditingEntryId(null)}
//                         className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
//                       >
//                         Annuler
//                       </button>
//                       <button
//                         type="submit"
//                         className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
//                       >
//                         Enregistrer
//                       </button>
//                     </div>
//                   </form>
//                 ) : (
//                   <div className="flex justify-between items-center">
//                     <div>
//                       <p className="text-gray-800 font-semibold">
//                         {entry.revenue_type} ({entry.fund_type})
//                       </p>
//                       <p className="text-sm text-gray-600">
//                         {new Date(entry.date_added).toLocaleDateString()}
//                       </p>
//                     </div>
//                     <div className="flex items-center">
//                       <span
//                         className={`${
//                           entry.amount < 0 ? 'text-red-600' : 'text-gray-800'
//                         } font-bold mr-4`}
//                       >
//                         {formatCurrency(entry.amount)}
//                       </span>
//                       <button
//                         onClick={() => handleEditClick(entry)}
//                         className="text-blue-500 hover:text-blue-700 text-sm mr-2"
//                       >
//                         Modifier
//                       </button>
//                       <button
//                         onClick={() => handleDeleteClick(entry.id)}
//                         className="text-red-500 hover:text-red-700 text-sm"
//                       >
//                         Supprimer
//                       </button>
//                     </div>
//                   </div>
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="text-center text-gray-500">
//             Aucune entrée budgétaire pour cet exercice financier.
//           </p>
//         )}
//       </div>

//       {/* Modale de vérification du PIN */}
//       <PinModal
//         show={showPinModal}
//         onVerify={handlePinVerified}
//         onCancel={handlePinCancel}
//         actionLabel={
//           pinAction === 'add'
//             ? 'ajouter'
//             : pinAction === 'edit'
//             ? 'modifier'
//             : pinAction === 'delete'
//             ? 'supprimer'
//             : ''
//         }
//       />
//     </div>
//   );
// }

// export default BudgetDashboard;


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//JavaScript

// src/components/BudgetDashboard.jsx
// Ce composant affiche le tableau de bord du budget, incluant les graphiques,
// la liste des entrées budgétaires et le formulaire pour ajouter/modifier des entrées.
// Il applique des restrictions d'accès basées sur le rôle de l'utilisateur.

import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

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
// Composant PinModal (peut rester ici ou être déplacé dans un fichier séparé)
// -----------------------------------

/**
 * Modale simple pour demander un code PIN.
 * @param {Object} props - Propriétés du composant.
 * @param {boolean} props.show - Indique si la modale doit être affichée.
 * @param {Function} props.onVerify - Fonction appelée avec le PIN saisi lors de la vérification.
 * @param {Function} props.onCancel - Fonction appelée lors de l'annulation.
 * @param {string} props.actionLabel - Libellé de l'action associée au PIN (ex: 'ajouter', 'modifier').
 * @returns {JSX.Element|null} Modale JSX ou null si non affichée.
 */
function PinModal({ show, onVerify, onCancel, actionLabel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Réinitialiser le PIN et l'erreur lorsque la modale est affichée/masquée
    if (show) {
      setPin('');
      setError('');
    }
  }, [show]);


  const handleVerifyClick = async () => {
     setError(''); // Clear previous errors
     // Appelle la fonction onVerify passée par le parent (BudgetDashboard)
     // BudgetDashboard appellera verifyPin du backend via authorizedFetch
     const success = await onVerify(pin);
     console.error("handleVerifyClick: verifyPin response:", success);
     if (!success) {
         setError("PIN incorrect.");
     }
      // Si success est true, BudgetDashboard fermera la modale et exécutera l'action
  };

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-4">Vérification du PIN</h3>
         {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <p className="mb-4 text-sm text-gray-700">
          Veuillez entrer le code PIN pour {actionLabel} l'entrée budgétaire.
        </p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          placeholder="Entrez le PIN"
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleVerifyClick} // Appelle handleVerifyClick local
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Vérifier
          </button>
        </div>
      </div>
    </div>
  );
}


// -----------------------------------
// Composant BudgetDashboard
// -----------------------------------

// Modifiez la signature pour accepter userRole et authorizedFetch
function BudgetDashboard({
  anneeFinanciere,
  fetchBudget, // Passé depuis MainLayout, utilise authorizedFetch
  addBudgetEntry, // Passé depuis MainLayout, utilise authorizedFetch
  updateBudgetEntry, // Passé depuis MainLayout, utilise authorizedFetch
  deleteBudgetEntry, // Passé depuis MainLayout, utilise authorizedFetch
  verifyPin, // Passé depuis MainLayout, utilise authorizedFetch (si protégé)
  userRole, // Rôle de l'utilisateur connecté
  authorizedFetch, // Fonction pour faire des appels API avec le token
  fetchFacturesForBudget
}) {
  // -----------------------------------
  // Gestion des États
  // -----------------------------------
  const [budgetEntries, setBudgetEntries] = useState([]); // Entrées budgétaires de l'année sélectionnée
  const [localFactures, setLocalFactures] = useState([]); // Factures de l'année sélectionnée (pour les dépenses)
  const [revenueTypes, setRevenueTypes] = useState({}); // Types de revenus (pour le formulaire)

  const [isAddingEntry, setIsAddingEntry] = useState(false); // État du formulaire d'ajout (si visible)
  const [newEntryData, setNewEntryData] = useState({ // Données du nouvel entrée
    fund_type: 'Fond 1',
    revenue_type: '',
    amount: '',
  });

  const [editingEntryId, setEditingEntryId] = useState(null); // ID de l'entrée en cours de modification
  const [editedEntryData, setEditedEntryData] = useState(null); // Données de l'entrée en cours de modification

  const [showPinModal, setShowPinModal] = useState(false); // Visibilité de la modale PIN
  const [pinAction, setPinAction] = useState(null); // Action en attente de vérification PIN ('add', 'edit', 'delete')
  const [pinActionData, setPinActionData] = useState(null); // Données associées à l'action PIN (ex: id pour delete/edit)


  // -----------------------------------
  // Configuration des Graphiques
  // -----------------------------------

  // Options communes pour les graphiques
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Permet de mieux contrôler la taille avec le conteneur parent
    plugins: {
      legend: {
        position: 'right', // Positionne la légende à droite
        labels: {
            boxWidth: 20, // Largeur des boîtes de couleur dans la légende
             padding: 10 // Espacement entre les éléments de légende
        }
      },
      tooltip: {
        callbacks: {
          label: function(tooltipItem) {
            // Formatte le montant dans le tooltip
            const label = tooltipItem.label || '';
            const value = tooltipItem.raw || 0;
            return `${label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
  };

  // -----------------------------------
  // Hooks useEffect
  // -----------------------------------



  useEffect(() => {
    console.log("Local Factures updated:", localFactures);
    // Vous pouvez aussi vérifier si c'est vide ou non
    if (localFactures.length === 0) {
      console.log("Local Factures is currently empty.");
    } else {
      console.log("Local Factures contains", localFactures.length, "items.");
    }
  }, [localFactures]); // Ce useEffect s'exécute à chaque fois que localFactures change

  // Charger les données budget, factures (pour dépenses), et types de revenus
  // au changement d'année financière ou de rôle de l'utilisateur
   useEffect(() => {
     // Fetch Budget data - Ajouter vérification de rôle UI
     // Charger les données budget uniquement si l'utilisateur est gestionnaire ou approbateur
     if (userRole === 'gestionnaire' || userRole === 'approbateur') {
         console.log(`BudgetDashboard: Fetching budget for ${anneeFinanciere}`);
         // Utilise la fonction fetchBudget passée en prop (qui utilise authorizedFetch)

         const UI_FROM_DB = {
            "fonds de type 1": "Fond 1",
            "fonds de type 3": "Fond 3"
          };

         fetchBudget(anneeFinanciere).then((data) => {
            if (data) {
              const processed = data.map((e) => ({
                ...e,
                amount: parseFloat(e.amount),
                // remapper fund_type pour l’UI
                fund_type: UI_FROM_DB[e.fund_type] || e.fund_type,
              }));
              setBudgetEntries(processed);
            } else {
              setBudgetEntries([]);
            }
          });
     } else {
         // Si le rôle n'est pas suffisant, vider les données
         setBudgetEntries([]);
         console.log("BudgetDashboard: User role insufficient to view budget.");
     }


      // Fetch Factures data for expense chart - Ajouter vérification de rôle UI
      // Charger les factures uniquement si l'utilisateur est gestionnaire ou approbateur
      
      // MODIFICATION ICI : Utiliser la prop fetchFacturesForBudget pour récupérer les factures
    console.log("BudgetDashboard: Calling fetchFacturesForBudget for anneeFinanciere:", anneeFinanciere);
    if (fetchFacturesForBudget) {
        fetchFacturesForBudget().then((data) => {
          if (data) {
            setLocalFactures(
              data.map((f) => ({
                ...f,
                montant: parseFloat(f.montant),
              }))
            );
          } else {
            setLocalFactures([]); // Assurez-vous que localFactures est vide si la récupération échoue ou n'est pas autorisée
          }
        }).catch((e) => {
            console.error("Erreur lors de la récupération des factures pour le budget :", e);
            setLocalFactures([]);
        });
      } else {
          console.warn("fetchFacturesForBudget prop not provided to BudgetDashboard.");
          setLocalFactures([]);
      }

      


     // Fetch Revenue Types (Probablement accessible si on peut ajouter ou modifier le budget)
      // Limiter fetchRevenueTypes aux gestionnaires s'ils sont les seuls à pouvoir ajouter/modifier des entrées
      if (userRole === 'gestionnaire') {
         console.log("BudgetDashboard: Fetching revenue types.");
         const fetchRevenueTypes = async () => {
           try {
             // Utilisez authorizedFetch si la route /api/budget/revenue-types est protégée
             const res = await authorizedFetch(`${API_URL}/api/budget/revenue-types`);
             if (!res.ok) {
                  const errorText = await res.text();
                  throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
              }
             const data = await res.json();
             setRevenueTypes(data);
             // Sélectionner le premier type de revenu par défaut pour le formulaire d'ajout
             if (data['Fond 1'] && data['Fond 1'].length > 0) {
               setNewEntryData((prev) => ({ ...prev, revenue_type: data['Fond 1'][0] }));
             }
           } catch (e) {
             console.error('BudgetDashboard: Erreur lors de la récupération des types de revenus :', e);
              // authorizedFetch gère déjà les erreurs 401/403 et les alertes
             if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
                 alert('Erreur lors du chargement des types de revenus.');
             }
             setRevenueTypes({}); // Vider les types en cas d'erreur
           }
         };
         fetchRevenueTypes();
      } else {
          // Vider les types de revenus si le rôle ne permet pas
          setRevenueTypes({});
      }

       // Réinitialiser l'état d'ajout/édition et la modale PIN si l'année ou le rôle change
       setIsAddingEntry(false);
       setEditingEntryId(null);
       setEditedEntryData(null);
       setShowPinModal(false);
       setPinAction(null);
       setPinActionData(null);

   }, [anneeFinanciere, userRole]); 

  // -----------------------------------
  // Calculs pour les Graphiques
  // -----------------------------------

  // Calculer les totaux budgétaires par fond
  const budgetTotals = budgetEntries.reduce((acc, entry) => {
    acc[entry.fund_type] = (acc[entry.fund_type] || 0) + entry.amount;
    return acc;
  }, {});

//   // Calculer les totaux de dépenses par type de facture ('Dépense')
//   const expenseTotals = localFactures
//     .filter(facture => facture.type === 'Dépense' && facture.statut === 'Soumis') // Inclure uniquement les dépenses Soumises
//     .reduce((acc, facture) => {
//       acc[facture.ubr || 'Sans UBR'] = (acc[facture.ubr || 'Sans UBR'] || 0) + facture.montant;
//       return acc;
//     }, {});


  // Calcule les totaux des dépenses par type de facture

  const relevantFactures = localFactures;
  console.log("BudgetDashboard - Calculating expenseTotals based on localFactures:", localFactures);
  
  const expenseTotals = relevantFactures.reduce((totals, facture) => {
    if (!facture.type) return totals;
    totals[facture.type] = (totals[facture.type] || 0) + facture.montant;
    return totals;
  }, {});
  console.log("BudgetDashboard - Calculated expenseTotals:", expenseTotals);








  // Préparer les données pour le graphique budgétaire
  const budgetChartData = {
    labels: Object.keys(budgetTotals),
    datasets: [
      {
        data: Object.values(budgetTotals),
        backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966CC', '#FF9F40'], // Couleurs
        borderColor: '#ffffff', // Bordure blanche
        borderWidth: 2,
      },
    ],
  };

  // Préparer les données pour le graphique des dépenses
  const expenseChartData = {
      labels: Object.keys(expenseTotals),
      datasets: [
        {
          data: Object.values(expenseTotals),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966CC', '#FF9F40'].reverse(), // Couleurs (inversées ou différentes si vous voulez)
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };

  // -----------------------------------
  // Gestion des Changements de Formulaire
  // -----------------------------------

  const handleNewEntryChange = (e) => {
    const { name, value } = e.target;
    setNewEntryData((prev) => ({ ...prev, [name]: value }));
    // Si le fond change, mettre à jour le type de revenu par défaut
    if (name === 'fund_type' && revenueTypes[value] && revenueTypes[value].length > 0) {
      setNewEntryData((prev) => ({ ...prev, revenue_type: revenueTypes[value][0] }));
    }
  };

  const handleEditedEntryChange = (e) => {
      const { name, value } = e.target;
      setEditedEntryData((prev) => {
          const updatedData = { ...prev, [name]: value };
           // Si le fond change en édition, mettre à jour le type de revenu par défaut
          if (name === 'fund_type' && revenueTypes[value] && revenueTypes[value].length > 0) {
              updatedData.revenue_type = revenueTypes[value][0];
          }
          return updatedData;
      });
  };


  // -----------------------------------
  // Gestion des Actions (Ajout, Modif, Suppr) avec PIN
  // -----------------------------------

  // Fonction pour demander le PIN avant d'exécuter une action sensible
   const requestPin = (action, data = null) => {
       // La vérification de rôle UI est faite avant d'appeler cette fonction dans les gestionnaires d'événements
       setPinAction(action);
       setPinActionData(data); // Stocker les données nécessaires pour l'action (ex: id ou editedEntryData)
       setShowPinModal(true); // Afficher la modale PIN
   };

   // Fonction appelée par PinModal lorsque le PIN est vérifié
    const handlePinVerified = async (pin) => {
        // Appelle la fonction verifyPin passée en prop (qui utilise authorizedFetch)
        const success = await verifyPin(pin);
        console.log("handlePinVerified: verifyPin response:", success);
        if (success) {
            console.log("handlePinVerified: Dans la bouche if success:");
            // PIN correct, exécuter l'action en attente
            setShowPinModal(false); // Fermer la modale
           
            switch (pinAction) {
                case 'add':
                    console.log("handlePinVerified: executeAddEntry");
                    executeAddEntry();
                    break;
                case 'edit':
                    executeEditEntry(pinActionData); // pinActionData contient editedEntryData
                    break;
                case 'delete':
                    executeDeleteEntry(pinActionData); // pinActionData contient l'ID
                    break;
                default:
                    console.error("Action PIN inconnue:", pinAction);
                    break;
            }
             // Réinitialiser l'état de l'action PIN
             setPinAction(null);
             setPinActionData(null);
            return true;
        } else {
             // PIN incorrect, l'erreur est affichée dans PinModal via setError
             // Pas besoin de fermer la modale, l'utilisateur peut réessayer
             console.warn("PIN incorrect.");
             return false;
        }
    };

   // Fonction appelée par PinModal lors de l'annulation
   const handlePinCancel = () => {
       setShowPinModal(false); // Fermer la modale
       // Réinitialiser l'état de l'action PIN
       setPinAction(null);
       setPinActionData(null);
       setError(''); // Vider toute erreur PIN
       // Si on était en mode édition, annuler aussi le mode édition
       if (pinAction === 'edit') {
           setEditingEntryId(null);
           setEditedEntryData(null);
       }
   };


  // Fonctions pour exécuter les actions après vérification PIN
  const executeAddEntry = async () => {
    console.log('Exécution ajout entrée budget...');
    // addBudgetEntry est passé depuis MainLayout et utilise authorizedFetch + vérif rôle backend
    const success = await addBudgetEntry(newEntryData,anneeFinanciere);
    if (success) {
      setIsAddingEntry(false);
      // Réinitialiser le formulaire d'ajout
      setNewEntryData({
        financial_year: anneeFinanciere,
        fund_type: 'Fond 1',
        revenue_type:
          revenueTypes['Fond 1'] && revenueTypes['Fond 1'].length > 0
            ? revenueTypes['Fond 1'][0]
            : '',
        amount: '',
      });
      // Re-fetch budget après succès pour mettre à jour la liste et les graphiques
      fetchBudget(anneeFinanciere).then((data) => {
          if (data) {
            const processed = data.map((e) => ({
              ...e,
              amount: parseFloat(e.amount),
            }));
            setBudgetEntries(processed);
          } else {
            setBudgetEntries([]); // Vider en cas d'erreur fetch
          }
       });
    }
  };

   const executeEditEntry = async (dataToUpdate) => {
       console.log('Exécution modification entrée budget...', dataToUpdate);
       // updateBudgetEntry est passé depuis MainLayout et utilise authorizedFetch + vérif rôle backend
       const success = await updateBudgetEntry(editingEntryId, dataToUpdate);
       if (success) {
           setEditingEntryId(null); // Quitter le mode édition
           setEditedEntryData(null);
           // Re-fetch budget après succès
            fetchBudget(anneeFinanciere).then((data) => {
               if (data) {
                   const processed = data.map((e) => ({
                     ...e,
                     amount: parseFloat(e.amount),
                   }));
                   setBudgetEntries(processed);
                 } else {
                   setBudgetEntries([]); // Vider en cas d'erreur fetch
                 }
           });
       }
   };

    const executeDeleteEntry = async (entryId) => {
        console.log('Exécution suppression entrée budget...', entryId);
        // deleteBudgetEntry est passé depuis MainLayout et utilise authorizedFetch + vérif rôle backend
        const success = await deleteBudgetEntry(entryId);
        if (success) {
            // Mettre à jour l'état local (pas besoin de re-fetch si suppression réussie)
            setBudgetEntries(budgetEntries.filter(entry => entry.id !== entryId));
             // Si vous préférez un re-fetch pour plus de sûreté:
             // fetchBudget(anneeFinanciere).then(...);
        }
    };


   // -----------------------------------
  // Gestionnaires d'événements UI (appellent requestPin ou les execute* directement si pas de PIN)
  // Ces fonctions incluent la première couche de vérification de rôle UI.
  // -----------------------------------

    const handleAddSubmit = (e) => {
        e.preventDefault();
        // Vérification de rôle UI : Seuls les gestionnaires peuvent initier l'ajout
        if (userRole !== 'gestionnaire') {
            alert("Vous n'avez pas le rôle nécessaire pour ajouter une entrée budgétaire.");
            return;
        }
        // Validation basique côté client
        if (
            !newEntryData.fund_type ||
            !newEntryData.revenue_type ||
            newEntryData.amount === '' ||
            newEntryData.amount === null ||
             isNaN(parseFloat(newEntryData.amount))
        ) {
            alert('Veuillez remplir tous les champs et entrer un montant valide.');
            return;
        }
        // Demander le PIN avant d'appeler executeAddEntry
        requestPin('add'); // Appelle requestPin qui affichera la modale
    };

   const handleEditClick = (entry) => {
       // Vérification de rôle UI : Seuls les gestionnaires peuvent initier la modification
       if (userRole !== 'gestionnaire') {
            alert("Vous n'avez pas le rôle nécessaire pour modifier une entrée budgétaire.");
            return;
        }
       // Mettre à jour l'état d'édition
       setEditingEntryId(entry.id);
       setEditedEntryData({
         ...entry,
         amount: String(entry.amount), // Assurer que le montant est une chaîne pour l'input type="number"
       });
   };

    const handleEditSubmit = (e) => {
        e.preventDefault();
         // Vérification de rôle UI : Seuls les gestionnaires peuvent soumettre la modification
         if (userRole !== 'gestionnaire') {
             alert("Vous n'avez pas le rôle nécessaire pour modifier une entrée budgétaire.");
             return;
         }
        // Validation basique
        if (
            !editedEntryData || // Vérifier que editedEntryData existe
            !editedEntryData.fund_type ||
            !editedEntryData.revenue_type ||
            editedEntryData.amount === '' ||
            editedEntryData.amount === null ||
             isNaN(parseFloat(editedEntryData.amount))
        ) {
            alert('Veuillez remplir tous les champs et entrer un montant valide.');
            return;
        }
        // Demander le PIN avant d'appeler executeEditEntry
        requestPin('edit', editedEntryData); // Appelle requestPin avec les données modifiées
    };


    const handleDeleteClick = (entryId) => {
         // Vérification de rôle UI : Seuls les gestionnaires peuvent initier la suppression
         if (userRole !== 'gestionnaire') {
             alert("Vous n'avez pas le rôle nécessaire pour supprimer une entrée budgétaire.");
             return;
         }
        if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette entrée budgétaire ?')) {
            // Demander le PIN avant d'appeler executeDeleteEntry
            requestPin('delete', entryId); // Appelle requestPin avec l'ID à supprimer
        }
    };


  // -----------------------------------
  // Rendu du Composant
  // -----------------------------------

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <h2 className="text-2xl font-bold text-blue-600">Gestion du Budget</h2>
      <p className="text-gray-700">
        Exercice Financier : {anneeFinanciere} - {parseInt(anneeFinanciere) + 1}
      </p>

      {/* Afficher les graphiques et résumés uniquement si le rôle permet (Gestionnaire ou Approbateur) */}
       {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
           <>
             {/* Graphique et résumé des fonds */}
             <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
               <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
                 {Object.keys(budgetTotals).length > 0 ? ( // Vérifier si budgetTotals n'est pas vide
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
                   {Object.keys(budgetTotals).length > 0 ? ( // Vérifier si budgetTotals n'est pas vide
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
                     // N'afficher ce message que si budgetTotals est vide mais que la liste des entrées budgetaires n'est pas vide (si vous ne l'affichez pas en bas)
                     // Ou un message général si pas de données du tout.
                     <li className="text-gray-500">Aucune donnée disponible pour la répartition par fond.</li>
                   )}
                 </ul>
               </div>
             </div>

             {/* Graphique et résumé des dépenses */}
             <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
               <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
                 {Object.keys(expenseTotals).length > 0 ? ( // Vérifier si expenseTotals n'est pas vide
                   <Pie data={expenseChartData} options={chartOptions} />
                 ) : (
                   <p className="text-gray-500">
                     Aucune dépense "Soumise" pour cet exercice pour afficher le diagramme.
                   </p>
                 )}
               </div>
               <div className="w-full md:w-1/2">
                 <h3 className="text-lg font-semibold mb-4">Répartition des Dépenses "Soumises" par UBR</h3>
                 <ul className="space-y-2">
                   {Object.keys(expenseTotals).length > 0 ? ( // Vérifier si expenseTotals n'est pas vide
                     Object.keys(expenseTotals).map((ubr) => (
                       <li key={ubr} className="flex justify-between">
                         <span className="text-gray-700">{ubr} :</span>
                         <span
                           className={`font-bold ${
                             expenseTotals[ubr] < 0 ? 'text-red-600' : 'text-gray-800'
                           }`}
                         >
                           {formatCurrency(expenseTotals[ubr])}
                         </span>
                       </li>
                     ))
                   ) : (
                       // N'afficher ce message que si expenseTotals est vide mais que la liste des entrées budgetaires n'est pas vide
                     <li className="text-gray-500">Aucune dépense soumise disponible.</li>
                   )}
                 </ul>
               </div>
             </div>
           </>
       ) : (
           // Message si le rôle ne permet pas de voir les graphiques/résumés
           <p className="text-center text-red-500 font-semibold p-6 bg-white rounded-lg shadow-md">
               Vous n'avez pas les permissions nécessaires pour visualiser les données budgétaires.
           </p>
       )}


      {/* Formulaire d'ajout d'entrée budgétaire - Afficher uniquement si le rôle permet (Gestionnaire) */}
       {userRole === 'gestionnaire' && (
           <div className="bg-white p-6 rounded-lg shadow-md">
             <h3 className="text-lg font-semibold mb-4">Ajouter une entrée budgétaire</h3>
             {/* Afficher un message si les types de revenus ne sont pas chargés */}
              {Object.keys(revenueTypes).length === 0 && (
                  <p className="text-orange-600 mb-4">Chargement des types de revenus ou erreur de chargement. Assurez-vous d'avoir la permission de gestionnaire et une connexion API valide.</p>
              )}
             {/* Afficher le formulaire uniquement si les types de revenus sont chargés */}
             {Object.keys(revenueTypes).length > 0 && (
                 <form onSubmit={handleAddSubmit} className="space-y-4">
                   {/* Champs du formulaire d'ajout */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Année Financière</label>
                      <p className="mt-1 p-2 border rounded bg-gray-100 text-gray-700">{anneeFinanciere}</p>
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
                        {/* Remplir les options à partir de revenueTypes */}
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
                        {/* Remplir les options à partir de revenueTypes[newEntryData.fund_type] */}
                        {revenueTypes[newEntryData.fund_type] && revenueTypes[newEntryData.fund_type].length > 0 ? (
                           revenueTypes[newEntryData.fund_type].map((type) => (
                             <option key={type} value={type}>
                               {type}
                             </option>
                           ))
                        ) : (
                           <option value="">-- Sélectionner un fond d'abord --</option> // Message si aucun type trouvé pour le fond
                        )}
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
                        className="mt-1 w-full p-2 border rounded text-gray-700"
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
             )}
           </div>
       )}


      {/* Liste des entrées budgétaires - Afficher uniquement si le rôle permet (Gestionnaire ou Approbateur) */}
       {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
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
                         {/* Champs du formulaire d'édition */}
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
                               {revenueTypes[editedEntryData?.fund_type] && revenueTypes[editedEntryData.fund_type].length > 0 ? (
                                 revenueTypes[editedEntryData.fund_type].map((type) => (
                                   <option key={type} value={type}>
                                     {type}
                                   </option>
                                 ))
                               ) : (
                                  <option value="">-- Sélectionner un fond d'abord --</option> // Message si aucun type trouvé
                               )}
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
                             onClick={() => {setEditingEntryId(null); setEditedEntryData(null);}} // Annuler et vider les données
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
                         {/* Afficher les actions (modifier/supprimer) uniquement si le rôle permet (Gestionnaire) */}
                          {userRole === 'gestionnaire' && (
                              <div className="flex items-center">
                                <span
                                  className={`${
                                    entry.amount < 0 ? 'text-red-600' : 'text-gray-800'
                                  } font-bold mr-4`}
                                >
                                  {formatCurrency(entry.amount)}
                                </span>
                                <button
                                  onClick={() => handleEditClick(entry)} // Appelle la fonction locale qui vérifie le rôle
                                  className="text-blue-500 hover:text-blue-700 text-sm mr-2"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(entry.id)} // Appelle la fonction locale qui vérifie le rôle
                                  className="text-red-500 hover:text-red-700 text-sm"
                                >
                                  Supprimer
                                </button>
                              </div>
                          )}
                          {/* Afficher le montant sans les actions si le rôle est Approbateur (ou autre rôle qui voit mais ne modifie pas) */}
                           {userRole === 'approbateur' && (
                               <div className="flex items-center">
                                 <span
                                   className={`${
                                     entry.amount < 0 ? 'text-red-600' : 'text-gray-800'
                                   } font-bold`}
                                 >
                                   {formatCurrency(entry.amount)}
                                 </span>
                               </div>
                           )}
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
       ) : (
           // Ne rien afficher ou un message si le rôle ne permet pas de voir la liste des entrées
           null // La section des graphiques/résumés affiche déjà un message si rôle insuffisant
       )}


      {/* Modale de vérification du PIN (Afficher uniquement si le rôle est Gestionnaire) */}
       {userRole === 'gestionnaire' && ( // Limiter la modale de PIN aux gestionnaires
           <PinModal
             show={showPinModal}
             onVerify={handlePinVerified} // Appelle handlePinVerified locale
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
           
       )}
    </div>
  );
}

export default BudgetDashboard;