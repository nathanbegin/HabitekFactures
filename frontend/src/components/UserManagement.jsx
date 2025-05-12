// // src/components/UserManagement.jsx
// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// // authorizedFetch est votre wrapper fetch avec JWT
// import { authorizedFetch } from '../services/api';

// // Recevoir authorizedFetch, et optionnellement l'utilisateur courant pour des logiques UI spécifiques
// function UserManagement({ authorizedFetch, /* currentUserId, */ currentUserRole }) {
//     const [users, setUsers] = useState([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState('');
//     const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

//     // Rôles possibles pour le menu déroulant
//     const roles = ['soumetteur', 'gestionnaire', 'approbateur'];

//     useEffect(() => {
//         const fetchUsers = async () => {
//             try {
//                 setLoading(true);
//                  // Utiliser authorizedFetch pour appeler l'API protégée
//                 const response = await authorizedFetch(`${API_URL}/api/users`);
//                 const data = await response.json();
//                 setUsers(data);
//             } catch (err) {
//                  // authorizedFetch gère déjà les erreurs 401/403 et la déconnexion/alert
//                  // Ne faire rien ici si l'erreur est déjà gérée (message incluant "Session expirée" ou "Accès refusé")
//                  if (!err.message.includes("Session expirée") && !err.message.includes("Accès refusé")) {
//                      setError(err.message || "Erreur lors du chargement des utilisateurs.");
//                  } else {
//                      setError("Veuillez vous reconnecter."); // Message plus simple après une déconnexion forcée
//                  }
//                 console.error("Fetch users error:", err);
//             } finally {
//                 setLoading(false);
//             }
//         };
//         // Charger les utilisateurs uniquement si l'utilisateur courant est un gestionnaire (double sécurité UI + Backend)
//          if (currentUserRole === 'gestionnaire') {
//              fetchUsers();
//          } else {
//              setUsers([]); // Vider la liste si le rôle n'est pas gestionnaire
//              setLoading(false);
//              setError("Accès refusé: rôle insuffisant.");
//          }

//     }, [authorizedFetch, API_URL, currentUserRole]); // Dépendances : re-fetch si authorizedFetch change ou si le rôle de l'utilisateur courant change


//     const handleRoleChange = async (userId, newRole) => {
//         // Vérification de rôle UI supplémentaire (le backend fait la vraie vérification)
//          if (currentUserRole !== 'gestionnaire') {
//               alert("Vous n'avez pas le rôle nécessaire pour modifier les rôles.");
//               return;
//           }
//         // Optionnel: Vérification UI pour empêcher un gestionnaire de changer son propre rôle
//         // Si vous passez currentUserId en prop:
//         // if (userId === currentUserId && newRole !== currentUserRole) {
//         //      alert("Vous ne pouvez pas modifier votre propre rôle ici.");
//         //      // Recharger les utilisateurs pour annuler visuellement le changement non autorisé
//         //      const fetchUsers = async () => { ... } // Copier/coller la logique de fetchUsers
//         //      fetchUsers();
//         //      return;
//         // }


//         if (!window.confirm(`Changer le rôle de l'utilisateur ID ${userId} en ${newRole} ?`)) {
//             return;
//         }


//         try {
//              // Utiliser authorizedFetch pour appeler l'API protégée
//             const response = await authorizedFetch(`${API_URL}/api/users/${userId}`, {
//                 method: 'PUT',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ role: newRole }),
//             });

//              if (!response.ok) {
//                   const errorText = await response.text();
//                   let errorMessage = "Échec de la mise à jour du rôle.";
//                   try {
//                       const errorData = JSON.parse(errorText);
//                       errorMessage = errorData.error || errorMessage;
//                   } catch (parseError) {
//                       errorMessage = `Erreur HTTP ${response.status}: ${errorText}`;
//                   }
//                  throw new Error(errorMessage);
//              }

//             // Mettre à jour l'état local des utilisateurs avec le rôle mis à jour
//             setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
//             alert("Rôle mis à jour avec succès.");

//         } catch (err) {
//             setError(err.message || "Erreur lors de la mise à jour du rôle.");
//             console.error("Update role error:", err);
//              // Recharger les utilisateurs pour revenir à l'état correct en cas d'erreur API (sauf 401/403 géré par authorizedFetch)
//               if (!err.message.includes("Session expirée") && !err.message.includes("Accès refusé")) {
//                 const fetchUsers = async () => { /* ... */ } // Copier/coller la logique de fetchUsers
//                 fetchUsers();
//             }
//         }
//     };

//     if (loading) return <p>Chargement des utilisateurs...</p>;
//     if (error) return <p className="text-red-500">Erreur: {error}</p>;

//     // N'afficher le tableau que si le rôle est gestionnaire et qu'il n'y a pas d'erreur liée au rôle
//     if (currentUserRole !== 'gestionnaire') {
//         return <p className="text-center text-red-500">Accès refusé à la gestion des utilisateurs.</p>;
//     }


//     return (
//         <div className="space-y-6">
//             <h2 className="text-2xl font-bold text-blue-600">Gestion des Utilisateurs</h2>
//              {users.length === 0 ? (
//                  <p>Aucun utilisateur trouvé.</p>
//              ) : (
//                  <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-md"> {/* Ajouter conteneur scrollable */}
//                      <table className="w-full text-left border-collapse">
//                          <thead>
//                              <tr className="bg-gray-100">
//                                  <th className="p-2 border">ID</th>
//                                  <th className="p-2 border">Nom d'utilisateur</th>
//                                  <th className="p-2 border">Courriel</th>
//                                  <th className="p-2 border">Rôle</th>
//                                  <th className="p-2 border">Actions</th> {/* Colonne pour les actions comme modifier le rôle */}
//                              </tr>
//                          </thead>
//                          <tbody>
//                              {users.map(user => (
//                                  <tr key={user.id} className="border-t">
//                                      <td className="p-2 border">{user.id}</td>
//                                      <td className="p-2 border">{user.username}</td>
//                                      <td className="p-2 border">{user.email}</td>
//                                      <td className="p-2 border">
//                                          {/* Menu déroulant pour changer de rôle - Visible uniquement si l'utilisateur courant est gestionnaire (déjà géré par le rendu du composant) */}
//                                          {/* Désactiver le select si l'utilisateur est l'utilisateur courant */}
//                                          <select
//                                              value={user.role}
//                                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
//                                              className="p-1 border rounded"
//                                              // Désactiver si l'utilisateur listé est l'utilisateur courant
//                                              // Pour cela, MainLayout doit passer l'ID de l'utilisateur courant (userId)
//                                              // disabled={user.id === currentUserId}
//                                               // Temporairement, désactiver la modification du rôle 'gestionnaire' si l'utilisateur courant est gestionnaire (logique simple)
//                                               // Une meilleure logique backend empêche le gestionnaire de se downgrader.
//                                               // Désactiver le select si l'utilisateur listé est le gestionnaire courant
//                                               disabled={false} // Remplacez par la logique correcte si vous passez currentUserId
//                                          >
//                                              {roles.map(role => (
//                                                  <option key={role} value={role}>
//                                                      {role.charAt(0).toUpperCase() + role.slice(1)}
//                                                  </option>
//                                              ))}
//                                          </select>
//                                      </td>
//                                      <td className="p-2 border">
//                                          {/* Ajoutez d'autres actions ici si nécessaire (ex: supprimer utilisateur - avec confirmation et restrictions) */}
//                                           {/* Exemple Bouton Supprimer (désactivé si utilisateur courant) */}
//                                          {/*
//                                          {user.id !== currentUserId && ( // Ne pas permettre de supprimer l'utilisateur courant
//                                               <button
//                                                   onClick={() => handleDeleteUser(user.id)} // Implémenter handleDeleteUser
//                                                   className="text-red-500 hover:text-red-700 text-sm"
//                                               >
//                                                   Supprimer
//                                               </button>
//                                          )}
//                                          */}
//                                      </td>
//                                  </tr>
//                              ))}
//                          </tbody>
//                      </table>
//                  </div>
//              )}
//         </div>
//     );
// }

// export default UserManagement;


// src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


/**
 * Composant pour gérer les utilisateurs (CRUD de rôles et suppression).
 * Requiert :
 *  - authorizedFetch : wrapper fetch avec JWT dans les headers
 *  - currentUserRole : rôle de l'utilisateur courant ('gestionnaire')
 *  - (optionnel) currentUserId pour empêcher la suppression de soi-même
 */
function UserManagement({ authorizedFetch, currentUserRole /*, currentUserId*/ }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
  const roles = ['soumetteur', 'gestionnaire', 'approbateur'];

  // Charger les utilisateurs au montage si rôle autorisé
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await authorizedFetch(`${API_URL}/api/users`);
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        if (err.message.includes("Session expirée") || err.message.includes("Accès refusé")) {
          setError("Veuillez vous reconnecter.");
        } else {
          setError(err.message || "Erreur lors du chargement des utilisateurs.");
        }
        console.error("Fetch users error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (currentUserRole === 'gestionnaire') {
      fetchUsers();
    } else {
      setUsers([]);
      setLoading(false);
      setError("Accès refusé: rôle insuffisant.");
    }
  }, [authorizedFetch, API_URL, currentUserRole]);

  // Mettre à jour un rôle utilisateur
  const handleRoleChange = async (userId, newRole) => {
    if (currentUserRole !== 'gestionnaire') return;
    if (!window.confirm(`Changer le rôle de l'utilisateur ID ${userId} en ${newRole} ?`)) return;
    try {
      const response = await authorizedFetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      alert("Rôle mis à jour avec succès.");
    } catch (err) {
      setError(err.message || "Erreur lors de la mise à jour du rôle.");
      console.error("Update role error:", err);
      // Re-fetch en cas d'erreur non-autorisation
      if (!err.message.includes("Session expirée") && !err.message.includes("Accès refusé")) {
        try {
          const resp = await authorizedFetch(`${API_URL}/api/users`);
          if (resp.ok) setUsers(await resp.json());
        } catch {}
      }
    }
  };

  // Supprimer un utilisateur
  const handleDeleteUser = async (userId) => {
    if (currentUserRole !== 'gestionnaire') return;
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      const response = await authorizedFetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      setUsers(users.filter(u => u.id !== userId));
      alert("Utilisateur supprimé.");
    } catch (err) {
      console.error("Delete user error:", err);
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  if (loading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p className="text-red-500">Erreur: {error}</p>;
  if (currentUserRole !== 'gestionnaire') {
    return <p className="text-center text-red-500">Accès refusé à la gestion des utilisateurs.</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-blue-600">Gestion des Utilisateurs</h2>
      {users.length === 0 ? (
        <p>Aucun utilisateur trouvé.</p>
      ) : (
        <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-md">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Nom d'utilisateur</th>
                <th className="p-2 border">Courriel</th>
                <th className="p-2 border">Rôle</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t">
                  <td className="p-2 border">{user.id}</td>
                  <td className="p-2 border">{user.username}</td>
                  <td className="p-2 border">{user.email}</td>
                  <td className="p-2 border">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="p-1 border rounded"
                      // disabled={user.id === currentUserId}
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      // disabled={user.id === currentUserId}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UserManagement;

