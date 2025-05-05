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
      .then(res => res.json())
      .then(setFactures)
      .catch(console.error);
  }, []);

  const handleUpload = e => {
    e.preventDefault();
    const data = new FormData(e.target);
    data.append("fichier", file);
    fetch(`${BACKEND_URL}/api/factures`, { method: "POST", body: data })
      .then(res => res.json())
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
      .then(res => {
        if (!res.ok) throw new Error();
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
    .then(res => res.json())
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
        : { id, x: rect.left + rect.width/2, y: rect.bottom + 8 }
    );
  };
  const closeMenu = () => setMenuOpen({ id: null, x: 0, y: 0 });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-6 pt-6">
        <h1 className="text-2xl font-semibold text-blue-600">Habitek — Gestion des factures</h1>
      </header>
      <main className="px-6 py-4 space-y-6">
        <section className="card">
          <div className="card-content">
            <h2 className="text-lg font-medium flex items-center space-x-2">
              <span className="text-xl">🧾</span><span>Ajouter une facture</span>
            </h2>
            <form onSubmit={handleUpload} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="annee" type="number" defaultValue={ANNEE} placeholder="Année" className="input" required/>
              <select name="type" className="input" required>
                <option value="MAT">Matériaux</option><option value="SRV">Services</option>
              </select>
              <input name="ubr" type="text" placeholder="UBR" className="input" required/>
              <input name="fournisseur" type="text" placeholder="Fournisseur" className="input" required/>
              <input name="description" type="text" placeholder="Description" className="input" required/>
              <input name="montant" type="number" step="0.01" placeholder="Montant" className="input" required/>
              <select name="statut" className="input" required>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input name="fichier" type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} className="input" required/>
              <button type="submit" className="btn-primary col-span-full">Ajouter la facture</button>
            </form>
          </div>
        </section>
        <section className="card p-6 relative">
          <h2 className="text-lg font-medium flex items-center space-x-2 mb-4">
            <span className="text-xl">📋</span><span>Factures ajoutées</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>Type</th><th>UBR</th><th>Fournisseur</th><th>Montant</th><th>Statut</th><th>…</th></tr></thead>
              <tbody>
                {factures.map((f,i)=>
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td>{i+1}</td><td>{f.type}</td><td>{f.ubr}</td><td>{f.fournisseur}</td><td>{f.montant}$</td>
                    <td>{editingStatusId===f.id
                      ?<div className="flex items-center space-x-2"><select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="input">{STATUTS.map(s=><option key={s} value={s}>{s}</option>)}</select><button onClick={()=>saveStatus(f.id)} className="text-green-600">✔</button></div>
                      :f.statut}</td>
                    <td><button onClick={e=>toggleMenu(e,f.id)} className="menu-button">⋮</button></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {menuOpen.id && <div className="overlay" onClick={closeMenu}/>}
          {menuOpen.id && <div className="popup-menu" style={{top:menuOpen.y,left:menuOpen.x}}><button onClick={()=>startEditStatus(menuOpen.id, factures.find(f=>f.id===menuOpen.id).statut)} className="block px-4 py-2 hover:bg-gray-100 w-32 text-left">Modifier statut</button><button onClick={()=>deleteFacture(menuOpen.id)} className="block px-4 py-2 hover:bg-gray-100 w-32 text-left text-red-600">Supprimer</button></div>}
        </section>
      </main>
    </div>
  );
}
