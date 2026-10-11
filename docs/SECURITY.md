# Stateless Abuse Protection

## Application boundary

Every generation request validates a 256-bit random token against a SHA-256 hash in server-only configuration and requires active status. It does not trust a supplied business ID. The JSON schema is strict; arbitrary business IDs, tokens in the body and extra configuration are rejected. Only feedback, rating, language, selected product and configured length reach Groq. Server errors omit keys and provider error bodies.

Requests require the exact configured origin, JSON content and at most 8 KiB of body data, enforced while reading even without Content-Length. Experience is capped at 1,500 characters and output at 2,500 characters. A honeypot rejects basic form spam. These checks are not a rate limiter or proof of a human: an attacker can forge Origin outside a browser.

No in-memory or database rate limiter is included. Browser regeneration limits are usability controls only. The deployment must supply the abuse controls below. They are not configured yet because no hosting provider or provider-account settings have been selected.

## Hosting rules before launch

Apply controls at the actual ingress, including direct provider and preview URLs so an attacker cannot bypass the protected custom domain:

- Match POST `/api/review/*/generate`: start with 5 requests/minute/IP and a daily network cap suited to shared Wi-Fi usage. Use the host's verified source IP, never a client-provided forwarded header.
- Add per-path limits for each `/api/review/TOKEN/generate` route, for example 30/minute and a chosen daily client cap if the platform supports that window. Paths permit per-business edge limits without trusting a browser business ID. Count blocked, failed and successful attempts consistently.
- Enable the hosting provider's managed bot protection for `/r/*` and the generation API, with challenges on suspicious traffic. Ensure any challenge can be completed from the review page; do not return HTML challenges to JSON-only requests without testing the fallback.
- Set a global API request/concurrency ceiling and reject oversized bodies at the edge. Rate-limit invalid-token traffic as well as authorized routes.
- Test these rules against the real deployment, including new browser sessions, spoofed forwarded headers, direct hostnames and concurrent requests. Confirm blocked traffic never reaches the function or Groq. Set the response to HTTP 429 where supported.

These are starting policy values to configure in the chosen host, not enforced values in this source tree. Per-session edge controls may be used if the provider supports them. Exact global daily business quotas require the hosting layer to count requests; this application deliberately keeps no counters or customer sessions.

## Groq budget controls

Create a dedicated project/key for IZAK and set conservative project/model request limits. Groq's [project rate-limit documentation](https://console.groq.com/docs/projects) explains the available controls. Restrict model access to the model this application uses.

For a paid account with organization-owner access, open Settings > Billing > Limits, add a monthly spend cap and alert thresholds, then save. Groq [spend limits](https://console.groq.com/docs/spend-limits) block API access at the cap and apply organization-wide across keys. An alert alone is not a hard limit. Verify the applicable controls for your account before going live. Each user generation can make at most two Groq calls due to the existing transient-failure retry, with at most 900 completion tokens per call.

## Data and links

IZAK does not write customer ratings, feedback, drafts, cookies, browser storage or analytics. Disable request/response body capture in hosting logs, error-reporting tools and proxies. Minimize or redact token-bearing URL paths in access logs. No third-party analytics or remote scripts are embedded. Referrer policy is `no-referrer`, and review pages are dynamic and non-indexable; these settings reduce accidental link exposure but cannot prevent someone sharing a QR URL.

Feedback necessarily passes through Groq. Its [data controls](https://console.groq.com/docs/your-data) allow Zero Data Retention for customer inputs/outputs; enable that setting to match the intended privacy posture. Provider usage metadata and hosting security telemetry are separate from application storage. This code cannot change those account settings.

Protect your source, deployment artifacts, secret-file injection and local `private/` directory. The raw review URL goes to its customer's browser by design; other clients and token hashes do not. The Groq API key stays server-side. Nothing in this repository modifies or deletes data in any previously used hosted service.
