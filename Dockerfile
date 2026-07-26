# syntax=docker/dockerfile:1

# ---- Base: shared deps layer ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# ---- Development ----
# Runs `astro dev` with hot-reload; source code is bind-mounted via docker-compose.
FROM base AS dev
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- Server: runtime image for a single brand instance ----
# Unlike a typical static-site image, no brand content is known at image
# build time (see entrypoint.sh) — the real `astro build` runs at container
# boot, after the brand's content repo is cloned. So this stage carries the
# full Node/Astro toolchain *and* nginx together, instead of splitting
# build/serve across stages the way a content-baked-in image would.
FROM base AS server
RUN apk add --no-cache nginx git
COPY . .
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
