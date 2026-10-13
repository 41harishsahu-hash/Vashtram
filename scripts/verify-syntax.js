const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
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

console.log('Checking server files syntax...');
checkDir(path.resolve(__dirname, '../server'));
console.log('Checking scripts syntax...');
checkDir(path.resolve(__dirname, '../scripts'));
console.log('All JavaScript files syntax valid!');
