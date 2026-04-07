import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { AppError } from './utils/errors.js';
import logger from './utils/logger.js';
import adminRouter from './routes/admin.js';
import notificationsRouter from './routes/notifications.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: '50mb' }));
  app.use(rateLimiter);

  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info({ method: req.method, path: req.path });
    next();
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      logger.error({ err, path: req.path });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
}

export default createApp();
