import React, { useState, useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import MainLayout from './components/MainLayout'; // Nouveau composant pour le contenu principal
import { io } from 'socket.io-client'; // Importez io ici pour la connexion SocketIO globale

// Configuration des URLs pour l'API et SocketIO
const API_URL = import.meta.env.VITE_API_URL || 'https://storage.nathanbegin.xyz:4343';
const SOCKET_URL = `${API_URL.replace('https', 'wss')}`; // Utilisez wss pour HTTPS

function App() {
  
  const [userToken, setUserToken]   = useState(savedToken);
  const [userRole,    setUserRole]    = useState(savedRole);
  const [isLoggedIn,  setIsLoggedIn]  = useState(!!savedToken);
  const [clientCount, setClientCount] = useState(0); // Déplacé ici pour être global

  const savedToken = sessionStorage.getItem('habitek_auth_token');
  const savedRole  = sessionStorage.getItem('habitek_user_role');

  
  

  // --- Connexion SocketIO globale (gérée ici car l'état d'auth est ici) ---
   useEffect(() => {
     if (!isLoggedIn || !userToken) {
        // Déconnecter l'ancienne socket si elle existe et que l'utilisateur est déconnecté
        if (window.socket) { // Vérifier si une socket globale existe
            window.socket.disconnect();
            window.socket = null;
        }
        console.log("SocketIO: User not logged in or token missing. Not connecting.");
        setClientCount(0); // Réinitialiser le compteur si déconnecté
        return; // Ne pas connecter si pas connecté
     }

     // Établir la connexion SocketIO, en passant le token pour l'authentification
     const socket = io(SOCKET_URL, {
         transports: ['websocket'],
         auth: {
             token: userToken // Envoyer le token via l'option auth
         }
     });

     window.socket = socket; // Stocker la socket dans une variable globale si nécessaire, ou la passer via Context API


     socket.on('connect', () => console.log('SocketIO connected'));
     socket.on('disconnect', () => {
          console.log('SocketIO disconnected');
          setClientCount(0); // Réinitialiser le compteur à la déconnexion
     });
     socket.on('client_count', setClientCount);

     // Ajouter ici les listeners SocketIO globaux si nécessaire
     // Par exemple, pour des notifications globales quel que soit l'écran
     // Les événements spécifiques aux données (factures, budget) seront probablement gérés dans MainLayout ou ses enfants

     return () => {
         // Nettoyage : déconnecter la socket lors du démontage ou de la déconnexion
         if (window.socket) {
             window.socket.disconnect();
             window.socket = null;
         }
         console.log('SocketIO disconnected on cleanup');
     }
   }, [isLoggedIn, userToken]); // Dépend de isLoggedIn et userToken


  // --- Gestion de l'Authentification et sessionStorage ---
  useEffect(() => {
    // Charger l'état depuis sessionStorage au montage
    const storedToken = sessionStorage.getItem('habitek_auth_token');
    const storedRole = sessionStorage.getItem('habitek_user_role');
     // Optionnel: récupérer l'ID utilisateur aussi si nécessaire
    // const storedUserId = sessionStorage.getItem('habitek_user_id');


    if (storedToken && storedRole) { // Vérifier aussi la présence du rôle
      setUserToken(storedToken);
      setUserRole(storedRole);
      // Optionnel: setUserId(storedUserId);
      setIsLoggedIn(true);
      // Optionnel: Valider le token côté backend ici si nécessaire pour s'assurer qu'il est toujours actif
    }
  }, []);

  // Fonction appelée par LoginPage en cas de succès
  const handleLoginSuccess = (token, userId, userRole) => {
    // Stocker l'état dans sessionStorage
    sessionStorage.setItem('habitek_auth_token', token);
    sessionStorage.setItem('habitek_user_role', userRole);
     // Optionnel: sessionStorage.setItem('habitek_user_id', userId);
    setUserToken(token);
    setUserRole(userRole);
    // Optionnel: setUserId(userId);
    setIsLoggedIn(true);
    // Note: La redirection est gérée par LoginPage
  };

  // Fonction de déconnexion
  const handleLogout = () => {
    // Supprimer l'état de sessionStorage
    sessionStorage.removeItem('habitek_auth_token');
    sessionStorage.removeItem('habitek_user_role');
    // Optionnel: sessionStorage.removeItem('habitek_user_id');
    setUserToken(null);
    setUserRole(null);
    // Optionnel: setUserId(null);
    setIsLoggedIn(false);
    // Note: La redirection est gérée par la Route Protégée (Navigate)
    // Les états des données (factures, budget) doivent être effacés dans MainLayout ou les composants concernés
  };

   // Fonction utilitaire pour fetch avec le token et gestion des erreurs d'auth
   const authorizedFetch = async (url, options = {}) => {
       if (!userToken) {
           console.error("authorizedFetch: Tentative d'appel API sans token.");
           // L'utilisateur devrait déjà être redirigé par ProtectedRoute, mais sécurité supplémentaire
           handleLogout();
           throw new Error("Non authentifié. Redirection vers la connexion.");
       }
       const headers = {
           ...options.headers,
           'Authorization': `Bearer ${userToken}`
       };
       const response = await fetch(url, { ...options, headers });

       // Gérer spécifiquement les erreurs d'authentification/autorisation
       if (response.status === 401 || response.status === 403) {
           console.error(`authorizedFetch: API ${response.status} Unauthorized/Forbidden.`);
            let errorMessage = "Session expirée ou accès refusé.";
           try {
               const errorData = await response.json();
               errorMessage = errorData.error || errorMessage;
           } catch (parseError) { /* ignore parse error */ }

           alert(errorMessage); // Informer l'utilisateur
           handleLogout(); // Forcer la déconnexion
           throw new Error(errorMessage); // Propager l'erreur

       }

       // Pour les autres codes d'état (2xx, 400, 404, 500...), les fonctions appelantes doivent les gérer
       return response;
    };

  return (
    <BrowserRouter> {/* Utilisez BrowserRouter ici */}
      <Routes>
        {/* Route de connexion */}
        <Route path="/" element={
          isLoggedIn ? (
            <Navigate to="/dashboard" replace /> // Si connecté, rediriger vers le tableau de bord
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} /> // Sinon, afficher la page de connexion
          )
        } />

        {/* Route d'enregistrement */}
        <Route path="/register" element={
          isLoggedIn ? (
             <Navigate to="/dashboard" replace /> // Si connecté, rediriger vers le tableau de bord
           ) : (
             <RegisterPage /> // Sinon, afficher la page d'enregistrement
           )
        } />

        {/* Routes protégées nécessitant une authentification */}
        <Route
          path="/dashboard/*" // Utilisez /* pour que toutes les sous-routes de /dashboard soient gérées par MainLayout
          element={
            isLoggedIn ? (
              // Passer les props nécessaires à MainLayout
              <MainLayout
                 userToken={userToken}
                 userRole={userRole}
                 // userId={userId} // Passer l'ID si stocké et nécessaire
                 handleLogout={handleLogout}
                 authorizedFetch={authorizedFetch} // Passer la fonction fetch sécurisée
                 clientCount={clientCount} // Passer le clientCount pour l'en-tête
                 // ... autres props globales si nécessaire
               />
            ) : (
              <Navigate to="/" replace state={{ from: location.pathname }} /> // Si non connecté, rediriger vers la connexion
            )
          }
        />

         {/* Redirection par défaut pour toute autre route non définie */}
         {/* Ceci catchera les URLs qui ne sont ni '/', '/register', ni '/dashboard/*' */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
