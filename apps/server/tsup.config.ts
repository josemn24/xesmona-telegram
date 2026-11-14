import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  clean: true,
  sourcemap: true,
  // Los paquetes internos se consumen como fuente TS: hay que empaquetarlos.
  noExternal: [/^@xesmona\//],
});
