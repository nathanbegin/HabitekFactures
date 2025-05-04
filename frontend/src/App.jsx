
import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures] = useState([]);
  const [file, setFile] = useState(null);

  const BACKEND_URL = "https://habitekfactures.onrender.com"; // à adapter
  const ANNEE = 2025;

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/factures?annee=${ANNEE}`)
      .then(res => res.json())
      .then(data => setFactures(data))
      .catch(err => console.error("Erreur chargement:", err));
  }, []);

  const handleUpload = (e) => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    data.append('fichier', file);

    fetch(`${BACKEND_URL}/api/factures`, {
      method: 'POST',
      body: data
    })
    .then(res => res.json())
    .then(newFacture => {
      setFactures([...factures, newFacture]);
      form.reset();
      setFile(null);
    })
    .catch(err => alert("Échec de l'envoi"));
  };

  const supprimerFacture = (id) => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    fetch(`${BACKEND_URL}/api/factures/${id}?annee=${ANNEE}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error();
        setFactures(factures.filter(f => f.id !== id));
      })
      .catch(() => alert("Échec de la suppression"));
  };

  return (
    <div className="absolute start-0 top-0 bg-gray-50 text-gray-800 max-w-5xl pt-4">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold">Habitek — Gestion des factures</h1>
      </header>
{/* 
      <main className="max-w-5xl mx-auto p-6 space-y-8 pt-4">
        <section className="bg-white p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold">🧾 Ajouter une facture</h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="number" name="annee" placeholder="Année" defaultValue={ANNEE} className="input" required />
            <select name="type" className="input" required>
              <option value="MAT">Matériaux</option>
              <option value="SRV">Services</option>
            </select>
            <input type="text" name="ubr" placeholder="UBR" className="input" required />
            <input type="text" name="fournisseur" placeholder="Fournisseur" className="input" required />
            <input type="text" name="description" placeholder="Description" className="input" required />
            <input type="number" name="montant" placeholder="Montant" step="0.01" className="input" required />
            <select name="statut" className="input" required>
              <option value="Soumis">Soumis</option>
              <option value="Traité">Traité</option>
              <option value="En attente de paiement">En attente de paiement</option>
              <option value="Refusé">Refusé</option>
            </select>
            <input type="file" name="fichier" accept="application/pdf" required onChange={e => setFile(e.target.files[0])} className="input" />
            <button type="submit" className="col-span-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Ajouter la facture
            </button>
          </form>
        </section>

        <section className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">📋 Factures ajoutées</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1 text-left">#</th>
                  <th className="border px-2 py-1">Type</th>
                  <th className="border px-2 py-1">UBR</th>
                  <th className="border px-2 py-1">Fournisseur</th>
                  <th className="border px-2 py-1">Montant</th>
                  <th className="border px-2 py-1">Statut</th>
                  <th className="border px-2 py-1">Fichier</th>
                  <th className="border px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {factures.map((f, i) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{i + 1}</td>
                    <td className="border px-2 py-1">{f.type}</td>
                    <td className="border px-2 py-1">{f.ubr}</td>
                    <td className="border px-2 py-1">{f.fournisseur}</td>
                    <td className="border px-2 py-1">{f.montant}$</td>
                    <td className="border px-2 py-1">{f.statut}</td>
                    <td className="border px-2 py-1">
                      <a href={`${BACKEND_URL}/api/factures/${f.id}/fichier?annee=${f.annee}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Télécharger
                      </a>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button onClick={() => supprimerFacture(f.id)} className="text-red-600 hover:underline">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {factures.length === 0 && <p className="text-gray-500 mt-2">Aucune facture enregistrée.</p>}
          </div>
        </section>
      </main> */}
    </div>
  );
}
