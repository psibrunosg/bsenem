# Beta privada: autenticação e dados reais

## Decisão

O BS Estudos operará como beta privada. Não haverá cadastro público, convites automáticos, painel administrativo, recuperação de senha por e-mail nem conteúdo demonstrativo. A criação e a aprovação de usuários ocorrerão manualmente no servidor. A primeira conta autorizada será provisionada fora do repositório, com a credencial fornecida pelo operador neste atendimento; a senha não será copiada para código, documentação, testes, commits, variáveis de exemplo ou logs.

## Objetivo

Fazer com que toda pessoa que use a aplicação esteja autenticada por uma sessão revogável e veja somente seus próprios dados reais. Quando ainda não houver dados, a interface deverá mostrar estados vazios úteis, nunca métricas, aulas, cartões, simulados ou resultados fictícios.

## Fora de escopo

- Convites por e-mail, autoaprovação, cadastro público e painel de administração.
- Upload ou sincronização de arquivos do computador para a VPS.
- Recuperação de senha automática. Durante a beta, o operador redefine uma senha de forma manual e controlada no servidor.
- Criação de novos simulados ou de uma biblioteca editorial remota.

## Arquitetura de autenticação

### Sessões

O backend deixará de emitir tokens autoportantes no navegador. Após credenciais válidas, ele criará uma sessão aleatória, persistida na tabela `auth_sessions` apenas como hash SHA-256, e enviará o valor original em cookie com `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` e expiração de sete dias. O valor original não será gravado no banco, em logs ou no frontend.

`Auth::getUserId()` aceitará a sessão somente pelo cookie. `Auth::requireAuth()` continuará sendo a única porta de entrada dos controladores protegidos. `POST /api/auth/logout` apagará a sessão correspondente no banco e expirará o cookie. Assim, o logout e uma exclusão manual de sessão passam a ter efeito imediato.

### Endpoints públicos e protegidos

| Endpoint | Regra |
| --- | --- |
| `POST /api/auth/login` | Público; valida e-mail e senha, cria sessão e retorna o perfil sem segredos. |
| `GET /api/auth/me` | Requer sessão; retorna o perfil real atual. |
| `POST /api/auth/logout` | Requer sessão; revoga a sessão e encerra o cookie. |
| `POST /api/auth/register` | Responde `403` com mensagem de beta privada; jamais cria usuário. |
| `POST /api/auth/forgot-password` e `POST /api/auth/reset-password` | Respondem `403` com orientação para contatar o administrador; não chamam Resend nem geram token. |

Todas as rotas de notas, cartões, progresso e simulados continuarão exigindo `Auth::requireAuth()`. Consultas, atualizações e exclusões devem filtrar por `user_id` do usuário autenticado, sem aceitar `user_id` vindo do navegador.

### Provisionamento manual

Um comando PHP de CLI, sem rota HTTP, será a única forma de criar conta durante a beta. Ele receberá somente o e-mail como argumento, pedirá nome e senha pelo terminal, validará ambos, aplicará `password_hash(..., PASSWORD_ARGON2ID)` quando disponível (com fallback seguro de compatibilidade), criará o usuário e não exibirá a senha. A operação será feita dentro do contêiner de API na VPS, com terminal interativo e sem argumentos ou arquivos que contenham a senha.

O comando recusará e-mail duplicado e não criará automaticamente dados de estudo. A conta inicial será criada somente após o backup e a limpeza definidos nesta especificação.

## Banco e migrações

### Fonte de dados

SQLite seguirá como banco da beta, em volume persistente da VPS. `Database` passará a obter o caminho por configuração de ambiente, permitindo que testes usem um arquivo temporário descartável e produção use o volume persistente. O caminho de produção e qualquer credencial operacional continuam fora do Git.

### Migrações controladas

A inicialização atual executa `schema.sql` em cada requisição e contém seeds de demonstração. Ela será substituída por um executor de migrações versionadas, transacionais e registradas em `schema_migrations`. Uma migração aplica a estrutura-base sem `INSERT` de exemplos e outra adiciona:

```sql
CREATE TABLE auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_auth_sessions_user_expires
    ON auth_sessions(user_id, expires_at);
```

O schema canônico não conterá os campos de recuperação de senha repetidos em tabelas que não são `users`, nem inserts de matérias, conquistas, cartões, recursos, simulados ou usuários de exemplo.

Antes da limpeza de produção, será feita uma cópia datada e verificável do arquivo SQLite. Depois de validar o backup, serão removidos os registros de demonstração existentes das tabelas de conteúdo e todos os usuários de teste, pois a única conta autorizada nesta fase é a provisionada manualmente. O backup será preservado como caminho de recuperação e não será incluído no repositório.

## Frontend e dados reais

### Inicialização

`src/main.js` fará bootstrap de autenticação antes de criar o `AppShell`:

1. Chama `GET /api/auth/me` com `credentials: 'same-origin'`.
2. Se receber uma sessão válida, cria o shell com o perfil retornado e registra as rotas privadas.
3. Se receber `401`, monta `LoginPage` como única tela disponível.
4. Após login, reinicializa o shell usando o perfil retornado; após logout, desmonta o shell e retorna ao login.

`api.js` não lerá nem gravará `localStorage.token`, não acrescentará header `Authorization` e sempre enviará credenciais same-origin. Falhas HTTP serão convertidas em respostas consistentes para a interface. `AppShell`, `Header` e `Sidebar` não terão usuário padrão demonstrativo.

`LoginPage` exibirá somente e-mail, senha, entrar e a orientação de que o acesso é controlado. Os modos cadastrar, recuperar e redefinir senha, a chave de teste do Turnstile e a integração visual associada serão removidos. Uma mensagem de erro não revelará se um e-mail está cadastrado.

### Páginas sem dados fictícios

- **Dashboard:** carrega `GET /api/progress/dashboard`; cartões e heatmap usam valores persistidos e apresentam zeros ou estado vazio quando não há sessões.
- **Flashcards e notas:** carregam exclusivamente os endpoints existentes do usuário. `initSampleCards`, arrays de exemplo e criação automática de cartões serão removidos. Com listas vazias, mostram uma ação real de criar o primeiro registro quando já houver fluxo de criação correspondente.
- **Simulados:** não gera perguntas ou provas no cliente. Até que exista conteúdo criado de forma real, mostra estado vazio, sem pontuação simulada.
- **Vídeo e áudio:** não exibem URLs externas de demonstração. A navegação leva à Biblioteca local, que mostra somente arquivos escolhidos pela própria pessoa usuária.
- **Busca:** consulta somente itens reais acessíveis ao usuário e o catálogo local da sessão atual; sem resultado, devolve uma lista vazia e mensagem adequada.

O catálogo da Biblioteca local continuará no IndexedDB porque a API web não pode e não deve enviar caminhos do HD ou do Google Drive Desktop para a VPS. Sua chave de armazenamento será associada ao `user.id`, impedindo que duas contas no mesmo navegador misturem catálogos, permissões ou preferências. Arquivos, handles e URLs `blob:` jamais serão enviados ao backend.

## Repositório, validação e publicação

O release atual foi construído a partir da worktree `codex/local-study-library`, mas a branch `main` não possui o `package.json` nem os ajustes que tornaram esse build reproduzível. Antes de alterar autenticação, a implementação reconciliará essa fonte publicada na branch de entrega, preservará mudanças não relacionadas e deixará o mesmo conjunto de fontes, testes e dependências disponível para build local e CI.

### Critérios de aceite

- Visitante sem cookie não acessa rotas ou APIs privadas e vê a tela de login.
- Login da conta provisionada cria cookie seguro, retorna o perfil correto e não usa `localStorage` para autenticação.
- Logout revoga a sessão: uma nova chamada a `/api/auth/me` retorna `401`.
- Cadastro e recuperação públicos não criam usuário e retornam mensagem de beta privada.
- Um usuário não consegue ler, alterar ou excluir dados de outro usuário, inclusive por ID alterado na URL.
- Banco e interface não possuem registros ou conteúdo demonstrativo; páginas sem registros apresentam estados vazios.
- Biblioteca local permanece operante, isolada por usuário e sem upload de arquivos.
- Testes frontend, testes PHP com banco temporário, lint PHP, build Vite e testes Playwright dos fluxos login/logout/bloqueio de cadastro passam antes do deploy.
- A VPS contém backup verificável antes da limpeza, executa as migrações uma vez e passa por validação HTTP e navegador em `https://estudos.bssaude.com.br`.

## Sequência de publicação

1. Executar toda a suíte contra banco temporário e build imutável.
2. Criar artefato de release e manter o release anterior como rollback.
3. Na VPS, parar gravações brevemente, copiar e verificar SQLite, aplicar migrações e limpar somente os dados de demonstração descritos acima.
4. Provisionar a conta inicial por terminal interativo, sem persisti-la em arquivos ou histórico de comandos.
5. Alternar o release, reiniciar os serviços necessários e testar login, logout, acesso não autorizado, bloqueio de cadastro, estado vazio e Biblioteca local.
6. Se qualquer checagem falhar, restaurar o symlink do release anterior e o banco a partir da cópia criada no passo 3.
