import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
function files(dir: string): string[] {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((f) =>
          f.isDirectory() ? files(path.join(dir, f.name)) : [path.join(dir, f.name)],
        )
    : [];
}
it.skipIf(!fs.existsSync('.next/static'))(
  'has no private key values or client configuration hashes in built client assets',
  () => {
    const env = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
    const privateNames = [
      'GROQ_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REVIEW_TOKEN_ENCRYPTION_KEY',
      'ABUSE_HASH_SECRET',
    ];
    const parsedEnv = parseEnv(env);
    const secrets = privateNames
      .flatMap((name) => [parsedEnv[name], process.env[name]])
      .filter((v): v is string => !!v && v.length > 15);
    const clients = fs.existsSync('private/clients.json')
      ? JSON.parse(fs.readFileSync('private/clients.json', 'utf8'))
      : [];
    for (const client of clients) secrets.push(client.token_hash);
    for (const file of files('.next/static').filter((f) => /\.(js|css|map)$/.test(f))) {
      const content = fs.readFileSync(file, 'utf8');
      for (const secret of secrets)
        expect(content.includes(secret), `A server credential was found in ${file}`).toBe(false);
    }
  },
);
it.skipIf(!fs.existsSync('.next/server/app'))(
  'packages configuration only on the server, without owner tokens or env files',
  () => {
    for (const file of [
      '.next/server/app/r/[token]/page.js.nft.json',
      '.next/server/app/api/review/[token]/generate/route.js.nft.json',
    ]) {
      const trace = JSON.parse(fs.readFileSync(file, 'utf8')).files as string[];
      expect(trace.some((p) => p.replaceAll('\\', '/').endsWith('/private/clients.json'))).toBe(
        true,
      );
      expect(
        trace.some((p) =>
          /\/private\/issued\/|\/\.env(?:\.|$)|\/tests\//.test(p.replaceAll('\\', '/')),
        ),
      ).toBe(false);
    }
  },
);
