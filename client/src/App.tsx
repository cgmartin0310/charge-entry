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

  useEffect(() => {
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

  if (loading) {
    return <div className="App-loading">Loading...</div>;
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
          <h1>Healthcare Charge Entry</h1>
          <div className="user-info">
            <span className="username">{user?.username}</span>
            <span className="role-badge">{user?.role}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <nav>
          <button 
            className={activeTab === 'quickEntry' ? 'active' : ''} 
            onClick={() => setActiveTab('quickEntry')}
          >
            Quick Entry
          </button>
          <button 
            className={activeTab === 'patients' ? 'active' : ''} 
            onClick={() => setActiveTab('patients')}
          >
            Patients
          </button>
          <button 
            className={activeTab === 'providers' ? 'active' : ''} 
            onClick={() => setActiveTab('providers')}
          >
            Providers
          </button>
          <button 
            className={activeTab === 'charges' ? 'active' : ''} 
            onClick={() => setActiveTab('charges')}
          >
            Charge History
          </button>
          {canAccessSettings && (
            <>
              <button 
                className={activeTab === 'procedures' ? 'active' : ''} 
                onClick={() => setActiveTab('procedures')}
              >
                Procedures
              </button>
              <button 
                className={activeTab === 'payers' ? 'active' : ''} 
                onClick={() => setActiveTab('payers')}
              >
                Payers
              </button>
            </>
          )}
          {canAccessUserManagement && (
            <button 
              className={activeTab === 'users' ? 'active' : ''} 
              onClick={() => setActiveTab('users')}
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
