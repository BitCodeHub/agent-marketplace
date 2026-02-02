# AI Agent Marketplace - Production Deployment Checklist

## Pre-Deployment Verification ✅

### 1. Required Files Status

| File | Status | Notes |
|------|--------|-------|
| `package.json` | ✅ Found | Dependencies configured, scripts defined |
| `render.yaml` | ✅ Found | Render.com blueprint configured |
| `prisma/schema.prisma` | ✅ Found | Database schema with 5 models, indexes, constraints |
| `src/index.ts` | ✅ Found | Express server with health check |
| `tsconfig.json` | ✅ Found | TypeScript config targeting ES2022 |
| `Dockerfile` | ✅ Found | Multi-stage build configuration |
| `docker-compose.yml` | ✅ Found | Local development stack |
| `.env.example` | ✅ Found | Environment variables template |

### 2. Guardrail Files Status

| File | Status | Purpose |
|------|--------|---------|
| `src/services/guardrails.ts` | ✅ Found | Business logic protection (anti-gaming, limits) |
| `src/middleware/rateLimiter.ts` | ✅ Found | Token bucket rate limiting |
| `src/middleware/validation.ts` | ✅ Found | Input validation with express-validator |
| `src/config/limits.ts` | ✅ Found | Centralized limits configuration |
| `src/services/db.ts` | ✅ Found | Database service with connection pooling |

---

## Environment Variables Required

### Critical (Required for Startup)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/agent_marketplace
DIRECT_URL=postgresql://user:pass@host:5432/agent_marketplace  # For migrations

# Server
NODE_ENV=production
PORT=10000
JWT_SECRET=min-32-character-secret-key
```

### Important (Required for Features)

```bash
# Rate Limiting & Security
BCRYPT_ROUNDS=12
API_PREFIX=/api/v1
API_VERSION=v1

# Feature Flags
ENABLE_SWAGGER=true
ENABLE_METRICS=true
LOG_LEVEL=info
```

### Optional (Enhanced Functionality)

```bash
# Blockchain (if integrating smart contracts)
ETHEREUM_RPC_URL=
SEPOLIA_RPC_URL=
MARKETPLACE_CONTRACT_ADDRESS=
ESCROW_CONTRACT_ADDRESS=

# File Storage
IPFS_API_URL=
PINATA_API_KEY=
AWS_S3_BUCKET=

# Notifications
SMTP_HOST=
EMAIL_API_KEY=

# Monitoring
SENTRY_DSN=
```

---

## Database Setup Steps

### 1. Create PostgreSQL Database
```sql
CREATE DATABASE agent_marketplace;
CREATE USER agent_marketplace WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE agent_marketplace TO agent_marketplace;
```

### 2. Run Migrations
```bash
npx prisma migrate deploy
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. (Optional) Seed Database
```bash
npx prisma db seed
```

### 5. Verify Connection
```bash
npx prisma db pull
```

---

## Render.com Deployment Steps

### 1. Create Blueprint Instance
1. Go to Render Dashboard
2. Click "New" → "Blueprint"
3. Connect GitHub repository
4. Select `render.yaml`
5. Click "Apply"

### 2. Environment Variables (Auto-configured)
The `render.yaml` automatically sets:
- `DATABASE_URL` (from managed PostgreSQL)
- `JWT_SECRET` (auto-generated)
- All other standard variables

### 3. Manual Overrides (if needed)
- Add any custom environment variables in Render dashboard
- Update plan from "free" to paid for production traffic

---

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-service.onrender.com/health
```
Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T...",
  "version": "1.0.0",
  "uptime": 123
}
```

### 2. API Endpoint Test
```bash
curl https://your-service.onrender.com/api/v1
```
Expected response:
```json
{
  "name": "AI Agent Marketplace API",
  "version": "1.0.0",
  "documentation": "/api-docs"
}
```

### 3. Database Connectivity
```bash
# Check Prisma connection
npx prisma db pull --force
```

### 4. Rate Limiting Test
```bash
# Should return 429 after limit exceeded
for i in {1..105}; do
  curl -s -o /dev/null -w "%{http_code}" https://your-service.onrender.com/health
done
```

---

## Validation Results

### TypeScript Compilation
- Status: Pending (requires npm install)
- Command: `npm run build`

### Prisma Schema Validation
- Status: Pending (requires npm install)
- Command: `npx prisma validate`

### Dependency Audit
- Status: Pending (requires npm install)
- Command: `npm audit`

---

## Known Issues & Considerations

### 1. Rate Limiter Uses In-Memory Store
**Issue**: `src/middleware/rateLimiter.ts` uses in-memory Map for rate limiting.
**Impact**: Rate limits won't be shared across multiple server instances.
**Mitigation**: For horizontal scaling, replace with Redis:
```typescript
// Add ioredis to dependencies
import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);
```

### 2. Missing Cron Scripts
**Issue**: `render.yaml` references `npm run cron:reputation-decay` and `npm run cron:task-cleanup` but these scripts are not defined in `package.json`.
**Fix Required**: Add to `package.json` scripts:
```json
{
  "scripts": {
    "cron:reputation-decay": "node dist/cron/reputation-decay.js",
    "cron:task-cleanup": "node dist/cron/task-cleanup.js"
  }
}
```

### 3. Missing Cron Job Files
**Issue**: The cron job source files don't exist yet.
**Fix Required**: Create:
- `src/cron/reputation-decay.ts`
- `src/cron/task-cleanup.ts`

### 4. Prisma Schema References `DIRECT_URL`
**Issue**: Schema uses `directUrl = env("DIRECT_URL")` but this isn't in render.yaml.
**Fix Required**: Add to render.yaml envVars:
```yaml
- key: DIRECT_URL
  fromDatabase:
    name: agent-marketplace-db
    property: connectionString
```

### 5. Frontend Not Deployed by Render.yaml
**Issue**: The render.yaml only deploys the backend API, not the Next.js frontend.
**Mitigation**: Frontend requires separate deployment (Vercel recommended for Next.js).

---

## Security Checklist

- [ ] JWT_SECRET is strong (min 32 chars) and unique per environment
- [ ] CORS_ORIGIN is restricted to known domains
- [ ] Rate limiting is configured
- [ ] BCRYPT_ROUNDS >= 12 for production
- [ ] Database uses SSL connections
- [ ] No hardcoded secrets in code
- [ ] Helmet.js middleware enabled ✅
- [ ] Input validation on all endpoints ✅

---

## Monitoring Setup

### Logs
- Render.com provides built-in log streaming
- Application logs Winston format in production

### Health Endpoints
- `/health` - Basic health check
- Database health check available via `db.healthCheck()`

### Metrics
- Query metrics tracked in `db.ts`
- Slow query logging enabled (threshold: 1000ms)

---

## Rollback Plan

1. **Database**: Render.com provides point-in-time recovery for managed PostgreSQL
2. **Code**: Revert commit and redeploy via Git
3. **Emergency**: Set `MAINTENANCE_MODE=true` env var to return 503

---

## Deployment Readiness: ⚠️ PARTIAL

### Blockers to Address:
1. Add missing cron scripts to package.json
2. Create cron job implementation files
3. Add DIRECT_URL to render.yaml
4. Run validation checks after npm install
5. Consider Redis for distributed rate limiting

### Ready for Deployment:
- ✅ Core API structure
- ✅ Database schema
- ✅ Guardrails implementation
- ✅ Render.com configuration
- ✅ Docker support
