// Compatibility entry point.
// The server was rewritten in TypeScript: the source lives in backend/src and is
// compiled to backend/build by `npm run build`. Hosts created before that rewrite
// may still be configured to start `node backend/server.js`, so this forwards to
// the compiled server instead of failing with "module not found".
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const compiled = path.join(here, 'build', 'index.js');

if (!existsSync(compiled)) {
  console.error(
    '[PhysioAlign] backend/build is missing. The build step has to run first:\n' +
      '  build command: npm ci --include=dev && npm run build\n' +
      '  start command: npm start'
  );
  process.exit(1);
}

await import(compiled);
