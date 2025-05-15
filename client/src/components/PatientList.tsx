import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { extractPatientDataFromImage, extractPatientDataWithOpenAI, ExtractedPatientData } from '../utils/grokService';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  insuranceInfo: {
    primary: {
      payerId: string;
      memberId: string;
      groupNumber?: string;
    };
    secondary?: {
      payerId: string;
      memberId: string;
      groupNumber?: string;
    };
  };
  providerId?: string | null;
}

interface Payer {
  id: string;
  name: string;
  payerId: string;
  payerType: string;
}

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  credentials?: string | null;
}

interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  insuranceInfo: {
    primary: {
      payerId: string;
      memberId: string;
      groupNumber: string;
    };
    secondary: {
      payerId: string;
      memberId: string;
      groupNumber: string;
    };
  };
  providerId: string;
}

interface AddressType {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

const PatientList: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'view' | 'delete'>('add');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processingScan, setProcessingScan] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<PatientFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    },
    insuranceInfo: {
      primary: {
        payerId: '',
        memberId: '',
        groupNumber: ''
      },
      secondary: {
        payerId: '',
        memberId: '',
        groupNumber: ''
      }
    },
    providerId: ''
  });

  useEffect(() => {
    fetchPatients();
    fetchPayers();
    fetchProviders();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/patients');
      setPatients(response.data);
    } catch (err) {
      setError('Failed to fetch patients. Please check your connection and try again.');
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayers = async () => {
    try {
      const response = await api.get('/payers');
      setPayers(response.data);
    } catch (err) {
      console.error('Error fetching payers:', err);
      // We don't set general error here as it would block the whole interface
    }
  };

  const fetchProviders = async () => {
    try {
      const response = await api.get('/providers');
      setProviders(response.data);
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const parts = name.split('.');
      
      if (parts.length === 2) {
        // Handle address fields
        if (parts[0] === 'address') {
          setFormData(prev => ({
            ...prev,
            address: {
              ...prev.address,
              [parts[1]]: value
            }
          }));
        }
      } else if (parts.length === 3) {
        // Handle insurance fields: insuranceInfo.primary.payerId
        const [parent, type, field] = parts;
        if (parent === 'insuranceInfo' && (type === 'primary' || type === 'secondary')) {
          setFormData(prev => ({
            ...prev,
            insuranceInfo: {
              ...prev.insuranceInfo,
              [type]: {
                ...prev.insuranceInfo[type as keyof typeof prev.insuranceInfo],
                [field]: value
              }
            }
          }));
        }
      }
    } else {
      // Handle top-level fields
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const openModal = (type: 'add' | 'edit' | 'view' | 'delete', patient?: Patient) => {
    setModalType(type);
    
    if (patient) {
      setSelectedPatient(patient);
      if (type === 'edit' || type === 'view') {
        // Format date for input
        const formattedDate = new Date(patient.dateOfBirth)
          .toISOString()
          .split('T')[0];
          
        setFormData({
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: formattedDate,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email || '',
          address: {
            street: patient.address.street,
            city: patient.address.city,
            state: patient.address.state,
            zipCode: patient.address.zipCode
          },
          insuranceInfo: {
            primary: {
              payerId: patient.insuranceInfo.primary.payerId,
              memberId: patient.insuranceInfo.primary.memberId,
              groupNumber: patient.insuranceInfo.primary.groupNumber || ''
            },
            secondary: patient.insuranceInfo.secondary ? {
              payerId: patient.insuranceInfo.secondary.payerId,
              memberId: patient.insuranceInfo.secondary.memberId,
              groupNumber: patient.insuranceInfo.secondary.groupNumber || ''
            } : {
              payerId: '',
              memberId: '',
              groupNumber: ''
            }
          },
          providerId: patient.providerId || ''
        });
      }
    } else {
      // Reset form for add
      setFormData({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: 'male',
        phone: '',
        email: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: ''
        },
        insuranceInfo: {
          primary: {
            payerId: '',
            memberId: '',
            groupNumber: ''
          },
          secondary: {
            payerId: '',
            memberId: '',
            groupNumber: ''
          }
        },
        providerId: ''
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPatient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let url = '/patients';
      let method = 'post';
      let successMessage = 'Patient added successfully';
      
      // Simple validation
      if (!formData.firstName || !formData.lastName || !formData.dateOfBirth) {
        alert('Please fill in all required fields');
        return;
      }
      
      // For edit, use PUT and include the patient ID
      if (modalType === 'edit' && selectedPatient) {
        url = `${url}/${selectedPatient.id}`;
        method = 'put';
        successMessage = 'Patient updated successfully';
      }
      
      // Prepare data for submission
      // Remove empty secondary insurance if not provided
      const submitData = {
        ...formData,
        insuranceInfo: {
          primary: formData.insuranceInfo.primary,
          ...(formData.insuranceInfo.secondary.payerId && formData.insuranceInfo.secondary.memberId 
            ? { secondary: formData.insuranceInfo.secondary } 
            : {})
        }
      };
      
      // Using axios methods directly with our api utility
      if (method === 'post') {
        await api.post(url, submitData);
      } else {
        await api.put(url, submitData);
      }
      
      alert(successMessage);
      closeModal();
      fetchPatients(); // Refresh the list
      
    } catch (err) {
      console.error('Error saving patient:', err);
      alert('Failed to save patient');
    }
  };

  const handleDelete = async () => {
    if (!selectedPatient) return;
    
    try {
      await api.delete(`/patients/${selectedPatient.id}`);
      
      alert('Patient deleted successfully');
      closeModal();
      fetchPatients(); // Refresh the list
      
    } catch (err) {
      console.error('Error deleting patient:', err);
      alert('Failed to delete patient');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const activateCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImageWithAI = async () => {
    if (!imagePreview) return;

    try {
      setProcessingScan(true);
      setScanError(null);
      
      console.log('Starting AI document processing for patient data');

      // Use the OpenAI service to extract patient data
      try {
        const extractedData = await extractPatientDataWithOpenAI(imagePreview);
        console.log('Successfully received data from OpenAI processing:', extractedData);
        
        // Apply extracted data to form
        if (extractedData) {
          setFormData(prev => ({
            ...prev,
            firstName: extractedData.firstName || prev.firstName,
            lastName: extractedData.lastName || prev.lastName,
            dateOfBirth: extractedData.dateOfBirth || prev.dateOfBirth,
            gender: extractedData.gender || prev.gender,
            phone: extractedData.phone || prev.phone,
            email: extractedData.email || prev.email,
            address: {
              street: extractedData.address?.street || prev.address.street,
              city: extractedData.address?.city || prev.address.city,
              state: extractedData.address?.state || prev.address.state,
              zipCode: extractedData.address?.zipCode || prev.address.zipCode
            },
            insuranceInfo: {
              primary: {
                ...prev.insuranceInfo.primary,
                memberId: extractedData.insuranceId || prev.insuranceInfo.primary.memberId
              },
              secondary: prev.insuranceInfo.secondary
            }
          }));

          // If insurance provider is detected, try to find matching payer
          if (extractedData.insuranceProvider && payers.length > 0) {
            const matchedPayer = payers.find(p => 
              p.name.toLowerCase().includes(extractedData.insuranceProvider?.toLowerCase() || '')
            );
            
            if (matchedPayer) {
              setFormData(prev => ({
                ...prev,
                insuranceInfo: {
                  ...prev.insuranceInfo,
                  primary: {
                    ...prev.insuranceInfo.primary,
                    payerId: matchedPayer.id
                  }
                }
              }));
            }
          }
        } else {
          console.warn('No data extracted from the image');
          setScanError('No information could be extracted from the image. Please ensure the image is clear and try again, or enter information manually.');
        }
      } catch (apiError: any) {
        console.error('API error during OpenAI processing:', apiError);
        setScanError(`OpenAI processing error: ${apiError.message}`);
        throw apiError; // Re-throw to ensure we see the full error
      }

    } catch (err: any) {
      console.error('Error processing image:', err);
      // Display more specific error messages based on the type of error
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setScanError('Network error: Unable to reach the document processing service. Please check your connection.');
      } else if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
        setScanError('The request timed out. The server might be busy, please try again later.');
      } else {
        setScanError(`Failed to process image: ${err.message}. Please try again or enter information manually.`);
      }
    } finally {
      setProcessingScan(false);
    }
  };

  const renderModal = () => {
    if (!showModal) return null;
    
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>
              {modalType === 'add' && 'Add New Patient'}
              {modalType === 'edit' && 'Edit Patient'}
              {modalType === 'view' && 'Patient Details'}
              {modalType === 'delete' && 'Confirm Delete'}
            </h3>
            <button onClick={closeModal} className="close-btn">&times;</button>
          </div>
          
          <div className="modal-body">
            {(modalType === 'add' || modalType === 'edit') && (
              <form onSubmit={handleSubmit}>
                {modalType === 'add' && (
                  <div className="scan-section">
                    <h4>Scan ID or Insurance Card</h4>
                    <p className="scan-instruction">Upload or take a photo of an ID or insurance card to automatically fill in patient details using OpenAI document processing.</p>
                    
                    <div className="scan-controls">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={activateCamera}
                      >
                        <span className="camera-icon">📷</span> Capture Image
                      </button>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                      />
                    </div>
                    
                    {imagePreview && (
                      <div className="image-preview-container">
                        <img 
                          src={imagePreview} 
                          alt="Document preview" 
                          className="image-preview" 
                        />
                        <div className="preview-actions">
                          <button 
                            type="button" 
                            className="btn btn-primary"
                            onClick={processImageWithAI}
                            disabled={processingScan}
                          >
                            {processingScan ? 'Processing...' : 'Extract Data with AI'}
                          </button>
                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={clearImage}
                          >
                            Clear Image
                          </button>
                        </div>
                        {scanError && <div className="scan-error">{scanError}</div>}
                      </div>
                    )}
                    
                    <div className="form-note">
                      <p><strong>Note:</strong> Our AI document scanner uses OpenAI to extract information from ID cards and insurance cards with greater accuracy. For best results, ensure the image is clear and all text is readable.</p>
                    </div>
                    
                    <div className="divider">
                      <span>or enter manually</span>
                    </div>
                  </div>
                )}

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
                    <label htmlFor="dateOfBirth">Date of Birth*</label>
                    <input 
                      type="date" 
                      id="dateOfBirth" 
                      name="dateOfBirth" 
                      value={formData.dateOfBirth} 
                      onChange={handleInputChange} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gender">Gender*</label>
                    <select 
                      id="gender" 
                      name="gender" 
                      value={formData.gender} 
                      onChange={handleInputChange} 
                      required 
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
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
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="providerId">Assigned Provider</label>
                    <select 
                      id="providerId" 
                      name="providerId" 
                      value={formData.providerId} 
                      onChange={handleInputChange}
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
                
                <h4>Primary Insurance</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.primary.payerId">Insurance Provider*</label>
                    <select
                      id="insuranceInfo.primary.payerId"
                      name="insuranceInfo.primary.payerId"
                      value={formData.insuranceInfo.primary.payerId}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Insurance</option>
                      {payers.map(payer => (
                        <option key={payer.id} value={payer.id}>
                          {payer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.primary.memberId">Subscriber ID / Member ID*</label>
                    <input
                      type="text"
                      id="insuranceInfo.primary.memberId"
                      name="insuranceInfo.primary.memberId"
                      value={formData.insuranceInfo.primary.memberId}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.primary.groupNumber">Group Number</label>
                    <input
                      type="text"
                      id="insuranceInfo.primary.groupNumber"
                      name="insuranceInfo.primary.groupNumber"
                      value={formData.insuranceInfo.primary.groupNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <h4>Secondary Insurance (Optional)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.secondary.payerId">Insurance Provider</label>
                    <select
                      id="insuranceInfo.secondary.payerId"
                      name="insuranceInfo.secondary.payerId"
                      value={formData.insuranceInfo.secondary.payerId}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Insurance</option>
                      {payers.map(payer => (
                        <option key={payer.id} value={payer.id}>
                          {payer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.secondary.memberId">Subscriber ID / Member ID</label>
                    <input
                      type="text"
                      id="insuranceInfo.secondary.memberId"
                      name="insuranceInfo.secondary.memberId"
                      value={formData.insuranceInfo.secondary.memberId}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="insuranceInfo.secondary.groupNumber">Group Number</label>
                    <input
                      type="text"
                      id="insuranceInfo.secondary.groupNumber"
                      name="insuranceInfo.secondary.groupNumber"
                      value={formData.insuranceInfo.secondary.groupNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            )}
            
            {modalType === 'view' && selectedPatient && (
              <div className="patient-details">
                <h4>Personal Information</h4>
                <div className="detail-row">
                  <strong>Name:</strong> {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="detail-row">
                  <strong>Date of Birth:</strong> {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                </div>
                <div className="detail-row">
                  <strong>Gender:</strong> {selectedPatient.gender}
                </div>
                <div className="detail-row">
                  <strong>Phone:</strong> {selectedPatient.phone}
                </div>
                <div className="detail-row">
                  <strong>Email:</strong> {selectedPatient.email || 'N/A'}
                </div>
                
                <h4>Address</h4>
                <div className="detail-row">
                  <strong>Street:</strong> {selectedPatient.address.street}
                </div>
                <div className="detail-row">
                  <strong>City:</strong> {selectedPatient.address.city}
                </div>
                <div className="detail-row">
                  <strong>State:</strong> {selectedPatient.address.state}
                </div>
                <div className="detail-row">
                  <strong>Zip Code:</strong> {selectedPatient.address.zipCode}
                </div>
                
                {selectedPatient.providerId && (
                  <div className="detail-row">
                    <strong>Provider:</strong> {providers.find(p => p.id === selectedPatient.providerId)?.lastName}, {providers.find(p => p.id === selectedPatient.providerId)?.firstName}
                  </div>
                )}
                
                <h4>Primary Insurance</h4>
                <div className="detail-row">
                  <strong>Provider:</strong> {payers.find(p => p.id === selectedPatient.insuranceInfo.primary.payerId)?.name || 'Unknown'}
                </div>
                <div className="detail-row">
                  <strong>Subscriber ID:</strong> {selectedPatient.insuranceInfo.primary.memberId}
                </div>
                {selectedPatient.insuranceInfo.primary.groupNumber && (
                  <div className="detail-row">
                    <strong>Group Number:</strong> {selectedPatient.insuranceInfo.primary.groupNumber}
                  </div>
                )}
                
                {selectedPatient.insuranceInfo.secondary && (
                  <>
                    <h4>Secondary Insurance</h4>
                    <div className="detail-row">
                      <strong>Provider:</strong> {payers.find(p => p.id === selectedPatient.insuranceInfo.secondary?.payerId)?.name || 'Unknown'}
                    </div>
                    <div className="detail-row">
                      <strong>Subscriber ID:</strong> {selectedPatient.insuranceInfo.secondary.memberId}
                    </div>
                    {selectedPatient.insuranceInfo.secondary.groupNumber && (
                      <div className="detail-row">
                        <strong>Group Number:</strong> {selectedPatient.insuranceInfo.secondary.groupNumber}
                      </div>
                    )}
                  </>
                )}
                
                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="btn">Close</button>
                  <button type="button" onClick={() => openModal('edit', selectedPatient)} className="btn btn-primary">Edit</button>
                </div>
              </div>
            )}
            
            {modalType === 'delete' && (
              <div className="delete-confirmation">
                <p>Are you sure you want to delete {selectedPatient?.firstName} {selectedPatient?.lastName}?</p>
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

  if (loading) return <div>Loading patients...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="patient-list-container">
      <h2>Patients</h2>
      <div className="actions-bar">
        <button 
          className="btn btn-primary" 
          onClick={() => openModal('add')}
        >
          Add New Patient
        </button>
      </div>
      
      {patients.length === 0 ? (
        <p>No patients found.</p>
      ) : (
        <div className="responsive-table-container">
          <table className="responsive-table">
            <thead>
              <tr>
                <th className="always-visible">Name</th>
                <th className="visible-md">Date of Birth</th>
                <th className="visible-lg">Gender</th>
                <th className="visible-md">Phone</th>
                <th className="visible-lg">Primary Insurance</th>
                <th className="visible-lg">Subscriber ID</th>
                <th className="visible-md">Provider</th>
                <th className="always-visible">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="always-visible">{`${patient.lastName}, ${patient.firstName}`}</td>
                  <td className="visible-md" data-label="DOB">{new Date(patient.dateOfBirth).toLocaleDateString()}</td>
                  <td className="visible-lg" data-label="Gender">{patient.gender}</td>
                  <td className="visible-md" data-label="Phone">{patient.phone}</td>
                  <td className="visible-lg" data-label="Insurance">{payers.find(p => p.id === patient.insuranceInfo.primary.payerId)?.name || 'Unknown'}</td>
                  <td className="visible-lg" data-label="Subscriber ID">{patient.insuranceInfo.primary.memberId}</td>
                  <td className="visible-md" data-label="Provider">{patient.providerId ? 
                      `${providers.find(p => p.id === patient.providerId)?.lastName || ''}, ${providers.find(p => p.id === patient.providerId)?.firstName || ''}` : 
                      'None'}</td>
                  <td className="actions always-visible">
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => openModal('view', patient)}
                    >
                      View
                    </button>
                    <button 
                      className="btn btn-primary btn-sm visible-md"
                      onClick={() => openModal('edit', patient)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-danger btn-sm visible-md"
                      onClick={() => openModal('delete', patient)}
                    >
                      Delete
                    </button>
                    <div className="mobile-actions visible-sm">
                      <button 
                        className="btn btn-sm dropdown-toggle"
                        onClick={(e) => {
                          const dropdown = e.currentTarget.nextElementSibling;
                          if (dropdown) {
                            dropdown.classList.toggle('show');
                          }
                        }}
                      >
                        ⋮
                      </button>
                      <div className="dropdown-menu">
                        <button onClick={() => openModal('edit', patient)}>Edit</button>
                        <button onClick={() => openModal('delete', patient)}>Delete</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {renderModal()}
    </div>
  );
};

export default PatientList; 