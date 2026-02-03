import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Import services
import { db } from './services/db';
import logger, { httpLogStream, setLogContext, clearLogContext } from './utils/logger';

// Import health check handlers
import {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} from './monitoring/health-check';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Request tracking middleware
app.use((req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  // Set request context for logging
  setLogContext({
    requestId,
    path: req.path,
    method: req.method,
  });
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.http(`${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    });
    clearLogContext();
  });
  
  next();
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: httpLogStream,
}));

// Health check endpoints
app.get('/health', basicHealthCheck);
app.get('/health/detailed', detailedHealthCheck);
app.get('/health/ready', readinessCheck);
app.get('/health/live', livenessCheck);

// Simple metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const dbHealth = await db.healthCheck();
    const stats = db.getQueryStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      database: {
        healthy: dbHealth.healthy,
        latency: dbHealth.latency,
        connections: dbHealth.connections,
        stats: {
          totalQueries: stats.totalQueries,
          slowQueries: stats.slowQueries,
          errors: stats.errors,
        },
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes placeholder
app.get(API_PREFIX, (_req, res) => {
  res.json({
    name: 'AI Agent Marketplace API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    status,
    path: req.path,
    method: req.method,
  });
  
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    requestId: req.get('X-Request-ID'),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown handling
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Close database connection
    await db.disconnect();
    logger.info('Database disconnected');
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: (error as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await db.connect();
    logger.info('Database connected successfully');
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
      });
      logger.info(`📚 API available at http://localhost:${PORT}${API_PREFIX}`);
      logger.info(`💚 Health check at http://localhost:${PORT}/health`);
      logger.info(`📊 Detailed health at http://localhost:${PORT}/health/detailed`);
    });
  } catch (error) {
    logger.error('Failed to start server', { 
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
}

startServer();

export default app;
