// TableFactures.jsx
import React from 'react';

function TableFactures({ factures, onDelete, onUpdate }) {
  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  // Télécharge le fichier associé à une facture
  const downloadFile = async (id, annee) => {
    try {
      const response = await fetch(
        `${API_URL}/api/factures/${id}/fichier?annee=${annee}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      // Nom par défaut
      let filename = `facture-${id}.pdf`;
      // Si le header fournit un nom, on l'utilise
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?($|;)/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      // Création du lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors du téléchargement du fichier :', error);
    }
  };

  // Confirmation avant suppression
  const handleDelete = (id) => {
    if (window.confirm("Êtes-vous sûr(e) de vouloir supprimer cette facture ?")) {
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
          <th className="p-2 border">Fichier</th>
          <th className="p-2 border">Actions</th>
        </tr>
      </thead>
      <tbody>
        {factures.map((facture, index) => (
          <tr key={facture.id} className="border-t">
            <td className="p-2 border">{index + 1}</td>
            <td className="p-2 border">{facture.type}</td>
            <td className="p-2 border">{facture.ubr}</td>
            <td className="p-2 border">{facture.fournisseur}</td>
            <td className="p-2 border">{facture.montant}$</td>
            <td className="p-2 border">{facture.statut}</td>
            <td className="p-2 border">
              {facture.fichier_nom ? (
                <button
                  onClick={() => downloadFile(facture.id, facture.annee)}
                  className="text-green-500 underline"
                >
                  {facture.fichier_nom}
                </button>
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
