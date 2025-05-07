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
    setInputPin('');
  };

  return show ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-lg w-80">
        <h2 className="text-lg font-semibold mb-4">Veuillez entrer votre PIN pour {actionLabel}</h2>
        <input
          type="password"
          value={inputPin}
          onChange={(e) => setInputPin(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          required
        />
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Annuler</button>
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Vérifier</button>
        </div>
      </form>
    </div>
  ) : null;
}

// Main BudgetDashboard Component
function BudgetDashboard({
  anneeFinanciere,
  fetchBudget,
  addBudgetEntry,
  updateBudgetEntry,
  deleteBudgetEntry,
  verifyPin,
  factures,           // NEW prop
  fetchFactures       // NEW prop
}) {
  // Existing states
  const [budgetEntries, setBudgetEntries] = useState([]);
  const [revenueTypes, setRevenueTypes] = useState({});
  const [newEntryData, setNewEntryData] = useState({ fund_type: 'Fond 1', revenue_type: '', amount: '' });
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editedEntryData, setEditedEntryData] = useState(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState(null);
  const [pinEntryToModify, setPinEntryToModify] = useState(null);

  // NEW: State for expenses (factures)
  const [expenses, setExpenses] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  useEffect(() => {
    // Fetch budget data
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

    // NEW: Fetch expenses for this financial year
    fetchFactures(anneeFinanciere).then(data => {
      if (data) {
        const processedExpenses = data.map(inv => ({
          ...inv,
          amount: parseFloat(inv.amount)
        }));
        setExpenses(processedExpenses);
      } else {
        setExpenses([]);
      }
    });

    // Fetch revenue types
    const fetchRevenueTypes = async () => {
      try {
        const res = await fetch(`${API_URL}/api/budget/revenue-types`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setRevenueTypes(data);
        // Set default revenue type if needed
        if (data['Fond 1'] && data['Fond 1'].length > 0) {
          setNewEntryData(prev => ({ ...prev, revenue_type: data['Fond 1'][0] }));
        }
      } catch (e) {
        console.error('Error fetching revenue types:', e);
        alert('Erreur lors du chargement des types de revenus.');
      }
    };
    fetchRevenueTypes();
  }, [anneeFinanciere, fetchBudget, fetchFactures, API_URL]);

  // Data processing for chart
  const budgetTotals = budgetEntries.reduce((totals, entry) => {
    const amount = typeof entry.amount === 'string' ? parseFloat(entry.amount) : entry.amount;
    if (!isNaN(amount)) {
      totals[entry.fund_type] = (totals[entry.fund_type] || 0) + amount;
    }
    return totals;
  }, {});

  const chartData = {
    labels: Object.keys(budgetTotals),
    datasets: [
      {
        data: Object.values(budgetTotals),
        backgroundColor: Object.keys(budgetTotals).map((_, i) => `hsl(${(i * 360) / Object.keys(budgetTotals).length}, 70%, 50%)`),
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: ({ label, raw: value }) => {
            const total = Object.values(budgetTotals).reduce((sum, v) => sum + v, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ${value.toFixed(2)}$ (${percentage}%)`;
          }
        }
      }
    }
  };

  // NEW: Calculate totals
  const totalBudget = budgetEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenses.reduce((sum, inv) => sum + inv.amount, 0);
  const remaining = totalBudget - totalExpenses;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-blue-600">Gestion du Budget</h2>
      <p className="text-gray-700">Exercice Financier : {anneeFinanciere} - {parseInt(anneeFinanciere) + 1}</p>

      {/* NEW: Résumé des dépenses */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Résumé des dépenses</h3>
        <p>Total du budget alloué : <strong>{totalBudget.toFixed(2)} $</strong></p>
        <p>Total des dépenses : <strong>{totalExpenses.toFixed(2)} $</strong></p>
        <p>Budget restant : <strong>{remaining.toFixed(2)} $</strong></p>
      </div>

      {/* Budget Summary and Chart */}
      <div className="bg-white p-6 rounded-lg shadow-md md:flex md:flex-row items-center space-y-6 md:space-y-0 md:space-x-6">
        <div className="w-full md:w-1/2 h-64 flex justify-center items-center">
          {budgetEntries.length > 0 && Object.keys(budgetTotals).length > 0 ? (
            <Pie data={chartData} options={chartOptions} />
          ) : (
            <p className="text-gray-500">Aucune donnée budgétaire pour cet exercice pour afficher le diagramme.</p>
          )}
        </div>
        {/* ... additional UI: list of entries, forms, modals ... */}
      </div>

      {/* PIN Verification Modal */}
      <PinModal
        show={showPinModal}
        onVerify={handlePinVerified}
        onCancel={handlePinCancel}
        actionLabel={
          pinAction === 'add' ? 'ajouter' : pinAction === 'edit' ? 'modifier' : pinAction === 'delete' ? 'supprimer' : ''
        }
      />
    </div>
  );
}

export default BudgetDashboard;
