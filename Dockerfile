# syntax=docker/dockerfile:1

# ---- Base: shared deps layer ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
# npm@11 pin: ver comentário equivalente em ci.yml — node:22-alpine vem com
# npm 10, que não resolve de forma estável os fallbacks wasm32 opcionais
# desta árvore de deps. "npm ci" (não "npm install") pra a imagem publicada
# refletir exatamente o lockfile validado no CI, não o que o registry serve
# no momento do build.
RUN npm install -g npm@11.6.2 && npm ci

# ---- Development ----
# Runs `astro dev` with hot-reload; source code is bind-mounted via docker-compose.
FROM base AS dev
COPY . .
EXPOSE 4321
# --ignore-lock: each container is a fresh, isolated single-process
# environment — astro's dev-server lock file (astro/.astro/dev.json)
# survives on the bind-mounted host filesystem across container
# restarts, and since PID namespaces reset per-container, the new
# process deterministically reuses the old lock's PID, making astro
# falsely believe a live instance is still running. There's no real
# concurrent-instance risk to protect against inside a container, so
# skip the check entirely instead of relying on --force (which would
# send a kill signal to whatever unrelated process holds that PID).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--ignore-lock"]

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
# Schema do Tina (tina/schema.ts) e template-owned, nao depende de conteudo
# de marca nenhuma — gerar aqui, uma vez por imagem, em vez de a cada boot
# de container. TINA_PUBLIC_IS_LOCAL=true (dentro do script "tina:build")
# evita um bug de bundling do @tinacms/cli com adapters custom (sqlite-level)
# que so aparece indo por esse caminho; o backend real (tina/database.ts,
# SQLite + GitHub por marca) so roda depois, via tina/server.mjs no boot do
# container — ver entrypoint.sh. O heap maior e necessario mesmo pra
# conteudo minimo (medido ~2-4GB no build do schema + bundle do admin UI).
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run tina:build
# CI publica "latest"/"sha-<commit>" em TODO push pro main (ver
# .github/workflows/ci.yml), a maioria sem bump de package.json "version" —
# sem isso, o carimbo de build (entrypoint.sh) so muda quando ALGUEM lembra
# de bumpar a versão, e um rollback pra uma tag anterior com a MESMA versão
# no package.json não dispara rebuild nenhum: o site continua servindo o
# dist da imagem nova (confirmado: é exatamente o bug que rollback existe
# pra resolver). TEMPLATE_BUILD_ID (default: a própria "version", pra
# "docker build" local sem o --build-arg continuar funcionando como antes)
# da à imagem uma identidade única por commit, não por bump manual. Fica
# DEPOIS do "RUN npm run tina:build" (~48s) de proposito: como ARG/ENV muda
# a cada commit, colocar antes do RUN invalidaria o cache desse passo em
# toda publicação — só é lido em runtime pelo entrypoint.sh, não no build.
ARG TEMPLATE_BUILD_ID
ENV TEMPLATE_BUILD_ID=${TEMPLATE_BUILD_ID}
EXPOSE 80 4001
ENTRYPOINT ["/entrypoint.sh"]
