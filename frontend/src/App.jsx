import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures] = useState([]);
  const [file, setFile] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const BACKEND_URL = "https://habitekfactures.onrender.com";
  const ANNEE = 2025;
  const STATUTS = ["Soumis","Traité","En attente de paiement","Refusé"];

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/factures?annee=${ANNEE}`)
      .then(r => r.json())
      .then(setFactures)
      .catch(console.error);
  }, []);

  const handleUpload = e => {
    e.preventDefault();
    const data = new FormData(e.target);
    data.append("fichier", file);
    fetch(`${BACKEND_URL}/api/factures`, { method:"POST", body:data })
      .then(r => r.json())
      .then(f => {
        setFactures([...factures, f]);
        e.target.reset();
        setFile(null);
      })
      .catch(() => alert("Échec de l'envoi"));
  };

  const deleteFacture = id => {
    if (!window.confirm("Supprimer cette facture ?")) return;
    fetch(`${BACKEND_URL}/api/factures/${id}?annee=${ANNEE}`, { method:"DELETE" })
      .then(r => {
        if (!r.ok) throw 0;
        setFactures(factures.filter(f => f.id !== id));
      })
      .catch(() => alert("Erreur suppression"));
  };

  const startEditStatus = (id, current) => {
    setEditingStatusId(id);
    setNewStatus(current);
    setMenuOpenId(null);
  };
  const saveStatus = id => {
    fetch(`${BACKEND_URL}/api/factures/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ statut:newStatus, annee:ANNEE })
    })
    .then(r => r.json())
    .then(updated => {
      setFactures(factures.map(f => f.id === id ? updated : f));
      setEditingStatusId(null);
    });
  };

  return (
    <div className="absolute top-0 right-0 bg-white text-gray-900 font-sans antialiased w-full max-w-5xl pt-4">
      <header className="bg-white text-blue-700 border-b border-gray-200 p-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Habitek — Gestion des factures
        </h1>
      </header>
      <main className="p-6 space-y-8">
        {/* --- Formulaire d'ajout --- */}
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">🧾 Ajouter une facture</h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              name="annee"
              placeholder="Année"
              defaultValue={ANNEE}
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <select
              name="type"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            >
              <option value="MAT">Matériaux</option>
              <option value="SRV">Services</option>
            </select>
            <input
              type="text"
              name="ubr"
              placeholder="UBR"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <input
              type="text"
              name="fournisseur"
              placeholder="Fournisseur"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <input
              type="text"
              name="description"
              placeholder="Description"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <input
              type="number"
              name="montant"
              placeholder="Montant"
              step="0.01"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <select
              name="statut"
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            >
              {STATUTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="file"
              name="fichier"
              accept="application/pdf"
              onChange={e => setFile(e.target.files[0])}
              className="border px-3 py-2 rounded focus:outline-none focus:ring focus:border-blue-300"
              required
            />
            <button
              type="submit"
              className="col-span-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Ajouter la facture
            </button>
          </form>
        </section>

        {/* --- Tableau des factures --- */}
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">📋 Factures ajoutées</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Type</th>
                  <th className="border px-2 py-1">UBR</th>
                  <th className="border px-2 py-1">Fournisseur</th>
                  <th className="border px-2 py-1">Montant</th>
                  <th className="border px-2 py-1">Statut</th>
                  <th className="border px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {factures.map((f, i) => (
                  <tr key={f.id} className="hover:bg-gray-50 relative">
                    <td className="border px-2 py-1">{i + 1}</td>
                    <td className="border px-2 py-1">{f.type}</td>
                    <td className="border px-2 py-1">{f.ubr}</td>
                    <td className="border px-2 py-1">{f.fournisseur}</td>
                    <td className="border px-2 py-1">{f.montant}$</td>
                    <td className="border px-2 py-1">
                      {editingStatusId === f.id ? (
                        <div className="flex items-center space-x-2">
                          <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            className="border rounded px-2 py-1"
                          >
                            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button
                            onClick={() => saveStatus(f.id)}
                            className="text-green-600 hover:underline"
                          >
                            ✔
                          </button>
                        </div>
                      ) : (
                        f.statut
                      )}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === f.id ? null : f.id)}
                        className="px-2 py-1 hover:bg-gray-200 rounded"
                      >
                        ⋮
                      </button>
                      {menuOpenId === f.id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded shadow-sm z-10">
                          <button
                            onClick={() => startEditStatus(f.id, f.statut)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100"
                          >
                            Modifier statut
                          </button>
                          <button
                            onClick={() => deleteFacture(f.id)}
                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {factures.length === 0 && (
              <p className="text-gray-500 mt-2">Aucune facture enregistrée.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
