import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { handler as nhlHandler } from './netlify/functions/nhl.js'
import { handler as ahlHandler } from './netlify/functions/ahl.js'

// Serve the Netlify proxy functions during `npm run dev` too, so the app
// works locally without needing `netlify dev`.
const proxyDev = {
  name: 'league-proxy-dev',
  configureServer(server) {
    [['/.netlify/functions/nhl', nhlHandler], ['/.netlify/functions/ahl', ahlHandler]].forEach(([route, handler]) => {
      server.middlewares.use(route, async (req, res) => {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const out = await handler({ queryStringParameters: Object.fromEntries(params) });
        res.statusCode = out.statusCode;
        Object.entries(out.headers ?? {}).forEach(([k, v]) => res.setHeader(k, v));
        res.end(out.body);
      });
    });
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), proxyDev],
})
