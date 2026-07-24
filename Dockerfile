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

# ---- Build: produces the static site in /app/dist ----
FROM base AS build
COPY . .
RUN npm run build

# ---- Production: serves the static build with Nginx ----
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
