import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import { io } from 'socket.io-client';

// Remplacez cette URL par celle de votre backend déployé sur Render
const API_URL = import.meta.env.VITE_API_URL || 'https://habitekfactures.onrender.com';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}/`; // URL WebSocket

function App() {
  const [factures, setFactures] = useState([]);
  const [annee, setAnnee] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchFactures();
    // Connexion WebSocket
    const socket = io(SOCKET_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      console.log('Connecté au WebSocket');
    });

    socket.on('new_facture', (newFacture) => {
      setFactures((prev) => [newFacture, ...prev]);
    });

    socket.on('delete_facture', (data) => {
      setFactures((prev) => prev.filter((f) => f.id !== data.id));
    });

    socket.on('update_facture', (updatedFacture) => {
      setFactures((prev) =>
        prev.map((f) => (f.id === updatedFacture.id ? updatedFacture : f))
      );
    });

    socket.on('disconnect', () => {
      console.log('Déconnecté du WebSocket');
    });

    // Nettoyage de la connexion WebSocket
    return () => {
      socket.disconnect();
    };
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
    Object.keys(factureData).forEach((key) => formData.append(key, factureData[key]));
    formData.append('fichier', factureData.fichier);
    try {
      await fetch(`${API_URL}/api/factures`, { method: 'POST', body: formData });
      // Pas besoin de recharger manuellement, le WebSocket s'en charge
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la facture:', error);
    }
  };

  const deleteFacture = async (id) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
      // Pas besoin de recharger manuellement, le WebSocket s'en charge
    } catch (error) {
      console.error('Erreur lors de la suppression de la facture:', error);
    }
  };

  const updateFacture = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, annee }),
      });
      // Pas besoin de recharger manuellement, le WebSocket s'en charge
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