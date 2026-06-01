import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

// User interface defining the document structure
export interface IUser extends Document {
  name: string;
  email: string;
  username: string;
  password: string;
  isLogged: boolean;
  latitude: number;
  longitude: number;
  isActive: boolean;
  role: string;
  lastLoginAt?: Date;
}

// User schema definition
const UserSchema = new Schema<IUser>({
  name: String,
  email: {type: String, required: true, unique: true},
  username: {type: String, required: true, unique: true, trim: true},
  password: {type: String, required: true},
  isLogged: Boolean,
  latitude: Number,
  longitude: Number,
  isActive: {type: Boolean, default: true},
  role: {type: String, enum: ['user', 'admin', 'moderator'], default: 'user'},
  lastLoginAt: Date
},{timestamps:true});

UserSchema.pre('save', async function(next){
  if (!this.isModified('password'))
    return next();

  try{
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  }
  catch(error){
    next(error as Error);
  }
});

// Export the model
export default mongoose.model<IUser>('User', UserSchema);