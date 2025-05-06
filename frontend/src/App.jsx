import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

function App() {
  const [factures, setFactures]     = useState([]);
  const [annee, setAnnee]           = useState(new Date().getFullYear());
  const [clientCount, setClientCount] = useState(0);

  // États pour la barre de progression et l'estimation du temps restant
  const [uploadProgress, setUploadProgress] = useState(null); // null = pas d'upload en cours
  const [timeLeft, setTimeLeft]             = useState('');   // chaîne mm:ss

  useEffect(() => {
    fetchFactures();

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log('Connecté au WebSocket :', socket.id);
    });

    socket.on('client_count', setClientCount);
    socket.on('new_facture', newFacture => {
      setFactures(prev => [newFacture, ...prev]);
    });
    socket.on('delete_facture', ({ id }) => {
      setFactures(prev => prev.filter(f => f.id !== id));
    });
    socket.on('update_facture', updated => {
      setFactures(prev => prev.map(f => f.id === updated.id ? updated : f));
    });

    socket.on('disconnect', reason => {
      console.log('Déconnecté du WebSocket :', reason);
    });

    return () => {
      socket.disconnect();
    };
  }, [annee]);

  // Récupérer la liste des factures pour l'année sélectionnée
  const fetchFactures = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/factures?annee=${annee}`);
      const data = await res.json();
      setFactures(data);
    } catch (e) {
      console.error('Erreur lors de la récupération des factures :', e);
    }
  };

  // Ajouter une facture avec barre de progression et estimation du temps
  const addFacture = (factureData) => {
    const file = factureData.fichier;
    const formData = new FormData();
    Object.keys(factureData).forEach(key => formData.append(key, factureData[key]));
    formData.append('fichier', file);

    // Variables locales pour le calcul du temps restant
    const startTime = Date.now();
    const totalBytes = file.size;

    // Initialisation de la barre
    setUploadProgress(0);
    setTimeLeft('');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/factures`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const loaded = e.loaded;
      const percent = Math.round((loaded * 100) / e.total);
      setUploadProgress(percent);

      // Calcul du temps restant
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > 0) {
        const speed     = loaded / elapsedMs;              // octets / ms
        const remainMs  = (totalBytes - loaded) / speed;   // ms
        const secTotal  = Math.ceil(remainMs / 1000);
        const minutes   = Math.floor(secTotal / 60);
        const seconds   = secTotal % 60;
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setTimeLeft('');
      if (!(xhr.status >= 200 && xhr.status < 300)) {
        console.error('Échec de l’upload :', xhr.status, xhr.responseText);
      }
      // Le WebSocket ajoutera la nouvelle facture automatiquement
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setTimeLeft('');
      console.error('Erreur réseau lors de l’upload');
    };

    xhr.send(formData);
  };

  // Supprimer une facture avec confirmation
  const deleteFacture = async (id) => {
    if (window.confirm("Êtes-vous sûr(e) de vouloir supprimer cette facture ?")) {
      try {
        await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
        // Le WebSocket supprimera la ligne automatiquement
      } catch (e) {
        console.error('Erreur lors de la suppression :', e);
      }
    }
  };

  // Mettre à jour le statut d’une facture
  const updateFacture = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, annee })
      });
      // Le WebSocket mettra à jour l’affichage automatiquement
    } catch (e) {
      console.error('Erreur lors de la mise à jour :', e);
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

      {/* BARRE DE PROGRESSION & TEMPS RESTANT */}
      {uploadProgress !== null && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded">
            <div
              className="text-center text-white py-1 rounded bg-blue-500"
              style={{ width: `${uploadProgress}%`, transition: 'width 0.2s' }}
            >
              {uploadProgress}%
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 mt-1">
            Temps restant estimé : {timeLeft}
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
        <TableFactures
          factures={factures}
          onDelete={deleteFacture}
          onUpdate={updateFacture}
        />
      </div>
    </div>
  );
}

export default App;
