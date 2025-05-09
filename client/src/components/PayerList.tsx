import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface Payer {
  id: string;
  name: string;
  payerId: string;
  payerType: string;
  phone: string;
  email: string | null;
  electronicPayer: boolean;
  defaultProcedureId?: string | null;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

interface Procedure {
  id: string;
  code: string;
  description: string;
}

interface PayerFormData {
  name: string;
  payerId: string;
  payerType: string;
  phone: string;
  email: string;
  electronicPayer: boolean;
  defaultProcedureId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

const PayerList: React.FC = () => {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'view' | 'delete'>('add');
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null);
  const [formData, setFormData] = useState<PayerFormData>({
    name: '',
    payerId: '',
    payerType: 'Commercial',
    phone: '',
    email: '',
    electronicPayer: true,
    defaultProcedureId: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

  useEffect(() => {
    fetchPayers();
    fetchProcedures();
  }, []);

  const fetchPayers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/payers');
      setPayers(response.data);
    } catch (err) {
      setError('Failed to fetch payers');
      console.error('Error fetching payers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcedures = async () => {
    try {
      const response = await api.get('/procedures');
      setProcedures(response.data);
    } catch (err) {
      console.error('Error fetching procedures:', err);
    }
  };

  const openModal = (type: 'add' | 'edit' | 'view' | 'delete', payer?: Payer) => {
    setModalType(type);
    
    if (payer) {
      setSelectedPayer(payer);
      if (type === 'edit' || type === 'view' || type === 'delete') {
        setFormData({
          name: payer.name,
          payerId: payer.payerId,
          payerType: payer.payerType,
          phone: payer.phone,
          email: payer.email || '',
          electronicPayer: payer.electronicPayer,
          defaultProcedureId: payer.defaultProcedureId || '',
          address: payer.address || {
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
        name: '',
        payerId: '',
        payerType: 'Commercial',
        phone: '',
        email: '',
        electronicPayer: true,
        defaultProcedureId: '',
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
    setSelectedPayer(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    } else if (name === 'electronicPayer') {
      // Handle checkbox for electronic payer
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
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
      let url = '/payers';
      let method = 'post';
      let successMessage = 'Payer added successfully';
      
      // Simple validation
      if (!formData.name || !formData.payerId || !formData.phone) {
        alert('Please fill in all required fields');
        return;
      }
      
      // For edit, use PUT and include the patient ID
      if (modalType === 'edit' && selectedPayer) {
        url = `${url}/${selectedPayer.id}`;
        method = 'put';
        successMessage = 'Payer updated successfully';
      }
      
      // Prepare data for submission
      const submitData = {
        ...formData,
        // If default procedure is empty string, set to null
        defaultProcedureId: formData.defaultProcedureId || null
      };
      
      if (method === 'post') {
        await api.post(url, submitData);
      } else {
        await api.put(url, submitData);
      }
      
      alert(successMessage);
      closeModal();
      fetchPayers(); // Refresh the list
      
    } catch (err) {
      console.error('Error saving payer:', err);
      alert('Failed to save payer');
    }
  };

  const handleDelete = async () => {
    if (!selectedPayer) return;
    
    try {
      await api.delete(`/payers/${selectedPayer.id}`);
      
      alert('Payer deleted successfully');
      closeModal();
      fetchPayers(); // Refresh the list
      
    } catch (err) {
      console.error('Error deleting payer:', err);
      alert('Failed to delete payer');
    }
  };

  const renderModal = () => {
    if (!showModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'add' && 'Add New Payer'}
              {modalType === 'edit' && 'Edit Payer'}
              {modalType === 'view' && 'Payer Details'}
              {modalType === 'delete' && 'Confirm Delete'}
            </h3>
            <button onClick={closeModal} className="close-btn">&times;</button>
          </div>
          
          <div className="modal-body">
            {(modalType === 'add' || modalType === 'edit') && (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Name*</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="payerId">Payer ID*</label>
                    <input 
                      type="text" 
                      id="payerId" 
                      name="payerId" 
                      value={formData.payerId} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="payerType">Payer Type*</label>
                    <select 
                      id="payerType" 
                      name="payerType" 
                      value={formData.payerType} 
                      onChange={handleInputChange} 
                      required 
                    >
                      <option value="Medicare">Medicare</option>
                      <option value="Medicaid">Medicaid</option>
                      <option value="Commercial">Commercial</option>
                      <option value="BlueCross">Blue Cross</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="defaultProcedureId">Default Procedure</label>
                    <select
                      id="defaultProcedureId"
                      name="defaultProcedureId"
                      value={formData.defaultProcedureId}
                      onChange={handleInputChange}
                    >
                      <option value="">No Default Procedure</option>
                      {procedures.map(procedure => (
                        <option key={procedure.id} value={procedure.id}>
                          {procedure.code} - {procedure.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Phone*</label>
                    <input 
                      type="tel" 
                      id="phone" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleInputChange} 
                      required 
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
                
                <div className="form-row">
                  <div className="form-group checkbox-group">
                    <label>
                      <input 
                        type="checkbox" 
                        name="electronicPayer"
                        checked={formData.electronicPayer} 
                        onChange={handleInputChange} 
                      />
                      Electronic Payer
                    </label>
                  </div>
                </div>
                
                <h4>Address</h4>
                <div className="form-group">
                  <label htmlFor="address.street">Street*</label>
                  <input 
                    type="text" 
                    id="address.street" 
                    name="address.street" 
                    value={formData.address.street} 
                    onChange={handleInputChange} 
                    required 
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="address.city">City*</label>
                    <input 
                      type="text" 
                      id="address.city" 
                      name="address.city" 
                      value={formData.address.city} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address.state">State*</label>
                    <input 
                      type="text" 
                      id="address.state" 
                      name="address.state" 
                      value={formData.address.state} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address.zipCode">Zip Code*</label>
                    <input 
                      type="text" 
                      id="address.zipCode" 
                      name="address.zipCode" 
                      value={formData.address.zipCode} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            )}
            
            {modalType === 'view' && selectedPayer && (
              <div className="payer-details">
                <h4>Payer Information</h4>
                <div className="detail-row">
                  <strong>Name:</strong> {selectedPayer.name}
                </div>
                <div className="detail-row">
                  <strong>Payer ID:</strong> {selectedPayer.payerId}
                </div>
                <div className="detail-row">
                  <strong>Type:</strong> {selectedPayer.payerType}
                </div>
                <div className="detail-row">
                  <strong>Phone:</strong> {selectedPayer.phone}
                </div>
                <div className="detail-row">
                  <strong>Email:</strong> {selectedPayer.email || 'N/A'}
                </div>
                <div className="detail-row">
                  <strong>Electronic Payer:</strong> {selectedPayer.electronicPayer ? 'Yes' : 'No'}
                </div>
                <div className="detail-row">
                  <strong>Default Procedure:</strong> {
                    selectedPayer.defaultProcedureId 
                      ? procedures.find(p => p.id === selectedPayer.defaultProcedureId)?.code + ' - ' + 
                        procedures.find(p => p.id === selectedPayer.defaultProcedureId)?.description 
                      : 'None'
                  }
                </div>
                
                {selectedPayer.address && (
                  <>
                    <h4>Address</h4>
                    <div className="detail-row">
                      <strong>Street:</strong> {selectedPayer.address.street}
                    </div>
                    <div className="detail-row">
                      <strong>City:</strong> {selectedPayer.address.city}
                    </div>
                    <div className="detail-row">
                      <strong>State:</strong> {selectedPayer.address.state}
                    </div>
                    <div className="detail-row">
                      <strong>Zip Code:</strong> {selectedPayer.address.zipCode}
                    </div>
                  </>
                )}
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Close</button>
                  <button type="button" onClick={() => openModal('edit', selectedPayer)} className="btn btn-primary">Edit</button>
                </div>
              </div>
            )}
            
            {modalType === 'delete' && (
              <div className="delete-confirmation">
                <p>Are you sure you want to delete {selectedPayer?.name}?</p>
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

  if (loading) return <div>Loading payers...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>Payers</h2>
      <button 
        className="btn btn-primary" 
        style={{ marginBottom: '1rem' }}
        onClick={() => openModal('add')}
      >
        Add New Payer
      </button>
      
      {payers.length === 0 ? (
        <p>No payers found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Payer ID</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Electronic</th>
              <th>Default Procedure</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payers.map((payer) => (
              <tr key={payer.id}>
                <td>{payer.name}</td>
                <td>{payer.payerId}</td>
                <td>{payer.payerType}</td>
                <td>{payer.phone}</td>
                <td>{payer.email || '-'}</td>
                <td>{payer.electronicPayer ? 'Yes' : 'No'}</td>
                <td>{
                  payer.defaultProcedureId 
                    ? procedures.find(p => p.id === payer.defaultProcedureId)?.code || 'Unknown' 
                    : 'None'
                }</td>
                <td className="actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => openModal('view', payer)}
                  >
                    View
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={() => openModal('edit', payer)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => openModal('delete', payer)}
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

export default PayerList; 