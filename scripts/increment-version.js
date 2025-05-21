import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the version file
const versionFilePath = path.join(__dirname, '..', 'shared', 'version.ts');

/**
 * Increments version number based on type (major, minor, patch)
 * @param {string} currentVersion - Current version string (e.g., 'v1.0.1')
 * @param {string} type - Type of increment ('major', 'minor', or 'patch')
 * @returns {string} - New version string
 */
function incrementVersion(currentVersion, type = 'minor') {
  // Strip the 'v' prefix if present
  const versionString = currentVersion.startsWith('v') 
    ? currentVersion.substring(1) 
    : currentVersion;
  
  // Split version into components
  const [major, minor, patch] = versionString.split('.').map(Number);
  
  // Increment based on type
  switch (type.toLowerCase()) {
    case 'major':
      return `v${major + 1}.0.0`;
    case 'minor':
      return `v${major}.${minor + 1}.0`;
    case 'patch':
      return `v${major}.${minor}.${patch + 1}`;
    default:
      console.error('Invalid increment type. Use "major", "minor", or "patch"');
      return currentVersion;
  }
}

/**
 * Updates the version file with the new version
 */
function updateVersionFile() {
  try {
    // Read the current file
    const fileContent = fs.readFileSync(versionFilePath, 'utf8');
    
    // Extract current version
    const versionRegex = /export const APP_VERSION = ['"](.+)['"];/;
    const match = fileContent.match(versionRegex);
    
    if (!match) {
      console.error('Could not find version string in file');
      process.exit(1);
    }
    
    const currentVersion = match[1];
    console.log(`Current version: ${currentVersion}`);
    
    // Get increment type from command line argument or default to 'minor'
    const incrementType = process.argv[2] || 'minor';
    const newVersion = incrementVersion(currentVersion, incrementType);
    console.log(`New version: ${newVersion}`);
    
    // Add new version entry to version history
    const timestamp = new Date().toISOString().split('T')[0];
    const versionHistoryEntry = `// ${newVersion} - Checkpoint created on ${timestamp}`;
    
    // Update file content
    const updatedContent = fileContent
      // Update version number
      .replace(versionRegex, `export const APP_VERSION = '${newVersion}';`)
      // Add new entry to history (find the line before APP_VERSION)
      .replace(/(\/\/ v[\d.]+.+\n)(\n*export const APP_VERSION)/, `$1// ${newVersion} - Checkpoint created on ${timestamp}\n$2`);
    
    // Add a message encouraging the user to add a descriptive comment
    console.log('\nRemember to update the automatically added version history entry with a descriptive comment.');
    console.log('For example: Change "Checkpoint created on..." to something meaningful like:');
    console.log(`"${newVersion} - Added new user achievements" or "${newVersion} - Fixed QR code scanning issue"`);
    
    // Write the updated content back to the file
    fs.writeFileSync(versionFilePath, updatedContent);
    console.log('Version file updated successfully!');
    
  } catch (error) {
    console.error('Error updating version file:', error);
    process.exit(1);
  }
}

// Execute the update
updateVersionFile();