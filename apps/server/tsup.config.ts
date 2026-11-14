import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  sourcemap: true,
  // Internal packages are consumed as TS source, so they must be bundled.
  noExternal: [/^@xesmona\//],
});
