// src/components/MainLayout.jsx
// Ce composant contient la structure principale de l'application une fois l'utilisateur connecté.
// Il gère l'affichage des différentes vues (factures, budget, utilisateurs) via les sous-routes du dashboard
// et adapte l'interface utilisateur en fonction du rôle de l'utilisateur connecté.

import React, { useState, useEffect } from 'react';
import FormFacture from './FormFacture';
import TableFactures from './TableFactures';
import BudgetDashboard from './BudgetDashboard';
import UserManagement from './UserManagement'; // Gestion des utilisateurs
import DepenseComptesPage from "./DepenseComptesPage.jsx";
import logo from '../Logo Habitek_WEB_Transparent-06.png';

import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';

// API
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

/** Année financière (1er mai → 30 avril) */
const getFinancialYear = (date = new Date()) => {
  const year = date.getFullYear();
  return date.getMonth() >= 4 ? String(year) : String(year - 1);
};

function MainLayout({ userToken, userRole, handleLogout, authorizedFetch, clientCount, userId }) {
  // ---------------- State ----------------
  const [factures, setFactures] = useState([]);
  const [anneeFinanciere, setAnneeFinanciere] = useState(getFinancialYear());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  // Drawer / modal d’ajout
  const canUseDrawer = userRole === 'soumetteur' || userRole === 'gestionnaire';
  const [formDrawerOpen, setFormDrawerOpen] = useState(canUseDrawer);
  const [drawerWidth, setDrawerWidth] = useState(() => {
    const saved = Number(localStorage.getItem('factureDrawer.width'));
    return Number.isFinite(saved) && saved >= 320 && saved <= 720 ? saved : 420;
  });
  const [formModalOpen, setFormModalOpen] = useState(false);

  // Modal d’édition
  const [editingFacture, setEditingFacture] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const currentSubView = location.pathname.split('/').pop();

  // ------------- Effets / Sockets -------------
  useEffect(() => {
    if (location.pathname.endsWith('/manage-invoices') &&
        (userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur')) {
      fetchFactures(anneeFinanciere);
    } else {
      setFactures([]);
    }

    const socket = window.socket;
    if (socket) {
      const handleNewFacture = (nf) => {
        if (location.pathname.endsWith('/manage-invoices') && String(nf.annee) === anneeFinanciere) {
          fetchFactures(anneeFinanciere);
        }
      };
      const handleDeleteFacture = () => {
        if (location.pathname.endsWith('/manage-invoices')) fetchFactures(anneeFinanciere);
      };
      const handleUpdateFacture = (uf) => {
        if (location.pathname.endsWith('/manage-invoices') && String(uf.annee) === anneeFinanciere) {
          fetchFactures(anneeFinanciere);
        }
      };

      socket.on('new_facture', handleNewFacture);
      socket.on('delete_facture', handleDeleteFacture);
      socket.on('update_facture', handleUpdateFacture);
      return () => {
        socket.off('new_facture', handleNewFacture);
        socket.off('delete_facture', handleDeleteFacture);
        socket.off('update_facture', handleUpdateFacture);
      };
    }
  }, [anneeFinanciere, location.pathname, userRole]);

  useEffect(() => {
    localStorage.setItem('factureDrawer.width', String(drawerWidth));
  }, [drawerWidth]);

  useEffect(() => {
    if (!canUseDrawer) {
      setFormDrawerOpen(false);
      setFormModalOpen(false);
    }
  }, [canUseDrawer]);

  const onStartResize = (e) => {
    if (!canUseDrawer) return;
    if (window.innerWidth < 1024) return;
    e.preventDefault();
    const onMove = (ev) => {
      const px = Math.max(320, Math.min(720, window.innerWidth - ev.clientX));
      setDrawerWidth(px);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---------------- API: Factures ----------------
  async function fetchFactures(year) {
    if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      setFactures([]);
      return null;
    }
    try {
      const res = await authorizedFetch(`${API_URL}/api/factures?year=${year}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      setFactures(data);
      return data;
    } catch (e) {
      console.error('fetchFactures:', e);
      if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
        alert(`Erreur lors du chargement des factures : ${e.message}`);
      }
      setFactures([]);
      return null;
    }
  }

  function addFacture(factureData) {
    if (userRole !== 'soumetteur' && userRole !== 'gestionnaire') {
      alert("Vous n'avez pas le rôle nécessaire pour ajouter une facture.");
      return;
    }

    const startTime = Date.now();
    setUploadProgress(0);
    setTimeLeft('');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/factures`);
    if (userToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
    } else {
      alert("Vous n'êtes pas connecté.");
      handleLogout();
      setUploadProgress(null);
      setTimeLeft('');
      return;
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(percentage);

        const elapsed = (Date.now() - startTime) / 1000;
        const bytesPerSecond = e.loaded / elapsed;
        const remainingBytes = e.total - e.loaded;
        const estimatedSecondsRemaining = remainingBytes / bytesPerSecond;

        const minutes = Math.floor(estimatedSecondsRemaining / 60);
        const seconds = Math.round(estimatedSecondsRemaining % 60);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setTimeLeft('');
      if (xhr.status === 401 || xhr.status === 403) {
        let errorMessage = xhr.status === 403 ? "Accès refusé." : "Votre session a expiré ou est invalide.";
        try {
          const errorData = JSON.parse(xhr.responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {}
        alert(errorMessage);
        handleLogout();
        return;
      }
      if (!(xhr.status >= 200 && xhr.status < 300)) {
        alert("Erreur lors de l'ajout de la facture.");
      } else {
        if (location.pathname.endsWith('/manage-invoices')) {
          fetchFactures(anneeFinanciere);
        }
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setTimeLeft('');
      alert('Erreur réseau lors de l’ajout de la facture.');
    };

    xhr.send(factureData);
  }

  async function deleteFacture(id) {
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
      return false;
    }
    if (!window.confirm('Supprimer cette facture ?')) return false;

    try {
      const res = await authorizedFetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errorText}`);
      }
      fetchFactures(anneeFinanciere);
      return true;
    } catch (e) {
      console.error('deleteFacture:', e);
      if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
        alert(`Erreur lors de la suppression de la facture : ${e.message}`);
      }
      return false;
    }
  }

  async function updateFacture(id, data) {
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      alert("Vous n'avez pas le rôle nécessaire pour modifier une facture.");
      return false;
    }
    try {
      const res = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, annee: anneeFinanciere }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errorText}`);
      }
      fetchFactures(anneeFinanciere);
      return true;
    } catch (e) {
      console.error('updateFacture:', e);
      if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
        alert(`Erreur lors de la mise à jour : ${e.message}`);
      }
      return false;
    }
  }

  // -------- PATCH multipart pour l’édition (modal) --------
  async function submitUpdateFacture(formData) {
    if (!editingFacture?.id) return;
    setEditSubmitting(true);
    try {
      const res = await authorizedFetch(`${API_URL}/api/factures/${editingFacture.id}`, {
        method: 'PATCH',
        body: formData,
      });
      const ok = res.ok;
      const data = await res.json().catch(() => ({}));
      if (!ok) {
        alert(`Erreur modification: ${data.error || res.status}`);
        return;
      }
      if (location.pathname.endsWith('/manage-invoices')) {
        await fetchFactures(anneeFinanciere);
      }
      setEditingFacture(null);
    } catch (e) {
      console.error("submitUpdateFacture error:", e);
      alert("Erreur lors de la mise à jour de la facture.");
    } finally {
      setEditSubmitting(false);
    }
  }

  // ---------------- API: Budget (STUBS pour corriger l’erreur) ----------------
  // Ces fonctions sont définies pour éviter l'erreur "fetchBudget is not defined".
  // Elles n'altèrent pas l'apparence ; elles retournent des valeurs neutres.
   // --- Fonctions Budget (passées à BudgetDashboard, utilisent authorizedFetch) ---
  // Ces fonctions sont déjà adaptées pour la vérification de rôle UI et l'utilisation de authorizedFetch
  // dans la section précédente, lors de la modification de BudgetDashboard.jsx.
  // Vous devez copier/coller les définitions finales de ces fonctions ici depuis vos notes ou l'exemple précédent.

  //  const fetchBudget = async (year) => { /* ... votre code fetchBudget utilisant authorizedFetch et userRole ... */ };
  //  const addBudgetEntry = async (entryData) => { /* ... votre code addBudgetEntry utilisant authorizedFetch et userRole ... */ };
  //  const updateBudgetEntry = async (entryId, updatedData) => { /* ... votre code updateBudgetEntry utilisant authorizedFetch et userRole ... */ };
  //  const deleteBudgetEntry = async (entryId) => { /* ... votre code deleteBudgetEntry utilisant authorizedFetch et userRole ... */ };
  //  const verifyPin = async (pin) => { /* ... votre code verifyPin utilisant authorizedFetch (si protégé) ... */ };
  // 1) Récupérer les entrées budgétaires pour une année
  const fetchBudget = async (year) => {
    // UI-check (optionnel) : seuls gestionnaires et approbateurs peuvent lire
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      console.warn('fetchBudget blocqué, rôle insuffisant:', userRole);
      return [];
    }
    const res = await authorizedFetch(`${API_URL}/api/budget?financial_year=${year}`);
    if (!res.ok) {
      throw new Error(`fetchBudget HTTP ${res.status} – ${await res.text()}`);
    }
    return res.json();
  };

  // 2) Ajouter une entrée budgétaire
  const addBudgetEntry = async (entryData, anneeFinanciere) => {
    const payload = {
      financial_year: anneeFinanciere,  // clé attendue par votre backend
      fund_type: entryData.fund_type,
      revenue_type: entryData.revenue_type,
      amount: entryData.amount,
    };

    const res = await authorizedFetch(`${API_URL}/api/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("addBudgetEntry:", res);

    if (!res.ok) {
      console.log("addBudgetEntry erreur HTTP", res.status);
      return false;
    }
    return true;
  };

  // 3) Modifier une entrée
  const updateBudgetEntry = async (entryId, updatedData) => {
    if (userRole !== 'gestionnaire') {
      console.warn('updateBudgetEntry blocqué, rôle insuffisant:', userRole);
      return false;
    }
    const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });
    if (!res.ok) {
      console.error('updateBudgetEntry erreur HTTP', res.status);
      return false;
    }
    return true;
  };

  // 4) Supprimer une entrée
  const deleteBudgetEntry = async (entryId) => {
    if (userRole !== 'gestionnaire') {
      console.warn('deleteBudgetEntry blocqué, rôle insuffisant:', userRole);
      return false;
    }
    const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      console.error('deleteBudgetEntry erreur HTTP', res.status);
      return false;
    }
    return true;
  };

  // 5) Vérifier un PIN côté back
  const verifyPin = async (pin) => {
    // tout rôle peut vérifier, selon votre back ; sinon adaptez ici
    const res = await authorizedFetch(`${API_URL}/api/budget/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      console.error('verifyPin erreur HTTP', res.status);
      return false;
    }
    const { success } = await res.json();  // <-- clé correcte
    return success === true;
  };


  // ---------------- Download fichier ----------------
  const downloadFile = async (factureId, annee) => {
    try {
      const response = await authorizedFetch(`${API_URL}/api/factures/${factureId}/fichier?annee=${annee}`);
      if (!response.ok) {
        if (response.status === 404) {
          alert('Fichier non trouvé.');
          return;
        }
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `facture_${factureId}_fichier`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('downloadFile:', error);
      if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
        alert(`Erreur lors du téléchargement du fichier : ${error.message}`);
      }
    }
  };

  async function exportFacturesCsv() {
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      alert("Vous n'avez pas le rôle nécessaire pour exporter les factures.");
      setIsSidebarOpen(false);
      return false;
    }
    try {
      const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
      const response = await authorizedFetch(exportUrl);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errorText}`);
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
      return true;
    } catch (error) {
      console.error('exportFacturesCsv:', error);
      if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
        alert(`Erreur lors de l'exportation des factures : ${error.message}`);
      }
      return false;
    } finally {
      setIsSidebarOpen(false);
    }
  }

  const handleMenuItemClick = (view) => {
    navigate(`/dashboard/${view}`);
    setIsSidebarOpen(false);
  };

  // ---------------- Render ----------------
  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow z-10 flex items-center justify-between p-4">
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center flex-grow sm:flex-grow-0 cursor-pointer"
          onClick={() => handleMenuItemClick('home')}
        >
          <div className="flex items-center mb-2 sm:mb-0 mr-6 sm:mr-8">
            <button
              className="p-2 mr-4 sm:mr-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }}
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
        <div className="flex items-center">
          {userRole && (
            <div className="hidden sm:flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-4">
              Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </div>
          )}
          <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm mr-4">
            Clients en ligne : {clientCount}
          </div>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
            Déconnexion
          </button>
        </div>
      </div>

      {/* Overlay sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex-grow overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Menu</h2>

          <div className="mb-4">
            <label htmlFor="anneeSelect" className="block text-sm font-medium text-gray-700 mb-1">Année Financière :</label>
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

          <ul>
            <li>
              <button
                onClick={() => handleMenuItemClick('home')}
                className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Accueil
              </button>
            </li>

            {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
              <li>
                <button
                  onClick={() => handleMenuItemClick('manage-invoices')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  Gérer les factures
                </button>
              </li>
            )}

            {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
              <li>
                <button
                  onClick={() => handleMenuItemClick('manage-budget')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  Gérer le budget
                </button>
              </li>
            )}

            {userRole === 'gestionnaire' && (
              <li>
                <button
                  onClick={() => handleMenuItemClick('manage-users')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-users' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  Gérer les utilisateurs
                </button>
              </li>
            )}

            {userRole === "gestionnaire" && (
              <li>
                <button
                  onClick={() => handleMenuItemClick('depense-comptes')}
                  className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'depense-comptes' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  Gérer les comptes de dépenses
                </button>
              </li>
            )}

            {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
              <li>
                <button
                  onClick={exportFacturesCsv}
                  className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
                >
                  Exporter en CSV
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="p-4 border-t border-gray-200 sm:hidden flex justify-around items-center">
          {userRole && (
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm text-center">
              Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </div>
          )}
          <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-center">
            Clients en ligne : {clientCount}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 pb-4 pt-40 sm:pt-75 transition-all duration-300">
        <Routes>
          <Route
            path="home"
            element={
              <div className="text-center mt-10">
                <h2 className="text-2xl font-semibold text-gray-700">Bienvenue, {userRole}!</h2>
                <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
              </div>
            }
          />

          {/* Factures */}
          <Route
            path="manage-invoices"
            element={
              <div className="flex gap-0 lg:gap-4">
                {/* Liste */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <h1 className="text-lg font-semibold">Factures</h1>

                    {/* Desktop: drawer toggle */}
                    {canUseDrawer && (
                      <div className="hidden lg:flex items-center gap-2">
                        <button
                          onClick={() => setFormDrawerOpen(v => !v)}
                          className="px-3 py-1.5 border rounded hover:bg-gray-50"
                          title={formDrawerOpen ? "Réduire le formulaire" : "Ouvrir le formulaire"}
                        >
                          {formDrawerOpen ? "Masquer le formulaire" : "Ajouter une facture"}
                        </button>
                      </div>
                    )}
                    {/* Mobile: modal add */}
                    {canUseDrawer && (
                      <div className="lg:hidden">
                        <button
                          onClick={() => setFormModalOpen(true)}
                          className="px-3 py-1.5 border rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Ajouter une facture
                        </button>
                      </div>
                    )}
                  </div>

                  <TableFactures
                    factures={factures}
                    userRole={userRole}
                    currentUserId={userId}
                    onDelete={deleteFacture}
                    onUpdate={(id, patch) => updateFacture(id, patch)}
                    downloadFile={downloadFile}
                    onEdit={(facture) => setEditingFacture(facture)}
                  />
                </div>

                {/* Drawer d’ajout (desktop) */}
                {canUseDrawer && (
                  <aside
                    className={`hidden lg:flex lg:flex-col lg:shrink-0 border-l bg-white relative transition-[width] duration-150 ease-out ${formDrawerOpen ? '' : 'overflow-hidden'}`}
                    style={{ width: formDrawerOpen ? `${drawerWidth}px` : '0px' }}
                  >
                    {formDrawerOpen && (
                      <div
                        onMouseDown={onStartResize}
                        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-200"
                        title="Glisser pour redimensionner"
                      />
                    )}
                    <div className="px-3 py-2 border-b flex items-center justify-between">
                      <div className="font-medium">Ajouter une facture</div>
                      <button onClick={() => setFormDrawerOpen(false)} className="text-sm text-gray-600 hover:text-gray-900" title="Fermer">
                        ✕
                      </button>
                    </div>
                    <div className="p-3 overflow-auto">
                      <FormFacture
                        onSubmit={addFacture}
                        annee={anneeFinanciere}
                        setAnnee={setAnneeFinanciere}
                      />
                    </div>
                  </aside>
                )}

                {/* Modal d’ajout (mobile) */}
                {canUseDrawer && formModalOpen && (
                  <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setFormModalOpen(false)} aria-hidden="true" />
                    <div role="dialog" aria-modal="true" className="relative mx-auto mt-20 w-[92%] max-w-md rounded-xl bg-white shadow-xl">
                      <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div className="font-medium">Ajouter une facture</div>
                        <button onClick={() => setFormModalOpen(false)} className="text-sm text-gray-600 hover:text-gray-900" aria-label="Fermer">
                          ✕
                        </button>
                      </div>
                      <div className="p-4 max-h-[70vh] overflow-auto">
                        <FormFacture
                          onSubmit={addFacture}
                          annee={anneeFinanciere}
                          setAnnee={setAnneeFinanciere}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal d’édition (desktop + mobile) */}
                {editingFacture && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setEditingFacture(null)} aria-hidden="true" />
                    <div className="relative w-[92%] max-w-2xl rounded-xl bg-white shadow-xl">
                      <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div className="font-medium">
                          Modifier la facture&nbsp;#{editingFacture.numero_facture ?? editingFacture.id}
                        </div>
                        <button onClick={() => setEditingFacture(null)} className="text-sm text-gray-600 hover:text-gray-900" aria-label="Fermer">
                          ✕
                        </button>
                      </div>
                      <div className="p-4 max-h-[75vh] overflow-auto">
                        <FormFacture
                          onSubmit={submitUpdateFacture}
                          isEditMode={true}
                          initialData={editingFacture}
                          annee={anneeFinanciere}
                          setAnnee={setAnneeFinanciere}
                        />
                        {editSubmitting && (
                          <div className="mt-3 text-sm text-gray-600">Mise à jour en cours…</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }
          />

          {/* Budget */}
          {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
            <Route
              path="manage-budget"
              element={
                <BudgetDashboard
                  anneeFinanciere={anneeFinanciere}
                  fetchBudget={fetchBudget}
                  authorizedFetch={authorizedFetch}
                  API_URL={API_URL}
                  addBudgetEntry={addBudgetEntry}
                  updateBudgetEntry={updateBudgetEntry}
                  deleteBudgetEntry={deleteBudgetEntry}
                  verifyPin={verifyPin}
                  userRole={userRole}
                  fetchFacturesForBudget={() => fetchFactures(anneeFinanciere)}
                />
              }
            />
          )}
          

          {/* Utilisateurs */}
          {userRole === 'gestionnaire' && (
            <Route
              path="manage-users"
              element={<UserManagement authorizedFetch={authorizedFetch} currentUserRole={userRole} />}
            />
          )}

          {/* Comptes de dépenses */}
          {userRole === "gestionnaire" && (
            <Route
              path="depense-comptes"
              element={<DepenseComptesPage authorizedFetch={authorizedFetch} userRole={userRole} API_URL={API_URL} />}
            />
          )}

          <Route index element={<Navigate to="home" replace />} />
          <Route path="*" element={<Navigate to="home" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default MainLayout;
