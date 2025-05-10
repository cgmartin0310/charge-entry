import React, { useState, useEffect } from 'react';

interface Charge {
  id: string;
  patientId: string;
  serviceDate: string;
  providerId: string;
  procedureId: string;
  minutes: number;
  units: number;
  modifiers: string[];
  diagnosisCodes: string[];
  chargeAmount: number;
  status: string;
  payerId: string;
  notes: string | null;
  patient: {
    firstName: string;
    lastName: string;
  };
  procedure: {
    code: string;
    description: string;
  };
  payer: {
    name: string;
  };
  provider: {
    firstName: string;
    lastName: string;
  };
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface Procedure {
  id: string;
  code: string;
  description: string;
  defaultUnits: number;
  timeBasedBilling: boolean;
  minutesPerUnit: number;
  roundingRule: string;
}

interface Payer {
  id: string;
  name: string;
  defaultProcedureId: string | null;
}

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  credentials?: string | null;
}

interface ChargeFormData {
  patientId: string;
  serviceDate: string;
  providerId: string;
  procedureId: string;
  minutes: number;
  units: number;
  modifiers: string[];
  diagnosisCodes: string[];
  chargeAmount: number;
  status: string;
  payerId: string;
  notes: string;
}

const ChargeEntry: React.FC = () => {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null);
  const [formData, setFormData] = useState<ChargeFormData>({
    patientId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    providerId: '',
    procedureId: '',
    minutes: 0,
    units: 1,
    modifiers: [],
    diagnosisCodes: [],
    chargeAmount: 0,
    status: 'ready',
    payerId: '',
    notes: ''
  });
  
  // API base URL
  const API_URL = 'http://localhost:5002/api';

  useEffect(() => {
    fetchCharges();
    fetchPatients();
    fetchProcedures();
    fetchPayers();
    fetchProviders();
  }, []);

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/charges`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setCharges(data);
    } catch (err) {
      setError('Failed to fetch charges');
      console.error('Error fetching charges:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_URL}/patients`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setPatients(data);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchProcedures = async () => {
    try {
      const response = await fetch(`${API_URL}/procedures`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setProcedures(data);
    } catch (err) {
      console.error('Error fetching procedures:', err);
    }
  };

  const fetchPayers = async () => {
    try {
      const response = await fetch(`${API_URL}/payers`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setPayers(data);
    } catch (err) {
      console.error('Error fetching payers:', err);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${API_URL}/providers`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready': return 'status-ready';
      case 'submitted': return 'status-submitted';
      default: return '';
    }
  };

  const openModal = (type: 'add' | 'edit' | 'delete', charge?: Charge) => {
    setModalType(type);
    
    if (charge) {
      setSelectedCharge(charge);
      if (type === 'edit' || type === 'delete') {
        setFormData({
          patientId: charge.patientId,
          serviceDate: new Date(charge.serviceDate).toISOString().split('T')[0],
          providerId: charge.providerId,
          procedureId: charge.procedureId,
          minutes: charge.minutes,
          units: charge.units,
          modifiers: charge.modifiers,
          diagnosisCodes: charge.diagnosisCodes,
          chargeAmount: charge.chargeAmount,
          status: charge.status,
          payerId: charge.payerId,
          notes: charge.notes || ''
        });
      }
    } else {
      // Reset form for add
      setFormData({
        patientId: '',
        serviceDate: new Date().toISOString().split('T')[0],
        providerId: '',
        procedureId: '',
        minutes: 0,
        units: 1,
        modifiers: [],
        diagnosisCodes: [],
        chargeAmount: 0,
        status: 'ready',
        payerId: '',
        notes: ''
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedCharge(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'payerId') {
      // When payer changes, check if they have a default procedure
      const selectedPayer = payers.find(p => p.id === value);
      if (selectedPayer && selectedPayer.defaultProcedureId) {
        // Automatically set the procedure if the payer has a default
        setFormData(prev => ({
          ...prev,
          [name]: value,
          procedureId: selectedPayer.defaultProcedureId as string
        }));
        return;
      }
    }

    if (name === 'minutes') {
      // When minutes change, try to update units
      const minutes = parseInt(value);
      const procedure = procedures.find(p => p.id === formData.procedureId);

      if (procedure && procedure.timeBasedBilling && !isNaN(minutes)) {
        let units = minutes / procedure.minutesPerUnit;
        
        // Apply rounding rule
        switch (procedure.roundingRule) {
          case 'up':
            units = Math.ceil(units);
            break;
          case 'down':
            units = Math.floor(units);
            break;
          case 'nearest':
            units = Math.round(units);
            break;
          default:
            units = Math.ceil(units);
        }
        
        // Ensure at least 1 unit
        units = Math.max(1, units);
        
        setFormData(prev => ({
          ...prev,
          minutes: minutes,
          units
        }));
        return;
      }
    }
    
    // For all other fields or if the special cases didn't apply
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let url = `${API_URL}/charges`;
      let method = 'POST';
      let successMessage = 'Charge added successfully';
      
      // Simple validation
      if (!formData.patientId || !formData.procedureId || !formData.payerId) {
        alert('Please fill in all required fields');
        return;
      }
      
      // For edit, use PUT and include the charge ID
      if (modalType === 'edit' && selectedCharge) {
        url = `${url}/${selectedCharge.id}`;
        method = 'PUT';
        successMessage = 'Charge updated successfully';
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      alert(successMessage);
      closeModal();
      fetchCharges(); // Refresh the list
      
    } catch (err) {
      console.error('Error saving charge:', err);
      alert('Failed to save charge');
    }
  };

  const handleDelete = async () => {
    if (!selectedCharge) return;
    
    try {
      const response = await fetch(`${API_URL}/charges/${selectedCharge.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      alert('Charge deleted successfully');
      closeModal();
      fetchCharges(); // Refresh the list
      
    } catch (err) {
      console.error('Error deleting charge:', err);
      alert('Failed to delete charge');
    }
  };

  const renderModal = () => {
    if (!showModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'add' && 'Add New Charge'}
              {modalType === 'edit' && 'Edit Charge'}
              {modalType === 'delete' && 'Confirm Delete'}
            </h3>
            <button onClick={closeModal} className="close-btn">&times;</button>
          </div>
          
          <div className="modal-body">
            {(modalType === 'add' || modalType === 'edit') && (
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="patientId">Patient*</label>
                    <select 
                      id="patientId" 
                      name="patientId" 
                      value={formData.patientId} 
                      onChange={handleInputChange} 
                      required
                    >
                      <option value="">Select Patient</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.lastName}, {patient.firstName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="serviceDate">Service Date*</label>
                    <input 
                      type="date" 
                      id="serviceDate" 
                      name="serviceDate" 
                      value={formData.serviceDate} 
                      onChange={handleInputChange} 
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="payerId">Payer*</label>
                    <select 
                      id="payerId" 
                      name="payerId" 
                      value={formData.payerId} 
                      onChange={handleInputChange} 
                      required
                    >
                      <option value="">Select Payer</option>
                      {payers.map(payer => (
                        <option key={payer.id} value={payer.id}>
                          {payer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="providerId">Provider*</label>
                    <select 
                      id="providerId" 
                      name="providerId" 
                      value={formData.providerId} 
                      onChange={handleInputChange} 
                      required
                    >
                      <option value="">Select Provider</option>
                      {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.lastName}, {provider.firstName} {provider.credentials ? `(${provider.credentials})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="procedureId">Procedure*</label>
                    <select 
                      id="procedureId" 
                      name="procedureId" 
                      value={formData.procedureId} 
                      onChange={handleInputChange} 
                      required
                    >
                      <option value="">Select Procedure</option>
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
                    <label htmlFor="minutes">Minutes*</label>
                    <input 
                      type="number" 
                      id="minutes" 
                      name="minutes" 
                      value={formData.minutes} 
                      onChange={handleInputChange} 
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="units">Units*</label>
                    <input 
                      type="number" 
                      id="units" 
                      name="units" 
                      value={formData.units} 
                      onChange={handleInputChange} 
                      min="1"
                      required
                      disabled={procedures.find(p => p.id === formData.procedureId)?.timeBasedBilling}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="chargeAmount">Amount*</label>
                    <input 
                      type="number" 
                      id="chargeAmount" 
                      name="chargeAmount" 
                      value={formData.chargeAmount} 
                      onChange={handleInputChange} 
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="status">Status*</label>
                    <select 
                      id="status" 
                      name="status" 
                      value={formData.status} 
                      onChange={handleInputChange} 
                      required
                    >
                      <option value="ready">Ready</option>
                      <option value="submitted">Submitted</option>
                    </select>
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
            
            {modalType === 'delete' && (
              <div className="delete-confirmation">
                <p>Are you sure you want to delete this charge?</p>
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

  if (loading) return <div>Loading charges...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>Charge Entry</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button 
          className="btn btn-primary"
          onClick={() => openModal('add')}
        >
          New Charge
        </button>
        <button className="btn btn-success">
          Generate Claim File
        </button>
      </div>
      
      {charges.length === 0 ? (
        <p>No charges found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date</th>
              <th>Provider</th>
              <th>Procedure</th>
              <th>Minutes</th>
              <th>Units</th>
              <th>Amount</th>
              <th>Payer</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={charge.id}>
                <td>{`${charge.patient.lastName}, ${charge.patient.firstName}`}</td>
                <td>{new Date(charge.serviceDate).toLocaleDateString()}</td>
                <td>{`${charge.provider.lastName}, ${charge.provider.firstName}`}</td>
                <td title={charge.procedure.description}>{charge.procedure.code}</td>
                <td>{charge.minutes}</td>
                <td>{charge.units}</td>
                <td>${charge.chargeAmount.toFixed(2)}</td>
                <td>{charge.payer.name}</td>
                <td className={getStatusClass(charge.status)}>{charge.status}</td>
                <td className="actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => openModal('edit', charge)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => openModal('delete', charge)}
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

export default ChargeEntry; 