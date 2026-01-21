import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Plugin to handle virtual module requests gracefully
function handleVirtualModules(): Plugin {
  return {
    name: 'handle-virtual-modules',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Ignore virtual module requests that don't exist
        if (
          req.url?.includes('virtual:vue-devtools') ||
          req.url?.includes('virtual:vue-inspector') ||
          req.url?.includes('vite-plugin-pwa') ||
          req.url?.endsWith('manifest.webmanifest')
        ) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      babel: {
        parserOpts: {
          plugins: ['jsx'],
        },
      },
    }),
    handleVirtualModules(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // Allow access from network (e.g., http://192.168.1.89:3000)
    port: 3000,
    hmr: {
      overlay: true,
    },
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/agent': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress warnings for virtual modules
        if (
          warning.message?.includes('vue-devtools') ||
          warning.message?.includes('vue-inspector') ||
          warning.message?.includes('vite-plugin-pwa')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
});
