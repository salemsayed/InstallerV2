# Version Management Scripts

This directory contains scripts to help manage the application version.

## Automatic Version Increment

When creating a Replit checkpoint, you can use the version increment script to automatically update the application version number.

### How to use with checkpoints

Before creating a checkpoint in Replit:

1. Run the version increment script:
   ```
   node scripts/increment-version.js [type]
   ```
   
   Where `[type]` is one of:
   - `major` - For significant changes (e.g., v1.2.3 → v2.0.0)
   - `minor` - For new features (e.g., v1.2.3 → v1.3.0) [DEFAULT]
   - `patch` - For bug fixes (e.g., v1.2.3 → v1.2.4)

2. The script will:
   - Update the version number in `shared/version.ts`
   - Add a history entry with the date
   - Log the change to the console

3. After running the script, create your checkpoint in Replit

### Examples

```bash
# Increment minor version (default)
node scripts/increment-version.js

# Increment patch version
node scripts/increment-version.js patch

# Increment major version
node scripts/increment-version.js major
```

## Best practices

- **Minor version**: Increment for new features or significant enhancements
- **Patch version**: Increment for bug fixes or small improvements
- **Major version**: Increment for breaking changes or major releases

This automated system ensures that every checkpoint has a unique version number, making it easier to track changes and debug issues.