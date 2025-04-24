import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'WizlitEditor',
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'next'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          next: 'Next',
        },
      },
    },
  },
}); 