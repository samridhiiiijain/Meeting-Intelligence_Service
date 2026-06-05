# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /app

# Prisma needs OpenSSL at generate/build time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
# `npm ci` runs postinstall (prisma generate); schema is already copied above.
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 8080
# Apply migrations on boot, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
