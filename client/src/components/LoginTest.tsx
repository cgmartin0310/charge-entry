import React, { useState } from 'react';
import axios from 'axios';

const LoginTest: React.FC = () => {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [apiUrl, setApiUrl] = useState(process.env.REACT_APP_API_URL || 'http://localhost:5002');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Test direct login
  const handleDirectLogin = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const fullUrl = `${apiUrl}/api/users/login`;
      console.log('Making direct login request to:', fullUrl);
      
      const response = await axios.post(fullUrl, { email, password });
      
      console.log('Login response:', response.data);
      setResult({
        success: true,
        data: response.data
      });
      
      // Store token in localStorage
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        console.log('Token stored in localStorage');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
      setResult({
        success: false,
        error: err.response?.data || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Test debugging endpoint
  const testDebugEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const fullUrl = `${apiUrl}/api/debug`;
      console.log('Making debug request to:', fullUrl);
      
      const response = await axios.get(fullUrl);
      
      console.log('Debug response:', response.data);
      setResult({
        success: true,
        data: response.data
      });
    } catch (err: any) {
      console.error('Debug error:', err);
      setError(err.message);
      setResult({
        success: false,
        error: err.response?.data || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Test admin reset
  const testAdminReset = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const fullUrl = `${apiUrl}/api/reset-admin-password`;
      console.log('Making admin reset request to:', fullUrl);
      
      const response = await axios.get(fullUrl);
      
      console.log('Admin reset response:', response.data);
      setResult({
        success: true,
        data: response.data
      });
    } catch (err: any) {
      console.error('Admin reset error:', err);
      setError(err.message);
      setResult({
        success: false,
        error: err.response?.data || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // Test login endpoint
  const testLoginEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const fullUrl = `${apiUrl}/api/test-login`;
      console.log('Making test login request to:', fullUrl);
      
      const response = await axios.post(fullUrl, { email, password });
      
      console.log('Test login response:', response.data);
      setResult({
        success: true,
        data: response.data
      });
    } catch (err: any) {
      console.error('Test login error:', err);
      setError(err.message);
      setResult({
        success: false,
        error: err.response?.data || err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Login Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div>
          <label>API URL:</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <label>Email:</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={handleDirectLogin}
          disabled={loading}
          style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Test Direct Login
        </button>
        
        <button 
          onClick={testDebugEndpoint}
          disabled={loading}
          style={{ padding: '10px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Test Debug Endpoint
        </button>
        
        <button 
          onClick={testAdminReset}
          disabled={loading}
          style={{ padding: '10px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Reset Admin Password
        </button>
        
        <button 
          onClick={testLoginEndpoint}
          disabled={loading}
          style={{ padding: '10px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Test Login Endpoint
        </button>
      </div>
      
      {loading && <div>Loading...</div>}
      
      {error && (
        <div style={{ padding: '10px', background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '4px', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {result && (
        <div style={{ marginTop: '20px' }}>
          <h3>Result:</h3>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            border: '1px solid #ddd'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default LoginTest; 