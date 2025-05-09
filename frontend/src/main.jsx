import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

const container = document.getElementById('root'); // Obtenez l'élément racine
const root = ReactDOM.createRoot(container); // Créez une racine React 18+

root.render(
  <React.StrictMode>
    {/* BrowserRouter sera maintenant à l'intérieur de App.jsx */}
    <App />
  </React.StrictMode>
);