// // src/components/MainLayout.jsx
// // Ce composant contient la structure principale de l'application une fois l'utilisateur connecté.
// // Il gère l'affichage des différentes vues (factures, budget, utilisateurs) via les sous-routes du dashboard
// // et adapte l'interface utilisateur en fonction du rôle de l'utilisateur connecté.

// import React, { useState, useEffect } from 'react';
// import FormFacture from './FormFacture';
// import TableFactures from './TableFactures';
// import BudgetDashboard from './BudgetDashboard';
// import UserManagement from './UserManagement'; // Importez le nouveau composant de gestion des utilisateurs
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

// // -----------------------------------
// // Composant MainLayout
// // -----------------------------------

// // Renommez la fonction principale et acceptez les props nécessaires passées depuis App.jsx
// function MainLayout({ userToken, userRole, handleLogout, authorizedFetch, clientCount /*, userId, ...*/ }) {
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

//       // Charger les factures SEULEMENT si la sous-vue est 'manage-invoices'
//       // et si l'utilisateur a la permission UI de voir les factures.
//       // La vérification backend est la sécurité finale, mais la vérification UI optimise.
//        if (location.pathname.endsWith('/manage-invoices') && (userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur')) {
//          console.log(`MainLayout: Navigated to manage-invoices (${anneeFinanciere}), fetching factures...`);
//          fetchFactures(anneeFinanciere);
//       } else {
//          // Vider les factures si on quitte la vue des factures ou si le rôle ne permet pas
//          setFactures([]);
//       }

//       // Les données budgétaires et utilisateurs sont fetchées dans leurs composants spécifiques
//       // (BudgetDashboard, UserManagement) car ces fetches nécessitent des potentiels contrôles
//       // de rôle et logiques spécifiques à ces composants.

//       // --- Adaptation des listeners SocketIO pour réagir dans ce composant ---
//       // Les événements globaux (client_count) sont gérés dans App.jsx.
//       // Les événements spécifiques aux données (factures, budget) peuvent être écoutés ici pour mettre à jour l'UI.
//       const socket = window.socket; // Accéder à la socket globale stockée dans App.jsx
//       if (socket) {
//          console.log("MainLayout: Setting up SocketIO listeners.");

//          const handleNewFacture = (nf) => {
//            console.log('SocketIO in MainLayout: new_facture received', nf);
//            // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
//            if (location.pathname.endsWith('/manage-invoices') && String(nf.annee) === anneeFinanciere) {
//               console.log("MainLayout: Updating factures due to new_facture event.");
//              // Option simple: Re-fetch (assure la cohérence)
//              fetchFactures(anneeFinanciere);
//              // Option plus complexe: Mettre à jour l'état local (peut nécessiter plus de logique pour l'ordre/unicité)
//              // setFactures(prev => [nf, ...prev.filter(f => f.id !== nf.id)]);
//            }
//          };
//           const handleDeleteFacture = (d) => {
//              console.log('SocketIO in MainLayout: delete_facture received', d);
//               // Mettre à jour la liste des factures uniquement si on est sur la bonne page
//              if (location.pathname.endsWith('/manage-invoices')) {
//                 console.log("MainLayout: Updating factures due to delete_facture event.");
//                  // Option simple: Re-fetch
//                  fetchFactures(anneeFinanciere);
//                  // Option plus complexe: Mettre à jour l'état local
//                  // setFactures(prev => prev.filter(f => f.id !== d.id));
//              }
//           };
//            const handleUpdateFacture = (uf) => {
//               console.log('SocketIO in MainLayout: update_facture received', uf);
//                // Mettre à jour la liste des factures uniquement si on est sur la bonne page et pour la bonne année
//                if (location.pathname.endsWith('/manage-invoices') && String(uf.annee) === anneeFinanciere) {
//                   console.log("MainLayout: Updating factures due to update_facture event.");
//                  // Option simple: Re-fetch
//                  fetchFactures(anneeFinanciere);
//                  // Option plus complexe: Mettre à jour l'état local
//                  // setFactures(prev => prev.map(f => f.id === uf.id ? uf : f));
//               }
//            };

//          // Ajouter les listeners SocketIO pour les événements pertinents
//          socket.on('new_facture', handleNewFacture);
//          socket.on('delete_facture', handleDeleteFacture);
//          socket.on('update_facture', handleUpdateFacture);

//          // Ajoutez des listeners similaires pour les événements budget si nécessaire (new_budget, update_budget, delete_budget)
//          // Ces événements devraient déclencher un re-fetch ou une mise à jour dans le composant BudgetDashboard.
//          // BudgetDashboard devra soit écouter la socket globale lui-même, soit recevoir une prop pour déclencher son fetch.

//          return () => {
//             // Nettoyage des listeners SocketIO spécifiques à ce composant lors du démontage
//             console.log("MainLayout: Cleaning up SocketIO listeners.");
//             socket.off('new_facture', handleNewFacture);
//             socket.off('delete_facture', handleDeleteFacture);
//             socket.off('update_facture', handleUpdateFacture);
//          };
//       } else {
//           console.log("MainLayout: SocketIO instance not found.");
//            // Gérer le cas où la socket n'est pas disponible (ex: erreur de connexion initiale)
//       }


//   }, [anneeFinanciere, location.pathname, userRole /*, fetchBudget si vous l'utilisez ici pour socket updates*/]); // Dépendances


//     // --- Fonctions API (utilisent authorizedFetch passé en prop) ---
//     // Ces fonctions appellent le backend et sont passées aux composants enfants.
//     // authorizedFetch, reçu en prop, gère l'ajout du token et la gestion des erreurs 401/403.

//     // La fonction fetchFactures est définie et utilisée dans useEffect et potentiellement par des événements socket
//     async function fetchFactures(year) {
//          console.log(`TRACE : User role ${userRole}`);
//          // Vérification de rôle UI (redondant avec backend mais pour UI rapide)
//          if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//              console.warn("fetchFactures: Rôle UI insuffisant.");
//              setFactures([]); // Vider les factures si le rôle UI ne permet pas
//              return null;
//          }
//          try {
//            console.log(`WorkspaceFactures: Récupération des factures pour l'année financière ${year}`);
//            // Utiliser authorizedFetch ici
//            const res = await authorizedFetch(`${API_URL}/api/factures?annee=${year}`);
//            if (!res.ok) {
//              // authorizedFetch a déjà géré les 401/403 et les alertes
//              const errorText = await res.text(); // Tente de lire pour plus de détails
//              throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//            }
//            const data = await res.json();
//            setFactures(data);
//            return data;
//          } catch (e) {
//            console.error('fetchFactures: Erreur lors de la récupération des factures :', e);
//             // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion
//            if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//                // Afficher l'alerte uniquement pour les erreurs non gérées par authorizedFetch
//                alert(`Erreur lors du chargement des factures : ${e.message}`);
//            }
//            setFactures([]); // S'assurer que la liste est vide en cas d'erreur
//            return null;
//          }
//     }

//     // addFacture, deleteFacture, updateFacture, exportFacturesCsv
//     // Les définitions de ces fonctions sont copiées de l'ancien App.jsx
//     // et modifiées pour :
//     // 1. Appeler `authorizedFetch` au lieu de `Workspace` standard (sauf pour XMLHttpRequest dans addFacture, qui doit être adapté).
//     // 2. Inclure une vérification de rôle UI au début pour l'expérience utilisateur.
//     // 3. Gérer les erreurs 401/403 de la même manière que authorizedFetch (qui est déjà fait par authorizedFetch, mais pour XMLHttpRequest, il faut le faire manuellement).


//     function addFacture(factureData) {
//         // Vérification de rôle UI
//          if (userRole !== 'soumetteur' && userRole !== 'gestionnaire') { // Exemple: seuls soumetteurs et gestionnaires peuvent ajouter
//               alert("Vous n'avez pas le rôle nécessaire pour ajouter une facture.");
//               return;
//           }
//         // ... (création de formData et logique de progression/temps)
//         const file = factureData.fichier;
//         const formData = new FormData();
//         formData.append('annee', anneeFinanciere);
//         formData.append('type', factureData.type);
//         formData.append('ubr', factureData.ubr || '');
//         formData.append('fournisseur', factureData.fournisseur || '');
//         formData.append('description', factureData.description || '');
//         formData.append('montant', factureData.montant);
//         formData.append('statut', factureData.statut); // Le statut par défaut peut être 'Soumis' défini ici si pas géré par backend
//         if (file) {
//           // Validation UI de la taille du fichier (déjà présente si copié)
//           const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go
//           if (file.size > MAX_FILE_SIZE_BYTES) {
//              alert(`La taille du fichier (${(file.size / 1024 / 1024).toFixed(2)} MB) dépasse la limite autorisée (2 GB).`);
//              return;
//           }
//           formData.append('fichier', file);
//         } else {
//              // Si aucun fichier, s'assurer que le backend accepte
//              // ou ajouter une validation si le fichier est requis pour certains types/statuts
//         }


//         const startTime = Date.now();
//         const totalBytes = file ? file.size : 0;

//         setUploadProgress(0);
//         setTimeLeft('');

//         const xhr = new XMLHttpRequest();
//         xhr.open('POST', `${API_URL}/api/factures`);
//         // AJOUT ESSENTIEL POUR XMLHttpRequest : Ajouter l'en-tête Authorization
//          if (userToken) {
//              xhr.setRequestHeader('Authorization', `Bearer ${userToken}`);
//          } else {
//              // Ce cas ne devrait pas arriver si la route est protégée et l'UI gérée, mais sécurité supplémentaire
//              console.error("addFacture: Tentative d'upload sans token.");
//              alert("Vous n'êtes pas connecté.");
//              handleLogout(); // Déconnecter si jamais on atteint ce point sans token
//              setUploadProgress(null);
//              setTimeLeft('');
//              return;
//          }


//         xhr.upload.onprogress = (e) => {
//             if (e.lengthComputable) {
//               const percentage = Math.round((e.loaded / e.total) * 100);
//               setUploadProgress(percentage);

//               const elapsed = (Date.now() - startTime) / 1000; // secondes
//               const bytesPerSecond = e.loaded / elapsed;
//               const remainingBytes = e.total - e.loaded;
//               const estimatedSecondsRemaining = remainingBytes / bytesPerSecond;

//               const minutes = Math.floor(estimatedSecondsRemaining / 60);
//               const seconds = Math.round(estimatedSecondsRemaining % 60);
//               setTimeLeft(`${minutes}m ${seconds}s`);
//             }
//         };

//         xhr.onload = () => {
//              // AJOUT ESSENTIEL POUR XMLHttpRequest : Gérer spécifiquement les codes 401/403
//             if (xhr.status === 401 || xhr.status === 403) {
//                 console.error(`addFacture: API ${xhr.status} Unauthorized/Forbidden lors de l'upload.`);
//                  let errorMessage = xhr.status === 403 ? "Accès refusé." : "Votre session a expiré ou est invalide.";
//                  try {
//                      const errorData = JSON.parse(xhr.responseText);
//                      errorMessage = errorData.error || errorMessage;
//                  } catch (e) { /* ignore parse error */ }
//                 alert(errorMessage); // Informer l'utilisateur
//                 handleLogout(); // Forcer la déconnexion
//                 setUploadProgress(null);
//                 setTimeLeft('');
//                 return; // Arrêter le traitement
//             }

//             setUploadProgress(null);
//             setTimeLeft('');
//             if (!(xhr.status >= 200 && xhr.status < 300)) {
//               console.error('addFacture: Échec de l\'upload :', xhr.status, xhr.responseText);
//               alert('Erreur lors de l\'ajout de la facture.');
//             } else {
//               console.log('addFacture: Réponse du serveur :', xhr.responseText);
//               let response;
//               try {
//                 response = JSON.parse(xhr.responseText);
//               } catch (e) {
//                 console.error('addFacture: Erreur de parsing JSON :', e);
//                 alert('Erreur lors du traitement de la réponse du serveur.');
//                 return;
//               }
//               // Recharger les factures si on est dans la vue manage-invoices pour cette année
//               // et si SocketIO ne gère pas nativement cette mise à jour côté client pour l'émetteur
//                if (location.pathname.endsWith('/manage-invoices') && String(response.annee) === anneeFinanciere) {
//                    fetchFactures(anneeFinanciere); // Recharger pour être sûr
//                }
//               console.log('Facture ajoutée avec succès.');
//                // Réinitialiser le formulaire si nécessaire dans FormFacture ou ici
//             }
//         };

//         xhr.onerror = () => {
//             setUploadProgress(null);
//             setTimeLeft('');
//             console.error('addFacture: Erreur réseau lors de l\'upload');
//             alert('Erreur réseau lors de l\'ajout de la facture.');
//         };

//         xhr.send(formData);
//     }


//     async function deleteFacture(id) {
//         // Vérifier le rôle UI (la vérification backend est la sécurité finale)
//          if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//              alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
//              return false;
//          }

//          if (!window.confirm('Supprimer cette facture ?')) return false;

//         try {
//           // Utiliser authorizedFetch ici
//           const res = await authorizedFetch(`${API_URL}/api/factures/${id}?annee=${anneeFinanciere}`, {
//             method: 'DELETE',
//           });
//           if (!res.ok) {
//              // authorizedFetch gère déjà les 401/403
//              const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
//              throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//            }
//           console.log(`deleteFacture: Facture ${id} supprimée.`);
//           // Pas besoin de re-fetch ici si SocketIO gère la suppression en temps réel pour tous
//           // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
//           fetchFactures(anneeFinanciere); // Recharger pour être sûr
//           return true;
//         } catch (e) {
//            console.error('deleteFacture: Erreur lors de la suppression :', e);
//            // authorizedFetch gère déjà les erreurs 401/403
//            if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//               alert(`Erreur lors de la suppression de la facture : ${e.message}`);
//            }
//            return false;
//         }
//     }

//     async function updateFacture(id, data) {
//          // Vérifier le rôle UI
//          if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//               alert("Vous n'avez pas le rôle nécessaire pour modifier une facture.");
//               return false;
//           }

//         // ... (logique existante)
//         try {
//            // Utiliser authorizedFetch ici
//            const res = await authorizedFetch(`${API_URL}/api/factures/${id}`, {
//                method: 'PUT',
//                headers: { 'Content-Type': 'application/json' },
//                body: JSON.stringify({ ...data, annee: anneeFinanciere }),
//            });
//            if (!res.ok) {
//                 // authorizedFetch gère déjà les 401/403
//                 const errorText = await res.text(); // Tente de lire le corps même en cas d'erreur non 401/403
//                 throw new Error(`Erreur HTTP ! statut: ${res.status} - ${errorText}`);
//               }
//            console.log(`updateFacture: Facture ${id} mise à jour.`);
//            // Pas besoin de re-fetch si SocketIO gère la mise à jour
//            // Si SocketIO ne met à jour que les autres clients, ou en cas de doute, un fetch est plus sûr.
//            fetchFactures(anneeFinanciere); // Recharger pour être sûr
//            return true;
//         } catch (e) {
//            console.error('updateFacture: Erreur lors de la mise à jour :', e);
//            // authorizedFetch gère déjà les erreurs 401/403
//             if (!e.message.includes("Session expirée") && !e.message.includes("Accès refusé")) {
//                alert(`Erreur lors de la mise à jour de la facture : ${e.message}`);
//             }
//            return false;
//         }
//     }

//      // Adapter downloadFile si nécessaire (pas besoin de rôle, mais utilise authorizedFetch)
//      const downloadFile = async (factureId, annee) => {
//           // Vérification de rôle UI (si nécessaire, mais probablement pas pour le download)
//          // if (userRole !== 'soumetteur' && userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//          //      alert("Vous n'avez pas le rôle nécessaire pour télécharger un fichier.");
//          //      return;
//          //  }
//          try {
//              // Utiliser authorizedFetch ici
//              const response = await authorizedFetch(`${API_URL}/api/factures/${factureId}/fichier?annee=${annee}`);

//              if (!response.ok) {
//                  // authorizedFetch gère déjà les 401/403. Gérer les autres erreurs spécifiques ici.
//                  if (response.status === 404) {
//                      alert('Fichier non trouvé.');
//                      return;
//                  }
//                 const errorText = await response.text();
//                 throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
//              }

//              // ... reste de la logique de téléchargement ...
//               const blob = await response.blob();
//               const disposition = response.headers.get('Content-Disposition');
//               let filename = `facture_${factureId}_fichier`; // Nom par défaut
//               if (disposition && disposition.indexOf('attachment') !== -1) {
//                 const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
//                 const matches = filenameRegex.exec(disposition);
//                 if (matches != null && matches[1]) {
//                   filename = matches[1].replace(/['"]/g, '');
//                 }
//               }

//               // Créer un lien temporaire pour le téléchargement
//               const url = window.URL.createObjectURL(blob);
//               const a = document.createElement('a');
//               a.href = url;
//               a.download = filename; // Nom du fichier à télécharger
//               document.body.appendChild(a);
//               a.click();
//               // Nettoyer après le téléchargement
//               a.remove();
//               window.URL.revokeObjectURL(url);
//               console.log(`Fichier ${filename} téléchargé avec succès.`);

//          } catch (error) {
//              console.error('Erreur lors du téléchargement du fichier :', error);
//               // authorizedFetch gère déjà les erreurs 401/403
//               if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
//                 alert(`Erreur lors du téléchargement du fichier : ${error.message}`);
//               }
//          }
//      };


//     async function exportFacturesCsv() {
//         // Vérifier le rôle UI
//         if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//              alert("Vous n'avez pas le rôle nécessaire pour exporter les factures.");
//              setIsSidebarOpen(false); // Fermer la sidebar même en cas d'échec de rôle côté UI
//              return false;
//          }

//         try {
//             const exportUrl = `${API_URL}/api/factures/export-csv?annee=${anneeFinanciere}`;
//             console.log(`exportFacturesCsv: Exportation des factures pour l'année financière ${anneeFinanciere}...`);
//             // Utiliser authorizedFetch ici
//             const response = await authorizedFetch(exportUrl);

//             if (!response.ok) {
//                // authorizedFetch gère déjà les 401/403
//                const errorText = await response.text();
//                throw new Error(`Erreur HTTP ! statut: ${response.status} - ${errorText}`);
//             }

//             // ... reste de la logique d'exportation ...
//             const disposition = response.headers.get('Content-Disposition');
//              let filename = `factures_${anneeFinanciere}.csv`;
//              if (disposition) {
//                const filenameMatch = disposition.match(/filename="?(.+)"?/);
//                if (filenameMatch && filenameMatch[1]) {
//                  filename = filenameMatch[1];
//                }
//              }

//              const blob = await response.blob();
//              const url = window.URL.createObjectURL(blob);
//              const a = document.createElement('a');
//              a.href = url;
//              a.download = filename;
//              document.body.appendChild(a);
//              a.click();
//              a.remove();
//              window.URL.revokeObjectURL(url);

//              console.log('exportFacturesCsv: Factures exportées avec succès.');
//              return true;

//         } catch (error) {
//             console.error('exportFacturesCsv: Erreur lors de l\'exportation des factures :', error);
//              // authorizedFetch gère déjà les erreurs 401/403
//              if (!error.message.includes("Session expirée") && !error.message.includes("Accès refusé")) {
//                alert(`Erreur lors de l'exportation des factures : ${error.message}`);
//              }
//             return false;
//         } finally {
//             setIsSidebarOpen(false); // Fermer la sidebar après l'action
//         }
//     }


//     // --- Fonctions Budget (passées à BudgetDashboard, utilisent authorizedFetch) ---
//     // Ces fonctions sont déjà adaptées pour la vérification de rôle UI et l'utilisation de authorizedFetch
//     // dans la section précédente, lors de la modification de BudgetDashboard.jsx.
//     // Vous devez copier/coller les définitions finales de ces fonctions ici depuis vos notes ou l'exemple précédent.

//     //  const fetchBudget = async (year) => { /* ... votre code fetchBudget utilisant authorizedFetch et userRole ... */ };
//     //  const addBudgetEntry = async (entryData) => { /* ... votre code addBudgetEntry utilisant authorizedFetch et userRole ... */ };
//     //  const updateBudgetEntry = async (entryId, updatedData) => { /* ... votre code updateBudgetEntry utilisant authorizedFetch et userRole ... */ };
//     //  const deleteBudgetEntry = async (entryId) => { /* ... votre code deleteBudgetEntry utilisant authorizedFetch et userRole ... */ };
//     //  const verifyPin = async (pin) => { /* ... votre code verifyPin utilisant authorizedFetch (si protégé) ... */ };
//     // 1) Récupérer les entrées budgétaires pour une année
//     const fetchBudget = async (year) => {
//         // UI-check (optionnel) : seuls gestionnaires et approbateurs peuvent lire
//         if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//             console.warn('fetchBudget blocqué, rôle insuffisant:', userRole);
//             return [];
//         }
//         const res = await authorizedFetch(`${API_URL}/api/budget?annee=${year}`);
//         if (!res.ok) {
//             throw new Error(`fetchBudget HTTP ${res.status} – ${await res.text()}`);
//         }
//         return res.json();
//     };

//     // 2) Ajouter une entrée budgétaire
//     const addBudgetEntry = async (entryData, anneeFinanciere) => {
//         const payload = {
//           financial_year: anneeFinanciere,  // clé attendue par votre backend
//           fund_type:    entryData.fund_type,
//           revenue_type: entryData.revenue_type,
//           amount:       entryData.amount,
//         };
      
//         const res = await authorizedFetch(`${API_URL}/api/budget`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify(payload),
//         });
//         console.log("addBudgetEntry:",res);
        
//         if (!res.ok) {
//           console.log("addBudgetEntry erreur HTTP", res.status);
//           return false;
//         }
//         return true;
//     };

//     // 3) Modifier une entrée
//     const updateBudgetEntry = async (entryId, updatedData) => {
//         if (userRole !== 'gestionnaire') {
//             console.warn('updateBudgetEntry blocqué, rôle insuffisant:', userRole);
//             return false;
//         }
//         const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
//             method: 'PUT',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(updatedData),
//         });
//         if (!res.ok) {
//             console.error('updateBudgetEntry erreur HTTP', res.status);
//             return false;
//         }
//         return true;
//     };

//     // 4) Supprimer une entrée
//     const deleteBudgetEntry = async (entryId) => {
//         if (userRole !== 'gestionnaire') {
//             console.warn('deleteBudgetEntry blocqué, rôle insuffisant:', userRole);
//             return false;
//         }
//         const res = await authorizedFetch(`${API_URL}/api/budget/${entryId}`, {
//             method: 'DELETE',
//         });
//         if (!res.ok) {
//             console.error('deleteBudgetEntry erreur HTTP', res.status);
//             return false;
//         }
//         return true;
//     };

//     // 5) Vérifier un PIN côté back
//     const verifyPin = async (pin) => {
//         // tout rôle peut vérifier, selon votre back ; sinon adaptez ici
//         const res = await authorizedFetch(`${API_URL}/api/budget/verify-pin`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ pin }),
//         });
//         if (!res.ok) {
//             console.error('verifyPin erreur HTTP', res.status);
//             return false;
//         }
//         const { success } = await res.json();  // <-- clé correcte
//         return success === true;
//     };


//   /**
//    * Gère le clic sur un élément du menu de la barre latérale.
//    * - Navigue vers la route correspondante et ferme la barre latérale.
//    * @param {string} view - Vue à afficher ('home', 'manage-invoices', 'manage-budget', 'manage-users').
//    */
//    const handleMenuItemClick = (view) => {
//        // Utiliser navigate pour changer la route.
//        // Les Routes dans le contenu principal (en dessous) géreront quel composant est rendu.
//        navigate(`/dashboard/${view}`);
//        setIsSidebarOpen(false);
//    };


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
//            {/* Afficher le rôle de l'utilisateur s'il est défini */}
//            {userRole && (
//                <div className="hidden sm:flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-4">
//                    Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)} {/* Capitalize first letter */}
//                </div>
//            )}
//            {/* Afficher le compteur de clients */}
//            <div className="hidden sm:flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm mr-4">
//              Clients en ligne : {clientCount}
//            </div>
//            {/* Bouton de déconnexion */}
//            <button
//               onClick={handleLogout} // handleLogout est passé en prop depuis App.jsx
//               className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
//            >
//               Déconnexion
//            </button>
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
//         className={`fixed top-0 left-0 w-64 bg-white h-full shadow-lg transform transition-transform duration-300 z-50 flex flex-col ${
//           isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
//         }`}
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
//                 className={`block w-full text-left py-2 px-2 rounded-md ${
//                   currentSubView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Accueil
//               </button>
//             </li>
//             {/* Lien Gérer les factures (accessible si rôle permet) */}
//              {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                  <li>
//                    <button
//                      onClick={() => handleMenuItemClick('manage-invoices')}
//                      className={`block w-full text-left py-2 px-2 rounded-md ${
//                        currentSubView === 'manage-invoices' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                      }`}
//                    >
//                      Gérer les factures
//                    </button>
//                  </li>
//              )}
//             {/* Lien Gérer le budget (accessible si rôle permet) */}
//              {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                  <li>
//                    <button
//                      onClick={() => handleMenuItemClick('manage-budget')}
//                      className={`block w-full text-left py-2 px-2 rounded-md ${
//                        currentSubView === 'manage-budget' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                      }`}
//                    >
//                      Gérer le budget
//                    </button>
//                  </li>
//              )}
//              {/* Lien Gérer les utilisateurs (accessible si gestionnaire) */}
//               {userRole === 'gestionnaire' && (
//                   <li>
//                     <button
//                       onClick={() => handleMenuItemClick('manage-users')}
//                       className={`block w-full text-left py-2 px-2 rounded-md ${
//                         currentSubView === 'manage-users' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
//                       }`}
//                     >
//                       Gérer les utilisateurs
//                     </button>
//                   </li>
//               )}
//              {/* Lien Exporter en CSV (accessible si rôle permet) */}
//             {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                  <li>
//                    <button
//                      onClick={exportFacturesCsv} // Cette fonction contient déjà une vérification de rôle UI et appel authorizedFetch
//                      className="block w-full text-left py-2 px-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
//                    >
//                      Exporter en CSV
//                    </button>
//                  </li>
//              )}
//           </ul>
//         </div>
//         {/* Compteur de clients et rôle dans le pied de page (mobile uniquement) */}
//         <div className="p-4 border-t border-gray-200 sm:hidden flex justify-around items-center">
//            {userRole && (
//                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm text-center">
//                   Rôle : {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
//                </div>
//            )}
//           <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-center">
//             Clients en ligne : {clientCount}
//           </div>
//         </div>
//       </div>

//       {/* Contenu Principal - Utiliser Routes pour les sous-vues de /dashboard */}
//       {/* Le pt-40 sm:pt-75 doit laisser de la place pour l'en-tête fixe */}
//       <div className="container mx-auto px-4 pb-4 pt-40 sm:pt-75 transition-all duration-300">
//          <Routes> {/* Les routes enfants de /dashboard. Ces routes sont rendues si la route parente (/dashboard) est active. */}
//             {/* Route Accueil du Dashboard */}
//             <Route path="home" element={
//                  <div className="text-center mt-10">
//                    {/* Afficher un message de bienvenue avec le rôle */}
//                    <h2 className="text-2xl font-semibold text-gray-700">Bienvenue, {userRole}!</h2>
//                    <p className="text-gray-600 mt-4">Sélectionnez une option dans le menu pour commencer.</p>
//                  </div>
//             } />

//             {/* Route Gérer les factures (accessible si rôle permet) */}
//             {/* Le composant ne sera monté que si la route correspond ET si le rôle permet */}
//             {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                 <Route path="manage-invoices" element={
//                     <>
//                       {/* Le formulaire d'ajout (peut être restreint aux soumetteurs et gestionnaires par exemple) */}
//                        {(userRole === 'soumetteur' || userRole === 'gestionnaire') && (
//                            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
//                              <h2 className="text-lg font-semibold mb-4">Ajouter une facture</h2>
//                              {uploadProgress !== null && ( /* Afficher la progression si upload en cours */
//                                <div className="mb-4">
//                                  <div className="w-full bg-gray-200 rounded">
//                                    <div
//                                      className="text-center text-white py-1 rounded bg-blue-500"
//                                      style={{ width: `${uploadProgress}%`, transition: 'width 0.2s' }}
//                                    >
//                                      {uploadProgress}%
//                                    </div>
//                                  </div>
//                                  <div className="text-right text-sm text-gray-600 mt-1">
//                                    Temps restant estimé : {timeLeft}
//                                  </div>
//                                </div>
//                              )}
//                              {/* Passer les fonctions nécessaires à FormFacture */}
//                              <FormFacture onSubmit={addFacture} annee={anneeFinanciere} setAnnee={setAnneeFinanciere} />
//                            </div>
//                        )}

//                       {/* Le tableau des factures */}
//                       <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
//                         <h2 className="text-lg font-semibold mb-4">Factures ajoutées</h2>
//                         {/* Passer les factures, les fonctions de gestion et le rôle à TableFactures */}
//                         <TableFactures factures={factures} onDelete={deleteFacture} onUpdate={updateFacture} downloadFile={downloadFile} userRole={userRole} />
//                       </div>
//                     </>
//                 } />
//             )}


//                   {/* Route Gérer le budget (accessible si rôle permet) */}
//                   {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                       <Route path="manage-budget" element={
//                           <BudgetDashboard
//                               anneeFinanciere={anneeFinanciere}
//                               fetchBudget={fetchBudget}                              
//                               authorizedFetch={authorizedFetch}     // <— ajouté
//                               API_URL={API_URL}                     // <— ajouté
//                               addBudgetEntry={addBudgetEntry}                              
//                               updateBudgetEntry={updateBudgetEntry}
//                               deleteBudgetEntry={deleteBudgetEntry}
//                               verifyPin={verifyPin}
//                               userRole={userRole}
//                               // PASSER UNE FONCTION QUI UTILISE authorizedFetch POUR RECUPERER LES FACTURES
//                               fetchFacturesForBudget={() => fetchFactures(anneeFinanciere)} // Nouvelle prop
//                           />
//                           // Note : BudgetDashboard semble fetch ses propres factures pour les dépenses,
//                           // assurez-vous qu'il utilise authorizedFetch pour cela.
//                           // Si fetchFactures ou factures étaient utilisés ici avant pour BudgetDashboard,
//                           // ils ont été retirés car BudgetDashboard est maintenant plus autonome pour ses données.

//                       } />
//                   )}

//              {/* Route Gérer les utilisateurs (accessible si gestionnaire) */}
//               {userRole === 'gestionnaire' && (
//                   <Route path="manage-users" element={
//                       <UserManagement
//                          authorizedFetch={authorizedFetch} // Passer la fonction fetch sécurisée
//                          // Optionnel: passer l'ID et le rôle de l'utilisateur courant pour logique UI (ex: ne pas modifier son propre rôle)
//                          // currentUserId={userId} // Si userId est stocké et passé en prop
//                          currentUserRole={userRole} // Le rôle est déjà passé
//                       />
//                   } />
//               )}


//             {/* Route par défaut pour /dashboard (redirige vers /dashboard/home) */}
//              {/* Cette route catchera /dashboard s'il n'y a rien après */}
//              <Route index element={<Navigate to="home" replace />} />
//              {/* ou <Route path="" element={<Navigate to="home" replace />} /> */}


//             {/* Gérer les URLs invalides sous /dashboard (ex: /dashboard/abc) */}
//              {/* Redirige vers l'accueil du dashboard si la sous-route n'est pas trouvée */}
//              <Route path="*" element={<Navigate to="home" replace />} />


//          </Routes>

//       </div>
//     </div>
//   );
// }

// export default MainLayout;










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

  // -----------------------------------
  // Statut du serveur (Backend)
  // -----------------------------------
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

  useEffect(() => {
    async function pingBackend() {
      try {
        // Appel à une route qui ne nécessite PAS d'authentification pour vérifier la joignabilité du serveur.
        // Le endpoint /api/users est utilisé dans LoginPage à cette fin.
        const res = await fetch(`${API_URL}/api/users`);
        if (res.ok) { // Vérifie si la réponse HTTP est dans la plage 200-299
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    }
    pingBackend();
  }, []); // S'exécute une seule fois au montage du composant

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
        // ... (création de formData et logique de progression/temps)
        const file = factureData.fichier;
        const formData = new FormData();
        formData.append('annee', anneeFinanciere);
        formData.append('type', factureData.type);
        formData.append('ubr', factureData.ubr || '');
        formData.append('fournisseur', factureData.fournisseur || '');
        formData.append('description', factureData.description || '');
        formData.append('montant', factureData.montant);
        formData.append('statut', factureData.statut); // Le statut par défaut peut être 'Soumis' défini ici si pas géré par backend
        if (file) {
          // Validation UI de la taille du fichier (déjà présente si copié)
          const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go
          if (file.size > MAX_FILE_SIZE_BYTES) {
             alert(`La taille du fichier (${(file.size / 1024 / 1024).toFixed(2)} MB) dépasse la limite autorisée (2 GB).`);
             return;
          }
          formData.append('fichier', file);
        } else {
            // Si aucun fichier, s'assurer que le backend accepte
            // ou ajouter une validation si le fichier est requis pour certains types/statuts
        }


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
                if (location.pathname.endsWith('/manage-invoices') && String(response.annee) === anneeFinanciere) {
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

        xhr.send(formData);
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
           //    alert("Vous n'avez pas le rôle nécessaire pour télécharger un fichier.");
           //    return;
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
            throw new Error(`WorkspaceBudget HTTP ${res.status} – ${await res.text()}`);
        }
        return res.json();
    };

    // 2) Ajouter une entrée budgétaire
    const addBudgetEntry = async (entryData, anneeFinanciere) => {
        const payload = {
          financial_year: anneeFinanciere,  // clé attendue par votre backend
          fund_type:    entryData.fund_type,
          revenue_type: entryData.revenue_type,
          amount:       entryData.amount,
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
        const { success } = await res.json();  // <-- clé correcte
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
            {/* Statut du back-end dans l'en-tête */}
            <div className="hidden sm:flex items-center px-3 py-1 text-sm mr-4">
              Statut serveur:{' '}
              {backendStatus === 'checking' && <span className="text-gray-500 font-semibold">…</span>}
              {backendStatus === 'online'   && <span className="text-green-600 font-semibold">🟢 En ligne</span>}
              {backendStatus === 'offline'  && <span className="text-red-600 font-semibold">🔴 Hors ligne</span>}
            </div>
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

      {/* Barre latérale (Sidebar) */}
      <div
        className={`
          fixed inset-y-0 left-0 w-64 bg-gray-800 text-white
          transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          transition-transform duration-300 ease-in-out z-20
          sm:translate-x-0 sm:relative sm:flex-shrink-0 sm:w-64
          pt-20 sm:pt-0 /* Ajuste le padding top pour ne pas être sous le header fixe */
        `}
      >
        <nav className="mt-6">
          {/* Lien pour le tableau de bord principal */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); handleMenuItemClick('home'); }}
            className={`
              flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white
              ${currentSubView === 'home' || currentSubView === 'dashboard' ? 'bg-gray-700 text-white' : ''}
            `}
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m0 0l-7 7m7-7v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001 1h2a1 1 0 001-1m-6 0a1 1 0 011-1h2a1 1 0 011 1" />
            </svg>
            Tableau de bord
          </a>

          {/* Lien pour Gérer les factures */}
          {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleMenuItemClick('manage-invoices'); }}
              className={`
                flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white
                ${currentSubView === 'manage-invoices' ? 'bg-gray-700 text-white' : ''}
              `}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Gérer les factures
            </a>
          )}

          {/* Lien pour Gérer le budget */}
          {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleMenuItemClick('manage-budget'); }}
              className={`
                flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white
                ${currentSubView === 'manage-budget' ? 'bg-gray-700 text-white' : ''}
              `}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Gérer le budget
            </a>
          )}

          {/* Lien pour Gérer les utilisateurs (Admin seulement) */}
          {userRole === 'admin' && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleMenuItemClick('manage-users'); }}
              className={`
                flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white
                ${currentSubView === 'manage-users' ? 'bg-gray-700 text-white' : ''}
              `}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm-6-4a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
              Gérer les utilisateurs
            </a>
          )}
           {/* Bouton d'exportation CSV si l'utilisateur est gestionnaire ou approbateur */}
           {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); exportFacturesCsv(); }}
              className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white mt-4"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter CSV
            </a>
           )}
        </nav>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-8 mt-20 sm:ml-64 sm:mt-0"> {/* Ajuste la marge supérieure pour ne pas être sous le header fixe */}
        <Routes>
          {/* Route par défaut pour /dashboard - redirige vers /dashboard/home */}
          <Route path="/" element={<Navigate to="home" replace />} />

          {/* Page d'accueil/tableau de bord simple */}
          <Route path="home" element={
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-4">Bienvenue sur la plateforme Habitek !</h2>
              <p className="text-gray-700">
                Connectés: <span className="font-bold">{clientCount}</span> client(s).
              </p>
              <p className="text-gray-700 mt-2">
                Votre rôle est : <span className="font-bold text-blue-600">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>.
              </p>
            </div>
          } />

          {/* Route pour Gérer les factures */}
          {(userRole === 'soumetteur' || userRole === 'gestionnaire' || userRole === 'approbateur') ? (
            <Route path="manage-invoices" element={
              <div className="space-y-8">
                <FormFacture
                  addFacture={addFacture}
                  anneeFinanciere={anneeFinanciere}
                  setAnneeFinanciere={setAnneeFinanciere}
                  uploadProgress={uploadProgress}
                  timeLeft={timeLeft}
                  userRole={userRole} // Passe le rôle au FormFacture pour la logique UI
                />
                <TableFactures
                  factures={factures}
                  deleteFacture={deleteFacture}
                  updateFacture={updateFacture}
                  downloadFile={downloadFile}
                  anneeFinanciere={anneeFinanciere}
                  setAnneeFinanciere={setAnneeFinanciere}
                  userRole={userRole} // Passe le rôle à TableFactures pour la logique UI
                />
              </div>
            } />
          ) : (
            <Route path="manage-invoices" element={
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Accès refusé!</strong>
                <span className="block sm:inline"> Vous n'avez pas les permissions nécessaires pour gérer les factures.</span>
              </div>
            } />
          )}

          {/* Route pour Gérer le budget */}
          {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
            <Route path="manage-budget" element={
              <BudgetDashboard
                anneeFinanciere={anneeFinanciere}
                setAnneeFinanciere={setAnneeFinanciere}
                fetchBudget={fetchBudget}
                addBudgetEntry={addBudgetEntry}
                updateBudgetEntry={updateBudgetEntry}
                deleteBudgetEntry={deleteBudgetEntry}
                verifyPin={verifyPin}
                userRole={userRole} // Passe le rôle à BudgetDashboard
              />
            } />
          ) : (
            <Route path="manage-budget" element={
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Accès refusé!</strong>
                <span className="block sm:inline"> Vous n'avez pas les permissions nécessaires pour gérer le budget.</span>
              </div>
            } />
          )}

          {/* Route pour Gérer les utilisateurs */}
          {userRole === 'admin' ? (
            <Route path="manage-users" element={
              <UserManagement
                authorizedFetch={authorizedFetch}
                userToken={userToken}
                userRole={userRole} // Passe le rôle à UserManagement
              />
            } />
          ) : (
            <Route path="manage-users" element={
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Accès refusé!</strong>
                <span className="block sm:inline"> Vous n'avez pas les permissions nécessaires pour gérer les utilisateurs.</span>
              </div>
            } />
          )}

          {/* Fallback pour les routes non trouvées à l'intérieur de /dashboard */}
          <Route path="*" element={<Navigate to="home" replace />} />
        </Routes>
      </div>

      {/* Overlay pour fermer la sidebar sur les petits écrans */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-10 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default MainLayout;