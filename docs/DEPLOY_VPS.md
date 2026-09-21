# Deploy na VPS

`estudos.bssaude.com.br` → `64.181.212.218` (host SSH `oraclevps2`, usuário `opc`).

## Como está montado

```
/opt/projects/bsenem/              # clone do repo, montado no container
├── deploy/nginx.conf              # -> /etc/nginx/conf.d/default.conf
├── deploy/estudos.bssaude.com.br.conf # virtual host TLS do Nginx da VPS
├── releases/<sha>/                # um diretório por build publicado
│   └── index.html, assets/, ...
└── current -> releases/<sha>      # root do nginx
```

O container `deploy-frontend-1` (nginx:alpine) monta `/opt/projects/bsenem` em
`/var/www/bsenem` e serve `/var/www/bsenem/current`. O `deploy-api-1`
(php:8.2-cli) atende `/api/`. O Nginx externo usa somente
`deploy/estudos.bssaude.com.br.conf`, termina TLS, aplica os headers de segurança
e encaminha para `127.0.0.1:8081`. O `deploy/nginx.conf` é exclusivamente a
configuração interna do container frontend. Não instale os dois arquivos no
mesmo diretório de virtual hosts.

Antes de recarregar uma alteração de proxy, valide no host:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

**A VPS não tem Node instalado.** O build é feito na máquina de quem publica e
o `dist/` é copiado para `releases/<sha>`.

## Publicar

```bash
bash scripts/deploy-vps.sh
```

O script se recusa a publicar com a árvore suja, builda sem `BASE_PATH` (a VPS
serve na raiz do domínio), envia o `dist/`, troca o symlink `current`, recarrega
o nginx e confere o HTTP da home.

## Rollback

```bash
bash scripts/deploy-vps.sh --rollback
```

Volta o symlink para o release gravado em `releases/.previous`. Os releases
antigos ficam no disco, então dá para apontar para qualquer um na mão:

```bash
ssh oraclevps2 'sudo ln -sfn /opt/projects/bsenem/releases/<sha> /opt/projects/bsenem/current'
ssh oraclevps2 'sudo docker exec deploy-frontend-1 nginx -s reload'
```

## O que este fluxo NÃO faz

- **Não atualiza o backend.** O clone em `/opt/projects/bsenem` está parado num
  commit antigo (`b1ac23a`) e com a árvore de trabalho mexida por cópia direta
  de arquivos, fora do git. Atualizar o PHP exige reconciliar isso à mão e rodar
  as migrações contra o SQLite de produção (`backend/database/bsenem.db`, que é
  untracked e tem backups em `backups/`). Não faça por cima sem backup.
- **Não publica no GitHub Pages.** O deploy de Pages foi removido do workflow: o
  `public/manifest.json` e os ícones usam caminho absoluto (`/`), que é correto
  na raiz do domínio e quebrava sob `/bsenem/`. O site antigo do Pages continua
  no ar servindo o último build publicado até alguém desligar o Pages nas
  configurações do repositório.
- **Não registra service worker.** Existe um `sw.js` na raiz do repo, mas nada
  no `src/` o registra — hoje o app não é um PWA offline de fato.
