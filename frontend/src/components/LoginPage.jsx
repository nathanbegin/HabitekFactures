// // src/components/LoginPage.jsx
// import React, { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom'; // Importez Link et useNavigate

// function LoginPage({ onLoginSuccess }) { // onLoginSuccess sera passé depuis App.jsx
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [error, setError] = useState('');
//   const navigate = useNavigate(); // Hook pour la navigation

//   const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError(''); // Clear previous errors

//     try {
//       const response = await fetch(`${API_URL}/api/login`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ username, password }),
//       });

//       if (!response.ok) {
//         // Tenter de lire l'erreur du backend si disponible
//         const errorText = await response.text();
//         let errorMessage = 'Échec de la connexion';
//         try {
//             const errorData = JSON.parse(errorText);
//             errorMessage = errorData.error || errorMessage;
//         } catch (parseError) {
//             // Si la réponse n'est pas du JSON, utiliser le texte brut
//              errorMessage = `Erreur HTTP ${response.status}: ${errorText}`;
//         }
//         throw new Error(errorMessage);
//       }

//       const data = await response.json();
//       // Appelle la fonction du parent pour gérer la connexion réussie (stocker token, rôle, rediriger)
//       onLoginSuccess(data.token, data.user_id, data.user_role); // Assurez-vous de passer le rôle

//       navigate('/dashboard'); // Rediriger vers la page principale après succès

//     } catch (err) {
//       console.error('Erreur de connexion:', err);
//       setError(err.message || 'Erreur lors de la connexion.');
//     }
//   };

//   return (
//     <div className="flex items-center justify-center min-h-screen bg-gray-100">
//       <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
//         <h2 className="text-2xl font-bold text-center mb-6">Connexion</h2>
//         {error && <p className="text-red-500 text-center mb-4">{error}</p>}
//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-gray-700" htmlFor="username">
//               Nom d'utilisateur
//             </label>
//             <input
//               type="text"
//               id="username"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               className="mt-1 w-full p-2 border rounded"
//               required
//               autoComplete="username" // Bonne pratique pour les formulaires de connexion
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-gray-700" htmlFor="password">
//               Mot de passe
//             </label>
//             <input
//               type="password"
//               id="password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="mt-1 w-full p-2 border rounded"
//               required
//               autoComplete="current-password" // Bonne pratique
//             />
//           </div>
//           <button
//             type="submit"
//             className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
//           >
//             Se connecter
//           </button>
//         </form>
//         {/* Lien vers la page de création de compte */}
//         <p className="text-center mt-4 text-sm text-gray-600">
//           Pas encore de compte ?{' '}
//           <Link to="/register" className="text-blue-500 hover:underline">
//             Créer un compte
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }

// export default LoginPage;

// src/components/LoginPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Logo Habitek
import logo from '../Logo Habitek_WEB_Transparent-06.png';

// URL de l'API
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const navigate = useNavigate();

  // Mettre à jour le titre de la page
  useEffect(() => {
    document.title = 'Habitek | Page de connexion';
  }, []);

  // Au montage, on ping le backend
  useEffect(() => {
    async function pingBackend() {
      try {
        // Appel d'un endpoint public
        const res = await fetch(`${API_URL}/`);
        setBackendStatus(res.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    }
    pingBackend();
  }, []);

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
    <div className="relative max-w-md mx-auto mt-10 p-6 pb-16 bg-white rounded shadow">
      {/* Logo et titre */}
      <img
        src={logo}
        alt="Habitek Logo"
        className="h-12 mx-auto mb-4"
      />
      <h1 className="text-2xl font-bold text-center mb-6">
        Habitek | Page de connexion
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nom d’utilisateur</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={backendStatus !== 'online'}
        >
          Se connecter
        </button>
      </form>

      {error && <p className="mt-4 text-red-500 text-center">{error}</p>}

      {/* Statut du backend en bas à droite */}
      <div className="absolute bottom-4 right-4 text-sm bg-white px-2 rounded">
        Statut serveur:{' '}
        {backendStatus === 'checking' && <span>…</span>}
        {backendStatus === 'online'   && <span className="text-green-600">🟢 En ligne</span>}
        {backendStatus === 'offline'  && <span className="text-red-600">🔴 Hors ligne</span>}
      </div>
    </div>
  );
}

export default LoginPage;
