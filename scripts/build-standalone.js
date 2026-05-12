#!/usr/bin/env node

/**
 * Build Script for Standalone Dev Server
 *
 * Bundles src/webview/standalone.ts (which imports editor.ts + WebMockAdapter)
 * and serves it via esbuild's built-in HTTP server on localhost:3000.
 *
 * Usage:
 *   node scripts/build-standalone.js          # Build + serve (dev mode)
 *   node scripts/build-standalone.js --build  # One-time build only, no server
 *   node scripts/build-standalone.js --watch  # Watch mode without server
 */

const esbuild = require('esbuild');
const path = require('path');

const args = process.argv.slice(2);
const isServe = !args.includes('--build') && !args.includes('--watch');
const isWatch = args.includes('--watch');
const PORT = 3000;

/**
 * Shim optional TipTap peer dependencies (same as build-webview.js).
 */
const shimOptionalDependenciesPlugin = {
  name: 'shim-optional-deps',
  setup(build) {
    const shims = {
      '@tiptap/extension-collaboration': `
        export const isChangeOrigin = () => false;
      `,
      '@tiptap/y-tiptap': `
        export const absolutePositionToRelativePosition = () => null;
        export const relativePositionToAbsolutePosition = () => null;
        export const ySyncPluginKey = { key: 'ySync', getState: () => null };
      `,
      '@tiptap/extension-node-range': `
        export const getSelectionRanges = () => [];
        export class NodeRangeSelection {}
      `,
    };

    for (const [module, content] of Object.entries(shims)) {
      build.onResolve({ filter: new RegExp(`^${module.replace(/\//g, '\\/')}$`) }, () => ({
        path: module,
        namespace: 'optional-dep',
      }));
      build.onLoad({ filter: /.*/, namespace: 'optional-dep' }, (args) => ({
        contents: shims[args.path],
        loader: 'js',
      }));
    }
  },
};

const buildOptions = {
  entryPoints: [
    { in: path.resolve(__dirname, '../src/webview/standalone.ts'), out: 'standalone' },
  ],
  bundle: true,
  outdir: path.resolve(__dirname, '../public/dist'),
  format: 'iife',
  sourcemap: true,
  minify: false,
  treeShaking: true,
  loader: {
    '.css': 'css',
    '.ttf': 'file',
  },
  external: [
    '@tiptap/extension-collaboration',
    '@tiptap/y-tiptap',
    '@tiptap/extension-node-range',
  ],
  plugins: [shimOptionalDependenciesPlugin],
};

async function run() {
  if (isServe) {
    const context = await esbuild.context({
      ...buildOptions,
      plugins: [shimOptionalDependenciesPlugin],
    });

    const { host, port } = await context.serve({
      servedir: path.resolve(__dirname, '..'),
      port: PORT,
    });

    await context.watch();

    console.log(`\n🚀 Standalone editor running at http://${host}:${port}`);
    console.log('   Watching for changes... (Press Ctrl+C to stop)\n');
  } else if (isWatch) {
    const context = await esbuild.context({
      ...buildOptions,
      plugins: [shimOptionalDependenciesPlugin],
    });
    await context.watch();
    console.log('👀 Watching for changes... (Press Ctrl+C to stop)');
  } else {
    try {
      await esbuild.build(buildOptions);
      console.log('✅ Standalone build complete');
    } catch (error) {
      console.error('❌ Standalone build failed:', error);
      process.exit(1);
    }
  }
}

run();
