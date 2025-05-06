import React from 'react';

function TableFactures({ factures, onDelete, onUpdate }) {
  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  // Télécharge un fichier donné pour une facture
  const downloadFile = async (id, annee, filename) => {
    try {
      // On passe le nom du fichier dans les query params
      const response = await fetch(
        `${API_URL}/api/factures/${id}/fichier?annee=${annee}&filename=${encodeURIComponent(filename)}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur lors du téléchargement :", err);
    }
  };

  // Confirmation avant suppression
  const handleDelete = id => {
    if (window.confirm("Confirmez-vous la suppression de cette facture ?")) {
      onDelete(id);
    }
  };

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 border">#</th>
          <th className="p-2 border">Type</th>
          <th className="p-2 border">UBR</th>
          <th className="p-2 border">Fournisseur</th>
          <th className="p-2 border">Montant</th>
          <th className="p-2 border">Statut</th>
          <th className="p-2 border">Fichiers</th>
          <th className="p-2 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {factures.map((facture, idx) => (
          <tr key={facture.id} className="border-t">
            <td className="p-2 border">{idx + 1}</td>
            <td className="p-2 border">{facture.type}</td>
            <td className="p-2 border">{facture.ubr}</td>
            <td className="p-2 border">{facture.fournisseur}</td>
            <td className="p-2 border">{facture.montant}$</td>
            <td className="p-2 border">{facture.statut}</td>
            {/* Nouvelle colonne qui liste tous les fichiers */}
            <td className="p-2 border">
              {facture.fichiers && facture.fichiers.length > 0 ? (
                <ul className="space-y-1">
                  {facture.fichiers.map((fname, i) => (
                    <li key={i}>
                      <button
                        onClick={() => downloadFile(facture.id, facture.annee, fname)}
                        className="text-green-500 underline"
                      >
                        {fname}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </td>
            <td className="p-2 border">
              <button
                onClick={() => handleDelete(facture.id)}
                className="text-red-500 mr-2"
              >
                Supprimer
              </button>
              <button
                onClick={() =>
                  onUpdate(facture.id, {
                    statut: facture.statut === 'Soumis' ? 'Refusé' : 'Soumis'
                  })
                }
                className="text-blue-500"
              >
                {facture.statut === 'Soumis' ? 'Refuser' : 'Soumettre'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default TableFactures;
