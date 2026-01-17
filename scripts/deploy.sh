#!/bin/bash
# Workout Tracker - Complete Deployment Script
# Run this script to deploy your application to GitHub and Vercel

set -e  # Exit on any error

echo "🚀 Workout Tracker Deployment Script"
echo "====================================="
echo ""

# Step 1: Configure Git (if needed)
echo "📝 Step 1: Configuring Git..."
read -p "Enter your GitHub username: " github_username
read -p "Enter your email: " github_email

git config user.name "$github_username"
git config user.email "$github_email"

echo "✅ Git configured!"
echo ""

# Step 2: Create GitHub Repository
echo "📦 Step 2: GitHub Repository Setup"
echo "-----------------------------------"
echo "Please create a GitHub repository with these settings:"
echo "  - Repository name: workout-tracker"
echo "  - Description: Workout tracking application for coaches and students"
echo "  - Visibility: Private (recommended)"
echo "  - DO NOT initialize with README, .gitignore, or license"
echo ""
read -p "Press Enter after you've created the repository on GitHub..."
echo ""

# Step 3: Connect to GitHub
echo "🔗 Step 3: Connecting to GitHub..."
read -p "Enter your GitHub repository URL (e.g., https://github.com/username/workout-tracker.git): " repo_url

git remote add origin "$repo_url" 2>/dev/null || git remote set-url origin "$repo_url"
echo "✅ Remote configured!"
echo ""

# Step 4: Push to GitHub
echo "⬆️  Step 4: Pushing code to GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Code successfully pushed to GitHub!"
else
    echo "❌ Push failed. You may need to authenticate with GitHub."
    echo "   Try running: git push -u origin main"
    exit 1
fi
echo ""

# Step 5: Vercel Deployment
echo "🌐 Step 5: Deploying to Vercel"
echo "-------------------------------"
echo "Now let's deploy to Vercel!"
echo ""
echo "Options:"
echo "  A) Deploy via Vercel Dashboard (easier - browser-based)"
echo "  B) Deploy via Vercel CLI (terminal-based)"
echo ""
read -p "Choose option (A/B): " deploy_option

if [ "$deploy_option" = "B" ] || [ "$deploy_option" = "b" ]; then
    # CLI Deployment
    echo ""
    echo "Installing Vercel CLI..."
    npm install -g vercel
    
    echo ""
    echo "Starting Vercel deployment..."
    echo "Follow the prompts to:"
    echo "  1. Log in to Vercel"
    echo "  2. Select 'Create new project'"
    echo "  3. Use default settings"
    echo ""
    vercel
    
    echo ""
    echo "Now deploying to production..."
    vercel --prod
    
else
    # Dashboard Deployment
    echo ""
    echo "📋 Vercel Dashboard Deployment Steps:"
    echo "--------------------------------------"
    echo ""
    echo "I've opened Vercel for you. Follow these steps:"
    echo ""
    echo "1. Click 'Import Project' or 'Add New Project'"
    echo "2. Select your GitHub repository: workout-tracker"
    echo "3. Configure the project:"
    echo "   - Framework: Next.js (auto-detected)"
    echo "   - Root Directory: ./"
    echo "   - Build Command: npm run build"
    echo "   - Output Directory: .next"
    echo ""
    echo "4. ADD ENVIRONMENT VARIABLES (IMPORTANT!):"
    echo "   Click 'Environment Variables' and add these:"
    echo ""
    echo "   NEXT_PUBLIC_FIREBASE_API_KEY"
    echo "   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    echo "   NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    echo "   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    echo "   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    echo "   NEXT_PUBLIC_FIREBASE_APP_ID"
    echo "   NEXT_PUBLIC_APP_URL (will be your-app.vercel.app)"
    echo ""
    echo "5. Click 'Deploy'"
    echo ""
    read -p "Press Enter after deployment is complete..."
fi

echo ""
echo "🎉 Deployment Steps Complete!"
echo "=============================="
echo ""
echo "📋 Post-Deployment Checklist:"
echo "-----------------------------"
echo "[ ] Update Firebase authorized domains"
echo "    - Go to: https://console.firebase.google.com/"
echo "    - Authentication → Settings → Authorized Domains"
echo "    - Add your Vercel domain"
echo ""
echo "[ ] Test your application:"
echo "    - Login functionality"
echo "    - Coach registration (check for coach code)"
echo "    - Student registration with coach code"
echo "    - Calendar page"
echo "    - Workout creation"
echo ""
echo "📄 See DEPLOYMENT_GUIDE.md for detailed troubleshooting"
echo ""
echo "✨ Your app is live! Share it with your users!"
