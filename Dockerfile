# build the frontend and compile the backend
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# vite bakes VITE_* variables into the bundle at build time
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build && npm prune --omit=dev

# runtime image: production dependencies and build output only
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/backend/build ./backend/build
USER node
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:5001/api/health || exit 1
CMD ["node", "backend/build/index.js"]
