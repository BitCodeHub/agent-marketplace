/**
 * Logging Configuration
 * 
 * Centralized logging setup using Winston with structured JSON output,
 * multiple transports, and log aggregation support.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Colors for console output
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
};

winston.addColors(LOG_COLORS);

// Determine log level from environment
const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || 
         (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
};

// Determine log format from environment
const getLogFormat = () => {
  const format = process.env.LOG_FORMAT || 
                 (process.env.NODE_ENV === 'production' ? 'json' : 'pretty');
  
  if (format === 'json') {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }
  
  // Pretty format for development
  return winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
      }
      return msg;
    })
  );
};

// Default metadata
const defaultMeta = {
  service: 'agent-marketplace',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
};

// Create file transport options
const createFileTransport = (
  filename: string,
  level?: string
): winston.transports.FileTransportOptions => ({
  filename: path.join(logsDir, filename),
  level,
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 14, // Keep 14 days
  tailable: true,
  zippedArchive: true,
});

// Create the logger
const logger = winston.createLogger({
  level: getLogLevel(),
  levels: LOG_LEVELS,
  defaultMeta,
  format: getLogFormat(),
  transports: [
    // Write all logs to combined.log
    new winston.transports.File(createFileTransport('combined.log')),
    
    // Write error logs to error.log
    new winston.transports.File({
      ...createFileTransport('error.log'),
      level: 'error',
    }),
    
    // Write HTTP logs to access.log
    new winston.transports.File({
      ...createFileTransport('access.log'),
      level: 'http',
    }),
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') }),
    new winston.transports.Console(),
  ],
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') }),
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: getLogFormat(),
  }));
}

// Add console transport in production if explicitly enabled
if (process.env.LOG_TO_CONSOLE === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }));
}

// HTTP request logging stream for Morgan
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Request context middleware
export interface LogContext {
  requestId: string;
  userId?: string;
  path?: string;
  method?: string;
}

let currentContext: LogContext | null = null;

export function setLogContext(context: LogContext): void {
  currentContext = context;
}

export function clearLogContext(): void {
  currentContext = null;
}

export function getLogContext(): LogContext | null {
  return currentContext;
}

// Enhanced logging methods with context
const loggerWithContext = {
  error: (message: string, meta?: Record<string, any>) => {
    logger.error(message, { ...currentContext, ...meta });
  },
  warn: (message: string, meta?: Record<string, any>) => {
    logger.warn(message, { ...currentContext, ...meta });
  },
  info: (message: string, meta?: Record<string, any>) => {
    logger.info(message, { ...currentContext, ...meta });
  },
  http: (message: string, meta?: Record<string, any>) => {
    logger.http(message, { ...currentContext, ...meta });
  },
  verbose: (message: string, meta?: Record<string, any>) => {
    logger.verbose(message, { ...currentContext, ...meta });
  },
  debug: (message: string, meta?: Record<string, any>) => {
    logger.debug(message, { ...currentContext, ...meta });
  },
  silly: (message: string, meta?: Record<string, any>) => {
    logger.silly(message, { ...currentContext, ...meta });
  },
  // Raw access to Winston
  raw: logger,
};

// Log rotation helper
export function rotateLogs(): void {
  logger.info('Rotating log files');
  // Winston handles rotation automatically via maxsize/maxFiles
  // This is for manual rotation trigger if needed
}

// Get recent logs
export function getRecentLogs(
  level: string = 'info',
  lines: number = 100
): string[] {
  const logFile = level === 'error' 
    ? path.join(logsDir, 'error.log')
    : path.join(logsDir, 'combined.log');
  
  try {
    const content = fs.readFileSync(logFile, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

// Metrics logging
export function logMetrics(metrics: Record<string, number>): void {
  logger.info('Metrics snapshot', metrics);
}

// Performance logging
export function logPerformance(
  operation: string,
  durationMs: number,
  meta?: Record<string, any>
): void {
  logger.info(`Performance: ${operation} took ${durationMs}ms`, {
    operation,
    durationMs,
    ...meta,
  });
}

// Error logging with stack trace
export function logError(
  error: Error,
  context?: string,
  meta?: Record<string, any>
): void {
  logger.error(context || error.message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...meta,
  });
}

// Security event logging
export function logSecurity(
  event: string,
  meta?: Record<string, any>
): void {
  logger.warn(`Security: ${event}`, {
    securityEvent: event,
    ...meta,
  });
}

// Audit logging
export function logAudit(
  action: string,
  actor: string,
  target: string,
  meta?: Record<string, any>
): void {
  logger.info(`Audit: ${action}`, {
    audit: true,
    action,
    actor,
    target,
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

// Export logger
export default loggerWithContext;
export { logger };
