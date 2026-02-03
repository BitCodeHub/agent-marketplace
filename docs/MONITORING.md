# Monitoring & Alerting Guide

## Overview

This document describes the comprehensive monitoring and alerting setup for the AI Agent Marketplace deployment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Agent Marketplace                         │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Health    │  │   Monitor   │  │   Alerts    │             │
│  │   Check     │  │   Script    │  │   Config    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────┐                 │
│  │           Winston Logger                    │                 │
│  │  ┌────────┐ ┌────────┐ ┌────────┐          │                 │
│  │  │Combined│ │ Error  │ │Access  │          │                 │
│  │  │  File  │ │  File  │ │  File  │          │                 │
│  │  └────────┘ └────────┘ └────────┘          │                 │
│  └─────────────────────────────────────────────┘                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Log Aggregation      │
              │  (External Service)    │
              └────────────────────────┘
```

## Components

### 1. Health Check Endpoint (`scripts/health-check.ts`)

Comprehensive health monitoring with multiple endpoints:

#### Endpoints

| Endpoint | Path | Purpose | Response Time |
|----------|------|---------|---------------|
| Basic Health | `/health` | Load balancer check | < 2s |
| Detailed Health | `/health/detailed` | Full system status | < 5s |
| Readiness | `/health/ready` | K8s readiness probe | < 2s |
| Liveness | `/health/live` | K8s liveness probe | < 1s |

#### Checks Performed

- **Database**: Connection pool status, query latency
- **Blockchain**: RPC connectivity, current block number
- **System**: Memory usage, CPU load, uptime
- **API**: Endpoint availability

#### Example Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "agent-marketplace",
  "version": "1.0.0",
  "responseTime": "45ms",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 12,
      "details": {
        "activeConnections": 5,
        "idleConnections": 3,
        "totalConnections": 8
      }
    },
    "blockchain": {
      "status": "healthy",
      "latency": 234,
      "details": {
        "currentBlock": 18572341,
        "network": "sepolia"
      }
    },
    "system": {
      "status": "healthy",
      "memory": {
        "usedPercent": 45,
        "status": "healthy"
      }
    }
  }
}
```

### 2. Uptime Monitor (`scripts/monitor.ts`)

Continuous monitoring service with metrics collection.

#### Features

- **API Monitoring**: Response times, status codes, availability
- **Database Monitoring**: Latency, connection pool, query performance
- **System Monitoring**: Memory, CPU, disk usage
- **Alert Generation**: Automatic alert creation on threshold breach
- **Metrics Storage**: Time-series data with configurable retention

#### Monitored Endpoints

```typescript
[
  { name: 'health', path: '/health' },
  { name: 'api-root', path: '/api/v1' },
  { name: 'agents-list', path: '/api/v1/agents' },
  { name: 'tasks-list', path: '/api/v1/tasks' },
]
```

#### Check Intervals

| Component | Interval | Timeout |
|-----------|----------|---------|
| API | 30s | 5s |
| Database | 30s | 5s |
| System | 60s | 2s |
| Blockchain | 60s | 10s |

#### Usage

```typescript
import { startMonitoring, getMonitor } from './scripts/monitor';

// Start monitoring
const monitor = startMonitoring('http://localhost:3000');

// Get current status
const status = monitor.getStatus();

// Get active alerts
const alerts = monitor.getAlerts();

// Listen for events
monitor.on('alert', (alert) => {
  console.log('New alert:', alert);
});
```

#### CLI Usage

```bash
# Run standalone monitor
npx ts-node scripts/monitor.ts

# With custom base URL
MONITOR_BASE_URL=https://api.example.com npx ts-node scripts/monitor.ts
```

### 3. Alert Configuration (`config/alerts.ts`)

Comprehensive alert rules and notification channels.

#### Alert Severities

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Info | Informational only | None |
| Warning | Attention needed | < 4 hours |
| Critical | Immediate attention | < 30 minutes |
| Emergency | Service impact | < 5 minutes |

#### Thresholds

##### Response Time
- **Warning**: > 500ms
- **Critical**: > 2s
- **Emergency**: > 5s

##### Error Rate
- **Warning**: > 1%
- **Critical**: > 5%
- **Emergency**: > 20%

##### Availability
- **Warning**: < 99.5%
- **Critical**: < 99%
- **Emergency**: < 95%

##### Memory Usage
- **Warning**: > 75%
- **Critical**: > 85%
- **Emergency**: > 95%

##### Database Connections
- **Warning**: > 15
- **Critical**: > 18
- **Emergency**: > 20

#### Notification Channels

Configure via environment variables:

```bash
# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# Email
ALERT_SMTP_HOST=smtp.example.com
ALERT_SMTP_PORT=587
ALERT_EMAIL_FROM=alerts@example.com
ALERT_EMAIL_TO=ops@example.com

# PagerDuty
PAGERDUTY_KEY=your-service-key

# Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Custom Webhook
ALERT_WEBHOOK_URL=https://your-webhook.com/alerts
```

#### Alert Rules

| Rule | Metric | Condition | Duration |
|------|--------|-----------|----------|
| API Response Time | api.response_time | > threshold | 30s |
| Error Rate | api.error_rate | > threshold | 1m |
| Availability | api.availability | < threshold | 2m |
| DB Latency | db.latency | > threshold | 30s |
| DB Connections | db.connections.total | > threshold | 15s |
| Memory Usage | system.memory.percent | > threshold | 1m |
| CPU Usage | system.cpu.percent | > threshold | 2m |

## Log Aggregation

### Winston Configuration

Structured logging with multiple transports:

```typescript
// logs/combined.log - All logs (info+)
// logs/error.log - Error logs only
// logs/access.log - HTTP access logs
// logs/monitor.log - Monitor logs
```

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "info",
  "message": "API request completed",
  "service": "agent-marketplace",
  "requestId": "req-123",
  "duration": 45,
  "path": "/api/v1/agents",
  "method": "GET",
  "statusCode": 200
}
```

### External Log Aggregation

Configure shipping to external services:

#### Datadog
```bash
DD_API_KEY=your-api-key
DD_SITE=datadoghq.com
```

#### Splunk
```bash
SPLUNK_HEC_URL=https://splunk.example.com:8088
SPLUNK_HEC_TOKEN=your-token
```

#### ELK Stack
```bash
ELASTICSEARCH_URL=https://elasticsearch.example.com:9200
ELASTICSEARCH_INDEX=agent-marketplace-logs
```

#### CloudWatch (AWS)
```bash
AWS_CLOUDWATCH_GROUP=/aws/ec2/agent-marketplace
AWS_REGION=us-east-1
```

## Monitoring Dashboard

### Grafana Dashboard Specification

Create dashboard with the following panels:

#### Row 1: Service Overview

| Panel | Query | Threshold |
|-------|-------|-----------|
| Uptime | `avg(api.availability)` | < 99% = red |
| Error Rate | `sum(api.errors) / sum(api.requests)` | > 5% = red |
| Avg Response Time | `avg(api.response_time)` | > 500ms = yellow |
| Requests/sec | `rate(api.requests[1m])` | - |

#### Row 2: Database Metrics

| Panel | Query | Threshold |
|-------|-------|-----------|
| DB Latency | `avg(db.latency)` | > 100ms = yellow |
| Active Connections | `avg(db.connections.active)` | > 15 = red |
| Slow Queries | `rate(db.slow_queries[1m])` | > 10/min = yellow |
| Query Rate | `rate(db.queries[1m])` | - |

#### Row 3: System Resources

| Panel | Query | Threshold |
|-------|-------|-----------|
| Memory Usage | `avg(system.memory.percent)` | > 85% = red |
| CPU Usage | `avg(system.cpu.percent)` | > 85% = red |
| Disk Usage | `avg(system.disk.percent)` | > 90% = red |
| Network I/O | `rate(system.network.bytes[1m])` | - |

#### Row 4: Business Metrics

| Panel | Query | Description |
|-------|-------|-------------|
| Active Agents | `count(agents{status="active"})` | Currently active |
| Pending Tasks | `count(tasks{status="pending"})` | Waiting for claims |
| Completed Today | `count(tasks{status="completed"})` | Last 24 hours |
| Avg Task Duration | `avg(task.duration)` | Time to completion |

### Prometheus Metrics

Export metrics in Prometheus format at `/metrics`:

```
# HTTP requests
http_requests_total{method="GET",path="/api/v1/agents",status="200"} 1234
http_request_duration_seconds_bucket{le="0.1"} 1000

# Database metrics
db_connections_active 5
db_query_duration_seconds_sum 123.45
db_slow_queries_total 12

# System metrics
process_memory_usage_bytes 16777216
process_cpu_seconds_total 1234.56
```

## Deployment Integration

### Docker Compose

```yaml
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  monitor:
    build: .
    command: npx ts-node scripts/monitor.ts
    environment:
      - MONITOR_BASE_URL=http://app:3000
    depends_on:
      - app
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-marketplace
spec:
  template:
    spec:
      containers:
        - name: app
          image: agent-marketplace:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: agent-marketplace
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "3000"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: agent-marketplace
  ports:
    - port: 3000
```

### Render.com

Already configured in `render.yaml`:

```yaml
services:
  - type: web
    name: agent-marketplace
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
```

## Runbooks

### High Error Rate

**Symptoms**: Error rate > 5%

**Steps**:
1. Check `/health/detailed` for component status
2. Review error logs: `tail -f logs/error.log`
3. Check database connection pool
4. Verify external dependencies (blockchain RPC)
5. Scale up if resource constrained

### High Database Latency

**Symptoms**: DB latency > 100ms

**Steps**:
1. Check active connections: `SELECT * FROM pg_stat_activity`
2. Identify slow queries in logs
3. Run `ANALYZE` on affected tables
4. Check for connection leaks
5. Consider read replicas for read-heavy workloads

### Memory Exhaustion

**Symptoms**: Memory usage > 85%

**Steps**:
1. Check memory leaks: `node --inspect` + Chrome DevTools
2. Review recent deployments for changes
3. Restart service if necessary
4. Scale up memory allocation
5. Enable heap dumps for analysis

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Winston log level | `info` |
| `LOG_FORMAT` | json or pretty | `json` |
| `MONITOR_BASE_URL` | Base URL for monitoring | `http://localhost:3000` |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms) | `5000` |
| `SLACK_WEBHOOK_URL` | Slack notifications | - |
| `PAGERDUTY_KEY` | PagerDuty integration | - |
| `ALERT_EMAIL_TO` | Alert recipient | - |
| `DD_API_KEY` | Datadog integration | - |

## Maintenance

### Log Rotation

```bash
# Manual rotation
logrotate -f /etc/logrotate.d/agent-marketplace

# Configuration
/var/log/agent-marketplace/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 app app
}
```

### Health Check Testing

```bash
# Test basic health
curl http://localhost:3000/health

# Test detailed health
curl http://localhost:3000/health/detailed | jq

# Test readiness
curl http://localhost:3000/health/ready

# Test liveness
curl http://localhost:3000/health/live
```

### Monitor Testing

```bash
# Start monitor in foreground
npx ts-node scripts/monitor.ts

# Get monitor status
curl http://localhost:3000/monitor/status

# Get active alerts
curl http://localhost:3000/monitor/alerts
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Health check timeout | DB connection issue | Check DATABASE_URL |
| High memory usage | Memory leak | Enable heap profiling |
| False alerts | Threshold too low | Adjust threshold in config |
| Missing logs | Wrong log level | Set LOG_LEVEL=debug |
| Monitor not starting | Port conflict | Check PORT env var |

### Debug Mode

```bash
# Enable debug logging
DEBUG=* LOG_LEVEL=debug npm start

# Monitor with verbose output
DEBUG=monitor* npx ts-node scripts/monitor.ts
```

## Additional Resources

- [Express Health Checks Best Practices](https://expressjs.com/en/advanced/healthcheck.html)
- [Prometheus Monitoring Guide](https://prometheus.io/docs/practices/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)
