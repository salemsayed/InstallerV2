# Automatic Version Incrementing for Deployments

To automatically increment the version number when deploying in Replit, follow these steps:

## Pre-Deployment Steps

1. **Before clicking "Deploy"** in Replit, run:
   ```
   node scripts/increment-version-deploy.js
   ```

2. This script will:
   - Automatically increment the minor version (e.g., v1.1.1 → v1.2.0)
   - Add a deployment entry to the version history
   - Update the version throughout the application

3. After running the script, you can proceed with deployment by clicking the "Deploy" button in Replit

## Why This Process

This approach ensures that:
- Each deployment has a unique, incremented version number
- The version history is maintained with deployment dates
- Users can immediately see they're using the latest deployed version

## Example Workflow

```
# 1. Make your code changes
# 2. Before deploying, run:
node scripts/increment-version-deploy.js

# 3. You'll see output like:
Current version: v1.1.1
New deployment version: v1.2.0
Version automatically incremented for deployment!

# 4. Now click "Deploy" in Replit
```

This semi-automated approach ensures version control while working within Replit's deployment restrictions.