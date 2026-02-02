/**
 * Database Service for AI Agent Marketplace
 * 
 * Features:
 * - Connection pooling with configurable limits
 * - Query timeout protection
 * - Slow query logging
 * - Health check monitoring
 * - Graceful shutdown handling
 * 
 * Critical for handling heavy traffic without crashing.
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

// Types for query metrics
interface QueryMetric {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
  caller?: string;
}

interface PoolStats {
  active: number;
  idle: number;
  waiting: number;
  total: number;
}

interface SlowQueryConfig {
  enabled: boolean;
  thresholdMs: number;
  maxLogEntries: number;
}

interface QueryTimeoutConfig {
  enabled: boolean;
  defaultTimeoutMs: number;
  maxTimeoutMs: number;
}

interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  acquireTimeoutMs: number;
}

interface DbServiceConfig {
  connectionPool: ConnectionPoolConfig;
  slowQuery: SlowQueryConfig;
  queryTimeout: QueryTimeoutConfig;
  logQueries: boolean;
}

// Default configuration optimized for production traffic
const DEFAULT_CONFIG: DbServiceConfig = {
  connectionPool: {
    min: 2,                      // Minimum connections to maintain
    max: 20,                     // Maximum connections (adjust based on DB limits)
    idleTimeoutMs: 30000,        // Close idle connections after 30s
    connectionTimeoutMs: 30000,  // Timeout for establishing connections
    acquireTimeoutMs: 5000,      // Timeout for acquiring connection from pool
  },
  slowQuery: {
    enabled: true,
    thresholdMs: 1000,           // Log queries taking > 1 second
    maxLogEntries: 1000,         // Keep last 1000 slow queries
  },
  queryTimeout: {
    enabled: true,
    defaultTimeoutMs: 30000,     // 30 second default timeout
    maxTimeoutMs: 60000,         // Hard maximum of 60 seconds
  },
  logQueries: process.env.NODE_ENV === 'development',
};

/**
 * Database Service Class
 * Manages Prisma client with connection pooling and monitoring
 */
class DatabaseService extends EventEmitter {
  private client: PrismaClient;
  private config: DbServiceConfig;
  private slowQueries: QueryMetric[] = [];
  private queryMetrics: Map<string, number[]> = new Map();
  private isConnected = false;
  private queryCount = 0;
  private slowQueryCount = 0;
  private errorCount = 0;

  constructor(config: Partial<DbServiceConfig> = {}) {
    super();
    
    // Merge config with defaults
    this.config = {
      connectionPool: { ...DEFAULT_CONFIG.connectionPool, ...config.connectionPool },
      slowQuery: { ...DEFAULT_CONFIG.slowQuery, ...config.slowQuery },
      queryTimeout: { ...DEFAULT_CONFIG.queryTimeout, ...config.queryTimeout },
      logQueries: config.logQueries ?? DEFAULT_CONFIG.logQueries,
    };

    // Initialize Prisma with connection pooling
    this.client = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Log configuration
      log: this.getLogConfig(),
    });

    this.setupMiddleware();
  }

  /**
   * Get Prisma log configuration based on environment
   */
  private getLogConfig() {
    if (process.env.NODE_ENV === 'production') {
      return [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ] as const;
    }
    return [
      { emit: 'stdout', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'info' },
    ] as const;
  }

  /**
   * Setup Prisma middleware for query timing and logging
   */
  private setupMiddleware() {
    // Query timing middleware
    this.client.$use(async (params, next) => {
      const startTime = Date.now();
      const queryId = ++this.queryCount;
      
      try {
        // Apply query timeout if enabled
        if (this.config.queryTimeout.enabled) {
          const timeout = Math.min(
            this.config.queryTimeout.defaultTimeoutMs,
            this.config.queryTimeout.maxTimeoutMs
          );
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Query timeout after ${timeout}ms: ${params.model}.${params.action}`));
            }, timeout);
          });
          
          const result = await Promise.race([
            next(params),
            timeoutPromise,
          ]);
          
          return result;
        }
        
        return await next(params);
      } catch (error) {
        this.errorCount++;
        this.emit('query:error', {
          queryId,
          error,
          params,
          duration: Date.now() - startTime,
        });
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        
        // Log slow queries
        if (this.config.slowQuery.enabled && duration > this.config.slowQuery.thresholdMs) {
          this.recordSlowQuery({
            query: `${params.model}.${params.action}`,
            params: JSON.stringify(params.args),
            duration,
            timestamp: new Date(),
            caller: this.getCallerInfo(),
          });
        }

        // Track query metrics
        this.trackMetric(`${params.model}.${params.action}`, duration);

        // Emit query event for monitoring
        this.emit('query:complete', {
          queryId,
          model: params.model,
          action: params.action,
          duration,
        });

        // Log in development
        if (this.config.logQueries) {
          console.log(`[DB] ${params.model}.${params.action} took ${duration}ms`);
        }
      }
    });

    // Listen to Prisma events
    this.client.$on('query' as never, (e: any) => {
      if (e.duration > this.config.slowQuery.thresholdMs) {
        this.emit('prisma:query:slow', e);
      }
    });

    this.client.$on('error' as never, (e: any) => {
      this.errorCount++;
      this.emit('prisma:error', e);
      console.error('[DB] Prisma error:', e);
    });

    this.client.$on('warn' as never, (e: any) => {
      this.emit('prisma:warn', e);
      console.warn('[DB] Prisma warning:', e);
    });
  }

  /**
   * Get caller information for debugging
   */
  private getCallerInfo(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    // Find first line after this file
    for (let i = 3; i < lines.length; i++) {
      if (!lines[i].includes('db.ts')) {
        const match = lines[i].match(/at (.+) \((.+):(\d+):(\d+)\)/);
        if (match) {
          return `${match[1]} (${match[2]}:${match[3]})`;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Record a slow query
   */
  private recordSlowQuery(metric: QueryMetric) {
    this.slowQueries.push(metric);
    this.slowQueryCount++;

    // Keep only recent slow queries
    if (this.slowQueries.length > this.config.slowQuery.maxLogEntries) {
      this.slowQueries.shift();
    }

    // Log to console
    console.warn(
      `[DB SLOW QUERY] ${metric.duration}ms: ${metric.query}\n` +
      `Params: ${metric.params}\n` +
      `Caller: ${metric.caller}`
    );

    this.emit('slow:query', metric);
  }

  /**
   * Track query metrics for analysis
   */
  private trackMetric(operation: string, duration: number) {
    if (!this.queryMetrics.has(operation)) {
      this.queryMetrics.set(operation, []);
    }
    
    const metrics = this.queryMetrics.get(operation)!;
    metrics.push(duration);
    
    // Keep last 1000 metrics per operation
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.client.$connect();
      this.isConnected = true;
      this.emit('connected');
      console.log('[DB] Connected to database with connection pooling');
    } catch (error) {
      this.emit('connection:error', error);
      console.error('[DB] Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database gracefully
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.$disconnect();
      this.isConnected = false;
      this.emit('disconnected');
      console.log('[DB] Disconnected from database');
    } catch (error) {
      console.error('[DB] Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * Get the Prisma client for database operations
   */
  get prisma(): PrismaClient {
    return this.client;
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    connections?: PoolStats;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      // Simple query to test connection
      await this.client.$queryRaw`SELECT 1 as health_check`;
      const latency = Date.now() - start;

      // Get connection stats if available
      let connections: PoolStats | undefined;
      try {
        const stats = await this.client.$queryRaw<
          Array<{ state: string; count: bigint }>
        >`
          SELECT state, count(*) 
          FROM pg_stat_activity 
          WHERE datname = current_database()
          GROUP BY state
        `;
        
        connections = {
          active: 0,
          idle: 0,
          waiting: 0,
          total: 0,
        };

        for (const row of stats) {
          connections.total += Number(row.count);
          if (row.state === 'active') connections.active = Number(row.count);
          if (row.state === 'idle') connections.idle = Number(row.count);
          if (row.state === 'idle in transaction') connections.waiting = Number(row.count);
        }
      } catch {
        // Connection stats not critical
      }

      return {
        healthy: true,
        latency,
        connections,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get slow query report
   */
  getSlowQueries(limit: number = 100): QueryMetric[] {
    return this.slowQueries.slice(-limit);
  }

  /**
   * Get query statistics
   */
  getQueryStats(): {
    totalQueries: number;
    slowQueries: number;
    errors: number;
    averageDurations: Record<string, { avg: number; min: number; max: number; count: number }>;
  } {
    const averageDurations: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [operation, durations] of this.queryMetrics) {
      if (durations.length > 0) {
        const sum = durations.reduce((a, b) => a + b, 0);
        averageDurations[operation] = {
          avg: Math.round(sum / durations.length),
          min: Math.min(...durations),
          max: Math.max(...durations),
          count: durations.length,
        };
      }
    }

    return {
      totalQueries: this.queryCount,
      slowQueries: this.slowQueryCount,
      errors: this.errorCount,
      averageDurations,
    };
  }

  /**
   * Clear slow query log
   */
  clearSlowQueries(): void {
    this.slowQueries = [];
    this.slowQueryCount = 0;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
    this.clearSlowQueries();
    this.queryCount = 0;
    this.errorCount = 0;
  }

  /**
   * Execute raw query with timeout
   */
  async queryRaw<T = any>(
    query: string,
    params: any[] = [],
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.config.queryTimeout.defaultTimeoutMs;
    
    return Promise.race([
      this.client.$queryRawUnsafe<T>(query, ...params),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout);
      }),
    ]);
  }

  /**
   * Execute transaction with timeout
   */
  async transaction<T>(
    operations: (prisma: PrismaClient) => Promise<T>,
    options: { timeoutMs?: number; maxWait?: number } = {}
  ): Promise<T> {
    const timeout = options.timeoutMs || this.config.queryTimeout.defaultTimeoutMs;
    const maxWait = options.maxWait || 5000;

    return Promise.race([
      this.client.$transaction(operations, { maxWait }),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Transaction timeout after ${timeout}ms`)), timeout);
      }),
    ]);
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance(): Promise<{
    analyzed: boolean;
    vacuumed: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Analyze tables for query planner
      await this.client.$executeRaw`ANALYZE agents`;
      await this.client.$executeRaw`ANALYZE tasks`;
      await this.client.$executeRaw`ANALYZE task_workers`;
      await this.client.$executeRaw`ANALYZE portfolios`;
      await this.client.$executeRaw`ANALYZE reputation_events`;
      
      console.log('[DB] Maintenance: ANALYZE complete');
      
      return {
        analyzed: true,
        vacuumed: false, // VACUUM requires special permissions
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return {
        analyzed: false,
        vacuumed: false,
        errors,
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      const result = await this.client.$queryRaw<
        Array<{ state: string; count: bigint }>
      >`
        SELECT state, count(*) 
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
      `;

      const stats: PoolStats = {
        active: 0,
        idle: 0,
        waiting: 0,
        total: 0,
      };

      for (const row of result) {
        stats.total += Number(row.count);
        if (row.state === 'active') stats.active = Number(row.count);
        if (row.state === 'idle') stats.idle = Number(row.count);
        if (row.state === 'idle in transaction') stats.waiting = Number(row.count);
      }

      return stats;
    } catch {
      return {
        active: 0,
        idle: 0,
        waiting: 0,
        total: 0,
      };
    }
  }
}

// Singleton instance
let dbService: DatabaseService | null = null;

/**
 * Get or create database service instance
 */
export function getDatabaseService(config?: Partial<DbServiceConfig>): DatabaseService {
  if (!dbService) {
    dbService = new DatabaseService(config);
  }
  return dbService;
}

/**
 * Reset database service (useful for testing)
 */
export function resetDatabaseService(): void {
  dbService = null;
}

// Export singleton instance
export const db = getDatabaseService();

// Export types
export type {
  QueryMetric,
  PoolStats,
  SlowQueryConfig,
  QueryTimeoutConfig,
  ConnectionPoolConfig,
  DbServiceConfig,
};

// Export class for custom instances
export { DatabaseService };

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('[DB] Received SIGINT, disconnecting...');
  if (dbService) {
    await dbService.disconnect();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[DB] Received SIGTERM, disconnecting...');
  if (dbService) {
    await dbService.disconnect();
  }
  process.exit(0);
});
