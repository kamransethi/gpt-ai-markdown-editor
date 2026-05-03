#!/usr/bin/env node

/**
 * Build Script for Webview Bundle
 *
 * Uses esbuild programmatically to build the webview with custom plugins.
 * This allows us to selectively remove console.log/debug/info while keeping
 * console.error and console.warn in production builds.
 *
 * Usage:
 *   node scripts/build-webview.js          # Development build
 *   node scripts/build-webview.js --prod   # Production build (minified, drops console.log)
 *   node scripts/build-webview.js --watch  # Watch mode (development)
 */

const esbuild = require('esbuild');
const fs = require('fs');

const args = process.argv.slice(2);
const isProduction = args.includes('--prod') || process.env.NODE_ENV === 'production';
const isWatch = args.includes('--watch');
const noSourcemap = args.includes('--no-sourcemap');

/**
 * Plugin to provide shims for optional TipTap dependencies
 * These are not used in the editor, but @tiptap/extension-drag-handle
 * tries to import them. We provide empty shims to prevent runtime errors.
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
        export const ySyncPluginKey = { key: 'ySync' };
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
    { in: 'src/webview/editor.ts', out: 'webview' },
    { in: 'src/webview/settings/settingsPanel.ts', out: 'settings' },
    { in: 'src/webview/chat/chatWebview.ts', out: 'chat' }
  ],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  sourcemap: !noSourcemap && !isProduction, // Disable for marketplace builds
  minify: isProduction,
  treeShaking: true,
  loader: {
    '.css': 'css',
    '.ttf': 'file',
  },
  // TipTap optional dependencies (not used, but drag-handle imports them)
  external: [
    '@tiptap/extension-collaboration',
    '@tiptap/y-tiptap',
    '@tiptap/extension-node-range',
  ],
  // Use esbuild's built-in 'pure' option to remove console.log/debug/info
  // This properly handles parsing and removes the calls during minification
  // while keeping console.error and console.warn
  pure: isProduction ? ['console.log', 'console.debug', 'console.info'] : [],
  plugins: [shimOptionalDependenciesPlugin],
};

async function build() {
  if (isWatch) {
    // Watch mode - development build
    const context = await esbuild.context({
      ...buildOptions,
      minify: false, // Never minify in watch mode
      plugins: [shimOptionalDependenciesPlugin],
    });

    await context.watch();
    console.log('👀 Watching for changes... (Press Ctrl+C to stop)');
  } else {
    // One-time build
    try {
      await esbuild.build(buildOptions);
      if (isProduction || noSourcemap) {
        // Ensure release builds don't leave stale sourcemaps in dist/
        const distFiles = fs.readdirSync('dist');
        for (const file of distFiles) {
          if (file.endsWith('.map')) {
            try {
              fs.unlinkSync(`dist/${file}`);
            } catch {
              // ignore
            }
          }
        }
      }
      console.log(`✅ Webview build complete${isProduction ? ' (production)' : ' (development)'}`);
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  }
}

build().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
