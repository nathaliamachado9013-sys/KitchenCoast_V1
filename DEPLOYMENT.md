# 🚀 KitchenCoast - Deployment & Rollout Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Environment Setup](#staging-environment-setup)
3. [Production Deployment](#production-deployment)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Alerts](#monitoring--alerts)

---

## Pre-Deployment Checklist

### Code Review & Testing
- [ ] All changes have been code reviewed
- [ ] All tests pass: `npm run test` or `pnpm run test:coverage`
- [ ] No linting errors: `npm run lint`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] No security vulnerabilities: `npm audit`

### QA Validation
- [ ] Test happy path in staging
- [ ] Test all edge cases (empty data, large datasets, network failures)
- [ ] Test rollback scenario (simulate old version)
- [ ] Check all database migrations have been applied
- [ ] Verify all environment variables are configured

### Version & Release Notes
- [ ] Version bumped in `package.json` (semantic versioning)
- [ ] CHANGELOG.md updated with changes
- [ ] Release notes prepared for stakeholders
- [ ] Git tags created: `git tag -a v1.2.0 -m "Release 1.2.0 - QA fixes"`

### Environment Configuration
- [ ] `.env` files configured for staging and production
- [ ] Database connection strings verified
- [ ] Firebase credentials are valid
- [ ] API keys and secrets are stored in secure manager (not git)

---

## Staging Environment Setup

### 1. **Infrastructure Preparation**

```bash
# Clone the repository
git clone https://github.com/nathaliamachado9013-sys/KitchenCoast_V1.git
cd KitchenCoast_V1

# Install dependencies
pnpm install

# Configure staging environment
cp .env.example .env.staging
# Edit .env.staging with staging credentials
```

### 2. **Database Setup (Firebase Firestore)**

```bash
# Initialize Firebase (if first time)
firebase init

# Deploy to staging Firestore rules
firebase deploy --project=kitchencost-staging --only firestore:rules

# Backup production data (before any changes)
firebase firestore:export gs://kitchencost-backup/pre-deployment-backup --project=kitchencost-prod
```

### 3. **Run Application in Staging**

```bash
# Backend API
pnpm --filter @workspace/api-server run dev
# Should start on http://localhost:8080

# Frontend
pnpm --filter @workspace/kitchencost run dev
# Should start on http://localhost:5173
```

### 4. **Test All Features in Staging**

```bash
# Run full test suite
pnpm run test:coverage

# Test specific QA fixes
pnpm run test src/lib/firestore.test.js

# Performance test (load testing)
# Use Apache Bench or k6
ab -n 1000 -c 10 http://localhost:8080/api/recipes
```

---

## Production Deployment

### 1. **Pre-Deployment Tasks**

```bash
# Verify current version
git describe --tags

# Create deployment branch
git checkout -b deploy/v1.2.0

# Tag for deployment
git tag -a v1.2.0-prod -m "Deploying to production"
git push origin v1.2.0-prod
```

### 2. **Database Migration (if applicable)**

```bash
# Create backup of production data
firebase firestore:export gs://kitchencost-backup/production-backup-$(date +%s) \
  --project=kitchencost-prod

# Run any required migrations/updates
# Example: Update Firestore security rules
firebase deploy --project=kitchencost-prod --only firestore:rules

# Verify migrations succeeded
firebase firestore:describe-index --project=kitchencost-prod
```

### 3. **Frontend Deployment (Firebase Hosting)**

```bash
# Build optimized production bundle
pnpm --filter @workspace/kitchencost run build

# Deploy to Firebase Hosting
firebase deploy --project=kitchencost-prod --only hosting

# Verify deployment
curl -I https://kitchencost-prod.web.app
```

### 4. **Backend Deployment (Express API)**

#### Option A: Deploy to Cloud Run (GCP)

```bash
# Build Docker image
docker build -f artifacts/api-server/Dockerfile -t kitchencost-api:v1.2.0 .

# Push to GCP Artifact Registry
docker tag kitchencost-api:v1.2.0 \
  gcr.io/kitchencost-prod/api:v1.2.0

docker push gcr.io/kitchencost-prod/api:v1.2.0

# Deploy to Cloud Run
gcloud run deploy kitchencost-api \
  --image gcr.io/kitchencost-prod/api:v1.2.0 \
  --project kitchencost-prod \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --env-vars-file .env.prod

# Verify deployment
curl https://kitchencost-api-xxxxx.run.app/health
```

#### Option B: Deploy to Traditional Server (Ubuntu/Linux)

```bash
# SSH into production server
ssh ubuntu@prod-server.example.com

# Pull latest code
cd /opt/kitchencost
git fetch origin
git checkout v1.2.0-prod

# Install dependencies
pnpm install --prod

# Build if needed
pnpm run build

# Restart service
sudo systemctl restart kitchencost-api

# Verify service
sudo systemctl status kitchencost-api
curl http://localhost:8080/health
```

### 5. **DNS & CDN Configuration**

```bash
# Update CDN cache headers (if using CloudFlare)
# Example: Purge cache for specific paths
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -d '{"files":["https://kitchencost.com/*"]}'

# Verify DNS resolution
nslookup kitchencost.com
dig kitchencost.com

# Test SSL/TLS
openssl s_client -connect kitchencost.com:443
```

---

## Post-Deployment Verification

### 1. **Smoke Tests (Immediate)**

```bash
# Check API health
curl https://api.kitchencost.com/health
# Expected: {"status":"ok","version":"1.2.0"}

# Check Frontend loads
curl https://kitchencost.com
# Should return HTML (not error)

# Test critical endpoints
curl -X POST https://api.kitchencost.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### 2. **Functional Verification (Business Logic)**

#### Test QA Fix #1: Production Operational Costs
```bash
# Create a production record and verify op costs are included
POST /api/productions
{
  "restaurantId": "test-org",
  "recipeId": "recipe-1",
  "quantity": 2,
  "operationalCostPerDish": 15
}
# Response should include operationalCostPerDish in totalCost calculation
```

#### Test QA Fix #2: Recipe Auto-Recalculation
```bash
# Update ingredient price and verify recipes update
POST /api/ingredients/{id}/price
{
  "newPrice": 15.50
}
# Verify: All recipes using this ingredient now have updated costPerPortion
```

#### Test QA Fix #3: Decimal Rounding
```bash
# Verify all costs are rounded to 2 decimal places
GET /api/ingredients
# Response: costPerUnit should be XX.YY format only
```

#### Test QA Fix #9: Real-time Dashboard
```bash
# Create sale and verify dashboard updates in real-time
# Open WebSocket connection and monitor updates
# Expected: Dashboard reflects new sale within <1 second
```

### 3. **Performance Monitoring**

```bash
# Monitor API response times
watch -n 5 'curl -w "Time: %{time_total}s\n" https://api.kitchencost.com/health'

# Check database query performance
# In Firebase Console: Performance tab

# Monitor error rates
# In your logging system (Sentry, LogRocket, Stackdriver):
# Should have 0% error rate or <0.1% after deployment
```

### 4. **User Acceptance Testing**

- [ ] Manager logs in and accesses dashboard
- [ ] Create inventory entry with new price
- [ ] Verify recipe costs update automatically
- [ ] Create production batch and verify operational costs included
- [ ] Record sale and verify profit calculation
- [ ] Check low stock alerts appear in real-time
- [ ] View historical price changes in audit trail

---

## Rollback Procedures

### Scenario 1: **Immediate Rollback (Critical Bug Found)**

#### Frontend Rollback
```bash
# Rollback Firebase Hosting to previous version
firebase hosting:channel:deploy previous --project=kitchencost-prod

# Or: Redeploy previous version
git checkout v1.1.0
pnpm run build
firebase deploy --project=kitchencost-prod --only hosting
```

#### Backend Rollback
```bash
# Cloud Run: Deploy previous version
gcloud run deploy kitchencost-api \
  --image gcr.io/kitchencost-prod/api:v1.1.0 \
  --project kitchencost-prod

# Traditional Server:
ssh ubuntu@prod-server
git checkout v1.1.0
pnpm install
sudo systemctl restart kitchencost-api
```

#### Database Rollback
```bash
# Restore from backup (if data corrupted)
firebase firestore:import gs://kitchencost-backup/production-backup-{timestamp} \
  --project=kitchencost-prod

# Verify restore completed
firebase firestore:describe-collection users --project=kitchencost-prod
```

### Scenario 2: **Gradual Rollback (Staged Rollout Failed)**

```bash
# If using feature flags (recommended):
# Disable new feature via feature flag dashboard
# Keep old code path active

# Reduces blast radius:
# Only users with flag enabled get new code
# 95% of users on stable version
```

### Scenario 3: **Data Inconsistency Detected**

```bash
# 1. Stop accepting writes to affected collection
# Update Firestore security rules:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /restaurants/{restaurantId}/recipes/{recipeId} {
      allow read: if true;
      allow write: if false;  // Temporarily disabled
    }
  }
}
firebase deploy --project=kitchencost-prod --only firestore:rules

# 2. Run data repair/reconciliation script
node scripts/repair-recipe-costs.js --project kitchencost-prod

# 3. Re-enable writes
firebase deploy --project=kitchencost-prod --only firestore:rules

# 4. Verify data consistency
npm run test:data-integrity
```

---

## Monitoring & Alerts

### 1. **Application Performance Monitoring (APM)**

#### Setup with Firebase Performance Monitoring
```javascript
// In your app code
import { trace } from 'firebase/performance';

// Measure custom trace
const trace1 = trace(perf, 'registerProduction');
trace1.start();
// ... your code ...
trace1.stop();

// Automatic RUM collection enabled in Firebase Console
```

#### Setup with Sentry (Error Tracking)
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 0.1,
  release: "v1.2.0"
});
```

### 2. **Key Metrics to Monitor**

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (p95) | <500ms | >1000ms |
| Error Rate | <0.1% | >0.5% |
| Database Query Time | <100ms | >200ms |
| Firestore Read Ops/sec | <1000 | >2000 |
| Firestore Write Ops/sec | <500 | >1000 |
| Frontend Page Load | <2s | >4s |
| Real-time Update Latency | <1s | >2s |

### 3. **Alert Setup (via PagerDuty/Slack)**

```bash
# Example: Alert if error rate exceeds 1%
POST https://monitoring.service.com/alerts
{
  "name": "KitchenCoast High Error Rate",
  "metric": "error_rate",
  "threshold": 0.01,
  "comparison": "greater_than",
  "channels": ["slack:#alerts", "pagerduty:on-call"],
  "severity": "critical"
}
```

### 4. **Daily Health Check Script**

```bash
#!/bin/bash
# daily-health-check.sh

API_URL="https://api.kitchencost.com"
FRONTEND_URL="https://kitchencost.com"

# Check API health
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
[ "$API_STATUS" != "200" ] && echo "⚠️ API health check failed: $API_STATUS" || echo "✅ API healthy"

# Check Frontend
FE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL)
[ "$FE_STATUS" != "200" ] && echo "⚠️ Frontend check failed: $FE_STATUS" || echo "✅ Frontend healthy"

# Check database connectivity
DB_HEALTH=$(curl -s $API_URL/api/health/database | jq -r .status)
[ "$DB_HEALTH" != "connected" ] && echo "⚠️ Database check failed" || echo "✅ Database healthy"

# Report summary
echo "Daily health check completed at $(date)"
```

### 5. **Log Aggregation & Analysis**

```bash
# Search logs for specific issue
firebase functions:log --project=kitchencost-prod | grep -i "error"

# Export logs for analysis
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=kitchencost-api" \
  --limit 1000 \
  --project kitchencost-prod \
  --format json > logs.json

# Analyze error patterns
jq '.[] | select(.severity=="ERROR") | .textPayload' logs.json | \
  sort | uniq -c | sort -rn
```

---

## Deployment Timeline Example

### Version 1.2.0 Release Cycle

**Friday 2:00 PM** - Code Review Complete
- All PRs merged to main
- Version bumped to 1.2.0

**Friday 3:00 PM** - Deploy to Staging
- Staging environment updated
- Smoke tests pass

**Monday 9:00 AM** - QA Sign-Off
- All QA tests passed in staging
- Release notes prepared

**Monday 2:00 PM** - Deploy to Production
- Database backup created
- Frontend deployed
- Backend deployed
- Smoke tests verify deployment

**Monday 2:30 PM** - Monitoring
- Error rate stable (<0.1%)
- Response times normal
- Real-time features working

**Tuesday 9:00 AM** - Final Verification
- 24-hour stability confirmed
- Production metrics healthy
- Release marked as stable

---

## Disaster Recovery

### **Recovery Time Objective (RTO)**: 30 minutes
### **Recovery Point Objective (RPO)**: 5 minutes

#### Automated Backup Strategy
```bash
# Daily automated backups to Cloud Storage
gsutil -m cp -r gs://kitchencost-backup/daily-* gs://kitchencost-backup/archive/

# Retain last 7 days of backups
gsutil -m rm gs://kitchencost-backup/daily-* -rf
```

#### Disaster Recovery Test (Monthly)
```bash
# 1st Sunday of each month: Full RTO test
# 1. Simulate data loss by restoring from backup
# 2. Verify all features work post-restore
# 3. Document any issues found
# 4. Update runbook based on findings
```

---

## Contact & Escalation

| Role | Contact | On-Call |
|------|---------|---------|
| DevOps Lead | devops@kitchencost.com | Always |
| Database Admin | dba@kitchencost.com | On-Call Schedule |
| Security Team | security@kitchencost.com | Critical Only |
| Support Lead | support@kitchencost.com | Business Hours |

**Escalation Path:**
1. Alert triggered → On-call engineer notified
2. No response in 5 min → Escalate to team lead
3. No response in 15 min → Escalate to manager
4. Critical issue → Activate war room

---

## Document Control

- **Version**: 1.0
- **Last Updated**: 2024-06-17
- **Next Review**: 2024-12-17
- **Owner**: DevOps Team

