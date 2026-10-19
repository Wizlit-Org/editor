import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';

const pureEsmPlugin = {
  name: 'pure-esm-plugin',
  setup(build: any) {
    build.onResolve({ filter: /^use-sync-external-store/ }, (args: any) => ({
      path: args.path,
      namespace: 'pure-esm-shim',
    }));

    build.onLoad({ filter: /.*/, namespace: 'pure-esm-shim' }, () => ({
      contents: `
        import * as React from 'react';
        export const useSyncExternalStore = React.useSyncExternalStore;
        function is(x, y) {
          return (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);
        }
        const objectIs = typeof Object.is === 'function' ? Object.is : is;
        export function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
          const equalityFn = isEqual === undefined ? objectIs : isEqual;
          const memoizedSnapshot = React.useRef(null);
          return React.useSyncExternalStore(
            subscribe,
            () => {
              const nextSnapshot = getSnapshot();
              if (memoizedSnapshot.current !== null) {
                const { snapshot, selection } = memoizedSnapshot.current;
                if (objectIs(snapshot, nextSnapshot)) {
                  return selection;
                }
                const nextSelection = selector(nextSnapshot);
                if (equalityFn(selection, nextSelection)) {
                  return selection;
                }
                memoizedSnapshot.current = { snapshot: nextSnapshot, selection: nextSelection };
                return nextSelection;
              }
              const nextSelection = selector(nextSnapshot);
              memoizedSnapshot.current = { snapshot: nextSnapshot, selection: nextSelection };
              return nextSelection;
            },
            getServerSnapshot ? () => selector(getServerSnapshot()) : undefined
          );
        }
      `,
      loader: 'js',
    }));

    build.onResolve({ filter: /^@emotion\/is-prop-valid$/ }, (args: any) => ({
      path: args.path,
      namespace: 'emotion-prop-valid-stub',
    }));

    build.onLoad({ filter: /.*/, namespace: 'emotion-prop-valid-stub' }, () => ({
      contents: `
        export default function isPropValid(prop) {
          return !prop.startsWith('on') && prop !== 'children' && prop !== 'dangerouslySetInnerHTML';
        }
      `,
      loader: 'js',
    }));

    build.onResolve({ filter: /^cordova\/modulemapper$/ }, (args: any) => ({
      path: args.path,
      namespace: 'cordova-stub',
    }));

    build.onLoad({ filter: /.*/, namespace: 'cordova-stub' }, () => ({
      contents: `export default {};`,
      loader: 'js',
    }));
  },
};

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
  esbuildPlugins: [pureEsmPlugin],
  banner: {
    js: '"use client";',
  },
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