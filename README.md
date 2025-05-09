# Healthcare Charge Entry Application

A web-based application for healthcare charge entry and claim generation that is EHR agnostic.

## Features

- Patient management
- Payer setup and configuration
- Procedure code management with support for time-based billing
- Simple charge entry with automatic unit calculation based on minutes
- Support for modifiers (e.g., telehealth)
- Claim file generation for clearinghouse submission

## Project Structure

The project is a full-stack JavaScript application with:

- Frontend: React with TypeScript
- Backend: Node.js, Express, and TypeScript
- Database: MongoDB

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Set up the backend:

```bash
cd server
npm install
# Create a .env file with MongoDB connection string and other configuration
npm run dev
```

3. Set up the frontend:

```bash
cd client
npm install
npm start
```

## API Endpoints

### Patients

- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get a patient by ID
- `POST /api/patients` - Create a patient
- `PUT /api/patients/:id` - Update a patient
- `DELETE /api/patients/:id` - Delete a patient
- `GET /api/patients/search/:query` - Search patients

### Payers

- `GET /api/payers` - Get all payers
- `GET /api/payers/:id` - Get a payer by ID
- `POST /api/payers` - Create a payer
- `PUT /api/payers/:id` - Update a payer
- `DELETE /api/payers/:id` - Delete a payer
- `GET /api/payers/search/:query` - Search payers

### Procedures

- `GET /api/procedures` - Get all procedures
- `GET /api/procedures/:id` - Get a procedure by ID
- `POST /api/procedures` - Create a procedure
- `PUT /api/procedures/:id` - Update a procedure
- `DELETE /api/procedures/:id` - Delete a procedure
- `GET /api/procedures/search/:query` - Search procedures

### Charges

- `GET /api/charges` - Get all charges
- `GET /api/charges/:id` - Get a charge by ID
- `GET /api/charges/patient/:patientId` - Get charges by patient ID
- `POST /api/charges` - Create a charge
- `PUT /api/charges/:id` - Update a charge
- `DELETE /api/charges/:id` - Delete a charge
- `GET /api/charges/status/:status` - Get charges by status
- `POST /api/charges/generate-claim` - Generate a claim file

## License

ISC 