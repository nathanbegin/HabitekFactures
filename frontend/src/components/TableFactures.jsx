function TableFactures({ factures, onDelete, onUpdate }) {
  const API_URL = import.meta.env.VITE_API_URL || 'https://habitekfactures.onrender.com/';

  const downloadFile = async (id, annee) => {
    try {
      const response = await fetch(`${API_URL}/api/factures/${id}/fichier?annee=${annee}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`; // Ajustez selon le type de fichier
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erreur lors du téléchargement du fichier:', error);
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
          <th className="p-2 border">Action</th>
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
              <button onClick={() => downloadFile(facture.id, facture.annee)} className="text-green-500 mr-2">Télécharger</button>
              <button onClick={() => onDelete(facture.id)} className="text-red-500 mr-2">Supprimer</button>
              <button onClick={() => onUpdate(facture.id, { statut: facture.statut === 'Soumis' ? 'Refusé' : 'Soumis' })} className="text-blue-500">
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