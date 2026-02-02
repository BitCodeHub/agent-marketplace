/**
 * Health Check Endpoint Configuration
 * 
 * Provides comprehensive health monitoring for the AI Agent Marketplace
 * including database connectivity, API response times, blockchain connectivity,
 * and service dependencies.
 */

import { Request, Response } from 'express';
import { db } from '../src/services/db';
import { ethers } from 'ethers';
import os from 'os';

// Health check configuration
const HEALTH_CONFIG = {
  // Timeouts for dependency checks (ms)
  timeouts: {
    database: 5000,
    blockchain: 10000,
    memory: 1000,
    disk: 2000,
  },
  
  // Thresholds for health status
  thresholds: {
    memoryWarningPercent: 80,
    memoryCriticalPercent: 95,
    diskWarningPercent: 85,
    diskCriticalPercent: 95,
    maxDbLatencyMs: 1000,
    maxApiLatencyMs: 500,
  },
  
  // Check intervals
  intervals: {
    database: 30000,    // 30 seconds
    blockchain: 60000,  // 1 minute
    system: 15000,      // 15 seconds
  },
};

// Health status cache
interface HealthCache {
  timestamp: number;
  database: DependencyHealth | null;
  blockchain: DependencyHealth | null;
  system: SystemHealth | null;
}

interface DependencyHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastChecked: Date;
  error?: string;
  details?: Record<string, any>;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  memory: MemoryStats;
  cpu: CpuStats;
  uptime: number;
  timestamp: Date;
}

interface MemoryStats {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface CpuStats {
  loadAverage: number[];
  usagePercent: number;
}

// In-memory health cache
const healthCache: HealthCache = {
  timestamp: 0,
  database: null,
  blockchain: null,
  system: null,
};

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<DependencyHealth> {
  const start = Date.now();
  
  try {
    const result = await Promise.race([
      db.healthCheck(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database check timeout')), HEALTH_CONFIG.timeouts.database)
      ),
    ]);
    
    const latency = Date.now() - start;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!result.healthy) {
      status = 'unhealthy';
    } else if (latency > HEALTH_CONFIG.thresholds.maxDbLatencyMs) {
      status = 'degraded';
    }
    
    return {
      status,
      latency,
      lastChecked: new Date(),
      details: result.connections ? {
        activeConnections: result.connections.active,
        idleConnections: result.connections.idle,
        waitingConnections: result.connections.waiting,
        totalConnections: result.connections.total,
      } : undefined,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check blockchain connectivity
 */
async function checkBlockchainHealth(): Promise<DependencyHealth> {
  const start = Date.now();
  
  try {
    const providerUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL;
    if (!providerUrl) {
      return {
        status: 'healthy',
        latency: 0,
        lastChecked: new Date(),
        details: { message: 'Blockchain not configured' },
      };
    }
    
    const provider = new ethers.JsonRpcProvider(providerUrl);
    
    const result = await Promise.race([
      provider.getBlockNumber(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Blockchain check timeout')), HEALTH_CONFIG.timeouts.blockchain)
      ),
    ]);
    
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency,
      lastChecked: new Date(),
      details: {
        currentBlock: result,
        network: process.env.BLOCKCHAIN_NETWORK || 'unknown',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown blockchain error',
    };
  }
}

/**
 * Check system health (memory, CPU)
 */
function checkSystemHealth(): SystemHealth {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usedPercent = Math.round((usedMemory / totalMemory) * 100);
  
  let memoryStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (usedPercent >= HEALTH_CONFIG.thresholds.memoryCriticalPercent) {
    memoryStatus = 'critical';
  } else if (usedPercent >= HEALTH_CONFIG.thresholds.memoryWarningPercent) {
    memoryStatus = 'warning';
  }
  
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const cpuUsage = Math.round((loadAvg[0] / cpuCount) * 100);
  
  const status = memoryStatus === 'critical' ? 'unhealthy' : 
                 memoryStatus === 'warning' ? 'degraded' : 'healthy';
  
  return {
    status,
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usedPercent,
      status: memoryStatus,
    },
    cpu: {
      loadAverage: loadAvg,
      usagePercent: cpuUsage,
    },
    uptime: process.uptime(),
    timestamp: new Date(),
  };
}

/**
 * Update health cache
 */
async function updateHealthCache(): Promise<void> {
  const now = Date.now();
  
  // Check database if stale
  if (!healthCache.database || now - healthCache.timestamp > HEALTH_CONFIG.intervals.database) {
    healthCache.database = await checkDatabaseHealth();
  }
  
  // Check blockchain if stale
  if (!healthCache.blockchain || now - healthCache.timestamp > HEALTH_CONFIG.intervals.blockchain) {
    healthCache.blockchain = await checkBlockchainHealth();
  }
  
  // Check system if stale
  if (!healthCache.system || now - healthCache.timestamp > HEALTH_CONFIG.intervals.system) {
    healthCache.system = checkSystemHealth();
  }
  
  healthCache.timestamp = now;
}

/**
 * Get overall health status
 */
function getOverallStatus(deps: DependencyHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
  const hasUnhealthy = deps.some(d => d?.status === 'unhealthy');
  const hasDegraded = deps.some(d => d?.status === 'degraded');
  
  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

/**
 * Basic health check endpoint - quick response for load balancers
 */
export async function basicHealthCheck(req: Request, res: Response): Promise<void> {
  try {
    // Quick DB check
    const dbHealth = await Promise.race([
      db.healthCheck(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 2000)
      ),
    ]);
    
    if (!dbHealth.healthy) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'agent-marketplace',
        checks: {
          database: 'unhealthy',
        },
      });
      return;
    }
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'agent-marketplace',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'agent-marketplace',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
}

/**
 * Detailed health check endpoint - comprehensive status
 */
export async function detailedHealthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    await updateHealthCache();
    
    const dependencies = [
      healthCache.database,
      healthCache.blockchain,
    ].filter(Boolean) as DependencyHealth[];
    
    const overallStatus = getOverallStatus(dependencies);
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                       overallStatus === 'degraded' ? 200 : 503;
    
    const responseTime = Date.now() - startTime;
    
    res.status(httpStatus).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'agent-marketplace',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: `${responseTime}ms`,
      checks: {
        database: healthCache.database,
        blockchain: healthCache.blockchain,
        system: healthCache.system,
      },
      metadata: {
        pid: process.pid,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'agent-marketplace',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
}

/**
 * Readiness check - for Kubernetes-style deployments
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  try {
    // Check if service is ready to accept traffic
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'unhealthy') {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Database unavailable',
      });
      return;
    }
    
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.message : 'Readiness check failed',
    });
  }
}

/**
 * Liveness check - for Kubernetes-style deployments
 */
export async function livenessCheck(req: Request, res: Response): Promise<void> {
  // Simple check that process is alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

/**
 * Get health check configuration
 */
export function getHealthConfig() {
  return { ...HEALTH_CONFIG };
}

/**
 * Reset health cache (useful for testing)
 */
export function resetHealthCache(): void {
  healthCache.timestamp = 0;
  healthCache.database = null;
  healthCache.blockchain = null;
  healthCache.system = null;
}

// Export types
export type {
  DependencyHealth,
  SystemHealth,
  MemoryStats,
  CpuStats,
};
