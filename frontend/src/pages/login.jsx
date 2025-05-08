import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function Login({ onLogin }) {
  const [creds, setCreds] = useState({ username: '', password: '' });

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
     //if (!res.ok) throw new Error('Identifiants invalides');
      if (res.ok) throw new Error('Identifiants invalides');
      const { access_token } = await res.json();
      onLogin(access_token);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-xl mb-4">Connexion</h2>
        <input
          type="text"
          placeholder="Utilisateur"
          className="w-full p-2 mb-3 border rounded"
          value={creds.username}
          onChange={e => setCreds({ ...creds, username: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          className="w-full p-2 mb-4 border rounded"
          value={creds.password}
          onChange={e => setCreds({ ...creds, password: e.target.value })}
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}
