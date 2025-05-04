import React, { useState, useEffect } from 'react';

export default function App() {
  const [factures, setFactures] = useState([]);
  const [file, setFile] = useState(null);
  const [menuOpen, setMenuOpen] = useState({ id: null, x: 0, y: 0 });
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [newStatus, setNewStatus] = useState("");

  const BACKEND_URL = "https://habitekfactures.onrender.com";
  const ANNEE = 2025;
  const STATUTS = ["Soumis", "Traité", "En attente de paiement", "Refusé"];

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/factures?annee=${ANNEE}`)
      .then(r => r.json())
      .then(data => setFactures(data))
      .catch(err => console.error("Erreur chargement:", err));
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
        setFactures(factures.map(f => (f.id === id ? updated : f)));
        setEditingStatusId(null);
      });
  };

  const toggleMenu = (e, id) => {
    e.stopPropagation();
    const { clientX: x, clientY: y } = e;
    setMenuOpen(menuOpen.id === id ? { id: null, x: 0, y: 0 } : { id, x, y });
  };

  const closeMenu = () => setMenuOpen({ id: null, x: 0, y: 0 });

  return (
    <div className="absolute top-0 right-0 bg-white text-gray-900 font-sans antialiased w-full max-w-5xl pt-4">
      <header className="bg-white text-blue-700 border-b border-gray-200 p-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Habitek — Gestion des factures
        </h1>
      </header>
      <main className="p-6 space-y-8" onClick={closeMenu}>
        {/* Formulaire d'ajout */}
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">🧾 Ajouter une facture</h2>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* inputs... */}
          </form>
        </section>

        {/* Tableau des factures */}
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">📋 Factures ajoutées</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              {/* table head */}
              <tbody>
                {factures.map((f, i) => (
                  <tr key={f.id} className="hover:bg-gray-50 relative">
                    {/* cells... */}
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={e => toggleMenu(e, f.id)}
                        className="px-2 py-1 hover:bg-gray-200 rounded"
                      >
                        ⋮
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {factures.length === 0 && <p className="text-gray-500 mt-2">Aucune facture enregistrée.</p>}
          </div>

          {/* Overlay pop-up menu */}
          {menuOpen.id !== null && (
            <>  
              <div
                className="fixed inset-0 bg-black bg-opacity-25 z-20"
                onClick={closeMenu}
              />
              <div
                className="fixed bg-white border border-gray-200 rounded shadow-md z-30"
                style={{ top: menuOpen.y, left: menuOpen.x, transform: 'translate(-50%, 0)' }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => startEditStatus(menuOpen.id, factures.find(f => f.id === menuOpen.id).statut)}
                  className="block px-4 py-2 hover:bg-gray-100 w-full text-left"
                >
                  Modifier statut
                </button>
                <button
                  onClick={() => deleteFacture(menuOpen.id)}
                  className="block px-4 py-2 hover:bg-gray-100 w-full text-left text-red-600"
                >
                  Supprimer
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
