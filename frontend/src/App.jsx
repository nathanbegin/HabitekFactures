/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import BudgetDashboard from './components/BudgetDashboard';
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

// Configuration des URLs pour l'API et SocketIO
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

// -----------------------------------
// Fonctions Utilitaires
// -----------------------------------

/**
 * Détermine l'année financière (1er mai au 30 avril).
 * @param {Date} [date=new Date()] - Date à évaluer.
 * @returns {string} Année financière (ex: '2024' pour mai 2024 à avril 2025).
 */
const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  // L'année financière commence le 1er mai
  return date.getMonth() >= 4 ? String(year) : String(year - 1);
};

// -----------------------------------
// Composant Principal
// -----------------------------------

function App() {
  // -----------------------------------
  // Gestion des États
  // -----------------------------------
  const [factures, setFactures] = useState([]); // Liste des factures
  const [anneeFinanciere, setAnneeFinanciere] = useState(getFinancialYear()); // Année financière courante
  const [clientCount, setClientCount] = useState(0); // Nombre de clients connectés
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Visibilité de la barre latérale
  const [currentView, setCurrentView] = useState('home'); // Vue courante ('home', 'manage-invoices', 'manage-budget')
  const [uploadProgress, setUploadProgress] = useState(null); // Progression d'upload (%)
  const [timeLeft, setTimeLeft] = useState(''); // Temps restant estimé pour l'upload

  // -----------------------------------
  // Connexion SocketIO et Chargement des Données
  // -----------------------------------

  /**
   * Configure la connexion SocketIO et charge les factures si nécessaire.
   * - Établit une connexion WebSocket pour les mises à jour en temps réel.
   * - Charge les factures pour l'année financière courante si la vue est 'manage-invoices'.
   * - Gère les événements SocketIO pour les nouvelles factures, suppressions, et mises à jour.
   */
  useEffect(() => {
    if (currentView === 'manage-invoices') {
      fetchFactures(anneeFinanciere);
    }

    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('client_count', setClientCount);
    socket.on('new_facture', (nf) => {
      if (currentView === 'manage-invoices' && String(nf.annee) === anneeFinanciere) {
        setFactures((prev) => [nf, ...prev]);
      }
    });
    socket.on('delete_facture', (d) => {
      if (currentView === 'manage-invoices') {
        setFactures((prev) => prev.filter((f) => f.id !== d.id));
      }
    });
    socket.on('update_facture', (uf) => {
      if (currentView === 'manage-invoices' && String(uf.annee) === anneeFinanciere) {
        setFactures((prev) => prev.map((f) => (f.id === uf.id ? uf : f)));
      }
    });

    return () => socket.disconnect();
  }, [anneeFinanciere, currentView]);

  // -----------------------------------
  // Gestion des Factures
  // -----------------------------------

  /**
   * Récupère les factures pour une année financière donnée.
   * - Envoie une requête GET à l'API avec l'année financière.
   * - Met à jour l'état des factures avec les données reçues.
   * @param {string} year - Année financière.
   * @returns {Promise<Array|null>} Liste des factures ou null en cas d'erreur.
   */
  async function fetchFactures(year) {
    try {
      console.log(`Récupération des factures pour l'année financière ${year}`);
      const res = await fetch(`${API_URL}/api/factures?annee=${year}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      setFactures(data);
      return data;
    } catch (e) {
      console.error('Erreur lors de la récupération des factures :', e);
      alert(`Erreur lors du chargement des factures : ${e.message}`);
      return null;
    }
  }

  /**
   * Ajoute une nouvelle facture avec un fichier optionnel.
   * - Crée un FormData avec les données de la facture.
   * - Gère la progression d'upload et le temps restant estimé.
   * - Envoie la requête via XMLHttpRequest pour suivre l'upload.
   * @param {Object} factureData - Données de la facture (type, montant, fichier, etc.).
   */
  function addFacture(factureData) {
    const file = factureData.fichier;
    console.log('Fichier fourni :', file);
    if (file) {
      console.log('Nom du fichier :', file.name, 'Taille :', file.size, 'Type :', file.type);
    }

    const formData = new FormData();
    formData.append('annee', anneeFinanciere);
    formData.append('type', factureData.type);
    formData.append('ubr', factureData.ubr || '');
    formData.append('fournisseur', factureData.fournisseur || '');
    formData.append('description', factureData.description || '');
    formData.append('montant', factureData.montant);
    formData.append('statut', factureData.statut);
    if (file) {
      formData.append('fichier', file);
    } else {
      console.warn('Aucun fichier fourni pour l\'upload.');
    }

    const startTime = Date.now();
    const totalBytes = file ? file.size : 0;

    setUploadProgress(0);
    setTimeLeft('');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/factures`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const loaded = e.loaded;
      const percent = Math.round((loaded * 100) / e.total);
      setUploadProgress(percent);
      console.log(`Progression : ${percent}%`);

      if (loaded >= e.total) {
        setTimeLeft('0m 0s');
        return;
      }

      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > 0) {
        const speed = loaded / elapsedMs;
        const remainMs = (totalBytes - loaded) / speed;
        const secTotal = Math.max(Math.ceil(remainMs / 1000), 0);
        const m = Math.floor(secTotal / 60);
        const s = secTotal % 60;
        setTimeLeft(`${m}m ${s}s`);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setTimeLeft('');
      if (!(xhr.status >= 200 && xhr.status < 300)) {
        console.error('Échec de l\'upload :', xhr.status, xhr.responseText);
        alert('Erreur lors de l\'ajout de la facture.');
      } else {
        console.log('Réponse du serveur :', xhr.responseText);
        let response;
        try {
          response = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error('Erreur de parsing JSON :', e);
          alert('Erreur lors du traitement de la réponse du serveur.');
          return;
        }
        if (currentView === 'manage-invoices' && String(response.annee) === anneeFinanciere) {
          fetchFactures(anneeFinanciere);
        }
        console.log('Facture ajoutée avec succès.');
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setTimeLeft('');
      console.error('Erreur réseau lors de l\'upload');
      alert('Erreur réseau lors de l\'ajout de la facture.');
    };

    xhr.send(formData);
  }

  /**
   * Supprime une facture après confirmation de l'utilisateur.
   * - Vérifie si la vue courante est 'manage-invoices'.
   * - Demande une confirmation avant de supprimer.
   * - Envoie une requête DELETE à l'API.
   * @param {number} id - ID de la facture à supprimer.
   * @returns {Promise<boolean>} True si supprimée, false sinon.
   */
  async function deleteFacture(id) {
    if (currentView !== 'manage-invoices') return false;
    if (!window.confirm('Supprimer cette facture ?')) return false;

    try {
      const res = await fetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      console.log(`Facture ${id} supprimée.`);
      return true;
    } catch (e) {
      console.error('Erreur lors de la suppression :', e);
      alert(`Erreur lors de la suppression de la facture : ${e.message}`);
      return false;
    }
  }

  /**
   * Met à jour une facture existante.
   * - Vérifie si la vue courante est 'manage-invoices'.
   féminité- Envoie une requête PUT avec les nouvelles données.
   * @param {number} id - ID de la facture à mettre à jour.
   * @param {Object} data - Données à mettre à jour.
   * @returns {Promise<boolean>} True si mise à jour, false sinon.
   */
  async function updateFacture(id, data) {
    if (currentView !== 'manage-invoices') return false;

    try {
      const res = await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, annee: anneeFinanciere }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      console.log(`Facture ${id} mise à jour.`);
      return true;
    } catch (e) {
      console.error('Erreur lors de la mise à jour :', e);
      alert(`Erreur lors de la mise à jour de la facture : ${e.message}`);
      return false;
    }
  }

  /**
   * Exporte les factures au format CSV.
   * - Récupère les factures pour l'année financière courante.
   * - Crée un fichier CSV téléchargeable avec un nom basé sur l'année.
   * - Ferme la barre latérale après l'exportation.
   * @returns {Promise<boolean>} True si exporté, false sinon.
   */
  async function exportFacturesCsv() {
    try {
      const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
      console.log(`Exportation des factures pour l'année financière ${anneeFinanciere}...`);
      const response = await fetch(exportUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
      }

      const disposition = response.headers.get('Content-Disposition');
      let filename = `factures_${anneeFinanciere}.csv`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      console.log('Factures exportées avec succès.');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'exportation des factures :', error);
      alert(`Erreur lors de l'exportation des factures : ${error.message}`);
      return false;
    } finally {
      setIsSidebarOpen(false);
    }
  }

  // -----------------------------------
  // Gestion du Budget
  // -----------------------------------

  /**
   * Récupère les données budgétaires pour une année financière.
   * - Envoie une requête GET à l'API avec l'année financière.
   * - Retourne les données budgétaires ou null en cas d'erreur.
   * @param {string} year - Année financière.
   * @returns {Promise<Array|null>} Liste des budgets ou null en cas d'erreur.
   */
  const fetchBudget = async (year) => {
    console.log(`Récupération du budget pour l'année financière ${year}`);
    try {
      const res = await fetch(`${API_URL}/api/budget?financial_year=${year}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      console.log('Données budgétaires récupérées :', data);
      return data;
    } catch (e) {
      console.error('Erreur lors de la récupération du budget :', e);
      alert(`Erreur lors du chargement du budget : ${e.message}`);
      return null;
    }
  };

  /**
   * Ajoute une nouvelle entrée budgétaire.
   * - Envoie une requête POST avec les données de l'entrée.
   * - Inclut l'année financière dans les données envoyées.
   * @param {Object} entryData - Données de l'entrée budgétaire (type de fonds, revenu, montant, etc.).
   * @returns {Promise<boolean>} True si ajoutée, false sinon.
   */
  const addBudgetEntry = async (entryData) => {
    console.log('Ajout d\'une entrée budgétaire :', entryData);
    try {
      const res = await fetch(`${API_URL}/api/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entryData, financial_year: anneeFinanciere }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      const newEntry = await res.json();
      console.log('Entrée budgétaire ajoutée :', newEntry);
      return true;
    } catch (e) {
      console.error('Erreur lors de l\'ajout de l\'entrée budgétaire :', e);
      alert(`Erreur lors de l'ajout de l'entrée budgétaire : ${e.message}`);
      return false;
    }
  };

  /**
   * Met à jour une entrée budgétaire existante.
   * - Envoie une requête PUT avec les nouvelles données.
   * - Inclut l'année financière dans les données envoyées.
   * @param {number} entryId - ID de l'entrée budgétaire.
   * @param {Object} updatedData - Données à mettre à jour.
   * @returns {Promise<boolean>} True si mise à jour, false sinon.
   */
  const updateBudgetEntry = async (entryId, updatedData) => {
    console.log('Mise à jour de l\'entrée budgétaire :', entryId, updatedData);
    try {
      const res = await fetch(`${API_URL}/api/budget/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, financial_year: anneeFinanciere }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      const updatedEntry = await res.json();
      console.log('Entrée budgétaire mise à jour :', updatedEntry);
      return true;
    } catch (e) {
      console.error('Erreur lors de la mise à jour de l\'entrée budgétaire :', e);
      alert(`Erreur lors de la mise à jour de l'entrée budgétaire : ${e.message}`);
      return false;
    }
  };

  /**
   * Supprime une entrée budgétaire.
   * - Envoie une requête DELETE pour supprimer l'entrée spécifiée.
   * @param {number} entryId - ID de l'entrée budgétaire.
   * @returns {Promise<boolean>} True si supprimée, false sinon.
   */
  const deleteBudgetEntry = async (entryId) => {
    console.log('Suppression de l\'entrée budgétaire :', entryId);
    try {
      const res = await fetch(`${API_URL}/api/budget/${entryId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
      }
      console.log('Entrée budgétaire supprimée :', entryId);
      return true;
    } catch (e) {
      console.error('Erreur lors de la suppression de l\'entrée budgétaire :', e);
      alert(`Erreur lors de la suppression de l'entrée budgétaire : ${e.message}`);
      return false;
    }
  };

  /**
   * Vérifie un code PIN pour l'accès aux fonctionnalités budgétaires.
   * - Envoie une requête POST avec le PIN fourni.
   * - Retourne true si le PIN est valide, false sinon.
   * @param {string} pin - Code PIN à vérifier.
   * @returns {Promise<boolean>} True si valide, false sinon.
   */
  const verifyPin = async (pin) => {
    console.log('Vérification du PIN...');
    try {
      const res = await fetch(`${API_URL}/api/budget/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      console.log('Résultat de la vérification du PIN :', data);
      return data.success;
    } catch (e) {
      console.error('Erreur lors de la vérification du PIN :', e);
      alert(`Erreur lors de la vérification du PIN : ${e.message}`);
      return false;
    }
  };

  // -----------------------------------
  // Gestion des Événements UI
  // -----------------------------------

  /**
   * Gère le clic sur un élément du menu de la barre latérale.
   * - Change la vue courante et ferme la barre latérale.
   * @param {string} view - Vue à afficher ('home', 'manage-invoices', 'manage-budget').
   */
  const handleMenuItemClick = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  // -----------------------------------
  // Rendu
  // -----------------------------------

  return (
    <div className="relative min-h-screen">
      {/* En-tête - Position fixe */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow z-10 flex items-center justify-between p-4">
        {/* Gauche : Hamburger, Logo, Titre */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center flex-grow sm:flex-grow-0 cursor-pointer"
          onClick={() => handleMenuItemClick('home')}
        >
          <div className="flex items-center mb-2 sm:mb-0 mr-6 sm:mr-8">
            <button
              className="
                p-2 mr-4 sm:mr-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors cursor-pointer
              "
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarOpen(!isSidebarOpen);
              }}
              aria-label={isSidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src={logo} alt="Logo Habitek" className="w-32" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600 text-center sm:text-left sm:ml-4 break-words">
            Habitek - Plateforme trésorerie gestion des factures
          </h1>
        </div>
        {/* Droite : Compteur de clients (caché sur mobile) */}
        <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm">
          Clients en ligne : {clientCount}
        </div>
      </div>

      {/* Superposition pour la barre latérale */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Barre latérale */}
      <div
        className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 flex-grow overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          {/* Sélection de l'année financière */}
          <div className="mb-4">
            <label htmlFor="anneeSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Année Financière :
            </label>
            <select
              id="anneeSelect"
              value={anneeFinanciere}
              onChange={(e) => setAnneeFinanciere(e.target.value)}
              className="w-full p-2 border rounded text-gray-700"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                const fy = String(year);
                return (
                  <option key={fy} value={fy}>
                    {fy} - {parseInt(fy) + 1}
                  </option>
                );
              })}
            </select>
          </div>
          {/* Éléments du menu */}
          <ul>
            <li>
              <button
                onClick={() => handleMenuItemClick('home')}
                className={`block w-full text-left py-2 px-2 rounded-md ${
                  currentView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Accueil
              </button>
            </li>
            <li>
              <button
                onClick={() => handleMenuItemClick('manage-invoices')}
                className={`block w-full text-left py-2 px-2 rounded-md ${
                  currentView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Gérer les factures
              </button>
            </li>
            <li>
              <button
                onClick={() => handleMenuItemClick('manage-budget')}
                className={`block w-full text-left py-2 px-2 rounded-md ${
                  currentView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Gérer le budget
              </button>
            </li>
            <li>
              <button
                onClick={exportFacturesCsv}
                className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
              >
                Exporter en CSV
              </button>
            </li>
          </ul>
        </div>
        {/* Compteur de clients dans le pied de page (mobile uniquement) */}
        <div className="p-4 border-t border-gray-200 sm:hidden">
          <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-center">
            Clients en ligne : {clientCount}
          </div>
        </div>
      </div>

      {/* Contenu Principal */}
      <div className="container mx-auto px-4 pb-4 pt-40 sm:pt-75 transition-all duration-300">
        {currentView === 'home' && (
          <div className="text-center mt-10">
            <h2 className="text-2xl font-semibold text-gray-700">Bienvenue sur l'application de gestion</h2>
            <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
          </div>
        )}
        {currentView === 'manage-invoices' && (
          <>
            {/* Formulaire pour ajouter des factures */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
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
              <FormFacture onSubmit={addFacture} annee={anneeFinanciere} setAnnee={setAnneeFinanciere} />
            </div>
            {/* Tableau des factures */}
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
              <TableFactures factures={factures} onDelete={deleteFacture} onUpdate={updateFacture} />
            </div>
          </>
        )}
        {currentView === 'manage-budget' && (
          <BudgetDashboard
            anneeFinanciere={anneeFinanciere}
            fetchBudget={fetchBudget}
            addBudgetEntry={addBudgetEntry}
            updateBudgetEntry={updateBudgetEntry}
            deleteBudgetEntry={deleteBudgetEntry}
            verifyPin={verifyPin}
            factures={factures}
            fetchFactures={fetchFactures}
          />
        )}
      </div>
    </div>
  );
}

export default App;