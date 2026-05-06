import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  external: ['vscode'],
  minify: false,
  splitting: false
});
