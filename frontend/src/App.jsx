import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

const API_URL    = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

function App() {
  const [factures, setFactures]         = useState([]);
  const [annee, setAnnee]               = useState(new Date().getFullYear());
  const [clientCount, setClientCount]   = useState(0);

  // États pour l'upload
  const [uploadProgress, setUploadProgress] = useState(null); // null = pas d'upload
  const [timeLeft, setTimeLeft]             = useState('');   // mm:ss

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
    socket.on('new_facture', newF => setFactures(prev => [newF, ...prev]));
    socket.on('delete_facture', ({ id }) => setFactures(prev => prev.filter(f => f.id !== id)));
    socket.on('update_facture', updated => setFactures(prev => prev.map(f => f.id === updated.id ? updated : f)));
    socket.on('disconnect', reason => console.log('Déconnecté du WebSocket :', reason));

    return () => { socket.disconnect(); };
  }, [annee]);

  async function fetchFactures() {
    try {
      const res  = await fetch(`${API_URL}/api/factures?annee=${annee}`);
      const data = await res.json();
      setFactures(data);
    } catch (e) {
      console.error('Erreur fetch factures :', e);
    }
  }

  function addFacture(factureData) {
    const file = factureData.fichier;
    const formData = new FormData();
    Object.keys(factureData).forEach(key => formData.append(key, factureData[key]));
    formData.append('fichier', file);

    // Variables locales pour calcul du temps restant
    const startTime  = Date.now();
    const totalBytes = file.size;

    setUploadProgress(0);
    setTimeLeft('');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/factures`);

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const loaded  = e.loaded;
      const percent = Math.round((loaded * 100) / e.total);
      setUploadProgress(percent);

      // Pas de temps négatif
      if (loaded >= e.total) {
        setTimeLeft('0m 0s');
        return;
      }

      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > 0) {
        const speed    = loaded / elapsedMs;            // octets/ms
        const remainMs = (totalBytes - loaded) / speed; // ms
        const secTotal = Math.max(Math.ceil(remainMs / 1000), 0);
        const m        = Math.floor(secTotal / 60);
        const s        = secTotal % 60;
        setTimeLeft(`${m}m ${s}s`);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setTimeLeft('');
      if (!(xhr.status >= 200 && xhr.status < 300)) {
        console.error('Échec upload :', xhr.status, xhr.responseText);
      }
      // Le WebSocket rafraîchira automatiquement la liste
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setTimeLeft('');
      console.error('Erreur réseau pendant l’upload');
    };

    xhr.send(formData);
  }

  async function deleteFacture(id) {
    if (!window.confirm("Êtes-vous sûr(e) de vouloir supprimer cette facture ?")) {
      return;
    }
    try {
      await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
      // WebSocket gère la suppression dans l'UI
    } catch (e) {
      console.error('Erreur suppression :', e);
    }
  }

  async function updateFacture(id, updatedData) {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, annee })
      });
      // WebSocket gère la mise à jour dans l'UI
    } catch (e) {
      console.error('Erreur mise à jour :', e);
    }
  }

  return (
    <div className="container mx-auto p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <img src={logo} alt="Logo Habitek" className="w-32 h-auto mr-4" />
          <h1 className="text-2xl font-bold text-blue-600">
            Habitek — Gestion des factures
          </h1>
        </div>
        <div className="px-3 py-1 bg-gray-100 rounded-full text-sm">
          Clients en ligne : {clientCount}
        </div>
      </div>

      {/* BARRE DE PROGRESSION */}
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

      {/* FORMULAIRE */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
        <FormFacture onSubmit={addFacture} annee={annee} setAnnee={setAnnee} />
      </div>

      {/* TABLEAU */}
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