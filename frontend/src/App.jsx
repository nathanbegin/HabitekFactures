
import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetch('/api/factures?annee=2025')
      .then((res) => res.json())
      .then((data) => setFactures(data));
  }, []);

  const handleUpload = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    data.append('fichier', file);

    fetch('/api/factures', {
      method: 'POST',
      body: data
    })
    .then(res => res.json())
    .then(newFacture => {
      setFactures([...factures, newFacture]);
      form.reset();
      setFile(null);
    });
  };

  return (
    <div className='p-4 max-w-xl mx-auto space-y-4'>
      <form onSubmit={handleUpload} className='space-y-2'>
        <input type='number' name='annee' placeholder='Année' required />
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
            <a href={`/api/factures/${f.id}/fichier?annee=${f.annee}`} target='_blank' rel='noreferrer'>
              Télécharger
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
