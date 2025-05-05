import { useState } from 'react';

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
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ ...formData, ubr: '', fournisseur: '', description: '', montant: '', fichier: null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <input type="file" name="fichier" onChange={handleChange} className="w-full p-2 border rounded" />
      <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Ajouter la facture</button>
    </form>
  );
}

export default FormFacture;