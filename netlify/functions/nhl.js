// The NHL's public web API (api-web.nhle.com) sends no CORS headers, so the
// browser can't call it directly — this forwards the request server-side
// (where CORS doesn't apply) and adds our own permissive header. Several
// endpoints (e.g. club-schedule-season/.../now) answer with a 307 redirect,
// which fetch follows for us.
const ALLOWED_PREFIX = '/v1/';

export const handler = async (event) => {
  const path = event.queryStringParameters?.path;
  if (!path || !path.startsWith(ALLOWED_PREFIX) || path.includes('..')) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'invalid path' }) };
  }
  try {
    const res = await fetch(`https://api-web.nhle.com${path}`);
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
