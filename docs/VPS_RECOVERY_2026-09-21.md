# Recuperação da VPS — 2026-09-21

Este commit preserva alterações de código encontradas diretamente em
`/opt/projects/bsenem` na VPS. Ele é um registro para revisão, não uma base
para substituir ou fazer merge automático em `main`.

O snapshot exclui intencionalmente `.env`, o banco SQLite, backups, releases,
`current`, `dist`, `node_modules` e `.git`.

## Atenção antes de integrar

As mudanças recuperadas removem controles de segurança presentes em `main`,
incluindo CSRF, limitação de tentativas de login, cabeçalhos de segurança e
validações de testes. Por isso, qualquer aproveitamento deve ser feito por
cherry-pick seletivo, após comparar cada arquivo com `main`.

Também foram preservados um workflow de GitHub Pages e um arquivo alternativo
de Nginx (`bsenem.conf`) para inspeção. Os arquivos de backup temporários
encontrados na VPS não entram no repositório.
