import mongoose, { Schema, Document } from 'mongoose';

// Item interface defining the document structure
export interface IItem extends Document {
  title: string;
  description: string;
  currentbid: number;
  reservePrice: number;
  initialNumber: number;
  remainingtime: number;
  buynow: number;
  wininguser: string;
  sold: boolean;
  owner: string;
  isActive: boolean;
  lastBidDate: Date;
  flaggedAt?: Date;
  flaggedReason?: string;
}

// Item schema definition
const ItemSchema = new Schema({
  title: {type: String, required: true},
  description: {type: String, required: true},
  currentbid: Number,
  reservePrice: Number,
  initialTime: Number,
  remainingtime: Number,
  buynow: Number,
  wininguser: String,
  sold: {type: Boolean, default: false},
  owner: String,
  isActive: {type: Boolean, default: true},
  lastBidDate: Date,
  flaggedAt: Date,
  flaggedReason: String
},{timestamps:true,
    toJSON: {
      virtuals: true,      
      versionKey: false    
    }},
);

// Add index for better query performance
ItemSchema.index({ sold: 1, remainingtime: 1 });

// Export the model
export default mongoose.model<IItem>('Item', ItemSchema);