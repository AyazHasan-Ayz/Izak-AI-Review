import { createServer } from 'node:http';

// Isolated browser-test double, never imported by the application or deployed.
const id = '8531f880-9cd9-44f5-8b86-a71a032eafed';
const user = {
  id,
  email: 'owner@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
let records = [];
const images = new Map();
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:3108');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  let body = {};
  if (req.headers['content-type']?.includes('application/json') && bytes.length)
    body = JSON.parse(bytes);
  const send = (status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === '/health') return send(200, { ok: true });
  if (url.pathname === '/auth/v1/token') {
    if (body.email !== user.email || body.password !== 'test-owner-password')
      return send(400, { msg: 'Invalid credentials' });
    return send(200, {
      access_token: token,
      refresh_token: 'test-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    });
  }
  if (url.pathname === '/auth/v1/user')
    return req.headers.authorization === `Bearer ${token}`
      ? send(200, user)
      : send(401, { msg: 'Invalid session' });
  if (url.pathname === '/auth/v1/logout') return send(200, {});
  if (url.pathname.startsWith('/storage/v1/object/public/')) {
    const image = images.get(url.pathname.replace('/public/', '/'));
    if (!image) return send(404, {});
    res.writeHead(200, { 'Content-Type': 'image/webp' });
    return res.end(image);
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    if (req.method === 'POST') images.set(url.pathname, bytes);
    return send(200, { Key: 'test-logo' });
  }
  if (url.pathname === '/rest/v1/businesses') {
    if (req.headers.apikey !== 'test-service-role') return send(403, { message: 'Denied' });
    let rows = records.filter(
      (row) => !url.searchParams.get('id') || `eq.${row.id}` === url.searchParams.get('id'),
    );
    if (req.method === 'POST') {
      const row = {
        ...body,
        id: crypto.randomUUID(),
        logo_url: '',
        logo_path: null,
        created_at: new Date().toISOString(),
      };
      records.push(row);
      rows = [row];
    }
    if (req.method === 'PATCH') {
      if (body.logo_url)
        body.logo_url = body.logo_url.replace(
          'http://127.0.0.1:3108',
          'https://mock-storage.example',
        );
      rows.forEach((row) => Object.assign(row, body));
    }
    if (req.method === 'DELETE') records = records.filter((row) => !rows.includes(row));
    const columns = url.searchParams.get('select');
    if (columns && columns !== '*')
      rows = rows.map((row) =>
        Object.fromEntries(columns.split(',').map((key) => [key, row[key]])),
      );
    return send(200, req.headers.accept?.includes('vnd.pgrst.object') ? rows[0] : rows);
  }
  return send(404, { message: 'Unknown test endpoint' });
}).listen(3108, '127.0.0.1');
