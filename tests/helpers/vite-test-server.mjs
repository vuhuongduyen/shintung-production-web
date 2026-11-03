import {createServer, mergeConfig} from 'vite';
import {fileURLToPath} from 'node:url';

export function createTestServer(config = {}) {
  return createServer(mergeConfig({
    appType: 'custom', configFile: false,
    resolve: {alias: {'@': fileURLToPath(new URL('../../', import.meta.url))}},
    optimizeDeps: {noDiscovery: true, include: []},
    server: {middlewareMode: true, hmr: false},
  }, config));
}
