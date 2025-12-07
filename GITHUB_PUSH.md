# 📤 Pushing to GitHub

Your workout-site repository is already created on GitHub. Here's how to connect and push your local code.

## Method 1: HTTPS with Personal Access Token (Recommended)

### Step 1: Generate Personal Access Token

1. Go to GitHub.com and sign in
2. Click your profile photo → **Settings**
3. Scroll down to **Developer settings** (left sidebar)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Give it a note: "workout-site deployment"
7. Select scopes: Check **repo** (Full control of private repositories)
8. Click **Generate token** at bottom
9. **⚠️ IMPORTANT**: Copy the token immediately (shown only once!)
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxx`

### Step 2: Connect to GitHub

```bash
# Navigate to your project
cd /Users/ryan/Documents/workout-site

# Check if remote exists
git remote -v

# If "origin" doesn't exist, add it:
git remote add origin https://github.com/YOUR_USERNAME/workout-site.git

# If "origin" exists but points to wrong URL:
git remote set-url origin https://github.com/YOUR_USERNAME/workout-site.git

# Replace YOUR_USERNAME with your actual GitHub username!
```

### Step 3: Push to GitHub

```bash
# Push all commits
git push -u origin main

# When prompted for credentials:
# Username: YOUR_GITHUB_USERNAME
# Password: Paste your personal access token (ghp_xxx...)
```

✅ Your code is now on GitHub!

## Method 2: SSH (Alternative)

If you prefer SSH keys:

### Generate SSH Key (if you don't have one)

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter to save in default location
# Press Enter twice to skip passphrase (or add one for security)

# Copy SSH key to clipboard (macOS)
cat ~/.ssh/id_ed25519.pub | pbcopy

# The key is now in your clipboard
```

### Add SSH Key to GitHub

1. Go to GitHub.com → Settings → SSH and GPG keys
2. Click **New SSH key**
3. Title: "MacBook Pro" (or your device name)
4. Paste the key from your clipboard
5. Click **Add SSH key**

### Connect and Push

```bash
# Set remote to SSH URL
git remote set-url origin git@github.com:YOUR_USERNAME/workout-site.git

# Push
git push -u origin main
```

## Verify Push Succeeded

1. Go to https://github.com/YOUR_USERNAME/workout-site
2. You should see all your files
3. Check that commits are there
4. README.md should be displayed on the main page

## Common Issues

### Issue: "fatal: remote origin already exists"
```bash
# Solution: Update the URL instead
git remote set-url origin https://github.com/YOUR_USERNAME/workout-site.git
```

### Issue: "Authentication failed"
**Using HTTPS**: Make sure you're using the Personal Access Token as password, not your GitHub password

**Using SSH**: Ensure SSH key is added to GitHub account

### Issue: "Permission denied (publickey)"
**Solution**: You're using SSH but key isn't set up. Either:
- Follow Method 2 to set up SSH key
- Or use Method 1 (HTTPS) instead

### Issue: "Repository not found"
**Solution**: Check the repository URL matches exactly:
```bash
git remote -v
# Should show: https://github.com/YOUR_ACTUAL_USERNAME/workout-site.git
```

## Next Steps After Pushing

Once your code is on GitHub:

1. **Deploy to Vercel**:
   - Go to vercel.com
   - Import your GitHub repository
   - Follow [SETUP.md](./SETUP.md) Step 5

2. **Enable Auto-Deployment**:
   - Vercel automatically deploys on every push to main
   - Make a change, commit, and push to test:
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push
   ```

3. **Set up branch protection** (Optional):
   - GitHub → Settings → Branches
   - Protect main branch
   - Require pull requests before merging

## Workflow for Future Changes

```bash
# Make changes to your code
# ...

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add new feature: workout templates"

# Push to GitHub
git push

# Vercel will automatically deploy!
```

---

**Quick Reference**:
- Generate token: GitHub → Settings → Developer settings → Personal access tokens
- Repository URL: https://github.com/YOUR_USERNAME/workout-site
- Push command: `git push -u origin main`
