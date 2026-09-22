FROM node:22-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
 && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

COPY package.json \
     pnpm-lock.yaml \
     pnpm-workspace.yaml \
     ./

COPY apps/api/package.json \
     apps/api/package.json

COPY apps/storefront/package.json \
     apps/storefront/package.json

COPY apps/admin/package.json \
     apps/admin/package.json

COPY packages/shared/package.json \
     packages/shared/package.json

RUN pnpm install \
    --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter storefront build

ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

EXPOSE 3100

CMD ["pnpm", "--filter", "storefront", "start"]
