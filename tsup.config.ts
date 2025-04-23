import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  external: ['react', 'react-dom', 'next'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.css': 'copy',
    };
  },
  async onSuccess() {
    // Create styles directory if it doesn't exist
    if (!fs.existsSync('dist/styles')) {
      fs.mkdirSync('dist/styles', { recursive: true });
    }

    // Copy CSS files to styles directory
    const cssFiles = fs.readdirSync('dist').filter(file => file.endsWith('.css'));
    for (const file of cssFiles) {
      fs.copyFileSync(
        path.join('dist', file),
        path.join('dist/styles', file)
      );
    }
  },
}); 