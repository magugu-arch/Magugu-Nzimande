import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * In development the API runs inside the Vite server, through the same
 * handler Vercel uses in production (server/node.ts), so `npm run dev` is the
 * whole site — booking, mock payment and console email included.
 */
function devApi(): Plugin {
  return {
    name: 'grateful-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const mod = (await server.ssrLoadModule('/server/node.ts')) as typeof import('./server/node');
          await mod.handleNode(req, res);
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only variables for the dev API. Only VITE_* ever reach the browser bundle.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''), { ...process.env });
  return {
    plugins: [react(), tailwindcss(), devApi()],
    build: { sourcemap: true },
  };
});
