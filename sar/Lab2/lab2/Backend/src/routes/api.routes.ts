import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as itemController from '../controllers/item.controller';
import { authenticate, handleJwtError } from '../middlewares/auth.middleware';
import {authLimiter, bidLimiter} from '../middlewares/rateLimit.middleware';
import adminRoutes from './admin.routes';

const router = Router();

// Auth routes
router.post('/authenticate', authLimiter,authController.authenticate);
router.post('/newuser', authLimiter, authController.registerUser);
router.get('/users', authenticate, authController.getUsers);

// Item routes
router.post('/newitem', authenticate, itemController.createItem);
router.post('/updateitem/:id', authenticate, itemController.updateItem);
router.post('/removeitem', authenticate, itemController.removeItem);
router.get('/items', authenticate, itemController.getItems);

// Bid route
router.post('/placebid/:id', bidLimiter, authenticate, itemController.placeBid);

// Admin routes
router.use('/admin', adminRoutes);

// Handle JWT errors
router.use(handleJwtError);


export default router;