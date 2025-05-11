import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../utils/api';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  providerId: string | null;
  insuranceInfo: {
    primary: {
      payerId: string;
    }
  };
}

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
}

interface ChargeData {
  patientId: string;
  serviceDate: Date;
  minutes: number;
  procedureId: string;
  providerId: string;
  payerId: string;
  notes: string;
}

interface Procedure {
  id: string;
  code: string;
  description: string;
  defaultUnits: number;
  timeBasedBilling: boolean;
  minutesPerUnit: number;
}

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  providerId: string | null;
}

interface SimpleChargeEntryProps {
  currentUser: UserInfo | null;
}

const SimpleChargeEntry: React.FC<SimpleChargeEntryProps> = ({ currentUser }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showHelpPopup, setShowHelpPopup] = useState<boolean>(false);
  const [chargeData, setChargeData] = useState<ChargeData>({
    patientId: '',
    serviceDate: new Date(),
    minutes: 0,
    procedureId: '',
    providerId: '',
    payerId: '',
    notes: ''
  });

  // Determine if user is a provider role
  const isProviderRole = currentUser?.role === 'PROVIDER';

  useEffect(() => {
    fetchProviders();
    fetchPatients();
    fetchProcedures();
    
    // If user is a provider, automatically set their provider ID
    if (isProviderRole && currentUser?.providerId) {
      setSelectedProvider(currentUser.providerId);
    }
  }, [isProviderRole, currentUser?.providerId]);

  // Filter patients when provider changes
  useEffect(() => {
    if (selectedProvider) {
      const filtered = patients.filter(patient => patient.providerId === selectedProvider);
      setFilteredPatients(filtered);
      
      // Set the provider ID in charge data
      setChargeData(prev => ({ ...prev, providerId: selectedProvider }));
    } else {
      setFilteredPatients(patients);
    }
  }, [selectedProvider, patients]);

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients(response.data);
      setFilteredPatients(response.data);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Failed to fetch patients. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await api.get('/providers');
      setProviders(response.data);
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError('Failed to fetch providers. Please check your connection and try again.');
    }
  };

  const fetchProcedures = async () => {
    try {
      const response = await api.get('/procedures');
      setProcedures(response.data);
      
      // Set the first procedure as default if available
      if (response.data.length > 0) {
        setChargeData(prev => ({ ...prev, procedureId: response.data[0].id }));
      }
    } catch (err) {
      console.error('Error fetching procedures:', err);
      setError('Failed to fetch procedures. Please check your connection and try again.');
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvider(e.target.value);
  };

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const patientId = e.target.value;
    const patient = patients.find(p => p.id === patientId);
    
    if (patient) {
      setChargeData(prev => ({
        ...prev,
        patientId,
        payerId: patient.insuranceInfo.primary.payerId
      }));
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setChargeData(prev => ({
        ...prev,
        serviceDate: date
      }));
    }
  };

  const handleMinutesSelection = (minutesValue: number) => {
    setChargeData(prev => ({
      ...prev,
      minutes: minutesValue
    }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChargeData(prev => ({
      ...prev,
      notes: e.target.value
    }));
  };

  const toggleHelpPopup = () => {
    setShowHelpPopup(!showHelpPopup);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form
      if (!chargeData.patientId || !chargeData.providerId || !chargeData.procedureId) {
        setError('Please select a patient, provider, and procedure');
        return;
      }

      if (chargeData.minutes <= 0) {
        setError('Please enter a valid number of minutes');
        return;
      }

      // Calculate units based on minutes
      const procedure = procedures.find(p => p.id === chargeData.procedureId);
      let units = 1;
      
      if (procedure && procedure.timeBasedBilling) {
        const minutesPerUnit = procedure.minutesPerUnit || 15;
        units = Math.ceil(chargeData.minutes / minutesPerUnit);
        units = Math.max(1, units); // Ensure at least 1 unit
      }

      // Prepare charge data for submission
      const chargeSubmitData = {
        patientId: chargeData.patientId,
        serviceDate: chargeData.serviceDate.toISOString(),
        minutes: chargeData.minutes,
        units: units,
        providerId: chargeData.providerId,
        procedureId: chargeData.procedureId,
        payerId: chargeData.payerId,
        notes: chargeData.notes,
        modifiers: [],
        diagnosisCodes: [],
        status: 'new',
        chargeAmount: 0 // This would typically be calculated on the server
      };

      // Submit charge
      await api.post('/charges', chargeSubmitData);

      // Reset form with same provider and procedure
      const { providerId, procedureId } = chargeData;
      setChargeData({
        patientId: '',
        serviceDate: new Date(),
        minutes: 0,
        providerId,
        procedureId,
        payerId: '',
        notes: ''
      });

      setSuccessMessage('Charge added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setError(null);

    } catch (err) {
      console.error('Error saving charge:', err);
      setError('Failed to save charge');
      setSuccessMessage(null);
    }
  };

  if (loading) return <div className="loading-indicator">Loading data...</div>;

  // Find the selected provider's name for display when in provider role
  const selectedProviderName = providers.find(p => p.id === selectedProvider)
    ? `${providers.find(p => p.id === selectedProvider)?.lastName}, ${providers.find(p => p.id === selectedProvider)?.firstName}`
    : "";

  return (
    <div className="simple-charge-entry">
      <div className="entry-header">
        <h2>Quick Charge Entry</h2>
        <button 
          type="button" 
          className="help-button" 
          onClick={toggleHelpPopup}
          aria-label="Help information"
        >
          <span className="help-icon">?</span>
        </button>
      </div>
      
      {showHelpPopup && (
        <div className="help-popup-overlay" onClick={toggleHelpPopup}>
          <div className="help-popup-content" onClick={e => e.stopPropagation()}>
            <div className="help-popup-header">
              <h3>Welcome to Simplified Charge Entry</h3>
              <button className="close-button" onClick={toggleHelpPopup}>&times;</button>
            </div>
            <div className="help-popup-body">
              <p>
                This streamlined interface helps you quickly record peer support services with just a few clicks:
              </p>
              <ol>
                <li><strong>Select Provider</strong> - Choose a provider to filter the patient list</li>
                <li><strong>Select Patient</strong> - Pick the client who received services</li>
                <li><strong>Choose Date</strong> - Select when the service was provided</li>
                <li><strong>Enter Minutes</strong> - Record the time spent (automatically converts to units)</li>
              </ol>
              <p className="notice">
                The system will automatically use the patient's primary insurance and calculate appropriate billing units.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      
      <form onSubmit={handleSubmit} className="simple-form">
        <div className="form-section">
          <h3>1. Service Provider</h3>
          
          {isProviderRole ? (
            // For provider role users, show their own provider info without dropdown
            <div className="form-group">
              <label>Provider:</label>
              <div className="provider-display">{selectedProviderName}</div>
              <input type="hidden" value={selectedProvider} />
            </div>
          ) : (
            // For admin users, show the provider dropdown
            <div className="form-group">
              <label htmlFor="provider">Select Provider:</label>
              <select 
                id="provider" 
                value={selectedProvider} 
                onChange={handleProviderChange}
                className="form-control"
              >
                <option value="">All Providers</option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.lastName}, {provider.firstName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="form-section">
          <h3>2. Client Information</h3>
          <div className="form-group">
            <label htmlFor="patient">Select Patient:</label>
            <select 
              id="patient" 
              value={chargeData.patientId} 
              onChange={handlePatientSelect}
              className="form-control"
              required
            >
              <option value="">Select Patient</option>
              {filteredPatients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.lastName}, {patient.firstName}
                </option>
              ))}
            </select>
            <div className="patient-count">
              {filteredPatients.length} patients available {selectedProvider ? 'for this provider' : ''}
            </div>
          </div>
        </div>
        
        <div className="form-section">
          <h3>3. Service Details</h3>
          
          <div className="service-details-container">
            <div className="date-section">
              <div className="form-group">
                <label htmlFor="serviceDate">Service Date:</label>
                <DatePicker
                  selected={chargeData.serviceDate}
                  onChange={handleDateChange}
                  dateFormat="MM/dd/yyyy"
                  className="form-control"
                  maxDate={new Date()}
                  required
                />
              </div>
            </div>
            
            <div className="minutes-section">
              <div className="form-group">
                <label htmlFor="minutes">Minutes:</label>
                <div className="minutes-buttons">
                  <button
                    type="button"
                    className={`time-button ${chargeData.minutes === 15 ? 'active' : ''}`}
                    onClick={() => handleMinutesSelection(15)}
                  >
                    0-15 min
                  </button>
                  <button
                    type="button"
                    className={`time-button ${chargeData.minutes === 30 ? 'active' : ''}`}
                    onClick={() => handleMinutesSelection(30)}
                  >
                    16-30 min
                  </button>
                  <button
                    type="button"
                    className={`time-button ${chargeData.minutes === 45 ? 'active' : ''}`}
                    onClick={() => handleMinutesSelection(45)}
                  >
                    31-45 min
                  </button>
                  <button
                    type="button"
                    className={`time-button ${chargeData.minutes === 60 ? 'active' : ''}`}
                    onClick={() => handleMinutesSelection(60)}
                  >
                    46-60 min
                  </button>
                </div>
                {chargeData.minutes > 0 && procedures.find(p => p.id === chargeData.procedureId)?.timeBasedBilling && (
                  <div className="units-calculated">
                    Will bill: {Math.max(1, Math.ceil(chargeData.minutes / (procedures.find(p => p.id === chargeData.procedureId)?.minutesPerUnit || 15)))} units
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="notes">Notes (optional):</label>
            <textarea 
              id="notes" 
              value={chargeData.notes} 
              onChange={handleNotesChange}
              className="form-control"
              rows={2}
            />
          </div>
        </div>
        
        <button type="submit" className="btn btn-primary btn-lg">
          Save Charge
        </button>
      </form>
    </div>
  );
};

export default SimpleChargeEntry; 