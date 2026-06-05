import { Request, Response } from 'express';
import User from '../models/user';
import Item from '../models/item';
import AuditLog from '../models/auditLog';

const log = async (action: string, performedBy: string, targetType: 'user' | 'item', targetId: string, reason?: string) => {
  await AuditLog.create({ action, performedBy, targetType, targetId, reason });
};

// GET /api/admin/users
export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// POST /api/admin/users/:id/block
export const blockUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.id;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false, blockedAt: new Date(), blockedReason: reason || 'No reason provided' },
      { new: true }
    );

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await log('block_user', adminId, 'user', id, reason);
    res.json({ message: 'User blocked', user });
  } catch {
    res.status(500).json({ error: 'Failed to block user' });
  }
};

// POST /api/admin/users/:id/unblock
export const unblockUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true, $unset: { blockedAt: '', blockedReason: '' } },
      { new: true }
    );

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await log('unblock_user', adminId, 'user', id);
    res.json({ message: 'User unblocked', user });
  } catch {
    res.status(500).json({ error: 'Failed to unblock user' });
  }
};

// DELETE /api/admin/items/:id
export const removeItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user.id;

    const item = await Item.findByIdAndUpdate(
      id,
      { isActive: false, flaggedAt: new Date(), flaggedReason: reason || 'Removed by moderator' },
      { new: true }
    );

    if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

    await log('remove_item', adminId, 'item', id, reason);
    res.json({ message: 'Item removed', item });
  } catch {
    res.status(500).json({ error: 'Failed to remove item' });
  }
};

// GET /api/admin/audit-logs
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find().sort({createdAt: -1}).limit(200);
    res.json(logs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// PATCH /api/admin/users/:id/role  (admin only)
export const setUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = (req as any).user.id;
 
    if (!['user', 'moderator', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
 
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
 
    await log('set_role', adminId, 'user', id, `role set to ${role}`);
    res.json({ message: 'Role updated', user });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
};
