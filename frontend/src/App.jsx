import { useState, useEffect } from 'react';
import FormFacture from './components/FormFacture';
import TableFactures from './components/TableFactures';
import BudgetDashboard from './components/BudgetDashboard'; // Import the new component
import { io } from 'socket.io-client';
import logo from './Logo Habitek_WEB_Transparent-06.png';

const API_URL    = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`;

// Helper function to determine the financial year (May 1st to April 30th)
const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  // Financial year starts May 1st
  if (date.getMonth() >= 4) { // Month is 0-indexed, so 4 is May
    return String(year);
  } else {
    return String(year - 1);
  }
};


function App() {
  const [factures,       setFactures]       = useState([]);
  // Use financial year for data fetching context
  const [anneeFinanciere, setAnneeFinanciere] = useState(getFinancialYear());
  const [clientCount,    setClientCount]    = useState(0);
  // State for sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // State to manage the current view
  const [currentView, setCurrentView] = useState('home'); // 'home', 'manage-invoices', 'manage-budget', etc.


  // États pour upload
  const [uploadProgress, setUploadProgress] = useState(null);
  const [timeLeft,       setTimeLeft]       = useState('');

  useEffect(() => {
    // Fetch factures only when the 'manage-invoices' view is active and financial year changes
    if (currentView === 'manage-invoices') {
      fetchFactures(anneeFinanciere);
    }
     // Note: If budget management requires its own data fetching or real-time updates,
     // you'll need to add similar conditional logic here based on `currentView === 'manage-budget'`.
     // Socket connections and events should ideally be handled at a higher level or in a dedicated service
     // and update view-specific states conditionally if needed.
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('client_count',   setClientCount);
    // Update factures only if we are on the 'manage-invoices' view and the year matches
    // These handlers need to be careful about which 'anneeFinanciere' they apply to
    socket.on('new_facture',    nf => { if(currentView === 'manage-invoices' && String(nf.annee) === anneeFinanciere) setFactures(prev => [nf, ...prev]); });
    socket.on('delete_facture', d  => { if(currentView === 'manage-invoices') setFactures(prev => prev.filter(f=>f.id!==d.id)); }); // Deletion is often by ID, year might not be strictly necessary here depending on backend
    socket.on('update_facture', uf => { if(currentView === 'manage-invoices' && String(uf.annee) === anneeFinanciere) setFactures(prev => prev.map(f=>f.id===uf.id?uf:f)); });

    return () => socket.disconnect();
  }, [anneeFinanciere, currentView]); // Add currentView and anneeFinanciere to the dependency array


    // --- Factures Functions ---
  async function fetchFactures(year) {
    try {
      console.log(`Workspaceing factures for financial year ${year}`); // Corrected typo
      const res  = await fetch(`${API_URL}/api/factures?annee=${year}`); // Use 'annee' as query param as implemented in backend
      if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      setFactures(data);
       return data; // Return data for potential use
    } catch (e) {
      console.error('Erreur fetch factures :', e);
      alert(`Erreur lors du chargement des factures: ${e.message}`); // User feedback
       return null; // Return null on error
    }
  }

  function addFacture(factureData) {
    const file = factureData.fichier;
    console.log('Fichier fourni :', file); // Débogage : vérifier si le fichier existe
    if (file) {
        console.log('Nom du fichier :', file.name, 'Taille :', file.size, 'Type :', file.type);
    }

    const formData = new FormData();
    formData.append('annee', anneeFinanciere);
    formData.append('type', factureData.type);
    formData.append('ubr', factureData.ubr || ''); // Gérer les champs optionnels
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

    xhr.upload.onprogress = e => {
        if (!e.lengthComputable) return;
        const loaded = e.loaded;
        const percent = Math.round((loaded * 100) / e.total);
        setUploadProgress(percent);
        console.log(`Progression : ${percent}%`); // Débogage : suivre la progression

       43
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
            console.log('Réponse du serveur :', xhr.responseText); // Débogage : voir la réponse
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
            } else if (currentView === 'manage-invoices') {
                console.log('Facture ajoutée pour une année différente.');
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

  async function deleteFacture(id) {
    // Only confirm and delete if on the manage-invoices view
    if (currentView !== 'manage-invoices') return false; // Return false if not on correct view

    if (!window.confirm("Supprimer cette facture ?")) return false; // Return false if not confirmed
    try {
      // Pass the financial year to help backend locate the data if needed
      const res = await fetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, { method: 'DELETE' }); // Pass 'annee' as query param
       if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
       }
       console.log(`Facture ${id} deleted.`);
       // Socket event will trigger state update in useEffect
       return true; // Indicate success
    } catch (e) {
      console.error('Erreur suppression :', e);
       alert(`Erreur lors de la suppression de la facture: ${e.message}`); // User feedback
       return false; // Indicate failure
    }
  }

  async function updateFacture(id, data) {
       // Only update if on the manage-invoices view
       if (currentView !== 'manage-invoices') return false; // Return false if not on correct view

    try {
        // Pass the financial year in the body or query params if backend needs it for scope
      const res = await fetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, annee: anneeFinanciere }) // Pass the financial year identifier
      });
       if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
       }
       console.log(`Facture ${id} updated.`);
       // Socket event will trigger state update in useEffect
       return true; // Indicate success
    } catch (e) {
      console.error('Erreur mise à jour :', e);
       alert(`Erreur lors de la mise à jour de la facture: ${e.message}`); // User feedback
       return false; // Indicate failure
    }
  }

    // Function to export data as CSV (remains mostly the same)
  async function exportFacturesCsv() {
    try {
      // Use the selected financial year for export
      const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
      console.log(`Exporting factures for financial year ${anneeFinanciere}...`);
      const response = await fetch(exportUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // Get the filename from the Content-Disposition header or use a default
      const disposition = response.headers.get('Content-Disposition');
      let filename = `factures_${anneeFinanciere}.csv`; // Default filename
      if (disposition) {
        const filenameMatch = disposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Create a blob from the response body
      const blob = await response.blob();
      // Create a link element
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // Set the download filename
      document.body.appendChild(a);
      a.click(); // Programmatically click the link to trigger the download
      // Clean up
      a.remove();
      window.URL.revokeObjectURL(url);

      console.log('Factures exported successfully.');
       return true; // Indicate success

    } catch (error) {
      console.error('Error exporting factures:', error);
      alert(`Erreur lors de l'exportation des factures: ${error.message}`); // Provide user feedback
       return false; // Indicate failure
    } finally {
      // Close the sidebar after export
      setIsSidebarOpen(false);
    }
  }

  // Handler for sidebar menu item clicks
  const handleMenuItemClick = (view) => {
    setCurrentView(view);
    setIsSidebarOpen(false); // Close sidebar after clicking a menu item
  };

  // --- Budget Management Functions (Implement fetching, adding, updating, deleting) ---
   const fetchBudget = async (year) => {
       console.log(`Workspaceing budget for financial year ${year}`); // Corrected typo
       try {
           // Use 'annee' as query param for financial year as implemented in backend
           const res = await fetch(`${API_URL}/api/budget?financial_year=${year}`); // Use 'annee' as query param as implemented in backend
           if (!res.ok) {
               const errorText = await res.text();
               throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
           }
           const data = await res.json();
           console.log("Fetched budget data:", data);
           return data; // Return the fetched data
       } catch (e) {
           console.error("Error fetching budget:", e);
           alert(`Erreur lors du chargement du budget: ${e.message}`);
           return null; // Return null on error
       }
   };

    const addBudgetEntry = async (entryData) => {
        console.log("Adding budget entry:", entryData);
        try {
           const res = await fetch(`${API_URL}/api/budget`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({...entryData, financial_year: anneeFinanciere}) // Pass financial_year as backend expects
           });
           if (!res.ok) {
               const errorText = await res.text();
               throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
           }
           const newEntry = await res.json();
           console.log("Added budget entry:", newEntry);
           // BudgetDashboard component will re-fetch data after successful action
           return true; // Indicate success
        } catch (e) {
            console.error("Error adding budget entry:", e);
            alert(`Erreur lors de l\'ajout de l\'entrée budgétaire: ${e.message}`);
            return false; // Indicate failure
        }
   };

    const updateBudgetEntry = async (entryId, updatedData) => {
           console.log("Updating budget entry:", entryId, updatedData);
        try {
             const res = await fetch(`${API_URL}/api/budget/${entryId}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({...updatedData, financial_year: anneeFinanciere}) // Pass financial_year as backend expects
             });
             if (!res.ok) {
                 const errorText = await res.text();
                 throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
             }
             const updatedEntry = await res.json();
             console.log("Updated budget entry:", updatedEntry);
             // BudgetDashboard component will re-fetch data after successful action
             return true; // Indicate success
        } catch (e) {
             console.error("Error updating budget entry:", e);
             alert(`Erreur lors de la mise à jour de l\'entrée budgétaire: ${e.message}`);
             return false; // Indicate failure
        }
   };

       const deleteBudgetEntry = async (entryId) => {
            console.log("Deleting budget entry:", entryId);
           try {
              const res = await fetch(`${API_URL}/api/budget/${entryId}`, { // Backend deletes by ID, year not strictly needed in URL but could be passed if ID scope is per year
                   method: 'DELETE',
               });
               if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP error! status: ${res.status} - ${errorText}`);
               }
               console.log("Deleted budget entry:", entryId);
               // BudgetDashboard component will re-fetch data after successful action
               return true; // Indicate success
           } catch (e) {
                console.error("Error deleting budget entry:", e);
                alert(`Erreur lors de la suppression de l\'entrée budgétaire: ${e.message}`);
                return false; // Indicate failure
           }
       };

       const verifyPin = async (pin) => {
            console.log("Verifying PIN...");
           try {
                const res = await fetch(`${API_URL}/api/budget/verify-pin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
               });
                // Do not throw on 401, handle success: false in the response body
                const data = await res.json();
                console.log("PIN verification result:", data);
                return data.success; // Backend should return { success: boolean }
           } catch (e) {
                console.error("Error verifying PIN:", e);
                // Handle network errors or unexpected responses
                 alert(`Erreur lors de la vérification du NIP: ${e.message}`);
                return false;
           }
       };


  return (
    <div className="relative min-h-screen"> {/* Added min-h-screen and relative positioning */}
      {/* HEADER - Made Fixed */}
      {/* Adjusted padding-bottom for spacing below the fixed header on mobile */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow z-10 flex items-center justify-between p-4">
        {/* Left side of header: Hamburger, Logo, Title */}
        {/* Make this div clickable */}
        {/* Adjusted flex-grow on mobile for better title wrapping */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center flex-grow sm:flex-grow-0 cursor-pointer" onClick={() => handleMenuItemClick('home')}> {/* Added sm:flex-grow-0 */}
          {/* Container for hamburger and logo */}
          <div className="flex items-center mb-2 sm:mb-0 mr-6 sm:mr-8">
            <button
              className={`
      p-2
      mr-4 sm:mr-6            /* espace entre le bouton et le logo */
      text-gray-500
      hover:text-gray-700     /* couleur du trait au survol */
      hover:bg-gray-100       /* fond clair au survol */
      focus:outline-none      /* on retire le outline natif */
      focus:ring-2            /* anneau au focus clavier */
      focus:ring-blue-500
      rounded                 /* coins arrondis pour l’effet hover */
      transition-colors       /* transition douce */
      cursor-pointer          /* pointeur au survol */
    `}
              onClick={(e) => {
                e.stopPropagation(); // Prevent the click from bubbling up to the parent div
                setIsSidebarOpen(!isSidebarOpen);
              }}
              aria-label={isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
            <img src={logo} alt="Logo Habitek" className="w-32" /> {/* Logo */}
          </div>
          {/* Title - Centered on mobile, left-aligned on sm+. Reduced font size on mobile. */}
          {/* Added break-words to ensure text wraps */}
          {/* Adjusted font size for better mobile fit */}
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600 text-center sm:text-left sm:ml-4 break-words"> {/* Adjusted text size, added break-words */}
            Habitek - Plateforme trésorerie gestion des factures {/* Full title from screenshot */}
          </h1>
        </div>

        {/* Right side of header: Client count (hidden on mobile) */}
        {/* Hide on mobile (<sm) and show as flex on sm+ */}
        <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm">
          Clients en ligne : {clientCount}
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar content */}
        <div className="p-4 flex-grow overflow-y-auto"> {/* Added overflow-y-auto */}
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          {/* Year Selection for Budget/Factures - Applicable to whichever view uses the year */}
            <div className="mb-4">
                <label htmlFor="anneeSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Année Financière:
                </label>
                <select
                    id="anneeSelect"
                    value={anneeFinanciere}
                    onChange={(e) => setAnneeFinanciere(e.target.value)}
                    className="w-full p-2 border rounded text-gray-700"
                >
                    {/* Generate options for a range of financial years */}
                    {/* Assuming financial year is identified by its start year */}
                    {/* Generating options from current year back 5 years */}
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => {
                        const fy = String(year); // Use the calendar year as the financial year identifier
                        return <option key={fy} value={fy}>{fy} - {parseInt(fy) + 1}</option>;
                    })}
                     {/* You might want to add more years or handle future years */}
                </select>
            </div>

          <ul>
            {/* Accueil menu item */}
            <li>
              <button
                  onClick={() => handleMenuItemClick('home')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Accueil
              </button>
            </li>
            {/* Manage Invoices menu item */}
            <li>
              <button
                  onClick={() => handleMenuItemClick('manage-invoices')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Gérer les factures
              </button>
            </li>
             {/* Manage Budget menu item */}
            <li>
              <button
                  onClick={() => handleMenuItemClick('manage-budget')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Gérer le budget
              </button>
            </li>
            {/* Export to CSV menu item */}
            <li>
              <button
                onClick={exportFacturesCsv} // This function already closes the sidebar
                className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
              >
                Exporter en CSV
              </button>
            </li>
          </ul>
        </div>

        {/* Client count in sidebar footer (shown only on mobile) */}
        <div className="p-4 border-t border-gray-200 sm:hidden">
            <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-center">
             Clients en ligne : {clientCount}
           </div>
        </div>
      </div>

      {/* MAIN CONTENT - Adjusted padding-top to clear the fixed header */}
       {/* Added pt-20 to push content down */}
       {/* Adjusted px-4 for consistent horizontal padding */}
       <div className="container mx-auto px-4 pb-4 pt-20 sm:pt-24 transition-all duration-300">
        {/* Conditional Rendering based on currentView */}
        {currentView === 'home' && (
          <div className="text-center mt-10">
            <h2 className="text-2xl font-semibold text-gray-700">Bienvenue sur l'application de gestion</h2> {/* Simplified welcome message */}
            <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
          </div>
        )}

        {currentView === 'manage-invoices' && (
          <> {/* Use a fragment to render multiple elements */}
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
              {/* Pass anneeFinanciere to FormFacture */}
              <FormFacture onSubmit={addFacture} annee={anneeFinanciere} setAnnee={setAnneeFinanciere} />
            </div>

            {/* TABLEAU DES FACTURES */}
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
              {/* Pass anneeFinanciere to TableFactures if needed for file download (already done) */}
              <TableFactures
                factures={factures}
                onDelete={deleteFacture}
                onUpdate={updateFacture}
              />
            </div>
          </>
        )}

        {currentView === 'manage-budget' && (
            // Render the BudgetDashboard component
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