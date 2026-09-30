import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { handler as nhlHandler } from './netlify/functions/nhl.js'

// Serve the Netlify NHL proxy function during `npm run dev` too, so the app
// works locally without needing `netlify dev`.
const nhlProxyDev = {
  name: 'nhl-proxy-dev',
  configureServer(server) {
    server.middlewares.use('/.netlify/functions/nhl', async (req, res) => {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const out = await nhlHandler({ queryStringParameters: Object.fromEntries(params) });
      res.statusCode = out.statusCode;
      Object.entries(out.headers ?? {}).forEach(([k, v]) => res.setHeader(k, v));
      res.end(out.body);
    });
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), nhlProxyDev],
})
