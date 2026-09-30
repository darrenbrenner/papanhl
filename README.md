# papanhl — NHL Dashboard

React + Vite dashboard for the National Hockey League, modeled after the
papamlb MLB dashboard. Scores, game centers, newspaper-style box scores,
standings (division + wild card), teams/rosters, league leaders and player
cards.

Data comes from the NHL's public web API (`api-web.nhle.com/v1`). That API
sends no CORS headers, so the browser goes through a small Netlify function
proxy at `netlify/functions/nhl.js` (`/.netlify/functions/nhl?path=/v1/...`).
`npm run dev` serves the same proxy through a Vite middleware.

```bash
npm install
npm run dev      # local dev at http://localhost:5173
npm run build    # production build into dist/
```
