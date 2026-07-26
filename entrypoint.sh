#!/bin/sh
# Entrypoint da imagem "brand-engine": a imagem nao carrega conteudo de
# nenhuma marca especifica (ver README) — este script busca o conteudo real
# no boot, decide se precisa reconstruir o site, e sobe o nginx.
#
# Idempotente e seguro de rodar a cada boot do container: se o conteudo
# clonado tem o mesmo commit do ultimo build, o build inteiro (npm run
# build) e pulado e o boot fica rapido. Só o primeiro boot de uma marca, ou
# um boot depois de conteudo novo (edicao via Tina + push), paga o custo de
# um `astro build` completo.
set -eu

log() {
  echo "[entrypoint] $*"
}

require_env() {
  eval "value=\${$1:-}"
  if [ -z "$value" ]; then
    log "ERRO: variavel de ambiente obrigatoria '$1' nao definida. Veja .env.example."
    exit 1
  fi
}

for var in SITE_NAME SITE_URL SITE_DESCRIPTION BRAND_SLUG CONTENT_REPO_URL; do
  require_env "$var"
done

APP_DIR="/app"
# Precisa ficar DENTRO de $APP_DIR (não em /data na raiz): o build do Astro
# só usa outDir diretamente pro staging interno (.prerender/) quando outDir
# está sob o cwd — caso contrário cai num fallback dentro de $APP_DIR/.astro
# e o rename(2) final entre os dois falha com EXDEV (filesystems/volumes
# diferentes). Mantendo tudo dentro de $APP_DIR/data, staging e outDir final
# caem no mesmo volume montado e o rename funciona. Verificado manualmente
# antes desta implementação.
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
CONTENT_DIR="$DATA_DIR/content"
BUILD_OUT_DIR="$DATA_DIR/dist"
STAMP_FILE="$DATA_DIR/.built-content-sha"

mkdir -p "$DATA_DIR"

# Sempre um clone raso e fresco: o conteudo real vive no GitHub da marca, o
# checkout local em $CONTENT_DIR e so um cache de leitura. Descartar e
# re-clonar a cada boot evita logica de fetch/rebase e reconcilia sozinho
# qualquer estado estranho deixado por uma execucao anterior.
log "Clonando conteudo da marca em $CONTENT_DIR..."
rm -rf "$CONTENT_DIR"
git clone --depth 1 --quiet "$CONTENT_REPO_URL" "$CONTENT_DIR"

# O carimbo precisa identificar conteudo + versao do template juntos: numa
# troca de imagem (nova tag do brand-engine), o volume /data sobrevive mas o
# codigo do template mudou — se o carimbo comparasse só o sha do conteudo,
# uma atualização de template com o MESMO conteúdo pularia o build e
# continuaria servindo o dist antigo, da imagem anterior, silenciosamente.
TEMPLATE_VERSION=$(grep -m1 '"version"' "$APP_DIR/package.json" | sed -E 's/.*"version": *"([^"]+)".*/\1/')
CURRENT_SHA=$(git -C "$CONTENT_DIR" rev-parse HEAD)
CURRENT_STAMP="${CURRENT_SHA}:${TEMPLATE_VERSION}"
BUILT_STAMP=""
if [ -f "$STAMP_FILE" ]; then
  BUILT_STAMP=$(cat "$STAMP_FILE")
fi

# Content Layer do Astro (glob() em src/content.config.ts) resolve
# corretamente atraves de um symlink — verificado manualmente antes desta
# implementacao. IMPORTANTE: src/content precisa ser removido antes — "ln
# -sfn" com um diretorio real (ex: o conteudo de exemplo empacotado na
# imagem) cria o symlink DENTRO dele em vez de substitui-lo, e o build
# acaba lendo o conteudo antigo em silencio.
rm -rf "$APP_DIR/src/content"
ln -sfn "$CONTENT_DIR" "$APP_DIR/src/content"

if [ "$CURRENT_STAMP" = "$BUILT_STAMP" ] && [ -d "$BUILD_OUT_DIR" ]; then
  log "Conteudo e versao do template sem mudanca ($CURRENT_STAMP), pulando build."
else
  log "Conteudo novo, primeiro boot, ou template atualizado ($CURRENT_STAMP), rodando build..."
  # Se o build falhar e ja existe um dist anterior no volume, prefere manter
  # o site no ar servindo a ultima versao boa a derrubar tudo por causa de
  # um commit de conteudo quebrado (ex: frontmatter invalido) — um editor
  # sem contexto tecnico pode empurrar um commit assim via Tina. O carimbo
  # NAO e atualizado, entao o proximo boot tenta de novo.
  set +e
  (cd "$APP_DIR" && npm run build -- --outDir "$BUILD_OUT_DIR")
  build_status=$?
  set -e
  if [ "$build_status" -ne 0 ]; then
    if [ -d "$BUILD_OUT_DIR" ]; then
      log "ERRO: build falhou (status=$build_status). Mantendo o ultimo build valido no ar."
    else
      log "ERRO: build falhou (status=$build_status) e nao ha build anterior pra servir. Abortando."
      exit 1
    fi
  else
    echo "$CURRENT_STAMP" > "$STAMP_FILE"
    log "Build concluido."
  fi
fi

log "Subindo nginx..."
exec nginx -g "daemon off;"
