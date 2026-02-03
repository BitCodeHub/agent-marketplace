# Monitoring Setup Summary

## Overview

Comprehensive monitoring and alerting has been set up for the AI Agent Marketplace deployment. This includes health checks, uptime monitoring, structured logging, and alerting thresholds.

## Files Created

### 1. Health Check Configuration
**File**: `src/monitoring/health-check.ts`

Provides comprehensive health monitoring with multiple endpoints:
- `/health` - Basic health check for load balancers (< 2s response)
- `/health/detailed` - Full system status with DB, blockchain, and system metrics
- `/health/ready` - Kubernetes-style readiness probe
- `/health/live` - Kubernetes-style liveness probe

Features:
- Database connectivity and latency checks
- Blockchain RPC connectivity verification
- Memory and CPU usage monitoring
- Response time tracking
- Health status caching

### 2. Uptime Monitoring
**File**: `src/monitoring/monitor.ts`

Continuous monitoring service with:
- API endpoint availability checks (every 30s)
- Database latency monitoring (every 30s)
- System resource tracking (every 60s)
- Automatic alert generation on threshold breach
- Metrics storage with configurable retention

Monitored Endpoints:
- `/health`
- `/api/v1`
- `/api/v1/agents`
- `/api/v1/tasks`

### 3. Alert Configuration
**File**: `config/alerts.ts`

Comprehensive alert rules and notification channels:

**Thresholds**:
| Metric | Warning | Critical | Emergency |
|--------|---------|----------|-----------|
| Response Time | > 500ms | > 2s | > 5s |
| Error Rate | > 1% | > 5% | > 20% |
| Availability | < 99.5% | < 99% | < 95% |
| Memory Usage | > 75% | > 85% | > 95% |
| DB Connections | > 15 | > 18 | > 20 |

**Notification Channels**:
- Slack (via webhook)
- Email (SMTP)
- PagerDuty
- Discord
- Telegram
- Custom webhooks

**Alert Rules** (8 total):
- API Response Time
- Error Rate
- Service Availability
- Database Latency
- Database Connections
- Memory Usage
- CPU Usage
- Task Queue Backlog

### 4. Logging Utility
**File**: `src/utils/logger.ts`

Structured logging with Winston:
- JSON output for production
- Pretty output for development
- Multiple log files (combined, error, access)
- Request context tracking with UUID
- Log rotation (10MB per file, 14 days retention)
- Security and audit logging helpers

Log Files:
- `logs/combined.log` - All logs (info+)
- `logs/error.log` - Error logs only
- `logs/access.log` - HTTP access logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled rejections

### 5. Documentation
**File**: `docs/MONITORING.md`

Comprehensive monitoring guide including:
- Architecture diagram
- Component descriptions
- Configuration examples
- Deployment integration (Docker, K8s, Render)
- Runbooks for common issues
- Troubleshooting guide

## Integration with Main Application

### Updated Files

**`src/index.ts`**:
- Integrated health check endpoints
- Added request tracking with UUID
- Structured logging with request context
- Graceful shutdown handling
- Database connection on startup
- `/metrics` endpoint for runtime metrics

**`package.json`**:
- Added `uuid` dependency
- Added `@types/uuid` dev dependency

**`.env.example`**:
- Added monitoring environment variables
- Added alerting configuration
- Added log aggregation settings

## Environment Variables

### Required for Monitoring
```bash
# Logging
LOG_LEVEL=info                    # debug, info, warn, error
LOG_FORMAT=json                   # json or pretty
LOG_TO_CONSOLE=false              # Console output in production

# Health Checks
HEALTH_CHECK_TIMEOUT=5000
MONITOR_BASE_URL=http://localhost:3000

# Slack Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
SLACK_CHANNEL=#alerts

# Email Alerts
ALERT_SMTP_HOST=smtp.gmail.com
ALERT_SMTP_PORT=587
ALERT_EMAIL_FROM=alerts@example.com
ALERT_EMAIL_TO=ops@example.com

# PagerDuty
PAGERDUTY_KEY=your-service-key

# Other Channels
DISCORD_WEBHOOK_URL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ALERT_WEBHOOK_URL=...

# Log Aggregation
DD_API_KEY=...
SPLUNK_HEC_URL=...
ELASTICSEARCH_URL=...
```

## Usage

### Starting the Application
```bash
npm install
npm run build
npm start
```

### Running the Monitor (Standalone)
```bash
npx ts-node src/monitoring/monitor.ts
# Or with custom URL
MONITOR_BASE_URL=https://api.example.com npx ts-node src/monitoring/monitor.ts
```

### Testing Health Endpoints
```bash
# Basic health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed | jq

# Metrics
curl http://localhost:3000/metrics | jq

# Readiness probe
curl http://localhost:3000/health/ready

# Liveness probe
curl http://localhost:3000/health/live
```

### Viewing Logs
```bash
# Follow combined logs
tail -f logs/combined.log | jq

# View recent errors
tail -f logs/error.log | jq

# Access logs
tail -f logs/access.log
```

## Monitoring Dashboard Specification

### Grafana Panels (Recommended)

1. **Service Overview**
   - Uptime percentage
   - Error rate (requests with 5xx status)
   - Average response time
   - Requests per second

2. **Database Metrics**
   - Query latency (avg, p95, p99)
   - Active connections
   - Slow queries per minute
   - Connection pool utilization

3. **System Resources**
   - Memory usage percentage
   - CPU load average
   - Disk utilization
   - Network I/O

4. **Business Metrics**
   - Active agents count
   - Pending tasks
   - Tasks completed (24h)
   - Average task completion time

## Alert Response Procedures

### High Error Rate (> 5%)
1. Check `/health/detailed` for component status
2. Review `logs/error.log` for patterns
3. Verify database connectivity
4. Check external dependencies (blockchain RPC)
5. Scale up if resource constrained

### Database Latency (> 100ms)
1. Check active connections: `SELECT * FROM pg_stat_activity`
2. Identify slow queries in logs
3. Run `ANALYZE` on affected tables
4. Check for connection leaks
5. Consider read replicas

### Memory Exhaustion (> 85%)
1. Check for memory leaks with heap dumps
2. Review recent deployments
3. Restart service if necessary
4. Scale up memory allocation

## Files Structure

```
agent-marketplace/
├── src/
│   ├── monitoring/
│   │   ├── health-check.ts    # Health endpoints
│   │   └── monitor.ts         # Uptime monitoring
│   ├── utils/
│   │   └── logger.ts          # Winston logging
│   ├── services/
│   │   └── db.ts              # Database with health checks
│   ├── config/
│   │   └── alerts.ts          # Alert thresholds
│   └── index.ts               # Main app with monitoring
├── config/
│   └── alerts.ts              # Alert configuration
├── docs/
│   └── MONITORING.md          # Documentation
├── logs/                      # Log files (gitignored)
├── .env.example               # Environment variables
└── package.json               # Dependencies
```

## Next Steps

1. **Configure Alert Channels**: Set up Slack, PagerDuty, or email in environment variables
2. **Set Up Log Aggregation**: Configure Datadog, Splunk, or ELK for centralized logging
3. **Create Grafana Dashboard**: Import dashboard JSON from monitoring spec
4. **Set Up Prometheus**: Add prometheus exporter for metrics collection
5. **Configure Kubernetes Probes**: Use `/health/ready` and `/health/live` for K8s deployments
6. **Test Alerting**: Trigger test alerts to verify notification channels
7. **Document Runbooks**: Expand runbooks based on observed incidents

## TypeScript Compilation

All monitoring code is fully typed and passes TypeScript strict mode:
```bash
npx tsc --noEmit
```

## Security Considerations

- Health endpoints don't expose sensitive data
- Alert webhooks use HTTPS only
- Logs don't include passwords or tokens
- Request IDs prevent log injection
- Health check timeouts prevent DoS
