import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const rateLimitResponse = (retryAfter: number) => ({
  error: 'Too many requests',
  retryAfter
});

// Auth: 5 requests / 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    res.status(429).json(rateLimitResponse(Math.ceil(options.windowMs / 1000)));
  }
});

// Bids: 30 requests / min
export const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    res.status(429).json(rateLimitResponse(Math.ceil(options.windowMs / 1000)));
  }
});

// General API: 100 requests / min
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
    res.status(429).json(rateLimitResponse(Math.ceil(options.windowMs / 1000)));
  }
});