import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../server/routes';

const app = express();

// 1. Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 2. Request Body Parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 3. Mount Backend API Router at both /api and root (handles Vercel rewrite nuances)
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 4. Safe Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Vercel Serverless API error:', err?.message || 'Unknown error');
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred while processing your request.',
  });
});

export default app;
