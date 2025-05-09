import mongoose, { Document, Schema } from 'mongoose';

export interface IPayer extends Document {
  name: string;
  payerId: string; // Unique identifier for the insurance company
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  email: string;
  electronicPayer: boolean; // Indicates if the payer accepts electronic claims
  payerType: string; // Medicare, Medicaid, Commercial, etc.
  createdAt: Date;
  updatedAt: Date;
}

const PayerSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    payerId: { type: String, required: true, unique: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true }
    },
    phone: { type: String, required: true },
    email: { type: String },
    electronicPayer: { type: Boolean, default: true },
    payerType: { 
      type: String, 
      required: true, 
      enum: ['Medicare', 'Medicaid', 'Commercial', 'BlueCross', 'Other'] 
    }
  },
  { timestamps: true }
);

export default mongoose.model<IPayer>('Payer', PayerSchema); 