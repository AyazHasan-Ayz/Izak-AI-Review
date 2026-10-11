import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import QRCode from 'qrcode';
import { clientListSchema } from '../src/lib/client-schema.ts';

// This command is for the owner's local terminal; it is never imported by the website.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    name: { type: 'string' },
    logo: { type: 'string' },
    google: { type: 'string' },
    origin: { type: 'string' },
    status: { type: 'string' },
  },
});
const dir = resolve('private');
const config = join(dir, 'clients.json');
const command = positionals[0];
const hash = (token) => createHash('sha256').update(token).digest('hex');
function save(clients) {
  const valid = clientListSchema.parse(clients);
  const temporary = `${config}.${randomBytes(8).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(valid, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  renameSync(temporary, config);
}
function origin() {
  const url = new URL(values.origin || process.env.APP_URL || 'http://127.0.0.1:3000');
  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use an HTTPS origin without a path, query or credentials (HTTP is allowed only for localhost).',
    );
  return url.origin;
}
async function issue(id, token, siteOrigin) {
  const issued = join(dir, 'issued');
  mkdirSync(issued, { recursive: true, mode: 0o700 });
  const url = `${siteOrigin}/r/${token}`;
  writeFileSync(join(issued, `${id}.token`), token, { mode: 0o600 });
  writeFileSync(join(issued, `${id}.url.txt`), `${url}\n`, { mode: 0o600 });
  await QRCode.toFile(join(issued, `${id}.png`), url, {
    width: 1024,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  console.log(
    `Review URL: ${url}\nQR image: ${join(issued, `${id}.png`)}\nWrite the same URL as a URI record on the NFC tag. Redeploy client configuration before sharing.`,
  );
}
try {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const clients = clientListSchema.parse(
    existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')) : [],
  );
  if (command === 'validate') {
    if (!existsSync(config))
      throw new Error('Missing private/clients.json. Create it with [] or use the add command.');
    console.log(`Valid configuration: ${clients.length} clients. No secrets displayed.`);
  } else if (command === 'add') {
    const siteOrigin = origin();
    const token = randomBytes(32).toString('base64url');
    const client = {
      id: values.id,
      name: values.name,
      logo_url: values.logo,
      google_review_url: values.google,
      token_hash: hash(token),
      status: 'active',
    };
    save([...clients, client]);
    await issue(values.id, token, siteOrigin);
  } else if (['status', 'rotate', 'url'].includes(command)) {
    const client = clients.find((c) => c.id === values.id);
    if (!client) throw new Error('Unknown client ID.');
    if (command === 'status') {
      client.status = values.status;
      save(clients);
      console.log(
        `${client.id}: ${client.status}. Redeploy for this change to reach the live website.`,
      );
    } else {
      const siteOrigin = origin();
      const token =
        command === 'rotate'
          ? randomBytes(32).toString('base64url')
          : readFileSync(join(dir, 'issued', `${client.id}.token`), 'utf8').trim();
      if (command === 'rotate') {
        client.token_hash = hash(token);
        save(clients);
      } else if (hash(token) !== client.token_hash)
        throw new Error(
          'Saved token does not match configuration. Use rotate to issue a new link.',
        );
      await issue(client.id, token, siteOrigin);
    }
  } else {
    throw new Error(
      'Commands: add --id --name --logo --google [--origin]; status --id --status active|inactive; url --id [--origin]; rotate --id [--origin]; validate',
    );
  }
} catch (error) {
  // Validation paths are useful; avoid printing configuration values or credentials.
  console.error(
    error?.issues
      ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
      : error.message,
  );
  process.exitCode = 1;
}
