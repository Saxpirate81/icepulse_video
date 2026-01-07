# Deployment Guide: Git + Vercel

This guide walks you through pushing your code to GitHub and deploying to Vercel.

## Step 1: Initialize Git Repository (if not already done)

```bash
cd /Users/williamdoss/IcePulseVideo
git init
```

## Step 2: Stage and Commit All Files

```bash
# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Video recording app with Supabase storage and database integration"
```

## Step 3: Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository named `IcePulseVideo` (or whatever you prefer)
3. **Do NOT** initialize with README, .gitignore, or license (you already have these)
4. Copy the repository URL (e.g., `https://github.com/yourusername/IcePulseVideo.git`)

## Step 4: Connect and Push to GitHub

```bash
# Add remote repository (replace URL with your actual repo URL)
git remote add origin https://github.com/yourusername/IcePulseVideo.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 5: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from your project directory**:
   ```bash
   cd /Users/williamdoss/IcePulseVideo
   vercel
   ```

4. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (select your account)
   - Link to existing project? **No**
   - What's your project's name? (use `icepulse-video` or similar)
   - In which directory is your code located? **./**
   - Want to override the settings? **No**

5. **Add Environment Variables**:
   After deployment, go to your Vercel project dashboard → Settings → Environment Variables, and add:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
   - (Optional) `VITE_ENABLE_TESTING_TOGGLES` = `true` for development

6. **Redeploy** after adding environment variables:
   ```bash
   vercel --prod
   ```

### Option B: Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variables (same as above)
6. Click **Deploy**

## Step 6: Update Vercel Build Settings

Make sure Vercel knows this is a Vite project:

1. Go to Project Settings → General
2. Verify:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

## Step 7: Verify Deployment

1. After deployment completes, Vercel will give you a URL like `https://icepulse-video.vercel.app`
2. Visit the URL and test:
   - Login works
   - Video recording works
   - Videos upload to Supabase Storage
   - Videos appear in Event Videos viewer

## Important Notes

### Environment Variables
Make sure these are set in Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### CORS Configuration
Supabase Storage should already be configured for public access, but if you encounter CORS issues:

1. Go to Supabase Dashboard → Storage → Policies
2. Ensure your policies allow public access to the `videos` bucket

### Build Issues
If you encounter build errors:
- Check that all dependencies are in `package.json`
- Run `npm run build` locally first to test
- Check Vercel build logs for specific errors

## Future Updates

To push updates:
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

Vercel will automatically redeploy if you have automatic deployments enabled (default).
