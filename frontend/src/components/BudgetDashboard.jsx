// src/components/BudgetDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Simple PIN Modal Component
function PinModal({ show, onVerify, onCancel, actionLabel }) {
    const [inputPin, setInputPin] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onVerify(inputPin);
        setInputPin(''); // Clear input after attempt
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Entrer le NIP pour {actionLabel}</h3>
                <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                    <input
                        type="password"
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value)}
                        className="p-2 border rounded w-full"
                        placeholder="NIP"
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


function BudgetDashboard({ anneeFinanciere, fetchBudget, addBudgetEntry, updateBudgetEntry, deleteBudgetEntry, verifyPin }) {
    const [budgetEntries, setBudgetEntries] = useState([]);
    const [revenueTypes, setRevenueTypes] = useState({});
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    const [newEntryData, setNewEntryData] = useState({
        fund_type: 'Fond 1', // Default fund type
        revenue_type: '',
        amount: ''
    });
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editedEntryData, setEditedEntryData] = useState(null);

    const [showPinModal, setShowPinModal] = useState(false);
    const [pinAction, setPinAction] = useState(null); // 'add', 'edit', 'delete'
    const [pinEntryToModify, setPinEntryToModify] = useState(null); // Data or ID for the action


    const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

    useEffect(() => {
        // Fetch budget data for the current financial year
        fetchBudget(anneeFinanciere).then(data => {
             if (data) {
                // --- FIX: Convert amount strings to numbers ---
                const processedData = data.map(entry => ({
                    ...entry,
                    amount: parseFloat(entry.amount) // Convert amount to float
                }));
                setBudgetEntries(processedData);
            } else {
                 setBudgetEntries([]); // Set empty if fetch failed
            }
        });

        // Fetch revenue types
        const fetchRevenueTypes = async () => {
            try {
                const res = await fetch(`${API_URL}/api/budget/revenue-types`);
                 if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                const data = await res.json();
                setRevenueTypes(data);
                 // Set default revenue type if needed after fetching types
                 if (data['Fond 1'] && data['Fond 1'].length > 0) {
                     setNewEntryData(prev => ({ ...prev, revenue_type: data['Fond 1'][0] }));
                 }
            } catch (e) {
                console.error("Error fetching revenue types:", e);
                 alert("Erreur lors du chargement des types de revenus.");
            }
        };
        fetchRevenueTypes();

    }, [anneeFinanciere, fetchBudget, API_URL]); // Dependency on anneeFinanciere and fetchBudget


    // Handler for adding new entry form changes
    const handleNewEntryChange = (e) => {
        const { name, value } = e.target;
        setNewEntryData(prev => ({ ...prev, [name]: value }));

        // If fund type changes, reset revenue type to the first of the new fund's types
        if (name === 'fund_type') {
            const newFundTypes = revenueTypes[value] || [];
            setNewEntryData(prev => ({ ...prev, revenue_type: newFundTypes.length > 0 ? newFundTypes[0] : '' }));
        }
    };

    // Handler for editing entry form changes
    const handleEditedEntryChange = (e) => {
        const { name, value } = e.target;
        setEditedEntryData(prev => {
            const updatedData = { ...prev, [name]: value };
             // If fund type changes during edit, reset revenue type
            if (name === 'fund_type') {
                 const newFundTypes = revenueTypes[value] || [];
                 updatedData.revenue_type = newFundTypes.length > 0 ? newFundTypes[0] : '';
            }
            return updatedData;
        });
    };


    // --- PIN Verification and Action Execution ---
    const requestPin = (action, entry = null) => {
        setPinAction(action);
        setPinEntryToModify(entry); // Store the entry data or ID for the action
        setShowPinModal(true);
    };

    const handlePinVerified = async (inputPin) => {
        const isCorrect = await verifyPin(inputPin); // Call the verifyPin function from App.jsx

        if (isCorrect) {
            setShowPinModal(false);
            // Proceed with the stored action
            if (pinAction === 'add') {
                executeAddEntry();
            } else if (pinAction === 'edit') {
                executeEditEntry(pinEntryToModify); // pinEntryToModify holds the edited data
            } else if (pinAction === 'delete') {
                executeDeleteEntry(pinEntryToModify); // pinEntryToModify holds the entry ID
            }
        } else {
            alert("NIP incorrect.");
             // Optionally, keep the modal open or close and reset
            // setShowPinModal(false);
            // resetPinFlow();
        }
         resetPinFlow(); // Reset action and entry regardless of success/failure after attempt
    };

    const handlePinCancel = () => {
        setShowPinModal(false);
        resetPinFlow(); // Reset the stored action and entry
    };

    const resetPinFlow = () => {
        setPinAction(null);
        setPinEntryToModify(null);
    };


    // --- Action Execution Functions (Called after PIN verification) ---
    const executeAddEntry = async () => {
        // Call the addBudgetEntry function from App.jsx
        const success = await addBudgetEntry(newEntryData); // Assuming addBudgetEntry returns true/false

        if (success) { // Check for explicit true
            setIsAddingEntry(false); // Hide the form
            setNewEntryData({ // Reset form data
                fund_type: 'Fond 1',
                revenue_type: revenueTypes['Fond 1'] && revenueTypes['Fond 1'].length > 0 ? revenueTypes['Fond 1'][0] : '',
                amount: ''
            });
             // Re-fetch budget data to update the list and chart
            fetchBudget(anneeFinanciere).then(data => {
                 if (data) {
                     const processedData = data.map(entry => ({
                         ...entry,
                         amount: parseFloat(entry.amount)
                     }));
                     setBudgetEntries(processedData);
                 } else {
                      setBudgetEntries([]);
                 }
             });
        }
    };

     const executeEditEntry = async (editedData) => {
         // Call the updateBudgetEntry function from App.jsx
        const success = await updateBudgetEntry(editingEntryId, editedData); // Assuming updateBudgetEntry returns true/false

        if (success) {
             setEditingEntryId(null); // Exit editing mode
             setEditedEntryData(null); // Clear edited data
             // Re-fetch budget data
            fetchBudget(anneeFinanciere).then(data => {
                 if (data) {
                     const processedData = data.map(entry => ({
                         ...entry,
                         amount: parseFloat(entry.amount)
                     }));
                     setBudgetEntries(processedData);
                 } else {
                      setBudgetEntries([]);
                 }
             });
        }
     };

     const executeDeleteEntry = async (entryId) => {
         // Call the deleteBudgetEntry function from App.jsx
        const success = await deleteBudgetEntry(entryId); // Assuming deleteBudgetEntry returns true/false

        if (success) {
             // Re-fetch budget data
            fetchBudget(anneeFinanciere).then(data => {
                 if (data) {
                     const processedData = data.map(entry => ({
                         ...entry,
                         amount: parseFloat(entry.amount)
                     }));
                     setBudgetEntries(processedData);
                 } else {
                      setBudgetEntries([]);
                 }
             });
        }
     };


    // --- Handlers Triggering PIN Request ---
     const handleAddSubmit = (e) => {
         e.preventDefault();
          // Basic frontend validation
         if (!newEntryData.fund_type || !newEntryData.revenue_type || newEntryData.amount === '' || newEntryData.amount === null) {
             alert("Veuillez remplir tous les champs.");
             return;
         }
         if (isNaN(parseFloat(newEntryData.amount))) {
              alert("Le montant doit être un nombre valide.");
              return;
         }
         requestPin('add'); // Request PIN for adding
     };

    const handleEditClick = (entry) => {
        setEditingEntryId(entry.id);
        // Set edited data, ensuring amount is a string for input value
        setEditedEntryData({
            ...entry,
             amount: String(entry.amount) // Keep as string for input field
        });
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
         // Basic frontend validation for edited data
         if (!editedEntryData.fund_type || !editedEntryData.revenue_type || editedEntryData.amount === '' || editedEntryData.amount === null) {
             alert("Veuillez remplir tous les champs.");
             return;
         }
          if (isNaN(parseFloat(editedEntryData.amount))) {
              alert("Le montant doit être un nombre valide.");
              return;
         }
        requestPin('edit', editedEntryData); // Request PIN for editing, pass edited data
    };

    const handleDeleteClick = (entryId) => {
         if (window.confirm("Êtes-vous sûr(e) de vouloir supprimer cette entrée budgétaire ?")) {
             requestPin('delete', entryId); // Request PIN for deleting, pass entry ID
         }
    };


    // --- Data Processing for Chart ---
    // Ensure amounts are treated as numbers here
    const budgetTotals = budgetEntries.reduce((totals, entry) => {
        // Ensure entry.amount is a number before adding
        const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
        if (!isNaN(amount)) { // Add check if parsing failed
            totals[entry.fund_type] = (totals[entry.fund_type] || 0) + amount;
        }
        return totals;
    }, {});

    const chartData = {
        labels: Object.keys(budgetTotals),
        datasets: [
            {
                data: Object.values(budgetTotals),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)', // Blue for Fond 1 (example)
                    'rgba(255, 206, 86, 0.6)', // Yellow for Fond 3 (example)
                    // Add more colors if you have other funds or categories
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

     const chartOptions = {
        responsive: true,
        maintainAspectRatio: true, // Allows control of aspect ratio
        plugins: {
            legend: {
                position: 'top', // Position of the legend
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((sum, current) => sum + current, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                        return `${label}: ${value.toFixed(2)}$ (${percentage}%)`;
                    }
                }
            }
        },
         // You can set aspectRatio or height/width on the container if maintainAspectRatio is false
         // aspectRatio: 1, // Example: forces a square chart
    };


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-600">Gestion du Budget</h2>
            <p className="text-gray-700">
                 Exercice Financier : {anneeFinanciere} - {parseInt(anneeFinanciere) + 1}
            </p>

            {/* Budget Summary and Chart */}
            <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
                 <div className="w-full md:w-1/2 h-64 flex justify-center items-center"> {/* Container for chart */}
                    {budgetEntries.length > 0 && Object.keys(budgetTotals).length > 0 ? ( // Also check if there are totals
                        <Pie data={chartData} options={chartOptions} />
                    ) : (
                        <p className="text-gray-500">Aucune donnée budgétaire pour cet exercice pour afficher le diagramme.</p>
                    )}
                 </div>
                 <div className="w-full md:w-1/2">
                     <h3 className="text-lg font-semibold mb-4">Répartition par Fond</h3>
                     <ul className="space-y-2">
                         {Object.keys(budgetTotals).length > 0 ? ( // Only map if there are totals
                              Object.keys(budgetTotals).map(fund => (
                                 <li key={fund} className="flex justify-between text-gray-700">
                                     <span>{fund}:</span>
                                     <span>{budgetTotals[fund].toFixed(2)}$</span>
                                 </li>
                             ))
                         ) : (
                             <li className="text-gray-500">Aucune donnée disponible.</li>
                         )}
                     </ul>
                 </div>
            </div>


            {/* Add New Budget Entry Form */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                 <h3 className="text-lg font-semibold mb-4">Ajouter une entrée budgétaire</h3>
                 <form onSubmit={handleAddSubmit} className="space-y-4">
                    {/* Financial Year (Display only, selected via sidebar) */}
                     <div>
                         <label className="block text-sm font-medium text-gray-700">Année Financière</label>
                         <p className="mt-1 p-2 border rounded bg-gray-100">{anneeFinanciere}</p>
                     </div>

                    {/* Fund Type */}
                    <div>
                        <label htmlFor="fund_type" className="block text-sm font-medium text-gray-700">Fond</label>
                        <select
                            id="fund_type"
                            name="fund_type"
                            value={newEntryData.fund_type}
                            onChange={handleNewEntryChange}
                            className="mt-1 w-full p-2 border rounded text-gray-700"
                            required
                        >
                             {/* Ensure revenueTypes is loaded before mapping */}
                            {Object.keys(revenueTypes).map(fund => (
                                <option key={fund} value={fund}>{fund}</option>
                            ))}
                        </select>
                    </div>

                    {/* Revenue Type (Filtered by Fund Type) */}
                    <div>
                        <label htmlFor="revenue_type" className="block text-sm font-medium text-gray-700">Type de Revenu</label>
                        <select
                            id="revenue_type"
                            name="revenue_type"
                            value={newEntryData.revenue_type}
                            onChange={handleNewEntryChange}
                            className="mt-1 w-full p-2 border rounded text-gray-700"
                            required
                        >
                             {/* Ensure revenueTypes and the selected fund type exist */}
                            {revenueTypes[newEntryData.fund_type]?.map(type => (
                                <option key={type} value={type}>{type}</option>
                            )) || <option value="">Chargement...</option>} {/* Add a loading/default option */}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Montant</label>
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

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
                    >
                        Ajouter l'entrée
                    </button>
                 </form>
            </div>


            {/* List of Budget Entries */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Entrées Budgétaires</h3>
                {budgetEntries.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                        {budgetEntries.map(entry => (
                            <li key={entry.id} className="py-4">
                                {editingEntryId === entry.id ? (
                                    // Edit Form
                                    <form onSubmit={handleEditSubmit} className="space-y-3">
                                         <p className="text-sm font-semibold text-gray-600">Modification (ID: {entry.id})</p>
                                         {/* Fund Type (Editable) */}
                                            <div>
                                                <label htmlFor={`edit_fund_type_${entry.id}`} className="block text-sm font-medium text-gray-700">Fond</label>
                                                <select
                                                    id={`edit_fund_type_${entry.id}`}
                                                    name="fund_type"
                                                    value={editedEntryData?.fund_type || ''} // Use optional chaining and default empty string
                                                    onChange={handleEditedEntryChange}
                                                    className="mt-1 w-full p-2 border rounded text-gray-700"
                                                    required
                                                >
                                                     {/* Ensure revenueTypes is loaded before mapping */}
                                                     {Object.keys(revenueTypes).map(fund => (
                                                        <option key={fund} value={fund}>{fund}</option>
                                                    ))}
                                                </select>
                                            </div>
                                          {/* Revenue Type (Editable, Filtered) */}
                                            <div>
                                                <label htmlFor={`edit_revenue_type_${entry.id}`} className="block text-sm font-medium text-gray-700">Type de Revenu</label>
                                                <select
                                                    id={`edit_revenue_type_${entry.id}`}
                                                    name="revenue_type"
                                                     value={editedEntryData?.revenue_type || ''} // Use optional chaining and default empty string
                                                    onChange={handleEditedEntryChange}
                                                    className="mt-1 w-full p-2 border rounded text-gray-700"
                                                    required
                                                >
                                                    {/* Ensure revenueTypes and the selected fund type exist */}
                                                    {revenueTypes[editedEntryData?.fund_type]?.map(type => ( // Use optional chaining
                                                        <option key={type} value={type}>{type}</option>
                                                    )) || <option value="">Chargement...</option>} {/* Add a loading/default option */}
                                                </select>
                                            </div>
                                          {/* Amount (Editable) */}
                                            <div>
                                                <label htmlFor={`edit_amount_${entry.id}`} className="block text-sm font-medium text-gray-700">Montant</label>
                                                <input
                                                    type="number"
                                                    id={`edit_amount_${entry.id}`}
                                                    name="amount"
                                                    value={editedEntryData?.amount || ''} // Use optional chaining and default empty string
                                                    onChange={handleEditedEntryChange}
                                                    className="mt-1 w-full p-2 border rounded text-gray-700"
                                                    placeholder="Montant"
                                                    step="0.01"
                                                    required
                                                />
                                            </div>

                                        {/* Action Buttons */}
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
                                    // Display Entry
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-gray-800 font-semibold">{entry.revenue_type} ({entry.fund_type})</p>
                                            <p className="text-sm text-gray-600">{new Date(entry.date_added).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center">
                                            {/* Ensure entry.amount is treated as a number here */}
                                            <span className="text-green-600 font-bold mr-4">{parseFloat(entry.amount)?.toFixed(2)}$</span> {/* Added parseFloat and optional chaining */}
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
                    <p className="text-center text-gray-500">Aucune entrée budgétaire pour cet exercice financier.</p>
                )}
            </div>

            {/* PIN Verification Modal */}
            <PinModal
                show={showPinModal}
                onVerify={handlePinVerified}
                onCancel={handlePinCancel}
                actionLabel={pinAction === 'add' ? 'ajouter' : pinAction === 'edit' ? 'modifier' : pinAction === 'delete' ? 'supprimer' : ''}
            />

        </div>
    );
}

export default BudgetDashboard;