#!/bin/bash
# Vercel CLI Deployment Script
# Use this if GitHub integration has permission issues

echo "🚀 Vercel CLI Deployment"
echo "========================"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
    echo ""
fi

# Navigate to project
cd /Users/ryan/Documents/workout-site

echo "🔐 Step 1: Login to Vercel"
echo "You'll be redirected to your browser to authenticate"
echo ""
vercel login

echo ""
echo "📤 Step 2: Deploy to Vercel"
echo "Follow the prompts..."
echo ""

# Deploy project
vercel

echo ""
echo "🎯 Step 3: Set Environment Variables"
echo "Run these commands one by one:"
echo ""
echo 'vercel env add NEXT_PUBLIC_FIREBASE_API_KEY'
echo 'vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
echo 'vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID'
echo 'vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
echo 'vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
echo 'vercel env add NEXT_PUBLIC_FIREBASE_APP_ID'
echo 'vercel env add NEXT_PUBLIC_APP_URL'
echo ""

read -p "Press Enter after adding all environment variables..."

echo ""
echo "🚀 Step 4: Deploy to Production"
vercel --prod

echo ""
echo "✅ Deployment Complete!"
echo "Your app URL will be displayed above"
