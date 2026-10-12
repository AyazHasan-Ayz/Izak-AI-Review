// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
let db: PGlite;
const hash = 'a'.repeat(64);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await db.exec(readFileSync('supabase/migrations/202610120001_admin_businesses.sql', 'utf8'));
  await db.query(
    `insert into public.businesses(name,logo_url,google_review_url,category,city,status,token_hash,token_encrypted,daily_limit)
    values ('Test Cafe','https://example.com/logo.webp','https://g.page/r/test/review','Cafe','Test City','active',$1,'encrypted',2)`,
    [hash],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
it('RLS is enabled and browser roles cannot read/write business records or reserve quota', async () => {
  const rows = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where relname in ('businesses','usage_buckets')",
  );
  expect(rows.rows.every((row) => row.relrowsecurity)).toBe(true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query('select * from public.businesses')).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query("update public.businesses set status = 'active'")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query('select public.reserve_generation($1,$2,$3)', [
          hash,
          'b'.repeat(64),
          'c'.repeat(64),
        ]),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
});
it('serial reservations cannot exceed the business limit and inactive tokens are rejected', async () => {
  const reserve = () =>
    db.query<{ result: string }>('select public.reserve_generation($1,$2,$3) as result', [
      hash,
      'b'.repeat(64),
      'c'.repeat(64),
    ]);
  expect((await reserve()).rows[0].result).toBe('ok');
  expect((await reserve()).rows[0].result).toBe('ok');
  expect((await reserve()).rows[0].result).toBe('limited');
  await db.exec("update public.businesses set status='inactive'");
  expect((await reserve()).rows[0].result).toBe('unavailable');
  const unknown = await db.query<{ result: string }>(
    'select public.reserve_generation($1,$2,$3) as result',
    ['d'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
  );
  expect(unknown.rows[0].result).toBe('unavailable');
});
it('enforces every shared cap and cleans expired buckets without storing review content', async () => {
  await db.exec("update public.businesses set status='active',daily_limit=10000");
  const { rows } = await db.query<{ id: string }>('select id from public.businesses');
  const day = new Date().toISOString().slice(0, 10);
  const minute = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
  const caps: [string, number][] = [
    [`global:${day}`, 2000],
    [`ip:${'b'.repeat(64)}:${day}`, 30],
    [`session:${'c'.repeat(64)}:${day}`, 10],
    [`ip-minute:${'b'.repeat(64)}:${minute}`, 5],
    [`business-minute:${rows[0].id}:${minute}`, 30],
  ];
  for (const [key, cap] of caps) {
    await db.exec('delete from public.usage_buckets');
    await db.query(
      "insert into public.usage_buckets(key,count,expires_at) values($1,$2,now()+interval '1 day')",
      [key, cap],
    );
    const result = await db.query<{ result: string }>(
      'select public.reserve_generation($1,$2,$3) as result',
      [hash, 'b'.repeat(64), 'c'.repeat(64)],
    );
    expect(result.rows[0].result).toBe('limited');
  }
  await db.exec("update public.usage_buckets set expires_at = now() - interval '1 day'");
  const allowed = await db.query<{ result: string }>(
    'select public.reserve_generation($1,$2,$3) as result',
    [hash, 'b'.repeat(64), 'c'.repeat(64)],
  );
  expect(allowed.rows[0].result).toBe('ok');
  expect(
    (await db.query('select * from public.usage_buckets where expires_at < now()')).rows,
  ).toHaveLength(0);
});
it('deletion cascades business counters but preserves shared abuse buckets', async () => {
  await db.exec('delete from public.businesses');
  expect(
    (await db.query('select * from public.usage_buckets where business_id is not null')).rows,
  ).toHaveLength(0);
  expect((await db.query('select * from public.usage_buckets')).rows.length).toBeGreaterThan(0);
});
