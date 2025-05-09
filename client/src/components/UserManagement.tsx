import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin: string | null;
  provider: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
}

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
}

const API_URL = 'http://localhost:5002/api';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    role: 'PROVIDER',
    providerId: '',
    active: true
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchProviders();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviders(response.data);
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Don't send password if empty on edit
      const submitData: Record<string, any> = { ...formData };
      if (!isCreating && !submitData.password) {
        delete submitData.password;
      }

      if (isCreating) {
        await axios.post(`${API_URL}/users/register`, submitData, { headers });
      } else if (editingUser) {
        await axios.put(`${API_URL}/users/${editingUser.id}`, submitData, { headers });
      }
      
      fetchUsers();
      handleClose();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save user');
      console.error('Error saving user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsers(users.filter(user => user.id !== userId));
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user');
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setIsCreating(false);
    setEditingUser(user);
    setFormData({
      email: user.email,
      username: user.username,
      password: '', // Don't show password
      role: user.role,
      providerId: user.provider?.id || '',
      active: user.active
    });
    setShowModal(true);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingUser(null);
    setFormData({
      email: '',
      username: '',
      password: '',
      role: 'PROVIDER',
      providerId: '',
      active: true
    });
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingUser(null);
    setError(null);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'super-admin-badge';
      case 'ADMIN':
        return 'admin-badge';
      case 'PROVIDER':
        return 'provider-badge';
      default:
        return '';
    }
  };

  if (loading && users.length === 0) {
    return <div className="loading-indicator">Loading users...</div>;
  }

  return (
    <div className="user-management">
      <div className="header-section">
        <h2>User Management</h2>
        <button 
          className="btn btn-primary"
          onClick={handleCreateNew}
        >
          Create New User
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="user-list">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Provider Link</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.provider ? user.provider.fullName : '-'}</td>
                <td>
                  <span className={`status-badge ${user.active ? 'active-badge' : 'inactive-badge'}`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                <td className="actions">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3>{isCreating ? 'Create New User' : 'Edit User'}</h3>
              <button className="close-btn" onClick={handleClose}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">
                  {isCreating ? 'Password:' : 'Password (leave blank to keep current):'}
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={isCreating}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role:</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="PROVIDER">Provider</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              
              {formData.role === 'PROVIDER' && (
                <div className="form-group">
                  <label htmlFor="providerId">Link to Provider:</label>
                  <select
                    id="providerId"
                    name="providerId"
                    value={formData.providerId}
                    onChange={handleChange}
                    required={formData.role === 'PROVIDER'}
                  >
                    <option value="">Select Provider</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.lastName}, {provider.firstName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {!isCreating && (
                <div className="form-group checkbox-group">
                  <label htmlFor="active">
                    <input
                      id="active"
                      type="checkbox"
                      name="active"
                      checked={formData.active}
                      onChange={e => 
                        setFormData({...formData, active: e.target.checked})
                      }
                    />
                    Active
                  </label>
                </div>
              )}
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement; 