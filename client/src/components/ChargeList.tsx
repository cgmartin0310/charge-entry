import React, { useState, useEffect } from 'react';
import api from '../utils/api';

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
  createdAt: string;
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

const ChargeList: React.FC = () => {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharges, setSelectedCharges] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [payers, setPayers] = useState([]);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    fetchCharges();
  }, []);

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const response = await api.get('/charges');
      
      // Get the charges data
      const chargesData = response.data;
      
      // Fetch related data for display
      await fetchRelatedData(chargesData);
      
      setCharges(chargesData);
    } catch (err) {
      console.error('Error fetching charges:', err);
      setError('Failed to fetch charges. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async (chargesData: any[]) => {
    try {
      // Extract unique IDs using Array.from instead of spread operator
      const patientIds = Array.from(new Set(chargesData.map(charge => charge.patientId)));
      const procedureIds = Array.from(new Set(chargesData.map(charge => charge.procedureId)));
      const payerIds = Array.from(new Set(chargesData.map(charge => charge.payerId)));
      const providerIds = Array.from(new Set(chargesData.map(charge => charge.providerId)));
      
      // Fetch related data in parallel
      const [patientsRes, proceduresRes, payersRes, providersRes] = await Promise.all([
        api.get('/patients'),
        api.get('/procedures'),
        api.get('/payers'),
        api.get('/providers')
      ]);
      
      // Filter only the needed data
      const patientsData = patientsRes.data.filter((p: any) => patientIds.includes(p.id));
      const proceduresData = proceduresRes.data.filter((p: any) => procedureIds.includes(p.id));
      const payersData = payersRes.data.filter((p: any) => payerIds.includes(p.id));
      const providersData = providersRes.data.filter((p: any) => providerIds.includes(p.id));
      
      // Set the data
      setPatients(patientsData);
      setProcedures(proceduresData);
      setPayers(payersData);
      setProviders(providersData);
    } catch (err) {
      console.error('Error fetching related data:', err);
    }
  };

  const handleSelectCharge = (chargeId: string) => {
    if (selectedCharges.includes(chargeId)) {
      setSelectedCharges(selectedCharges.filter(id => id !== chargeId));
    } else {
      setSelectedCharges([...selectedCharges, chargeId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedCharges.length === charges.length) {
      setSelectedCharges([]);
    } else {
      setSelectedCharges(charges.map(charge => charge.id));
    }
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleGenerateClaim = async () => {
    if (selectedCharges.length === 0) {
      setError('Please select at least one charge to generate a claim');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/charges/generate-claim', { chargeIds: selectedCharges });
      
      // Refresh charges list
      fetchCharges();
      setSelectedCharges([]);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate claim');
      console.error('Error generating claim:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready':
        return 'status-ready';
      case 'submitted':
        return 'status-submitted';
      default:
        return '';
    }
  };

  if (loading && charges.length === 0) {
    return <div className="loading-indicator">Loading charges...</div>;
  }

  return (
    <div className="charge-list">
      <div className="header-section">
        <h2>Charge History</h2>
        <div className="controls">
          <div className="filter-group">
            <label htmlFor="statusFilter">Status Filter:</label>
            <select 
              id="statusFilter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="form-control"
            >
              <option value="">All Statuses</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleGenerateClaim}
            disabled={selectedCharges.length === 0}
          >
            Generate Claim
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {charges.length === 0 && !loading ? (
        <div className="no-data-message">No charges found</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={charges.length > 0 && selectedCharges.length === charges.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Patient</th>
              <th>Service Date</th>
              <th>Provider</th>
              <th>Procedure</th>
              <th>Units</th>
              <th>Payer</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {charges.map(charge => (
              <tr key={charge.id}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedCharges.includes(charge.id)}
                    onChange={() => handleSelectCharge(charge.id)}
                  />
                </td>
                <td>{`${charge.patient.lastName}, ${charge.patient.firstName}`}</td>
                <td>{new Date(charge.serviceDate).toLocaleDateString()}</td>
                <td>{`${charge.provider.lastName}, ${charge.provider.firstName}`}</td>
                <td>{`${charge.procedure.code}: ${charge.procedure.description}`}</td>
                <td>{charge.units}</td>
                <td>{charge.payer.name}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(charge.status)}`}>
                    {charge.status}
                  </span>
                </td>
                <td>{charge.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ChargeList; 