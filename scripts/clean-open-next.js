const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(process.cwd(), '.open-next');

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
