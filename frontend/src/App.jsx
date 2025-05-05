import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';

// Remplacez cette URL par celle de votre backend déployé sur Render
const API_URL = import.meta.env.VITE_API_URL || 'https://habitekfactures.onrender.com/';

function App() {
  const [factures, setFactures] = useState([]);
  const [annee, setAnnee] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchFactures();
  }, [annee]);

  const fetchFactures = async () => {
    try {
      const response = await fetch(`${API_URL}/api/factures?annee=${annee}`);
      const data = await response.json();
      setFactures(data);
    } catch (error) {
      console.error('Erreur lors de la récupération des factures:', error);
    }
  };

  const addFacture = async (factureData) => {
    const formData = new FormData();
    Object.keys(factureData).forEach(key => formData.append(key, factureData[key]));
    formData.append('fichier', factureData.fichier);
    try {
      await fetch(`${API_URL}/api/factures`, { method: 'POST', body: formData });
      fetchFactures();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la facture:', error);
    }
  };

  const deleteFacture = async (id) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
      fetchFactures();
    } catch (error) {
      console.error('Erreur lors de la suppression de la facture:', error);
    }
  };

  const updateFacture = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, annee })
      });
      fetchFactures();
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la facture:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-blue-600">Habitek — Gestion des factures</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
        <FormFacture onSubmit={addFacture} annee={annee} setAnnee={setAnnee} />
      </div>
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
        <TableFactures factures={factures} onDelete={deleteFacture} onUpdate={updateFacture} />
      </div>
    </div>
  );
}

export default App;