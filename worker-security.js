const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
});

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const backend = url.hostname.startsWith('SEU-WORKER-HOMOLOG.')
        ? 'https://homolog.seu-backend.exemplo.com.br'
        : 'https://seu-backend.exemplo.com.br';
      const backendSocket = backend.replace(/^https:/, 'wss:');
      const response = url.pathname.startsWith('/atlas-api/')
        ? await fetch(new Request(`${backend}${url.pathname}${url.search}`, request))
        : await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      Object.entries(SECURITY_HEADERS).forEach(([name, value]) => headers.set(name, value));

      headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'sha256-kMxMkW5nJQOi0Ga839RT1kQxMOx8tXcgIsk8mbNBeRw='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${backend} https://drive.google.com https://*.googleusercontent.com https://*.usercontent.google.com; connect-src 'self' ${backend} ${backendSocket} https://script.google.com https://script.googleusercontent.com; frame-src https://maps.google.com https://www.google.com https://drive.google.com https://docs.google.com https://script.google.com https://*.googleusercontent.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:`);
      if (url.hostname.startsWith('SEU-WORKER-HOMOLOG.')) headers.set('X-Robots-Tag', 'noindex, noarchive');
      if (url.pathname.startsWith('/atlas-api/')) {
        headers.set('Cache-Control', 'no-store');
      } else if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/service-worker.js') {
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
