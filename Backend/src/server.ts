import express, { Request, Response, NextFunction } from 'express';
import { config, validateConfig } from './config/env.js';
import { corsOptions } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import transactionRoutes from './routes/transaction.js';
import ugfRoutes from './routes/ugf.js';

const app = express();

app.use(corsOptions);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', chatRoutes);
app.use('/api', transactionRoutes);
app.use('/api', ugfRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    validateConfig();

    app.listen(config.port, () => {
      logger.info(`🚀 Server running on http://localhost:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
