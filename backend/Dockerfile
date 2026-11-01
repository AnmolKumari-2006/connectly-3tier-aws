# =============================================================================
#  Connectly API: TIER 2 (application) container image
#  Build:  docker build -t connectly-app ./backend
# =============================================================================
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies first. This layer is cached and only
# rebuilt when package.json / package-lock.json change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code (see .dockerignore for what is left out).
COPY . .

# Upload folders must be writable by the non-root "node" user that runs the app.
RUN mkdir -p uploads/avatars uploads/covers uploads/posts uploads/stories \
 && chown -R node:node /app/uploads

USER node
EXPOSE 4000

# Healthy only when the API answers AND can reach PostgreSQL (see /api/health).
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# On start the server waits for the database, creates/updates the tables and
# loads demo data only if the database is empty (see server.js).
CMD ["node", "server.js"]
