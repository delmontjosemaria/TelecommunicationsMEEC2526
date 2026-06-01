import mongoose, { Schema, Document } from 'mongoose';

// Item interface defining the document structure
export interface IItem extends Document {
  title: string;
  description: string;
  currentbid: number;
  reservePrice: number;
  remainingtime: number;
  buynow: number;
  wininguser: string;
  sold: boolean;
  owner: string;
  id: number;
  isActive: boolean;
  lastBidDate: Date;
}

// Item schema definition
const ItemSchema = new Schema({
  title: String,
  description: String,
  currentbid: Number,
  reservePrice: Number,
  remainingtime: Number,
  buynow: Number,
  wininguser: String,
  sold: {type: Boolean, default: false},
  owner: String,
  id: Number,
  isActive: {type: Boolean, default: true},
  lastBidDate: Date
});

// Add index for better query performance
ItemSchema.index({ sold: 1, remainingtime: 1 });

// Export the model
export default mongoose.model<IItem>('Item', ItemSchema);