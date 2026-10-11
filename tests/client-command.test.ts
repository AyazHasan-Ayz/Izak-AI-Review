import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

it('creates random links and QR assets, deactivates clients, and rotates tokens locally', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'izak-cli-test-'));
  const script = resolve('scripts/client.mjs');
  function run(...args: string[]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout;
  }
  try {
    run(
      'add',
      '--id',
      'test-cafe',
      '--name',
      'Test Cafe',
      '--logo',
      'https://example.com/logo.png',
      '--google',
      'https://g.page/r/test/review',
      '--origin',
      'https://reviews.example',
    );
    const token = readFileSync(join(cwd, 'private/issued/test-cafe.token'), 'utf8');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const config = () => JSON.parse(readFileSync(join(cwd, 'private/clients.json'), 'utf8'));
    expect(config()[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(config())).not.toContain(token);
    expect(readFileSync(join(cwd, 'private/issued/test-cafe.png')).subarray(1, 4).toString()).toBe(
      'PNG',
    );
    expect(readFileSync(join(cwd, 'private/issued/test-cafe.url.txt'), 'utf8')).toBe(
      `https://reviews.example/r/${token}\n`,
    );
    run('status', '--id', 'test-cafe', '--status', 'inactive');
    expect(config()[0].status).toBe('inactive');
    run('rotate', '--id', 'test-cafe', '--origin', 'https://reviews.example');
    expect(readFileSync(join(cwd, 'private/issued/test-cafe.token'), 'utf8')).not.toBe(token);
    expect(config()[0].status).toBe('inactive');
    run('validate');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
