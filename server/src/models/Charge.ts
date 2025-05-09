import mongoose, { Document, Schema } from 'mongoose';
import { IProcedure } from './Procedure';

export interface ICharge extends Document {
  patient: mongoose.Types.ObjectId;
  serviceDate: Date;
  provider: string; // Provider who performed the service
  procedure: mongoose.Types.ObjectId;
  minutes: number; // Actual minutes spent
  units: number; // Calculated units based on minutes
  modifiers: string[]; // Up to 4 modifiers
  diagnosisCodes: string[]; // ICD-10 codes
  chargeAmount: number;
  status: string; // new, submitted, denied, paid, etc.
  payerId: mongoose.Types.ObjectId; // Payer for this specific charge
  claimInfo: {
    claimNumber?: string;
    submissionDate?: Date;
    responseDate?: Date;
  };
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChargeSchema: Schema = new Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    serviceDate: { type: Date, required: true },
    provider: { type: String, required: true },
    procedure: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', required: true },
    minutes: { type: Number, required: true },
    units: { type: Number, required: true },
    modifiers: [{ type: String, maxlength: 2 }], // Most modifiers are 2 characters
    diagnosisCodes: [{ type: String, required: true }],
    chargeAmount: { type: Number, required: true },
    status: { 
      type: String, 
      required: true, 
      enum: ['new', 'ready', 'submitted', 'denied', 'paid', 'adjustment'],
      default: 'new'
    },
    payerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payer', required: true },
    claimInfo: {
      claimNumber: { type: String },
      submissionDate: { type: Date },
      responseDate: { type: Date }
    },
    notes: { type: String }
  },
  { timestamps: true }
);

// Create a utility function to calculate units based on minutes and rounding rule
ChargeSchema.pre('save', async function(next) {
  try {
    if (this.isModified('minutes') || this.isNew) {
      // Get the procedure document
      const Procedure = mongoose.model<IProcedure>('Procedure');
      const procedure = await Procedure.findById(this.procedure);
      
      if (procedure && procedure.timeBasedBilling) {
        const { minutesPerUnit, roundingRule } = procedure;
        let units = this.minutes / minutesPerUnit;
        
        // Apply rounding rule
        switch (roundingRule) {
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
            units = Math.ceil(units); // Default to rounding up
        }
        
        this.units = Math.max(1, units); // Ensure at least 1 unit
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

export default mongoose.model<ICharge>('Charge', ChargeSchema); 