// // src/components/MainLayout.jsx
// // Ce composant contient la structure principale de l'application une fois l'utilisateur connecté.
// // Il gère l'affichage des différentes vues (factures, budget, utilisateurs) via les sous-routes du dashboard
// // et adapte l'interface utilisateur en fonction du rôle de l'utilisateur connecté.

// import React, { useState, useEffect } from 'react';
// import FormFacture from './FormFacture';
// import TableFactures from './TableFactures';
// import BudgetDashboard from './BudgetDashboard';
// import UserManagement from './UserManagement'; // Importez le nouveau composant de gestion des utilisateurs
// import DepenseComptesPage from "./DepenseComptesPage.jsx";
// import logo from '../Logo Habitek_WEB_Transparent-06.png'; // Adaptez le chemin du logo si nécessaire

// // Importez les hooks de react-router-dom
// import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';

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
//   const year = date.getFullYear();
//   // L'année financière commence le 1er mai
//   return date.getMonth() >= 4 ? String(year) : String(year - 1);
// };


// // // --- Drawer (formulaire) : état d’ouverture + largeur persistée ---
// // const [formDrawerOpen, setFormDrawerOpen] = useState(true);
// // const [drawerWidth, setDrawerWidth] = useState(() => {
// //   const saved = Number(localStorage.getItem('factureDrawer.width'));
// //   return Number.isFinite(saved) && saved >= 320 && saved <= 720 ? saved : 420; // px
// // });

// // // Persistance de la largeur
// // useEffect(() => {
// //   localStorage.setItem('factureDrawer.width', String(drawerWidth));
// // }, [drawerWidth]);

// // // Redimensionnement (drag) : on calcule la largeur = (window.innerWidth - e.clientX)
// // const onStartResize = (e) => {
// //   // on ne permet le resize que sur desktop
// //   if (!canUseDrawer) return;
// //   if (window.innerWidth < 1024) return;
// //   e.preventDefault();
// //   const onMove = (ev) => {
// //     const px = Math.max(320, Math.min(720, window.innerWidth - ev.clientX));
// //     setDrawerWidth(px);
// //   };
// //   const onUp = () => {
// //     window.removeEventListener('mousemove', onMove);
// //     window.removeEventListener('mouseup', onUp);
// //   };
// //   window.addEventListener('mousemove', onMove);
// //   window.addEventListener('mouseup', onUp);
// // };
// // const canUseDrawer = userRole === 'soumetteur' || userRole === 'gestionnaire';

// // useEffect(() => {
// //   if (!canUseDrawer) setFormDrawerOpen(false);
// // }, [canUseDrawer]);


// // -----------------------------------
// // Composant MainLayout
// // -----------------------------------

// // Renommez la fonction principale et acceptez les props nécessaires passées depuis App.jsx
// function MainLayout({ userToken, userRole, handleLogout, authorizedFetch, clientCount, userId }) {
//   // -----------------------------------
//   // Gestion des États (spécifiques à ce layout et ses enfants)
//   // -----------------------------------
//   const [factures, setFactures] = useState([]); // Liste des factures
//   const [anneeFinanciere, setAnneeFinanciere] = useState(getFinancialYear()); // Année financière courante
//   // clientCount est maintenant géré dans App.jsx et passé en prop
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Visibilité de la barre latérale
//   // currentView est maintenant géré par react-router-dom via les sous-routes.
//   const [uploadProgress, setUploadProgress] = useState(null); // Progression d'upload (%)
//   const [timeLeft, setTimeLeft] = useState(''); // Temps restant estimé pour l'upload


//   // Hooks de react-router-dom
//   const navigate = useNavigate();
//   const location = useLocation(); // Pour obtenir la route actuelle et déterminer quelle sous-vue afficher

//   // Déterminer la sous-vue actuelle basée sur location.pathname pour les rendus conditionnels simples
//   const currentSubView = location.pathname.split('/').pop();

//   // --- Chargement des Données au changement de route/année ---
//   // Utilisez useLocation pour réagir aux changements de sous-route dans /dashboard
//   // et anneeFinanciere pour réagir au changement d'année.
//   useEffect(() => {

//     // Charger les factures SEULEMENT si la sous-vue est 'manage-invoices'
//     // et si l'utilisateur a la permission UI de voir les factures.
//     // La vérification backend est la sécurité finale, mais la vérification UI optimise.
//     if (location.pathname.endsWith('/manage-invoices') && (userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur')) {
//       console.log(`MainLayout: Navigated to manage-invoices (${anneeFinanciere}), fetching factures...`);
//       fetchFactures(anneeFinanciere);
//     } else {
//       // Vider les factures si on quitte la vue des factures ou si le rôle ne permet pas
//       setFactures([]);
//     }

//     // Les données budgétaires et utilisateurs sont fetchées dans leurs composants spécifiques
//     // (BudgetDashboard, UserManagement) car ces fetches nécessitent des potentiels contrôles
//     // de rôle et logiques spécifiques à ces composants.

//     // --- Adaptation des listeners SocketIO pour réagir dans ce composant ---
//     // Les événements globaux (client_count) sont gérés dans App.jsx.
//     // Les événements spécifiques aux données (factures, budget) peuvent être écoutés ici pour mettre à jour l'UI.
//     const socket = window.socket; // Accéder à la socket globale stockée dans App.jsx
//     if (socket) {
//       console.log("MainLayout: Setting up SocketIO listeners.");

//       const handleNewFacture = (nf) => {
//         console.log('SocketIO in MainLayout: new_facture received', nf);
//         // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
//         if (location.pathname.endsWith('/manage-invoices') && String(nf.annee) === anneeFinanciere) {
//           console.log("MainLayout: Updating factures due to new_facture event.");
//           // Option simple: Re-fetch (assure la cohérence)
//           fetchFactures(anneeFinanciere);
//           // Option plus complexe: Mettre à jour l'état local (peut nécessiter plus de logique pour l'ordre/unicité)
//           // setFactures(prev => [nf, ...prev.filter(f => f.id !== nf.id)]);
//         }
//       };
//       const handleDeleteFacture = (d) => {
//         console.log('SocketIO in MainLayout: delete_facture received', d);
//         // Mettre à jour la liste des factures uniquement si on est sur la bonne page
//         if (location.pathname.endsWith('/manage-invoices')) {
//           console.log("MainLayout: Updating factures due to delete_facture event.");
//           // Option simple: Re-fetch
//           fetchFactures(anneeFinanciere);
//           // Option plus complexe: Mettre à jour l'état local
//           // setFactures(prev => prev.filter(f => f.id !== d.id));
//         }
//       };
//       const handleUpdateFacture = (uf) => {
//         console.log('SocketIO in MainLayout: update_facture received', uf);
//         // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
//         if (location.pathname.endsWith('/manage-invoices') && String(uf.annee) === anneeFinanciere) {
//           console.log("MainLayout: Updating factures due to update_facture event.");
//           // Option simple: Re-fetch
//           fetchFactures(anneeFinanciere);
//           // Option plus complexe: Mettre à jour l'état local
//           // setFactures(prev => prev.map(f => f.id === uf.id ? uf : f));
//         }
//       };

//       // Ajouter les listeners SocketIO pour les événements pertinents
//       socket.on('new_facture', handleNewFacture);
//       socket.on('delete_facture', handleDeleteFacture);
//       socket.on('update_facture', handleUpdateFacture);

//       // Ajoutez des listeners similaires pour les événements budget si nécessaire (new_budget, update_budget, delete_budget)
//       // Ces événements devraient déclencher un re-fetch ou une mise à jour dans le composant BudgetDashboard.
//       // BudgetDashboard devra soit écouter la socket globale lui-même, soit recevoir une prop pour déclencher son fetch.

//       return () => {
//         // Nettoyage des listeners SocketIO spécifiques à ce composant lors du démontage
//         console.log("MainLayout: Cleaning up SocketIO listeners.");
//         socket.off('new_facture', handleNewFacture);
//         socket.off('delete_facture', handleDeleteFacture);
//         socket.off('update_facture', handleUpdateFacture);
//       };
//     } else {
//       console.log("MainLayout: SocketIO instance not found.");
//       // Gérer le cas où la socket n'est pas disponible (ex: erreur de connexion initiale)
//     }


//   }, [anneeFinanciere, location.pathname, userRole /*, fetchBudget si vous l'utilisez ici pour socket updates*/]); // Dépendances

//   // Autorisation d’utiliser le drawer (selon le rôle)
// const canUseDrawer = userRole === 'soumetteur' || userRole === 'gestionnaire';

// // État d’ouverture + largeur persistée
// const [formDrawerOpen, setFormDrawerOpen] = useState(canUseDrawer);
// const [drawerWidth, setDrawerWidth] = useState(() => {
//   const saved = Number(localStorage.getItem('factureDrawer.width'));
//   return Number.isFinite(saved) && saved >= 320 && saved <= 720 ? saved : 420; // px
// });

// // NEW: Modal mobile
// const [formModalOpen, setFormModalOpen] = useState(false);


// // Persistance de la largeur
// useEffect(() => {
//   localStorage.setItem('factureDrawer.width', String(drawerWidth));
// }, [drawerWidth]);

// // Fermer automatiquement si l’utilisateur n’a pas le droit
// useEffect(() => {
//   if (!canUseDrawer) {
//     setFormDrawerOpen(false);  // ferme le drawer
//     setFormModalOpen(false);   // et le modal
//   }
// }, [canUseDrawer]);

// // Redimensionnement (drag)
// const onStartResize = (e) => {
//   if (!canUseDrawer) return;            // sécurité rôle
//   if (window.innerWidth < 1024) return; // desktop only
//   e.preventDefault();
//   const onMove = (ev) => {
//     const px = Math.max(320, Math.min(720, window.innerWidth - ev.clientX));
//     setDrawerWidth(px);
//   };
//   const onUp = () => {
//     window.removeEventListener('mousemove', onMove);
//     window.removeEventListener('mouseup', onUp);
//   };
//   window.addEventListener('mousemove', onMove);
//   window.addEventListener('mouseup', onUp);
// };
//   // --- Fonctions API (utilisent authorizedFetch passé en prop) ---
//   // Ces fonctions appellent le backend et sont passées aux composants enfants.
//   // authorizedFetch, reçu en prop, gère l'ajout du token et la gestion des erreurs 401/403.

//   // La fonction fetchFactures est définie et utilisée dans useEffect et potentiellement par des événements socket
//   // async function fetchFactures(year) {
//   //      console.log(`TRACE : User role ${userRole}`);
//   //      // Vérification de rôle UI (redondant avec backend mais pour UI rapide)
//   //      if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//   //          console.warn("fetchFactures: Rôle UI insuffisant.");
//   //          setFactures([]); // Vider les factures si le rôle UI ne permet pas
//   //          return null;
//   //      }
//   //      try {
//   //        console.log(`WorkspaceFactures: Récupération des factures pour l'année financière ${year}`);
//   //        // Utiliser authorizedFetch ici
//   //        const res = await authorizedFetch(`${API_URL}/api/factures?year=${year}`);
//   //        if (!res.ok) {
//   //          // authorizedFetch a déjà géré les 401/403 et les alertes
//   //          const errorText = await res.text(); // Tente de lire pour plus de détails
//   //          throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//   //        }
//   //        const data = await res.json();
//   //        setFactures(data);
//   //        return data;
//   //      } catch (e) {
//   //        console.error('fetchFactures: Erreur lors de la récupération des factures :', e);
//   //         // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion
//   //        if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//   //            // Afficher l'alerte uniquement pour les erreurs non gérées par authorizedFetch
//   //            alert(`Erreur lors du chargement des factures : ${e.message}`);
//   //        }
//   //        setFactures([]); // S'assurer que la liste est vide en cas d'erreur
//   //        return null;
//   //      }
//   // }

//   async function fetchFactures(year) {
//     console.log(`MainLayout - fetchFactures called with year: ${year}`); // Pour débogage
//     // Vérification de rôle UI (redondant avec backend mais pour UI rapide)
//     if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       console.warn("fetchFactures: Rôle UI insuffisant.");
//       setFactures([]); // Vider les factures si le rôle UI ne permet pas
//       return null;
//     }
//     try {
//       // CORRECTION ICI: Changez 'annee' en 'year'
//       console.log('MainLayout - API call to: /api/factures?year=${year}');
//       const res = await authorizedFetch(`${API_URL}/api/factures?year=${year}`);
//       if (!res.ok) {
//         const errorText = await res.text();
//         throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//       }
//       const data = await res.json();
//       console.log(`MainLayout - Factures data received for year ${year}:`, data); // Pour débogage
//       setFactures(data); // Ceci met à jour l'état 'factures' dans MainLayout
//       return data; // Retourne les données pour que fetchFacturesForBudget puisse les utiliser
//     } catch (e) {
//       console.error('fetchFactures: Erreur lors de la récupération des factures :', e);
//       if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//         alert(`Erreur lors du chargement des factures : ${e.message}`);
//       }
//       setFactures([]);
//       return null;
//     }
//   }




//   // addFacture, deleteFacture, updateFacture, exportFacturesCsv
//   // Les définitions de ces fonctions sont copiées de l'ancien App.jsx
//   // et modifiées pour :
//   // 1. Appeler `authorizedFetch` au lieu de `Workspace` standard (sauf pour XMLHttpRequest dans addFacture, qui doit être adapté).
//   // 2. Inclure une vérification de rôle UI au début pour l'expérience utilisateur.
//   // 3. Gérer les erreurs 401/403 de la même manière que authorizedFetch (qui est déjà fait par authorizedFetch, mais pour XMLHttpRequest, il faut le faire manuellement).


//   function addFacture(factureData) {
//     // Vérification de rôle UI
//     if (userRole !== 'soumetteur' && userRole !== 'gestionnaire') { // Exemple: seuls soumetteurs et gestionnaires peuvent ajouter
//       alert("Vous n'avez pas le rôle nécessaire pour ajouter une facture.");
//       return;
//     }


//     const startTime = Date.now();


//     setUploadProgress(0);
//     setTimeLeft('');

//     const xhr = new XMLHttpRequest();
//     xhr.open('POST', `${API_URL}/api/factures`);
//     // AJOUT ESSENTIEL POUR XMLHttpRequest : Ajouter l'en-tête Authorization
//     if (userToken) {
//       xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
//     } else {
//       // Ce cas ne devrait pas arriver si la route est protégée et l'UI gérée, mais sécurité supplémentaire
//       console.error("addFacture: Tentative d'upload sans token.");
//       alert("Vous n'êtes pas connecté.");
//       handleLogout(); // Déconnecter si jamais on atteint ce point sans token
//       setUploadProgress(null);
//       setTimeLeft('');
//       return;
//     }


//     xhr.upload.onprogress = (e) => {
//       if (e.lengthComputable) {
//         const percentage = Math.round((e.loaded / e.total) * 100);
//         setUploadProgress(percentage);

//         const elapsed = (Date.now() - startTime) / 1000; // secondes
//         const bytesPerSecond = e.loaded / elapsed;
//         const remainingBytes = e.total - e.loaded;
//         const estimatedSecondsRemaining = remainingBytes / bytesPerSecond;

//         const minutes = Math.floor(estimatedSecondsRemaining / 60);
//         const seconds = Math.round(estimatedSecondsRemaining % 60);
//         setTimeLeft(`${minutes}m ${seconds}s`);
//       }
//     };

//     xhr.onload = () => {
//       // AJOUT ESSENTIEL POUR XMLHttpRequest : Gérer spécifiquement les codes 401/403
//       if (xhr.status === 401 || xhr.status === 403) {
//         console.error(`addFacture: API ${xhr.status} Unauthorized/Forbidden lors de l'upload.`);
//         let errorMessage = xhr.status === 403 ? "Accès refusé." : "Votre session a expiré ou est invalide.";
//         try {
//           const errorData = JSON.parse(xhr.responseText);
//           errorMessage = errorData.error || errorMessage;
//         } catch (e) { /* ignore parse error */ }
//         alert(errorMessage); // Informer l'utilisateur
//         handleLogout(); // Forcer la déconnexion
//         setUploadProgress(null);
//         setTimeLeft('');
//         return; // Arrêter le traitement
//       }

//       setUploadProgress(null);
//       setTimeLeft('');
//       if (!(xhr.status >= 200 && xhr.status < 300)) {
//         console.error('addFacture: Échec de l\'upload :', xhr.status, xhr.responseText);
//         alert('Erreur lors de l\'ajout de la facture.');
//       } else {
//         console.log('addFacture: Réponse du serveur :', xhr.responseText);
//         let response;
//         try {
//           response = JSON.parse(xhr.responseText);
//         } catch (e) {
//           console.error('addFacture: Erreur de parsing JSON :', e);
//           alert('Erreur lors du traitement de la réponse du serveur.');
//           return;
//         }
//         // Recharger les factures si on est dans la vue manage-invoices pour cette année
//         // et si SocketIO ne gère pas nativement cette mise à jour côté client pour l'émetteur
//         //  if (location.pathname.endsWith('/manage-invoices') && String(response.annee) === anneeFinanciere) {
//         //      fetchFactures(anneeFinanciere); // Recharger pour être sûr
//         //  }
//         if (location.pathname.endsWith('/manage-invoices')) { // C'EST ICI
//           fetchFactures(anneeFinanciere); // Recharger pour être sûr
//         }
//         console.log('Facture ajoutée avec succès.');
//         // Réinitialiser le formulaire si nécessaire dans FormFacture ou ici
//       }
//     };

//     xhr.onerror = () => {
//       setUploadProgress(null);
//       setTimeLeft('');
//       console.error('addFacture: Erreur réseau lors de l\'upload');
//       alert('Erreur réseau lors de l\'ajout de la facture.');
//     };

//     xhr.send(factureData);
//   }


//   async function deleteFacture(id) {
//     // Vérifier le rôle UI (la vérification backend est la sécurité finale)
//     if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
//       return false;
//     }

//     if (!window.confirm('Supprimer cette facture ?')) return false;

//     try {
//       // Utiliser authorizedFetch ici
//       const res = await authorizedFetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, {
//         method: 'DELETE',
//       });
//       if (!res.ok) {
//         // authorizedFetch gère déjà les 401/403
//         const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
//         throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//       }
//       console.log(`deleteFacture: Facture ${id} supprimée.`);
//       // Pas besoin de re-fetch ici si SocketIO gère la suppression en temps réel pour tous
//       // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
//       fetchFactures(anneeFinanciere); // Recharger pour être sûr
//       return true;
//     } catch (e) {
//       console.error('deleteFacture: Erreur lors de la suppression :', e);
//       // authorizedFetch gère déjà les erreurs 401/403
//       if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//         alert(`Erreur lors de la suppression de la facture : ${e.message}`);
//       }
//       return false;
//     }
//   }

//   async function updateFacture(id, data) {
//     // Vérifier le rôle UI
//     if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       alert("Vous n'avez pas le rôle nécessaire pour modifier une facture.");
//       return false;
//     }

//     // ... (logique existante)
//     try {
//       // Utiliser authorizedFetch ici
//       const res = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ ...data, annee: anneeFinanciere }),
//       });
//       if (!res.ok) {
//         // authorizedFetch gère déjà les 401/403
//         const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
//         throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//       }
//       console.log(`updateFacture: Facture ${id} mise à jour.`);
//       // Pas besoin de re-fetch si SocketIO gère la mise à jour
//       // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
//       fetchFactures(anneeFinanciere); // Recharger pour être sûr
//       return true;
//     } catch (e) {
//       console.error('updateFacture: Erreur lors de la mise à jour :', e);
//       // authorizedFetch gère déjà les erreurs 401/403
//       if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//         alert(`Erreur lors de la mise à jour de la facture : ${e.message}`);
//       }
//       return false;
//     }
//   }

//   // Adapter downloadFile si nécessaire (pas besoin de rôle, mais utilise authorizedFetch)
//   const downloadFile = async (factureId, annee) => {
//     // Vérification de rôle UI (si nécessaire, mais probablement pas pour le download)
//     // if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//     //      alert("Vous n'avez pas le rôle nécessaire pour télécharger un fichier.");
//     //      return;
//     //  }
//     try {
//       // Utiliser authorizedFetch ici
//       const response = await authorizedFetch(`${API_URL}/api/factures/${factureId}/fichier?annee=${annee}`);

//       if (!response.ok) {
//         // authorizedFetch gère déjà les 401/403. Gérer les autres erreurs spécifiques ici.
//         if (response.status === 404) {
//           alert('Fichier non trouvé.');
//           return;
//         }
//         const errorText = await response.text();
//         throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
//       }

//       // ... reste de la logique de téléchargement ...
//       const blob = await response.blob();
//       const disposition = response.headers.get('Content-Disposition');
//       let filename = `facture_${factureId}_fichier`; // Nom par défaut
//       if (disposition && disposition.indexOf('attachment') !== -1) {
//         const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
//         const matches = filenameRegex.exec(disposition);
//         if (matches != null && matches[1]) {
//           filename = matches[1].replace(/['"]/g, '');
//         }
//       }

//       // Créer un lien temporaire pour le téléchargement
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = filename; // Nom du fichier à télécharger
//       document.body.appendChild(a);
//       a.click();
//       // Nettoyer après le téléchargement
//       a.remove();
//       window.URL.revokeObjectURL(url);
//       console.log(`Fichier ${filename} téléchargé avec succès.`);

//     } catch (error) {
//       console.error('Erreur lors du téléchargement du fichier :', error);
//       // authorizedFetch gère déjà les erreurs 401/403
//       if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
//         alert(`Erreur lors du téléchargement du fichier : ${error.message}`);
//       }
//     }
//   };


//   async function exportFacturesCsv() {
//     // Vérifier le rôle UI
//     if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       alert("Vous n'avez pas le rôle nécessaire pour exporter les factures.");
//       setIsSidebarOpen(false); // Fermer la sidebar même en cas d'échec de rôle côté UI
//       return false;
//     }

//     try {
//       const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
//       console.log(`exportFacturesCsv: Exportation des factures pour l'année financière ${anneeFinanciere}...`);
//       // Utiliser authorizedFetch ici
//       const response = await authorizedFetch(exportUrl);

//       if (!response.ok) {
//         // authorizedFetch gère déjà les 401/403
//         const errorText = await response.text();
//         throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
//       }

//       // ... reste de la logique d'exportation ...
//       const disposition = response.headers.get('Content-Disposition');
//       let filename = `factures_${anneeFinanciere}.csv`;
//       if (disposition) {
//         const filenameMatch = disposition.match(/filename="?(.+)"?/);
//         if (filenameMatch && filenameMatch[1]) {
//           filename = filenameMatch[1];
//         }
//       }

//       const blob = await response.blob();
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = filename;
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       window.URL.revokeObjectURL(url);

//       console.log('exportFacturesCsv: Factures exportées avec succès.');
//       return true;

//     } catch (error) {
//       console.error('exportFacturesCsv: Erreur lors de l\'exportation des factures :', error);
//       // authorizedFetch gère déjà les erreurs 401/403
//       if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
//         alert(`Erreur lors de l'exportation des factures : ${error.message}`);
//       }
//       return false;
//     } finally {
//       setIsSidebarOpen(false); // Fermer la sidebar après l'action
//     }
//   }


//   // --- Fonctions Budget (passées à BudgetDashboard, utilisent authorizedFetch) ---
//   // Ces fonctions sont déjà adaptées pour la vérification de rôle UI et l'utilisation de authorizedFetch
//   // dans la section précédente, lors de la modification de BudgetDashboard.jsx.
//   // Vous devez copier/coller les définitions finales de ces fonctions ici depuis vos notes ou l'exemple précédent.

//   //  const fetchBudget = async (year) => { /* ... votre code fetchBudget utilisant authorizedFetch et userRole ... */ };
//   //  const addBudgetEntry = async (entryData) => { /* ... votre code addBudgetEntry utilisant authorizedFetch et userRole ... */ };
//   //  const updateBudgetEntry = async (entryId, updatedData) => { /* ... votre code updateBudgetEntry utilisant authorizedFetch et userRole ... */ };
//   //  const deleteBudgetEntry = async (entryId) => { /* ... votre code deleteBudgetEntry utilisant authorizedFetch et userRole ... */ };
//   //  const verifyPin = async (pin) => { /* ... votre code verifyPin utilisant authorizedFetch (si protégé) ... */ };
//   // 1) Récupérer les entrées budgétaires pour une année
//   const fetchBudget = async (year) => {
//     // UI-check (optionnel) : seuls gestionnaires et approbateurs peuvent lire
//     if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       console.warn('fetchBudget blocqué, rôle insuffisant:', userRole);
//       return [];
//     }
//     const res = await authorizedFetch(`${API_URL}/api/budget?financial_year=${year}`);
//     if (!res.ok) {
//       throw new Error(`fetchBudget HTTP ${res.status} – ${await res.text()}`);
//     }
//     return res.json();
//   };

//   // 2) Ajouter une entrée budgétaire
//   const addBudgetEntry = async (entryData, anneeFinanciere) => {
//     const payload = {
//       financial_year: anneeFinanciere,  // clé attendue par votre backend
//       fund_type: entryData.fund_type,
//       revenue_type: entryData.revenue_type,
//       amount: entryData.amount,
//     };

//     const res = await authorizedFetch(`${API_URL}/api/budget`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });
//     console.log("addBudgetEntry:", res);

//     if (!res.ok) {
//       console.log("addBudgetEntry erreur HTTP", res.status);
//       return false;
//     }
//     return true;
//   };

//   // 3) Modifier une entrée
//   const updateBudgetEntry = async (entryId, updatedData) => {
//     if (userRole !== 'gestionnaire') {
//       console.warn('updateBudgetEntry blocqué, rôle insuffisant:', userRole);
//       return false;
//     }
//     const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
//       method: 'PUT',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(updatedData),
//     });
//     if (!res.ok) {
//       console.error('updateBudgetEntry erreur HTTP', res.status);
//       return false;
//     }
//     return true;
//   };

//   // 4) Supprimer une entrée
//   const deleteBudgetEntry = async (entryId) => {
//     if (userRole !== 'gestionnaire') {
//       console.warn('deleteBudgetEntry blocqué, rôle insuffisant:', userRole);
//       return false;
//     }
//     const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
//       method: 'DELETE',
//     });
//     if (!res.ok) {
//       console.error('deleteBudgetEntry erreur HTTP', res.status);
//       return false;
//     }
//     return true;
//   };

//   // 5) Vérifier un PIN côté back
//   const verifyPin = async (pin) => {
//     // tout rôle peut vérifier, selon votre back ; sinon adaptez ici
//     const res = await authorizedFetch(`${API_URL}/api/budget/verify-pin`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ pin }),
//     });
//     if (!res.ok) {
//       console.error('verifyPin erreur HTTP', res.status);
//       return false;
//     }
//     const { success } = await res.json();  // <-- clé correcte
//     return success === true;
//   };


//   /**
//    * Gère le clic sur un élément du menu de la barre latérale.
//    * - Navigue vers la route correspondante et ferme la barre latérale.
//    * @param {string} view - Vue à afficher ('home', 'manage-invoices', 'manage-budget', 'manage-users').
//    */
//   const handleMenuItemClick = (view) => {
//     // Utiliser navigate pour changer la route.
//     // Les Routes dans le contenu principal (en dessous) géreront quel composant est rendu.
//     navigate(`/dashboard/${view}`);
//     setIsSidebarOpen(false);
//   };


//   // --- Rendu du Layout Principal ---
//   return (
//     <div className="relative min-h-screen">
//       {/* En-tête - Position fixe */}
//       <div className="fixed top-0 left-0 right-0 bg-white shadow z-10 flex items-center justify-between p-4">
//         {/* Gauche : Hamburger, Logo, Titre */}
//         {/* Le clic sur le titre redirige vers l'accueil du dashboard */}
//         <div
//           className="flex flex-col sm:flex-row items-start sm:items-center flex-grow sm:flex-grow-0 cursor-pointer"
//           onClick={() => handleMenuItemClick('home')} // Redirige vers /dashboard/home
//         >
//           <div className="flex items-center mb-2 sm:mb-0 mr-6 sm:mr-8">
//             <button
//               className="
//                 p-2 mr-4 sm:mr-6 text-gray-500 hover:text-gray-700 hover:bg-gray-100
//                 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors cursor-pointer
//               "
//               onClick={(e) => {
//                 e.stopPropagation(); // Empêche le clic de propager au div parent
//                 setIsSidebarOpen(!isSidebarOpen);
//               }}
//               aria-label={isSidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
//             >
//               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
//               </svg>
//             </button>
//             <img src={logo} alt="Logo Habitek" className="w-32" />
//           </div>
//           <h1 className="text-xl sm:text-2xl font-bold text-blue-600 text-center sm:text-left sm:ml-4 break-words">
//             Habitek - Plateforme trésorerie gestion des factures
//           </h1>
//         </div>
//         {/* Droite : Compteur de clients et bouton de déconnexion */}
//         <div className="flex items-center">
//           {/* Afficher le rôle de l'utilisateur s'il est défini */}
//           {userRole && (
//             <div className="hidden sm:flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-4">
//               Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)} {/* Capitalize first letter */}
//             </div>
//           )}
//           {/* Afficher le compteur de clients */}
//           <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm mr-4">
//             Clients en ligne : {clientCount}
//           </div>
//           {/* Bouton de déconnexion */}
//           <button
//             onClick={handleLogout} // handleLogout est passé en prop depuis App.jsx
//             className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
//           >
//             Déconnexion
//           </button>
//         </div>
//       </div>

//       {/* Superposition pour la barre latérale (cliquer pour fermer) */}
//       {isSidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black bg-opacity-50 z-40"
//           onClick={() => setIsSidebarOpen(false)}
//           aria-hidden="true"
//         />
//       )}

//       {/* Barre latérale */}
//       <div
//         className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
//           }`}
//       >
//         <div className="p-4 flex-grow overflow-y-auto">
//           <h2 className="text-lg font-semibold mb-4">Menu</h2>
//           {/* Sélection de l'année financière */}
//           <div className="mb-4">
//             <label htmlFor="anneeSelect" className="block text-sm font-medium text-gray-700 mb-1">
//               Année Financière :
//             </label>
//             <select
//               id="anneeSelect"
//               value={anneeFinanciere}
//               onChange={(e) => setAnneeFinanciere(e.target.value)}
//               className="w-full p-2 border rounded text-gray-700"
//             >
//               {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => {
//                 const fy = String(year);
//                 return (
//                   <option key={fy} value={fy}>
//                     {fy} - {parseInt(fy) + 1}
//                   </option>
//                 );
//               })}
//             </select>
//           </div>
//           {/* Éléments du menu - Rendu conditionnel basé sur le rôle */}
//           <ul>
//             {/* Lien Accueil */}
//             <li>
//               <button
//                 onClick={() => handleMenuItemClick('home')}
//                 // Utiliser location.pathname pour déterminer la vue active
//                 className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                   }`}
//               >
//                 Accueil
//               </button>
//             </li>
//             {/* Lien Gérer les factures (accessible si rôle permet) */}
//             {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
//               <li>
//                 <button
//                   onClick={() => handleMenuItemClick('manage-invoices')}
//                   className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                     }`}
//                 >
//                   Gérer les factures
//                 </button>
//               </li>
//             )}
//             {/* Lien Gérer le budget (accessible si rôle permet) */}
//             {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//               <li>
//                 <button
//                   onClick={() => handleMenuItemClick('manage-budget')}
//                   className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                     }`}
//                 >
//                   Gérer le budget
//                 </button>
//               </li>
//             )}
//             {/* Lien Gérer les utilisateurs (accessible si gestionnaire) */}
//             {userRole === 'gestionnaire' && (
//               <li>
//                 <button
//                   onClick={() => handleMenuItemClick('manage-users')}
//                   className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'manage-users' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                     }`}
//                 >
//                   Gérer les utilisateurs
//                 </button>
//               </li>
//             )}
//             {/* Lien Gérer les comptes de dépenses (accessible si gestionnaire) */}
//             {userRole === 'gestionnaire' && (
//               <li>
//                 <button
//                   onClick={() => handleMenuItemClick('depense-comptes')}
//                   className={`block w-full text-left py-2 px-2 rounded-md ${currentSubView === 'depense-comptes'
//                     ? 'bg-blue-100 text-blue-700'
//                     : 'text-gray-700 hover:bg-gray-100'
//                     }`}
//                 >
//                   Gérer les comptes de dépenses
//                 </button>
//               </li>
//             )}
//             {/* Lien Exporter en CSV (accessible si rôle permet) */}
//             {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//               <li>
//                 <button
//                   onClick={exportFacturesCsv} // Cette fonction contient déjà une vérification de rôle UI et appel authorizedFetch
//                   className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
//                 >
//                   Exporter en CSV
//                 </button>
//               </li>
//             )}
//           </ul>
//         </div>
//         {/* Compteur de clients et rôle dans le pied de page (mobile uniquement) */}
//         <div className="p-4 border-t border-gray-200 sm:hidden flex justify-around items-center">
//           {userRole && (
//             <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm text-center">
//               Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
//             </div>
//           )}
//           <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-center">
//             Clients en ligne : {clientCount}
//           </div>
//         </div>
//       </div>

//       {/* Contenu Principal - Utiliser Routes pour les sous-vues de /dashboard */}
//       {/* Le pt-40 sm:pt-75 doit laisser de la place pour l'en-tête fixe */}
//       <div className="container mx-auto px-4 pb-4 pt-40 sm:pt-75 transition-all duration-300">
//         <Routes> {/* Les routes enfants de /dashboard. Ces routes sont rendues si la route parente (/dashboard) est active. */}

//           {/* Route Accueil du Dashboard */}
//           <Route
//             path="home"
//             element={
//               <div className="text-center mt-10">
//                 {/* Afficher un message de bienvenue avec le rôle */}
//                 <h2 className="text-2xl font-semibold text-gray-700">Bienvenue, {userRole}!</h2>
//                 <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
//               </div>
//             }
//           />

//           {/* Route pour la gestion des factures */}
//           <Route
//             path="manage-invoices"
//             element={
//               <div className="flex gap-0 lg:gap-4">
//                 {/* --- Panneau principal : liste des factures --- */}
//                 <div className="flex-1 min-w-0">
//                   {/* Barre d’actions / titre */}
//                   <div className="flex items-center justify-between mb-3">
//                     <h1 className="text-lg font-semibold">Factures</h1>

//                     {/* Bouton desktop pour ouvrir/fermer le widget (masqué sur mobile) */}
//                     {canUseDrawer && (
//                       <div className="hidden lg:flex items-center gap-2">
//                         <button
//                           onClick={() => setFormDrawerOpen(v => !v)}
//                           className="px-3 py-1.5 border rounded hover:bg-gray-50"
//                           title={formDrawerOpen ? "Réduire le formulaire" : "Ouvrir le formulaire"}
//                         >
//                           {formDrawerOpen ? "Masquer le formulaire" : "Ajouter une facture"}
//                         </button>
//                       </div>
//                     )}
//                     {/* NEW: Bouton mobile (ouvre le modal) */}
//                     {canUseDrawer && (
//                       <div className="lg:hidden">
//                         <button
//                           onClick={() => setFormModalOpen(true)}
//                           className="px-3 py-1.5 border rounded bg-blue-600 text-white hover:bg-blue-700"
//                         >
//                           Ajouter une facture
//                         </button>
//                       </div>
//                     )}

//                   </div>

//                   {/* ERREUR CORRIGÉE : La table des factures est maintenant placée APRÈS la barre d'actions, et non à l'intérieur. */}
//                   <TableFactures
//                     factures={factures}
//                     userRole={userRole}
//                     currentUserId={userId}
//                     onDelete={deleteFacture}
//                     onUpdate={(id, patch) => updateFacture(id, patch)}
//                     downloadFile={downloadFile}
//                   />
//                 </div>

//                 {/* --- Panneau latéral : formulaire (desktop only) --- */}
//                 {/* ERREUR CORRIGÉE : Le '+' invalide a été supprimé ici. */}
//                 {canUseDrawer && (
//                   <aside
//                     className={`hidden lg:flex lg:flex-col lg:shrink-0 border-l bg-white relative transition-[width] duration-150 ease-out ${formDrawerOpen ? '' : 'overflow-hidden'}`}
//                     style={{ width: formDrawerOpen ? `${drawerWidth}px` : '0px' }}
//                   >
//                     {formDrawerOpen && (
//                       <div
//                         onMouseDown={onStartResize}
//                         className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gray-200"
//                         title="Glisser pour redimensionner"
//                       />
//                     )}
//                     <div className="px-3 py-2 border-b flex items-center justify-between">
//                       <div className="font-medium">Ajouter une facture</div>
//                       <button
//                         onClick={() => setFormDrawerOpen(false)}
//                         className="text-sm text-gray-600 hover:text-gray-900"
//                         title="Fermer"
//                       >
//                         ✕
//                       </button>
//                     </div>
//                     <div className="p-3 overflow-auto">
//                       <FormFacture
//                         onSubmit={addFacture}
//                         annee={anneeFinanciere}
//                         setAnnee={setAnneeFinanciere}
//                       />
//                     </div>
//                   </aside>
//                 )}

//                 {/* NEW: Modal mobile (pop-up) */}
//                 {canUseDrawer && formModalOpen && (
//                   <div className="fixed inset-0 z-50 lg:hidden">
//                     {/* Backdrop */}
//                     <div
//                       className="absolute inset-0 bg-black/40"
//                       onClick={() => setFormModalOpen(false)}
//                       aria-hidden="true"
//                     />
//                     {/* Boîte du modal */}
//                     <div
//                       role="dialog"
//                       aria-modal="true"
//                       className="relative mx-auto mt-20 w-[92%] max-w-md rounded-xl bg-white shadow-xl"
//                     >
//                       <div className="px-4 py-3 border-b flex items-center justify-between">
//                         <div className="font-medium">Ajouter une facture</div>
//                         <button
//                           onClick={() => setFormModalOpen(false)}
//                           className="text-sm text-gray-600 hover:text-gray-900"
//                           aria-label="Fermer"
//                         >
//                           ✕
//                         </button>
//                       </div>

//                       <div className="p-4 max-h-[70vh] overflow-auto">
//                         {/* On réutilise exactement le même formulaire */}
//                         <FormFacture
//                           onSubmit={addFacture}
//                           annee={anneeFinanciere}
//                           setAnnee={setAnneeFinanciere}
//                         />
//                       </div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             }
//           />

//           {/* ERREUR CORRIGÉE : Les routes suivantes ont été déplacées pour être des enfants directs de <Routes> */}

//           {/* Route Gérer le budget (accessible si rôle permet) */}
//           {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//             <Route
//               path="manage-budget"
//               element={
//                 <BudgetDashboard
//                   anneeFinanciere={anneeFinanciere}
//                   fetchBudget={fetchBudget}
//                   authorizedFetch={authorizedFetch}
//                   API_URL={API_URL}
//                   addBudgetEntry={addBudgetEntry}
//                   updateBudgetEntry={updateBudgetEntry}
//                   deleteBudgetEntry={deleteBudgetEntry}
//                   verifyPin={verifyPin}
//                   userRole={userRole}
//                   fetchFacturesForBudget={() => fetchFactures(anneeFinanciere)}
//                 />
//               }
//             />
//           )}

//           {/* Route Gérer les utilisateurs (accessible si gestionnaire) */}
//           {userRole === 'gestionnaire' && (
//             <Route
//               path="manage-users"
//               element={
//                 <UserManagement
//                   authorizedFetch={authorizedFetch}
//                   currentUserRole={userRole}
//                 />
//               }
//             />
//           )}

//           {/* Route pour les comptes de dépenses */}
//           {userRole === "gestionnaire" && (
//             <Route
//               path="depense-comptes"
//               element={
//                 <DepenseComptesPage
//                   authorizedFetch={authorizedFetch}
//                   userRole={userRole}
//                   API_URL={API_URL}
//                 />
//               }
//             />
//           )}

//           {/* Route par défaut pour /dashboard (redirige vers /dashboard/home) */}
//           <Route index element={<Navigate to="home" replace />} />

//           {/* Gérer les URLs invalides sous /dashboard */}
//           <Route path="*" element={<Navigate to="home" replace />} />

//         </Routes>
//       </div>
//     </div>
//   );
// }

// export default MainLayout;


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////



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

  // // -------- PATCH multipart pour l’édition (modal) --------
  // async function submitUpdateFacture(formData) {
  //   if (!editingFacture?.id) return;
  //   setEditSubmitting(true);
  //   try {
  //     const res = await authorizedFetch(`${API_URL}/api/factures/${editingFacture.id}`, {
  //       method: 'PATCH',
  //       body: formData,
  //     });
  //     const ok = res.ok;
  //     const data = await res.json().catch(() => ({}));
  //     if (!ok) {
  //       alert(`Erreur modification: ${data.error || res.status}`);
  //       return;
  //     }
  //     if (location.pathname.endsWith('/manage-invoices')) {
  //       await fetchFactures(anneeFinanciere);
  //     }
  //     setEditingFacture(null);
  //   } catch (e) {
  //     console.error("submitUpdateFacture error:", e);
  //     alert("Erreur lors de la mise à jour de la facture.");
  //   } finally {
  //     setEditSubmitting(false);
  //   }
  // }

  // -------- PATCH JSON pour l’édition (modal) --------
  async function submitUpdateFacture(formData) {
    if (!editingFacture?.id) return;
    setEditSubmitting(true);
    
    // On met l'ID dans l'URL (REST) et on s'assure d'envoyer l'objet seul
    const factureId = editingFacture.id; 
    
    // Si formData est un objet JSON (recommandé pour PATCH)
    const dataToSend = formData; 
    
    // S'il reste l'ID dans l'objet, retirez-le ici pour être propre :
    delete dataToSend.id; 

    try {
        const res = await authorizedFetch(`${API_URL}/api/factures/${factureId}`, {
            method: 'PATCH',
            // -----------------------------------------------------
            // 🔑 ÉTAPE 1: AJOUTER L'EN-TÊTE 'Content-Type'
            headers: {
                'Content-Type': 'application/json', // C'est l'élément clé manquant
            },
            // 🔑 ÉTAPE 2: CONVERTIR L'OBJET EN STRING JSON
            body: JSON.stringify(dataToSend), 
            // -----------------------------------------------------
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
 // 💥 TRACAGE AJOUTÉ ICI pour confirmer la réception
    console.log(`[downloadFile - API Call] Reçu: ID=${factureId}, Année=${annee}`);

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
                        downloadFile={downloadFile}
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
                          downloadFile={downloadFile}
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
                          downloadFile={downloadFile}
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
