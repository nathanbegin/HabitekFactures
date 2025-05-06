import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

function App() {
  const [factures, setFactures] = useState([]);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [clientCount, setClientCount] = useState(0);

  // Nouvel état pour la progression
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    fetchFactures();

    const socket = io(SOCKET_URL, { path: '/socket.io', transports: ['websocket'] });
    socket.on('client_count', setClientCount);
    socket.on('new_facture', newFacture => setFactures(prev => [newFacture, ...prev]));
    socket.on('delete_facture', ({ id }) => setFactures(prev => prev.filter(f => f.id !== id)));
    socket.on('update_facture', updated => setFactures(prev => prev.map(f => f.id === updated.id ? updated : f)));
    return () => { socket.disconnect(); };
  }, [annee]);

  const fetchFactures = async () => {
    try {
      const res = await fetch(`${API_URL}/api/factures?annee=${annee}`);
      const data = await res.json();
      setFactures(data);
    } catch (e) {
      console.error('Erreur fetch factures', e);
    }
  };

  const addFacture = (factureData) => {
    const formData = new FormData();
    Object.keys(factureData).forEach(k => formData.append(k, factureData[k]));
    formData.append('fichier', factureData.fichier);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/factures`);

    // CORS + credentials si besoin
    xhr.withCredentials = false;

    // Progression
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded * 100) / e.total);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        // Le WebSocket ajoutera la nouvelle facture à la liste
      } else {
        console.error('Upload failed', xhr.status, xhr.responseText);
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      console.error('Erreur réseau pendant l’upload');
    };

    xhr.send(formData);
  };

  const deleteFacture = async (id) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Erreur delete', e);
    }
  };

  const updateFacture = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, annee })
      });
    } catch (e) {
      console.error('Erreur update', e);
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <img src={logo} alt="Logo Habitek" className="w-32 h-auto mr-4" />
          <h1 className="text-2xl font-bold text-blue-600">Habitek — Gestion des factures</h1>
        </div>
        <div className="px-3 py-1 bg-gray-100 rounded-full text-sm">
          Clients en ligne : {clientCount}
        </div>
      </div>

      {/* BARRE DE PROGRESSION */}
      {uploadProgress !== null && (
        <div className="w-full bg-gray-200 rounded mb-4">
          <div
            className="text-center text-white py-1 rounded bg-blue-500"
            style={{ width: `${uploadProgress}%`, transition: 'width 0.2s' }}
          >
            {uploadProgress} %
          </div>
        </div>
      )}

      {/* FORMULAIRE D'AJOUT */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
        <FormFacture onSubmit={addFacture} annee={annee} setAnnee={setAnnee} />
      </div>

      {/* TABLEAU DES FACTURES */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
        <TableFactures factures={factures} onDelete={deleteFacture} onUpdate={updateFacture} />
      </div>
    </div>
  );
}

export default App;
