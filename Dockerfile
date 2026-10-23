# syntax=docker/dockerfile:1
# Production image: the API serves the built web app on a single origin.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
# argon2 ships prebuilt binaries; rebuild only runs install scripts skipped above.
RUN npm rebuild argon2 \
 && npm run build:shared \
 && npm run prisma:generate -w @referloop/api \
 && npm run build -w @referloop/api \
 && npm run build -w @referloop/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Keep the Prisma CLI (dev dependency) so migrations can run on start-up.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
# Sources are only needed for the optional seed script (`npx tsx prisma/seed.ts`).
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 4000
WORKDIR /app/apps/api
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
