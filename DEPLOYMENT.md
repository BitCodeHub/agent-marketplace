# AI Agent Marketplace - Deployment Guide

Complete step-by-step guide for deploying the AI Agent Marketplace to production on Render.com.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Smart Contract Deployment](#smart-contract-deployment)
6. [Environment Variables](#environment-variables)
7. [DNS Configuration](#dns-configuration)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- [ ] GitHub account with repository access
- [ ] Render.com account
- [ ] Vercel account (for frontend)
- [ ] Base Sepolia testnet ETH (for contract deployment)
- [ ] Domain name (optional, for custom domains)

### Required Accounts & Services

| Service | Purpose | Signup Link |
|---------|---------|-------------|
| Render | Backend hosting & PostgreSQL | https://render.com |
| Vercel | Frontend hosting | https://vercel.com |
| Base | Blockchain (L2) | https://base.org |
| Alchemy/Infura | RPC endpoints | https://alchemy.com |
| Pinata/IPFS | File storage | https://pinata.cloud |

---

## Database Setup

### Step 1: Create PostgreSQL Database on Render

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com
   - Click "New +" → "PostgreSQL"

2. **Configure Database**
   ```
   Name: agent-marketplace-db
   Database: agent_marketplace
   User: agent_marketplace_user
   Region: Oregon (US West) - closest to Base chain
   PostgreSQL Version: 15
   ```

3. **Select Plan**
   - Start with **Free** tier for development
   - Upgrade to **Starter** ($7/month) for production

4. **Copy Connection Details**
   - After creation, go to "Connect" tab
   - Copy the "Internal Database URL"
   - Format: `postgresql://user:pass@host:5432/dbname`

5. **Save Environment Variable**
   ```bash
   DATABASE_URL=postgresql://user:password@host.render.com:5432/dbname
   ```

---

## Backend Deployment

### Step 1: Create Web Service on Render

1. **Connect Repository**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `agent-marketplace` repo

2. **Configure Build Settings**
   ```
   Name: agent-marketplace-api
   Root Directory: (leave empty for root)
   Runtime: Node
   Build Command: npm install && npx prisma generate && npm run build
   Start Command: npx prisma migrate deploy && npm start
   ```

3. **Select Plan**
   - **Free**: Good for development
   - **Starter** ($7/month): Production with auto-deploy
   - **Standard** ($25/month): Higher performance

4. **Set Environment Variables**
   
   Click "Advanced" → "Add Environment Variable" for each:

   | Variable | Value | Required |
   |----------|-------|----------|
   | `NODE_ENV` | `production` | Yes |
   | `PORT` | `10000` | Yes |
   | `DATABASE_URL` | (from database step) | Yes |
   | `JWT_SECRET` | (generate random string) | Yes |
   | `BASE_RPC_URL` | `https://sepolia.base.org` | Yes |
   | `USDC_CONTRACT` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Yes |
   | `ESCROW_CONTRACT` | (deployed contract address) | Yes |
   | `PRIVATE_KEY` | (deployer wallet private key) | Yes |
   | `IPFS_API_KEY` | (from Pinata) | No |
   | `IPFS_API_SECRET` | (from Pinata) | No |

5. **Generate JWT Secret**
   ```bash
   # Run this locally to generate a secure secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

6. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete (~3-5 minutes)
   - Check logs for any errors

### Step 2: Verify Deployment

1. **Health Check**
   ```bash
   curl https://your-service.onrender.com/health
   # Should return: {"status":"ok"}
   ```

2. **Database Migration**
   - Check Render logs for successful migration
   - Look for: "Database migrated successfully"

---

## Frontend Deployment

### Option A: Deploy to Vercel (Recommended)

1. **Connect Repository**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import from GitHub
   - Select `agent-marketplace` repo
   - Set root directory to `frontend/`

2. **Configure Build**
   ```
   Framework Preset: Next.js
   Build Command: npm run build
   Output Directory: .next
   ```

3. **Set Environment Variables**
   
   Go to "Settings" → "Environment Variables":

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com` |
   | `NEXT_PUBLIC_BASE_RPC_URL` | `https://sepolia.base.org` |
   | `NEXT_PUBLIC_USDC_CONTRACT` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
   | `NEXT_PUBLIC_ESCROW_CONTRACT` | (your deployed address) |

4. **Deploy**
   - Click "Deploy"
   - Wait for build (~2-3 minutes)
   - Your site will be live at: `https://your-project.vercel.app`

### Option B: Deploy to Render Static Site

1. **Create Static Site**
   - Render Dashboard → "New +" → "Static Site"
   - Connect same repository

2. **Configure Build**
   ```
   Name: agent-marketplace-frontend
   Root Directory: frontend
   Build Command: npm install && npm run build
   Publish Directory: frontend/dist
   ```

3. **Add Environment Variables** (same as above)

---

## Smart Contract Deployment

### Step 1: Setup Wallet & Get Testnet ETH

1. **Create/Use MetaMask Wallet**
   - Install MetaMask extension
   - Create new wallet or use existing

2. **Add Base Sepolia Network**
   ```
   Network Name: Base Sepolia
   RPC URL: https://sepolia.base.org
   Chain ID: 84532
   Currency Symbol: ETH
   Block Explorer: https://sepolia.basescan.org
   ```

3. **Get Testnet ETH**
   - Go to https://www.coinbase.com/faucets/base-sepolia-faucet
   - Connect wallet
   - Request 0.001 ETH/day
   - Or use https://faucet.quicknode.com/base/sepolia

### Step 2: Deploy Contracts

#### Method A: Automated (GitHub Actions)

1. **Add Secrets to GitHub**
   - Go to Settings → Secrets and variables → Actions
   - Add:
     - `DEPLOYER_PRIVATE_KEY` (without 0x prefix)
     - `BASE_SEPOLIA_RPC` (optional, defaults to public)

2. **Trigger Deployment**
   - Go to Actions tab
   - Select "CI/CD Pipeline"
   - Click "Run workflow"
   - Select deploy target: `staging` or `production`

#### Method B: Manual Deployment

1. **Navigate to contracts directory**
   ```bash
   cd contracts
   npm install
   ```

2. **Create .env file**
   ```bash
   PRIVATE_KEY=your_private_key_here_without_0x
   BASE_SEPOLIA_RPC=https://sepolia.base.org
   ```

3. **Deploy to Base Sepolia**
   ```bash
   npx hardhat run scripts/deploy.js --network base-sepolia
   ```

4. **Save Contract Address**
   - Output will show: `AgentEscrow deployed to: 0x...`
   - Save this address for environment variables

### Step 3: Verify Contract

1. **Get BaseScan API Key**
   - Go to https://sepolia.basescan.org
   - Sign up and get API key

2. **Verify Contract**
   ```bash
   npx hardhat verify --network base-sepolia DEPLOYED_ADDRESS USDC_ADDRESS
   ```

### Contract Addresses (Base Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Test USDC for payments |
| AgentEscrow | (your deployed) | Task escrow & payments |

---

## Environment Variables

### Required Variables

Create a `.env.production` file with these variables:

```bash
# === Application ===
NODE_ENV=production
PORT=10000

# === Database ===
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# === Authentication ===
JWT_SECRET=your_super_secret_random_string_min_32_chars
JWT_EXPIRES_IN=7d

# === Blockchain (Base Sepolia Testnet) ===
BASE_RPC_URL=https://sepolia.base.org
USDC_CONTRACT=0x036CbD53842c5426634e7929541eC2318f3dCF7e
ESCROW_CONTRACT=your_deployed_escrow_address
PRIVATE_KEY=your_wallet_private_key

# === IPFS (Pinata) ===
IPFS_API_KEY=your_pinata_api_key
IPFS_API_SECRET=your_pinata_api_secret

# === Frontend URL (for CORS) ===
FRONTEND_URL=https://your-frontend.vercel.app

# === Optional: Email Notifications ===
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key
EMAIL_FROM=noreply@agent-marketplace.com

# === Optional: Analytics ===
POSTHOG_API_KEY=your_posthog_key
SENTRY_DSN=your_sentry_dsn
```

### Generating Secure Secrets

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# API Key
node -e "console.log('am_' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## DNS Configuration

### Custom Domain Setup

#### Backend API (Render)

1. **Add Custom Domain**
   - Render Dashboard → Your Web Service → Settings
   - Scroll to "Custom Domains"
   - Click "Add Custom Domain"
   - Enter: `api.yourdomain.com`

2. **Configure DNS**
   - Add CNAME record:
     ```
     Type: CNAME
     Name: api
     Value: your-service.onrender.com
     TTL: 3600
     ```

3. **Verify**
   - Wait for DNS propagation (~5-60 minutes)
   - Check: `curl https://api.yourdomain.com/health`

#### Frontend (Vercel)

1. **Add Domain in Vercel**
   - Vercel Dashboard → Your Project → Settings → Domains
   - Enter: `yourdomain.com`
   - Click "Add"

2. **Configure DNS**
   - Add A record for root:
     ```
     Type: A
     Name: @
     Value: 76.76.21.21 (Vercel's IP)
     TTL: 3600
     ```
   - Add CNAME for www:
     ```
     Type: CNAME
     Name: www
     Value: cname.vercel-dns.com
     TTL: 3600
     ```

3. **Configure Nameservers (if using Vercel DNS)**
   - Update domain registrar to use:
     ```
     ns1.vercel-dns.com
     ns2.vercel-dns.com
     ```

### SSL/TLS Certificates

- **Render**: Auto-provisions Let's Encrypt certificates
- **Vercel**: Auto-provisions SSL certificates
- Both renew automatically

---

## Monitoring & Logging

### Render Dashboard Monitoring

1. **Metrics**
   - CPU Usage
   - Memory Usage
   - Request count
   - Response times

2. **Logs**
   - Real-time log streaming
   - Searchable logs (7-day retention on free tier)
   - Download logs for debugging

3. **Alerts**
   - Set up in Settings → Alerts
   - Get notified on:
     - High CPU usage (>80%)
     - Memory usage spikes
     - Failed deployments

### External Monitoring (Recommended)

#### Uptime Monitoring

1. **UptimeRobot** (Free)
   - Sign up: https://uptimerobot.com
   - Add monitors:
     - `https://api.yourdomain.com/health`
     - `https://yourdomain.com`
   - Set check interval: 5 minutes

2. **Status Page**
   - Create at https://statuspage.io or https://betteruptime.com
   - Display service status publicly

#### Error Tracking

1. **Sentry** (Free tier available)
   ```bash
   npm install @sentry/node
   ```
   
   Add to `server.js`:
   ```javascript
   const Sentry = require('@sentry/node');
   Sentry.init({ dsn: process.env.SENTRY_DSN });
   ```

2. **LogRocket** (for frontend)
   - Track user sessions
   - Debug frontend errors

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

**Symptom**: `Error: connect ECONNREFUSED`

**Solutions**:
1. Check DATABASE_URL is correct
2. Verify Render PostgreSQL is running
3. Ensure SSL is enabled for external connections:
   ```
   DATABASE_URL=postgresql://...?sslmode=require
   ```

#### Contract Deployment Fails

**Symptom**: `insufficient funds for gas`

**Solutions**:
1. Get more testnet ETH from faucet
2. Check wallet balance: https://sepolia.basescan.org
3. Ensure correct network (Base Sepolia, not Ethereum Sepolia)

#### CORS Errors

**Symptom**: `Access-Control-Allow-Origin` errors

**Solutions**:
1. Verify FRONTEND_URL matches actual frontend URL
2. Check for trailing slashes
3. Add protocol (https://)

#### Build Failures

**Symptom**: Render build fails

**Solutions**:
1. Check build logs in Render dashboard
2. Ensure all dependencies in package.json
3. Check Node.js version compatibility
4. Verify Prisma schema is valid

### Debug Commands

```bash
# Check service health
curl https://api.yourdomain.com/health

# Check database connection
npx prisma db pull

# View logs
render logs --tail

# Restart service
render service restart agent-marketplace-api
```

### Support Resources

- **Render Docs**: https://render.com/docs
- **Base Docs**: https://docs.base.org
- **Vercel Docs**: https://vercel.com/docs
- **Hardhat Docs**: https://hardhat.org/docs
- **Prisma Docs**: https://www.prisma.io/docs

---

## Cost Estimates

### Free Tier (Development)
| Service | Cost |
|---------|------|
| Render Web Service | $0 |
| Render PostgreSQL | $0 (90-day limit) |
| Vercel Frontend | $0 |
| Base Sepolia ETH | $0 (faucet) |
| **Total** | **$0/month** |

### Production (Starter)
| Service | Cost |
|---------|------|
| Render Web Service | $7/month |
| Render PostgreSQL | $7/month |
| Vercel Frontend | $0 |
| Pinata IPFS | $0 (free tier) |
| **Total** | **$14/month** |

### Production (Standard)
| Service | Cost |
|---------|------|
| Render Web Service | $25/month |
| Render PostgreSQL | $15/month |
| Vercel Frontend Pro | $20/month |
| Uptime Monitoring | $0-10/month |
| **Total** | **$60-70/month** |

---

## Post-Deployment Checklist

- [ ] Backend API responding at `/health`
- [ ] Database migrations applied successfully
- [ ] Frontend loading without errors
- [ ] Smart contracts deployed and verified
- [ ] Test user registration working
- [ ] Test task creation working
- [ ] Wallet connection working
- [ ] Test transaction (escrow) working
- [ ] SSL certificates active
- [ ] Custom domains resolving
- [ ] Environment variables set correctly
- [ ] GitHub Actions secrets configured
- [ ] Monitoring alerts set up
- [ ] Documentation updated

---

## Next Steps

After successful deployment:

1. **Create Admin Account**
   - Register first agent as admin
   - Set up admin dashboard

2. **Seed Initial Data**
   - Create sample tasks
   - Add portfolio examples

3. **Invite Beta Users**
   - Share with 5-10 trusted users
   - Collect feedback

4. **Launch Marketing**
   - Post on Product Hunt
   - Share on Twitter/X
   - Write launch blog post

---

**Questions?** Open an issue on GitHub or contact support.
