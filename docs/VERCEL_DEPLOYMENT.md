# SgCommerce Vercel Deployment

SgCommerce is deployed from one GitHub monorepo as three independent
Vercel projects.

## Projects

### 1. Storefront

Root Directory:

`apps/storefront`

Framework:

Next.js

Production environment:

- `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1`
- `INTERNAL_API_URL=https://api.<domain>/api/v1`
- `CUSTOMER_COOKIE_SECURE=true`

Recommended production domain:

`shop.<domain>` or the apex domain.

Customer authentication is handled by the storefront BFF. The Nest API bearer token is stored in a Secure, HttpOnly, SameSite=Lax host-only cookie and is never exposed to browser JavaScript.

### 2. Admin

Root Directory:

`apps/admin`

Framework:

Next.js

Production environment:

- `API_URL=https://api.<domain>/api/v1`
- `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1`
- `ADMIN_COOKIE_SECURE=true`

Recommended production domain:

`admin.<domain>`

Do not expose admin credentials through environment variables in the
browser. Admin credentials are stored in the application database.

### 3. API

Root Directory:

`apps/api`

Framework:

NestJS / Node.js

Production environment:

- `NODE_ENV=production`
- `AUTH_SECRET=<strong-random-secret>`
- `MONGODB_URI=<managed-production-mongodb-uri>`
- `REDIS_URL=<managed-production-redis-uri>`
- `CORS_ALLOWED_ORIGINS=https://<storefront-domain>,https://<admin-domain>`
- `ENABLE_HSTS=true`
- `TRUST_PROXY=true`

Recommended production domain:

`api.<domain>`

## Runtime requirements

Use Node.js 22.x for all three projects.

MongoDB and Redis must be externally managed services in Vercel
production. The Docker Compose MongoDB and Redis services are for local
or self-hosted environments only.

Recommended providers:

- MongoDB Atlas
- Redis Cloud or another managed Redis service compatible with `ioredis`

## Vercel monorepo settings

Import the same GitHub repository three times and select the appropriate
Root Directory for each project.

Keep "Include source files outside of the Root Directory" enabled so
workspace dependencies remain available.

Production branch:

`main`

Every pull request should receive Preview deployments. Production
deployments should originate from `main`.

## Deployment order

1. Provision production MongoDB.
2. Provision production Redis.
3. Deploy API.
4. Verify `/api/v1/health`.
5. Deploy storefront using the API production URL.
6. Deploy admin using the API production URL.
7. Configure API CORS with the final storefront and admin origins.
8. Redeploy API.
9. Attach production domains.
10. Run post-deployment browser acceptance.
11. Tag the verified commit as `v1.0.0`.

## Production gate

Do not promote to production unless:

- GitHub CI is green.
- API health is green.
- customer regression suite passes.
- admin regression suite passes.
- production environment contains no localhost URLs.
- MongoDB backup policy exists.
- Redis persistence/provider policy is understood.
- `AUTH_SECRET` is production-only and rotated from development.
- admin cookie is Secure.
- HTTPS is active on every public domain.
