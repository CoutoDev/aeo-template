# Proxy compartilhado (Traefik)

Infraestrutura da VPS, não de uma marca. Roda **uma vez** por VPS —
independente de quantas instâncias `brand-engine` rodam atrás dele. É o
único serviço que publica as portas 80/443 do host.
Ele descobre os containers de cada marca pela rede Docker `edge` e pelas labels
`traefik.*` já presentes no `docker-compose.yml` do template, e emite e renova
o certificado Let's Encrypt de cada domínio automaticamente.

## Deploy (uma vez por VPS)

```bash
docker network create edge
cp traefik/.env.example traefik/.env   # edite ACME_EMAIL
cd traefik
docker compose up -d
```

## Por marca

Cada instância precisa de duas coisas — preencha `DOMAIN` e `BRAND_SLUG` no
`.env` dela (veja `.env.example` na raiz do template).

1. `DOMAIN` apontando via DNS (registro A) para o IP desta VPS.
2. `docker compose --profile prod up -d` dentro da pasta da instância.

O Traefik detecta o container pela label `traefik.enable=true` e emite o
certificado na primeira requisição HTTPS ao domínio. Quando uma marca nova
entra no ar, o Traefik a atende sem reinício.
