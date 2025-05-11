import React, { useState, useEffect } from 'react';
import './App.css';
import PatientList from './components/PatientList';
import ProcedureList from './components/ProcedureList';
import PayerList from './components/PayerList';
import ProviderList from './components/ProviderList';
import SimpleChargeEntry from './components/SimpleChargeEntry';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import ChargeList from './components/ChargeList';
import api from './utils/api';
import LoginTest from './components/LoginTest';

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  providerId: string | null;
}

function App() {
  const [activeTab, setActiveTab] = useState('quickEntry');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginTest, setShowLoginTest] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check URL for login-test parameter
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('test');
    if (testMode === 'login') {
      setShowLoginTest(true);
      setLoading(false);
      return;
    }

    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    
    if (token) {
      // Verify token and get user info
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await api.get('/users/me/profile');
      setUser(response.data);
      setIsAuthenticated(true);
      setLoading(false);
    } catch (error) {
      // Token is invalid or expired
      localStorage.removeItem('authToken');
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const handleLogin = (token: string, userData: UserInfo) => {
    localStorage.setItem('authToken', token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
    setActiveTab('quickEntry');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false); // Close mobile menu when a nav item is clicked
  };

  if (loading) {
    return <div className="App-loading">Loading...</div>;
  }

  if (showLoginTest) {
    return <LoginTest />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Check if user has access to certain tabs based on role
  const canAccessUserManagement = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const canAccessSettings = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <div className="brand-container">
            <img src="/paragon-logo.png" alt="Paragon Logo" className="brand-logo" />
            <h1>Charge Entry</h1>
          </div>
          <div className="mobile-controls">
            <div className="user-info">
              <span className="username">{user?.username}</span>
              <span className="role-badge">{user?.role}</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
            <button 
              className={`mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
        <nav className={mobileMenuOpen ? 'open' : ''}>
          <button 
            className={activeTab === 'quickEntry' ? 'active' : ''} 
            onClick={() => handleNavClick('quickEntry')}
          >
            Quick Entry
          </button>
          <button 
            className={activeTab === 'patients' ? 'active' : ''} 
            onClick={() => handleNavClick('patients')}
          >
            Patients
          </button>
          <button 
            className={activeTab === 'providers' ? 'active' : ''} 
            onClick={() => handleNavClick('providers')}
          >
            Providers
          </button>
          <button 
            className={activeTab === 'charges' ? 'active' : ''} 
            onClick={() => handleNavClick('charges')}
          >
            Charge History
          </button>
          {canAccessSettings && (
            <>
              <button 
                className={activeTab === 'procedures' ? 'active' : ''} 
                onClick={() => handleNavClick('procedures')}
              >
                Procedures
              </button>
              <button 
                className={activeTab === 'payers' ? 'active' : ''} 
                onClick={() => handleNavClick('payers')}
              >
                Payers
              </button>
            </>
          )}
          {canAccessUserManagement && (
            <button 
              className={activeTab === 'users' ? 'active' : ''} 
              onClick={() => handleNavClick('users')}
            >
              Users
            </button>
          )}
        </nav>
      </header>
      <main>
        {activeTab === 'quickEntry' && <SimpleChargeEntry currentUser={user} />}
        {activeTab === 'patients' && <PatientList />}
        {activeTab === 'charges' && <ChargeList />}
        {activeTab === 'procedures' && canAccessSettings && <ProcedureList />}
        {activeTab === 'payers' && canAccessSettings && <PayerList />}
        {activeTab === 'providers' && <ProviderList />}
        {activeTab === 'users' && canAccessUserManagement && <UserManagement />}
      </main>
    </div>
  );
}

export default App;
