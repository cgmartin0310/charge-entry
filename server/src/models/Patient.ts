import mongoose, { Document, Schema } from 'mongoose';

export interface IPatient extends Document {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  email: string;
  insuranceInfo: {
    primary: {
      payerId: mongoose.Types.ObjectId;
      memberId: string;
      groupNumber?: string;
    };
    secondary?: {
      payerId: mongoose.Types.ObjectId;
      memberId: string;
      groupNumber?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['male', 'female', 'other'] },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true }
    },
    phone: { type: String, required: true },
    email: { type: String, required: false },
    insuranceInfo: {
      primary: {
        payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payer', required: true },
        memberId: { type: String, required: true },
        groupNumber: { type: String }
      },
      secondary: {
        payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payer' },
        memberId: { type: String },
        groupNumber: { type: String }
      }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IPatient>('Patient', PatientSchema); 