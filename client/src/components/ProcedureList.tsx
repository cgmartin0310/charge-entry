import React, { useState, useEffect } from 'react';

interface Procedure {
  id: string;
  code: string;
  description: string;
  defaultUnits: number;
  timeBasedBilling: boolean;
  roundingRule: string;
  minutesPerUnit: number;
  validModifiers: string[];
}

const ProcedureList: React.FC = () => {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // API base URL
  const API_URL = 'http://localhost:5002/api';

  useEffect(() => {
    const fetchProcedures = async () => {
      try {
        const response = await fetch(`${API_URL}/procedures`);
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        const data = await response.json();
        setProcedures(data);
      } catch (err) {
        setError('Failed to fetch procedures');
        console.error('Error fetching procedures:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProcedures();
  }, []);

  if (loading) return <div>Loading procedures...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <h2>Procedures</h2>
      <button className="btn btn-primary" style={{ marginBottom: '1rem' }}>
        Add New Procedure
      </button>
      
      {procedures.length === 0 ? (
        <p>No procedures found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Time Based</th>
              <th>Minutes Per Unit</th>
              <th>Rounding Rule</th>
              <th>Valid Modifiers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((procedure) => (
              <tr key={procedure.id}>
                <td>{procedure.code}</td>
                <td>{procedure.description}</td>
                <td>{procedure.timeBasedBilling ? 'Yes' : 'No'}</td>
                <td>{procedure.minutesPerUnit}</td>
                <td>{procedure.roundingRule}</td>
                <td>{procedure.validModifiers.join(', ') || '-'}</td>
                <td className="actions">
                  <button className="btn btn-primary">Edit</button>
                  <button className="btn btn-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProcedureList; 