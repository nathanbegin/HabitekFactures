import { useState } from 'react';

// Define the maximum file size in bytes (2 GB)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB = 2 * 1024 MB = 2 * 1024 * 1024 KB = 2 * 1024 * 1024 * 1024 Bytes

function FormFacture({ onSubmit, annee, setAnnee }) {
  const [formData, setFormData] = useState({
    annee: annee,
    type: 'Matériaux',
    ubr: '',
    fournisseur: '',
    description: '',
    montant: '',
    statut: 'Soumis',
    fichier: null
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === 'fichier' && files && files[0]) {
      const file = files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`Le fichier "${file.name}" (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} Go) dépasse la taille maximale autorisée de 2 Go.`);
        // Do not update the state with the large file
        // Optionally, you might want to clear the input visually
        e.target.value = null; // Reset the file input
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Before submitting, you might want to double-check the file size,
    // although the handleChange already prevents adding large files to state.
    if (formData.fichier && formData.fichier.size > MAX_FILE_SIZE_BYTES) {
         alert("Veuillez sélectionner un fichier de taille inférieure à 2 Go.");
         return; // Prevent form submission
    }

    onSubmit(formData);
    // Reset form fields except for the year
    setFormData({
      ...formData,
      type: 'Matériaux', // Reset to default type
      ubr: '',
      fournisseur: '',
      description: '',
      montant: '',
      statut: 'Soumis', // Reset to default status
      fichier: null // Reset file
    });
     // Also clear the file input element visually
    const fileInput = e.target.elements.fichier;
    if (fileInput) {
        fileInput.value = null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ... other form fields */}
      <input
        type="number"
        name="annee"
        value={formData.annee}
        onChange={(e) => {
          setAnnee(e.target.value);
          handleChange(e);
        }}
        className="w-full p-2 border rounded"
      />
      <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded">
        <option>Matériaux</option>
        <option>Services</option>
      </select>
      <input name="ubr" value={formData.ubr} onChange={handleChange} placeholder="UBR" className="w-full p-2 border rounded" />
      <input name="fournisseur" value={formData.fournisseur} onChange={handleChange} placeholder="Fournisseur" className="w-full p-2 border rounded" />
      <input name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full p-2 border rounded" />
      <input name="montant" value={formData.montant} onChange={handleChange} placeholder="Montant" className="w-full p-2 border rounded" />
      <select name="statut" value={formData.statut} onChange={handleChange} className="w-full p-2 border rounded">
        <option>Soumis</option>
        <option>Refusé</option>
      </select>
      <input type="file" name="fichier" onChange={handleChange} className="w-full p-2 border rounded" /> {/* File input */}
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Ajouter la facture</button>
    </form>
  );
}

export default FormFacture;