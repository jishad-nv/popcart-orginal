import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes';
import createOrderHandler from './api/create-order';
import verifyPaymentHandler from './api/verify-payment';
import razorpayWebhookHandler from './api/razorpay-webhook';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Security Headers Middleware (Phase 11 Hardening)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // 2. Request body parsing with strict safe limits
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 3. Mount Vercel Serverless Payment Handlers & Backend API Router
  app.all('/api/create-order', (req, res) => createOrderHandler(req, res));
  app.all('/api/verify-payment', (req, res) => verifyPaymentHandler(req, res));
  app.all('/api/razorpay-webhook', (req, res) => razorpayWebhookHandler(req, res));
  app.use('/api', apiRouter);

  // 4. Vite Dev Middlewares in development, or Static in production
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // 5. Global Safe Error Handler (Phase 15 - Never leaks stack traces/paths)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error intercepted:', err?.message || 'Unknown error');
    res.status(err.status || 500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request.',
    });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Popcarty Hardened Backend Server running on http://localhost:${PORT}`);
  });
}

// Global Process Handlers for Unhandled Errors
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection caught:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught:', err.message);
});

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
