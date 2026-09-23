# Desafios recorrentes

## Verificação visual local (login obrigatório)
- O app exige login. Use um banco descartável: `APP_DB_PATH=<scratch>/x.db php -S localhost:8000 backend/router.php` + `npx vite --port 8765`.
- `provision-user.php` no Windows perde a senha enviada por pipe (`stream_isatty ... buffered data lost`). Depois de provisionar, defina a senha direto:
  `php -r '$p=new PDO("sqlite:<db>"); $p->prepare("UPDATE users SET password_hash=? WHERE id=1")->execute([password_hash("senha123", PASSWORD_DEFAULT)]);'`
- `preview_start` com `name` procura `.claude/launch.json` na raiz do repo principal, não no worktree. Rode o Vite pelo Bash e use `preview_start` com `url`.
- As screenshots do painel do navegador costumam dar timeout. Prefira um script Playwright headless (`@playwright/test` já está instalado, com os browsers em `~/AppData/Local/ms-playwright`), com `colorScheme` light/dark.
- Páginas vazias não exercitam os componentes (ExamPlayer, Flashcard, VideoPlayer). Monte uma página HTML temporária na raiz do worktree que importe `@styles/main.css` e os componentes com dados falsos. O Vite serve a página direto.

## CSS custom properties
- Só existem os tokens de `src/assets/styles/tokens.css` (`--bg-*`, `--text-*`, `--border-*`, `--orange-*`, `--success/-bg` etc.). Nomes como `--color-*`, `--font-size-*`, `--surface-*` ou `--primary` NÃO existem. Para checar variáveis usadas sem definição:
  `comm -13 <(grep -rhoE -- '--[a-zA-Z0-9-]+\s*:' src | sed -E 's/\s*:$//' | sort -u) <(grep -rhoE -- 'var\(--[a-zA-Z0-9-]+' src | sed 's/var(//' | sort -u)`
  O único resultado esperado é `--xp-target` (definido em runtime, com fallback).
- Para fundo de destaque translúcido, use `--accent-subtle`, que funciona em light e dark.

## Worktree compartilhado
- Outras sessões podem editar este worktree ao mesmo tempo. Antes de commitar, confira com `git diff` se os arquivos contêm só as suas mudanças.

## Percurso automatizado (Playwright)
- O worktree não tem `playwright` em `node_modules`. Importe do checkout principal: `import { chromium } from 'file:///C:/Users/bruno/Documents/GitHub/bsenem/node_modules/playwright/index.mjs'`.
- A porta 8765/8000 pode estar em uso por outra sessão. Rode `php -S localhost:8010` e um Vite com config no scratchpad que importe `vite.config.js` e troque `server.port`/`proxy.target`.
- O roteador lê o hash só na inicialização (`bootstrapAuth.js`). `page.goto(BASE + '#exams')` sozinho não muda de página. Em seguida, chame `page.reload()`.
- O 401 de `/api/auth/me` antes do login é esperado. Zere os erros de console depois de logar.
- Meça rolagem horizontal com `scrollWidth <= clientWidth` antes de screenshots `fullPage`. Pseudo-elementos (`::after`) não aparecem em `querySelectorAll`: para achar o culpado, esconda os elementos um a um.

## Ícones lucide
- `lucide.createIcons(element)` não restringe ao elemento e ignora nós fora do documento. Use `renderIcons(root)` de `src/utils/icons.js` (`createIcons({ root })`) depois de anexar o conteúdo, como em re-renderizações dentro de uma página.

## Servidores em segundo plano
- `TaskStop` encerra o shell, mas o `node` (Vite) e o `php -S` filhos podem continuar vivos, segurando a porta. Confira com `netstat -ano | grep LISTEN` e, antes de encerrar, confirme o dono pelo `CommandLine` (`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`). Encerre só pelo PID.
- `php -S` com `APP_CONTENT_IMPORT` ausente importa ENEM (3060) e concursos (2795) no primeiro acesso a `/api/simulators/catalog` (cerca de 2 s). Nos testes com dados sintéticos, use `APP_CONTENT_IMPORT=off`.
