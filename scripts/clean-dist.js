/**
 * Recursive delete dist/ — avoids Windows ENOTEMPTY when Nest's deleteOutDir uses rmdir.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}
