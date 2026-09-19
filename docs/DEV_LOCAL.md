# Rodar o app localmente

O acesso é privado: não existe login padrão nem cadastro pela interface. Cada
conta é provisionada por CLI, e isso vale tanto para produção quanto para a sua
máquina — a diferença é só qual banco o comando enxerga.

## Pré-requisitos

PHP 8.2+ **com `pdo_sqlite` habilitado**. O pacote do winget vem sem ele; sem
isso o backend estoura `could not find driver` e `npm run test:backend` falha.
Confira e, se faltar, adicione as duas linhas no `php.ini` que `php --ini`
apontar:

```bash
php -m | grep -i sqlite
```

```ini
extension = pdo_sqlite
extension = sqlite3
```

## Subir

Dois processos, em terminais separados:

```bash
npm run dev:api
```

```bash
npm run dev
```

O front chama `/api` na mesma origem — em produção quem resolve isso é o nginx.
No dev, o `vite.config.js` encaminha `/api` para o PHP em `localhost:8000`. Sem
esse proxy a chamada cai no próprio Vite, volta o HTML da SPA e o login nunca
funciona.

O banco local é criado sozinho no primeiro acesso: `Database::getInstance()`
roda as migrações, então `backend/database/bsenem.db` nasce com o schema
completo. Ele é untracked — cada máquina tem o seu.

## Criar uma conta local

```bash
npm run provision-user -- voce@exemplo.com
```

O comando pergunta nome e senha (mínimo 12 caracteres) e recusa e-mail que já
exista. Como ele usa o mesmo `APP_DB_PATH` do resto do backend, sem a variável
definida ele escreve no banco local — nada encosta em produção.

## Apontar para outro banco

```bash
APP_DB_PATH=/caminho/para/outro.db npm run dev:api
```

Útil para um banco de testes descartável, ou para inspecionar uma cópia de
produção **restaurada localmente**. Não aponte para o arquivo de produção.

## Criar conta em produção

O mesmo CLI, dentro do container da API:

```bash
ssh oraclevps2 'cd /opt/projects/bsenem && sudo docker exec -it deploy-api-1 php backend/cli/provision-user.php voce@exemplo.com'
```

O `-it` é necessário: o script lê nome e senha de STDIN.

## Limpar dados de demonstração

```bash
php backend/cli/clear-demo-data.php
```

## Carregar os simulados

Os simulados não vêm pelo servidor: o app lê a biblioteca local pela File System
Access API. Na tela de Simulados, aponte a pasta `content/` do repositório — os
`.bsestudos.exam.json` ficam em `content/enem/`, ao lado de `content/enem/assets/`,
que é de onde as imagens das questões são resolvidas.
