// src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


function UserManagement({ authorizedFetch, currentUserRole, currentUserId }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newUserData, setNewUserData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'soumetteur'
    });
    const [registerError, setRegisterError] = useState('');
    const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
    const roles = ['soumetteur', 'gestionnaire', 'approbateur'];

    // Charge la liste des utilisateurs
    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await authorizedFetch(`${API_URL}/api/users`);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            if (!err.message.includes('Session expirée') && !err.message.includes('Accès refusé')) {
                setError(err.message || 'Erreur lors du chargement des utilisateurs.');
            } else {
                setError('Veuillez vous reconnecter.');
            }
            console.error('Fetch users error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUserRole === 'gestionnaire') {
            fetchUsers();
        } else {
            setUsers([]);
            setLoading(false);
            setError('Accès refusé: rôle insuffisant.');
        }
    }, [authorizedFetch, API_URL, currentUserRole]);

    // Création d'un nouvel utilisateur
    const handleNewUserChange = e => {
        const { name, value } = e.target;
        setNewUserData(prev => ({ ...prev, [name]: value }));
    };

    const handleNewUserSubmit = async e => {
        e.preventDefault();
        if (currentUserRole !== 'gestionnaire') {
            alert("Vous n'avez pas le rôle nécessaire pour créer un utilisateur.");
            return;
        }
        const { username, email, password, role } = newUserData;
        if (!username || !email || !password) {
            setRegisterError('Tous les champs sont requis.');
            return;
        }
        try {
            setRegisterError('');
            // Enregistrement initial
            let res = await authorizedFetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const newUser = await res.json();
            // Mise à jour du rôle si différent
            if (role && role !== newUser.role) {
                let upd = await authorizedFetch(`${API_URL}/api/users/${newUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role })
                });
                if (!upd.ok) console.warn('Erreur mise à jour rôle:', await upd.text());
            }
            alert('Utilisateur créé avec succès.');
            setNewUserData({ username: '', email: '', password: '', role: 'soumetteur' });
            fetchUsers();
        } catch (err) {
            setRegisterError(err.message || 'Erreur lors de la création.');
            console.error('Register user error:', err);
        }
    };

    // Modification du rôle
    const handleRoleChange = async (userId, newRole) => {
        if (currentUserRole !== 'gestionnaire') {
            alert("Vous n'avez pas le rôle nécessaire pour modifier les rôles.");
            return;
        }
        if (userId === currentUserId) {
            alert("Vous ne pouvez pas modifier votre propre rôle ici.");
            return;
        }
        if (!window.confirm(`Changer le rôle de l'utilisateur ID ${userId} en ${newRole} ?`)) return;
        try {
            const response = await authorizedFetch(`${API_URL}/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            if (!response.ok) throw new Error(await response.text());
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            alert('Rôle mis à jour.');
        } catch (err) {
            setError(err.message || 'Erreur lors de la mise à jour du rôle.');
            console.error('Update role error:', err);
            fetchUsers();
        }
    };

    // Suppression d'un utilisateur
    const handleDeleteUser = async userId => {
        if (currentUserRole !== 'gestionnaire') {
            alert("Vous n'avez pas le rôle nécessaire pour supprimer un utilisateur.");
            return;
        }
        if (userId === currentUserId) {
            alert("Vous ne pouvez pas supprimer votre propre compte.");
            return;
        }
        if (!window.confirm(`Supprimer l'utilisateur ID ${userId} ? Cette action est irréversible.`)) return;
        try {
            const res = await authorizedFetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            alert('Utilisateur supprimé.');
            fetchUsers();
        } catch (err) {
            setError(err.message || 'Erreur lors de la suppression.');
            console.error('Delete user error:', err);
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

            {/* Formulaire création utilisateur */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold mb-4">Ajouter un nouvel utilisateur</h3>
                {registerError && <p className="text-red-500 mb-2">{registerError}</p>}
                <form onSubmit={handleNewUserSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nom d'utilisateur</label>
                        <input name="username" value={newUserData.username} onChange={handleNewUserChange} className="mt-1 w-full p-2 border rounded" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Courriel</label>
                        <input type="email" name="email" value={newUserData.email} onChange={handleNewUserChange} className="mt-1 w-full p-2 border rounded" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                        <input type="password" name="password" value={newUserData.password} onChange={handleNewUserChange} className="mt-1 w-full p-2 border rounded" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Rôle</label>
                        <select name="role" value={newUserData.role} onChange={handleNewUserChange} className="mt-1 w-full p-2 border rounded">
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Créer</button>
                </form>
            </div>

            {/* Tableau utilisateurs */}
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
                                    <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)} className="p-1 border rounded" disabled={user.id === currentUserId}>
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </td>
                                <td className="p-2 border">
                                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700 text-sm" disabled={user.id === currentUserId}>
                                        Supprimer
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default UserManagement;
