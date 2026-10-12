# Vercel Deployment Repair

## Confirmed cause

On 11 October 2026, both `/` and `/privacy` returned HTTP 404 with `x-vercel-error: NOT_FOUND`. These were Vercel platform errors, not the Next.js application's not-found page.

The project's Framework Preset was **Other**, with no output override. The latest deployment of commit `1bcd380` failed with: `No Output Directory named "public" found after the Build completed`. Vercel was treating the Next.js build as a generic static site. The previously Ready deployment did not prove that the Next.js routes had been deployed correctly.

The repository root was correct and contained `package.json`, `next.config.ts` and `src/app/page.tsx`. The local production build contained both `/` and `/privacy`. No application routing rewrite or UI replacement was needed.

## Repair applied

The Vercel project's Framework Preset was changed to **Next.js**, then the existing commit was redeployed to Production without reusing the build cache. Deployment `7eDmZjkCfKwJain9mcxWYFf5eMWP` reached Ready and was assigned `izak-ai.vercel.app`.

Public HTTP requests after deployment verified:

| Path | Result |
| --- | --- |
| `/` | 200, actual IZAK homepage |
| `/privacy` | 200, actual privacy page |
| `/login` | 404, expected removed route |
| `/private/clients.json` | 404, private file not exposed |

The homepage was also opened and visually inspected in a browser. The black/champagne design is intact. This verifies website routing, not a live authorized customer's Groq generation.

Local lint, TypeScript, production build and all 37 regression tests passed. A temporary local production server also returned 200 for `/` and `/privacy`.

## Keep these project settings

In Vercel > `izak-ai` > Settings > Build and Deployment:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | Empty: repository root |
| Build Command | Default `npm run build` |
| Output Directory | Override OFF: Next.js default |
| Install Command | Automatic, or `npm ci` |
| Node.js Version | 24.x |

Do not set Root Directory to `src`, `src/app`, or a Windows folder path. Do not set Output Directory to `public`, `dist`, `out`, or `.next/static`. Do not add a catch-all rewrite to `/index.html`; this is a Next.js application with server routes.

The local `vercel.json` now pins the Next.js preset, `npm run build`, `npm ci`, and the framework-default output directory (`null`). Commit and push it with this guide to retain the configuration in the repository. The immediate production repair used the saved Vercel setting and the existing remote commit, so no source push was needed for that repair.

## Production environment and client provisioning

In Settings > Environments > Production, use the Environment Variables section:

- `GROQ_API_KEY`: your existing key, stored as a server secret. Never use a `NEXT_PUBLIC_` prefix.
- `APP_URL`: `https://izak-ai.vercel.app`.
- `GROQ_MODEL`: optional; the existing default is `openai/gpt-oss-20b`.

After changing environment variables, redeploy. Local `.env.local` is ignored by Git and is not automatically available on Vercel. Missing Groq configuration cannot explain the homepage's platform 404: the homepage makes no Groq calls.

Business review pages additionally require the private `private/clients.json` file in the server build. That file is intentionally ignored by Git. The existing [setup guide](SETUP.md) explains private build-time file injection and the owner-only client/QR commands. Supply the file through protected CI/build configuration, not the public repository or a `public/` folder. Next.js's existing file-tracing configuration includes it in the review and generation functions. No business was added or activated during this repair.

## Redeploy and verify

1. For future code changes, commit and push the changed files to the connected `main` branch of `AyazHasan-Ayz/Izak-AI-Review`. Vercel creates a new deployment.
2. For a settings-only change, open Deployments, select the desired commit, choose Redeploy, select Production, leave Use existing Build Cache unchecked, and confirm Redeploy. This uses the latest project settings.
3. Check Build Logs for Next.js detection, successful `next build`, and the route table containing `/`, `/privacy`, `/r/[token]`, and `/api/review/[token]/generate`.
4. Confirm Ready and that Domains includes `izak-ai.vercel.app`. Test that production domain, not only the unique preview URL.
5. Open `/` and `/privacy` in a private browser window. Both must return 200 and display IZAK content. `/login` and `/private/clients.json` must remain 404. Browser developer tools > Network shows the actual HTTP status.
6. Once a real client and production secrets are provisioned, scan its QR/NFC URL and test rating, honest feedback, generation, editing and copy/open Google. Do not submit a synthetic test review to Google. Also verify inactive and random tokens cannot generate.

Keep the hosting rate limits, bot protection and Groq budget controls described in [SECURITY.md](SECURITY.md). They were not weakened or replaced during this deployment repair.

References: [Vercel 404 diagnosis](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404), [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
