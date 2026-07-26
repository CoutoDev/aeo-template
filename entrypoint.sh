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

# CONTENT_REPO_TOKEN nao entra aqui: so e exigido na primeira escrita real
# pelo Tina (ver tina/database.ts), nao pra ler/servir o site.
for var in SITE_NAME SITE_URL SITE_DESCRIPTION BRAND_SLUG CONTENT_REPO_URL \
  TINA_ADMIN_USER TINA_ADMIN_PASSWORD_HASH; do
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

log "Subindo backend do Tina..."
# Chama o binario direto (nao "npm run tina:server"): "npm run" interpoe um
# processo wrapper, entao $! capturaria o PID do npm, nao do processo real —
# e "wait" abaixo nunca notaria o backend do Tina caindo de verdade.
CONTENT_DIR="$CONTENT_DIR" \
  TINA_SQLITE_PATH="${TINA_SQLITE_PATH:-$DATA_DIR/tina.sqlite}" \
  "$APP_DIR/node_modules/.bin/tsx" "$APP_DIR/tina/server.mjs" &
TINA_PID=$!

log "Subindo nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

# De proposito NAO faz "exec nginx": este script continua como PID 1 do
# container, responsavel por repassar sinais e colher (reap) os processos
# filhos — nginx sozinho como PID 1 nao faz esse papel de init, o que deixa
# processos zumbis pra tras e quebra a deteccao de queda do backend do Tina
# abaixo (confirmado testando).
#
# shutting_down + "|| true": sem a flag, um "docker stop" so seria notado na
# proxima vez que o loop abaixo acordasse do "sleep 1" (ate 1s de atraso, OK)
# — mas se o Tina ja tivesse caido antes, "kill $TINA_PID" aqui falha (ESRCH)
# e, com "set -e" ativo no momento em que o trap dispara, abortaria o script
# com o status generico do kill em vez de seguir pro "wait $NGINX_PID" e
# reportar o exit code real do nginx (mesma classe de bug do "kill" no final
# do script, ver comentario la embaixo). Confirmado testando com "docker
# stop": sem isso, o container so morria no timeout (SIGKILL, exit 137) em
# vez de sair logo que o nginx atende o SIGTERM.
shutting_down=0
trap 'shutting_down=1; kill $TINA_PID $NGINX_PID 2>/dev/null || true' TERM INT

# "wait" so funciona pro pai DIRETO de um processo (regra do proprio
# waitpid(2), nao so do shell) — colocar o "wait $TINA_PID" numa subshell
# em background (padrao anterior, "( wait ... ) &") quebra silenciosamente:
# a subshell e IRMA de TINA_PID, nao mae, entao esse wait falha na hora com
# "not a child of this shell" (codigo 127 no ash/dash) em vez de bloquear
# de verdade — confirmado testando: o aviso de queda aparecia ~2s depois de
# TODO boot, mesmo com o Tina saudavel e respondendo normalmente. Por isso
# os dois "wait" abaixo rodam os DOIS no processo principal (unico que e
# pai de verdade de ambos), usando /proc pra descobrir quem morreu primeiro
# sem bloquear no PID errado.
is_running() {
  [ -r "/proc/$1/status" ] || return 1
  ! grep -q '^State:[[:space:]]*Z' "/proc/$1/status" 2>/dev/null
}

# Tina e nginx sao independentes de proposito: o site estatico e o que
# precisa ficar no ar de verdade (mesma logica de "build quebrado nao
# derruba o site" acima) — se o backend do Tina cair (token expirado,
# GitHub fora do ar, etc.), so a edicao fica indisponivel, o site publicado
# continua servindo normalmente. So loga, nao mata nginx nem derruba o
# container por causa disso.
#
# "sleep 1" primeiro, so depois checa: o loop comeca a rodar logo apos os
# "&" que sobem tina/nginx, antes de qualquer um dos dois processos ter
# terminado de subir — checar is_running imediatamente arriscaria um falso
# negativo (ainda sem /proc/$PID/status) e derrubaria o container achando
# que o nginx morreu no proprio boot.
tina_logged=0
while [ "$shutting_down" -eq 0 ]; do
  sleep 1
  is_running "$NGINX_PID" || break
  if [ "$tina_logged" -eq 0 ] && ! is_running "$TINA_PID"; then
    set +e
    wait "$TINA_PID"
    tina_exit_code=$?
    set -e
    # Escreve num arquivo, nao só stdout: um `echo` de um subprocesso em
    # background as vezes nao aparece em `docker logs` (timing da captura de
    # stdout do container) — o arquivo fica disponivel mesmo assim pra
    # inspecionar via `docker exec`/healthcheck.
    echo "$(date -Iseconds) backend do Tina encerrou (codigo $tina_exit_code)" >> "$DATA_DIR/.tina-crashes.log"
    log "AVISO: backend do Tina encerrou (codigo $tina_exit_code). O site estatico continua no ar; edicao via /admin fica indisponivel ate o proximo boot."
    tina_logged=1
  fi
done

# nginx morreu (saiu do loop acima): o script termina e o container sai
# (deixa o restart policy do Docker reiniciar tudo) — um site fora do ar de
# verdade nao deve ficar "meio no ar" silenciosamente.
set +e
wait "$NGINX_PID"
exit_code=$?
set -e
log "nginx encerrou (codigo $exit_code), derrubando o container."
# "|| true": se o Tina ja tiver caido antes (caso comum — ver loop acima),
# esse kill falha (ESRCH) e, com "set -e" ainda ativo aqui, abortaria o
# script ANTES do "exit $exit_code" abaixo — o container sairia com o
# status generico do kill (1) em vez do exit code real do nginx (confirmado
# testando: nginx saindo com codigo 0 virava container "Exited (1)").
kill "$TINA_PID" 2>/dev/null || true
exit "$exit_code"
