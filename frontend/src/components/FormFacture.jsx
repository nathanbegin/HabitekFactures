/* eslint-disable no-unused-vars */
import { useState } from 'react';

// -----------------------------------
// Constantes
// -----------------------------------

// Taille maximale des fichiers en octets (2 Go)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go = 2 * 1024 MB = 2 * 1024 * 1024 KB = 2 * 1024 * 1024 * 1024 octets

// -----------------------------------
// Composant FormFacture
// -----------------------------------

/**
 * Formulaire pour ajouter une nouvelle facture.
 * Permet à l'utilisateur de saisir les détails de la facture (année, type, montant, fichier, etc.)
 * et de soumettre les données au composant parent via la prop onSubmit.
 * @param {Object} props - Propriétés du composant.
 * @param {Function} props.onSubmit - Fonction appelée lors de la soumission du formulaire avec les données de la facture.
 * @param {string} props.annee - Année financière courante.
 * @param {Function} props.setAnnee - Fonction pour mettre à jour l'année financière dans le composant parent.
 * @returns {JSX.Element} Formulaire JSX pour l'ajout de factures.
 */
function FormFacture({ onSubmit, annee, setAnnee }) {
  // -----------------------------------
  // Gestion des États
  // -----------------------------------

  // État pour stocker les données du formulaire
  const [formData, setFormData] = useState({
    annee: annee, // Année financière initialisée avec la prop annee
    type: 'Matériaux', // Type par défaut
    ubr: '', // Champ optionnel
    fournisseur: '', // Champ optionnel
    description: '', // Champ optionnel
    montant: '', // Montant requis
    statut: 'Soumis', // Statut par défaut
    fichier: null, // Fichier optionnel
  });

  // -----------------------------------
  // Gestion des Événements
  // -----------------------------------

  /**
   * Gère les changements dans les champs du formulaire.
   * - Met à jour l'état formData avec la nouvelle valeur.
   * - Vérifie la taille du fichier pour s'assurer qu'elle ne dépasse pas 2 Go.
   * - Réinitialise l'input fichier si la taille est trop grande.
   * @param {Object} e - Événement de changement (input ou select).
   */
  const handleChange = (e) => {
    const { name, value, files } = e.target;

    // Gestion des fichiers
    if (name === 'fichier' && files && files[0]) {
      const file = files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(
          `Le fichier "${file.name}" (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} Go) dépasse la taille maximale autorisée de 2 Go.`
        );
        e.target.value = null; // Réinitialise l'input fichier
        return;
      }
    }

    // Mise à jour de l'état
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  /**
   * Gère la soumission du formulaire.
   * - Empêche le rechargement de la page.
   * - Vérifie à nouveau la taille du fichier pour plus de robustesse.
   * - Appelle la fonction onSubmit avec les données du formulaire.
   * - Réinitialise les champs du formulaire, sauf l'année.
   * - Réinitialise visuellement l'input fichier.
   * @param {Object} e - Événement de soumission du formulaire.
   */
  const handleSubmit = (e) => {
    e.preventDefault();

    // Vérification supplémentaire de la taille du fichier
    if (formData.fichier && formData.fichier.size > MAX_FILE_SIZE_BYTES) {
      alert('Veuillez sélectionner un fichier de taille inférieure à 2 Go.');
      return;
    }

    // Soumission des données au composant parent
    onSubmit(formData);

    // Réinitialisation du formulaire
    setFormData({
      ...formData,
      type: 'Matériaux', // Réinitialise au type par défaut
      ubr: '',
      fournisseur: '',
      description: '',
      montant: '',
      statut: 'Soumis', // Réinitialise au statut par défaut
      fichier: null, // Réinitialise le fichier
    });

    // Réinitialisation visuelle de l'input fichier
    const fileInput = e.target.elements.fichier;
    if (fileInput) {
      fileInput.value = null;
    }
  };

  // -----------------------------------
  // Rendu
  // -----------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Champ Année */}
      <input
        type="number"
        name="annee"
        value={formData.annee}
        onChange={(e) => {
          setAnnee(e.target.value); // Met à jour l'année dans le composant parent
          handleChange(e); // Met à jour l'état local
        }}
        className="w-full p-2 border rounded"
        placeholder="Année"
      />
      {/* Champ Type */}
      <select
        name="type"
        value={formData.type}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      >
        <option>Matériaux</option>
        <option>Services</option>
      </select>
      {/* Champ UBR */}
      <input
        name="ubr"
        value={formData.ubr}
        onChange={handleChange}
        placeholder="UBR"
        className="w-full p-2 border rounded"
      />
      {/* Champ Fournisseur */}
      <input
        name="fournisseur"
        value={formData.fournisseur}
        onChange={handleChange}
        placeholder="Fournisseur"
        className="w-full p-2 border rounded"
      />
      {/* Champ Description */}
      <input
        name="description"
        value={formData.description}
        onChange={handleChange}
        placeholder="Description"
        className="w-full p-2 border rounded"
      />
      {/* Champ Montant */}
      <input
        name="montant"
        value={formData.montant}
        onChange={handleChange}
        placeholder="Montant"
        className="w-full p-2 border rounded"
      />
      {/* Champ Statut */}
      <select
        name="statut"
        value={formData.statut}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      >
        <option>Soumis</option>
        <option>Refusé</option>
      </select>
      {/* Champ Fichier */}
      <input
        type="file"
        name="fichier"
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />
      {/* Bouton de soumission */}
      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
      >
        Ajouter la facture
      </button>
    </form>
  );
}

export default FormFacture;