////////////////////////////////////



// src/components/TableFactures.jsx
// Affiche une liste de factures sous forme de tableau (pour les écrans larges) ou de cartes (pour les écrans mobiles).
// Permet de trier les factures par colonne.
// Permet de télécharger les fichiers associés, de supprimer des factures et de modifier leur statut via des fonctions passées en props.
// Applique des restrictions d'affichage des actions basées sur le rôle de l'utilisateur connecté.

// import React, { useState } from 'react'; // Importez useState
// import { format } from 'date-fns'; // Importez la fonction format de date-fns
// import { fr } from 'date-fns/locale'; // Importez la locale française
// import { formatInTimeZone, toDate} from 'date-fns-tz';

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





//   // -----------------------------------
//   // Fonctions Utilitaires
//   // -----------------------------------
//   const MONTREAL_TIMEZONE = 'America/Montreal';
  

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
  
//       // console.log(`📅 formatDate : ${dateString} → ${formatted}`);
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
//        'id', 'numero_facture', 'date_facture', 'type', 'ubr', 'fournisseur',
//        'description', 'montant', 'devise', 'statut', 'categorie', 'ligne_budgetaire',
//        'soumetteur_username', 'date_soumission', 'created_by_username',
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
//                       <td className="p-2 border">{facture.type || 'N/A'}</td> {/* Gérer les valeurs null */}
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
//                       <td colSpan={userRole === 'gestionnaire' || userRole === 'approbateur' ? 18 : 17} className="p-2 border text-center text-gray-500">
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
//                   <span className="font-semibold">Type :</span> {facture.type || 'N/A'}
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








import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatInTimeZone, toDate } from 'date-fns-tz';

const MONTREAL_TIMEZONE = 'America/Montreal';
const allowedStatuses = ['Soumis', 'Approuve', 'Rejete', 'Paye'];

function TableFactures({ factures, onDelete, onUpdate, downloadFile, userRole, currentUserId }) {
  const [sortColumn, setSortColumn] = useState('date_soumission');
  const [sortDirection, setSortDirection] = useState('desc');

  // Inline editing state
  const [editingFacture, setEditingFacture] = useState(null);
  const [editedData, setEditedData] = useState({});

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return formatInTimeZone(date, MONTREAL_TIMEZONE, 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch (error) {
      console.error('Erreur formatage dateTime', error);
      return 'Erreur';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const raw = new Date(dateString);
      if (isNaN(raw.getTime())) return 'Date invalide';
      return formatInTimeZone(toDate(raw), MONTREAL_TIMEZONE, 'dd/MM/yyyy', { locale: fr });
    } catch (e) {
      console.error('Erreur formatage date', e);
      return 'Erreur';
    }
  };

  const handleHeaderClick = (col) => {
    if (col === sortColumn) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const compareValues = (a, b, column, direction) => {
    const vA = a[column], vB = b[column];
    if (vA == null && vB == null) return 0;
    if (vA == null) return direction === 'asc' ? -1 : 1;
    if (vB == null) return direction === 'asc' ? 1 : -1;
    let cmp = 0;
    if (/date|timestamp/.test(column)) {
      const tA = new Date(vA).getTime(), tB = new Date(vB).getTime();
      cmp = isNaN(tA) || isNaN(tB) ? String(vA).localeCompare(String(vB)) : tA - tB;
    } else if (typeof vA === 'number' && typeof vB === 'number') {
      cmp = vA - vB;
    } else {
      cmp = String(vA).toLowerCase().localeCompare(String(vB).toLowerCase());
    }
    return direction === 'asc' ? cmp : -cmp;
  };

  const sortedFactures = [...factures].sort((a, b) => compareValues(a, b, sortColumn, sortDirection));

  // Inline edit handlers
  const handleEditClick = (facture) => {
    setEditingFacture(facture.id);
    setEditedData({
      numero_facture: facture.numero_facture,
      date_facture:   facture.date_facture,
      fournisseur:    facture.fournisseur,
      description:    facture.description,
      montant:        facture.montant,
      devise:         facture.devise,
      categorie:      facture.categorie,
      ligne_budgetaire: facture.ligne_budgetaire,
      statut:         facture.statut
    });
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setEditedData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (id) => {
    const success = await onUpdate(id, editedData);
    if (success) {
      setEditingFacture(null);
      setEditedData({});
    }
  };

  const handleCancel = () => {
    setEditingFacture(null);
    setEditedData({});
  };

  const handleDelete = (id) => {
    if (userRole !== 'gestionnaire' && userRole !== 'approbateur') {
      alert("Rôle insuffisant pour supprimer.");
      return;
    }
    if (window.confirm('Supprimer cette facture ?')) onDelete(id);
  };

  const handleStatusChange = (id, statut) => {
    if (!allowedStatuses.includes(statut)) return;
    onUpdate(id, { statut });
  };

  const handleDownloadClick = (id, year) => downloadFile(id, year);

  const renderSortArrow = (col) => sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : null;

  const sortableColumns = [
    'id','numero_facture','date_facture','type','ubr','fournisseur',
    'description','montant','devise','statut','categorie','ligne_budgetaire',
    'soumetteur_username','date_soumission','created_by_username',
    'last_modified_by_username','last_modified_timestamp'
  ];

  const renderTableHeader = (key, label) => (
    <th
      key={key}
      className={`p-2 border ${sortableColumns.includes(key)?'cursor-pointer hover:bg-gray-200':''}`}
      onClick={sortableColumns.includes(key)?() => handleHeaderClick(key):undefined}
    >
      {label}{renderSortArrow(key)}
    </th>
  );

  return (
    <>    
      <table className="w-full text-left border-collapse hidden sm:table">
        <thead><tr className="bg-gray-100">
          {renderTableHeader('id','#')}
          {renderTableHeader('numero_facture','Numéro')}
          {renderTableHeader('date_facture','Date Facture')}
          {renderTableHeader('montant','Montant')}
          {renderTableHeader('devise','Devise')}
          {renderTableHeader('statut','Statut')}
          {renderTableHeader('categorie','Catégorie')}
          {renderTableHeader('ligne_budgetaire','Ligne Budgétaire')}
          {renderTableHeader('soumetteur_username','Soumetteur')}
          {renderTableHeader('date_soumission','Date Soumission')}
          <th className="p-2 border">Fichier</th>
          <th className="p-2 border">Actions</th>
        </tr></thead>
        <tbody>
          {sortedFactures.length>0 ? sortedFactures.map(f => (
            <tr key={f.id} className="border-t">
              <td className="p-2 border">{f.id}</td>
              {editingFacture===f.id ? (
                <>                  
                  <td className="p-2 border"><input name="numero_facture" value={editedData.numero_facture} onChange={handleFieldChange} className="w-full"/></td>
                  <td className="p-2 border"><input name="date_facture" type="date" value={editedData.date_facture} onChange={handleFieldChange} className="w-full"/></td>
                  <td className="p-2 border"><input name="montant" type="number" step="0.01" value={editedData.montant} onChange={handleFieldChange} className="w-full"/></td>
                  <td className="p-2 border"><select name="devise" value={editedData.devise} onChange={handleFieldChange} className="w-full"><option value="CAD">CAD</option><option value="USD">USD</option></select></td>
                  <td className="p-2 border"><select name="statut" value={editedData.statut} onChange={handleFieldChange} className="w-full">{allowedStatuses.map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="p-2 border"><input name="categorie" value={editedData.categorie} onChange={handleFieldChange} className="w-full"/></td>
                  <td className="p-2 border"><input name="ligne_budgetaire" value={editedData.ligne_budgetaire} onChange={handleFieldChange} className="w-full"/></td>
                  <td className="p-2 border">—</td>
                  <td className="p-2 border">
                    <button onClick={()=>handleSave(f.id)} className="text-green-600 mr-2">Enregistrer</button>
                    <button onClick={handleCancel} className="text-gray-600">Annuler</button>
                  </td>
                </>
              ) : (
                <>                
                  <td className="p-2 border">{f.numero_facture}</td>
                  <td className="p-2 border">{formatDate(f.date_facture)}</td>
                  <td className="p-2 border">{f.montant}$</td>
                  <td className="p-2 border">{f.devise}</td>
                  <td className="p-2 border">{f.statut}</td>
                  <td className="p-2 border">{f.categorie}</td>
                  <td className="p-2 border">{f.ligne_budgetaire}</td>
                  <td className="p-2 border">{f.soumetteur_username}</td>
                  <td className="p-2 border">{formatDateTime(f.date_soumission)}</td>
                  <td className="p-2 border">
                    {f.chemin_fichier
                      ? <button onClick={()=>handleDownloadClick(f.id,new Date(f.date_facture).getFullYear())} className="text-green-500 underline text-sm">{f.chemin_fichier.split('/').pop()}</button>
                      : <span className="text-gray-500">—</span>
                    }
                  </td>
                  <td className="p-2 border">
                    { (userRole==='gestionnaire'||f.id_soumetteur===currentUserId) &&
                      <button onClick={()=>handleEditClick(f)} className="text-blue-600">Modifier</button>
                    }
                    {(userRole==='gestionnaire'||userRole==='approbateur') &&
                      <button onClick={()=>handleDelete(f.id)} className="text-red-500 ml-2">Supprimer</button>
                    }
                  </td>
                </>
              )}
            </tr>
          )) : (
            <tr><td colSpan={11} className="p-2 border text-center text-gray-500">Aucune facture pour cette année.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}

export default TableFactures;
