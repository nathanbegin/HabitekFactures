// src/components/RegisterPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Importez Link et useNavigate

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate(); // Hook pour la navigation

  const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
     if (password.length < 8) { // Exemple de validation basique
         setError('Le mot de passe doit contenir au moins 8 caractères.');
         return;
     }


    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
         const errorText = await response.text();
         let errorMessage = 'Échec de la création de compte.';
         try {
             const errorData = JSON.parse(errorText);
             errorMessage = errorData.error || errorMessage;
         } catch (parseError) {
             errorMessage = `Erreur HTTP ${response.status}: ${errorText}`;
         }
         throw new Error(errorMessage);
      }

      // Si succès
      setSuccess('Compte créé avec succès. Redirection vers la page de connexion...');
      // Rediriger automatiquement vers la page de login après un délai
      setTimeout(() => navigate('/', { replace: true }), 3000); // Redirige vers la route '/' (login)

    } catch (err) {
      console.error('Erreur de création de compte:', err);
      setError(err.message || 'Erreur lors de la création du compte.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center mb-6">Créer un compte</h2>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && <p className="text-green-500 text-center mb-4">{success}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="username">
              Nom d'utilisateur
            </label>
            <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 w-full p-2 border rounded" required autoComplete="username" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Courriel
            </label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full p-2 border rounded" required autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Mot de passe
            </label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full p-2 border rounded" required autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="confirmPassword">
              Confirmer le mot de passe
            </label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full p-2 border rounded" required autoComplete="new-password" />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
            Créer le compte
          </button>
        </form>
        {/* Lien vers la page de connexion */}
        {!success && ( // Afficher le lien vers login uniquement si pas de message de succès (redirection auto)
            <p className="text-center mt-4 text-sm text-gray-600">
              Déjà un compte ?{' '}
              <Link to="/" className="text-blue-500 hover:underline">
                 Connectez-vous
              </Link>
            </p>
        )}
      </div>
    </div>
  );
}

export default RegisterPage;