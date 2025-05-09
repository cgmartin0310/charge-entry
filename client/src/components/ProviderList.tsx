import React, { useState, useEffect } from 'react';

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  npi: string | null;
  credentials: string | null;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  } | null;
  status: string;
  notes: string | null;
}

interface ProviderFormData {
  firstName: string;
  lastName: string;
  npi: string;
  credentials: string;
  specialty: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

const ProviderList: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'view' | 'delete'>('add');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>({
    firstName: '',
    lastName: '',
    npi: '',
    credentials: '',
    specialty: '',
    email: '',
    phone: '',
    status: 'active',
    notes: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });
  
  // API base URL
  const API_URL = 'http://localhost:5002/api';

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/providers`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      setError('Failed to fetch providers');
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type: 'add' | 'edit' | 'view' | 'delete', provider?: Provider) => {
    setModalType(type);
    
    if (provider) {
      setSelectedProvider(provider);
      if (type === 'edit' || type === 'view' || type === 'delete') {
        setFormData({
          firstName: provider.firstName,
          lastName: provider.lastName,
          npi: provider.npi || '',
          credentials: provider.credentials || '',
          specialty: provider.specialty || '',
          email: provider.email || '',
          phone: provider.phone || '',
          status: provider.status,
          notes: provider.notes || '',
          address: provider.address || {
            street: '',
            city: '',
            state: '',
            zipCode: ''
          }
        });
      }
    } else {
      // Reset form for add
      setFormData({
        firstName: '',
        lastName: '',
        npi: '',
        credentials: '',
        specialty: '',
        email: '',
        phone: '',
        status: 'active',
        notes: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: ''
        }
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProvider(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('address.')) {
      const field = name.replace('address.', '');
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let url = `${API_URL}/providers`;
      let method = 'POST';
      let successMessage = 'Provider added successfully';
      
      // Simple validation
      if (!formData.firstName || !formData.lastName) {
        alert('Please fill in all required fields');
        return;
      }
      
      // For edit, use PUT and include the provider ID
      if (modalType === 'edit' && selectedProvider) {
        url = `${url}/${selectedProvider.id}`;
        method = 'PUT';
        successMessage = 'Provider updated successfully';
      }
      
      // Prepare data for submission - if address is empty, set to null
      const hasAddress = formData.address.street || formData.address.city || 
                        formData.address.state || formData.address.zipCode;
      
      const submitData = {
        ...formData,
        address: hasAddress ? formData.address : null
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      alert(successMessage);
      closeModal();
      fetchProviders(); // Refresh the list
      
    } catch (err) {
      console.error('Error saving provider:', err);
      alert('Failed to save provider');
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;
    
    try {
      const response = await fetch(`${API_URL}/providers/${selectedProvider.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      alert('Provider deleted successfully');
      closeModal();
      fetchProviders(); // Refresh the list
      
    } catch (err) {
      console.error('Error deleting provider:', err);
      alert('Failed to delete provider');
    }
  };

  const renderModal = () => {
    if (!showModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'add' && 'Add New Provider'}
              {modalType === 'edit' && 'Edit Provider'}
              {modalType === 'view' && 'Provider Details'}
              {modalType === 'delete' && 'Confirm Delete'}
            </h3>
            <button onClick={closeModal} className="close-btn">&times;</button>
          </div>
          
          <div className="modal-body">
            {(modalType === 'add' || modalType === 'edit') && (
              <form onSubmit={handleSubmit}>
                <h4>Personal Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name*</label>
                    <input 
                      type="text" 
                      id="firstName" 
                      name="firstName" 
                      value={formData.firstName} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name*</label>
                    <input 
                      type="text" 
                      id="lastName" 
                      name="lastName" 
                      value={formData.lastName} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="npi">NPI (National Provider Identifier)</label>
                    <input 
                      type="text" 
                      id="npi" 
                      name="npi" 
                      value={formData.npi} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="credentials">Credentials</label>
                    <input 
                      type="text" 
                      id="credentials" 
                      name="credentials" 
                      value={formData.credentials} 
                      placeholder="e.g., LCSW, CPS"
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="specialty">Specialty</label>
                    <input 
                      type="text" 
                      id="specialty" 
                      name="specialty" 
                      value={formData.specialty} 
                      placeholder="e.g., Peer Support"
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="status">Status*</label>
                    <select 
                      id="status" 
                      name="status" 
                      value={formData.status} 
                      onChange={handleInputChange} 
                      required 
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Phone</label>
                    <input 
                      type="tel" 
                      id="phone" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input 
                      type="email" 
                      id="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>
                
                <h4>Address (Optional)</h4>
                <div className="form-group">
                  <label htmlFor="address.street">Street</label>
                  <input 
                    type="text" 
                    id="address.street" 
                    name="address.street" 
                    value={formData.address.street} 
                    onChange={handleInputChange} 
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="address.city">City</label>
                    <input 
                      type="text" 
                      id="address.city" 
                      name="address.city" 
                      value={formData.address.city} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address.state">State</label>
                    <input 
                      type="text" 
                      id="address.state" 
                      name="address.state" 
                      value={formData.address.state} 
                      onChange={handleInputChange} 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address.zipCode">Zip Code</label>
                    <input 
                      type="text" 
                      id="address.zipCode" 
                      name="address.zipCode" 
                      value={formData.address.zipCode} 
                      onChange={handleInputChange} 
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea 
                    id="notes" 
                    name="notes" 
                    value={formData.notes} 
                    onChange={handleInputChange} 
                    rows={3}
                  />
                </div>
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            )}
            
            {modalType === 'view' && selectedProvider && (
              <div className="provider-details">
                <h4>Personal Information</h4>
                <div className="detail-row">
                  <strong>Name:</strong> {selectedProvider.firstName} {selectedProvider.lastName}
                </div>
                {selectedProvider.npi && (
                  <div className="detail-row">
                    <strong>NPI:</strong> {selectedProvider.npi}
                  </div>
                )}
                {selectedProvider.credentials && (
                  <div className="detail-row">
                    <strong>Credentials:</strong> {selectedProvider.credentials}
                  </div>
                )}
                {selectedProvider.specialty && (
                  <div className="detail-row">
                    <strong>Specialty:</strong> {selectedProvider.specialty}
                  </div>
                )}
                <div className="detail-row">
                  <strong>Status:</strong> {selectedProvider.status === 'active' ? 'Active' : 'Inactive'}
                </div>
                {selectedProvider.phone && (
                  <div className="detail-row">
                    <strong>Phone:</strong> {selectedProvider.phone}
                  </div>
                )}
                {selectedProvider.email && (
                  <div className="detail-row">
                    <strong>Email:</strong> {selectedProvider.email}
                  </div>
                )}
                
                {selectedProvider.address && (
                  <>
                    <h4>Address</h4>
                    <div className="detail-row">
                      <strong>Street:</strong> {selectedProvider.address.street}
                    </div>
                    <div className="detail-row">
                      <strong>City:</strong> {selectedProvider.address.city}
                    </div>
                    <div className="detail-row">
                      <strong>State:</strong> {selectedProvider.address.state}
                    </div>
                    <div className="detail-row">
                      <strong>Zip Code:</strong> {selectedProvider.address.zipCode}
                    </div>
                  </>
                )}
                
                {selectedProvider.notes && (
                  <>
                    <h4>Notes</h4>
                    <div className="detail-row">
                      {selectedProvider.notes}
                    </div>
                  </>
                )}
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Close</button>
                  <button type="button" onClick={() => openModal('edit', selectedProvider)} className="btn btn-primary">Edit</button>
                </div>
              </div>
            )}
            
            {modalType === 'delete' && (
              <div className="delete-confirmation">
                <p>Are you sure you want to delete {selectedProvider?.firstName} {selectedProvider?.lastName}?</p>
                <p>This action cannot be undone.</p>
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Cancel</button>
                  <button type="button" onClick={handleDelete} className="btn btn-danger">Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div>Loading providers...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>Providers</h2>
      <button 
        className="btn btn-primary" 
        style={{ marginBottom: '1rem' }}
        onClick={() => openModal('add')}
      >
        Add New Provider
      </button>
      
      {providers.length === 0 ? (
        <p>No providers found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Credentials</th>
              <th>Specialty</th>
              <th>NPI</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id}>
                <td>{`${provider.lastName}, ${provider.firstName}`}</td>
                <td>{provider.credentials || '-'}</td>
                <td>{provider.specialty || '-'}</td>
                <td>{provider.npi || '-'}</td>
                <td>{provider.phone || '-'}</td>
                <td>{provider.email || '-'}</td>
                <td>{provider.status === 'active' ? 'Active' : 'Inactive'}</td>
                <td className="actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => openModal('view', provider)}
                  >
                    View
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => openModal('edit', provider)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => openModal('delete', provider)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {renderModal()}
    </div>
  );
};

export default ProviderList; 