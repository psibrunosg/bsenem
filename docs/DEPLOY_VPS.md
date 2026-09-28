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

O `deploy-api-1` roda o PHP direto do clone em `/opt/projects/bsenem`, e as
migrações rodam no primeiro request que abre o banco. Por isso, publicar o
backend é um `git pull` no clone. O frontend vai pelo script. Com a `main` local
em dia e limpa:

1. **Backup do banco** (antes de qualquer release com migração):

   ```bash
   ssh oraclevps2 'cd /opt/projects/bsenem && T=backups/bsenem.pre-<tarefa>-$(date +%Y%m%d-%H%M%S) && sudo mkdir -p $T && sudo cp -p backend/database/bsenem.db* $T/'
   ```

2. **Backend:**

   ```bash
   ssh oraclevps2 'cd /opt/projects/bsenem && git pull --ff-only origin main'
   ```

3. **Frontend:**

   ```bash
   bash scripts/deploy-vps.sh
   ```

   O script se recusa a publicar com a árvore suja, builda sem `BASE_PATH` (a VPS
   serve na raiz do domínio), envia o `dist/`, troca o symlink `current`,
   recarrega o nginx e confere o HTTP da home. Os avisos do `tar` sobre
   "time stamp in the future" vêm da diferença de relógio e são inofensivos.

4. **Conferir:** a home responde 200, e `/api/auth/me` sem login responde 401.
   Veja `sudo docker logs --since 5m deploy-api-1` e, logado, a tela afetada.
   Ler o banco de produção é bloqueado no modo automático do Claude Code.

## Rollback

Frontend:

```bash
bash scripts/deploy-vps.sh --rollback
```

Backend: volte o clone para o commit anterior e, se a release tinha migração,
restaure o banco do backup do passo 1 com a API parada:

```bash
ssh oraclevps2 'cd /opt/projects/bsenem && git checkout <sha-anterior>'
```

Volta o symlink para o release gravado em `releases/.previous`. Os releases
antigos ficam no disco, então dá para apontar para qualquer um na mão:

```bash
ssh oraclevps2 'sudo ln -sfn /opt/projects/bsenem/releases/<sha> /opt/projects/bsenem/current'
ssh oraclevps2 'sudo docker exec deploy-frontend-1 nginx -s reload'
```

## Atualizar o backend

`scripts/deploy-vps.sh` publica só o frontend. A API (`deploy-api-1`) monta o
clone `/opt/projects/bsenem` diretamente: qualquer arquivo alterado ali entra em
produção na hora, e as migrações rodam na primeira conexão ao banco. Desde
2026-09-23 o clone acompanha o `main` pelo git (sem cópias manuais).

Publique o backend **antes** do frontend quando o frontend depender de rotas
novas, sempre com backup:

```bash
ssh oraclevps2 'set -e; cd /opt/projects/bsenem; TS=$(date -u +%Y%m%dT%H%M%SZ); B=backups/deploy-$TS; mkdir -p $B; git rev-parse HEAD > $B/HEAD.txt; sudo chmod 777 $B; sudo docker exec deploy-api-1 php -r "(new PDO(\"sqlite:/var/www/bsenem/backend/database/bsenem.db\"))->exec(\"VACUUM INTO \x27/var/www/bsenem/$B/bsenem.db\x27\");"; sudo chmod 755 $B; echo $B'
```

```bash
ssh oraclevps2 'set -e; cd /opt/projects/bsenem; git fetch -q origin; sudo docker stop deploy-api-1; git checkout -q -f -B main origin/main; sudo docker start deploy-api-1; sudo docker exec -w /var/www/bsenem deploy-api-1 php -r "require \"backend/config/database.php\"; require \"backend/services/SimulatorCatalogImporter.php\"; SimulatorCatalogImporter::ensureImported(Database::getInstance()); echo \"ok\n\";"'
```

Depois publique o frontend com `bash scripts/deploy-vps.sh`.

Cuidados:

- Arquivos criados com `sudo` ficam com dono `root` e fazem o `git checkout`
  falhar no meio, **com a API parada**. Antes do checkout, confira com
  `find . -path ./releases -prune -o -path ./backups -prune -o -path ./.git -prune -o -user root -print`
  e corrija com `sudo chown -R opc:opc <pasta>`. O `backend/database/bsenem.db` e
  o symlink `current` podem continuar como estão.
- `backend/database/bsenem.db`, `.env`, `deploy/api.env`, `releases/` e
  `backups/` não são rastreados e o checkout não mexe neles.
- O proxy TLS de `estudos.bssaude.com.br` é o container `deploy-nginx-fpm-nginx-1`,
  configurado em `/opt/projects/bstrainer/deploy-nginx-fpm/nginx/conf.d`. O
  `deploy/estudos.bssaude.com.br.conf` do repositório não é lido em produção.

Rollback do backend, voltando o código e o banco do backup:

```bash
ssh oraclevps2 'set -e; cd /opt/projects/bsenem; B=backups/<pasta-do-backup>; sudo docker stop deploy-api-1; git checkout -f $(cat $B/HEAD.txt); sudo cp $B/bsenem.db backend/database/bsenem.db; sudo rm -f backend/database/bsenem.db-wal backend/database/bsenem.db-shm; sudo docker start deploy-api-1'
```

## O que este fluxo NÃO faz

- **Não publica no GitHub Pages.** O deploy de Pages foi removido do workflow: o
  `public/manifest.json` e os ícones usam caminho absoluto (`/`), que é correto
  na raiz do domínio e quebrava sob `/bsenem/`. O site antigo do Pages continua
  no ar servindo o último build publicado até alguém desligar o Pages nas
  configurações do repositório.
- **Não registra service worker.** Existe um `sw.js` na raiz do repo, mas nada
  no `src/` o registra — hoje o app não é um PWA offline de fato.
