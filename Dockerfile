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
RUN apk add --no-cache nginx git bash
COPY . .
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Schema do Tina (tina/schema.ts) e template-owned, nao depende de conteudo
# de marca nenhuma — gerar aqui, uma vez por imagem, em vez de a cada boot
# de container. TINA_PUBLIC_IS_LOCAL=true (dentro do script "tina:build")
# evita um bug de bundling do @tinacms/cli com adapters custom (sqlite-level)
# que so aparece indo por esse caminho; o backend real (tina/database.ts,
# SQLite + GitHub por marca) so roda depois, via tina/server.mjs no boot do
# container — ver entrypoint.sh. O heap maior e necessario mesmo pra
# conteudo minimo (medido ~2-4GB no build do schema + bundle do admin UI).
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run tina:build
EXPOSE 80 4001
ENTRYPOINT ["/entrypoint.sh"]
