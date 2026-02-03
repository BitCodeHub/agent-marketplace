/**
 * Uptime Monitoring Script
 * 
 * Continuously monitors the AI Agent Marketplace for:
 * - API endpoint availability
 * - Response time tracking
 * - Error rate monitoring
 * - Database connectivity
 * - Resource usage
 * 
 * Can run as a standalone process or be integrated into the main application.
 */

import { db } from '../services/db';
import winston from 'winston';
import { EventEmitter } from 'events';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'monitor' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/monitor-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/monitor.log' }),
  ],
});

// Monitoring configuration
const MONITOR_CONFIG = {
  // Check intervals (ms)
  intervals: {
    api: 30000,       // 30 seconds
    database: 30000,  // 30 seconds
    system: 60000,    // 1 minute
    blockchain: 60000,// 1 minute
  },
  
  // Alert thresholds
  thresholds: {
    responseTime: {
      warning: 500,   // ms
      critical: 2000, // ms
    },
    errorRate: {
      warning: 0.05,   // 5%
      critical: 0.20,  // 20%
    },
    availability: {
      warning: 0.99,   // 99%
      critical: 0.95,  // 95%
    },
    memory: {
      warning: 80,     // %
      critical: 95,    // %
    },
    cpu: {
      warning: 70,     // %
      critical: 90,    // %
    },
  },
  
  // Data retention
  retention: {
    metrics: 24 * 60 * 60 * 1000,      // 24 hours
    alerts: 7 * 24 * 60 * 60 * 1000,   // 7 days
    logs: 30 * 24 * 60 * 60 * 1000,    // 30 days
  },
  
  // Endpoints to monitor
  endpoints: [
    { name: 'health', path: '/health', method: 'GET' },
    { name: 'api-root', path: '/api/v1', method: 'GET' },
    { name: 'agents-list', path: '/api/v1/agents', method: 'GET' },
    { name: 'tasks-list', path: '/api/v1/tasks', method: 'GET' },
  ],
};

// Types
interface MetricPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  component: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved?: Date;
}

interface ApiCheckResult {
  endpoint: string;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

interface MonitorState {
  isRunning: boolean;
  startTime: Date | null;
  checkCount: number;
  errorCount: number;
  lastCheck: Date | null;
  alerts: Alert[];
}

// Metrics storage (in-memory with circular buffer)
class MetricsStore {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private maxSize: number;
  
  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }
  
  record(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const series = this.metrics.get(name)!;
    series.push({
      timestamp: new Date(),
      value,
      labels,
    });
    
    // Trim old data
    while (series.length > this.maxSize) {
      series.shift();
    }
  }
  
  get(name: string, duration?: number): MetricPoint[] {
    const series = this.metrics.get(name) || [];
    if (!duration) return [...series];
    
    const cutoff = new Date(Date.now() - duration);
    return series.filter(m => m.timestamp >= cutoff);
  }
  
  getAverage(name: string, duration?: number): number {
    const series = this.get(name, duration);
    if (series.length === 0) return 0;
    return series.reduce((sum, m) => sum + m.value, 0) / series.length;
  }
  
  getPercentile(name: string, percentile: number, duration?: number): number {
    const series = this.get(name, duration);
    if (series.length === 0) return 0;
    
    const sorted = series.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  getAllMetrics(): Record<string, MetricPoint[]> {
    const result: Record<string, MetricPoint[]> = {};
    this.metrics.forEach((value, key) => {
      result[key] = [...value];
    });
    return result;
  }
}

// Monitor class
class UptimeMonitor extends EventEmitter {
  private state: MonitorState;
  private metrics: MetricsStore;
  private intervals: NodeJS.Timeout[] = [];
  private baseUrl: string;
  
  constructor(baseUrl: string = `http://localhost:${process.env.PORT || 3000}`) {
    super();
    this.baseUrl = baseUrl;
    this.state = {
      isRunning: false,
      startTime: null,
      checkCount: 0,
      errorCount: 0,
      lastCheck: null,
      alerts: [],
    };
    this.metrics = new MetricsStore();
  }
  
  /**
   * Start monitoring
   */
  start(): void {
    if (this.state.isRunning) {
      logger.warn('Monitor already running');
      return;
    }
    
    this.state.isRunning = true;
    this.state.startTime = new Date();
    
    logger.info('Starting uptime monitor', { baseUrl: this.baseUrl });
    
    // Start check intervals
    this.intervals.push(
      setInterval(() => this.checkApiEndpoints(), MONITOR_CONFIG.intervals.api)
    );
    this.intervals.push(
      setInterval(() => this.checkDatabase(), MONITOR_CONFIG.intervals.database)
    );
    this.intervals.push(
      setInterval(() => this.checkSystem(), MONITOR_CONFIG.intervals.system)
    );
    
    // Run initial checks
    this.checkApiEndpoints();
    this.checkDatabase();
    this.checkSystem();
    
    this.emit('started');
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.state.isRunning) return;
    
    this.state.isRunning = false;
    this.intervals.forEach(i => clearInterval(i));
    this.intervals = [];
    
    logger.info('Uptime monitor stopped');
    this.emit('stopped');
  }
  
  /**
   * Check API endpoints
   */
  private async checkApiEndpoints(): Promise<void> {
    for (const endpoint of MONITOR_CONFIG.endpoints) {
      const start = Date.now();
      
      try {
        const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'User-Agent': 'AgentMarketplace-Monitor/1.0' },
        });
        
        const responseTime = Date.now() - start;
        const success = response.ok;
        
        const result: ApiCheckResult = {
          endpoint: endpoint.name,
          status: response.status,
          responseTime,
          success,
          timestamp: new Date(),
        };
        
        this.recordApiMetrics(result);
        this.state.checkCount++;
        
        if (!success) {
          this.state.errorCount++;
          this.createAlert('warning', 'api', `Endpoint ${endpoint.name} returned ${response.status}`);
        }
        
        // Check response time thresholds
        if (responseTime > MONITOR_CONFIG.thresholds.responseTime.critical) {
          this.createAlert('critical', 'api', 
            `Endpoint ${endpoint.name} critical response time: ${responseTime}ms`);
        } else if (responseTime > MONITOR_CONFIG.thresholds.responseTime.warning) {
          this.createAlert('warning', 'api',
            `Endpoint ${endpoint.name} slow response time: ${responseTime}ms`);
        }
        
      } catch (error) {
        const responseTime = Date.now() - start;
        const result: ApiCheckResult = {
          endpoint: endpoint.name,
          status: 0,
          responseTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };
        
        this.recordApiMetrics(result);
        this.state.errorCount++;
        
        this.createAlert('critical', 'api',
          `Endpoint ${endpoint.name} unreachable: ${result.error}`);
      }
    }
    
    this.state.lastCheck = new Date();
  }
  
  /**
   * Record API metrics
   */
  private recordApiMetrics(result: ApiCheckResult): void {
    this.metrics.record(`api.response_time`, result.responseTime, {
      endpoint: result.endpoint,
    });
    
    this.metrics.record(`api.status`, result.status, {
      endpoint: result.endpoint,
    });
    
    this.metrics.record(`api.success`, result.success ? 1 : 0, {
      endpoint: result.endpoint,
    });
    
    if (result.success) {
      this.metrics.record(`api.availability`, 1, {
        endpoint: result.endpoint,
      });
    } else {
      this.metrics.record(`api.availability`, 0, {
        endpoint: result.endpoint,
      });
    }
  }
  
  /**
   * Check database health
   */
  private async checkDatabase(): Promise<void> {
    const start = Date.now();
    
    try {
      const health = await db.healthCheck();
      const latency = Date.now() - start;
      
      this.metrics.record('db.latency', latency);
      this.metrics.record('db.healthy', health.healthy ? 1 : 0);
      
      if (health.connections) {
        this.metrics.record('db.connections.active', health.connections.active);
        this.metrics.record('db.connections.idle', health.connections.idle);
        this.metrics.record('db.connections.total', health.connections.total);
      }
      
      if (!health.healthy) {
        this.createAlert('critical', 'database', `Database unhealthy: ${health.error}`);
      } else if (latency > MONITOR_CONFIG.thresholds.responseTime.critical) {
        this.createAlert('critical', 'database', `Database critical latency: ${latency}ms`);
      } else if (latency > MONITOR_CONFIG.thresholds.responseTime.warning) {
        this.createAlert('warning', 'database', `Database slow latency: ${latency}ms`);
      }
      
    } catch (error) {
      this.metrics.record('db.healthy', 0);
      this.metrics.record('db.latency', Date.now() - start);
      this.createAlert('critical', 'database',
        `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check system resources
   */
  private async checkSystem(): Promise<void> {
    const usage = process.memoryUsage();
    const memoryPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    
    this.metrics.record('system.memory.used', usage.heapUsed);
    this.metrics.record('system.memory.total', usage.heapTotal);
    this.metrics.record('system.memory.percent', memoryPercent);
    
    if (memoryPercent > MONITOR_CONFIG.thresholds.memory.critical) {
      this.createAlert('critical', 'system', `Critical memory usage: ${memoryPercent}%`);
    } else if (memoryPercent > MONITOR_CONFIG.thresholds.memory.warning) {
      this.createAlert('warning', 'system', `High memory usage: ${memoryPercent}%`);
    }
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.metrics.record('system.cpu.user', cpuUsage.user);
    this.metrics.record('system.cpu.system', cpuUsage.system);
  }
  
  /**
   * Create an alert
   */
  private createAlert(
    severity: 'info' | 'warning' | 'critical' | 'emergency',
    component: string,
    message: string
  ): void {
    // Deduplicate recent alerts
    const recent = this.state.alerts.slice(-10);
    const duplicate = recent.find(a => 
      a.severity === severity && 
      a.component === component && 
      a.message === message &&
      Date.now() - a.timestamp.getTime() < 300000 // 5 minutes
    );
    
    if (duplicate) return;
    
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      component,
      message,
      timestamp: new Date(),
      acknowledged: false,
    };
    
    this.state.alerts.push(alert);
    
    // Trim old alerts
    const cutoff = new Date(Date.now() - MONITOR_CONFIG.retention.alerts);
    this.state.alerts = this.state.alerts.filter(a => a.timestamp > cutoff);
    
    // Map severity to logger method
    const logMethod = severity === 'critical' || severity === 'emergency' ? 'error' :
                      severity === 'warning' ? 'warn' : 'info';
    logger[logMethod](`Alert: ${message}`, { component, alertId: alert.id, severity });
    this.emit('alert', alert);
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    uptime: number;
    checks: number;
    errors: number;
    errorRate: number;
    lastCheck: Date | null;
  } {
    const uptime = this.state.startTime 
      ? Date.now() - this.state.startTime.getTime() 
      : 0;
    
    return {
      running: this.state.isRunning,
      uptime,
      checks: this.state.checkCount,
      errors: this.state.errorCount,
      errorRate: this.state.checkCount > 0 
        ? this.state.errorCount / this.state.checkCount 
        : 0,
      lastCheck: this.state.lastCheck,
    };
  }
  
  /**
   * Get active alerts
   */
  getAlerts(resolved: boolean = false): Alert[] {
    return this.state.alerts.filter(a => 
      resolved ? a.resolved !== undefined : a.resolved === undefined
    );
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.state.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = new Date();
      return true;
    }
    return false;
  }
  
  /**
   * Get metrics
   */
  getMetrics(): MetricsStore {
    return this.metrics;
  }
  
  /**
   * Get configuration
   */
  getConfig() {
    return { ...MONITOR_CONFIG };
  }
}

// Singleton instance
let monitor: UptimeMonitor | null = null;

/**
 * Get or create monitor instance
 */
export function getMonitor(baseUrl?: string): UptimeMonitor {
  if (!monitor) {
    monitor = new UptimeMonitor(baseUrl);
  }
  return monitor;
}

/**
 * Start monitoring (convenience function)
 */
export function startMonitoring(baseUrl?: string): UptimeMonitor {
  const m = getMonitor(baseUrl);
  m.start();
  return m;
}

/**
 * Stop monitoring (convenience function)
 */
export function stopMonitoring(): void {
  if (monitor) {
    monitor.stop();
  }
}

// Export types
export type {
  MetricPoint,
  Alert,
  ApiCheckResult,
  MonitorState,
  MetricsStore,
};

export { UptimeMonitor, MONITOR_CONFIG };

// Run as standalone script
if (require.main === module) {
  const baseUrl = process.env.MONITOR_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const monitor = startMonitoring(baseUrl);
  
  // Log status periodically
  setInterval(() => {
    const status = monitor.getStatus();
    logger.info('Monitor status', status);
  }, 60000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping monitor...');
    monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping monitor...');
    monitor.stop();
    process.exit(0);
  });
}
