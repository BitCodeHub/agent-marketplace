/**
 * Alert Thresholds Configuration
 * 
 * Defines all alert thresholds, notification channels, and escalation policies
 * for the AI Agent Marketplace monitoring system.
 */

// Alert severity levels
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

// Notification channel types
export type NotificationChannel = 
  | 'email' 
  | 'slack' 
  | 'discord' 
  | 'pagerduty' 
  | 'webhook' 
  | 'telegram';

// Alert threshold definition
export interface Threshold {
  value: number;
  severity: AlertSeverity;
  message: string;
  description?: string;
}

// Metric thresholds
export interface MetricThresholds {
  warning: number;
  critical: number;
  emergency?: number;
}

// Alert rule definition
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  thresholds: Threshold[];
  duration?: number; // Duration condition must be true before alerting (ms)
  cooldown?: number; // Cooldown between alerts (ms)
  channels: NotificationChannel[];
  enabled: boolean;
  autoResolve?: boolean;
}

// Escalation policy
export interface EscalationPolicy {
  id: string;
  name: string;
  steps: EscalationStep[];
}

export interface EscalationStep {
  order: number;
  delayMinutes: number;
  channels: NotificationChannel[];
  severity: AlertSeverity;
}

// =============================================================================
// RESPONSE TIME THRESHOLDS
// =============================================================================

export const RESPONSE_TIME_THRESHOLDS: MetricThresholds = {
  warning: 500,      // 500ms
  critical: 2000,    // 2 seconds
  emergency: 5000,   // 5 seconds
};

export const DB_LATENCY_THRESHOLDS: MetricThresholds = {
  warning: 100,      // 100ms
  critical: 1000,    // 1 second
  emergency: 5000,   // 5 seconds
};

// =============================================================================
// ERROR RATE THRESHOLDS
// =============================================================================

export const ERROR_RATE_THRESHOLDS: MetricThresholds = {
  warning: 0.01,     // 1%
  critical: 0.05,    // 5%
  emergency: 0.20,   // 20%
};

export const API_ERROR_RATE_THRESHOLDS: MetricThresholds = {
  warning: 0.05,     // 5%
  critical: 0.10,    // 10%
  emergency: 0.25,   // 25%
};

// =============================================================================
// AVAILABILITY THRESHOLDS
// =============================================================================

export const AVAILABILITY_THRESHOLDS: MetricThresholds = {
  warning: 0.995,    // 99.5%
  critical: 0.99,    // 99%
  emergency: 0.95,   // 95%
};

// =============================================================================
// RESOURCE USAGE THRESHOLDS
// =============================================================================

export const MEMORY_THRESHOLDS: MetricThresholds = {
  warning: 75,       // 75%
  critical: 85,      // 85%
  emergency: 95,     // 95%
};

export const CPU_THRESHOLDS: MetricThresholds = {
  warning: 70,       // 70%
  critical: 85,      // 85%
  emergency: 95,     // 95%
};

export const DISK_THRESHOLDS: MetricThresholds = {
  warning: 80,       // 80%
  critical: 90,      // 90%
  emergency: 95,     // 95%
};

// =============================================================================
// DATABASE THRESHOLDS
// =============================================================================

export const DB_CONNECTION_THRESHOLDS: MetricThresholds = {
  warning: 15,       // 15 connections
  critical: 18,      // 18 connections
  emergency: 20,     // 20 connections (max)
};

export const DB_WAITING_CONNECTIONS_THRESHOLD = 5;

export const SLOW_QUERY_THRESHOLD_MS = 1000;

// =============================================================================
// BUSINESS METRICS THRESHOLDS
// =============================================================================

export const TASK_QUEUE_THRESHOLDS: MetricThresholds = {
  warning: 100,      // 100 pending tasks
  critical: 500,     // 500 pending tasks
  emergency: 1000,   // 1000 pending tasks
};

export const AGENT_REGISTRATION_SPIKE = {
  threshold: 50,     // 50 registrations
  windowMinutes: 10, // in 10 minutes
};

// =============================================================================
// ALERT RULES
// =============================================================================

export const ALERT_RULES: AlertRule[] = [
  // API Response Time
  {
    id: 'api-response-time-warning',
    name: 'API Response Time Warning',
    metric: 'api.response_time',
    condition: 'gt',
    thresholds: [
      {
        value: RESPONSE_TIME_THRESHOLDS.warning,
        severity: 'warning',
        message: 'API response time exceeds 500ms',
        description: 'Response time is elevated, investigate potential bottlenecks',
      },
      {
        value: RESPONSE_TIME_THRESHOLDS.critical,
        severity: 'critical',
        message: 'API response time exceeds 2 seconds',
        description: 'Severe performance degradation detected',
      },
      {
        value: RESPONSE_TIME_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'API response time exceeds 5 seconds',
        description: 'Service may become unusable, immediate action required',
      },
    ],
    duration: 30000,    // 30 seconds
    cooldown: 300000,   // 5 minutes
    channels: ['slack', 'email'],
    enabled: true,
    autoResolve: true,
  },
  
  // Error Rate
  {
    id: 'error-rate-critical',
    name: 'High Error Rate',
    metric: 'api.error_rate',
    condition: 'gt',
    thresholds: [
      {
        value: ERROR_RATE_THRESHOLDS.warning,
        severity: 'warning',
        message: 'Error rate above 1%',
        description: 'Elevated error rate detected',
      },
      {
        value: ERROR_RATE_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Error rate above 5%',
        description: 'Critical error rate - many requests failing',
      },
      {
        value: ERROR_RATE_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'Error rate above 20%',
        description: 'Service severely degraded - immediate action required',
      },
    ],
    duration: 60000,    // 1 minute
    cooldown: 300000,   // 5 minutes
    channels: ['slack', 'email', 'pagerduty'],
    enabled: true,
    autoResolve: true,
  },
  
  // Availability
  {
    id: 'availability-drop',
    name: 'Service Availability Drop',
    metric: 'api.availability',
    condition: 'lt',
    thresholds: [
      {
        value: AVAILABILITY_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Availability below 99%',
        description: 'Service availability compromised',
      },
      {
        value: AVAILABILITY_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'Availability below 95%',
        description: 'Service severely impacted',
      },
    ],
    duration: 120000,   // 2 minutes
    cooldown: 600000,   // 10 minutes
    channels: ['slack', 'email', 'pagerduty'],
    enabled: true,
    autoResolve: true,
  },
  
  // Database Latency
  {
    id: 'db-latency-warning',
    name: 'Database Latency Warning',
    metric: 'db.latency',
    condition: 'gt',
    thresholds: [
      {
        value: DB_LATENCY_THRESHOLDS.warning,
        severity: 'warning',
        message: 'Database latency above 100ms',
        description: 'Database queries taking longer than expected',
      },
      {
        value: DB_LATENCY_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Database latency above 1 second',
        description: 'Database performance severely degraded',
      },
      {
        value: DB_LATENCY_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'Database latency above 5 seconds',
        description: 'Database may be unresponsive',
      },
    ],
    duration: 30000,    // 30 seconds
    cooldown: 300000,   // 5 minutes
    channels: ['slack', 'email'],
    enabled: true,
    autoResolve: true,
  },
  
  // Database Connections
  {
    id: 'db-connections-warning',
    name: 'High Database Connection Count',
    metric: 'db.connections.total',
    condition: 'gt',
    thresholds: [
      {
        value: DB_CONNECTION_THRESHOLDS.warning,
        severity: 'warning',
        message: 'Database connections above 15',
        description: 'Approaching connection limit',
      },
      {
        value: DB_CONNECTION_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Database connections above 18',
        description: 'Critical: Very close to connection limit',
      },
      {
        value: DB_CONNECTION_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'Database connections at maximum',
        description: 'Connection pool exhausted - new connections will fail',
      },
    ],
    duration: 15000,    // 15 seconds
    cooldown: 180000,   // 3 minutes
    channels: ['slack', 'email', 'pagerduty'],
    enabled: true,
    autoResolve: true,
  },
  
  // Memory Usage
  {
    id: 'memory-usage-warning',
    name: 'High Memory Usage',
    metric: 'system.memory.percent',
    condition: 'gt',
    thresholds: [
      {
        value: MEMORY_THRESHOLDS.warning,
        severity: 'warning',
        message: 'Memory usage above 75%',
        description: 'Memory pressure increasing',
      },
      {
        value: MEMORY_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Memory usage above 85%',
        description: 'High memory usage - risk of OOM',
      },
      {
        value: MEMORY_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'Memory usage above 95%',
        description: 'Critical memory usage - imminent OOM',
      },
    ],
    duration: 60000,    // 1 minute
    cooldown: 300000,   // 5 minutes
    channels: ['slack', 'email'],
    enabled: true,
    autoResolve: true,
  },
  
  // CPU Usage
  {
    id: 'cpu-usage-warning',
    name: 'High CPU Usage',
    metric: 'system.cpu.percent',
    condition: 'gt',
    thresholds: [
      {
        value: CPU_THRESHOLDS.warning,
        severity: 'warning',
        message: 'CPU usage above 70%',
        description: 'Elevated CPU usage',
      },
      {
        value: CPU_THRESHOLDS.critical,
        severity: 'critical',
        message: 'CPU usage above 85%',
        description: 'High CPU usage - performance impact likely',
      },
      {
        value: CPU_THRESHOLDS.emergency,
        severity: 'emergency',
        message: 'CPU usage above 95%',
        description: 'Critical CPU usage - service may become unresponsive',
      },
    ],
    duration: 120000,   // 2 minutes
    cooldown: 300000,   // 5 minutes
    channels: ['slack', 'email'],
    enabled: true,
    autoResolve: true,
  },
  
  // Task Queue Backlog
  {
    id: 'task-queue-backlog',
    name: 'Task Queue Backlog',
    metric: 'tasks.pending',
    condition: 'gt',
    thresholds: [
      {
        value: TASK_QUEUE_THRESHOLDS.warning,
        severity: 'warning',
        message: 'Task queue backlog above 100',
        description: 'Tasks are queuing up faster than being processed',
      },
      {
        value: TASK_QUEUE_THRESHOLDS.critical,
        severity: 'critical',
        message: 'Task queue backlog above 500',
        description: 'Significant task backlog - processing delay likely',
      },
    ],
    duration: 300000,   // 5 minutes
    cooldown: 600000,   // 10 minutes
    channels: ['slack', 'email'],
    enabled: true,
    autoResolve: true,
  },
];

// =============================================================================
// NOTIFICATION CHANNEL CONFIGURATION
// =============================================================================

export interface ChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  config: Record<string, string>;
}

export const NOTIFICATION_CHANNELS: ChannelConfig[] = [
  {
    channel: 'email',
    enabled: true,
    config: {
      smtpHost: process.env.ALERT_SMTP_HOST || '',
      smtpPort: process.env.ALERT_SMTP_PORT || '587',
      from: process.env.ALERT_EMAIL_FROM || 'alerts@agent-marketplace.com',
      to: process.env.ALERT_EMAIL_TO || 'ops@agent-marketplace.com',
    },
  },
  {
    channel: 'slack',
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_CHANNEL || '#alerts',
      username: 'Agent Marketplace Monitor',
    },
  },
  {
    channel: 'discord',
    enabled: !!process.env.DISCORD_WEBHOOK_URL,
    config: {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    },
  },
  {
    channel: 'pagerduty',
    enabled: !!process.env.PAGERDUTY_KEY,
    config: {
      serviceKey: process.env.PAGERDUTY_KEY || '',
      severityMapping: 'warning:warning,critical:error,emergency:critical',
    },
  },
  {
    channel: 'webhook',
    enabled: !!process.env.ALERT_WEBHOOK_URL,
    config: {
      url: process.env.ALERT_WEBHOOK_URL || '',
      method: 'POST',
      headers: JSON.stringify({ 'Content-Type': 'application/json' }),
    },
  },
  {
    channel: 'telegram',
    enabled: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
    config: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },
  },
];

// =============================================================================
// ESCALATION POLICIES
// =============================================================================

export const ESCALATION_POLICIES: EscalationPolicy[] = [
  {
    id: 'default',
    name: 'Default Escalation',
    steps: [
      {
        order: 1,
        delayMinutes: 0,
        channels: ['slack'],
        severity: 'warning',
      },
      {
        order: 2,
        delayMinutes: 5,
        channels: ['slack', 'email'],
        severity: 'warning',
      },
      {
        order: 3,
        delayMinutes: 15,
        channels: ['slack', 'email', 'pagerduty'],
        severity: 'critical',
      },
    ],
  },
  {
    id: 'critical',
    name: 'Critical Escalation',
    steps: [
      {
        order: 1,
        delayMinutes: 0,
        channels: ['slack', 'email', 'pagerduty'],
        severity: 'critical',
      },
      {
        order: 2,
        delayMinutes: 5,
        channels: ['slack', 'email', 'pagerduty'],
        severity: 'emergency',
      },
    ],
  },
];

// =============================================================================
// ALERT UTILITIES
// =============================================================================

/**
 * Check if a value breaches any threshold
 */
export function checkThresholds(
  value: number,
  thresholds: Threshold[]
): Threshold | null {
  // Sort thresholds by value descending for 'gt' conditions
  const sorted = [...thresholds].sort((a, b) => b.value - a.value);
  
  for (const threshold of sorted) {
    if (value >= threshold.value) {
      return threshold;
    }
  }
  
  return null;
}

/**
 * Get appropriate channels for severity level
 */
export function getChannelsForSeverity(
  severity: AlertSeverity,
  channels: NotificationChannel[]
): NotificationChannel[] {
  const severityLevels: Record<AlertSeverity, number> = {
    info: 0,
    warning: 1,
    critical: 2,
    emergency: 3,
  };
  
  // Filter channels based on severity (implement custom logic as needed)
  return channels;
}

/**
 * Format alert message
 */
export function formatAlertMessage(
  rule: AlertRule,
  threshold: Threshold,
  value: number,
  timestamp: Date
): string {
  return `
🚨 **${rule.name}**

**Severity:** ${threshold.severity.toUpperCase()}
**Value:** ${value}
**Threshold:** ${threshold.value}
**Time:** ${timestamp.toISOString()}

${threshold.message}

${threshold.description || ''}
  `.trim();
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  thresholds: {
    responseTime: RESPONSE_TIME_THRESHOLDS,
    dbLatency: DB_LATENCY_THRESHOLDS,
    errorRate: ERROR_RATE_THRESHOLDS,
    apiErrorRate: API_ERROR_RATE_THRESHOLDS,
    availability: AVAILABILITY_THRESHOLDS,
    memory: MEMORY_THRESHOLDS,
    cpu: CPU_THRESHOLDS,
    disk: DISK_THRESHOLDS,
    dbConnections: DB_CONNECTION_THRESHOLDS,
    taskQueue: TASK_QUEUE_THRESHOLDS,
    slowQuery: SLOW_QUERY_THRESHOLD_MS,
  },
  rules: ALERT_RULES,
  channels: NOTIFICATION_CHANNELS,
  escalation: ESCALATION_POLICIES,
};
