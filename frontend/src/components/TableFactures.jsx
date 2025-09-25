// //////////////////////////////////

// // src/components/TableFactures.jsx
// // Affiche une liste de factures sous forme de tableau (pour les écrans larges) ou de cartes (pour les écrans mobiles).
// // Permet de trier les factures par colonne.
// // Permet de télécharger les fichiers associés, de supprimer des factures et de modifier leur statut via des fonctions passées en props.
// // Applique des restrictions d'affichage des actions basées sur le rôle de l'utilisateur connecté.

// import React, { useState, useEffect } from 'react'; // Importez useState et useEffect
// import { format } from 'date-fns'; // Importez la fonction format de date-fns
// import { fr } from 'date-fns/locale'; // Importez la locale française
// import { formatInTimeZone, toDate} from 'date-fns-tz';
// import { useNavigate } from 'react-router-dom';


// // === Registre des colonnes du tableau Factures ===
// // ➜ Ajuste la liste en fonction des champs que tu as réellement.
//  const ALL_COLUMNS = [
//    { key: 'id',               label: 'ID',              sortable: true,  render: f => f.id },
//    { key: 'numero_facture',   label: '# Facture',       sortable: true,  render: f => f.numero_facture || '—' },
//    { key: 'date_facture',     label: 'Date',            sortable: true,  render: f => f.date_facture },
//    { key: 'type_facture',     label: 'Type',            sortable: true,  render: f => f.type_facture || 'N/A' },
//    { key: 'ubr',              label: 'UBR',             sortable: true,  render: f => f.ubr || 'N/A' },
//    { key: 'fournisseur',      label: 'Fournisseur',     sortable: true,  render: f => f.fournisseur || 'N/A' },
//    { key: 'description',      label: 'Description',     sortable: true,  render: f => f.description || 'N/A' },
//    { key: 'montant',          label: 'Montant',         sortable: true,  render: f => f.montant }, // on affiche $ ailleurs
//    { key: 'devise',           label: 'Devise',          sortable: true,  render: f => f.devise || 'N/A' },
//    { key: 'statut',           label: 'Statut',          sortable: true,  render: f => f.statut || 'N/A' },
//    { key: 'categorie',        label: 'Catégorie',       sortable: true,  render: f => f.categorie || 'N/A' },
//    { key: 'ligne_budgetaire', label: 'Ligne Budgétaire',sortable: true,  render: f => f.ligne_budgetaire || 'N/A' },
//    { key: 'compte_depense_id',label: 'Compte dépense',  sortable: true,  render: f => f.compte_depense_id ? f.compte_depense_id : '—' },
//    { key: 'soumetteur_username',label:'Soumetteur',     sortable: true,  render: f => f.soumetteur_username || 'N/A' },
//    { key: 'date_soumission',  label: 'Soumis le',       sortable: true,  render: f => f.date_soumission || 'N/A' },
//    { key: 'created_by_username',label:'Créé par',       sortable: true,  render: f => f.created_by_username || 'N/A' },
//    { key: 'last_modified_by_username', label: 'Modifié par', sortable: true, render: f => f.last_modified_by_username || 'N/A' },
//    { key: 'last_modified_timestamp',   label: 'Dernière modification', sortable: true, render: f => f.last_modified_timestamp || null },
//  ];

// // Colonnes qui ne sont PAS contrôlables (toujours visibles) — adapte à ton tableau :
// const ALWAYS_ON_COLUMNS = ['fichier', 'actions']; // si tu as ces colonnes “Fichier” et “Actions”




// // -----------------------------------
// // Composant TableFactures
// // -----------------------------------

// /**
//  * Affiche une liste de factures avec des actions disponibles selon le rôle de l'utilisateur.
//  * Permet également le tri par colonne.
//  * **Les actions API (delete, update, download) sont gérées par des fonctions passées en props.**
//  * @param {Object} props - Propriétés du composant.
//  * @param {Array} props.factures - Liste des factures à afficher.
//  * @param {Function} props.onDelete - Fonction appelée pour supprimer une facture (reçoit l'ID).
//  * @param {Function} props.onUpdate - Fonction appelée pour mettre à jour une facture (reçoit l'ID et les données).
//  * @param {Function} props.downloadFile - Fonction appelée pour télécharger un fichier (reçoit l'ID et l'année).
//  * @param {string} props.userRole - Rôle de l'utilisateur connecté ('soumetteur', 'gestionnaire', 'approbateur').
//  * @returns {JSX.Element} Tableau ou cartes représentant les factures.
//  */
// function TableFactures({ factures, onDelete, onUpdate, downloadFile, userRole, currentUserId }) {
//   // -----------------------------------
//   // Gestion des États
//   // -----------------------------------
//   // État pour la colonne de tri actuelle (par défaut 'date_soumission' ou 'id')
//   const [sortColumn, setSortColumn] = useState('date_soumission');
//   // État pour la direction du tri ('asc' ou 'desc')
//   const [sortDirection, setSortDirection] = useState('desc');

//   // État pour l’édition in-line
//   const [editingFacture, setEditingFacture] = useState(null);

//   const navigate = useNavigate();

//   const goToCompte = (cid) => {
//     if (!cid) return;
//     navigate(`/dashboard/depense-comptes?id=${encodeURIComponent(cid)}`);
//   };

//   // -----------------------------------
//   // Fonctions Utilitaires
//   // -----------------------------------
//   const MONTREAL_TIMEZONE = 'America/Montreal';
  
//   // Colonnes visibles par défaut (tu peux ajuster) :
//   const DEFAULT_VISIBLE = [
//     'numero_facture','date_facture','fournisseur','montant','statut',
//     'categorie','ligne_budgetaire','compte_depense_id','soumetteur_username'
//   ];

//   // VisibleColumns ← Set pour lookup rapide
//   const [visibleCols, setVisibleCols] = useState(() => {
//     try {
//       const saved = JSON.parse(localStorage.getItem('factures.visibleCols'));
//       return new Set(Array.isArray(saved) ? saved : DEFAULT_VISIBLE);
//     } catch {
//       return new Set(DEFAULT_VISIBLE);
//     }
//   });

//   // Sauvegarder à chaque modification
//   useEffect(() => {
//     localStorage.setItem('factures.visibleCols', JSON.stringify([...visibleCols]));
//   }, [visibleCols]);

//   // Helper pour basculer une colonne
//   const toggleColumn = (key) => {
//     setVisibleCols(prev => {
//       const next = new Set(prev);
//       if (next.has(key)) next.delete(key); else next.add(key);
//       return next;
//     });
//   };
//   // Etat d’ouverture du sélecteur
//   const [showColumnPicker, setShowColumnPicker] = useState(false);


//   /**
//    * Formate une date/heure pour l'affichage dans le fuseau horaire de Montréal.
//    * Inclut des logs détaillés pour comprendre le décalage.
//    * @param {string|Date} dateString - La date/heure UTC à formater.
//    * @returns {string} La date/heure formatée ou un indicateur si absent.
//    */
 
//   const formatDateTime = (dateString) => {
//     if (!dateString) return 'N/A';
//     try {
//       const date = new Date(dateString);
//       if (isNaN(date.getTime())) return 'Date invalide';
//       console.log("date : ",date);
  
//       return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: fr });
//     } catch (error) {
//       console.error("Erreur lors du formatage :", dateString, error);
//       return 'Erreur formatage';
//     }
//   };


//   const formatDate = (dateString) => {
//     if (!dateString) return 'N/A';
//     try {
//       const rawDate = new Date(dateString);
//       if (isNaN(rawDate.getTime())) {
//         console.error("Date invalide avant toDate :", dateString);
//         return 'Date invalide';
//       }
//       const date = toDate(rawDate);
//       const formatted = formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy', { locale: fr });
  
//       console.log(`📅 formatDate : ${dateString} → ${formatted}`);
//       return formatted;
//     } catch (error) {
//       console.error("Erreur lors du formatage de la date :", dateString, error);
//       return 'Erreur formatage';
//     }
//   };

//   // -----------------------------------
//   // Logique de Tri
//   // -----------------------------------

//   /**
//    * Gère le clic sur l'en-tête d'une colonne pour déclencher le tri.
//    * @param {string} column - Le nom de la colonne par laquelle trier.
//    */
//   const handleHeaderClick = (column) => {
//     if (column === sortColumn) {
//       setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
//     } else {
//       setSortColumn(column);
//       setSortDirection('asc');
//     }
//   };

//    /**
//     * Fonction de comparaison pour le tri des factures.
//     * Gère différents types de données (chaînes, nombres, dates, null/undefined).
//     * @param {Object} a - Premier objet facture à comparer.
//     * @param {Object} b - Deuxième objet facture à comparer.
//     * @param {string} column - La colonne sur laquelle baser la comparaison.
//     * @param {string} direction - La direction du tri ('asc' ou 'desc').
//     * @returns {number} -1 si a < b, 1 si a > b, 0 si a === b.
//     */
//    const compareValues = (a, b, column, direction) => {
//        const valueA = a[column];
//        const valueB = b[column];

//        // Gérer les valeurs null ou indéfinies pour éviter les erreurs de comparaison
//        // Les valeurs null/undefined sont triées avant les autres en ordre ascendant.
//        if (valueA == null && valueB == null) return 0;
//        if (valueA == null) return direction === 'asc' ? -1 : 1;
//        if (valueB == null) return direction === 'asc' ? 1 : -1;


//        let comparison = 0;

//        // Logique de comparaison basée sur le type de données ou le nom de colonne
//        if (column.includes('date') || column.includes('timestamp')) {
//            // Tenter de comparer comme des dates si le nom de colonne l'indique
//            try {
//                const dateA = new Date(valueA);
//                const dateB = new Date(valueB);
//                comparison = dateA.getTime() - dateB.getTime();
//                // Gérer les dates invalides résultant du parsing
//                if (isNaN(comparison)) {
//                    // Revenir à la comparaison de chaînes si les dates sont invalides
//                    console.warn(`Date invalide rencontrée lors du tri de la colonne "${column}". Reversion à la comparaison de chaînes.`);
//                    comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//                }
//            } catch (e) {
//                // En cas d'erreur de parsing, revenir à la comparaison de chaînes par défaut
//                console.warn(`Erreur de parsing de date pour le tri de la colonne "${column}":`, e);
//                comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//            }
//        } else if (typeof valueA === 'number' && typeof valueB === 'number') {
//            // Comparaison de nombres (pour ID, montant)
//            comparison = valueA - valueB;
//        } else if (typeof valueA === 'string' && typeof valueB === 'string') {
//             // Comparaison de chaînes (insensible à la casse)
//            comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
//        }
//         else {
//            // Comparaison par défaut (convertir en chaîne et comparer)
//             comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//        }


//        // Appliquer la direction du tri
//        return direction === 'asc' ? comparison : -comparison;
//    };


//   // Appliquer le tri aux factures (crée une copie pour ne pas modifier l'état original)
//   // Utilise useMemo si les performances deviennent un problème avec de très grandes listes (>1000 factures)
//   const sortedFactures = [...factures].sort((a, b) =>
//     compareValues(a, b, sortColumn, sortDirection)
//   );

//   // -----------------------------------
//   // Gestion des Événements (Appels via Props)
//   // -----------------------------------

//   /**
//    * Gère le clic sur le bouton de suppression d'une facture.
//    * Vérifie le rôle UI et demande confirmation avant d'appeler la prop onDelete.
//    * @param {number} id - ID de la facture à supprimer.
//    */
//   const handleDelete = (id) => {
//       // Vérification de rôle UI (la sécurité backend est la finale)
//       if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//           alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
//           return;
//       }
//       if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette facture ? Cette action est irréversible.')) {
//         // APPEL VIA PROP : Appelle la fonction onDelete passée par MainLayout
//         onDelete(id);
//       }
//   };

//    /**
//     * Gère le clic sur le bouton pour changer le statut d'une facture.
//     * Vérifie le rôle UI et appelle la prop onUpdate.
//     * @param {number} factureId - ID de la facture à modifier.
//     * @param {string} currentStatut - Statut actuel de la facture.
//     */
//     // const handleUpdateStatus = (factureId, currentStatut) => {
//     //      // Vérification de rôle UI (la sécurité backend est la finale)
//     //      if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//     //           alert("Vous n'avez pas le rôle nécessaire pour changer le statut.");
//     //           return;
//     //       }

//     //      const newStatut = prompt(`Changer le statut de la facture ${factureId}. Statut actuel : ${currentStatut}\nEntrez le nouveau statut (soumis, approuve, rejete, paye) :`);

//     //      if (newStatut === null || newStatut.trim() === "") {
//     //          return; // L'utilisateur a annulé ou entré une chaîne vide
//     //      }

//     //      const lowerNewStatut = newStatut.trim().toLowerCase();
//     //      const allowedStatuses = ['Soumis', 'Approuve', 'Rejete', 'Paye'];
//     //      if (!allowedStatuses.includes(lowerNewStatut)) {
//     //          alert(`Statut invalide. Veuillez utiliser l'un des statuts suivants : ${allowedStatuses.join(', ')}.`);
//     //          return;
//     //      }

//     //      // APPEL VIA PROP : Appelle la fonction onUpdate passée par MainLayout
//     //      // Passer l'ID et un objet contenant les champs à mettre à jour (ici, seulement le statut)
//     //      onUpdate(factureId, { statut: lowerNewStatut });
//     // };
//     const allowedStatuses = ['Soumis', 'Approuve', 'Rejete', 'Paye'];
//     const handleStatusChange = (factureId, newStatut) => {
//       if (!allowedStatuses.includes(newStatut)) {
//         alert("Statut invalide.");
//         return;
//       }
//       onUpdate(factureId, { statut: newStatut });
//     };

//     /**
//      * Gère le clic sur le bouton de téléchargement de fichier.
//      * Appelle la prop downloadFile.
//      * @param {number} factureId - ID de la facture.
//      * @param {string} anneeFacture - Année de la facture (si nécessaire par la prop downloadFile).
//      */
//     const handleDownloadClick = (factureId, anneeFacture) => {
//         // APPEL VIA PROP : Appelle la fonction downloadFile passée par MainLayout
//         // Cette fonction dans MainLayout utilisera authorizedFetch et gérera le téléchargement.
//         downloadFile(factureId, anneeFacture); // Passer l'année si la prop downloadFile en a besoin
//     };


//   // -----------------------------------
//   // Rendu du Composant
//   // -----------------------------------

//   /**
//    * Affiche les flèches de tri à côté de l'en-tête de colonne.
//    * @param {string} column - Le nom de la colonne actuelle (clé de l'objet facture).
//    * @returns {string|null} Les flèches de tri ou null.
//    */
//    const renderSortArrow = (column) => {
//        if (sortColumn === column) {
//            return sortDirection === 'asc' ? ' ↑' : ' ↓';
//        }
//        return null; // N'affiche rien si la colonne n'est pas celle du tri actif
//    };

//    // Définir les colonnes triables. Utiliser le nom de la propriété de l'objet facture.
//    const sortableColumns = [
//        'id', 'numero_facture', 'date_facture', 'type_facture', 'ubr', 'fournisseur',
//        'description', 'montant', 'devise', 'statut', 'categorie', 'ligne_budgetaire',
//        'compte_depense_id', 'soumetteur_username', 'date_soumission', 'created_by_username',
//        'last_modified_by_username', 'last_modified_timestamp'
//    ];

//    // Helper pour créer les en-têtes de tableau cliquables
//    const renderTableHeader = (columnKey, headerText) => (
//        <th
//            key={columnKey} // Clé unique pour chaque en-tête
//            className={`p-2 border ${sortableColumns.includes(columnKey) ? 'cursor-pointer hover:bg-gray-200' : ''}`}
//             // Ajouter onClick uniquement si la colonne est triable
//            onClick={sortableColumns.includes(columnKey) ? () => handleHeaderClick(columnKey) : undefined}
//        >
//            {headerText} {renderSortArrow(columnKey)}
//        </th>
//    );


//   return (
//     <>
//       {/* Tableau pour les écrans moyens et larges */}
//       {/* Afficher le tableau uniquement s'il y a des factures OU si le rôle permet l'ajout (pour voir le message "Aucune facture") */}
//       {/* Pour une meilleure UX, on affiche toujours le tableau s'il y a des factures ou si l'utilisateur peut en ajouter/voir */}
//        {/* La vérification peut être basée sur canViewFactures ou simplement sur la présence de factures */}
//        {/* Ici, on affiche la table si l'utilisateur peut voir les factures (canViewFactures) */}
//        {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (    






//           <table className="w-full text-left border-collapse hidden sm:table">
//             <thead>
//               <tr className="bg-gray-100">
//                 {/* Utiliser la fonction helper pour générer les en-têtes */}
//                 {renderTableHeader('id', '#')}
//                 {renderTableHeader('numero_facture', 'Numéro')}
//                 {renderTableHeader('date_facture', 'Date Facture')}
//                 {renderTableHeader('type', 'Type')}
//                 {renderTableHeader('ubr', 'UBR')}
//                 {renderTableHeader('fournisseur', 'Fournisseur')}
//                 {renderTableHeader('description', 'Description')}
//                 {renderTableHeader('montant', 'Montant')}
//                 {renderTableHeader('devise', 'Devise')}
//                 {renderTableHeader('statut', 'Statut')}
//                 {renderTableHeader('categorie', 'Catégorie')}
//                 {renderTableHeader('ligne_budgetaire', 'Ligne Budgétaire')}
//                 {renderTableHeader('compte_depense_id', 'Compte dépense')}
//                 {renderTableHeader('soumetteur_username', 'Soumetteur')}
//                 {renderTableHeader('date_soumission', 'Date Soumission')}
//                 {renderTableHeader('created_by_username', 'Créé par')}
//                 {renderTableHeader('last_modified_by_username', 'Modifié par')}
//                 {renderTableHeader('last_modified_timestamp', 'Dernière modification')}
//                 <th className="p-2 border">Fichier</th> {/* Non triable */}
//                 {/* Afficher la colonne Actions uniquement si le rôle permet la suppression ou la mise à jour */}
//                  {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                      <th className="p-2 border">Actions</th> /* Non triable */
//                  )}
//               </tr>
//             </thead>
//             <tbody>
//               {/* Utiliser sortedFactures pour afficher les données triées */}
//               {sortedFactures.length > 0 ? (
//                   sortedFactures.map((facture) => (
//                     <tr key={facture.id} className="border-t">
//                       <td className="p-2 border">{facture.id}</td>
//                        <td className="p-2 border">{facture.numero_facture}</td>
//                        <td className="p-2 border">{formatDate(facture.date_facture)}</td>
//                       <td className="p-2 border">{facture.type_facture || 'N/A'}</td> {/* Gérer les valeurs null */}
//                       <td className="p-2 border">{facture.ubr || 'N/A'}</td> {/* Gérer les valeurs null */}
//                       <td className="p-2 border">{facture.fournisseur || 'N/A'}</td>
//                        <td className="p-2 border">{facture.description || 'N/A'}</td>
//                       <td className="p-2 border">{facture.montant}$</td>
//                       <td className="p-2 border">{facture.devise}</td>
//                       <td className="p-2 border">
//                         {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
//                           <select
//                             value={facture.statut}
//                             onChange={(e) => handleStatusChange(facture.id, e.target.value)}
//                             className="text-sm border rounded px-1 py-0.5"
//                           >
//                             {allowedStatuses.map((status) => (
//                               <option key={status} value={status}>
//                                 {status.charAt(0).toUpperCase() + status.slice(1)}
//                               </option>
//                             ))}
//                           </select>
//                         ) : (
//                           facture.statut
//                         )}
//                       </td>

//                       <td className="p-2 border">{facture.categorie || 'N/A'}</td>
//                       <td className="p-2 border">{facture.ligne_budgetaire || 'N/A'}</td>
//                       <td className="p-2 border">{facture.compte_depense_id ? (
//                           <button
//                             onClick={() => goToCompte(facture.compte_depense_id)}
//                             title="Ouvrir le compte de dépense"
//                             className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
//                           >
//                             {facture.compte_depense_id}
//                           </button>
//                         ) : (
//                           <span className="text-gray-400">—</span>
//                         )}
//                       </td>
//                        <td className="p-2 border">{facture.soumetteur_username || 'N/A'}</td>
//                        <td className="p-2 border">{formatDateTime(facture.date_soumission)}</td>
//                        <td className="p-2 border">{facture.created_by_username || 'N/A'}</td>
//                        <td className="p-2 border">{facture.last_modified_by_username || 'N/A'}</td>
//                        <td className="p-2 border">{facture.last_modified_timestamp ? formatDateTime(facture.last_modified_timestamp) : 'N/A'}</td>
//                       <td className="p-2 border">
//                         {facture.chemin_fichier ? (
//                           // APPEL VIA PROP : Utiliser la fonction handleDownloadClick qui appelle la prop downloadFile
//                           <button
//                             onClick={() => handleDownloadClick(facture.id, new Date(facture.date_facture).getFullYear())} // Passer l'ID et l'année (si besoin)
//                             className="text-green-500 underline hover:text-green-700 text-sm"
//                           >
//                              {/* Afficher le nom du fichier extrait du chemin si possible */}
//                             {facture.chemin_fichier ? facture.chemin_fichier.split('/').pop() : 'Télécharger'}
//                           </button>
//                         ) : (
//                           <span className="text-gray-500">—</span>
//                         )}
//                       </td>
//                        {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                            <td className="p-2 border">
//                              {/* Bouton Supprimer */}
//                              {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                                   <button
//                                     onClick={() => handleDelete(facture.id)} // Appelle la fonction locale qui appelle la prop
//                                     className="text-red-500 mr-2 hover:text-red-700 text-sm"
//                                   >
//                                     Supprimer
//                                   </button>
//                              )}
//                              {/* Bouton Changer Statut
//                               {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                                  <button
//                                    onClick={() => handleUpdateStatus(facture.id, facture.statut)} // Appelle la fonction locale qui appelle la prop
//                                    className="text-blue-500 hover:text-blue-700 text-sm"
//                                  >
//                                    {facture.statut === 'soumis' ? 'Approuver/Rejeter/Payer' : 'Modifier Statut'}
//                                  </button>
//                              )} */}
//                               {/* Ajouter un bouton Modifier pour ouvrir le formulaire d'édition (si vous avez un tel formulaire/modale) */}
//                                {/* Le soumetteur peut modifier SA facture (logique backend et UI à ajouter) */}
//                                {/* Example (hypothétique): */}
//                                {/* {(userRole === 'soumetteur' && facture.id_soumetteur === userId) || userRole === 'gestionnaire' || userRole === 'approbateur' ? (
//                                     <button
//                                       onClick={() => onEditClick(facture)} // Appelle la fonction locale qui gère l'édition
//                                       className="text-orange-500 hover:text-orange-700 text-sm ml-2"
//                                     >
//                                       Modifier
//                                     </button>
//                                 ): null} */}
//                            </td>
//                        )}
//                     </tr>
//                   ))
//               ) : (
//                   <tr>
//                       <td colSpan={userRole === 'gestionnaire' || userRole === 'approbateur' ? 20 : 19} className="p-2 border text-center text-gray-500">
//                           Aucune facture ajoutée pour cette année.
//                       </td>
//                   </tr>
//               )}
//             </tbody>
//           </table>
//        )}


//       {/* Vue en cartes pour les écrans mobiles */}
//       {/* Afficher les cartes uniquement si l'utilisateur peut voir les factures */}
//       {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (
//         <div className="sm:hidden">
//           {/* Utiliser sortedFactures pour afficher les données triées */}
//           {sortedFactures.length > 0 ? (
//             sortedFactures.map((facture) => (
//               <div key={facture.id} className="bg-white p-4 mb-4 rounded-lg shadow border">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-sm font-semibold text-gray-600">Facture #{facture.id}</span>
//                   {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
//                     <select
//                       value={facture.statut}
//                       onChange={(e) => handleStatusChange(facture.id, e.target.value)}
//                       className="text-xs rounded border px-2 py-1 bg-white text-gray-800"
//                     >
//                       {allowedStatuses.map((status) => (
//                         <option key={status} value={status}>
//                           {status.charAt(0).toUpperCase() + status.slice(1)}
//                         </option>
//                       ))}
//                     </select>
//                   ) : (
//                     <span
//                       className={`px-2 py-1 text-xs font-semibold rounded-full ${facture.statut === 'Soumis' ? 'bg-blue-100 text-blue-800'
//                         : facture.statut === 'Approuve' ? 'bg-green-100 text-green-800'
//                           : facture.statut === 'Rejete' ? 'bg-red-100 text-red-800'
//                             : facture.statut === 'Paye' ? 'bg-purple-100 text-purple-800'
//                               : 'bg-gray-100 text-gray-800'
//                         }`}
//                     >
//                       {facture.statut}
//                     </span>
//                   )}

//                 </div>
//                 <div className="mb-2"><span className="font-semibold">Numéro :</span> {facture.numero_facture}</div>
//                 <div className="mb-2"><span className="font-semibold">Date Facture :</span> {formatDate(facture.date_facture)}</div>
//                 <div className="mb-2">
//                   <span className="font-semibold">Type :</span> {facture.type_facture || 'N/A'}
//                 </div>
//                 <div className="mb-2">
//                   <span className="font-semibold">Fournisseur :</span> {facture.fournisseur || 'N/A'}
//                 </div>
//                 <div className="mb-2">
//                   <span className="font-semibold">UBR :</span> {facture.ubr || 'N/A'}
//                 </div>
//                 <div className="mb-2"><span className="font-semibold">Montant :</span> {facture.montant}$ {facture.devise}</div>
//                 {facture.description && (
//                   <div className="mb-2 text-sm text-gray-700">
//                     <span className="font-semibold">Description :</span> {facture.description}
//                   </div>
//                 )}
//                 <div className="mb-2"><span className="font-semibold">Catégorie :</span> {facture.categorie || 'N/A'}</div>
//                 <div className="mb-2"><span className="font-semibold">Ligne Budgétaire :</span> {facture.ligne_budgetaire || 'N/A'}</div>
//                 <div className="mb-2">
//                   <span className="font-semibold">Comptes dépenses :</span>{' '}
//                   {facture.compte_depense_id ? (
//                     <button
//                       onClick={() => goToCompte(facture.compte_depense_id)}
//                       className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700"
//                     >
//                       {facture.compte_depense_id}
//                     </button>
//                   ) : (
//                     '—'
//                   )}
//                 </div>


//                 <div className="mb-2 text-sm text-gray-600"><span className="font-semibold">Soumise par :</span> {facture.soumetteur_username || 'N/A'} le {formatDateTime(facture.date_soumission)}</div>
//                 <div className="mb-2 text-sm text-gray-600"><span className="font-semibold">Créée par :</span> {facture.created_by_username || 'N/A'}</div>
//                 {facture.last_modified_timestamp && (
//                   <div className="mb-2 text-sm text-gray-600"><span className="font-semibold">Dernière modif. par :</span> {facture.last_modified_by_username || 'N/A'} le {formatDateTime(facture.last_modified_timestamp)}</div>
//                 )}
//                 <div className="mb-4">
//                   <span className="font-semibold">Fichier :</span>{' '}
//                   {facture.chemin_fichier ? ( 
//                     // APPEL VIA PROP : Utiliser la fonction handleDownloadClick qui appelle la prop downloadFile
//                     <button
//                       onClick={() => handleDownloadClick(facture.id, facture.annee)} // Passer l'ID et l'année (si besoin)
//                       className="text-green-500 underline hover:text-green-700 text-sm"
//                     >
//                       {facture.chemin_fichier ? facture.chemin_fichier.split('/').pop() : 'Télécharger'}
//                     </button>
//                   ) : (
//                     <span className="text-gray-500 text-sm">—</span>
//                   )}
//                 </div>
//                 {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                   <div className="flex justify-end space-x-2">
//                     {/* Bouton Supprimer mobile */}
//                     {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                       <button
//                         onClick={() => handleDelete(facture.id)} // Appelle la fonction locale qui appelle la prop
//                         className="text-red-500 hover:text-red-700 text-sm"
//                       >
//                         Supprimer
//                       </button>
//                     )}
//                     {/* Bouton Changer Statut mobile
//                     {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                       <button
//                         onClick={() => handleUpdateStatus(facture.id, facture.statut)} // Appelle la fonction locale qui appelle la prop
//                         className="text-blue-500 hover:text-blue-700 text-sm"
//                       >
//                         {facture.statut === 'soumis' ? 'Approuver/Rejeter/Payer' : 'Modifier Statut'}
//                       </button>
//                     )} */}
//                     {/* Ajouter un bouton Modifier pour ouvrir le formulaire d'édition (si vous avez un tel formulaire/modale) */}
//                     {/* Le soumetteur peut modifier SA facture (logique backend et UI à ajouter) */}
//                     {/* Example (hypothétique): */}
//                     {/* {(userRole === 'soumetteur' && facture.id_soumetteur === userId) || userRole === 'gestionnaire' || userRole === 'approbateur' ? (
//                                     <button
//                                       onClick={() => onEditClick(facture)} // Appelle la fonction locale qui gère l'édition
//                                       className="text-orange-500 hover:text-orange-700 text-sm ml-2"
//                                     >
//                                       Modifier
//                                     </button>
//                                 ): null} */}
//                   </div>
//                 )}
//               </div>
//             ))
//           ) : (
//             <p className="text-center text-gray-500">Aucune facture ajoutée pour cette année.</p>
//           )}
//         </div>
//       )}
//     </>
//   );
// }

// export default TableFactures;



// src/components/TableFactures.jsx
// Affiche une liste de factures sous forme de tableau (desktop) ou de cartes (mobile).
// Tri par colonnes, téléchargement de fichiers, suppression, changement de statut.
// Colonnes affichées configurables (persistées dans localStorage).

// import React, { useState, useEffect } from 'react';
// import { format } from 'date-fns';
// import { fr } from 'date-fns/locale';
// import { formatInTimeZone, toDate } from 'date-fns-tz';
// import { useNavigate } from 'react-router-dom';

// // === Registre des colonnes du tableau Factures ===
// // ➜ Ajuste au besoin. Le rendu “spécifique” (dates/Statut/badges) est géré dans renderCell/renderCellMobile.
// const ALL_COLUMNS = [
//   { key: 'id',                       label: 'ID',                     sortable: true,  render: f => f.id },
//   { key: 'numero_facture',           label: '# Facture',              sortable: true,  render: f => f.numero_facture || '—' },
//   { key: 'date_facture',             label: 'Date Facture',           sortable: true,  render: f => f.date_facture },
//   { key: 'type_facture',             label: 'Type',                   sortable: true,  render: f => f.type_facture || 'N/A' },
//   { key: 'ubr',                      label: 'UBR',                    sortable: true,  render: f => f.ubr || 'N/A' },
//   { key: 'fournisseur',              label: 'Fournisseur',            sortable: true,  render: f => f.fournisseur || 'N/A' },
//   { key: 'description',              label: 'Description',            sortable: true,  render: f => f.description || 'N/A' },
//   { key: 'montant',                  label: 'Montant',                sortable: true,  render: f => f.montant },
//   { key: 'devise',                   label: 'Devise',                 sortable: true,  render: f => f.devise || 'N/A' },
//   { key: 'statut',                   label: 'Statut',                 sortable: true,  render: f => f.statut || 'N/A' },
//   { key: 'categorie',                label: 'Catégorie',              sortable: true,  render: f => f.categorie || 'N/A' },
//   { key: 'ligne_budgetaire',         label: 'Ligne Budgétaire',       sortable: true,  render: f => f.ligne_budgetaire || 'N/A' },
//   { key: 'compte_depense_id',        label: 'Compte dépense',         sortable: true,  render: f => f.compte_depense_id ? f.compte_depense_id : '—' },
//   { key: 'soumetteur_username',      label: 'Soumetteur',             sortable: true,  render: f => f.soumetteur_username || 'N/A' },
//   { key: 'date_soumission',          label: 'Date Soumission',        sortable: true,  render: f => f.date_soumission || 'N/A' },
//   { key: 'created_by_username',      label: 'Créé par',               sortable: true,  render: f => f.created_by_username || 'N/A' },
//   { key: 'last_modified_by_username',label: 'Modifié par',            sortable: true,  render: f => f.last_modified_by_username || 'N/A' },
//   { key: 'last_modified_timestamp',  label: 'Dernière modification',  sortable: true,  render: f => f.last_modified_timestamp || null },
// ];

// // -----------------------------------
// // Composant TableFactures
// // -----------------------------------

// function TableFactures({ factures, onDelete, onUpdate, onEdit, downloadFile, userRole, currentUserId }) {
//   // -----------------------------------
//   // États
//   // -----------------------------------
//   const [sortColumn, setSortColumn] = useState('date_soumission');
//   const [sortDirection, setSortDirection] = useState('desc');
//   const [editingFacture, setEditingFacture] = useState(null);

//   const navigate = useNavigate();
//   const goToCompte = (cid) => {
//     if (!cid) return;
//     navigate(`/dashboard/depense-comptes?id=${encodeURIComponent(cid)}`);
//   };

//   const MONTREAL_TIMEZONE = 'America/Montreal';

//   // Colonnes visibles par défaut
//   const DEFAULT_VISIBLE = [
//     'numero_facture','date_facture','fournisseur','montant','statut',
//     'categorie','ligne_budgetaire','compte_depense_id','soumetteur_username'
//   ];

//   // VisibleColumns ← Set pour lookup rapide
//   const [visibleCols, setVisibleCols] = useState(() => {
//     try {
//       const saved = JSON.parse(localStorage.getItem('factures.visibleCols'));
//       return new Set(Array.isArray(saved) ? saved : DEFAULT_VISIBLE);
//     } catch {
//       return new Set(DEFAULT_VISIBLE);
//     }
//   });

//   // Sauvegarde des colonnes visibles
//   useEffect(() => {
//     localStorage.setItem('factures.visibleCols', JSON.stringify([...visibleCols]));
//   }, [visibleCols]);

//   // Sélecteur de colonnes
//   const [showColumnPicker, setShowColumnPicker] = useState(false);
//   const toggleColumn = (key) => {
//     setVisibleCols(prev => {
//       const next = new Set(prev);
//       if (next.has(key)) next.delete(key); else next.add(key);
//       return next;
//     });
//   };

//   // -----------------------------------
//   // Utils formatage
//   // -----------------------------------
//   const formatDateTime = (dateString) => {
//     if (!dateString) return 'N/A';
//     try {
//       const date = new Date(dateString);
//       if (isNaN(date.getTime())) return 'Date invalide';
//       return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: fr });
//     } catch (error) {
//       console.error("Erreur formatDateTime :", dateString, error);
//       return 'Erreur formatage';
//     }
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return 'N/A';
//     try {
//       const rawDate = new Date(dateString);
//       if (isNaN(rawDate.getTime())) return 'Date invalide';
//       const date = toDate(rawDate);
//       return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy', { locale: fr });
//     } catch (error) {
//       console.error("Erreur formatDate :", dateString, error);
//       return 'Erreur formatage';
//     }
//   };

//   // -----------------------------------
//   // Tri
//   // -----------------------------------
//   const handleHeaderClick = (column) => {
//     if (column === sortColumn) {
//       setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
//     } else {
//       setSortColumn(column);
//       setSortDirection('asc');
//     }
//   };

//   const compareValues = (a, b, column, direction) => {
//     const valueA = a[column];
//     const valueB = b[column];

//     if (valueA == null && valueB == null) return 0;
//     if (valueA == null) return direction === 'asc' ? -1 : 1;
//     if (valueB == null) return direction === 'asc' ? 1 : -1;

//     let comparison = 0;

//     if (column.includes('date') || column.includes('timestamp')) {
//       try {
//         const dateA = new Date(valueA);
//         const dateB = new Date(valueB);
//         comparison = dateA.getTime() - dateB.getTime();
//         if (isNaN(comparison)) {
//           comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//         }
//       } catch (e) {
//         comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//       }
//     } else if (typeof valueA === 'number' && typeof valueB === 'number') {
//       comparison = valueA - valueB;
//     } else if (typeof valueA === 'string' && typeof valueB === 'string') {
//       comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
//     } else {
//       comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
//     }
//     return direction === 'asc' ? comparison : -comparison;
//   };

//   const sortedFactures = [...factures].sort((a, b) =>
//     compareValues(a, b, sortColumn, sortDirection)
//   );

//   // -----------------------------------
//   // Actions (via props)
//   // -----------------------------------
//   const allowedStatuses = ['Soumis', 'Approuve', 'Rejete', 'Paye'];

//   const handleStatusChange = (factureId, newStatut) => {
//     if (!allowedStatuses.includes(newStatut)) {
//       alert("Statut invalide.");
//       return;
//     }
//     onUpdate(factureId, { statut: newStatut });
//   };

//   const handleDownloadClick = (factureId, anneeFacture) => {
//     downloadFile(factureId, anneeFacture);
//   };

//   const handleDelete = (id) => {
//     if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
//       alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
//       return;
//     }
//     if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette facture ? Cette action est irréversible.')) {
//       onDelete(id);
//     }
//   };

//   // -----------------------------------
//   // Rendu / Helpers
//   // -----------------------------------
//   const renderSortArrow = (column) => {
//     if (sortColumn === column) {
//       return sortDirection === 'asc' ? ' ↑' : ' ↓';
//     }
//     return null;
//   };

//   const sortableColumns = new Set(ALL_COLUMNS.filter(c => c.sortable).map(c => c.key));

//   const renderTableHeader = (columnKey, headerText) => (
//     <th
//       key={columnKey}
//       className={`p-2 border ${sortableColumns.has(columnKey) ? 'cursor-pointer hover:bg-gray-200' : ''}`}
//       onClick={sortableColumns.has(columnKey) ? () => handleHeaderClick(columnKey) : undefined}
//     >
//       {headerText} {renderSortArrow(columnKey)}
//     </th>
//   );

//   // Rendu Desktop cellule
//   const renderCell = (facture, key) => {
//     switch (key) {
//       case 'id': return facture.id;
//       case 'numero_facture': return facture.numero_facture || '—';
//       case 'date_facture': return formatDate(facture.date_facture);
//       case 'type_facture': return facture.type_facture || 'N/A';
//       case 'ubr': return facture.ubr || 'N/A';
//       case 'fournisseur': return facture.fournisseur || 'N/A';
//       case 'description': return facture.description || 'N/A';
//       case 'montant': return `${facture.montant}$`;
//       case 'devise': return facture.devise || 'N/A';

//       case 'statut':
//         return (userRole === 'gestionnaire' || userRole === 'approbateur') ? (
//           <select
//             value={facture.statut}
//             onChange={(e) => handleStatusChange(facture.id, e.target.value)}
//             className="text-sm border rounded px-1 py-0.5"
//           >
//             {allowedStatuses.map((status) => (
//               <option key={status} value={status}>{status}</option>
//             ))}
//           </select>
//         ) : (facture.statut || 'N/A');

//       case 'categorie': return facture.categorie || 'N/A';
//       case 'ligne_budgetaire': return facture.ligne_budgetaire || 'N/A';

//       case 'compte_depense_id':
//         return facture.compte_depense_id ? (
//           <button
//             onClick={() => goToCompte(facture.compte_depense_id)}
//             title="Ouvrir le compte de dépense"
//             className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
//           >
//             {facture.compte_depense_id}
//           </button>
//         ) : <span className="text-gray-400">—</span>;

//       case 'soumetteur_username': return facture.soumetteur_username || 'N/A';
//       case 'date_soumission': return formatDateTime(facture.date_soumission);
//       case 'created_by_username': return facture.created_by_username || 'N/A';
//       case 'last_modified_by_username': return facture.last_modified_by_username || 'N/A';
//       case 'last_modified_timestamp':
//         return facture.last_modified_timestamp ? formatDateTime(facture.last_modified_timestamp) : 'N/A';

//       default:
//         return facture[key] ?? 'N/A';
//     }
//   };

//   // Rendu Mobile cellule (texte + formatages)
//   const renderCellMobile = (facture, key) => {
//     switch (key) {
//       case 'date_facture': return formatDate(facture.date_facture);
//       case 'montant': return `${facture.montant}$ ${facture.devise || ''}`;
//       case 'date_soumission': return formatDateTime(facture.date_soumission);
//       case 'last_modified_timestamp': return facture.last_modified_timestamp ? formatDateTime(facture.last_modified_timestamp) : 'N/A';
//       case 'compte_depense_id':
//         return facture.compte_depense_id ? (
//           <button
//             onClick={() => goToCompte(facture.compte_depense_id)}
//             className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700"
//           >
//             {facture.compte_depense_id}
//           </button>
//         ) : '—';
//       default:
//         // Repli : mêmes valeurs que desktop
//         return renderCell(facture, key);
//     }
//   };

//   return (
//     <>
//       {/* Sélecteur de colonnes */}
//       <div className="flex justify-end mb-2">
//         <button className="border px-3 py-2" onClick={() => setShowColumnPicker(v => !v)}>
//           Colonnes
//         </button>
//       </div>

//       {showColumnPicker && (
//         <div className="mb-3 p-3 border rounded bg-white shadow max-w-2xl">
//           <div className="flex items-center justify-between mb-2">
//             <b>Colonnes visibles</b>
//             <div className="flex gap-3">
//               <button type="button" className="text-sm underline"
//                 onClick={() => setVisibleCols(new Set(ALL_COLUMNS.map(c => c.key)))}>
//                 Tout
//               </button>
//               <button type="button" className="text-sm underline"
//                 onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))}>
//                 Défaut
//               </button>
//               <button type="button" className="text-sm underline"
//                 onClick={() => setVisibleCols(new Set())}>
//                 Aucun
//               </button>
//             </div>
//           </div>
//           <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
//             {ALL_COLUMNS.map(col => (
//               <label key={col.key} className="flex items-center gap-2">
//                 <input
//                   type="checkbox"
//                   checked={visibleCols.has(col.key)}
//                   onChange={() => toggleColumn(col.key)}
//                 />
//                 <span>{col.label}</span>
//               </label>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Tableau desktop */}
//       {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (
//         <table className="w-full text-left border-collapse hidden sm:table">
//           <thead>
//             <tr className="bg-gray-100">
//               {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map(c =>
//                 renderTableHeader(c.key, c.label)
//               )}
//               <th className="p-2 border">Fichier</th>
//               {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                 <th className="p-2 border">Actions</th>
//               )}
//             </tr>
//           </thead>
//           <tbody>
//             {sortedFactures.length > 0 ? (
//               sortedFactures.map((facture) => (
//                 <tr key={facture.id} className="border-t">
//                   {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map(c => (
//                     <td key={c.key} className="p-2 border">
//                       {renderCell(facture, c.key)}
//                     </td>
//                   ))}

//                   {/* Fichier (fixe) */}
//                   <td className="p-2 border">
//                     {facture.chemin_fichier ? (
//                       <button
//                         onClick={() => handleDownloadClick(facture.id, new Date(facture.date_facture).getFullYear())}
//                         className="text-green-500 underline hover:text-green-700 text-sm"
//                       >
//                         {facture.chemin_fichier ? facture.chemin_fichier.split('/').pop() : 'Télécharger'}
//                       </button>
//                     ) : (
//                       <span className="text-gray-500">—</span>
//                     )}
//                   </td>

//                   {/* Actions (fixe) */}
//                   {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                   <td className="p-2 border whitespace-nowrap">
//                     {/* AJOUT : Bouton Modifier */}
//                     <button
//                       onClick={() => onEdit(facture)}
//                       className="text-blue-600 hover:underline text-sm mr-3"
//                       title="Modifier cette facture"
//                     >
//                       Modifier
//                     </button>
//                     <button
//                       onClick={() => onDelete(facture.id)}
//                       className="text-red-600 hover:underline text-sm"
//                       title="Supprimer cette facture"
//                     >
//                       Supprimer
//                     </button>
//                   </td>
//                 )}
//                 </tr>
//               ))
//             ) : (
//               <tr>
//                 <td
//                   className="p-2 border text-center text-gray-500"
//                   colSpan={
//                     ALL_COLUMNS.filter(c => visibleCols.has(c.key)).length
//                     + 1 /* Fichier */
//                     + ((userRole === 'gestionnaire' || userRole === 'approbateur') ? 1 : 0) /* Actions */
//                   }
//                 >
//                   Aucune facture ajoutée pour cette année.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       )}

//       {/* Vue mobile */}
//       {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (
//         <div className="sm:hidden">
//           {sortedFactures.length > 0 ? (
//             sortedFactures.map((facture) => (
//               <div key={facture.id} className="bg-white p-4 mb-4 rounded-lg shadow border">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-sm font-semibold text-gray-600">Facture #{facture.id}</span>

//                   {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
//                     <select
//                       value={facture.statut}
//                       onChange={(e) => handleStatusChange(facture.id, e.target.value)}
//                       className="text-xs rounded border px-2 py-1 bg-white text-gray-800"
//                     >
//                       {allowedStatuses.map((status) => (
//                         <option key={status} value={status}>
//                           {status}
//                         </option>
//                       ))}
//                     </select>
//                   ) : (
//                     <span
//                       className={`px-2 py-1 text-xs font-semibold rounded-full ${
//                         facture.statut === 'Soumis'   ? 'bg-blue-100 text-blue-800'   :
//                         facture.statut === 'Approuve' ? 'bg-green-100 text-green-800' :
//                         facture.statut === 'Rejete'   ? 'bg-red-100 text-red-800'     :
//                         facture.statut === 'Paye'     ? 'bg-purple-100 text-purple-800':
//                                                          'bg-gray-100 text-gray-800'
//                       }`}
//                     >
//                       {facture.statut}
//                     </span>
//                   )}
//                 </div>

//                 {/* Champs dynamiques selon visibleCols (on évite de dupliquer "statut" ici) */}
//                 {ALL_COLUMNS.filter(c => visibleCols.has(c.key) && c.key !== 'statut').map(c => (
//                   <div key={c.key} className="mb-2">
//                     <span className="font-semibold">{c.label} :</span>{' '}
//                     {renderCellMobile(facture, c.key)}
//                   </div>
//                 ))}

//                 {/* Fichier (fixe) */}
//                 <div className="mb-4">
//                   <span className="font-semibold">Fichier :</span>{' '}
//                   {facture.chemin_fichier ? (
//                     <button
//                       onClick={() => handleDownloadClick(facture.id, facture.annee)}
//                       className="text-green-500 underline hover:text-green-700 text-sm"
//                     >
//                       {facture.chemin_fichier ? facture.chemin_fichier.split('/').pop() : 'Télécharger'}
//                     </button>
//                   ) : (
//                     <span className="text-gray-500 text-sm">—</span>
//                   )}
//                 </div>

//                 {/* MODIFIÉ : Section Actions (mobile) */}
//                 {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
//                   <div className="flex justify-end space-x-4 border-t pt-3 mt-3">
//                     {/* AJOUT : Bouton Modifier (mobile) */}
//                     <button
//                       onClick={() => onEdit(facture)}
//                       className="text-blue-600 font-semibold hover:underline text-sm"
//                     >
//                       Modifier
//                     </button>
//                     <button
//                       onClick={() => onDelete(facture.id)}
//                       className="text-red-600 font-semibold hover:underline text-sm"
//                     >
//                       Supprimer
//                     </button>
//                   </div>
//                 )}
//               </div>
//             ))
//           ) : (
//             <p className="text-center text-gray-500">Aucune facture ajoutée pour cette année.</p>
//           )}
//         </div>
//       )}
//     </>
//   );
// }

// export default TableFactures;
// src/components/TableFactures.jsx
// Tableau/carte des factures : tri, colonnes configurables, actions (Modifier/Supprimer), téléchargement fichier.

import React, { useState, useEffect } from 'react';
import { fr } from 'date-fns/locale';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { useNavigate } from 'react-router-dom';

// === Registre des colonnes affichables ===
const ALL_COLUMNS = [
  { key: 'id',                       label: 'ID',                     sortable: true,  render: f => f.id },
  { key: 'numero_facture',           label: '# Facture',              sortable: true,  render: f => f.numero_facture || '—' },
  { key: 'date_facture',             label: 'Date Facture',           sortable: true,  render: f => f.date_facture },
  { key: 'type_facture',             label: 'Type',                   sortable: true,  render: f => f.type_facture || 'N/A' },
  { key: 'ubr',                      label: 'UBR',                    sortable: true,  render: f => f.ubr || 'N/A' },
  { key: 'fournisseur',              label: 'Fournisseur',            sortable: true,  render: f => f.fournisseur || 'N/A' },
  { key: 'description',              label: 'Description',            sortable: true,  render: f => f.description || 'N/A' },
  { key: 'montant',                  label: 'Montant',                sortable: true,  render: f => f.montant },
  { key: 'devise',                   label: 'Devise',                 sortable: true,  render: f => f.devise || 'N/A' },
  { key: 'statut',                   label: 'Statut',                 sortable: true,  render: f => f.statut || 'N/A' },
  { key: 'categorie',                label: 'Catégorie',              sortable: true,  render: f => f.categorie || 'N/A' },
  { key: 'ligne_budgetaire',         label: 'Ligne Budgétaire',       sortable: true,  render: f => f.ligne_budgetaire || 'N/A' },
  { key: 'compte_depense_id',        label: 'Compte dépense',         sortable: true,  render: f => f.compte_depense_id ? f.compte_depense_id : '—' },
  { key: 'soumetteur_username',      label: 'Soumetteur',             sortable: true,  render: f => f.soumetteur_username || 'N/A' },
  { key: 'date_soumission',          label: 'Date Soumission',        sortable: true,  render: f => f.date_soumission || 'N/A' },
  { key: 'created_by_username',      label: 'Créé par',               sortable: true,  render: f => f.created_by_username || 'N/A' },
  { key: 'last_modified_by_username',label: 'Modifié par',            sortable: true,  render: f => f.last_modified_by_username || 'N/A' },
  { key: 'last_modified_timestamp',  label: 'Dernière modification',  sortable: true,  render: f => f.last_modified_timestamp || null },
];

function TableFactures({
  factures,
  onDelete,
  onUpdate,
  downloadFile,
  userRole,
  currentUserId,
  onEdit, // <- callback d’édition
}) {
  // Tri
  const [sortColumn, setSortColumn] = useState('date_soumission');
  const [sortDirection, setSortDirection] = useState('desc');

  const navigate = useNavigate();
  const goToCompte = (cid) => {
    if (!cid) return;
    navigate(`/dashboard/depense-comptes?id=${encodeURIComponent(cid)}`);
  };

  // Colonnes visibles (persistées)
  const DEFAULT_VISIBLE = [
    'numero_facture','date_facture','fournisseur','montant','statut',
    'categorie','ligne_budgetaire','compte_depense_id','soumetteur_username'
  ];
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('factures.visibleCols'));
      return new Set(Array.isArray(saved) ? saved : DEFAULT_VISIBLE);
    } catch {
      return new Set(DEFAULT_VISIBLE);
    }
  });
  useEffect(() => {
    localStorage.setItem('factures.visibleCols', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const toggleColumn = (key) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Utils
  const MONTREAL_TIMEZONE = 'America/Montreal';
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return 'Erreur formatage';
    }
  };
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const rawDate = new Date(dateString);
      if (isNaN(rawDate.getTime())) return 'Date invalide';
      const date = toDate(rawDate);
      return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy', { locale: fr });
    } catch {
      return 'Erreur formatage';
    }
  };

  // Tri
  const handleHeaderClick = (column) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  const compareValues = (a, b, column, direction) => {
    const valueA = a[column];
    const valueB = b[column];
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return direction === 'asc' ? -1 : 1;
    if (valueB == null) return direction === 'asc' ? 1 : -1;

    let cmp = 0;
    if (column.includes('date') || column.includes('timestamp')) {
      try {
        const da = new Date(valueA).getTime();
        const db = new Date(valueB).getTime();
        cmp = da - db;
        if (isNaN(cmp)) cmp = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
      } catch {
        cmp = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
      }
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      cmp = valueA - valueB;
    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
      cmp = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
    } else {
      cmp = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
    }
    return direction === 'asc' ? cmp : -cmp;
  };
  const sortedFactures = [...factures].sort((a, b) => compareValues(a, b, sortColumn, sortDirection));

  // Actions
  const allowedStatuses = ['Soumis', 'Approuve', 'Rejete', 'Paye'];
  const handleStatusChange = (factureId, newStatut) => {
    if (!allowedStatuses.includes(newStatut)) {
      alert("Statut invalide.");
      return;
    }
    onUpdate(factureId, { statut: newStatut });
  };
  const handleDownloadClick = (factureId, anneeFacture) => {
    downloadFile(factureId, anneeFacture);
  };
  const handleDelete = (id) => {
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      alert("Vous n'avez pas le rôle nécessaire pour supprimer une facture.");
      return;
    }
    if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette facture ? Cette action est irréversible.')) {
      onDelete(id);
    }
  };
  const canEditFacture = (facture) => {
    if (userRole === 'gestionnaire' || userRole === 'approbateur') return true;
    if (userRole === 'soumetteur' && facture?.id_soumetteur === currentUserId) return true;
    return false;
  };

  // Rendu
  const renderSortArrow = (column) => (sortColumn === column ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : null);
  const sortableColumns = new Set(ALL_COLUMNS.filter(c => c.sortable).map(c => c.key));

  const renderTableHeader = (columnKey, headerText) => (
    <th
      key={columnKey}
      className={`p-2 border ${sortableColumns.has(columnKey) ? 'cursor-pointer hover:bg-gray-200' : ''}`}
      onClick={sortableColumns.has(columnKey) ? () => handleHeaderClick(columnKey) : undefined}
    >
      {headerText} {renderSortArrow(columnKey)}
    </th>
  );

  const renderCell = (facture, key) => {
    switch (key) {
      case 'id': return facture.id;
      case 'numero_facture': return facture.numero_facture || '—';
      case 'date_facture': return formatDate(facture.date_facture);
      case 'type_facture': return facture.type_facture || 'N/A';
      case 'ubr': return facture.ubr || 'N/A';
      case 'fournisseur': return <span className="break-words">{facture.fournisseur || 'N/A'}</span>;
      case 'description': return <span className="break-words">{facture.description || 'N/A'}</span>;
      case 'montant': return `${facture.montant}$`;
      case 'devise': return facture.devise || 'N/A';

      case 'statut':
        return (userRole === 'gestionnaire' || userRole === 'approbateur') ? (
          <select
            value={facture.statut}
            onChange={(e) => handleStatusChange(facture.id, e.target.value)}
            className="text-sm border rounded px-1 py-0.5"
          >
            {allowedStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        ) : (facture.statut || 'N/A');

      case 'categorie': return facture.categorie || 'N/A';
      case 'ligne_budgetaire': return facture.ligne_budgetaire || 'N/A';

      case 'compte_depense_id':
        return facture.compte_depense_id ? (
          <button
            onClick={() => goToCompte(facture.compte_depense_id)}
            title="Ouvrir le compte de dépense"
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            {facture.compte_depense_id}
          </button>
        ) : <span className="text-gray-400">—</span>;

      case 'soumetteur_username': return facture.soumetteur_username || 'N/A';
      case 'date_soumission': return formatDateTime(facture.date_soumission);
      case 'created_by_username': return facture.created_by_username || 'N/A';
      case 'last_modified_by_username': return facture.last_modified_by_username || 'N/A';
      case 'last_modified_timestamp': return facture.last_modified_timestamp ? formatDateTime(facture.last_modified_timestamp) : 'N/A';
      default: return facture[key] ?? 'N/A';
    }
  };

  const renderCellMobile = (facture, key) => {
    switch (key) {
      case 'date_facture': return formatDate(facture.date_facture);
      case 'montant': return `${facture.montant}$ ${facture.devise || ''}`;
      case 'date_soumission': return formatDateTime(facture.date_soumission);
      case 'last_modified_timestamp': return facture.last_modified_timestamp ? formatDateTime(facture.last_modified_timestamp) : 'N/A';
      case 'compte_depense_id':
        return facture.compte_depense_id ? (
          <button
            onClick={() => goToCompte(facture.compte_depense_id)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700"
          >
            {facture.compte_depense_id}
          </button>
        ) : '—';
      default:
        return renderCell(facture, key);
    }
  };

  return (
    <>
      {/* Sélecteur de colonnes */}
      <div className="flex justify-end mb-2">
        <button className="border px-3 py-2" onClick={() => setShowColumnPicker(v => !v)}>
          Colonnes
        </button>
      </div>

      {showColumnPicker && (
        <div className="mb-3 p-3 border rounded bg-white shadow max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <b>Colonnes visibles</b>
            <div className="flex gap-3">
              <button type="button" className="text-sm underline"
                onClick={() => setVisibleCols(new Set(ALL_COLUMNS.map(c => c.key)))}>
                Tout
              </button>
              <button type="button" className="text-sm underline"
                onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))}>
                Défaut
              </button>
              <button type="button" className="text-sm underline"
                onClick={() => setVisibleCols(new Set())}>
                Aucun
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibleCols.has(col.key)}
                  onChange={() => toggleColumn(col.key)}
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tableau desktop */}
      {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (
        <table className="w-full text-left border-collapse hidden sm:table">
          <thead>
            <tr className="bg-gray-100">
              {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map(c =>
                renderTableHeader(c.key, c.label)
              )}
              <th className="p-2 border">Fichier</th>
              {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                <th className="p-2 border">Actions</th>
              )}
              {(userRole === 'soumetteur') && (
                <th className="p-2 border">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedFactures.length > 0 ? (
              sortedFactures.map((facture) => (
                <tr key={facture.id} className="border-t">
                  {ALL_COLUMNS.filter(c => visibleCols.has(c.key)).map(c => (
                    <td key={c.key} className="p-2 border">
                      {renderCell(facture, c.key)}
                    </td>
                  ))}

                  {/* Fichier (fixe) */}
                  <td className="p-2 border">
                    {facture.chemin_fichier ? (
                      <button
                        onClick={() => handleDownloadClick(facture.id, new Date(facture.date_facture).getFullYear())}
                        className="text-green-500 underline hover:text-green-700 text-sm inline-block max-w-[40ch] truncate align-top"
                        title={facture.chemin_fichier.split('/').pop()}
                      >
                        {facture.chemin_fichier.split('/').pop()}
                      </button>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>

                  {/* Actions (fixe) */}
                  <td className="p-2 border whitespace-nowrap">
                    {canEditFacture(facture) && (
                      <button
                        onClick={() => onEdit?.(facture)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                      >
                        Modifier
                      </button>
                    )}
                    {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                      <button
                        onClick={() => handleDelete(facture.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-2 border text-center text-gray-500"
                  colSpan={
                    ALL_COLUMNS.filter(c => visibleCols.has(c.key)).length
                    + 1 /* Fichier */
                    + 1 /* Actions */
                  }
                >
                  Aucune facture ajoutée pour cette année.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Vue mobile (cartes) */}
      {userRole && ['soumetteur', 'gestionnaire', 'approbateur'].includes(userRole) && (
        <div className="sm:hidden">
          {sortedFactures.length > 0 ? (
            sortedFactures.map((facture) => (
              <div key={facture.id} className="bg-white p-4 mb-4 rounded-lg shadow border overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-600">Facture #{facture.id}</span>
                  {(userRole === 'gestionnaire' || userRole === 'approbateur') ? (
                    <select
                      value={facture.statut}
                      onChange={(e) => handleStatusChange(facture.id, e.target.value)}
                      className="text-xs rounded border px-2 py-1 bg-white text-gray-800"
                    >
                      {allowedStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        facture.statut === 'Soumis'   ? 'bg-blue-100 text-blue-800'   :
                        facture.statut === 'Approuve' ? 'bg-green-100 text-green-800' :
                        facture.statut === 'Rejete'   ? 'bg-red-100 text-red-800'     :
                        facture.statut === 'Paye'     ? 'bg-purple-100 text-purple-800':
                                                         'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {facture.statut}
                    </span>
                  )}
                </div>

                {/* Champs dynamiques selon visibleCols (on évite de dupliquer "statut" ici) */}
                {ALL_COLUMNS
                  .filter(c => visibleCols.has(c.key) && c.key !== 'statut')
                  .map(c => (
                    <div key={c.key} className="mb-2">
                      <span className="font-semibold">{c.label} :</span>{' '}
                      {renderCellMobile(facture, c.key)}
                    </div>
                  ))}

                {/* Fichier */}
                <div className="mb-3">
                  <span className="font-semibold">Fichier :</span>{' '}
                  {facture.chemin_fichier ? (
                    <button
                      onClick={() => handleDownloadClick(facture.id, facture.annee)}
                      className="text-green-500 underline hover:text-green-700 text-sm inline-block max-w-[70vw] truncate align-top"
                      title={facture.chemin_fichier.split('/').pop()}
                    >
                      {facture.chemin_fichier.split('/').pop()}
                    </button>
                  ) : (
                    <span className="text-gray-500 text-sm">—</span>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  {canEditFacture(facture) && (
                    <button
                      onClick={() => onEdit?.(facture)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Modifier
                    </button>
                  )}
                  {(userRole === 'gestionnaire' || userRole === 'approbateur') && (
                    <button
                      onClick={() => handleDelete(facture.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500">Aucune facture ajoutée pour cette année.</p>
          )}
        </div>
      )}
    </>
  );
}

export default TableFactures;