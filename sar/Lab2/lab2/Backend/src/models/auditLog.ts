import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  performedBy: string; // admin/mod userId
  targetType: 'user' | 'item';
  targetId: string;
  reason?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true }, //'block_user', 'remove_item', por exemplo
  performedBy: { type: String, required: true },
  targetType: { type: String, enum: ['user', 'item'], required: true },
  targetId: { type: String, required: true },
  reason: String
}, { timestamps: true });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);