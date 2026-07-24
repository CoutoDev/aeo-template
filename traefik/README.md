# Proxy compartilhado (Traefik)

Infraestrutura da VPS, não de uma marca. Roda **uma vez** por VPS — não é
copiado nem duplicado por instância gerada via `create-brand-site` (o CLI
exclui esta pasta do scaffold de propósito). É o único serviço que publica
as portas 80/443 do host; ele descobre os containers de cada marca pela rede
Docker `edge` e pelas labels `traefik.*` já presentes no `docker-compose.yml`
do template, e emite/renova certificado Let's Encrypt automaticamente por
domínio.

## Deploy (uma vez por VPS)

```bash
docker network create edge
cp traefik/.env.example traefik/.env   # edite ACME_EMAIL
cd traefik
docker compose up -d
```

## Por marca

Cada instância só precisa de duas coisas no seu `.env` (o CLI já cuida
disso ao criar a instância — ver `DOMAIN`/`BRAND_SLUG` em `.env.example` na
raiz do template):

1. `DOMAIN` apontando via DNS (registro A) para o IP desta VPS.
2. `docker compose --profile prod up -d` dentro da pasta da instância.

O Traefik detecta o container automaticamente pela label `traefik.enable=true`
e emite o certificado na primeira requisição HTTPS pro domínio — não precisa
reiniciar o Traefik quando uma marca nova entra no ar.
