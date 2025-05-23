// src/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Assurez-vous que le chemin d'accès au logo est correct par rapport à ce fichier.
// Si 'src' est la racine de votre projet et ce fichier est dans 'src/components',
// alors '..' remonte d'un dossier pour accéder à 'src'.
import Logo from '../Logo Habitek_WEB_Transparent-06.png'; 

// URL de votre API
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const navigate = useNavigate();

  // Mettre à jour le titre de la page
  useEffect(() => {
    document.title = 'Habitek | Page de connexion';
  }, []);

  // Au montage, on ping le back-end
  useEffect(() => {
    let isMounted = true
  
    async function pingBackend() {
      try {
        const res = await fetch(`${API_URL}/api/users`)
        if (isMounted) setBackendStatus('online')
      } catch {
        if (isMounted) setBackendStatus('offline')
      }
    }
  
    // Première vérification immédiate
    pingBackend()
    // Puis toutes les 5 secondes
    const interval = setInterval(pingBackend, 5000)
  
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg || `Erreur ${res.status}`);
      }

      const { token, user_id, user_role } = await res.json();
      onLoginSuccess(token, user_id, user_role);
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e.message || 'Erreur de connexion.');
    }
  };

 

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-xl space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src={Logo} 
            alt="Habitek Logo" 
            className="h-24 sm:h-32 object-contain" // Ajustez la hauteur selon vos besoins
          />
        </div>

        {/* Titre */}
        <h2 className="text-3xl font-extrabold text-gray-900 text-center">
          Habitek | Page de connexion
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Nom d’utilisateur
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={backendStatus !== 'online'}
          >
            Se connecter
          </button>
          {/* Bouton S'inscrire */}
          <div className="mt-4 text-center">
            <Link to="/register" className="text-blue-600 hover:underline">
              S'inscrire
            </Link>
          </div>
        </form>

        {error && <p className="mt-4 text-red-500 text-center text-sm">{error}</p>}

        {/* Statut du back-end : Repositionné pour être sous le formulaire et les messages d'erreur */}
        <div className="mt-6 text-center text-sm text-gray-600">
          Statut serveur:{' '}
          {backendStatus === 'checking' && <span className="text-gray-500 font-semibold">… Vérification en cours</span>}
          {backendStatus === 'online'   && <span className="text-green-600 font-semibold">🟢 En ligne</span>}
          {backendStatus === 'offline'  && <span className="text-red-600 font-semibold">🔴 Hors ligne</span>}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;