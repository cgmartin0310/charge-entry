import mongoose, { Document, Schema } from 'mongoose';

export interface IProcedure extends Document {
  code: string; // CPT or HCPCS code
  description: string;
  defaultUnits: number;
  timeBasedBilling: boolean;
  roundingRule: 'nearest' | 'up' | 'down'; // How to round minutes
  minutesPerUnit: number; // For time-based billing
  validModifiers: string[]; // Valid modifiers that can be used with this procedure
  createdAt: Date;
  updatedAt: Date;
}

const ProcedureSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    defaultUnits: { type: Number, required: true, default: 1 },
    timeBasedBilling: { type: Boolean, default: true },
    roundingRule: { 
      type: String, 
      required: true, 
      enum: ['nearest', 'up', 'down'],
      default: 'up'
    },
    minutesPerUnit: { 
      type: Number, 
      required: function(this: any): boolean { return this.timeBasedBilling; },
      default: 15
    },
    validModifiers: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model<IProcedure>('Procedure', ProcedureSchema); 