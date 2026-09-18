import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// the pose web worker loads MediaPipe with importScripts, which needs a script served
// as javascript. the CDN serves the CommonJS bundle as application/node, so serve the
// installed copy from our own origin instead (dev server + production build)
function mediapipeWorkerBundle(): Plugin {
  const source = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/vision_bundle.cjs');
  const publicPath = 'mediapipe/vision_bundle.js';
  return {
    name: 'mediapipe-worker-bundle',
    configureServer(server) {
      server.middlewares.use(`/${publicPath}`, (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(fs.readFileSync(source));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: publicPath, source: fs.readFileSync(source) });
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipeWorkerBundle()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '^/api/': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});
