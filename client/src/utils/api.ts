import axios from 'axios';

// Use environment variable if available, otherwise fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';
console.log('Base API_URL is configured as:', API_URL);

// Create an axios instance with base URL
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: false,
  timeout: 30000
});

// Add a request interceptor to include the auth token in all requests
api.interceptors.request.use(
  (config) => {
    console.log('Making request to:', 
      (config.baseURL || '') + (config.url || ''));
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Authorization header set');
    }
    return config;
  },
  (error) => {
    console.error('Request error interceptor:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging and token handling
api.interceptors.response.use(
  (response) => {
    console.log('Response received:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url || ''
    });
    return response;
  },
  (error) => {
    console.error('Response error interceptor:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // Handle token errors
    if (error.response?.status === 401 && 
        (error.response?.data?.message === 'Invalid token' || 
         error.response?.data?.message === 'Authentication required')) {
      console.warn('Auth token appears to be invalid or expired. Redirecting to login...');
      // Clear the invalid token
      localStorage.removeItem('authToken');
      
      // Notify user
      alert('Your session has expired. Please log in again.');
      
      // Redirect to login page
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

export default api; 