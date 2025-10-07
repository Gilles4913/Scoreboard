import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthPage } from './pages/AuthPage';
import { RedirectPage } from './pages/RedirectPage';
import './theme.css';

console.log('🚀 Operator - Démarrage de l\'application');

function App() {
  const [user, setUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuthSuccess = (userData: any, superAdminStatus: boolean, userOrganizations: any[]) => {
    console.log('✅ Auth - Succès, redirection vers:', superAdminStatus ? 'Super Admin' : 'Operator');
    setUser(userData);
    setIsSuperAdmin(superAdminStatus);
    setOrganizations(userOrganizations);
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    console.log('🔐 Auth - Déconnexion');
    setUser(null);
    setIsSuperAdmin(false);
    setOrganizations([]);
    setIsAuthenticated(false);
  };

  // Si l'utilisateur est authentifié, afficher la page de redirection
  if (isAuthenticated && user) {
    return (
      <RedirectPage
        user={user}
        isSuperAdmin={isSuperAdmin}
        organizations={organizations}
      />
    );
  }

  // Sinon, afficher la page d'authentification
  return (
    <AuthPage
      onAuthSuccess={handleAuthSuccess}
    />
  );
}

console.log('🎯 Main - Création du root React');
const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App/></React.StrictMode>);