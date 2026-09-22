import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
await build({ entryPoints: ['server/sites/worker.ts'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'node', target: 'es2022', external: ['node:*'], alias: { vite: resolve('server/sites/viteShim.ts') }, plugins: [{ name: 'worker-image-sanitizer', setup(build) { build.onResolve({ filter: /^\.\/sanitizeFrame\.ts$/ }, () => ({ path: resolve('server/sites/sanitizeFrame.ts') })); } }], sourcemap: false });
await mkdir('dist/.openai', { recursive: true });
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
