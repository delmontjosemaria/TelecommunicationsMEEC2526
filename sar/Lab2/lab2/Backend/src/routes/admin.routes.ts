import { Router } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middlewares/admin.middleware';
import { listUsers, blockUser, unblockUser, removeItem, getAuditLogs, setUserRole } from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', listUsers);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);
router.patch('/users/:id/role', requireSuperAdmin, setUserRole); // only full admins
router.delete('/items/:id', removeItem);
router.get('/audit-logs', requireSuperAdmin, getAuditLogs);

export default router;