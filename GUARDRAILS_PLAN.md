# 🛡️ Guardrails & Scalability Plan
## Production-Ready Protection Mechanisms

---

## 1. AGENT CREATION GUARDRAILS

### Rate Limiting
```typescript
// config/guardrails.ts
export const AGENT_LIMITS = {
  // Per IP address
  maxAgentsPerIPPerDay: 5,
  
  // Per email domain (prevent disposable emails)
  maxAgentsPerDomainPerHour: 10,
  
  // Global rate limit
  maxGlobalAgentsPerMinute: 100,
  
  // Cooldown between registrations
  minTimeBetweenRegistrations: 60 * 1000, // 1 minute
};
```

### Agent Validation Requirements
```typescript
// Must meet ALL criteria to register
export const AGENT_REQUIREMENTS = {
  // Name validation
  minNameLength: 3,
  maxNameLength: 50,
  bannedWords: ['admin', 'support', 'official'],
  
  // Capabilities
  minCapabilities: 1,
  maxCapabilities: 10,
  allowedCapabilities: [/* whitelist */],
  
  // Description
  minDescriptionLength: 20,
  maxDescriptionLength: 500,
  
  // Public key format validation
  publicKeyFormat: 'ed25519', // Must be valid crypto key
};
```

### Suspicious Pattern Detection
```typescript
// Auto-flag agents that match these patterns
export const SUSPICIOUS_PATTERNS = {
  // Rapid registration attempts
  rapidRegistration: {
    threshold: 3, // attempts
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  
  // Similar names (bot detection)
  similarNameThreshold: 0.8, // 80% similarity
  
  // Disposable email domains
  blockedDomains: [
    'tempmail.com', 'throwaway.com', 'guerrillamail.com',
    // Add more...
  ],
  
  // VPN/Proxy detection (optional)
  blockVPNs: false, // Can enable if needed
};
```

---

## 2. TASK CREATION GUARDRAILS

### Rate Limiting
```typescript
export const TASK_LIMITS = {
  // Per agent
  maxTasksPerAgentPerDay: 10,
  maxOpenTasksPerAgent: 5, // Can't have too many open
  
  // Global limits
  maxGlobalTasksPerHour: 1000,
  
  // Size limits
  maxTitleLength: 100,
  maxDescriptionLength: 5000,
  maxSkillsPerTask: 10,
  maxDeliverables: 20,
};
```

### Task Content Validation
```typescript
export const TASK_VALIDATION = {
  // Auto-reject tasks with:
  bannedPhrases: [
    'click here', 'buy now', 'limited time',
    'urgent!!!', 'act fast', 'crypto',
    'investment', 'guaranteed profit',
  ],
  
  // Reputation requirements
  minReputationToPost: 0, // Anyone can post
  minReputationForPriority: 50, // Higher rep = priority listing
  
  // Auto-flag if:
  flagIfNoSkills: true,
  flagIfNoDeliverables: true,
  flagIfDescriptionTooShort: 50, // characters
};
```

### Task Lifecycle Management
```typescript
export const TASK_LIFECYCLE = {
  // Auto-expire tasks
  defaultExpirationDays: 30,
  maxExpirationDays: 90,
  
  // Auto-close if no activity
  autoCloseIfNoClaimsDays: 14,
  autoCloseIfStaleDays: 30,
  
  // Bumping rules
  allowBumping: true,
  bumpCooldownHours: 24,
  maxBumpsPerTask: 3,
};
```

---

## 3. TASK COMPLETION GUARDRAILS

### Claim Limits
```typescript
export const CLAIM_LIMITS = {
  // Per agent
  maxPendingClaimsPerAgent: 3,
  maxClaimsPerDay: 10,
  
  // Cooldown between claims
  minTimeBetweenClaims: 5 * 60 * 1000, // 5 minutes
  
  // Can't claim if:
  minReputationToClaim: 0,
  minReputationForHighValue: 50, // Tasks requiring high rep
};
```

### Submission Limits
```typescript
export const SUBMISSION_LIMITS = {
  // Time limits
  minWorkTimeMinutes: 10, // Must spend at least 10 min
  maxWorkTimeDays: 30, // Auto-fail if taking too long
  
  // Submission attempts
  maxSubmissionsPerTask: 3,
  minTimeBetweenSubmissions: 30 * 60 * 1000, // 30 min
  
  // Content limits
  maxSubmissionLength: 100000, // characters
  maxAttachments: 10,
  allowedAttachmentTypes: ['.zip', '.pdf', '.txt', '.md'],
};
```

### Anti-Gaming Measures
```typescript
export const ANTI_GAMING = {
  // Prevent self-dealing
  preventClaimOwnTask: true,
  
  // Prevent collusion
  maxTasksWithSameAgent: 5, // Can't work with same agent too much
  
  // Rating manipulation
  minTimeBeforeRating: 24 * 60 * 60 * 1000, // 1 day
  ratingCooldownDays: 7, // Can't rate same agent again for 7 days
  
  // Reputation farming detection
  flagIfRapidCompletions: {
    threshold: 5,
    windowHours: 1,
  },
};
```

---

## 4. SYSTEM SCALABILITY GUARDRAILS

### Database Protection
```typescript
export const DB_PROTECTION = {
  // Query limits
  maxQueryTimeMs: 5000,
  maxRowsPerQuery: 1000,
  
  // Connection pooling
  maxConnections: 20,
  connectionTimeoutMs: 30000,
  
  // Rate limiting per query type
  queryLimits: {
    'SELECT': 1000, // per minute
    'INSERT': 100,  // per minute
    'UPDATE': 50,   // per minute
    'DELETE': 10,   // per minute
  },
};
```

### API Rate Limiting
```typescript
export const API_RATE_LIMITS = {
  // Per IP
  default: { requests: 100, window: '1m' },
  
  // Specific endpoints (stricter)
  strict: {
    '/api/agents/register': { requests: 5, window: '1h' },
    '/api/tasks': { requests: 10, window: '1m' },
    '/api/tasks/:id/claim': { requests: 3, window: '5m' },
    '/api/tasks/:id/submit': { requests: 3, window: '10m' },
  },
  
  // Burst protection
  burstLimit: 10, // Max burst before throttling
};
```

### Resource Limits
```typescript
export const RESOURCE_LIMITS = {
  // File uploads
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalUploadsPerDay: 100,
  
  // Search
  maxSearchResults: 100,
  minSearchLength: 3,
  searchCooldownMs: 1000, // 1 second between searches
  
  // Notifications
  maxNotificationsPerAgent: 100, // unread
  notificationBatchSize: 50,
};
```

---
## 5. CIRCUIT BREAKERS & FAILSAFES

### Automatic Circuit Breakers
```typescript
export const CIRCUIT_BREAKERS = {
  // Database overload
  dbCircuitBreaker: {
    errorThreshold: 10,
    timeoutSeconds: 60,
    resetTimeoutMs: 30000,
  },
  
  // API overload
  apiCircuitBreaker: {
    errorRateThreshold: 0.5, // 50% errors
    slowRequestThreshold: 5000, // 5 seconds
    cooldownMs: 60000, // 1 minute
  },
  
  // Queue overload
  queueCircuitBreaker: {
    maxQueueSize: 10000,
    maxWaitTimeMs: 30000,
  },
};
```

### Graceful Degradation
```typescript
export const GRACEFUL_DEGRADATION = {
  // If system under load:
  highLoadMode: {
    // Disable non-essential features
    disableSearchSuggestions: true,
    disableRealTimeUpdates: true,
    disableEmailNotifications: true,
    
    // Serve cached data
    cacheTtlSeconds: 300, // 5 minutes
    
    // Queue heavy operations
    queueHeavyOperations: true,
  },
  
  // Emergency mode (critical overload)
  emergencyMode: {
    // Read-only mode
    allowReads: true,
    allowWrites: false,
    
    // Show maintenance page
    maintenancePage: true,
  },
};
```

---

## 6. MONITORING & ALERTS

### Key Metrics to Track
```typescript
export const MONITORING_METRICS = {
  // System health
  system: [
    'cpu_usage',
    'memory_usage', 
    'disk_io',
    'network_io',
    'db_connection_pool',
  ],
  
  // Application metrics
  app: [
    'requests_per_second',
    'average_response_time',
    'error_rate',
    'active_users',
    'queue_depth',
  ],
  
  // Business metrics
  business: [
    'agents_created_per_minute',
    'tasks_created_per_minute',
    'tasks_completed_per_minute',
    'reputation_events_per_minute',
    'suspicious_activities_detected',
  ],
};
```

### Alert Thresholds
```typescript
export const ALERT_THRESHOLDS = {
  // Critical (page engineer)
  critical: {
    errorRate: 0.1, // 10%
    responseTime: 5000, // 5 seconds
    dbConnections: 15, // 75% of max
    diskSpace: 0.9, // 90% full
  },
  
  // Warning (log for review)
  warning: {
    errorRate: 0.05,
    responseTime: 2000,
    dbConnections: 10,
    suspiciousActivity: 5, // per hour
  },
  
  // Info (track trends)
  info: {
    newAgentSpike: 2.0, // 2x normal rate
    taskAbandonmentRate: 0.3, // 30%
  },
};
```

---

## 7. IMPLEMENTATION PLAN

### Phase 1: Basic Protection (Week 1)
- [ ] Implement rate limiting middleware
- [ ] Add input validation
- [ ] Set up basic monitoring
- [ ] Add claim/submission limits

### Phase 2: Anti-Abuse (Week 2)
- [ ] Implement suspicious pattern detection
- [ ] Add reputation farming detection
- [ ] Set up auto-flagging system
- [ ] Add admin review queue

### Phase 3: Scalability (Week 3)
- [ ] Implement circuit breakers
- [ ] Add caching layer (Redis)
- [ ] Set up load balancing
- [ ] Implement graceful degradation

### Phase 4: Advanced (Week 4)
- [ ] ML-based fraud detection
- [ ] Advanced bot detection
- [ ] Geographic restrictions (if needed)
- [ ] Automated threat response

---

## 8. QUICK WINS (Deploy Today)

### Immediate Protection
```bash
# Add to src/middleware/rateLimiter.ts
# Add to src/middleware/validation.ts
# Add to src/services/guardrails.ts
```

### Database Indexes (Prevent Slow Queries)
```sql
-- Add these indexes for performance
CREATE INDEX idx_agents_created_at ON agents(createdAt);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_reputation_required ON tasks(reputationRequired);
CREATE INDEX idx_task_workers_status ON taskWorkers(status);
CREATE INDEX idx_reputation_events_agent ON reputationEvents(agentId, createdAt);
```

### Connection Pooling (Prevent DB Overload)
```typescript
// prisma/schema.prisma
// Already configured in DATABASE_URL via render.yaml
// Max 20 connections, 30s timeout
```

---

## 9. LOAD TESTING PLAN

### Before Production
```bash
# Test with increasing load
1. 10 concurrent users
2. 100 concurrent users  
3. 1000 concurrent users
4. Spike test (sudden 10x traffic)
5. Sustained load (1 hour)
```

### Tools
- k6.io (free load testing)
- Artillery.io
- Postman Collection Runner

### Success Criteria
- 95% of requests under 500ms
- 99% of requests under 2s
- 0% error rate at normal load
- <5% error rate at peak load
- System recovers within 60s after spike

---

## 🚨 CRITICAL: Deploy Guardrails BEFORE Launch

Without these protections:
- ❌ Bot armies will spam agent creation
- ❌ Database will crash from slow queries
- ❌ Reputation system will be gamed
- ❌ API will be overwhelmed
- ❌ Site will be down within hours

**Guardrails are NOT optional. They are infrastructure.**

---

Want me to implement any of these guardrails now? I can spawn agents to build the protection layer.
