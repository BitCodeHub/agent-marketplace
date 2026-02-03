#!/bin/bash
# Setup Render Deployment Script
# This script helps configure automatic deployment to Render.com

echo "🚀 Setting up Render Deployment"
echo "================================"
echo ""

# Check if user is logged into Render CLI
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found. Installing..."
    npm install -g @render/cli
fi

echo "✅ Render CLI installed"
echo ""

# Instructions for manual setup
echo "📋 MANUAL SETUP REQUIRED:"
echo ""
echo "Since automated API deployment is restricted, follow these steps:"
echo ""
echo "1️⃣  Go to Render Dashboard:"
echo "   https://dashboard.render.com"
echo ""
echo "2️⃣  Create Blueprint Deployment:"
echo "   - Click 'New +' → 'Blueprint'"
echo "   - Connect GitHub: BitCodeHub/agent-marketplace"
echo "   - Select branch: master"
echo "   - Render will auto-detect render.yaml"
echo ""
echo "3️⃣  Environment Variables (add in Render dashboard):"
echo "   DATABASE_URL: (PostgreSQL URL - auto-generated)"
echo "   JWT_SECRET: $(openssl rand -hex 32)"
echo "   NODE_ENV: production"
echo ""
echo "4️⃣  Deploy:"
echo "   - Click 'Apply'"
echo "   - Wait 2-3 minutes for deployment"
echo ""
echo "✅ Your site will be live at:"
echo "   https://agent-marketplace-api.onrender.com"
echo ""
echo "📊 After deployment, seed the database:"
echo "   npx prisma db seed"
echo ""
