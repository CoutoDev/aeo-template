# syntax=docker/dockerfile:1

# ---- Deps: stage-only build toolchain for native modules (better-sqlite3) ----
# better-sqlite3 (transitive, via sqlite-level) is a C++ addon: no prebuilt
# binary matches this image, so npm falls back to compiling it with node-gyp,
# which needs python3/make/g++ (confirmed: "npm ci" fails on plain
# node:22-alpine with "Could not find any Python installation"). Isolated in
# its own stage on purpose, NOT added to `base` directly — a compiler
# toolchain is exactly what you don't want present in the final image, since
# `server` also clones and builds untrusted brand content at boot (see
# entrypoint.sh); `base` below only copies the already-built node_modules out
# of here, so python3/make/g++ never reach dev/server.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm@11 pin: ver comentário equivalente em ci.yml — node:22-alpine vem com
# npm 10, que não resolve de forma estável os fallbacks wasm32 opcionais
# desta árvore de deps. "npm ci" (não "npm install") pra a imagem publicada
# refletir exatamente o lockfile validado no CI, não o que o registry serve
# no momento do build.
RUN apk add --no-cache python3 make g++ \
 && npm install -g npm@11.6.2 && npm ci

# ---- Base: shared deps layer ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules

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
# Usuario nao-root pra rodar o container (defesa em profundidade: um bug de
# execucao no nginx, no backend do Tina ou no proprio `astro build` — que roda
# sobre conteudo clonado de um repo de marca — nao roda como root dentro do
# container). uid/gid fixo 1001 de proposito: o volume nomeado `data`, quando
# criado VAZIO, herda o dono do /app/data que existe na imagem (ver chown
# abaixo), entao esse uid precisa ser estavel. nginx como nao-root precisa dos
# seus dirs de runtime graváveis pelo appuser (o pid vai pra /tmp via `nginx -g`
# no entrypoint.sh, evitando o /run/nginx root-only do default compilado).
RUN addgroup -g 1001 -S appuser \
 && adduser -u 1001 -S -G appuser appuser \
 && chown -R appuser:appuser /var/lib/nginx /var/log/nginx
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
# /app inteiro precisa ser gravavel pelo appuser: no boot, o entrypoint.sh
# troca o symlink astro/src/content, roda `astro build` (que escreve caches em
# .astro/, node_modules/.vite, etc.) e grava o dist no volume /app/data. Criar
# /app/data com dono appuser ANTES do volume ser montado faz o volume nomeado,
# quando vazio, subir ja com esse dono (senao subiria como root e o build nao
# escreveria). chown -R DEPOIS do ultimo passo que escreve em /app como root
# (o tina:build acima) — invalidar o cache desse passo aqui nao importa.
RUN mkdir -p /app/data && chown -R appuser:appuser /app
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
# nginx escuta em 8080 (nao 80): rodando como nao-root, o processo nao pode
# bindar portas <1024. Interno ao container — o Traefik roteia pra 8080 via
# label (ver docker-compose*.yml, loadbalancer.server.port=8080). O backend do
# Tina (4001) fica acima de 1024, entao nao muda.
EXPOSE 8080 4001
USER appuser
ENTRYPOINT ["/entrypoint.sh"]
