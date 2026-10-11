# Verification

Verified locally on 11 October 2026. Previous database and authentication test results do not apply.

- Production Next.js 16.4.0 build and TypeScript checks passed. The only app routes are `/`, `/privacy`, `/r/[token]`, and `/api/review/[token]/generate` (plus the framework's not-found handler).
- All 37 tests in 7 suites passed: private config validation, activation and token rotation, bounded inputs and origin validation, Groq errors, owner CLI provisioning, equal Google access at every rating, clipboard success/fallback and hosting rate-limit errors.
- All 9 Chrome browser tests passed. The review flow fits 320px, 390px, 768px and 1440px widths without horizontal overflow. Inactive/unknown links are unavailable and removed account/configuration APIs return 404. Screenshots are in `artifacts/`.
- Frontend asset scans found no configured Groq key or private client hashes. Server trace checks confirmed that the default client file is included without local environment files, issued tokens or test fixtures.
- A small live Groq request using synthetic feedback returned HTTP 200 and a nonempty draft. No key or generated review was printed. The supplied `.env.local` initially lacked dotenv assignment syntax; it was normalized to `GROQ_API_KEY=...` while preserving the exact key.
- Browser generation tests mock Groq; the live probe checked provider connectivity separately. No customer feedback or reviews were saved.
- `private/clients.json` remains empty. No real business was activated without its details, and test clients are used only by the isolated test configuration.

The restricted Windows sandbox interfered with temporary test files and subprocess file operations. Builds and tests passed with approved normal local process access.

Hosting rate limits, bot protection, provider spending/data settings and physical QR/NFC scans must be verified after a host is selected. No live deployment has been created.
