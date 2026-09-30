// The AHL's stats live on HockeyTech's LeagueStat feed (the same one
// theahl.com uses). Like the NHL API it sends no CORS headers, so this
// forwards the request server-side and fills in the league's public site key.
// The browser passes only the feed parameters, e.g.
// /.netlify/functions/ahl?feed=modulekit&view=gamesbydate&fetch_date=2026-10-03
const FEED_URL = 'https://lscluster.hockeytech.com/feed/index.php';
const AHL_KEY = '50c2cd9b5e18e390';
const ALLOWED_FEEDS = new Set(['modulekit', 'gc']);

export const handler = async (event) => {
  const params = { ...(event.queryStringParameters ?? {}) };
  if (!ALLOWED_FEEDS.has(params.feed)) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'invalid feed' }) };
  }
  delete params.key;
  delete params.client_code;
  const qs = new URLSearchParams({ ...params, key: AHL_KEY, client_code: 'ahl', lang: 'en', fmt: 'json', site_id: '0', league_id: '4' });
  try {
    const res = await fetch(`${FEED_URL}?${qs}`);
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60',
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
