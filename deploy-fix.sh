#!/bin/bash
cd ~/Documents/workout-site

echo "📋 Checking git status..."
git status

echo ""
echo "➕ Adding changes..."
git add -A

echo ""
echo "💾 Committing..."
git commit -m "Fix: Add dynamic export to API routes for Vercel build"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Check Vercel for auto-deployment!"
