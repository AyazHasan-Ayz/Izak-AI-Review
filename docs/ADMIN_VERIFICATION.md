# Admin implementation verification

Verified locally on 12 October 2026:

- ESLint and TypeScript checks passed.
- Production build passed with Next.js Webpack. Routes include the existing homepage, privacy, review page and Groq endpoint plus protected admin pages and APIs. Turbopack's CSS-worker startup failed on this Windows environment, so the build script explicitly uses the supported Webpack compiler.
- 66 unit/regression/security tests passed. Coverage includes server-side admin UUID checks, anonymous/non-owner denial on every data API, CSRF origin checks, strict mutation validation, unsafe/oversized uploads, encryption/tampering, durable quota failure before Groq, and Supabase resolver failure behavior.
- The migration ran against isolated embedded PostgreSQL (PGlite). Table privileges/RLS, RPC restrictions, all quota bucket caps, activation checks, expiration cleanup and cascading business counter deletion passed. This is not a live Supabase integration test or a multi-connection production load test.
- 14 Playwright tests passed in Chrome. Customer workflow and denied links were checked at 320/390/768/1440 px. Admin login and recovery navigation were checked at 320/390/1440 px. An isolated local Supabase HTTP test double exercised owner login, HttpOnly cookies, create/logo upload, edit, deactivate, PNG download, token rotation, confirmed delete and logout. Dashboard screenshots cover 320/390/768/1440 px, with real image decoding checked for the mock uploaded logo.
- Browser assets were checked for actual configured server-secret values. Review responses expose display fields only; keywords and token ciphertext are not included in the public data projection.

Verified in the live Supabase project on 12 October 2026:

- Applied `202610120001_admin_businesses.sql` successfully after security review. Explicit PUBLIC table privilege revocation and null quota-identifier rejection were added before execution.
- Both tables have RLS enabled. Live privilege queries confirmed anon/authenticated have no SELECT, INSERT, UPDATE, DELETE or quota RPC execution privileges; service_role has the required access.
- Preflight confirmed no existing Storage object policies and no pre-existing logo bucket. The migration creates the public image-only bucket without browser write policies.
- Confirmed the single, email-confirmed owner account and configured its exact UUID locally. Server authorization uses verified getUser(), not browser-supplied identity.
- Verified public signup and anonymous sign-ins remain disabled in the live Supabase settings.
- Reran all 66 automated tests successfully outside the Windows sandbox after sandbox temporary-file errors.
- Read-only application connection checks using `.env.local` passed: business table access, exact configured admin lookup with confirmed email, and public WebP-only logo bucket with a 2 MB limit. No credential values were logged.
- Production build, ESLint, TypeScript and all 66 tests were rerun successfully after the live connection check. The initial sandbox build failed with a filesystem permission error; the successful build ran outside the sandbox.
- All 14 browser regression tests were rerun successfully, including mocked owner management, anonymous API denial, QR download and responsive customer workflows. These remain isolated tests, not real owner authentication or live Groq verification.

Not yet verified or completed:

- Full application environment is still incomplete: APP_URL, SUPABASE_PUBLISHABLE_KEY, REVIEW_TOKEN_ENCRYPTION_KEY, ABUSE_HASH_SECRET and BUSINESS_STORE were absent at the latest check. The service key connection works, but this does not establish working owner login. SMTP and recovery email delivery are also unverified.
- Live production admin login, logo upload or Groq generation through Supabase-backed business pages.
- Vercel firewall/bot controls or Groq account spending settings.
- This feature has not been pushed or deployed to production. The existing Vercel project/domain is preserved.

Follow [ADMIN_SETUP.md](ADMIN_SETUP.md), then complete its live staging checklist before deployment. Never replace live integration verification with these mocked tests.
