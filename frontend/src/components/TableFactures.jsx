/* eslint-disable no-unused-vars */
import React from 'react';

// -----------------------------------
// Composant TableFactures
// -----------------------------------

/**
 * Affiche une liste de factures sous forme de tableau (pour les écrans larges) ou de cartes (pour les écrans mobiles).
 * Permet de télécharger les fichiers associés, de supprimer des factures, et de modifier leur statut.
 * @param {Object} props - Propriétés du composant.
 * @param {Array} props.factures - Liste des factures à afficher.
 * @param {Function} props.onDelete - Fonction appelée pour supprimer une facture (reçoit l'ID de la facture).
 * @param {Function} props.onUpdate - Fonction appelée pour mettre à jour une facture (reçoit l'ID et les données mises à jour).
 * @returns {JSX.Element} Tableau ou cartes représentant les factures.
 */
function TableFactures({ factures, onDelete, onUpdate }) {
  // -----------------------------------
  // Constantes
  // -----------------------------------

  // URL de l'API pour les requêtes
  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  // -----------------------------------
  // Gestion des Événements
  // -----------------------------------

  /**
   * Télécharge le fichier associé à une facture.
   * - Envoie une requête GET à l'API pour récupérer le fichier.
   * - Crée un lien de téléchargement avec le nom de fichier fourni par le serveur ou un nom par défaut.
   * @param {number} id - ID de la facture.
   * @param {string} annee - Année financière de la facture.
   * @returns {Promise<void>}
   */
  const downloadFile = async (id, annee) => {
    try {
      const response = await fetch(`${API_URL}/api/factures/${id}/fichier?annee=${annee}`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      // Nom de fichier par défaut
      let filename = `facture-${id}.pdf`;
      // Utilise le nom fourni par le serveur si disponible
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?($|;)/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      // Création et déclenchement du téléchargement
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
      alert(`Erreur lors du téléchargement du fichier : ${error.message}`);
    }
  };

  /**
   * Gère la suppression d'une facture après confirmation de l'utilisateur.
   * - Affiche une boîte de dialogue pour confirmer la suppression.
   * - Appelle la fonction onDelete si confirmé.
   * @param {number} id - ID de la facture à supprimer.
   */
  const handleDelete = (id) => {
    if (window.confirm('Êtes-vous sûr(e) de vouloir supprimer cette facture ?')) {
      onDelete(id);
    }
  };

  // -----------------------------------
  // Rendu
  // -----------------------------------

  return (
    <>
      {/* Tableau pour les écrans moyens et larges */}
      <table className="w-full text-left border-collapse hidden sm:table">
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
                    className="text-green-500 underline hover:text-green-700"
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
                  className="text-red-500 mr-2 hover:text-red-700"
                >
                  Supprimer
                </button>
                <button
                  onClick={() =>
                    onUpdate(facture.id, {
                      statut: facture.statut === 'Soumis' ? 'Refusé' : 'Soumis',
                    })
                  }
                  className="text-blue-500 hover:text-blue-700"
                >
                  {facture.statut === 'Soumis' ? 'Refuser' : 'Soumettre'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Vue en cartes pour les écrans mobiles */}
      <div className="sm:hidden">
        {factures.map((facture) => (
          <div key={facture.id} className="bg-white p-4 mb-4 rounded-lg shadow border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">Facture #{facture.id}</span>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  facture.statut === 'Soumis' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {facture.statut}
              </span>
            </div>
            <div className="mb-2">
              <span className="font-semibold">Type :</span> {facture.type}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Fournisseur :</span> {facture.fournisseur}
            </div>
            <div className="mb-2">
              <span className="font-semibold">UBR :</span> {facture.ubr}
            </div>
            <div className="mb-2">
              <span className="font-semibold">Montant :</span> {facture.montant}$
            </div>
            {facture.description && (
              <div className="mb-2 text-sm text-gray-700">
                <span className="font-semibold">Description :</span> {facture.description}
              </div>
            )}
            <div className="mb-4">
              <span className="font-semibold">Fichier :</span>{' '}
              {facture.fichier_nom ? (
                <button
                  onClick={() => downloadFile(facture.id, facture.annee)}
                  className="text-green-500 underline hover:text-green-700 text-sm"
                >
                  {facture.fichier_nom}
                </button>
              ) : (
                <span className="text-gray-500 text-sm">—</span>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => handleDelete(facture.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Supprimer
              </button>
              <button
                onClick={() =>
                  onUpdate(facture.id, {
                    statut: facture.statut === 'Soumis' ? 'Refusé' : 'Soumis',
                  })
                }
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                {facture.statut === 'Soumis' ? 'Refuser' : 'Soumettre'}
              </button>
            </div>
          </div>
        ))}
        {factures.length === 0 && (
          <p className="text-center text-gray-500">Aucune facture ajoutée pour cette année.</p>
        )}
      </div>
    </>
  );
}

export default TableFactures;