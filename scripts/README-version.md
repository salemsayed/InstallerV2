# Version Management System

This document explains how to use the version management system in this application.

## Core Features

- **Responsive Version Display**: Shows version information that adapts to screen size
- **Centralized Version Source**: All version information is stored in `shared/version.ts`
- **Automatic Version Increment**: Scripts to automate version increments for checkpoints and deployments

## How to Use for Regular Checkpoints

When creating a regular checkpoint in Replit:

```bash
# Increment minor version (new features)
node scripts/increment-version.js

# Increment patch version (bug fixes)
node scripts/increment-version.js patch

# Increment major version (breaking changes)
node scripts/increment-version.js major
```

After running the script, it will automatically:
1. Update the version number
2. Add a history entry with the current date
3. The script will remind you to add a descriptive comment to the version history

## How to Use for Deployments

Before deploying your application:

```bash
# Always increments the minor version for deployments
node scripts/increment-version-deploy.js
```

This will:
1. Increment the minor version (e.g., v1.1.1 → v1.2.0)
2. Add a deployment-specific entry to the version history
3. Update the version throughout the application

## Version Types and When to Use Them

- **Patch (v1.1.0 → v1.1.1)**: For bug fixes and minor improvements
- **Minor (v1.1.0 → v1.2.0)**: For new features without breaking changes
- **Major (v1.1.0 → v2.0.0)**: For breaking changes or significant releases

## Best Practices

1. Always run the appropriate version increment script before creating a checkpoint or deployment
2. Update the automatically generated version history comment with a meaningful description
3. For deployments, always increment at least the minor version
4. Use patch versions for small fixes between deployments

## Where Versions Appear

The version is displayed in:
1. Login page (bottom center)
2. Installer dashboard (next to logo in header)
3. Admin panel (in footer)

The display automatically adapts to different screen sizes.