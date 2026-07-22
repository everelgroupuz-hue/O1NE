const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');

const PORT = process.env.PORT || 5173;
const DIST = path.join(__dirname, 'dist');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);

function fetchProduct(slug) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) { resolve(null); return; }
    const apiUrl = `${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=name,images,price,description&limit=1`;
    const req = https.get(apiUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          resolve(rows && rows[0] ? rows[0] : null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildShareHtml(product, slug) {
  const name = product?.name?.ru || product?.name?.uz || slug;
  const desc = product?.description?.ru || product?.description?.uz || '';
  const image = product?.images?.[0] || '';
  const price = product?.price != null ? `${product.price.toLocaleString('ru-RU')} so'm` : '';
  const miniAppUrl = `https://t.me/kupishop?startapp=product_${slug}`;
  const origin = SUPABASE_URL ? SUPABASE_URL.replace(/\.supabase\.co.*$/, '') : '';
  const siteName = 'ONE — магазин в Telegram';

  const ogTitle = price ? `${name} — ${price}` : name;
  const ogDesc = desc ? desc.slice(0, 200) : siteName;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
  ${image ? `<meta name="twitter:card" content="summary_large_image">` : ''}
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}">
  <script>
    setTimeout(function() { window.location.replace(${JSON.stringify(miniAppUrl)}); }, 1500);
  </script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f5f5; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#fff; border-radius:16px; padding:24px; max-width:360px; width:90%; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .card img { width:100%; border-radius:12px; margin-bottom:16px; object-fit:cover; max-height:300px; }
    .card h1 { font-size:18px; color:#111; margin-bottom:8px; }
    .card p { font-size:14px; color:#666; margin-bottom:4px; }
    .card .price { font-size:22px; font-weight:800; color:#111; margin:8px 0 16px; }
    .card .btn { display:inline-block; background:#2AABEE; color:#fff; padding:12px 32px; border-radius:12px; text-decoration:none; font-weight:600; font-size:15px; }
    .card .hint { font-size:12px; color:#999; margin-top:12px; }
  </style>
</head>
<body>
  <div class="card">
    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">` : ''}
    <h1>${escapeHtml(name)}</h1>
    ${price ? `<p class="price">${escapeHtml(price)}</p>` : ''}
    ${desc ? `<p>${escapeHtml(ogDesc)}</p>` : ''}
    <a class="btn" href="${escapeHtml(miniAppUrl)}">Открыть в Telegram</a>
    <p class="hint">Откроется автоматически...</p>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  pathname = pathname.replace(/\0/g, '');

  const shareMatch = pathname.match(/^\/share\/([a-z0-9_-]+)\/?$/i);
  if (shareMatch) {
    const slug = shareMatch[1];
    const product = await fetchProduct(slug);
    const html = buildShareHtml(product, slug);
    const content = Buffer.from(html, 'utf-8');
    const compressed = zlib.gzipSync(content, { level: 6 });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': compressed.length,
      'Cache-Control': 'public, max-age=3600',
      'Vary': 'Accept-Encoding',
    });
    res.end(compressed);
    return;
  }

  let filePath = path.join(DIST, pathname);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(DIST))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const acceptEncoding = req.headers['accept-encoding'] || '';

  try {
    const content = fs.readFileSync(filePath);
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Vary': 'Accept-Encoding',
    };

    if (COMPRESSIBLE.has(ext) && acceptEncoding.includes('gzip')) {
      const compressed = zlib.gzipSync(content, { level: 6 });
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = compressed.length;
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      headers['Content-Length'] = content.length;
      res.writeHead(200, headers);
      res.end(content);
    }
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
