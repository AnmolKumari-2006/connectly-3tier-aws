# =============================================================================
#  Connectly web: TIER 1 (presentation) container image
#  Build:  docker build -t connectly-web ./frontend
#
#  Stage 1 builds the React app; stage 2 is a small Nginx image that serves
#  the build and forwards /api and /uploads to the application tier.
# =============================================================================

# ---- Stage 1: build the React app -------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: serve it with Nginx (runs as a non-root user) -----------------
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Address of the application tier, rendered into the Nginx config at start.
ENV APP_UPSTREAM=app:4000

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1
