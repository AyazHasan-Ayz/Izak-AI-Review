# Owner Setup

For the current Supabase-backed private dashboard, use [ADMIN_SETUP.md](ADMIN_SETUP.md). Everything below is retained only for legacy file-mode deployments and migration. Do not use these file provisioning commands for dashboard-managed businesses.

## Server secrets

Keep `GROQ_API_KEY` in `.env.local` locally and in your host's secret environment variables in production. Never prefix it with `NEXT_PUBLIC_`, put it in Next config `env`, send it to the browser, or commit `.env.local`. `GROQ_MODEL` defaults to the existing `openai/gpt-oss-20b` model. Set `APP_URL` to the exact HTTPS production origin. The backend rejects missing production origin configuration and cross-origin browser requests.

Node.js 24 LTS is recommended. No SQL, database URL, authentication service, session secret or Supabase credentials are used.

## Private client file

`private/clients.json` is a JSON array. The folder is gitignored. The local CLI in the README generates the hash and QR/NFC assets; do not invent tokens from a business name or ID. Each client looks like:

```json
{
  "id": "cafe-one",
  "name": "Cafe One",
  "logo_url": "https://your-domain.com/cafe-one.png",
  "google_review_url": "https://g.page/r/REPLACE_ME/review",
  "token_hash": "SHA256_HEX_GENERATED_BY_THE_CLIENT_COMMAND",
  "status": "active",
  "category": "Cafe",
  "city": "Mumbai",
  "description": "",
  "language": "English",
  "products": ["Tea", "Coffee"],
  "review_length": "short"
}
```

The hash above is a placeholder, not valid configuration. Required fields are ID, name, HTTPS logo, official Google review/Maps URL, token hash and `active`/`inactive` status. Other fields are optional. Languages: English, Hindi or Hinglish. Length: short or medium. Product options are optional customer selections, never forced keywords. No per-business usage counter is stored in this file.

Update the file to change display details. Run `npm run client -- validate`, build and redeploy. An invalid file fails closed. Duplicate IDs or tokens are rejected. Only allowlisted display details are sent to the browser; the list of clients, IDs, status and hashes are not serialized.

## QR and NFC

`npm run client -- add ...` prints `https://YOUR_ORIGIN/r/RANDOM_TOKEN` and saves a high-resolution black-on-white QR PNG locally. Print the PNG with its white quiet zone intact. Write that exact URL to an NFC tag as an NDEF URI record. Both enter the same review page. Test the printed code and physical tag on a phone before distributing them.

Keep `private/issued/` locally backed up and do not deploy it. It contains the raw tokens and issued URLs. The server only needs the token hashes in `clients.json`. A review token is an unguessable bearer link, not proof that someone visited the business: anyone with a copy can use it while active. Rotate it if necessary, redeploy, then replace the printed QR/NFC URL.

## Serverless deployment

1. Choose a Next.js-compatible host with Node.js functions, outbound HTTPS, request filtering, rate limits and bot protection. This is not a static export or an edge-only runtime.
2. Configure the server secrets and `APP_URL`.
3. Supply `private/clients.json` privately before the build. With Git-based deployments, the ignored file will not be uploaded automatically: create it from a CI secret file or protected build secret using your host's secret-file facility. Do not log its contents. An empty `[]` is valid but authorizes nobody. Alternatively mount a read-only file and set `CLIENTS_FILE` to its absolute path.
4. Run `npm ci`, `npm run client -- validate` and `npm run build`. `next.config.ts` includes `private/clients.json` in both review-page and generation-function server traces. When using an alternate mounted `CLIENTS_FILE`, your host must supply that file at runtime. Never move configuration into `public/` to solve packaging problems.
5. Configure [hosting abuse controls and Groq limits](SECURITY.md) before public traffic. Avoid caching `/r/*` and `/api/review/*/generate`. Allow a 60-second function duration for the existing bounded Groq retry behavior.
6. After deployment, check an active token, an inactive token, a random token and a complete draft/copy flow. Confirm `/private/clients.json`, `/private/issued/*`, login and dashboard paths return 404.

Status changes take effect on the new serverless deployment. Route all traffic to the new version and disable access to obsolete deployment/preview URLs; an old immutable deployment contains its old config. An already open page cannot generate again once requests reach an inactive configuration. A request already sent to Groq cannot be recalled. The backend rechecks configuration before returning its result, but a redeployment cannot rewrite the memory/file of an old in-flight function.

The app writes no customer data or runtime files. The owner CLI writes only business configuration and QR/NFC assets. No application daily/session quotas are claimed; choose edge limits appropriate to your host and use Groq limits as the final budget boundary.
