
import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures] = useState([]);
  const [file, setFile] = useState(null);

  const BACKEND_URL = "https://habitekfactures.onrender.com/"; // Remplace avec ton backend réel
  const ANNEE = 2025;

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/factures?annee=${ANNEE}`)
      .then((res) => res.json())
      .then((data) => setFactures(data))
      .catch((err) => console.error("Erreur de chargement des factures :", err));
  }, []);

  const handleUpload = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    data.append('fichier', file);

    fetch(`${BACKEND_URL}/api/factures`, {
      method: 'POST',
      body: data
    })
    .then(res => {
      if (!res.ok) throw new Error("Erreur lors de l'envoi");
      return res.json();
    })
    .then(newFacture => {
      setFactures([...factures, newFacture]);
      form.reset();
      setFile(null);
    })
    .catch(err => {
      console.error("Erreur d'envoi :", err);
      alert("Échec de l'envoi de la facture.");
    });
  };

  const supprimerFacture = (id) => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    fetch(`${BACKEND_URL}/api/factures/${id}?annee=${ANNEE}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (!res.ok) throw new Error("Erreur suppression");
      setFactures(factures.filter(f => f.id !== id));
    })
    .catch(err => {
      console.error("Erreur suppression :", err);
      alert("Échec de la suppression.");
    });
  };

  return (
    <div className='p-4 max-w-xl mx-auto space-y-4'>
      <form onSubmit={handleUpload} className='space-y-2'>
        <input type='number' name='annee' placeholder='Année' defaultValue={ANNEE} required />
        <select name='type' required>
          <option value='MAT'>Matériaux</option>
          <option value='SRV'>Services</option>
        </select>
        <input type='text' name='ubr' placeholder='UBR' required />
        <input type='text' name='fournisseur' placeholder='Fournisseur' required />
        <input type='text' name='description' placeholder='Description' required />
        <input type='number' name='montant' step='0.01' placeholder='Montant' required />
        <select name='statut' required>
          <option value='Soumis'>Soumis</option>
          <option value='Traité'>Traité</option>
          <option value='En attente de paiement'>En attente de paiement</option>
          <option value='Refusé'>Refusé</option>
        </select>
        <input type='file' name='fichier' accept='application/pdf' required onChange={e => setFile(e.target.files[0])} />
        <button type='submit'>Ajouter la facture</button>
      </form>

      <h2>Factures ajoutées</h2>
      <ul>
        {factures.map(f => (
          <li key={f.id}>
            {f.annee}-{f.type}-{f.numero}-UBR-{f.ubr} — {f.fournisseur}
            <br />
            <a href={`${BACKEND_URL}/api/factures/${f.id}/fichier?annee=${f.annee}`} target='_blank' rel='noreferrer'>
              Télécharger
            </a>
            {" | "}
            <button onClick={() => supprimerFacture(f.id)} style={{ color: "red", marginLeft: "10px" }}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
