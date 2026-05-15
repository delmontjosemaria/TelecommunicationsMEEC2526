import { NextFunction, Request, Response } from 'express';
import config from '../config/config';

/**
 * Global error handler middleware
 * Provides consistent error responses across the application
 */
const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const appError = err as {
    statusCode?: number;
    status?: string;
    message?: string;
    stack?: string;
  };

  // Set default error code and status
  const statusCode = appError.statusCode || 500;
  const status = appError.status || 'error';
  const message = appError.message || 'Internal server error';
  
  // Log the error for server-side debugging
  console.error(`Error: ${statusCode} - ${message}`);
  console.error(`Path: ${req.originalUrl}, Method: ${req.method}`);
  
  // Different error responses for development vs production
  if (config.nodeEnv === 'development') {
    // More detailed error response in development
    res.status(statusCode).json({
      status,
      message,
      stack: appError.stack,
      error: appError
    });
  } else {
    // Cleaner error response in production
    res.status(statusCode).json({
      status,
      message
    });
  }
};

export default errorHandler;