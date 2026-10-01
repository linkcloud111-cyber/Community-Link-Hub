/**
 * LinkCloud ESM Production Entrypoint
 * Compatible with "type": "module" in package.json
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('./server.cjs');
