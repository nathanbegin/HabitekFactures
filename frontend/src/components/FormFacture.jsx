// /* eslint-disable no-unused-vars */
// import { useState } from 'react';

// // -----------------------------------
// // Constantes
// // -----------------------------------

// // Taille maximale des fichiers en octets (2 Go)
// const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go = 2 * 1024 MB = 2 * 1024 * 1024 KB = 2 * 1024 * 1024 * 1024 octets

// // -----------------------------------
// // Composant FormFacture
// // -----------------------------------

// /**
//  * Formulaire pour ajouter une nouvelle facture.
//  * Permet à l'utilisateur de saisir les détails de la facture (année, type, montant, fichier, etc.)
//  * et de soumettre les données au composant parent via la prop onSubmit.
//  * @param {Object} props - Propriétés du composant.
//  * @param {Function} props.onSubmit - Fonction appelée lors de la soumission du formulaire avec les données de la facture.
//  * @param {string} props.annee - Année financière courante.
//  * @param {Function} props.setAnnee - Fonction pour mettre à jour l'année financière dans le composant parent.
//  * @returns {JSX.Element} Formulaire JSX pour l'ajout de factures.
//  */
// function FormFacture({ onSubmit, annee, setAnnee }) {
//   // -----------------------------------
//   // Gestion des États
//   // -----------------------------------

//   // État pour stocker les données du formulaire
//   const [formData, setFormData] = useState({
//     annee: annee, // Année financière initialisée avec la prop annee
//     type: 'Matériaux', // Type par défaut
//     ubr: '', // Champ optionnel
//     fournisseur: '', // Champ optionnel
//     description: '', // Champ optionnel
//     montant: '', // Montant requis
//     statut: 'Soumis', // Statut par défaut
//     fichier: null, // Fichier optionnel
//   });

//   // -----------------------------------
//   // Gestion des Événements
//   // -----------------------------------

//   /**
//    * Gère les changements dans les champs du formulaire.
//    * - Met à jour l'état formData avec la nouvelle valeur.
//    * - Vérifie la taille du fichier pour s'assurer qu'elle ne dépasse pas 2 Go.
//    * - Réinitialise l'input fichier si la taille est trop grande.
//    * @param {Object} e - Événement de changement (input ou select).
//    */
//   const handleChange = (e) => {
//     const { name, value, files } = e.target;

//     // Gestion des fichiers
//     if (name === 'fichier' && files && files[0]) {
//       const file = files[0];
//       if (file.size > MAX_FILE_SIZE_BYTES) {
//         alert(
//           `Le fichier "${file.name}" (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} Go) dépasse la taille maximale autorisée de 2 Go.`
//         );
//         e.target.value = null; // Réinitialise l'input fichier
//         return;
//       }
//     }

//     // Mise à jour de l'état
//     setFormData((prev) => ({
//       ...prev,
//       [name]: files ? files[0] : value,
//     }));
//   };

//   /**
//    * Gère la soumission du formulaire.
//    * - Empêche le rechargement de la page.
//    * - Vérifie à nouveau la taille du fichier pour plus de robustesse.
//    * - Appelle la fonction onSubmit avec les données du formulaire.
//    * - Réinitialise les champs du formulaire, sauf l'année.
//    * - Réinitialise visuellement l'input fichier.
//    * @param {Object} e - Événement de soumission du formulaire.
//    */
//   const handleSubmit = (e) => {
//     e.preventDefault();

//     // Vérification supplémentaire de la taille du fichier
//     if (formData.fichier && formData.fichier.size > MAX_FILE_SIZE_BYTES) {
//       alert('Veuillez sélectionner un fichier de taille inférieure à 2 Go.');
//       return;
//     }

//     // Soumission des données au composant parent
//     onSubmit(formData);

//     // Réinitialisation du formulaire
//     setFormData({
//       ...formData,
//       type: 'Matériaux', // Réinitialise au type par défaut
//       ubr: '',
//       fournisseur: '',
//       description: '',
//       montant: '',
//       statut: 'Soumis', // Réinitialise au statut par défaut
//       fichier: null, // Réinitialise le fichier
//     });

//     // Réinitialisation visuelle de l'input fichier
//     const fileInput = e.target.elements.fichier;
//     if (fileInput) {
//       fileInput.value = null;
//     }
//   };

//   // -----------------------------------
//   // Rendu
//   // -----------------------------------

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       {/* Champ Année */}
//       <input
//         type="number"
//         name="annee"
//         value={formData.annee}
//         onChange={(e) => {
//           setAnnee(e.target.value); // Met à jour l'année dans le composant parent
//           handleChange(e); // Met à jour l'état local
//         }}
//         className="w-full p-2 border rounded"
//         placeholder="Année"
//       />
//       {/* Champ Type */}
//       <select
//         name="type"
//         value={formData.type}
//         onChange={handleChange}
//         className="w-full p-2 border rounded"
//       >
//         <option>Matériaux</option>
//         <option>Services</option>
//       </select>
//       {/* Champ UBR */}
//       <input
//         name="ubr"
//         value={formData.ubr}
//         onChange={handleChange}
//         placeholder="UBR"
//         className="w-full p-2 border rounded"
//       />
//       {/* Champ Fournisseur */}
//       <input
//         name="fournisseur"
//         value={formData.fournisseur}
//         onChange={handleChange}
//         placeholder="Fournisseur"
//         className="w-full p-2 border rounded"
//       />
//       {/* Champ Description */}
//       <input
//         name="description"
//         value={formData.description}
//         onChange={handleChange}
//         placeholder="Description"
//         className="w-full p-2 border rounded"
//       />
//       {/* Champ Montant */}
//       <input
//         name="montant"
//         value={formData.montant}
//         onChange={handleChange}
//         placeholder="Montant"
//         className="w-full p-2 border rounded"
//       />
//       {/* Champ Statut */}
//       <select
//         name="statut"
//         value={formData.statut}
//         onChange={handleChange}
//         className="w-full p-2 border rounded"
//       >
//         <option>Soumis</option>
//         <option>Refusé</option>
//       </select>
//       {/* Champ Fichier */}
//       <input
//         type="file"
//         name="fichier"
//         onChange={handleChange}
//         className="w-full p-2 border rounded"
//       />
//       {/* Bouton de soumission */}
//       <button
//         type="submit"
//         className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
//       >
//         Ajouter la facture
//       </button>
//     </form>
//   );
// }

// export default FormFacture;


// src/components/FormFacture.jsx
// Formulaire pour ajouter (et potentiellement modifier) une facture.
// Permet à l'utilisateur de saisir les détails de la facture (y compris les nouvelles colonnes)
// et de soumettre les données avec un fichier optionnel.
///////////////////////////////////////////

// import { useState } from 'react';

// // -----------------------------------
// // Constantes
// // -----------------------------------

// // Taille maximale des fichiers en octets (2 Go) - Peut être laissée telle quelle
// const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

// // -----------------------------------
// // Composant FormFacture
// // -----------------------------------

// /**
//  * Formulaire pour ajouter ou modifier une facture.
//  * Gère les champs de la facture, y compris les nouvelles colonnes, et l'upload de fichier optionnel.
//  * @param {Object} props - Propriétés du composant.
//  * @param {Function} props.onSubmit - Fonction appelée lors de la soumission du formulaire avec les données (FormData).
//  * @param {string} props.annee - Année financière courante (pour les nouvelles factures).
//  * @param {Function} props.setAnnee - Fonction pour mettre à jour l'année financière dans le composant parent.
//  * @param {Object} [props.initialData] - Données initiales de la facture si le formulaire est utilisé pour la modification.
//  * @returns {JSX.Element} Formulaire JSX pour l'ajout/modification de factures.
//  */
// // Ajout de initialData aux props si vous comptez utiliser ce formulaire pour la modification
// function FormFacture({ onSubmit, annee, setAnnee, initialData }) {
//   // -----------------------------------
//   // Gestion des États
//   // -----------------------------------
//   // État du formulaire - Initialisé avec les données initiales si fournies, sinon valeurs par défaut
//   const [formData, setFormData] = useState(
//       initialData || {
//           // Champs existants
//           numero_facture: '',
//           date_facture: '', // Format 'YYYY-MM-DD'
//           fournisseur: '',
//           description: '',
//           montant: '',
//           devise: 'CAD', // Devise par défaut
//           statut: 'soumis', // Statut par défaut pour une nouvelle soumission
//           type: '', // Champ 'type' de l'original (bien que non dans la DB facture, il était dans le formulaire original)
//           ubr: '', // Champ 'ubr' de l'original

//           // NOUVEAUX champs à ajouter au formulaire
//           categorie: '',
//           ligne_budgetaire: '',
//       }
//   );

//   // État pour le fichier sélectionné (géré séparément des autres champs)
//   const [file, setFile] = useState(null);
//   // État pour gérer la suppression du fichier existant lors de la MODIFICATION
//   // (Utile uniquement si ce formulaire est aussi utilisé pour la modification)
//    const [removeExistingFile, setRemoveExistingFile] = useState(false);


//   // ----------------------------------
//   // Effet pour gérer initialData si le formulaire est réutilisé (ex: dans une modale d'édition)
//   // ----------------------------------
//   // Si initialData change (par exemple, quand on ouvre la modale pour éditer une autre facture),
//   // mettre à jour l'état du formulaire.
//   // useEffect(() => {
//   //      if (initialData) {
//   //          setFormData({
//   //              ...initialData,
//   //               // Assurez-vous de formater correctement les dates, montants, etc. si nécessaire
//   //               // Par exemple, si date_facture vient de la DB en format différent, formatez-le en YYYY-MM-DD
//   //               date_facture: initialData.date_facture ? new Date(initialData.date_facture).toISOString().split('T')[0] : '',
//   //               // Convertir le montant de Decimal (string) en number pour le champ input type="number" si vous l'utilisez
//   //               montant: initialData.montant ? String(initialData.montant) : '', // input type="text" accepte la chaîne
//   //           });
//   //          setFile(null); // Réinitialiser le fichier lors de l'édition d'une nouvelle facture
//   //          setRemoveExistingFile(false); // Réinitialiser l'option de suppression de fichier
//   //      } else {
//   //          // Si initialData devient null (ex: fermeture de la modale ou passage en mode création)
//   //           setFormData({ // Réinitialiser les champs pour un nouveau formulaire vide
//   //               numero_facture: '', date_facture: '', fournisseur: '', description: '',
//   //               montant: '', devise: 'CAD', statut: 'soumis', type: '', ubr: '',
//   //               categorie: '', ligne_budgetaire: '',
//   //           });
//   //           setFile(null);
//   //           setRemoveExistingFile(false);
//   //      }
//   // }, [initialData]); // Déclencher cet effet lorsque initialData change


//   // -----------------------------------
//   // Gestion des Événements
//   // -----------------------------------

//   /**
//    * Gère les changements dans les champs de texte, select, etc.
//    * Met à jour l'état formData.
//    * @param {Object} e - L'événement de changement.
//    */
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData({
//       ...formData,
//       [name]: value,
//     });
//   };

//   /**
//    * Gère le changement dans le champ input type="file".
//    * Stocke le fichier sélectionné dans l'état 'file'.
//    * Vérifie la taille du fichier.
//    * @param {Object} e - L'événement de changement.
//    */
//   const handleFileChange = (e) => {
//     const selectedFile = e.target.files[0];
//     if (selectedFile && selectedFile.size > MAX_FILE_SIZE_BYTES) {
//       alert(`Le fichier est trop grand. La taille maximale est de ${MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)} Go.`);
//       // Réinitialiser l'input fichier
//       e.target.value = null;
//       setFile(null);
//       return;
//     }
//     setFile(selectedFile);
//   };

//   /**
//    * Gère la soumission du formulaire.
//    * Construit un objet FormData et appelle la prop onSubmit.
//    * @param {Object} e - L'événement de soumission du formulaire.
//    */
//   const handleSubmit = (e) => {
//     e.preventDefault();

//     // Validation basique des champs requis (ajuster selon les vrais requis de votre backend)
//     // Note: Le backend fait aussi sa propre validation, mais une validation frontend améliore l'UX.
//     if (!formData.numero_facture || !formData.date_facture || !formData.fournisseur || !formData.montant || !formData.devise || !formData.categorie || !formData.ligne_budgetaire) {
//          alert("Veuillez remplir tous les champs requis (Numéro, Date, Fournisseur, Montant, Devise, Catégorie, Ligne Budgétaire).");
//          return;
//     }

//     // Convertir le montant en nombre pour une validation basique frontend si besoin
//     // Bien que le backend gère la conversion en Decimal, une vérification ici est utile
//     if (isNaN(parseFloat(formData.montant))) {
//         alert("Le montant doit être un nombre valide.");
//         return;
//     }


//     const data = new FormData();

//     // Ajouter les champs du formulaire à l'objet FormData
//     // Utiliser l'année financière courante passée en prop pour les nouvelles factures
//     data.append('annee', annee); // annee était un champ dans le formulaire original, assurez-vous que le backend l'attend si nécessaire (actuellement la route GET /api/factures utilise l'année, mais pas la route POST /api/factures dans votre backend). Si annee n'est pas stocké en DB pour la facture, vous n'avez peut-être pas besoin de l'envoyer ici. Je le laisse car il était dans l'original.

//     // Ajouter les champs existants
//     data.append('numero_facture', formData.numero_facture);
//     data.append('date_facture', formData.date_facture);
//     data.append('fournisseur', formData.fournisseur);
//     data.append('description', formData.description);
//     data.append('montant', formData.montant);
//     data.append('devise', formData.devise);
//     data.append('statut', formData.statut);
//     data.append('type', formData.type); // Ajouter le champ type de l'original
//     data.append('ubr', formData.ubr); // Ajouter le champ ubr de l'original


//     // Ajouter les NOUVEAUX champs
//     data.append('categorie', formData.categorie);
//     data.append('ligne_budgetaire', formData.ligne_budgetaire);

//     // Ajouter le fichier SEULEMENT s'il y en a un sélectionné
//     if (file) {
//       data.append('fichier', file);
//     }

//     // Ajouter l'indicateur de suppression de fichier SEULEMENT si le formulaire est utilisé pour la modification
//     // et que l'option de suppression est cochée.
//     // if (initialData && removeExistingFile) { // Si c'est un formulaire d'édition ET que la suppression est demandée
//     //     data.append('remove_file', 'true');
//     // }
//      // Si le formulaire est utilisé pour la MODIFICATION et qu'un NOUVEAU fichier est sélectionné,
//      // vous n'avez pas besoin d'envoyer remove_file='true'. Le backend gère le remplacement.
//      // Si le formulaire est utilisé pour la MODIFICATION et qu'AUCUN nouveau fichier n'est sélectionné MAIS removeExistingFile est vrai,
//      // alors on envoie remove_file='true'.
//      // Si le formulaire est utilisé pour la MODIFICATION et qu'AUCUN nouveau fichier n'est sélectionné et removeExistingFile est faux,
//      // ALORS ne rien envoyer pour le fichier ni remove_file, le backend conservera l'ancien chemin_fichier.


//     // Appeler la fonction onSubmit passée par le parent (MainLayout)
//     // Cette fonction parent sera responsable d'appeler l'API (POST ou PUT)
//     onSubmit(data);

//     // Optionnel: Réinitialiser le formulaire après soumission réussie (si c'est un formulaire de création)
//     // if (!initialData) { // Si ce n'est PAS un formulaire d'édition
//         setFormData({
//             numero_facture: '', date_facture: '', fournisseur: '', description: '',
//             montant: '', devise: 'CAD', statut: 'soumis', type: '', ubr: '',
//             categorie: '', ligne_budgetaire: '',
//         });
//         setFile(null); // Réinitialiser le fichier
//         // Réinitialiser l'input de type file manuellement si nécessaire (peut être un peu tricky selon comment il est rendu)
//         // ou en utilisant une réf ou en le contrôlant entièrement si besoin.
//     // }
//   };

//   // -----------------------------------
//   // Rendu du Formulaire
//   // -----------------------------------

//   return (
//     // Utiliser onSubmit sur la balise form, pas sur le bouton
//     <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
//        {/* Année (peut être en lecture seule ou sélectionnable) */}
//        {/* Si c'est un formulaire de création, l'année est souvent l'année courante */}
//        {/* Si c'est un formulaire d'édition, l'année peut être non modifiable */}
//         <div>
//             <label htmlFor="annee" className="block text-sm font-medium text-gray-700">Année Financière:</label>
//             <input
//                 id="annee"
//                 name="annee"
//                  // L'année peut être l'année financière calculée dans le parent (MainLayout)
//                 value={annee} // Utilise la prop 'annee'
//                  // Rendre ce champ en lecture seule si vous ne voulez pas que l'utilisateur la change dans le formulaire de création
//                  // ou si c'est un formulaire d'édition
//                 readOnly
//                 className="mt-1 block w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"
//             />
//              {/* Si vous voulez permettre de changer l'année financière dans le formulaire de création,
//                  vous pouvez utiliser onChange={e => setAnnee(e.target.value)} si setAnnee est passé et géré dans le parent */}
//         </div>


//       {/* Champ Numéro de Facture */}
//        <div>
//            <label htmlFor="numero_facture" className="block text-sm font-medium text-gray-700">Numéro de Facture:</label>
//            <input
//               id="numero_facture"
//               name="numero_facture"
//               type="text"
//               value={formData.numero_facture}
//               onChange={handleChange}
//               required // Marquer comme requis si le backend le requiert
//               placeholder="Numéro de Facture"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* Champ Date de Facture */}
//        <div>
//            <label htmlFor="date_facture" className="block text-sm font-medium text-gray-700">Date de Facture:</label>
//            <input
//               id="date_facture"
//               name="date_facture"
//               type="date" // Utiliser type="date" pour un sélecteur de date
//               value={formData.date_facture}
//               onChange={handleChange}
//               required // Marquer comme requis
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* Champ Fournisseur */}
//        <div>
//            <label htmlFor="fournisseur" className="block text-sm font-medium text-gray-700">Fournisseur:</label>
//            <input
//               id="fournisseur"
//               name="fournisseur"
//               type="text"
//               value={formData.fournisseur}
//               onChange={handleChange}
//               required // Marquer comme requis
//               placeholder="Fournisseur"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* Champ Description */}
//         <div>
//            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description:</label>
//            <textarea // Utiliser un textarea pour une description multiligne
//               id="description"
//               name="description"
//               value={formData.description}
//               onChange={handleChange}
//               placeholder="Description (optionnel)"
//               rows="3" // Nombre de lignes visible par défaut
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* Champ Montant */}
//         <div>
//            <label htmlFor="montant" className="block text-sm font-medium text-gray-700">Montant:</label>
//            <input
//               id="montant"
//               name="montant"
//               type="number" // Utiliser type="number" pour le montant
//               step="0.01" // Permettre les décimales
//               value={formData.montant}
//               onChange={handleChange}
//               required // Marquer comme requis
//               placeholder="Montant"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* Champ Devise */}
//         <div>
//            <label htmlFor="devise" className="block text-sm font-medium text-gray-700">Devise:</label>
//            <select
//               id="devise"
//               name="devise"
//               value={formData.devise}
//               onChange={handleChange}
//               required // Marquer comme requis
//               className="mt-1 block w-full p-2 border rounded-md"
//            >
//               <option value="CAD">CAD</option>
//               <option value="USD">USD</option>
//               <option value="EUR">EUR</option>
//                {/* Ajoutez d'autres devises si nécessaire */}
//            </select>
//        </div>

//        {/* Champ Statut (pour la création, souvent 'soumis' n'est pas modifiable par l'utilisateur) */}
//        {/* Si ce formulaire est pour la création, ce champ pourrait être masqué ou en lecture seule avec la valeur 'soumis' */}
//        {/* Si c'est pour la modification, il pourrait être affiché */}
//         {/* Si vous voulez le montrer même pour la création, utilisez ceci : */}
//        {/* <div>
//            <label htmlFor="statut" className="block text-sm font-medium text-gray-700">Statut:</label>
//             <select
//               id="statut"
//               name="statut"
//               value={formData.statut}
//               onChange={handleChange}
//                // Vous pourriez le rendre disabled={true} si seul le backend peut changer le statut initial
//               className="mt-1 block w-full p-2 border rounded-md"
//            >
//               <option value="soumis">Soumis</option>
//               <option value="approuve">Approuvé</option>
//               <option value="rejete">Rejeté</option>
//               <option value="paye">Payé</option>

//            </select>
//        </div> */}
//         {/* Si vous utilisez ce formulaire UNIQUEMENT pour la création et que le statut initial est toujours 'soumis' défini par le backend,
//             vous n'avez pas besoin de ce champ ici. */}


//        {/* Champ Type (champ de l'original, non dans la DB facture) */}
//        {/* Si 'type' n'est pas stocké dans la table 'factures', ce champ peut être retiré ou sa gestion re-évaluée */}
//        {/* Si vous le stockez ailleurs ou l'utilisez pour de la logique frontend, laissez-le. */}
//         <div>
//            <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type:</label>
//            <input
//               id="type"
//               name="type"
//               type="text"
//               value={formData.type}
//               onChange={handleChange}
//               placeholder="Type (ex: Opérationnel, Capital)"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//         {/* Champ UBR (champ de l'original, non dans la DB facture) */}
//        {/* Si 'ubr' n'est pas stocké dans la table 'factures', ce champ peut être retiré ou sa gestion re-évaluée */}
//        {/* Si vous le stockez ailleurs ou l'utilisez pour de la logique frontend, laissez-le. */}
//        <div>
//            <label htmlFor="ubr" className="block text-sm font-medium text-gray-700">UBR:</label>
//            <input
//               id="ubr"
//               name="ubr"
//               type="text"
//               value={formData.ubr}
//               onChange={handleChange}
//               placeholder="UBR (optionnel)"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>


//        {/* NOUVEAU Champ Catégorie */}
//         <div>
//            <label htmlFor="categorie" className="block text-sm font-medium text-gray-700">Catégorie:</label>
//            <input
//               id="categorie"
//               name="categorie"
//               type="text"
//               value={formData.categorie}
//               onChange={handleChange}
//               required // Marquer comme requis si le backend le requiert
//               placeholder="Catégorie (ex: Matériel, Service)"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>

//        {/* NOUVEAU Champ Ligne Budgétaire */}
//         <div>
//            <label htmlFor="ligne_budgetaire" className="block text-sm font-medium text-gray-700">Ligne Budgétaire:</label>
//            <input
//               id="ligne_budgetaire"
//               name="ligne_budgetaire"
//               type="text"
//               value={formData.ligne_budgetaire}
//               onChange={handleChange}
//               required // Marquer comme requis si le backend le requiert
//               placeholder="Ligne Budgétaire (ex: Fournitures de bureau)"
//               className="mt-1 block w-full p-2 border rounded-md"
//            />
//        </div>


//       {/* Champ Fichier (maintenant optionnel pour la création) */}
//        <div>
//            <label htmlFor="fichier" className="block text-sm font-medium text-gray-700">Fichier (PDF, image, etc.):</label>
//             <input
//               id="fichier"
//               type="file"
//               name="fichier" // Le nom 'fichier' est important pour FormData et le backend
//               onChange={handleFileChange} // Utiliser le handler spécifique pour les fichiers
//               className="mt-1 block w-full p-2 border rounded-md file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
//             />
//            {/* --- Logique pour la MODIFICATION (si ce formulaire est utilisé pour l'édition) --- */}
//            {/* Afficher le nom du fichier existant et l'option de suppression si initialData est présent et qu'il y a un chemin de fichier */}
//            {/*
//             {initialData && initialData.chemin_fichier && (
//                 <div className="mt-2 text-sm text-gray-600">
//                     Fichier actuel : {initialData.chemin_fichier.split('/').pop()}
//                     <label className="ml-4">
//                         <input
//                             type="checkbox"
//                             checked={removeExistingFile}
//                             onChange={e => setRemoveExistingFile(e.target.checked)}
//                             className="mr-1"
//                         />
//                         Supprimer le fichier existant
//                     </label>
//                 </div>
//             )}
//              {/* Si un NOUVEAU fichier est sélectionné LORS DE L'ÉDITION, afficher son nom */}
//            {/*
//            {initialData && file && (
//                  <div className="mt-2 text-sm text-blue-600">
//                      Nouveau fichier sélectionné : {file.name}
//                  </div>
//            )}
//            */}
//            {/* --- Fin de la logique pour la MODIFICATION --- */}

//        </div>


//       {/* Bouton de soumission */}
//       <button
//         type="submit" // Le type submit déclenche la fonction onSubmit de la balise form
//         className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
//       >
//         {/* Changer le texte du bouton selon si c'est une création ou une édition */}
//         {initialData ? 'Mettre à jour la Facture' : 'Ajouter la Facture'}
//       </button>
//     </form>
//   );
// }

// export default FormFacture;

// src/components/FormFacture.jsx
// Formulaire pour ajouter (et potentiellement modifier) une facture.
// Permet à l'utilisateur de saisir les détails de la facture (y compris les nouvelles colonnes)
// et de soumettre les données avec un fichier optionnel.




import { useState } from 'react'; // Importez useState

// -----------------------------------
// Constantes
// -----------------------------------

// Taille maximale des fichiers en octets (2 Go)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

// -----------------------------------
// Composant FormFacture
// -----------------------------------

/**
 * Formulaire pour ajouter ou modifier une facture.
 * Gère les champs de la facture, y compris les nouvelles colonnes, et l'upload de fichier optionnel.
 * @param {Object} props - Propriétés du composant.
 * @param {Function} props.onSubmit - Fonction appelée lors de la soumission du formulaire avec les données (FormData).
 * @param {string} props.annee - Année financière courante (pour les nouvelles factures).
 * @param {Function} props.setAnnee - Fonction pour mettre à jour l'année financière dans le composant parent (si le formulaire gère l'année).
 * @param {Object} [props.initialData] - Données initiales de la facture si le formulaire est utilisé pour la modification.
 * @returns {JSX.Element} Formulaire JSX pour l'ajout/modification de factures.
 */
// Ajout de initialData aux props si vous comptez utiliser ce formulaire pour la modification
function FormFacture({ onSubmit, annee, setAnnee, initialData }) {
  // -----------------------------------
  // Gestion des États
  // -----------------------------------
  // État du formulaire pour les champs texte et select
  const [formData, setFormData] = useState(
      // Initialisé avec les données initiales si fournies, sinon valeurs par défaut
      initialData || {
          // Champs existants de l'original (annee, type, montant, ubr, fournisseur, description, statut étaient présents)
          // Retrait de 'annee' et 'fichier' de cet état car 'annee' vient d'une prop et 'fichier' est géré séparément.
          numero_facture: '', // Ajouté car nécessaire pour le backend
          date_facture: '', // Ajouté car nécessaire pour le backend
          fournisseur: '',
          description: '',
          montant: '',
          devise: 'CAD', // Ajouté car nécessaire pour le backend
          statut: 'soumis', // Ajouté car nécessaire pour le backend, avec valeur par défaut
          type: '',
          ubr: '',

          // NOUVEAUX champs à ajouter au formulaire
          categorie: '',
          ligne_budgetaire: '',
      }
  );

  // État séparé pour le fichier sélectionné (correct pour input type="file")
  const [selectedFile, setSelectedFile] = useState(null);

  // État pour gérer la suppression du fichier existant lors de la MODIFICATION
  // (Utile uniquement si ce formulaire est aussi utilisé pour la modification)
   const [removeExistingFile, setRemoveExistingFile] = useState(false);


  // ----------------------------------
  // Effet pour gérer initialData si le formulaire est réutilisé (ex: dans une modale d'édition)
  // ----------------------------------
  // Si initialData change (par exemple, quand on ouvre la modale pour éditer une autre facture),
  // mettre à jour l'état du formulaire.
  // useEffect(() => {
  //      if (initialData) {
  //          setFormData({
  //               // Assurez-vous de mapper toutes les propriétés nécessaires de initialData
  //              numero_facture: initialData.numero_facture || '',
  //              date_facture: initialData.date_facture ? new Date(initialData.date_facture).toISOString().split('T')[0] : '', // Formater la date
  //              fournisseur: initialData.fournisseur || '',
  //              description: initialData.description || '',
  //              montant: initialData.montant ? String(initialData.montant) : '', // Convertir en string pour input type="number"
  //              devise: initialData.devise || 'CAD',
  //              statut: initialData.statut || 'soumis',
  //              type: initialData.type || '', // Si 'type' est bien stocké en DB
  //              ubr: initialData.ubr || '', // Si 'ubr' est bien stocké en DB

  //               // NOUVEAUX champs
  //               categorie: initialData.categorie || '',
  //               ligne_budgetaire: initialData.ligne_budgetaire || '',
  //           });
  //          setSelectedFile(null); // Réinitialiser le fichier sélectionné
  //          setRemoveExistingFile(false); // Réinitialiser l'option de suppression de fichier
  //      } else {
  //          // Si initialData devient null (ex: fermeture de la modale ou passage en mode création)
  //           setFormData({ // Réinitialiser les champs pour un nouveau formulaire vide
  //               numero_facture: '', date_facture: '', fournisseur: '', description: '',
  //               montant: '', devise: 'CAD', statut: 'soumis', type: '', ubr: '',
  //               categorie: '', ligne_budgetaire: '',
  //           });
  //           setSelectedFile(null);
  //           setRemoveExistingFile(false);
  //      }
  // }, [initialData]); // Déclencher cet effet lorsque initialData change


  // -----------------------------------
  // Gestion des Événements
  // -----------------------------------

  /**
   * Gère les changements dans les champs de texte, select, etc.
   * Met à jour l'état formData.
   * @param {Object} e - L'événement de changement.
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  /**
   * Gère le changement dans le champ input type="file".
   * Stocke le fichier sélectionné dans l'état 'selectedFile'.
   * Vérifie la taille du fichier.
   * @param {Object} e - L'événement de changement.
   */
  const handleFileChange = (e) => {
    const file = e.target.files[0]; // Correctement obtenir le premier fichier sélectionné
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      alert(`Le fichier est trop grand. La taille maximale est de ${MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)} Go.`);
      // Réinitialiser l'input fichier et l'état
      e.target.value = null;
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file); // Stocker l'objet File dans l'état dédié
    console.log('e fichier Selected : ',selectedFile);
  };

   /**
    * Gère le changement de l'état de la case à cocher "Supprimer le fichier existant".
    * (Utile uniquement si ce formulaire est aussi utilisé pour la modification)
    * @param {Object} e - L'événement de changement.
    */
   const handleRemoveFileChange = (e) => {
       setRemoveExistingFile(e.target.checked);
        // Si l'utilisateur coche "Supprimer", on s'assure qu'aucun nouveau fichier n'est sélectionné en même temps
       if (e.target.checked) {
            setSelectedFile(null);
            // Optionnel: Réinitialiser l'input de type file dans le DOM si nécessaire
            // (peut nécessiter une réf ou un contrôle total de l'input file)
       }
   };


  /**
   * Gère la soumission du formulaire.
   * Construit un objet FormData et appelle la prop onSubmit.
   * @param {Object} e - L'événement de soumission du formulaire.
   */
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation basique des champs requis (ajuster selon les vrais requis de votre backend)
    // Note: Le backend fait aussi sa propre validation.
    if (!formData.numero_facture || !formData.date_facture || !formData.fournisseur || !formData.montant || !formData.devise || !formData.categorie || !formData.ligne_budgetaire) {
         alert("Veuillez remplir tous les champs requis (Numéro, Date, Fournisseur, Montant, Devise, Catégorie, Ligne Budgétaire).");
         return;
    }

    // Validation basique du montant
    if (isNaN(parseFloat(formData.montant))) {
        alert("Le montant doit être un nombre valide.");
        return;
    }


    const data = new FormData();

    // Ajouter les champs du formulaire à l'objet FormData
    // Utiliser l'année financière courante passée en prop 'annee'
    data.append('annee', annee); // annee vient de MainLayout et est passée en prop
    // Ajouter les champs existants (et corrigés pour être dans formData)
    data.append('numero_facture', formData.numero_facture);
    data.append('date_facture', formData.date_facture);
    data.append('fournisseur', formData.fournisseur);
    data.append('description', formData.description);
    data.append('montant', formData.montant);
    data.append('devise', formData.devise);
    data.append('statut', formData.statut); // Assurez-vous que ce statut est pertinent pour la CRÉATION (soumis)
    data.append('type', formData.type);
    data.append('ubr', formData.ubr);
    data.append('categorie', formData.categorie);
    data.append('ligne_budgetaire', formData.ligne_budgetaire);

    // Ajouter le fichier SEULEMENT s'il y en a un sélectionné
    // Utiliser l'état 'selectedFile' qui contient l'objet File
    if (selectedFile) {
      data.append('fichier', selectedFile);
    }

    // --- Logique pour la MODIFICATION (si ce formulaire est utilisé pour l'édition) ---
    // Si le formulaire est utilisé pour la MODIFICATION (ex: initialData est présent)
    // et que l'utilisateur a demandé la suppression du fichier existant SANS uploader de nouveau fichier.
    // if (initialData && removeExistingFile && !selectedFile) {
    //     data.append('remove_file', 'true');
    // }
     // Si le formulaire est utilisé pour la MODIFICATION et qu'un NOUVEAU fichier est sélectionné (selectedFile existe)
     // ALORS pas besoin d'envoyer remove_file='true', le backend gère le remplacement.
     // Si le formulaire est utilisé pour la MODIFICATION et qu'AUCUN nouveau fichier n'est sélectionné
     // et removeExistingFile est faux, ALORS ne rien envoyer pour le fichier ni remove_file, le backend conservera l'ancien chemin_fichier.
    // --- Fin de la logique pour la MODIFICATION ---


    // Appeler la fonction onSubmit passée par le parent (MainLayout) avec l'objet FormData
    console.log(data);
    onSubmit(data);

    // Optionnel: Réinitialiser le formulaire après soumission réussie (si c'est un formulaire de création)
    // if (!initialData) { // Si ce n'est PAS un formulaire d'édition
        setFormData({
            numero_facture: '', date_facture: '', fournisseur: '', description: '',
            montant: '', devise: 'CAD', statut: 'soumis', type: '', ubr: '',
            categorie: '', ligne_budgetaire: '',
        });
        setSelectedFile(null); // Réinitialiser le fichier sélectionné
        // Optionnel: Réinitialiser l'input de type file dans le DOM si nécessaire (pour vider le nom du fichier affiché)
        // Cela peut être fait en utilisant une réf ou en rendant l'input contrôlé.
        // Une manière simple (mais pas standard React) est de vider sa valeur directement si vous n'avez pas de réf:
         const fileInput = document.getElementById('fichier'); // Assurez-vous que l'id est correct
         if (fileInput) fileInput.value = ''; // Ceci efface le nom de fichier affiché par le navigateur
    // }
  };

  // -----------------------------------
  // Rendu du Formulaire
  // -----------------------------------

  return (
    // Utiliser onSubmit sur la balise form, pas sur le bouton
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
       {/* Année (peut être en lecture seule ou sélectionnable) */}
       {/* L'année vient de MainLayout et est gérée là-bas. Souvent en lecture seule dans le formulaire. */}
        <div>
            <label htmlFor="annee" className="block text-sm font-medium text-gray-700">Année Financière:</label>
            <input
                id="annee"
                name="annee"
                 // L'année est passée en prop et gérée dans le composant parent (MainLayout)
                value={annee} // Utilise la prop 'annee'
                 // Rendre ce champ en lecture seule si vous ne voulez pas que l'utilisateur la change
                 readOnly
                 // Appliquer un style pour indiquer qu'il n'est pas modifiable
                className="mt-1 block w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"
            />
             {/* Si vous voulez permettre de changer l'année financière DANS le formulaire de création,
                 vous pouvez enlever readOnly et ajouter onChange={e => setAnnee(e.target.value)} si setAnnee est passé et géré dans le parent */}
        </div>


      {/* Champ Numéro de Facture */}
       <div>
           <label htmlFor="numero_facture" className="block text-sm font-medium text-gray-700">Numéro de Facture:</label>
           <input
              id="numero_facture"
              name="numero_facture" // Assurez-vous que 'name' correspond à la clé dans formData
              type="text"
              value={formData.numero_facture}
              onChange={handleChange} // Utilise le handler générique
              required // Rendu HTML requis (le backend valide aussi)
              placeholder="Numéro de Facture"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* Champ Date de Facture */}
       <div>
           <label htmlFor="date_facture" className="block text-sm font-medium text-gray-700">Date de Facture:</label>
           <input
              id="date_facture"
              name="date_facture" // Assurez-vous que 'name' correspond
              type="date" // Utiliser type="date" pour un sélecteur de date natif
              value={formData.date_facture}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* Champ Fournisseur */}
       <div>
           <label htmlFor="fournisseur" className="block text-sm font-medium text-gray-700">Fournisseur:</label>
           <input
              id="fournisseur"
              name="fournisseur" // Assurez-vous que 'name' correspond
              type="text"
              value={formData.fournisseur}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              placeholder="Fournisseur"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* Champ Description */}
        <div>
           <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description:</label>
           <textarea // Utiliser un textarea pour une description multiligne
              id="description"
              name="description" // Assurez-vous que 'name' correspond
              value={formData.description}
              onChange={handleChange} // Utilise le handler générique
              placeholder="Description (optionnel)"
              rows="3" // Nombre de lignes visible par défaut
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* Champ Montant */}
        <div>
           <label htmlFor="montant" className="block text-sm font-medium text-gray-700">Montant:</label>
           <input
              id="montant"
              name="montant" // Assurez-vous que 'name' correspond
              type="number" // Utiliser type="number" pour le montant
              step="0.01" // Permettre les décimales
              value={formData.montant}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              placeholder="Montant"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* Champ Devise */}
        <div>
           <label htmlFor="devise" className="block text-sm font-medium text-gray-700">Devise:</label>
           <select
              id="devise"
              name="devise" // Assurez-vous que 'name' correspond
              value={formData.devise}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              className="mt-1 block w-full p-2 border rounded-md"
           >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
               {/* Ajoutez d'autres devises si nécessaire */}
           </select>
       </div>

       {/* Champ Statut (souvent 'soumis' pour la création, géré par le backend) */}
       {/* Si ce formulaire est UNIQUEMENT pour la création et que le statut initial est toujours 'soumis' défini par le backend,
           vous n'avez pas besoin de ce champ ici. Si vous voulez le montrer, il est déjà dans formData. */}
        {/* Example si vous voulez l'afficher et le rendre non modifiable en création : */}
        {/* <div>
            <label htmlFor="statut" className="block text-sm font-medium text-gray-700">Statut:</label>
             <input
               id="statut"
               name="statut"
               type="text"
               value={formData.statut} // Sera 'soumis' par défaut si pas initialData
               readOnly // Rendre non modifiable en création
               className="mt-1 block w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"
            />
        </div> */}


       {/* Champ Type (champ de l'original) */}
       {/* Si 'type' n'est pas stocké dans la table 'factures', ce champ peut être retiré ou sa gestion re-évaluée */}
        <div>
           <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type:</label>
           <input
              id="type"
              name="type" // Assurez-vous que 'name' correspond
              type="text"
              value={formData.type}
              onChange={handleChange} // Utilise le handler générique
              placeholder="Type (ex: Opérationnel, Capital)"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

        {/* Champ UBR (champ de l'original) */}
       {/* Si 'ubr' n'est pas stocké dans la table 'factures', ce champ peut être retiré ou sa gestion re-évaluée */}
       <div>
           <label htmlFor="ubr" className="block text-sm font-medium text-gray-700">UBR:</label>
           <input
              id="ubr"
              name="ubr" // Assurez-vous que 'name' correspond
              type="text"
              value={formData.ubr}
              onChange={handleChange} // Utilise le handler générique
              placeholder="UBR (optionnel)"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>


       {/* NOUVEAU Champ Catégorie */}
        <div>
           <label htmlFor="categorie" className="block text-sm font-medium text-gray-700">Catégorie:</label>
           <input
              id="categorie"
              name="categorie" // Assurez-vous que 'name' correspond
              type="text"
              value={formData.categorie}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              placeholder="Catégorie (ex: Matériel, Service)"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>

       {/* NOUVEAU Champ Ligne Budgétaire */}
        <div>
           <label htmlFor="ligne_budgetaire" className="block text-sm font-medium text-gray-700">Ligne Budgétaire:</label>
           <input
              id="ligne_budgetaire"
              name="ligne_budgetaire" // Assurez-vous que 'name' correspond
              type="text"
              value={formData.ligne_budgetaire}
              onChange={handleChange} // Utilise le handler générique
              required // Requis
              placeholder="Ligne Budgétaire (ex: Fournitures de bureau)"
              className="mt-1 block w-full p-2 border rounded-md"
           />
       </div>


      {/* Champ Fichier (maintenant optionnel pour la création et corrigé) */}
       <div>
           <label htmlFor="fichier" className="block text-sm font-medium text-gray-700">Fichier (PDF, image, etc.):</label>
            <input
              id="fichier"
              type="file"
              name="fichier" // Le nom 'fichier' est important pour FormData et le backend
              onChange={handleFileChange} // Utiliser le handler SPECIFIQUE pour les fichiers
              className="mt-1 block w-full p-2 border rounded-md file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
           {/* --- Logique pour la MODIFICATION (si ce formulaire est utilisé pour l'édition) --- */}
           {/* Afficher le nom du fichier existant et l'option de suppression si initialData est présent et qu'il y a un chemin de fichier */}
           {/*
            {initialData && initialData.chemin_fichier && (
                <div className="mt-2 text-sm text-gray-600">
                    Fichier actuel : {initialData.chemin_fichier.split('/').pop()}
                    <label className="ml-4">
                        <input
                            type="checkbox"
                            checked={removeExistingFile}
                            onChange={handleRemoveFileChange} // Utiliser le handler spécifique
                            className="mr-1"
                        />
                        Supprimer le fichier existant
                    </label>
                </div>
            )}
             {/* Si un NOUVEAU fichier est sélectionné LORS DE L'ÉDITION, afficher son nom */}
           {/*
           {selectedFile && ( // Utiliser selectedFile ici
                 <div className="mt-2 text-sm text-blue-600">
                     Nouveau fichier sélectionné : {selectedFile.name}
                 </div>
           )}
           */}
           {/* --- Fin de la logique pour la MODIFICATION --- */}

       </div>


      {/* Bouton de soumission */}
      <button
        type="submit" // Le type submit déclenche la fonction onSubmit de la balise form
        className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
      >
        {/* Changer le texte du bouton selon si c'est une création ou une édition */}
        {initialData ? 'Mettre à jour la Facture' : 'Ajouter la Facture'}
      </button>
    </form>
  );
}

export default FormFacture;