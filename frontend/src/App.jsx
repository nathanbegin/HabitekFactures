import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

const API_URL    = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

function App() {
  const [factures,       setFactures]       = useState([]);
  const [annee,          setAnnee]          = useState(new Date().getFullYear());
  const [clientCount,    setClientCount]    = useState(0);
  // State for sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  // États pour upload
  const [uploadProgress, setUploadProgress] = useState(null);
  const [timeLeft,       setTimeLeft]       = useState('');

  useEffect(() => {
    fetchFactures();
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('client_count',   setClientCount);
    socket.on('new_facture',    nf => setFactures(prev => [nf, ...prev]));
    socket.on('delete_facture', d  => setFactures(prev => prev.filter(f=>f.id!==d.id)));
    socket.on('update_facture', uf => setFactures(prev => prev.map(f=>f.id===uf.id?uf:f)));
    return () => socket.disconnect();
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
    Object.keys(factureData).forEach(k => formData.append(k, factureData[k]));
    formData.append('fichier', file);

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

      if (loaded >= e.total) {
        setTimeLeft('0m 0s');
        return;
      }

      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > 0) {
        const speed    = loaded / elapsedMs;
        const remainMs = (totalBytes - loaded) / speed;
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
        console.error('Upload failed:', xhr.status);
      }
    };
    xhr.onerror = () => {
      setUploadProgress(null);
      setTimeLeft('');
      console.error('Network error during upload');
    };
    xhr.send(formData);
  }

  async function deleteFacture(id) {
    if (!window.confirm("Supprimer cette facture ?")) return;
    try {
      await fetch(`${API_URL}/api/factures/${id}?annee=${annee}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Erreur suppression :', e);
    }
  }

  async function updateFacture(id, data) {
    try {
      await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, annee })
      });
    } catch (e) {
      console.error('Erreur mise à jour :', e);
    }
  }

  return (
    <div className="relative min-h-screen"> {/* Added min-h-screen and relative positioning */}
      {/* HEADER */}
      {/* Adjusted header for better mobile layout and hamburger button position */}
      <div className="flex items-center justify-between mb-6 p-4"> {/* Combined flex and justify-between for overall header */}
        <div className="flex items-center"> {/* Container for hamburger, logo and title */}
           {/* Menu button (hamburger icon) - Moved to the left */}
          <button
            className="text-gray-500 hover:text-gray-700 focus:outline-none mr-4" // Added right margin
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          <img src={logo} alt="Logo Habitek" className="w-32 mr-4" /> {/* Logo */}
          <h1 className="text-2xl font-bold text-blue-600"> {/* Title */}
            Habitek — Gestion des factures
          </h1>
        </div>
        <div className="flex items-center"> {/* Container for client count */}
          <div className="px-3 py-1 bg-gray-100 rounded-full text-sm">
            Clients en ligne : {clientCount}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40" // Fixed position, covers screen, semi-transparent black, lower z-index
          onClick={() => setIsSidebarOpen(false)} // Close sidebar on click outside
          aria-hidden="true" // Hide from screen readers when sidebar is closed
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 ${ // Fixed position, top-left, set width and height, shadow, transition, higher z-index
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full' // Translate based on state (now from the left)
        }`}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          {/* Add your sidebar content here */}
          <ul>
            <li><a href="#" className="block py-2 text-gray-700 hover:bg-gray-100">Option 1</a></li>
            <li><a href="#" className="block py-2 text-gray-700 hover:bg-gray-100">Option 2</a></li>
            <li><a href="#" className="block py-2 text-gray-700 hover:bg-gray-100">Option 3</a></li>
          </ul>
        </div>
      </div>

      {/* MAIN CONTENT - Adjusted padding based on sidebar visibility (optional but good for UX) */}
       <div className={`container mx-auto p-4 transition-all duration-300 ${isSidebarOpen ? 'ml-0 sm:ml-64' : ''}`}>
        {/* FORMULAIRE D'AJOUT */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
          {/* Barre de progression juste au-dessus */}
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
          <FormFacture onSubmit={addFacture} annee={annee} setAnnee={setAnnee} />
        </div>

        {/* TABLEAU DES FACTURES */}
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto"> {/* Added overflow-x-auto for table scrolling on small screens */}
          <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
          <TableFactures
            factures={factures}
            onDelete={deleteFacture}
            onUpdate={updateFacture}
          />
        </div>
      </div>
    </div>
  );
}

export default App;