import axios from 'axios';

// Use environment variable if available, otherwise fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

// Create an axios instance with base URL
const api = axios.create({
  baseURL: API_URL
});

// Add a request interceptor to include the auth token in all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api; 