# Security Audit — brand-engine

**Date:** 2026-07-27
**Scope:** Full review of the deployment attack surface for running brand-engine on a
VPS with several Docker containers in parallel (one per brand) behind a shared Traefik
reverse proxy. Covers infrastructure/Docker, the reverse proxy, CI/CD, the application
(Astro + self-hosted TinaCMS), secrets handling, and dependencies.

This document records findings, their impact, and the fix applied (or the follow-up
still owed). Hardening fixes from this pass are already committed; items marked
**Follow-up** or **Operational** still need action.

---

## Architecture & attack surface

```
Internet ──▶ Traefik (:80 → :443, Let's Encrypt)
                │  routes by Host + path on the `edge` docker network
                ├─▶ brand-A container ─┐
                └─▶ brand-B container ─┤ each runs entrypoint.sh as PID 1:
                                       │   clone content repo (GitHub PAT via HTTP header)
                                       │   → astro build → supervise:
                                       │     • nginx  :8080  (static site + /admin SPA)
                                       │     • Tina   :4001  (GraphQL /api/tina, Basic Auth)
```

The site is **statically generated** — there is no SSR. The public runtime attack
surface is small:

- The static site (all pages/posts/FAQ) — unauthenticated, read-only.
- `/admin` — the TinaCMS SPA; inert without credentials.
- `POST /api/tina/gql` — GraphQL, gated by HTTP Basic Auth; the only endpoint that
  does real work per request.

An attacker with `/admin` credentials can edit content (which is pushed to the brand's
GitHub content repo and served after the next boot). An attacker with the
`CONTENT_REPO_TOKEN` can push arbitrary content to that one repo. Neither can reach
other brands — each runs in its own container with its own `.env` and volume.

---

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | High | Tina backend + site published directly on the host, bypassing Traefik | ✅ Fixed |
| 2 | Medium | No HTTP security headers from nginx | ✅ Fixed |
| 3 | Medium | No rate limiting on the public GraphQL endpoint | ✅ Fixed |
| 4 | Medium | Containers run as root | ✅ Fixed |
| 5 | Low | No image vulnerability scanning in CI | ✅ Fixed |
| 6 | Low | Username compared non-constant-time; wrong user short-circuits before scrypt | ✅ Fixed |
| 7 | Operational | Local `.env` holds a live GitHub PAT | ⚠️ Owner action |
| 8 | Follow-up | npm-audit findings in the TinaCMS dependency tree (27 → 3; remainder blocked upstream) | ✅ Mostly fixed |
| 9 | Follow-up | CSP shipped as Report-Only; must be validated and enforced | 📌 Tracked |
| 10 | High (build) | `better-sqlite3` native addon broke `docker build`/CI (no compiler toolchain in `base`) | ✅ Fixed |

---

### 1. HIGH — Backend + site published on the host, bypassing Traefik ✅

**Where:** `docker-compose.yml`, `docker-compose.example.yml` (the latter is what
`scripts/create-brand.mjs` copies for every real brand deployment).

The `web` service published `"${WEB_PORT:-8080}:80"` and **`"${TINA_PORT:-4001}:4001"`**
to the host. On a VPS these bind `0.0.0.0`, exposing the static site and the **Tina
GraphQL backend** directly on the server's IP — skipping Traefik entirely, and with it
TLS, the HTTP→HTTPS redirect, and any middleware (including the new rate limit).

**Impact:** the CMS backend reachable in the clear on a public port; TLS and rate
limiting trivially bypassed by hitting the port directly.

**Fix:** removed the `ports:` block from both compose files. Traefik already routes `/`
and `/api/tina` over :443 by Host/path. For occasional local debugging, bind to
loopback only (`127.0.0.1:4001:4001`) — documented inline in both files.

### 2. MEDIUM — No HTTP security headers ✅

**Where:** `nginx.conf`.

Responses carried no `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Strict-Transport-Security`, or CSP, and leaked the nginx version.

**Fix:** added `server_tokens off` and, on both `location` blocks,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN`, and HSTS (`max-age=31536000; includeSubDomains`).
Verified the HSTS header survives from the origin through to the response, so no
Traefik headers-middleware is needed. A `Content-Security-Policy` is included but as
**`Content-Security-Policy-Report-Only`** — see Follow-up 9.

> nginx footgun handled deliberately: an `add_header` in a `location` drops *all*
> server-level `add_header`s, and both locations set `Cache-Control`, so the security
> headers are repeated inside each location rather than set at the server level (where
> they would silently vanish). Kept in the single file the Dockerfile copies.

### 3. MEDIUM — No rate limiting on `/api/tina` ✅

**Where:** `docker-compose.yml`, `docker-compose.example.yml`.

The GraphQL endpoint had no throttling. It is the one route that runs scrypt (auth) per
request, so an unauthenticated flood forces scrypt work and can saturate a container's
CPU — worse on a shared VPS.

**Fix:** added a Traefik `rateLimit` middleware (`average=5`, `burst=10` req/s per
source IP) wired to the `-tina` router via labels. Per-brand, no code change. Tune to
real `/admin` usage. Deeper GraphQL query-complexity/depth limits remain a possible
future hardening (noted, not implemented).

### 4. MEDIUM — Containers ran as root ✅

**Where:** `Dockerfile` (`server` stage), `nginx.conf`, `entrypoint.sh`.

nginx, the Tina Node backend, and `entrypoint.sh` (PID 1) all ran as root. Since
`entrypoint.sh` does `git clone` of brand-controlled content and runs `astro build`
over it at boot, a code-exec bug on that path would have run as root in-container.

**Fix:** added a non-root user (uid/gid 1001 `appuser`) and `USER appuser` in the
`server` stage. Because nginx as non-root cannot bind ports <1024, nginx now listens on
**8080** (internal; Traefik's `loadbalancer.server.port` updated to 8080 in both
compose files), its pid file moved to `/tmp/nginx.pid` via `nginx -g`, and its runtime
dirs plus all of `/app` are chowned to `appuser` (so the runtime `astro build` and the
`data` volume are writable). Verified end-to-end — see [Verification](#verification).

> **Migration note:** a named `data` volume created by a *previous root* run stays
> root-owned and the non-root container cannot write to it. New deployments are fine
> (an empty volume inherits `appuser` from the image's `/app/data`). If you already
> have a running instance, either recreate the volume or chown it once:
> `docker run --rm -v <brand>_data:/d alpine chown -R 1001:1001 /d`.

### 5. LOW — No image vulnerability scanning in CI ✅

**Where:** `.github/workflows/ci.yml`.

**Fix:** added a Trivy scan (`aquasecurity/trivy-action@v0.36.0`) of the built image in
the `test` job, `HIGH,CRITICAL`, `ignore-unfixed`. **Non-blocking** (`exit-code: '0'`)
on purpose: today's high findings come from the TinaCMS tree (Follow-up 8) and have no
fix available, so gating on them would only stall releases. Flip to `exit-code: '1'`
once Follow-up 8 lands. (Optional further hardening: pin third-party actions to commit
SHAs rather than major tags.)

### 6. LOW — Username timing / scrypt short-circuit ✅

**Where:** `tina/auth.ts`.

The username used `===` (not constant-time), and a wrong username returned *before* the
expensive scrypt call while a right-username/wrong-password path ran scrypt — so timing
revealed whether a username was valid.

**Fix:** username now compared in constant time via fixed-length SHA-256 digests (avoids
`timingSafeEqual`'s equal-length requirement and length leak), and `verifyPassword`
runs whenever credentials are present — even for a wrong username — so valid vs. invalid
usernames are indistinguishable by timing. Requests with no/invalid Basic header still
get a fast 401 challenge without running scrypt (the normal browser pre-auth flow),
which the new rate limit covers.

### 7. OPERATIONAL — Local `.env` holds a live GitHub PAT ⚠️

`.env` (correctly gitignored and dockerignored — **not** committed) contains a real
`github_pat_...` token on this dev filesystem. Not a code defect.

**Action (owner):** rotate the token; scope it fine-grained to the single content repo
(Contents: read+write) only; confirm it is not reused elsewhere.

### 8. FOLLOW-UP — npm-audit: 27 → 3 findings; remainder blocked upstream ✅/📌

**Correction to an earlier version of this report:** it originally said the fix
"needs a major `@tinacms/cli` bump." That was wrong. `npm audit`'s `fixAvailable`
field kept suggesting downgrades — first `@tinacms/cli@0.60.5` (published **2022**),
later `@tinacms/cli@1.3.3` — while the installed `2.5.6` is already the `latest`
dist-tag, published 2026-07-16. There is no newer `@tinacms/cli` to bump to.
`npm audit`'s advisory-matching gets confused by this package's unusually large
prerelease/canary tag history (3300+ versions) and points backward, not forward.
Ignore that suggestion whenever it reappears.

**What was actually fixed** — via targeted `package.json` `overrides` (the correct
mechanism when a leaf dependency has a patch available but the mid-tier package that
pins it hasn't bumped yet), applied in two rounds without ever touching
`@tinacms/cli`'s own version:

```json
"overrides": {
  "lodash": "^4.18.1",
  "markdown-it": "^14.3.0",
  "linkify-it": "^5.0.2",
  "brace-expansion": "^5.0.8",
  "esbuild": "0.25.0",
  "react-dom": "^19.2.8",
  "react-router": "^8.3.0",
  "react-router-dom": "^7.18.1",
  "better-sqlite3": "^13.0.1"
}
```

Round 1 (`lodash`, `markdown-it`, `linkify-it`) was low-risk because the same
dependency tree already proved the newer version works: `@tinacms/mdx` already
resolved `markdown-it@14.3.0`/`linkify-it@5.0.2` internally, and top-level `lodash`
was already `4.18.1` elsewhere in the tree — the override just makes the remaining
old copies (under `@graphql-codegen/*` and the `@graphiql/react` GraphQL-explorer UI
in `/admin`) match.

Round 2 (`brace-expansion`, `esbuild`, `react-dom`, `react-router`,
`react-router-dom`, `better-sqlite3`) cleared the rest except the `vite` chain below.
One correction was needed here: `esbuild` was initially set to `^0.28.1`, which
**broke `npm run tina:build`** for real —
`Transforming destructuring to the configured target environment ("chrome87",
"edge88", ... ) is not supported yet` while bundling the Mermaid.js diagram chunks
Tina's rich-text editor ships (abnf/pie diagrams). That esbuild version dropped
support for the old browser-target strings the bundled `vite@4.5.14` still configures.
The minimum version that both clears the CVE (vulnerable range `<=0.24.2`) and keeps
those targets working is **`0.25.0`** — fixed in `package.json`.

`brace-expansion@5.0.8` is a note-worthy exception: it's forced under
`minimatch@5.1.9`/`9.0.9`, which each declare `brace-expansion: ^2.0.x` — a real
semver-range violation. It works empirically (verified below) but is not a pairing
upstream ever tested; keep in mind if `minimatch`-adjacent glob-matching behavior
ever looks off.

**`better-sqlite3@13.0.1` broke the Docker/CI build, separately from all of the
above.** It's a C++ native addon (transitive, via `sqlite-level`); locally `npm ci`
succeeded silently because the host has a glibc prebuilt binary available, but
`docker build --target server` failed with:
```
npm error gyp ERR! find Python
npm error gyp ERR! stack Error: Could not find any Python installation to use
```
No prebuilt binary matches `node:22-alpine` (musl libc) for this version, so npm
falls back to compiling via `node-gyp`, which needs `python3`/`make`/`g++` — none of
which the `base` stage installed. **Fix, in `Dockerfile`:** split a new `deps` stage
that installs the build toolchain and runs `npm ci` there, then have `base` (which
`dev`/`server` both extend) `COPY --from=deps /app/node_modules ./node_modules`
instead of running `npm ci` itself — so the compiler toolchain never reaches the
image `server` actually ships. Verified: full `docker build --target server` build
succeeds; the final image has no `python3`/`make`/`g++` (`which` finds nothing);
`better-sqlite3`'s compiled binding loads and runs a real query inside the container;
and a full boot (clone → build → non-root nginx + Tina, both serving) still works
end-to-end, same as the earlier non-root verification.

**Verified end-to-end**, not just by a passing build exit code:
- `npm install` + `NODE_OPTIONS=--max-old-space-size=4096 npm run tina:build` (the
  exact command the Dockerfile and CI run) — clean, twice in a row.
- Booted `tina/server.mjs` directly against real content (the
  `templates/brand-content-example` set) with the new dependency graph: schema
  indexed into a fresh `better-sqlite3@13.0.1` file (via `sqlite-level`), backend
  came up, `POST /api/tina/gql` without credentials returned `401`, and a real
  authenticated GraphQL query (`pagesConnection { totalCount edges { node { id } } }`)
  returned correct data (4 pages, correct IDs) — proving the new `better-sqlite3`
  major, `react-dom`, and `react-router`/`react-router-dom` versions all work through
  the actual content-indexing and query path, not just that node modules load.

`npm audit` result: **27 → 3** findings (was 12 high / 3 moderate / 1 low; now
2 low / 1 high).

**What's still blocked, and why (tested, not assumed):** the 3 remaining findings
(`vite`, `@vitejs/plugin-react`, and `@tinacms/cli` itself, flagged transitively) all
trace to one node — `@tinacms/cli`'s own bundled `vite@4.5.14` (used to build the
`/admin` React SPA). Two targeted attempts to bump just that nested copy were tried
and both **broke `npm run tina:build`** with different errors:

- `vite@8.1.5` (matching our own top-level, already-proven version) → fails with
  `SyntaxError: The requested module 'vite' does not provide an export named
  'splitVendorChunkPlugin'` — `@tinacms/cli`'s compiled code imports an API vite
  removed in a later major.
- `vite@6.4.3` (the minimum version clearing the CVE ranges, still exporting
  `splitVendorChunkPlugin`) → fails differently, in esbuild's `define` handling:
  `Invalid define value (must be an entity name or JS literal)` while bundling
  `node_modules/react/index.js`.

Both are genuine incompatibilities in `@tinacms/cli`'s own compiled bundling code —
not something a smarter version choice on our end can route around.

**Residual risk assessment:** the blocked findings are all in `@tinacms/cli`'s
*build-time* admin-bundling step — it runs once per image build (`tina:build`, in the
Dockerfile) against this repo's own template code, not against attacker-supplied input
at runtime. Everything genuinely runtime-reachable (`markdown-it`/`linkify-it` in the
GraphiQL explorer panel of `/admin`, the SQLite content index, the React admin UI
itself) is now on patched versions and verified working.

**Action:** file/track an upstream issue with `tinacms/tinacms` referencing their own
bundled `vite` version; re-run `npm audit` after any `@tinacms/cli` release newer than
`2.5.6` lands and retry overriding `vite` then. Enable Dependabot/Renovate for ongoing
visibility so this is caught automatically rather than manually re-checked.

### 9. FOLLOW-UP — Enforce the CSP 📌

The CSP ships as `Content-Security-Policy-Report-Only` so it cannot break the TinaCMS
`/admin` SPA (React, likely inline scripts/styles). Report-Only blocks nothing.
**To enforce:** browse the site *and* `/admin` with DevTools open, tighten the policy
until there are zero violations (ideally dropping `'unsafe-inline'`), then rename the
header to `Content-Security-Policy` in `nginx.conf`.

### 10. HIGH (build) — `better-sqlite3` native addon broke the Docker/CI build ✅

**Where:** `Dockerfile` (`base` stage).

**Where it surfaced:** `docker build --target server` (and the equivalent CI step)
failing with `exit code: 1` on `npm install -g npm@11.6.2 && npm ci`. Not a security
finding in the traditional sense, but discovered directly as a consequence of
Finding 8's `better-sqlite3@13.0.1` override, and it blocks shipping any of this
hardening — so it's tracked here.

**Root cause (reproduced, not assumed):** `better-sqlite3` is a C++ native addon
(transitive dependency via `sqlite-level`, Tina's content-index storage). Locally,
`npm ci` succeeded silently because the host machine has a matching glibc prebuilt
binary; inside `node:22-alpine` (musl libc) no prebuilt binary matches, so npm falls
back to compiling via `node-gyp`, which needs `python3`/`make`/`g++` — none of which
the `base` stage installed:
```
npm error gyp ERR! find Python
npm error gyp ERR! stack Error: Could not find any Python installation to use
```

**Fix:** split a new `deps` stage that installs the build toolchain and runs
`npm ci` there; `base` (which `dev`/`server` both extend) now does
`COPY --from=deps /app/node_modules ./node_modules` instead of running `npm ci`
itself. This keeps the compiler toolchain out of the image that actually ships —
consistent with the non-root/attack-surface hardening from Finding 4: a C++ compiler
sitting in a container that also clones and builds untrusted brand content
(`entrypoint.sh`) is exactly the kind of extra capability worth not shipping.

**Verified:** full `docker build --target server` succeeds; the final image has no
`python3`/`make`/`g++` (`which` finds nothing); `better-sqlite3`'s compiled binding
loads and runs a real query inside the container; and a full boot (clone → build →
non-root nginx + Tina, both serving, correct headers) still works end-to-end.

---

## What is already solid (left as-is)

- **Auth** (`tina/auth.ts`): scrypt + `timingSafeEqual`, `WWW-Authenticate` challenge,
  fails closed if the admin env vars are missing.
- **No injection vectors:** `create-brand.mjs` and `entrypoint.sh` use `execFileSync`/
  array args (no shell), the GitHub token is passed via `http.extraHeader` (never
  URL-embedded — won't leak in `ps` or `.git/config`), and `set:html` is only ever fed
  `JSON.stringify` output or Zod-validated theme vars. No `fetch` to user-controlled
  URLs (no SSRF).
- **Secrets hygiene:** `.env`/`.env.production` gitignored and dockerignored; secrets
  blanked in generated `.env.example`; nothing sensitive committed to git.
- **Traefik:** `exposedByDefault=false` (a brand without the label can't leak), Docker
  socket mounted `:ro`, dashboard/API off, HTTP→HTTPS redirect.
- **CI:** short-lived `GITHUB_TOKEN` with minimal `contents:read`/`packages:write`,
  `npm ci` against a committed lockfile.
- **Isolation:** one container, `.env`, and volume per brand; `astro build` output and
  Tina SQLite are per-instance.

---

## Verification

The non-root + headers + auth changes were verified by building the `server` image and
booting it (prod profile equivalent) against a local content repo with a generated
password hash, on a fresh volume:

- Boot reached steady state: content cloned → `astro build` completed writing to the
  `appuser`-owned `/app/data` volume (no permission errors) → nginx + Tina both serving.
- `id` inside the container → `uid=1001(appuser)`; nginx master/workers **and** the Tina
  `tsx` process all run as `appuser`.
- `GET /` → `200` with `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Strict-Transport-Security`, `Content-Security-Policy-Report-Only`; `Server: nginx`
  with no version. Hashed `/_astro/` assets get `nosniff` + `immutable` cache.
- `POST /api/tina/gql` with no creds → `401` + `WWW-Authenticate`; wrong password → 401;
  wrong username → 401 (scrypt runs, uniform timing); valid creds → not 401 (auth
  passed).

Re-run locally with:

```sh
docker compose --profile prod up --build   # needs a .env with a content repo + hash
docker compose exec web id                 # expect uid=1001
curl -sI http://127.0.0.1:<debug-port>/    # expect the headers above, no Server version
# with prod ports removed, the site/API are reachable only through Traefik :443
```

---

## VPS deployment security checklist

- [ ] Host firewall: allow only 80/443 (Traefik) and your SSH port; do **not** expose
      container ports directly (the compose files no longer publish any).
- [ ] `docker network create edge` once per VPS; keep `exposedByDefault=false`.
- [ ] Each brand's `CONTENT_REPO_TOKEN` is a fine-grained PAT scoped to that one repo
      (Contents: read+write), never shared between brands.
- [ ] `TINA_ADMIN_PASSWORD_HASH` generated via `tina/scripts/hash-tina-password.mjs`;
      the plaintext password never stored in `.env`.
- [ ] `.env` files present only on the host, never committed; back them up out of band.
- [ ] Rotate the currently-live PAT in the local `.env` (Finding 7).
- [ ] Set `deploy.resources.limits` per brand (already in the compose files) so one
      brand's build/traffic spike can't starve the others.
- [ ] Keep an eye on npm-audit for a `@tinacms/cli` release newer than `2.5.6` that
      bundles a patched `vite` (Follow-up 8, down to 3 findings); validate and
      enforce the CSP (Follow-up 9).
- [ ] Consider Traefik access logging + a container restart policy (`unless-stopped`,
      already set) for auditability and resilience.
