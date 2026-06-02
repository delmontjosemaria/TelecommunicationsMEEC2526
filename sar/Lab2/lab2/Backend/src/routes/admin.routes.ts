import { Router } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middlewares/admin.middleware';
import { listUsers, blockUser, unblockUser, removeItem, getAuditLogs } from '../controllers/admin.controller';

const router = Router();

// All admin routes require auth + admin/mod role
router.use(requireAuth, requireAdmin);

router.get('/users', listUsers);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.delete('/items/:id', removeItem);
router.get('/audit-logs', requireSuperAdmin, getAuditLogs); // only full admins

export default router;