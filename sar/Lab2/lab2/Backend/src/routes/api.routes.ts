import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';
import { authenticate, handleJwtError } from '../middlewares/auth.middleware';

const router = Router();

// Auth routes
router.post('/authenticate', authController.authenticate);
router.post('/newuser', authController.registerUser);
router.get('/users', authenticate, authController.getUsers);

// Item routes
router.post('/newitem', authenticate, itemController.createItem);
router.post('/updateitem/:id', authenticate, itemController.updateItem);
router.post('/removeitem', authenticate, itemController.removeItem);
router.get('/items', authenticate, itemController.getItems);

// Bid route
router.post('/placebid/:id', authenticate, itemController.placeBid);

// Handle JWT errors
router.use(handleJwtError);

/*
import adminRoutes from './routes/admin.routes';
import { authLimiter, bidLimiter } from '../middlewares/rateLimit.middleware';
 
// Dentro do router:
router.use('/admin', adminRoutes);
 
// Nas rotas de auth (login/register):
router.post('/auth/login', authLimiter, loginController);
router.post('/auth/register', authLimiter, registerController);
 
// Nas rotas de bid:
router.post('/items/:id/bid', bidLimiter, placeBid);

*/

export default router;