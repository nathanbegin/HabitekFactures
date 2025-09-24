import { useEffect, useMemo, useState } from "react";

export default function DepenseComptesPage({ authorizedFetch, userRole, API_URL }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    mode: "distinct_ubr",
    global_ubr: "",
    demandeur_prenom: "",
    demandeur_nom: "",
    date_soumis: "",
  });

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [attachIds, setAttachIds] = useState(""); // "12, 13, 14"

  const canManage = userRole === "gestionnaire";

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (mode) params.set("mode", mode);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await authorizedFetch(`${API_URL}/api/depense-comptes?${params.toString()}`, {
        method: "GET",
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("list error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    if (!id) return;
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${id}`, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch (e) {
      console.error("detail error", e);
    }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      if (createForm.mode === "global_ubr" && !createForm.global_ubr) {
        alert("global_ubr est requis en mode global_ubr");
        return;
      }
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erreur création: ${err.error || res.status}`);
        return;
      }
      setShowCreate(false);
      setCreateForm({
        mode: "distinct_ubr",
        global_ubr: "",
        demandeur_prenom: "",
        demandeur_nom: "",
        date_soumis: "",
      });
      await fetchList();
    } catch (e) {
      console.error("create error", e);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm(`Supprimer le compte ${id} ?`)) return;
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erreur suppression: ${err.error || res.status}`);
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await fetchList();
    } catch (e) {
      console.error("delete error", e);
    }
  };

  const onPatch = async (patch) => {
    if (!detail) return;
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const ok = res.ok;
      const data = await res.json().catch(() => ({}));
      if (!ok) {
        alert(`Erreur modification: ${data.error || res.status}`);
        return;
      }
      setDetail(data);
      await fetchList();
    } catch (e) {
      console.error("patch error", e);
    }
  };

  const onAttach = async () => {
    if (!detail) return;
    const ids = attachIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n));
    if (!ids.length) {
      alert("Renseigne des IDs de facture, ex: 101, 102");
      return;
    }
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${detail.id}/factures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facture_ids: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erreur attache: ${data.error || res.status}`);
        return;
      }
      setAttachIds("");
      await fetchDetail(detail.id);
    } catch (e) {
      console.error("attach error", e);
    }
  };

  const onDetach = async (fid) => {
    if (!detail) return;
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${detail.id}/factures/${fid}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erreur détache: ${err.error || res.status}`);
        return;
      }
      await fetchDetail(detail.id);
    } catch (e) {
      console.error("detach error", e);
    }
  };

  const onApplyGlobalUbr = async () => {
    if (!detail) return;
    if (detail.mode !== "global_ubr") {
      alert("Action disponible seulement pour les comptes en mode global_ubr");
      return;
    }
    if (!window.confirm(`Appliquer l'UBR global (${detail.global_ubr}) à toutes les factures liées ?`)) return;
    try {
      const res = await authorizedFetch(`${API_URL}/api/depense-comptes/${detail.id}/appliquer-global-ubr`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Erreur application UBR: ${data.error || res.status}`);
        return;
      }
      // Les sockets "update_facture" déclencheront ton re-fetch côté liste de factures
      alert(`UBR appliqué à ${data.updated_count} facture(s).`);
      await fetchDetail(detail.id);
    } catch (e) {
      console.error("apply ubr error", e);
    }
  };

  // sockets: garder la liste en phase
//   useEffect(() => {
//     if (!socket) return;
//     const onNew = (item) => setItems((prev) => [item, ...prev]);
//     const onUpd = (item) => setItems((prev) => {
//       const i = prev.findIndex((x) => x.id === item.id);
//       if (i === -1) return prev;
//       const copy = prev.slice();
//       copy[i] = { ...copy[i], ...item };
//       return copy;
//     });
//     const onDel = ({ id }) => setItems((prev) => prev.filter((x) => x.id !== id));

//     socket.on("depense_compte_new", onNew);
//     socket.on("depense_compte_update", onUpd);
//     socket.on("depense_compte_delete", onDel);
//     return () => {
//       socket.off("depense_compte_new", onNew);
//       socket.off("depense_compte_update", onUpd);
//       socket.off("depense_compte_delete", onDel);
//     };
//   }, [socket]);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mode, from, to]);

  const selectedItem = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Comptes de dépenses</h1>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="border p-2" placeholder="Recherche (id/prénom/nom)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="border p-2" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">Mode (tous)</option>
          <option value="global_ubr">global_ubr</option>
          <option value="distinct_ubr">distinct_ubr</option>
        </select>
        <input className="border p-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="border p-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        {canManage && (
          <button className="border px-3 py-2" onClick={() => setShowCreate(true)}>+ Nouveau</button>
        )}
      </div>

      {/* Liste */}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Mode</th>
              <th className="p-2 text-left">Global UBR</th>
              <th className="p-2 text-left">Demandeur</th>
              <th className="p-2 text-left">Date soumis</th>
              <th className="p-2 text-left">Factures liées</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-2" colSpan={7}>Chargement…</td></tr>
            )}
            {!loading && items.map((it) => (
              <tr key={it.id} className={`border-t ${selectedId === it.id ? "bg-gray-100" : ""}`}>
                <td className="p-2">{it.id}</td>
                <td className="p-2">{it.mode}</td>
                <td className="p-2">{it.global_ubr || "—"}</td>
                <td className="p-2">{it.demandeur_prenom} {it.demandeur_nom}</td>
                <td className="p-2">{it.date_soumis}</td>
                <td className="p-2">{it.factures_count ?? "—"}</td>
                <td className="p-2 flex gap-2">
                  <button className="border px-2 py-1" onClick={() => setSelectedId(it.id)}>Détail</button>
                  {canManage && (
                    <>
                      <button className="border px-2 py-1" onClick={() => onPatch({ mode: it.mode === "global_ubr" ? "distinct_ubr" : "global_ubr", ...(it.mode === "global_ubr" ? {} : { global_ubr: it.global_ubr || "" }) })}>
                        Basculer mode
                      </button>
                      <button className="border px-2 py-1" onClick={() => onDelete(it.id)}>Supprimer</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td className="p-2" colSpan={7}>Aucun compte</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Détail */}
      {selectedItem && detail && (
        <div className="mt-6 border rounded p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Détail — {detail.id}</h2>
            <button className="text-sm underline" onClick={() => { setSelectedId(null); setDetail(null); }}>Fermer</button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><b>Mode:</b> {detail.mode}</div>
            <div><b>Global UBR:</b> {detail.global_ubr || "—"}</div>
            <div><b>Demandeur:</b> {detail.demandeur_prenom} {detail.demandeur_nom}</div>
            <div><b>Date soumis:</b> {detail.date_soumis}</div>
          </div>

          {canManage && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button className="border px-3 py-1" onClick={() => {
                const v = prompt("Nouveau global_ubr (laisser vide pour annuler)", detail.global_ubr || "");
                if (v != null) onPatch({ global_ubr: v });
              }}>Changer global_ubr</button>

              <button className="border px-3 py-1" onClick={() => {
                const prenom = prompt("Prénom", detail.demandeur_prenom || "");
                const nom = prompt("Nom", detail.demandeur_nom || "");
                if (prenom != null && nom != null) onPatch({ demandeur_prenom: prenom, demandeur_nom: nom });
              }}>Changer demandeur</button>

              {detail.mode === "global_ubr" && (
                <button className="border px-3 py-1" onClick={onApplyGlobalUbr}>Appliquer UBR global</button>
              )}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Factures liées</h3>
            <div className="flex gap-2 mb-3">
              <input className="border p-2 flex-1" placeholder="IDs de factures, ex: 101, 102"
                     value={attachIds} onChange={(e) => setAttachIds(e.target.value)} />
              <button className="border px-3" onClick={onAttach}>Attacher</button>
            </div>

            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">ID</th>
                    <th className="p-2 text-left"># Facture</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Fournisseur</th>
                    <th className="p-2 text-left">Montant</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.factures || []).map((f) => (
                    <tr key={f.id} className="border-t">
                      <td className="p-2">{f.id}</td>
                      <td className="p-2">{f.numero_facture}</td>
                      <td className="p-2">{f.date_facture}</td>
                      <td className="p-2">{f.fournisseur}</td>
                      <td className="p-2">{f.montant} {f.devise}</td>
                      <td className="p-2">{f.statut}</td>
                      <td className="p-2">
                        <button className="border px-2 py-1" onClick={() => onDetach(f.id)}>Détacher</button>
                      </td>
                    </tr>
                  ))}
                  {(!detail.factures || detail.factures.length === 0) && (
                    <tr><td className="p-2" colSpan={7}>Aucune facture liée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showCreate && canManage && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">Nouveau compte</h2>
              <button onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={onCreate} className="grid gap-3">
              <label className="grid gap-1">
                <span>Mode</span>
                <select
                  value={createForm.mode}
                  onChange={(e) => setCreateForm((s) => ({ ...s, mode: e.target.value }))}
                  className="border p-2"
                >
                  <option value="distinct_ubr">distinct_ubr</option>
                  <option value="global_ubr">global_ubr</option>
                </select>
              </label>

              {createForm.mode === "global_ubr" && (
                <label className="grid gap-1">
                  <span>Global UBR</span>
                  <input
                    className="border p-2"
                    value={createForm.global_ubr}
                    onChange={(e) => setCreateForm((s) => ({ ...s, global_ubr: e.target.value }))}
                    placeholder="UBR-2025-001"
                  />
                </label>
              )}

              <label className="grid gap-1">
                <span>Prénom</span>
                <input
                  className="border p-2"
                  value={createForm.demandeur_prenom}
                  onChange={(e) => setCreateForm((s) => ({ ...s, demandeur_prenom: e.target.value }))}
                />
              </label>

              <label className="grid gap-1">
                <span>Nom</span>
                <input
                  className="border p-2"
                  value={createForm.demandeur_nom}
                  onChange={(e) => setCreateForm((s) => ({ ...s, demandeur_nom: e.target.value }))}
                />
              </label>

              <label className="grid gap-1">
                <span>Date soumis (optionnel)</span>
                <input
                  type="date"
                  className="border p-2"
                  value={createForm.date_soumis}
                  onChange={(e) => setCreateForm((s) => ({ ...s, date_soumis: e.target.value }))}
                />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" className="border px-3 py-2" onClick={() => setShowCreate(false)}>Annuler</button>
                <button type="submit" className="border px-3 py-2">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
