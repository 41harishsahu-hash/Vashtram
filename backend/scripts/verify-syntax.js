const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'release') {
        checkDir(full);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs'))) {
      try {
        execSync(`node --check "${full}"`);
      } catch (err) {
        console.error(`Syntax error in: ${full}`);
        process.exit(1);
      }
    }
  }
}

const backendDir = path.resolve(__dirname, '..');
console.log('Checking backend files syntax...');
checkDir(backendDir);
console.log('Checking frontend scripts syntax...');
const frontendScriptsDir = path.resolve(__dirname, '../../frontend/scripts');
if (fs.existsSync(frontendScriptsDir)) {
  checkDir(frontendScriptsDir);
}
console.log('All JavaScript files syntax valid!');
