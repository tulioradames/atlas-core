const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-954smKzGp4xI/uiF7gcG5aC/KDDSDCeLjOEg932DkXM='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://drive.google.com https://*.googleusercontent.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://script.google.com https://script.googleusercontent.com; frame-src https://drive.google.com https://docs.google.com https://script.google.com https://*.googleusercontent.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
});

export default {
  async fetch(request, env) {
    try {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      Object.entries(SECURITY_HEADERS).forEach(([name, value]) => headers.set(name, value));

      const url = new URL(request.url);
      if (url.hostname.startsWith('test-atlas.')) headers.set('X-Robots-Tag', 'noindex, noarchive');
      if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/service-worker.js') {
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error(JSON.stringify({ event: 'asset_fetch_failed', message: String(error?.message || error) }));
      return Response.json({ error: 'Nao foi possivel carregar o Atlas.' }, { status: 500 });
    }
  },
};
