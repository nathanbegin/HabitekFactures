import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures]               = useState([]);
  const [file, setFile]                       = useState(null);
  const [menuOpen, setMenuOpen]               = useState({ id: null, x: 0, y: 0 });
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [newStatus, setNewStatus]             = useState("");

  const BACKEND_URL = "https://habitekfactures.onrender.com";
  const ANNEE       = 2025;
  const STATUTS     = ["Soumis","Traité","En attente de paiement","Refusé"];

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
    fetch(`${BACKEND_URL}/api/factures`, { method: "POST", body: data })
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
    fetch(`${BACKEND_URL}/api/factures/${id}?annee=${ANNEE}`, { method: "DELETE" })
      .then(r => {
        if (!r.ok) throw new Error();
        setFactures(factures.filter(f => f.id !== id));
      })
      .catch(() => alert("Erreur suppression"));
    setMenuOpen({ id: null, x: 0, y: 0 });
  };

  const startEditStatus = (id, current) => {
    setEditingStatusId(id);
    setNewStatus(current);
    setMenuOpen({ id: null, x: 0, y: 0 });
  };

  const saveStatus = id => {
    fetch(`${BACKEND_URL}/api/factures/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: newStatus, annee: ANNEE })
    })
    .then(r => r.json())
    .then(updated => {
      setFactures(factures.map(f => f.id === id ? updated : f));
      setEditingStatusId(null);
    })
    .catch(() => alert("Erreur mise à jour"));
  };

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuOpen(prev =>
      prev.id === id
        ? { id: null, x: 0, y: 0 }
        : { id, x: rect.left + rect.width / 2, y: rect.bottom + 8 }
    );
  };

  const closeMenu = () => setMenuOpen({ id: null, x: 0, y: 0 });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Titre bleu */}
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-semibold text-blue-600">
          Habitek — Gestion des factures
        </h1>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Card : Formulaire */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4">
            <h2 className="text-lg font-medium flex items-center space-x-2">
              <span className="text-xl">🧾</span>
              <span>Ajouter une facture</span>
            </h2>

            {/* Formulaire avec bouton submit */}
            <form onSubmit={handleUpload} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                name="annee"
                defaultValue={ANNEE}
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Année"
                required
              />
              <select
                name="type"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="MAT">Matériaux</option>
                <option value="SRV">Services</option>
              </select>
              <input
                type="text"
                name="ubr"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="UBR"
                required
              />
              <input
                type="text"
                name="fournisseur"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Fournisseur"
                required
              />
              <input
                type="text"
                name="description"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Description"
                required
              />
              <input
                type="number"
                name="montant"
                step="0.01"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Montant"
                required
              />
              <select
                name="statut"
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />

              {/* BOUTON SUBMIT DANS LE FORM */}
              <button
                type="submit"
                className="col-span-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-b-lg transition"
              >
                Ajouter la facture
              </button>
            </form>
          </div>
        </div>

        {/* Card : Liste */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 relative">
          <h2 className="text-lg font-medium flex items-center space-x-2 mb-4">
            <span className="text-xl">📋</span>
            <span>Factures ajoutées</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">UBR</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">…</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {factures.map((f, i) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.ubr}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.fournisseur}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{f.montant}$</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {editingStatusId === f.id ? (
                        <div className="flex items-center space-x-2">
                          <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value)}
                            className="border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          >
                            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => saveStatus(f.id)} className="text-green-600">✔</button>
                        </div>
                      ) : (
                        f.statut
                      )}
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <button
                        onClick={e => toggleMenu(e, f.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ⋮
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overlay pour fermer le menu */}
          {menuOpen.id !== null && (
            <div
              className="fixed inset-0 bg-black bg-opacity-25 z-40"
              onClick={closeMenu}
            />
          )}

          {/* Pop-up menu */}
          {menuOpen.id !== null && (
            <div
              className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50"
              style={{ top: menuOpen.y, left: menuOpen.x }}
            >
              <button
                onClick={() => startEditStatus(menuOpen.id, factures.find(f => f.id === menuOpen.id).statut)}
                className="block w-32 text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Modifier statut
              </button>
              <button
                onClick={() => deleteFacture(menuOpen.id)}
                className="block w-32 text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Supprimer
              </button>
            </div>
          )}

          {factures.length === 0 && (
            <p className="mt-4 text-gray-500">Aucune facture enregistrée.</p>
          )}
        </div>
      </div>
    </div>
  );
}
