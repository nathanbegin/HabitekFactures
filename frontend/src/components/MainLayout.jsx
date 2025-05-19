// src/components/MainLayout.jsx
// Ce composant contient la structure principale de l'application une fois l'utilisateur connecté.
// Il gère l'affichage des différentes vues (factures, budget, utilisateurs) via les sous-routes du dashboard
// et adapte l'interface utilisateur en fonction du rôle de l'utilisateur connecté.

import React, { useState, useEffect } from 'react';
import FormFacture from './FormFacture';
import TableFactures from './TableFactures';
import BudgetDashboard from './BudgetDashboard';
import UserManagement from './UserManagement'; // Importez le nouveau composant de gestion des utilisateurs
import logo from '../Logo Habitek_WEB_Transparent-06.png'; // Adaptez le chemin du logo si nécessaire

// Importez les hooks de react-router-dom
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';

// Configuration des URLs pour l'API
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

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
// Composant MainLayout
// -----------------------------------

// Renommez la fonction principale et acceptez les props nécessaires passées depuis App.jsx
function MainLayout({ userToken, userRole, handleLogout, authorizedFetch, clientCount /*, userId, ...*/ }) {
  // -----------------------------------
  // Gestion des États (spécifiques à ce layout et ses enfants)
  // -----------------------------------
  const [factures, setFactures] = useState([]); // Liste des factures
  const [anneeFinanciere, setAnneeFinanciere] = useState(getFinancialYear()); // Année financière courante
  // clientCount est maintenant géré dans App.jsx et passé en prop
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Visibilité de la barre latérale
  // currentView est maintenant géré par react-router-dom via les sous-routes.
  const [uploadProgress, setUploadProgress] = useState(null); // Progression d'upload (%)
  const [timeLeft, setTimeLeft] = useState(''); // Temps restant estimé pour l'upload


  // Hooks de react-router-dom
  const navigate = useNavigate();
  const location = useLocation(); // Pour obtenir la route actuelle et déterminer quelle sous-vue afficher

  // Déterminer la sous-vue actuelle basée sur location.pathname pour les rendus conditionnels simples
  const currentSubView = location.pathname.split('/').pop();

  // --- Chargement des Données au changement de route/année ---
  // Utilisez useLocation pour réagir aux changements de sous-route dans /dashboard
  // et anneeFinanciere pour réagir au changement d'année.
  useEffect(() => {

      // Charger les factures SEULEMENT si la sous-vue est 'manage-invoices'
      // et si l'utilisateur a la permission UI de voir les factures.
      // La vérification backend est la sécurité finale, mais la vérification UI optimise.
       if (location.pathname.endsWith('/manage-invoices') && (userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur')) {
         console.log(`MainLayout: Navigated to manage-invoices (${anneeFinanciere}), fetching factures...`);
         fetchFactures(anneeFinanciere);
      } else {
         // Vider les factures si on quitte la vue des factures ou si le rôle ne permet pas
         setFactures([]);
      }

      // Les données budgétaires et utilisateurs sont fetchées dans leurs composants spécifiques
      // (BudgetDashboard, UserManagement) car ces fetches nécessitent des potentiels contrôles
      // de rôle et logiques spécifiques à ces composants.

      // --- Adaptation des listeners SocketIO pour réagir dans ce composant ---
      // Les événements globaux (client_count) sont gérés dans App.jsx.
      // Les événements spécifiques aux données (factures, budget) peuvent être écoutés ici pour mettre à jour l'UI.
      const socket = window.socket; // Accéder à la socket globale stockée dans App.jsx
      if (socket) {
         console.log("MainLayout: Setting up SocketIO listeners.");

         const handleNewFacture = (nf) => {
           console.log('SocketIO in MainLayout: new_facture received', nf);
           // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
           if (location.pathname.endsWith('/manage-invoices') && String(nf.annee) === anneeFinanciere) {
              console.log("MainLayout: Updating factures due to new_facture event.");
             // Option simple: Re-fetch (assure la cohérence)
             fetchFactures(anneeFinanciere);
             // Option plus complexe: Mettre à jour l'état local (peut nécessiter plus de logique pour l'ordre/unicité)
             // setFactures(prev => [nf, ...prev.filter(f => f.id !== nf.id)]);
           }
         };
          const handleDeleteFacture = (d) => {
             console.log('SocketIO in MainLayout: delete_facture received', d);
              // Mettre à jour la liste des factures uniquement si on est sur la bonne page
             if (location.pathname.endsWith('/manage-invoices')) {
                console.log("MainLayout: Updating factures due to delete_facture event.");
                 // Option simple: Re-fetch
                 fetchFactures(anneeFinanciere);
                 // Option plus complexe: Mettre à jour l'état local
                 // setFactures(prev => prev.filter(f => f.id !== d.id));
             }
          };
           const handleUpdateFacture = (uf) => {
              console.log('SocketIO in MainLayout: update_facture received', uf);
               // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
               if (location.pathname.endsWith('/manage-invoices') && String(uf.annee) === anneeFinanciere) {
                  console.log("MainLayout: Updating factures due to update_facture event.");
                 // Option simple: Re-fetch
                 fetchFactures(anneeFinanciere);
                 // Option plus complexe: Mettre à jour l'état local
                 // setFactures(prev => prev.map(f => f.id === uf.id ? uf : f));
              }
           };

         // Ajouter les listeners SocketIO pour les événements pertinents
         socket.on('new_facture', handleNewFacture);
         socket.on('delete_facture', handleDeleteFacture);
         socket.on('update_facture', handleUpdateFacture);

         // Ajoutez des listeners similaires pour les événements budget si nécessaire (new_budget, update_budget, delete_budget)
         // Ces événements devraient déclencher un re-fetch ou une mise à jour dans le composant BudgetDashboard.
         // BudgetDashboard devra soit écouter la socket globale lui-même, soit recevoir une prop pour déclencher son fetch.

         return () => {
            // Nettoyage des listeners SocketIO spécifiques à ce composant lors du démontage
            console.log("MainLayout: Cleaning up SocketIO listeners.");
            socket.off('new_facture', handleNewFacture);
            socket.off('delete_facture', handleDeleteFacture);
            socket.off('update_facture', handleUpdateFacture);
         };
      } else {
          console.log("MainLayout: SocketIO instance not found.");
           // Gérer le cas où la socket n'est pas disponible (ex: erreur de connexion initiale)
      }


  }, [anneeFinanciere, location.pathname, userRole /*, fetchBudget si vous l'utilisez ici pour socket updates*/]); // Dépendances


    // --- Fonctions API (utilisent authorizedFetch passé en prop) ---
    // Ces fonctions appellent le backend et sont passées aux composants enfants.
    // authorizedFetch, reçu en prop, gère l'ajout du token et la gestion des erreurs 401/403.

    // La fonction fetchFactures est définie et utilisée dans useEffect et potentiellement par des événements socket
    async function fetchFactures(year) {
         console.log(`TRACE : User role ${userRole}`);
         // Vérification de rôle UI (redondant avec backend mais pour UI rapide)
         if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
             console.warn("fetchFactures: Rôle UI insuffisant.");
             setFactures([]); // Vider les factures si le rôle UI ne permet pas
             return null;
         }
         try {
           console.log(`WorkspaceFactures: Récupération des factures pour l'année financière ${year}`);
           // Utiliser authorizedFetch ici
           const res = await authorizedFetch(`${API_URL}/api/factures?annee=${year}`);
           if (!res.ok) {
             // authorizedFetch a déjà géré les 401/403 et les alertes
             const errorText = await res.text(); // Tente de lire pour plus de détails
             throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
           }
           const data = await res.json();
           setFactures(data);
           return data;
         } catch (e) {
           console.error('fetchFactures: Erreur lors de la récupération des factures :', e);
            // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion
           if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
               // Afficher l'alerte uniquement pour les erreurs non gérées par authorizedFetch
               alert(`Erreur lors du chargement des factures : ${e.message}`);
           }
           setFactures([]); // S'assurer que la liste est vide en cas d'erreur
           return null;
         }
    }

    // addFacture, deleteFacture, updateFacture, exportFacturesCsv
    // Les définitions de ces fonctions sont copiées de l'ancien App.jsx
    // et modifiées pour :
    // 1. Appeler `authorizedFetch` au lieu de `Workspace` standard (sauf pour XMLHttpRequest dans addFacture, qui doit être adapté).
    // 2. Inclure une vérification de rôle UI au début pour l'expérience utilisateur.
    // 3. Gérer les erreurs 401/403 de la même manière que authorizedFetch (qui est déjà fait par authorizedFetch, mais pour XMLHttpRequest, il faut le faire manuellement).


    function addFacture(factureData) {
        // Vérification de rôle UI
         if (userRole !== 'soumetteur' && userRole !== 'gestionnaire') { // Exemple: seuls soumetteurs et gestionnaires peuvent ajouter
              alert("Vous n'avez pas le rôle nécessaire pour ajouter une facture.");
              return;
          }
        // // ... (création de formData et logique de progression/temps)
        // const file = factureData.fichier;
        
        // formData.append('annee', anneeFinanciere);
        // formData.append('type', factureData.type);
        // formData.append('ubr', factureData.ubr || '');
        // formData.append('fournisseur', factureData.fournisseur || '');
        // formData.append('description', factureData.description || '');
        // formData.append('montant', factureData.montant);
        // formData.append('statut', factureData.statut); // Le statut par défaut peut être 'Soumis' défini ici si pas géré par backend
        // if (file) {
        //   // Validation UI de la taille du fichier (déjà présente si copié)
        //   const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go
        //   if (file.size > MAX_FILE_SIZE_BYTES) {
        //      alert(`La taille du fichier (${(file.size / 1024 / 1024).toFixed(2)} MB) dépasse la limite autorisée (2 GB).`);
        //      return;
        //   }
        //   formData.append('fichier', file);
        // } else {
        //      // Si aucun fichier, s'assurer que le backend accepte
        //      // ou ajouter une validation si le fichier est requis pour certains types/statuts
        // }


        const startTime = Date.now();
        const totalBytes = file ? file.size : 0;

        setUploadProgress(0);
        setTimeLeft('');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/api/factures`);
        // AJOUT ESSENTIEL POUR XMLHttpRequest : Ajouter l'en-tête Authorization
         if (userToken) {
             xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
         } else {
             // Ce cas ne devrait pas arriver si la route est protégée et l'UI gérée, mais sécurité supplémentaire
             console.error("addFacture: Tentative d'upload sans token.");
             alert("Vous n'êtes pas connecté.");
             handleLogout(); // Déconnecter si jamais on atteint ce point sans token
             setUploadProgress(null);
             setTimeLeft('');
             return;
         }


        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentage = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(percentage);

              const elapsed = (Date.now() - startTime) / 1000; // secondes
              const bytesPerSecond = e.loaded / elapsed;
              const remainingBytes = e.total - e.loaded;
              const estimatedSecondsRemaining = remainingBytes / bytesPerSecond;

              const minutes = Math.floor(estimatedSecondsRemaining / 60);
              const seconds = Math.round(estimatedSecondsRemaining % 60);
              setTimeLeft(`${minutes}m ${seconds}s`);
            }
        };

        xhr.onload = () => {
             // AJOUT ESSENTIEL POUR XMLHttpRequest : Gérer spécifiquement les codes 401/403
            if (xhr.status === 401 || xhr.status === 403) {
                console.error(`addFacture: API ${xhr.status} Unauthorized/Forbidden lors de l'upload.`);
                 let errorMessage = xhr.status === 403 ? "Accès refusé." : "Votre session a expiré ou est invalide.";
                 try {
                     const errorData = JSON.parse(xhr.responseText);
                     errorMessage = errorData.error || errorMessage;
                 } catch (e) { /* ignore parse error */ }
                alert(errorMessage); // Informer l'utilisateur
                handleLogout(); // Forcer la déconnexion
                setUploadProgress(null);
                setTimeLeft('');
                return; // Arrêter le traitement
            }

            setUploadProgress(null);
            setTimeLeft('');
            if (!(xhr.status >= 200 && xhr.status < 300)) {
              console.error('addFacture: Échec de l\'upload :', xhr.status, xhr.responseText);
              alert('Erreur lors de l\'ajout de la facture.');
            } else {
              console.log('addFacture: Réponse du serveur :', xhr.responseText);
              let response;
              try {
                response = JSON.parse(xhr.responseText);
              } catch (e) {
                console.error('addFacture: Erreur de parsing JSON :', e);
                alert('Erreur lors du traitement de la réponse du serveur.');
                return;
              }
              // Recharger les factures si on est dans la vue manage-invoices pour cette année
              // et si SocketIO ne gère pas nativement cette mise à jour côté client pour l'émetteur
              //  if (location.pathname.endsWith('/manage-invoices') && String(response.annee) === anneeFinanciere) {
              //      fetchFactures(anneeFinanciere); // Recharger pour être sûr
              //  }
              if (location.pathname.endsWith('/manage-invoices')) { // C'EST ICI
                fetchFactures(anneeFinanciere); // Recharger pour être sûr
              }
              console.log('Facture ajoutée avec succès.');
               // Réinitialiser le formulaire si nécessaire dans FormFacture ou ici
            }
        };

        xhr.onerror = () => {
            setUploadProgress(null);
            setTimeLeft('');
            console.error('addFacture: Erreur réseau lors de l\'upload');
            alert('Erreur réseau lors de l\'ajout de la facture.');
        };

        xhr.send(factureData);
    }


    async function deleteFacture(id) {
        // Vérifier le rôle UI (la vérification backend est la sécurité finale)
         if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
             alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
             return false;
         }

         if (!window.confirm('Supprimer cette facture ?')) return false;

        try {
          // Utiliser authorizedFetch ici
          const res = await authorizedFetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, {
            method: 'DELETE',
          });
          if (!res.ok) {
             // authorizedFetch gère déjà les 401/403
             const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
             throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
           }
          console.log(`deleteFacture: Facture ${id} supprimée.`);
          // Pas besoin de re-fetch ici si SocketIO gère la suppression en temps réel pour tous
          // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
          fetchFactures(anneeFinanciere); // Recharger pour être sûr
          return true;
        } catch (e) {
           console.error('deleteFacture: Erreur lors de la suppression :', e);
           // authorizedFetch gère déjà les erreurs 401/403
           if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
              alert(`Erreur lors de la suppression de la facture : ${e.message}`);
           }
           return false;
        }
    }

    async function updateFacture(id, data) {
         // Vérifier le rôle UI
         if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
              alert("Vous n'avez pas le rôle nécessaire pour modifier une facture.");
              return false;
          }

        // ... (logique existante)
        try {
           // Utiliser authorizedFetch ici
           const res = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ ...data, annee: anneeFinanciere }),
           });
           if (!res.ok) {
                // authorizedFetch gère déjà les 401/403
                const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
                throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
              }
           console.log(`updateFacture: Facture ${id} mise à jour.`);
           // Pas besoin de re-fetch si SocketIO gère la mise à jour
           // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
           fetchFactures(anneeFinanciere); // Recharger pour être sûr
           return true;
        } catch (e) {
           console.error('updateFacture: Erreur lors de la mise à jour :', e);
           // authorizedFetch gère déjà les erreurs 401/403
            if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
               alert(`Erreur lors de la mise à jour de la facture : ${e.message}`);
            }
           return false;
        }
    }

     // Adapter downloadFile si nécessaire (pas besoin de rôle, mais utilise authorizedFetch)
     const downloadFile = async (factureId, annee) => {
          // Vérification de rôle UI (si nécessaire, mais probablement pas pour le download)
         // if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
         //      alert("Vous n'avez pas le rôle nécessaire pour télécharger un fichier.");
         //      return;
         //  }
         try {
             // Utiliser authorizedFetch ici
             const response = await authorizedFetch(`${API_URL}/api/factures/${factureId}/fichier?annee=${annee}`);

             if (!response.ok) {
                 // authorizedFetch gère déjà les 401/403. Gérer les autres erreurs spécifiques ici.
                 if (response.status === 404) {
                     alert('Fichier non trouvé.');
                     return;
                 }
                const errorText = await response.text();
                throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
             }

             // ... reste de la logique de téléchargement ...
              const blob = await response.blob();
              const disposition = response.headers.get('Content-Disposition');
              let filename = `facture_${factureId}_fichier`; // Nom par défaut
              if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                  filename = matches[1].replace(/['"]/g, '');
                }
              }

              // Créer un lien temporaire pour le téléchargement
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename; // Nom du fichier à télécharger
              document.body.appendChild(a);
              a.click();
              // Nettoyer après le téléchargement
              a.remove();
              window.URL.revokeObjectURL(url);
              console.log(`Fichier ${filename} téléchargé avec succès.`);

         } catch (error) {
             console.error('Erreur lors du téléchargement du fichier :', error);
              // authorizedFetch gère déjà les erreurs 401/403
              if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
                alert(`Erreur lors du téléchargement du fichier : ${error.message}`);
              }
         }
     };


    async function exportFacturesCsv() {
        // Vérifier le rôle UI
        if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
             alert("Vous n'avez pas le rôle nécessaire pour exporter les factures.");
             setIsSidebarOpen(false); // Fermer la sidebar même en cas d'échec de rôle côté UI
             return false;
         }

        try {
            const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
            console.log(`exportFacturesCsv: Exportation des factures pour l'année financière ${anneeFinanciere}...`);
            // Utiliser authorizedFetch ici
            const response = await authorizedFetch(exportUrl);

            if (!response.ok) {
               // authorizedFetch gère déjà les 401/403
               const errorText = await response.text();
               throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
            }

            // ... reste de la logique d'exportation ...
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

             console.log('exportFacturesCsv: Factures exportées avec succès.');
             return true;

        } catch (error) {
            console.error('exportFacturesCsv: Erreur lors de l\'exportation des factures :', error);
             // authorizedFetch gère déjà les erreurs 401/403
             if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
               alert(`Erreur lors de l'exportation des factures : ${error.message}`);
             }
            return false;
        } finally {
            setIsSidebarOpen(false); // Fermer la sidebar après l'action
        }
    }


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
        const res = await authorizedFetch(`${API_URL}/api/budget?annee=${year}`);
        if (!res.ok) {
            throw new Error(`fetchBudget HTTP ${res.status} – ${await res.text()}`);
        }
        return res.json();
    };

    // 2) Ajouter une entrée budgétaire
    const addBudgetEntry = async (entryData, anneeFinanciere) => {
        const payload = {
          financial_year: anneeFinanciere,  // clé attendue par votre backend
          fund_type:    entryData.fund_type,
          revenue_type: entryData.revenue_type,
          amount:       entryData.amount,
        };
      
        const res = await authorizedFetch(`${API_URL}/api/budget`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("addBudgetEntry:",res);
        
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


  /**
   * Gère le clic sur un élément du menu de la barre latérale.
   * - Navigue vers la route correspondante et ferme la barre latérale.
   * @param {string} view - Vue à afficher ('home', 'manage-invoices', 'manage-budget', 'manage-users').
   */
   const handleMenuItemClick = (view) => {
       // Utiliser navigate pour changer la route.
       // Les Routes dans le contenu principal (en dessous) géreront quel composant est rendu.
       navigate(`/dashboard/${view}`);
       setIsSidebarOpen(false);
   };


  // --- Rendu du Layout Principal ---
  return (
    <div className="relative min-h-screen">
      {/* En-tête - Position fixe */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow z-10 flex items-center justify-between p-4">
        {/* Gauche : Hamburger, Logo, Titre */}
        {/* Le clic sur le titre redirige vers l'accueil du dashboard */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center flex-grow sm:flex-grow-0 cursor-pointer"
          onClick={() => handleMenuItemClick('home')} // Redirige vers /dashboard/home
        >
          <div className="flex items-center mb-2 sm:mb-0 mr-6 sm:mr-8">
            <button
              className="
                p-2 mr-4 sm:mr-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors cursor-pointer
              "
              onClick={(e) => {
                e.stopPropagation(); // Empêche le clic de propager au div parent
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
        {/* Droite : Compteur de clients et bouton de déconnexion */}
        <div className="flex items-center">
           {/* Afficher le rôle de l'utilisateur s'il est défini */}
           {userRole && (
               <div className="hidden sm:flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-4">
                   Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)} {/* Capitalize first letter */}
               </div>
           )}
           {/* Afficher le compteur de clients */}
           <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm mr-4">
             Clients en ligne : {clientCount}
           </div>
           {/* Bouton de déconnexion */}
           <button
              onClick={handleLogout} // handleLogout est passé en prop depuis App.jsx
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
           >
              Déconnexion
           </button>
        </div>
      </div>

      {/* Superposition pour la barre latérale (cliquer pour fermer) */}
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
          {/* Éléments du menu - Rendu conditionnel basé sur le rôle */}
          <ul>
            {/* Lien Accueil */}
            <li>
              <button
                onClick={() => handleMenuItemClick('home')}
                // Utiliser location.pathname pour déterminer la vue active
                className={`block w-full text-left py-2 px-2 rounded-md ${
                  currentSubView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Accueil
              </button>
            </li>
            {/* Lien Gérer les factures (accessible si rôle permet) */}
             {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
                 <li>
                   <button
                     onClick={() => handleMenuItemClick('manage-invoices')}
                     className={`block w-full text-left py-2 px-2 rounded-md ${
                       currentSubView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                     }`}
                   >
                     Gérer les factures
                   </button>
                 </li>
             )}
            {/* Lien Gérer le budget (accessible si rôle permet) */}
             {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                 <li>
                   <button
                     onClick={() => handleMenuItemClick('manage-budget')}
                     className={`block w-full text-left py-2 px-2 rounded-md ${
                       currentSubView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                     }`}
                   >
                     Gérer le budget
                   </button>
                 </li>
             )}
             {/* Lien Gérer les utilisateurs (accessible si gestionnaire) */}
              {userRole === 'gestionnaire' && (
                  <li>
                    <button
                      onClick={() => handleMenuItemClick('manage-users')}
                      className={`block w-full text-left py-2 px-2 rounded-md ${
                        currentSubView === 'manage-users' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Gérer les utilisateurs
                    </button>
                  </li>
              )}
             {/* Lien Exporter en CSV (accessible si rôle permet) */}
            {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                 <li>
                   <button
                     onClick={exportFacturesCsv} // Cette fonction contient déjà une vérification de rôle UI et appel authorizedFetch
                     className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
                   >
                     Exporter en CSV
                   </button>
                 </li>
             )}
          </ul>
        </div>
        {/* Compteur de clients et rôle dans le pied de page (mobile uniquement) */}
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

      {/* Contenu Principal - Utiliser Routes pour les sous-vues de /dashboard */}
      {/* Le pt-40 sm:pt-75 doit laisser de la place pour l'en-tête fixe */}
      <div className="container mx-auto px-4 pb-4 pt-40 sm:pt-75 transition-all duration-300">
         <Routes> {/* Les routes enfants de /dashboard. Ces routes sont rendues si la route parente (/dashboard) est active. */}
            {/* Route Accueil du Dashboard */}
            <Route path="home" element={
                 <div className="text-center mt-10">
                   {/* Afficher un message de bienvenue avec le rôle */}
                   <h2 className="text-2xl font-semibold text-gray-700">Bienvenue, {userRole}!</h2>
                   <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
                 </div>
            } />

            {/* Route Gérer les factures (accessible si rôle permet) */}
            {/* Le composant ne sera monté que si la route correspond ET si le rôle permet */}
            {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
                <Route path="manage-invoices" element={
                    <>
                      {/* Le formulaire d'ajout (peut être restreint aux soumetteurs et gestionnaires par exemple) */}
                       {(userRole === 'soumetteur' || userRole === 'gestionnaire') && (
                           <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                             <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
                             {uploadProgress !== null && ( /* Afficher la progression si upload en cours */
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
                             {/* Passer les fonctions nécessaires à FormFacture */}
                             <FormFacture onSubmit={addFacture} annee={anneeFinanciere} setAnnee={setAnneeFinanciere} />
                           </div>
                       )}

                      {/* Le tableau des factures */}
                      <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                        <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
                        {/* Passer les factures, les fonctions de gestion et le rôle à TableFactures */}
                        <TableFactures factures={factures} onDelete={deleteFacture} onUpdate={updateFacture} downloadFile={downloadFile} userRole={userRole} />
                      </div>
                    </>
                } />
            )}


                  {/* Route Gérer le budget (accessible si rôle permet) */}
                  {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                      <Route path="manage-budget" element={
                          <BudgetDashboard
                              anneeFinanciere={anneeFinanciere}
                              fetchBudget={fetchBudget}                              
                              authorizedFetch={authorizedFetch}     // <— ajouté
                              API_URL={API_URL}                     // <— ajouté
                              addBudgetEntry={addBudgetEntry}                              
                              updateBudgetEntry={updateBudgetEntry}
                              deleteBudgetEntry={deleteBudgetEntry}
                              verifyPin={verifyPin}
                              userRole={userRole}
                              // PASSER UNE FONCTION QUI UTILISE authorizedFetch POUR RECUPERER LES FACTURES
                              fetchFacturesForBudget={() => fetchFactures(anneeFinanciere)} // Nouvelle prop
                          />
                          // Note : BudgetDashboard semble fetch ses propres factures pour les dépenses,
                          // assurez-vous qu'il utilise authorizedFetch pour cela.
                          // Si fetchFactures ou factures étaient utilisés ici avant pour BudgetDashboard,
                          // ils ont été retirés car BudgetDashboard est maintenant plus autonome pour ses données.

                      } />
                  )}

             {/* Route Gérer les utilisateurs (accessible si gestionnaire) */}
              {userRole === 'gestionnaire' && (
                  <Route path="manage-users" element={
                      <UserManagement
                         authorizedFetch={authorizedFetch} // Passer la fonction fetch sécurisée
                         // Optionnel: passer l'ID et le rôle de l'utilisateur courant pour logique UI (ex: ne pas modifier son propre rôle)
                         // currentUserId={userId} // Si userId est stocké et passé en prop
                         currentUserRole={userRole} // Le rôle est déjà passé
                      />
                  } />
              )}


            {/* Route par défaut pour /dashboard (redirige vers /dashboard/home) */}
             {/* Cette route catchera /dashboard s'il n'y a rien après */}
             <Route index element={<Navigate to="home" replace />} />
             {/* ou <Route path="" element={<Navigate to="home" replace />} /> */}


            {/* Gérer les URLs invalides sous /dashboard (ex: /dashboard/abc) */}
             {/* Redirige vers l'accueil du dashboard si la sous-route n'est pas trouvée */}
             <Route path="*" element={<Navigate to="home" replace />} />


         </Routes>

      </div>
    </div>
  );
}

export default MainLayout;




/////////////////////////////////////////////

// // src/components/MainLayout.jsx
// // Ce composant contient la structure principale de l'application une fois l'utilisateur connecté.
// // Il gère l'affichage des différentes vues (factures, budget, utilisateurs) via les sous-routes du dashboard
// // et adapte l'interface utilisateur en fonction du rôle de l'utilisateur connecté.
// // Il gère également l'état global des factures et les interactions avec l'API backend.

// import React, { useState, useEffect, useCallback } from 'react'; // Importez useCallback
// import FormFacture from './FormFacture';
// import TableFactures from './TableFactures';
// import BudgetDashboard from './BudgetDashboard';
// import UserManagement from './UserManagement';
// import logo from '../Logo Habitek_WEB_Transparent-06.png';

// import { useNavigate, useLocation, Routes, Route, Navigate, Link } from 'react-router-dom'; // Importez Link

// // Configuration des URLs pour l'API
// const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

// // -----------------------------------
// // Fonctions Utilitaires
// // -----------------------------------

// /**
//  * Détermine l'année financière (1er mai au 30 avril).
//  * @param {Date} [date=new Date()] - Date à évaluer.
//  * @returns {string} Année financière (ex: '2024' pour mai 2024 à avril 2025).
//  */
// const getFinancialYear = (date = new Date()) => {
//   const currentYear = date.getFullYear();
//   const currentMonth = date.getMonth(); // getMonth() retourne 0 pour Janvier, 11 pour Décembre

//   // Si le mois est avant mai (0 à 3), l'année financière est l'année précédente
//   if (currentMonth < 4) { // 4 représente Mai
//     return String(currentYear - 1);
//   } else {
//     // Sinon (mai à décembre), l'année financière est l'année en cours
//     return String(currentYear);
//   }
// };

// // -----------------------------------
// // Composant MainLayout
// // -----------------------------------

// function MainLayout() {
//   // -----------------------------------
//   // Hooks et États
//   // -----------------------------------
//   const navigate = useNavigate();
//   const location = useLocation();

//   // État pour l'année financière sélectionnée/courante
//   const [annee, setAnnee] = useState(getFinancialYear());
//   // État pour stocker les factures (inclura les nouvelles colonnes et noms d'utilisateur de l'API)
//   const [factures, setFactures] = useState([]);
//   // État pour indiquer si le chargement est en cours
//   const [loading, setLoading] = useState(false);
//   // État pour gérer les erreurs (peut être étendu pour des messages spécifiques)
//   const [error, setError] = useState(null);
//   // État pour stocker le rôle de l'utilisateur (récupéré du localStorage)
//   const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));
//    // État pour stocker l'ID de l'utilisateur (utile pour certaines logiques UI/permissions comme modifier sa propre facture)
//    const [userId, setUserId] = useState(localStorage.getItem('userId'));


//   // -----------------------------------
//   // Fonctions d'API (Utilisant authorizedFetch)
//   // -----------------------------------

//     /**
//      * Effectue une requête fetch sécurisée en ajoutant le token JWT.
//      * Gère automatiquement la déconnexion si le token est invalide ou expiré (401, 403).
//      * @param {string} url - L'URL de l'API.
//      * @param {Object} [options={}] - Options pour la requête fetch (méthode, headers, body, etc.).
//      * @returns {Promise<Response>} La réponse de la requête fetch.
//      * @throws {Error} Lance une erreur si la réponse n'est pas OK, si 401/403 se produit, ou si une erreur réseau se produit.
//      */
//     const authorizedFetch = useCallback(async (url, options = {}) => {
//         const token = localStorage.getItem('token');
//         if (!token) {
//             console.error("authorizedFetch: Aucun token trouvé.");
//             // Pas de token, rediriger vers la page de connexion
//             navigate('/login');
//             // Lancer une erreur pour arrêter l'exécution du code appelant
//             throw new Error("Aucun token trouvé. Redirection vers la page de connexion.");
//         }

//         // Ajouter le header Authorization avec le token JWT
//         // Important : NE PAS ajouter Content-Type manuellement ici si body est un FormData
//         const headers = new Headers(options.headers); // Utiliser l'objet Headers pour une meilleure gestion
//         headers.set('Authorization', `Bearer ${token}`);

//         // Si le corps est un objet JSON, ajouter le header Content-Type
//         if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
//              headers.set('Content-Type', 'application/json');
//              options.body = JSON.stringify(options.body); // Stringifier l'objet JSON
//          } else if (options.body && options.body instanceof FormData) {
//              // Si c'est un FormData, ne pas définir le Content-Type, le navigateur s'en charge
//              headers.delete('Content-Type'); // S'assurer qu'il n'est pas défini par inadvertance
//          }
//         // Pour les autres types de body (string, Blob, etc.), le navigateur gère.

//         try {
//             const response = await fetch(url, {
//                 ...options,
//                 headers: headers, // Utiliser l'objet Headers préparé
//             });

//             // Gérer les erreurs d'authentification/autorisation
//             if (response.status === 401 || response.status === 403) {
//                 console.error("authorizedFetch: Erreur d'authentification ou d'autorisation:", response.status, response.statusText);
//                 // Retirer le token invalide et les infos utilisateur
//                 localStorage.removeItem('token');
//                 localStorage.removeItem('userRole');
//                 localStorage.removeItem('userId');
//                 // Afficher un message à l'utilisateur
//                 alert("Votre session a expiré ou vous n'avez pas les permissions nécessaires. Veuillez vous reconnecter.");
//                 // Rediriger vers la page de connexion
//                 navigate('/login');
//                  // Lancer une erreur pour arrêter l'exécution du code appelant
//                 throw new Error("Session expirée ou permissions insuffisantes.");
//             }

//             // Si la réponse n'est pas OK (mais pas 401/403), lancer une erreur générique
//             if (!response.ok) {
//                  let errorDetail = `Erreur HTTP ${response.status}: ${response.statusText}`;
//                  try {
//                      // Tenter de lire le corps de la réponse JSON pour plus de détails
//                      const errorJson = await response.json();
//                      if (errorJson && errorJson.error) {
//                          errorDetail += ` - Détails : ${errorJson.error}`;
//                      } else if (errorJson) {
//                           errorDetail += ` - Détails : ${JSON.stringify(errorJson)}`;
//                      }
//                  } catch (e) {
//                      // Si le corps n'est pas JSON, tenter de lire comme texte
//                      try {
//                           const errorText = await response.text();
//                           if (errorText) errorDetail += ` - Corps de la réponse : ${errorText}`;
//                      } catch (e) {
//                          console.warn("authorizedFetch: Impossible de lire le corps de l'erreur");
//                      }
//                  }
//                 console.error("authorizedFetch:", errorDetail);
//                 // Lancer une erreur avec plus de détails
//                 throw new Error(errorDetail);
//             }

//             return response; // Retourner la réponse si tout va bien

//         } catch (err) {
//             // Gérer les erreurs réseau ou les erreurs lancées ci-dessus
//             console.error("authorizedFetch: Erreur lors de l'appel fetch:", err);
//             // Lancer l'erreur pour qu'elle soit capturée par les fonctions appelantes (fetchFactures, addFacture, etc.)
//             throw err;
//         }
//     }, [navigate]); // Dépendance : recreate authorizedFetch si navigate change


//   /**
//    * Récupère la liste des factures pour l'année sélectionnée depuis l'API.
//    * Utilise authorizedFetch.
//    */
//    const fetchFactures = useCallback(async () => {
//       setLoading(true);
//       setError(null); // Réinitialiser les erreurs précédentes
//       try {
//           // La route backend GET /api/factures accepte maintenant un paramètre 'year'
//           const response = await authorizedFetch(`${API_URL}/api/factures?year=${annee}`);
//           const data = await response.json();
//           // La structure de données 'data' contient maintenant les nouvelles colonnes et les noms d'utilisateur
//           setFactures(data);
//       } catch (err) {
//           // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion/alert
//           // Gérer ici les autres erreurs si nécessaire
//           // Le message d'erreur est déjà affiché par authorizedFetch
//           setError("Échec du chargement des factures."); // Message d'erreur générique UI
//           console.error("Erreur lors de la récupération des factures:", err);
//       } finally {
//           setLoading(false);
//       }
//   }, [annee, authorizedFetch]); // Dépendances: refetch quand l'année ou authorizedFetch change


//   /**
//    * Ajoute une nouvelle facture en envoyant les données (FormData) à l'API.
//    * Utilise authorizedFetch.
//    * @param {FormData} newFactureData - Objet FormData contenant les données de la facture et le fichier optionnel.
//    */
//    const addFacture = async (newFactureData) => { // newFactureData est l'objet FormData reçu de FormFacture
//       setLoading(true);
//       setError(null);
//       try {
//           // Appeler l'API POST /api/factures avec authorizedFetch
//           // newFactureData est un FormData, authorizedFetch gère les headers automatiquement.
//           const response = await authorizedFetch(`${API_URL}/api/factures`, {
//               method: 'POST',
//               body: newFactureData, // Passer l'objet FormData directement comme corps de la requête
//               // authorizedFetch gère le header Content-Type pour FormData
//           });

//           // Si la réponse est OK (statut 2xx), on peut considérer l'ajout réussi
//           // Le backend émet un événement SocketIO 'new_facture'.
//           // Si vous n'utilisez pas SocketIO pour mettre à jour l'UI, rafraîchissez la liste :
//           fetchFactures(); // Rafraîchir la liste pour voir la nouvelle facture

//           alert("Facture ajoutée avec succès !");

//       } catch (err) {
//           // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion/alert, et affiche les détails si 409.
//           // Gérer ici les autres actions post-erreur si nécessaire (ex: logging avancé)
//           setError("Échec de l'ajout de la facture."); // Message d'erreur générique UI

//            // authorizedFetch lance une erreur avec un message détaillé
//            alert(`Erreur lors de l'ajout : ${err.message}`); // Afficher le message détaillé à l'utilisateur

//       } finally {
//           setLoading(false);
//       }
//   };


//    /**
//     * Met à jour une facture existante en envoyant les données (FormData ou JSON) à l'API.
//     * Utilise authorizedFetch.
//     * @param {number} id - ID de la facture à mettre à jour.
//     * @param {Object|FormData} updatedData - Les données mises à jour. Peut être un objet simple (JSON)
//     * ou FormData si un fichier est impliqué ou remove_file.
//     */
//     // Cette fonction est appelée par TableFactures (pour le statut) ou par un formulaire d'édition.
//    const updateFacture = async (id, updatedData) => {
//        setLoading(true);
//        setError(null);
//        try {
//            // authorizedFetch gère déjà si c'est FormData ou JSON et définit les headers/body.
//            const response = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
//                method: 'PUT',
//                body: updatedData, // updatedData est soit un objet JSON, soit un FormData
//                // authorizedFetch gère le header Content-Type
//            });

//            // Si la réponse est OK (statut 2xx), c'est réussi
//            // Le backend émet un événement SocketIO 'update_facture'.
//            // Si vous n'utilisez pas SocketIO pour mettre à jour l'UI, rafraîchissez la liste :
//            fetchFactures(); // Rafraîchir la liste pour voir la facture mise à jour

//            alert("Facture mise à jour avec succès !");

//        } catch (err) {
//            // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion/alert, et affiche les détails si 409.
//            // Gérer ici les autres actions post-erreur si nécessaire
//            setError("Échec de la mise à jour de la facture."); // Message d'erreur générique UI
//            alert(`Erreur lors de la mise à jour : ${err.message}`); // Afficher le message détaillé à l'utilisateur

//        } finally {
//            setLoading(false);
//        }
//    };


//   /**
//    * Supprime une facture via l'API.
//    * Utilise authorizedFetch.
//    * @param {number} id - ID de la facture à supprimer.
//    */
//    // Cette fonction est appelée par TableFactures.
//    const deleteFacture = async (id) => {
//       setLoading(true);
//       setError(null);
//       try {
//           // Appeler l'API DELETE /api/factures/:id avec authorizedFetch
//           const response = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
//               method: 'DELETE',
//           });

//           // Si la réponse est OK (statut 2xx), c'est réussi
//           // Le backend émet un événement SocketIO 'delete_facture'.
//           // Si vous n'utilisez pas SocketIO pour mettre à jour l'UI, rafraîchissez la liste :
//           fetchFactures(); // Rafraîchir la liste

//           alert("Facture supprimée avec succès !");

//       } catch (err) {
//            // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion/alert, et affiche les détails.
//            // Gérer ici les autres actions post-erreur si nécessaire
//            setError("Échec de la suppression de la facture."); // Message d'erreur générique UI
//            alert(`Erreur lors de la suppression : ${err.message}`); // Afficher le message détaillé à l'utilisateur
//       } finally {
//           setLoading(false);
//       }
//    };


//    /**
//     * Télécharge le fichier associé à une facture via l'API.
//     * Utilise authorizedFetch.
//     * @param {number} id - ID de la facture.
//     * @param {string} anneeFacture - Année de la facture (inutilisée par notre backend /api/factures/:id/fichier, mais gardée si nécessaire pour d'autres logiques).
//     */
//     // Cette fonction est appelée par TableFactures.
//    const downloadFile = async (id, anneeFacture) => { // anneeFacture est passé en paramètre si vous en avez besoin pour une raison quelconque
//        setLoading(true);
//        setError(null);
//        try {
//            // L'URL du backend pour le téléchargement est /api/factures/<int:id>/fichier
//            const fileUrl = `${API_URL}/api/factures/${id}/fichier`;

//            const response = await authorizedFetch(fileUrl);

//            // authorizedFetch a déjà géré les erreurs 401/403 et non-OK (status >= 400).
//            // Si on arrive ici, la réponse est OK (status 2xx).

//            // Obtenir le nom du fichier à partir des headers Content-Disposition si possible
//            const contentDisposition = response.headers.get('Content-Disposition');
//            let filename = `facture_${id}_fichier`; // Nom par défaut si Content-Disposition est absent ou mal formé
//            if (contentDisposition) {
//                const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"]*)[';]/i);
//                if (filenameMatch && filenameMatch[1]) {
//                    filename = decodeURIComponent(filenameMatch[1].replace(/%../g, decodeURIComponent));
//                } else {
//                    // Fallback pour les noms de fichiers simples sans encodage
//                     const simpleFilenameMatch = contentDisposition.match(/filename="(.+)"/);
//                     if (simpleFilenameMatch && simpleFilenameMatch[1]) {
//                         filename = simpleFilenameMatch[1];
//                     }
//                }
//            }


//            // Obtenir le contenu du fichier en tant que Blob
//            const blob = await response.blob();

//            // Créer un lien temporaire pour télécharger le fichier
//            const url = window.URL.createObjectURL(blob);
//            const a = document.createElement('a');
//            a.href = url;
//            a.download = filename; // Utilise le nom de fichier extrait ou par défaut
//            document.body.appendChild(a);
//            a.click();

//            // Nettoyer l'objet URL temporaire
//            window.URL.revokeObjectURL(url);
//            document.body.removeChild(a);

//            // alert("Fichier téléchargé avec succès !"); // L'alerte peut être ennuyeuse, optionnel.

//        } catch (err) {
//             // authorizedFetch gère déjà les erreurs 401/403 et réseau.
//             // L'erreur avec le message détaillé est déjà lancée par authorizedFetch.
//             // Gérer ici si vous voulez un comportement différent post-erreur (ex: afficher un message spécifique à l'utilisateur)
//             setError("Échec du téléchargement du fichier."); // Message d'erreur générique UI
//              // Le message détaillé est dans err.message si vous voulez l'utiliser dans une alerte
//              alert(`Échec du téléchargement du fichier : ${err.message}`);
//        } finally {
//            setLoading(false);
//        }
//    };


//   // -----------------------------------
//   // Effets (useEffect)
//   // -----------------------------------

//   // Effet pour charger les factures lorsque l'année change ou au montage initial
//   useEffect(() => {
//     // Vérifier si l'utilisateur est connecté avant de charger les factures
//     // Le token et le rôle sont des indicateurs de connexion
//     const token = localStorage.getItem('token');
//     const role = localStorage.getItem('userRole');
//      // Charger les factures uniquement si un token et un rôle sont présents
//     if (token && role) {
//          // Mettre à jour l'état local du rôle et de l'id au cas où localStorage a été modifié ailleurs
//           setUserRole(role);
//           setUserId(localStorage.getItem('userId')); // S'assurer que userId est également mis à jour
//          fetchFactures(); // Charger les factures pour l'année courante/sélectionnée
//     } else {
//          // Si pas connecté (pas de token ou rôle), rediriger vers la page de login
//          console.log("Aucun token ou rôle trouvé dans localStorage. Redirection vers /login.");
//          navigate('/login');
//     }

//     // L'effet dépend de l'année et de la fonction fetchFactures
//     // authorizedFetch est une dépendance de fetchFactures, useCallBack sur authorizedFetch
//     // assure que fetchFactures n'est pas recréée inutilement tant que navigate ne change pas.
//   }, [annee, fetchFactures, navigate]);


//     // Effet pour gérer les événements SocketIO (si vous utilisez SocketIO)
//     // Vous pourriez écouter ici les événements 'new_facture', 'update_facture', 'delete_facture'
//     // émis par le backend pour mettre à jour l'état 'factures' en temps réel
//     // au lieu de faire un fetchFactures() complet après chaque opération.
//     /*
//     useEffect(() => {
//         // Assurez-vous que 'socket' (votre instance SocketIO client) est importée et accessible ici
//         // Ex: import { socket } from '../services/socket';
//         if (socket) {
//             // Écouter les événements d'ajout, mise à jour et suppression de factures
//             socket.on('new_facture', (newFacture) => {
//                 console.log("Nouvelle facture reçue via SocketIO:", newFacture);
//                 // Ajouter la nouvelle facture à l'état 'factures' si elle correspond à l'année courante
//                  const factureYear = new Date(newFacture.date_facture).getFullYear();
//                 if (String(factureYear) === annee) { // Comparer l'année de la facture avec l'année affichée
//                      setFactures(prevFactures => [...prevFactures, newFacture]);
//                 }
//                  // Optionnel: Afficher une notification UI
//             });

//             socket.on('update_facture', (updatedFacture) => {
//                 console.log("Facture mise à jour via SocketIO:", updatedFacture);
//                 // Mettre à jour la facture correspondante dans l'état 'factures' si elle est dans l'année courante
//                 const factureYear = new Date(updatedFacture.date_facture).getFullYear();
//                  if (String(factureYear) === annee) {
//                     setFactures(prevFactures =>
//                         prevFactures.map(facture =>
//                             facture.id === updatedFacture.id ? updatedFacture : facture
//                         )
//                     );
//                  } else {
//                      // Si la facture a changé d'année, la retirer de la liste actuelle
//                      setFactures(prevFactures => prevFactures.filter(facture => facture.id !== updatedFacture.id));
//                  }
//                  // Optionnel: Afficher une notification UI
//             });

//             socket.on('delete_facture', (deletedFactureId) => {
//                  console.log("Facture supprimée via SocketIO:", deletedFactureId);
//                  // Retirer la facture de l'état 'factures'
//                  setFactures(prevFactures =>
//                      prevFactures.filter(facture => facture.id !== deletedFactureId)
//                  );
//                  // Optionnel: Afficher une notification UI
//              });

//             // Nettoyage : se désabonner des événements SocketIO lors du démontage du composant
//             return () => {
//                 socket.off('new_facture');
//                 socket.off('update_facture');
//                 socket.off('delete_facture');
//             };
//         }
//         // Cet effet dépend de 'socket', 'setFactures', et 'annee' (pour filtrer les mises à jour)
//     }, [socket, setFactures, annee]); // Assurez-vous que 'socket' est accessible ou passé ici
//     */


//   // -----------------------------------
//   // Rendu du Composant
//   // -----------------------------------

//   // Vérifier si le rôle de l'utilisateur permet de voir la liste des factures
//   const canViewFactures = userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole);
//   // Vérifier si le rôle de l'utilisateur permet d'ajouter une facture (selon votre logique métier et backend)
//   const canAddFacture = userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole);
//    // Vérifier si le rôle de l'utilisateur permet de voir le budget (selon votre logique métier et backend)
//    const canViewBudget = userRole && ['gestionnaire', 'approbateur'].includes(userRole);
//    // Vérifier si le rôle de l'utilisateur permet de gérer les utilisateurs (selon votre logique métier et backend)
//    const canManageUsers = userRole === 'gestionnaire'; // Seul gestionnaire peut gérer les utilisateurs


//   return (
//     <div className="min-h-screen bg-gray-100 flex">
//       {/* Barre de navigation latérale (Sidebar) */}
//       <aside className="w-64 bg-white shadow-md p-4">
//         <div className="mb-6 text-center">
//           <img src={logo} alt="Habitek Logo" className="mx-auto h-16 w-auto" />
//            {/* Afficher l'année financière courante/sélectionnée */}
//            <p className="mt-2 text-lg font-semibold text-gray-800">Année {annee}</p>
//            {/* Optionnel: Ajouter un sélecteur d'année ici si vous voulez permettre de naviguer entre années */}
//            {/* Si vous ajoutez un sélecteur, il doit mettre à jour l'état 'annee' local */}
//            {/*
//            <select
//                value={annee}
//                onChange={e => setAnnee(e.target.value)}
//                className="mt-2 p-1 border rounded text-sm"
//            >
//                // Générer des options d'année, par exemple les 5 dernières et les 2 prochaines
//                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
//                    <option key={y} value={String(y)}>{y}</option> // Assurez-vous que la valeur est une chaîne
//                ))}
//            </select>
//            */}
//         </div>
//         <nav>
//           <ul>
//              {/* Lien vers la page d'accueil du Dashboard (peut afficher les factures par défaut) */}
//              {/* Note: La route par défaut '/' redirige vers '/login'. Une fois loggé, la navigation initiale doit être vers '/dashboard'.
//                        La route '<Route path="/" element={<Navigate to="/login" replace />} />' dans App.jsx gère la redirection initiale si pas connecté.
//                        Les routes DANS MainLayout sont sous '/dashboard/*'. La route index "<Route index element={<Navigate to="home" replace />} />"
//                        redirige '/dashboard' vers '/dashboard/home'. */}
//              <li className="mb-2">
//                 {/* Utiliser Link pour la navigation interne */}
//                 <Link to="home" className={`block p-2 rounded-md ${location.pathname === '/dashboard' || location.pathname === '/dashboard/home' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
//                    Accueil Dashboard
//                 </Link>
//              </li>
//             {/* Lien vers la page des Factures (qui affichera le formulaire et le tableau) */}
//             {canViewFactures && ( // Afficher le lien Factures si le rôle permet de voir les factures
//                 <li className="mb-2">
//                     <Link to="factures" className={`block p-2 rounded-md ${location.pathname.startsWith('/dashboard/factures') ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
//                         Factures
//                     </Link>
//                 </li>
//             )}
//             {/* Lien vers la page Budget (si le rôle permet de voir le budget) */}
//              {canViewBudget && ( // Adapter selon la logique d'affichage de BudgetDashboard
//                 <li className="mb-2">
//                     <Link to="budget" className={`block p-2 rounded-md ${location.pathname.startsWith('/dashboard/budget') ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
//                         Budget
//                     </Link>
//                 </li>
//             )}

//             {/* Lien vers la gestion des utilisateurs (si le rôle est gestionnaire) */}
//              {canManageUsers && ( // Seul gestionnaire peut gérer les utilisateurs
//                 <li className="mb-2">
//                      <Link to="manage-users" className={`block p-2 rounded-md ${location.pathname.startsWith('/dashboard/manage-users') ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-200'}`}>
//                         Gérer les utilisateurs
//                     </Link>
//                 </li>
//              )}

//             {/* Bouton de Déconnexion */}
//             <li className="mb-2">
//               <button
//                 onClick={() => {
//                   localStorage.removeItem('token');
//                   localStorage.removeItem('userRole');
//                    localStorage.removeItem('userId'); // Retirer l'ID aussi
//                    // Optionnel: Déconnecter le client SocketIO si utilisé (ajustez si vous l'avez implémenté)
//                    // if (socket) socket.disconnect();
//                   navigate('/login'); // Rediriger vers la page de connexion
//                 }}
//                 className="block w-full text-left p-2 rounded-md text-gray-700 hover:bg-gray-200"
//               >
//                 Déconnexion
//               </button>
//             </li>
//           </ul>
//         </nav>
//       </aside>

//       {/* Contenu principal (basé sur les sous-routes) */}
//       <div className="flex-1 p-6">
//         {/* Afficher l'indicateur de chargement ou d'erreur si pertinent */}
//         {loading && <div className="text-center text-blue-600">Chargement...</div>}
//         {/* L'affichage de l'erreur est géré par les alertes dans les fonctions API, mais on peut aussi l'afficher ici si on préfère */}
//         {/* {error && <div className="text-center text-red-600">Erreur : {error}</div>} */}


//         {/* Définition des sous-routes du dashboard */}
//          <Routes>
//              {/* Route par défaut pour /dashboard/home (peut afficher un message d'accueil ou les factures par défaut) */}
//              <Route path="home" element={<h1 className="text-2xl font-bold mb-4">Accueil du Dashboard</h1>} />


//              {/* Route pour l'ajout et l'affichage des factures */}
//               <Route path="factures" element={
//                  // Condition pour afficher le contenu des factures
//                   canViewFactures ? ( // N'afficher ce bloc que si l'utilisateur a la permission de voir les factures
//                       <>
//                           {/* Afficher le formulaire d'ajout de facture si le rôle le permet */}
//                            {canAddFacture && ( // N'afficher le formulaire que si le rôle permet d'ajouter
//                                <div className="mb-6">
//                                    <h2 className="text-xl font-semibold mb-4">Ajouter une Nouvelle Facture</h2>
//                                     {/* Passer la fonction addFacture au formulaire via la prop onSubmit */}
//                                     {/* Passer l'année financière actuelle */}
//                                     {/* initialData est commenté car ce FormFacture est utilisé pour la création ici */}
//                                    <FormFacture onSubmit={addFacture} annee={annee} /> {/* setAnnee n'est pas passé si l'année n'est pas gérée dans le formulaire */}
//                                </div>
//                            )}


//                           {/* Afficher le tableau des factures si le rôle le permet (canViewFactures est déjà vérifié au-dessus) */}
//                            <h2 className="text-xl font-semibold mb-4">Liste des Factures ({annee})</h2>
//                            {/* Passer la liste des factures, les fonctions d'action, et le rôle au tableau */}
//                             <TableFactures
//                                 factures={factures} // Le tableau reçoit les factures
//                                 onDelete={deleteFacture} // Passer la fonction deleteFacture
//                                 onUpdate={updateFacture} // Passer la fonction updateFacture
//                                 downloadFile={downloadFile} // Passer la fonction downloadFile
//                                 userRole={userRole} // Passer le rôle pour la logique UI de permissions
//                                 // userId={userId} // Passer l'ID utilisateur si TableFactures en a besoin (ex: pour permission d'éditer SA facture)
//                             />
//                       </>
//                   ) : (
//                       // Message si le rôle ne permet pas de voir les factures
//                        <div className="text-center text-red-600">
//                            Vous n'avez pas les permissions pour voir les factures.
//                        </div>
//                   )
//               } />

//              {/* Route pour le Dashboard Budget */}
//              <Route path="budget" element={
//                  // Afficher le BudgetDashboard uniquement si le rôle le permet
//                  canViewBudget ? (
//                       // Votre composant BudgetDashboard doit gérer lui-même ses données via authorizedFetch
//                      <BudgetDashboard
//                          authorizedFetch={authorizedFetch} // Passer la fonction fetch sécurisée
//                          userRole={userRole} // Passer le rôle pour les permissions UI/logique interne de BudgetDashboard
//                          currentFinancialYear={annee} // Passer l'année si BudgetDashboard en a besoin
//                          // L'original passait PinModal et apiBaseUrl, mais c'est mieux de gérer cela DANS BudgetDashboard
//                      />
//                  ) : (
//                      // Message si le rôle ne permet pas de voir le budget
//                       <div className="text-center text-red-600">
//                            Vous n'avez pas les permissions pour voir le budget.
//                        </div>
//                  )
//              } />

//              {/* Route Gérer les utilisateurs (accessible si gestionnaire) */}
//               <Route path="manage-users" element={
//                   // Afficher UserManagement uniquement si le rôle le permet
//                    canManageUsers ? ( // Seul le rôle 'gestionnaire' peut accéder à cette route
//                       <UserManagement
//                          authorizedFetch={authorizedFetch} // Passer la fonction fetch sécurisée
//                          currentUserId={userId} // Passer l'ID de l'utilisateur courant pour la logique UI (ex: ne pas modifier/supprimer son propre compte)
//                          currentUserRole={userRole} // Le rôle est déjà passé
//                       />
//                    ) : (
//                        // Message si le rôle ne permet pas la gestion des utilisateurs
//                        <div className="text-center text-red-600">
//                            Vous n'avez pas les permissions pour gérer les utilisateurs.
//                        </div>
//                    )
//               } />


//             {/* Route par défaut pour /dashboard (redirige vers /dashboard/home) */}
//              {/* Cette route catchera /dashboard s'il n'y a rien après */}
//              <Route index element={<Navigate to="home" replace />} />
//              {/* Si vous voulez que /dashboard affiche directement les factures par défaut,
//                  vous pouvez changer cette route pour <Route index element={<Navigate to="factures" replace />} />
//                  ou mettre le contenu des factures directement dans le composant de la route index. */}


//             {/* Gérer les URLs invalides sous /dashboard (ex: /dashboard/abc) */}\
//              {/* Redirige vers l'accueil du dashboard si la sous-route n'est pas trouvée */}
//              <Route path="*" element={<Navigate to="home" replace />} />


//          </Routes>

//       </div>
//     </div>
//   );
// }

// export default MainLayout




