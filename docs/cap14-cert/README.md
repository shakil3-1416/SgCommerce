# CAP-14 certification environment (branch `cap14-cert`)

This is an isolated SGCommerce deployment that SupGent's live capability certification (CAP-14) reads from and, later, writes to. It never shares a database, Redis, secrets, payment credentials or Blob store with the production shop. It is never merged into `main`.

| Project | Root | Branch | Template |
|---|---|---|---|
| `sgc-cert-api` | `apps/api` | `cap14-cert` | `sgc-cert-api.env.example` |
| `sgc-cert-admin` | `apps/admin` | `cap14-cert` | `sgc-cert-admin.env.example` |
| `sgc-cert-storefront` | `apps/storefront` | `cap14-cert` | `sgc-cert-storefront.env.example` |

All three use Node 22.x, the repository's normal build (the same settings as the production projects; see `docs/VERCEL_DEPLOYMENT.md`), and "Include source files outside of the Root Directory" enabled.

`MONGODB_URI`, `REDIS_URL` and `AUTH_SECRET` must be new certification values. The cert API sets `API_ENVIRONMENT=test`, so Developer API keys are `sg_test_…` and work only there. It has no SSLCommerz credentials: online payment is unavailable, and cash on delivery is the only method. SGCommerce has no courier integration.

## 1. Production protection (do this BEFORE pushing `cap14-cert`)

The existing production Vercel projects build every pushed branch as a Preview deployment, using their own Preview environment. A pushed `cap14-cert` must not be built there.

For each existing production project (storefront, admin, API):

- [ ] Open **Settings → Git → Ignored Build Step**, choose a custom command, and enter:
  `if [ "$VERCEL_GIT_COMMIT_REF" = "cap14-cert" ]; then exit 0; else exit 1; fi`
  Exit 0 skips the build; exit 1 builds as usual.
- [ ] Save, and confirm that the production branch is still `main`.
- [ ] Confirm that none of the production projects' environment variables were copied into the cert projects.

Only after all three production projects show the ignore rule may `cap14-cert` be pushed.

## 2. Data plane

- **MongoDB:** a database named `sgcommerce_cap14_cert` (any name containing `cap14_cert` works; the seed refuses anything else). Give it a database user with `readWrite` on that database only. A separate Atlas project or cluster is preferred. Never copy production data.
- **Redis:** a separate Redis database. The API has no key prefix support, so a separate database is the only isolation.

## 3. Seed the certification data

```bash
# From the repository root, with the CERT database URI (never production):
MONGODB_URI='<cert uri>/sgcommerce_cap14_cert' pnpm --filter api seed:admin
MONGODB_URI='<cert uri>/sgcommerce_cap14_cert' pnpm --filter api seed:cap14-cert
# Re-runs are idempotent. To restore the known fixture state (deletes ONLY CAP14-CERT-* fixtures first):
MONGODB_URI='<cert uri>/sgcommerce_cap14_cert' pnpm --filter api seed:cap14-cert -- --reset
```

The seed checks the database name before connecting and again before any write. It writes only `CAP14-CERT-*` / `cap14-cert-*` documents and calls nothing but MongoDB.

The fixtures are listed in `apps/api/src/cap14-cert/cap14-cert-manifest.json`; regenerate it with `pnpm --filter api cap14:manifest apps/api/src/cap14-cert/cap14-cert-manifest.json`. Tests: `pnpm --filter api test:cap14-cert`. Add `CAP14_TEST_MONGODB_URI=mongodb://127.0.0.1:<port>` (loopback only) for the database tests.

## 4. Read-only oracle key (on the CERT admin only)

Open `<sgc-cert-admin>/developers`, choose **New application**, tick only `products:read`, `inventory:read`, `customers:read`, `orders:read`, `payments:read`, `returns:read` and `refunds:read`, then choose **Create application**. The key starts with `sg_test_` and is shown once. Store it only in the local SupGent certification environment:

```
SGCOMMERCE_ORACLE_BASE_URL=https://<sgc-cert-api-domain>/api/v1
SGCOMMERCE_ORACLE_API_KEY=<sg_test_… never committed, never printed>
```

Create a second, separate cert key (also read-only) for SupGent's Custom REST connection. Never create either key in the production admin.
