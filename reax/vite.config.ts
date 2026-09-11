import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        stringing: 'src/components/stringing/index.tsx',
        splus: 'src/components/splus/index.tsx',
        remix: 'src/components/remix/index.tsx',
        track: 'src/components/track/index.tsx',
        'tshirt-printing': 'src/components/tshirt-printing/index.tsx',
        gripping: 'src/components/gripping/index.tsx',
      },
      output: {
        dir: '../assets/',
        entryFileNames: 'vx-[name].js',
        // Liquid resolves stable entry names through asset_url. Their imports
        // need immutable URLs too: cached entries must keep their exact Preact
        // dependency graph even when a later build changes internal exports.
        chunkFileNames: 'vx-[name]-[hash].js',
        assetFileNames: 'vx-[name].[ext]',
      },
    },
    // Retain legacy/unversioned and older hashed chunks for cached pages.
    // Never empty the theme asset directory as part of a bundle build.
    emptyOutDir: false,
    watch: {},
  },
});
