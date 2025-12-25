#!/bin/bash

# Quick test script for chat feature
# Run this to check if Firestore rules are deployed

echo "🔍 Checking Chat Feature Setup..."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not installed"
    echo "   Install: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check Firestore rules
echo "📋 Current Firestore Rules:"
echo "---"
firebase firestore:rules 2>/dev/null || echo "⚠️  Not logged in. Run: firebase login"
echo "---"
echo ""

# Instructions
echo "📝 TO FIX CHAT FEATURE:"
echo ""
echo "1. Deploy Firestore Rules:"
echo "   cd /Users/ryan/Documents/workout-site"
echo "   firebase deploy --only firestore:rules"
echo ""
echo "2. Create Index (one of these):"
echo "   Option A: Try chat feature in browser - Firebase will give you index link"
echo "   Option B: Manually create in console:"
echo "      - Collection: chatThreads"
echo "      - Field 1: userId (Ascending)"
echo "      - Field 2: updatedAt (Descending)"
echo ""
echo "3. Wait ~1-2 minutes after deploying rules"
echo ""
echo "4. Test:"
echo "   - Go to /ai-coach"
echo "   - Click '+ New Chat'"
echo "   - Try sending a message"
echo ""
