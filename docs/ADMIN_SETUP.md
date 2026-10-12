# Private IZAK administration

This extends the existing Next.js/Vercel project. The public review form and Groq prompt are unchanged. No customer ratings, feedback, drafts, names or phone numbers are written to Supabase. SEO planning keywords are admin-only and never sent to Groq.

## 1. Configure Supabase

1. Open your project `https://wqjazzyjhpriemmftzhf.supabase.co` in the Supabase dashboard.
2. Under Authentication > Sign In / Providers, disable **Allow new users to sign up**. Keep Email/password enabled. Disable anonymous sign-ins and unused providers. There is no signup endpoint or signup screen in IZAK, but disabling signup at Supabase is also essential.
3. Under Authentication > Users, choose **Add user > Create new user**. Enter your own email and a unique password of at least 12 characters. Confirm the email for this manually provisioned owner. Do not create a second admin or give businesses accounts.
4. Copy that user's UUID. Set `ADMIN_USER_ID` to that exact UUID on the server. Never use email matching, user metadata, the first registered user, or a public bootstrap URL to grant access. Until this value is set, access fails closed. Changing the UUID revokes the previous owner's access on the next protected request.
5. Under SQL Editor, run `supabase/migrations/202610120001_admin_businesses.sql` once. This creates businesses, expiring usage counters, the atomic reservation function, indexes, RLS and the public-read logo bucket. The migration is transactional; record it as applied rather than rerunning it.
6. Under Storage, confirm `business-logos` exists. Logos are public business assets. Keep uploads/updates/deletes restricted: do not add anon or authenticated write policies. The backend service key alone writes validated WebP images.
7. Under Authentication > URL Configuration, set Site URL to `https://izak-ai.vercel.app`. Allow `https://izak-ai.vercel.app/admin/reset-password`. For local recovery testing also allow `http://127.0.0.1:3000/admin/reset-password`.
8. Under Authentication > Email Templates > Reset Password, set the link to:

   ```html
   <a href="{{ .SiteURL }}/admin/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your IZAK password</a>
   ```

   This verifies a one-time recovery token on the server. Only the configured admin UUID is accepted. The callback does not accept an arbitrary redirect destination. For local recovery use a separate test project with its Site URL set to the local origin; do not change the production Site URL just to test locally.
9. Configure a production SMTP provider under Authentication > Email/SMTP settings. Test actual delivery. Configure Supabase Auth rate limits, strong password requirements, and a short JWT lifetime (for example 15 minutes). Logout and password changes revoke refresh sessions globally; already issued access tokens may remain valid until their expiry. Use a separate browser session to verify logout behavior.

## 2. Environment variables

Set these in `.env.local` for local use and Vercel > izak-ai > Settings > Environment Variables for Production. Select only environments that need the credentials. Do not commit `.env.local`, paste secrets in chat, or prefix these variables with `NEXT_PUBLIC_`.

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://izak-ai.vercel.app` (local: `http://127.0.0.1:3000`) |
| `SUPABASE_URL` | `https://wqjazzyjhpriemmftzhf.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys > Publishable key (legacy anon key is also compatible) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API Keys > server secret/service-role key; never expose to a browser |
| `ADMIN_USER_ID` | UUID of your one manually created Supabase user |
| `REVIEW_TOKEN_ENCRYPTION_KEY` | Independent random 32-byte key, encoded as 64 hex characters |
| `ABUSE_HASH_SECRET` | Another independent random 32-byte secret |
| `BUSINESS_STORE` | `supabase` after migration/cutover below; `file` only during legacy transition |
| `GROQ_API_KEY` | Existing private Groq key |
| `GROQ_MODEL` | Optional; `openai/gpt-oss-20b` by default |

Generate each of the two random secrets independently in a trusted terminal:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the encryption key in a password manager. Losing or replacing it breaks retrieval of existing QR/NFC links; hashes will still authorize existing links, but each business must rotate its token to issue a new downloadable link. Do not change this key casually. Use different keys and databases for test/preview environments.

`VERCEL=1` is supplied by Vercel itself. The durable limiter trusts only Vercel's platform-owned `x-vercel-forwarded-for` header. Other production hosts fail closed until a trusted IP adapter is implemented; arbitrary `x-forwarded-for` is not trusted. Local development uses a shared local IP bucket.

## 3. Preserve existing links and cut over

The default/`file` mode preserves the existing private configuration workflow until the Supabase setup is ready. **Admin-created businesses become public only in `BUSINESS_STORE=supabase` mode.** Do not leave production in file mode after launching the dashboard.

The current repository's private configuration had no clients when this work started. If you have since provisioned file-based clients, use `npm run migrate:clients` before switching. This imports existing business details, token hashes and raw issued tokens from the private owner directory into Supabase with encrypted tokens, retaining existing URLs and assigning new internal database UUIDs. It refuses missing raw tokens and nonempty destination tables to avoid silently replacing live businesses. Review imported rows, upload each business's logo in the dashboard, and confirm old QR links in a test deployment before cutover. Keep private backups; never put token files in Git.

Once migrated (or immediately for an empty client list), set `BUSINESS_STORE=supabase`, redeploy, and use `/admin/login`. No public customer needs an account. The homepage deliberately does not advertise admin access.

## 4. Daily management

1. Sign in at `https://izak-ai.vercel.app/admin/login`.
2. Choose **Add New Business**. Supply the logo (PNG/JPEG/WebP, under 2 MB), name, category, city, Google link, optional comma-separated SEO planning keywords, limit and status.
3. Save. The server creates an inactive record, validates/re-encodes the logo, then applies the requested status. If upload fails, the same inactive record is retained for retry; no duplicate is created.
4. Use the QR icon to copy the HTTPS review/NFC URL or download PNG/SVG. Write the exact URL to an NFC tag as a URI record. Downloading QR codes again does not change the URL.
5. Deactivate with the power icon. All subsequent generation requests recheck activation, including a check after Groq returns. A call already sent to Groq cannot be recalled, but its result will be withheld when the business has been deactivated.
6. Rotate a link only when revoking access: old QR codes/NFC tags stop working. Print/write replacements. Delete requires confirmation; related business counters cascade away. The business is revoked before logo cleanup. A storage cleanup failure is shown explicitly and can be fixed manually.

## 5. Abuse protection and data retention

Supabase's `reserve_generation` runs a single transaction under an advisory lock. Every attempt reserves quota before contacting Groq, including failed provider calls. UTC day limits: business-configured limit, 30 attempts per keyed IP, 10 per signed session and 2,000 globally. Minute limits: 5 per IP and 30 per business. Adjust deployment-wide caps in a reviewed follow-up SQL migration; there are no invented usage statistics in the dashboard.

Only counters, UTC bucket keys, business IDs and keyed hashes are persisted. No raw IP is stored. A signed HttpOnly essential cookie lasts one day; clearing it cannot bypass the IP/business/global caps. Daily hashing limits cross-day correlation. Expired rows are removed on subsequent valid generation requests. For guaranteed cleanup during inactivity, enable Supabase Cron and schedule daily SQL: `delete from public.usage_buckets where expires_at < now();`. Do not log request bodies in Vercel/Supabase/Groq diagnostics.

Enable Vercel Firewall rate limiting for `/api/admin/auth` (for example 5 requests/minute/IP) and `/api/review/*/generate` (for example 10/minute/IP), with bot protection/challenges appropriate to your plan. Supabase Auth also enforces its own endpoint limits. Set Groq project/model limits and budget alerts or spending caps where your plan supports them. These external settings are not enabled by application code and have not been claimed as configured. Distributed bots can exhaust legitimate daily quotas; keep the global cap conservative.

RLS is enabled with **no anon/authenticated table policies** and explicit table/function privilege revocation. This is deliberate: only the server service role accesses these tables, after the admin guard or the limited token-authorized public workflow. Supabase users cannot edit businesses through direct REST calls, even with a valid ordinary login. Do not relax these policies to make a browser request work.

## 6. Verification and deployment

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run dev
```

Unit tests mock Supabase HTTP/auth, and PostgreSQL migration tests run in an isolated embedded PostgreSQL instance. They do not establish live Supabase connectivity. Browser tests use the legacy fixture store for customer regression and an isolated Supabase HTTP test double for admin login, creation, editing, deactivation, downloads, rotation, deletion and logout. These tests never use live credentials. Component tests also exercise management with mocked endpoints.

The build script uses Next.js's supported Webpack compiler because the installed Turbopack version crashed while starting its CSS worker on this Windows host. `npm run build` remains the Vercel build command; no framework, route or deployment change is required.

Live staging checklist before production:

- Anonymous `/admin` redirects to login. Each admin API denies anonymous and a second non-authorized test user, including logo, QR, rotate and delete. Remove the test user afterward. Direct REST reads/writes and `reserve_generation` RPC with the publishable key or ordinary user token are denied.
- Owner login, refresh/reload, logout, recovery email, one-time callback, password change and old password rejection all work. No signup screen exists, and direct Supabase signup is disabled.
- Create a test business, upload a logo, edit all fields, search, deactivate/reactivate, download PNG/SVG, copy link, rotate and delete. Inspect private table access and Storage policies.
- Scan the actual QR/NFC link on a phone. Follow rating > honest feedback > Groq draft > edit > copy/open Google. Do not post synthetic reviews to Google. Keywords must not be added to the prompt.
- With daily limit 1, the second valid generation returns 429. Concurrent requests cannot exceed the quota. Deactivation and rotation revoke links immediately; a database outage fails closed.
- Verify no draft/feedback records exist, no server secret appears in browser bundles or responses, and only authorized admin cookies/session data are present.

Commit/push to the existing connected Vercel project. Keep Framework Next.js, root repository directory and default output. After setting variables, use Deployments > Redeploy > Production without old build cache. Check Ready, then verify `https://izak-ai.vercel.app`, `/privacy`, `/admin/login` and an authorized review URL. A successful build alone does not verify live Auth/SQL/Storage/Groq. Do not promote until the staging checklist passes.

Deploy the updated source commit, not just an old deployment: redeploying an older commit does not include the local admin implementation. In the existing `izak-ai` project, use `npm ci` for installation and `npm run build` for building; leave Output Directory at its Next.js default. Set the Production environment variables listed above before deploying the new commit. Keep `.env.local` untracked. Environment changes take effect only on new deployments. Do not rerun the already-applied initial SQL migration.

Official references: [Supabase server-side Auth](https://supabase.com/docs/guides/auth/server-side), [getUser verification](https://supabase.com/docs/reference/javascript/auth-getuser), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [disabling signups](https://supabase.com/docs/guides/auth/general-configuration), [Vercel trusted headers](https://vercel.com/docs/headers/request-headers).
