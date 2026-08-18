# BS Estudos

Plataforma de estudos para o ENEM e vestibulares, construída com JavaScript vanilla e Vite.

![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

## Funcionalidades

### Fase 1-3: Foundation & UI Kit
- Design system completo com dark/light mode
- 21 componentes reutilizáveis
- Layout responsivo com sidebar colapsável
- MiniPlayer para áudio/vídeo
- Atalhos de teclado globais

### Fase 4: Players
- **VideoPlayer** - Controles customizados, PiP, fullscreen, legendas
- **AudioPlayer** - Waveform canvas, sleep timer, capítulos
- **Playlist** - Drag-and-drop, shuffle, repeat

### Fase 5: Flashcards SRS
- Algoritmo SM-2 de repetição espaçada
- Cards com flip 3D animado
- Sistema de revisão com estatísticas
- Import/export de flashcards

### Fase 6: Anotações
- Editor Markdown com toolbar
- Wiki-links `[[...]]` para conexão entre notas
- Tags para organização
- Preview em tempo real

### Fase 7: Simulados
- Timer configurável
- Navegação por questões
- Modo revisão com explicações
- Resultados detalhados

### Fase 8: Dashboard Gamificado
- Calendário de atividades (estilo GitHub)
- Barra de XP com animação
- Contador de sequência (streak)
- Estatísticas de desempenho

## Tecnologias

- **JavaScript** vanilla (ES Modules)
- **Vite** 5.x para build e dev server
- **Lucide** para ícones
- **CSS** vanilla com design tokens
- **localStorage** para persistência

## Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/bsenem.git
cd bsenem

# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:8765`

## Comandos

```bash
npm run dev      # Servidor de desenvolvimento (frontend)
npm run build    # Build de produção
npm run preview  # Preview do build
npm run test     # Executar testes
```

## Backend (PHP API)

### Iniciar Backend

```bash
# Requer PHP 8.0+ com SQLite
cd backend
php -S localhost:8000 router.php
```

Acesse API em `http://localhost:8000/api`

### Estrutura Backend

```
backend/
├── api/index.php           # Router principal
├── config/
│   ├── database.php        # Conexão SQLite + helpers
│   ├── cors.php            # CORS headers
│   └── response.php        # Respostas JSON padronizadas
├── controllers/
│   ├── AuthController.php  # Registro, login, perfil
│   ├── FlashcardController.php  # CRUD + revisão SRS
│   ├── NoteController.php  # CRUD + busca
│   └── ProgressController.php   # Dashboard, heatmap, XP
├── database/
│   └── schema.sql          # Schema SQLite completo
├── middleware/
│   └── auth.php            # JWT auth
├── public/index.php        # Entry point
└── router.php              # PHP built-in server router
```

### API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Registrar usuário |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Dados do usuário logado |
| GET | `/api/flashcards` | Listar flashcards |
| POST | `/api/flashcards` | Criar flashcard |
| PUT | `/api/flashcards/{id}` | Atualizar flashcard |
| DELETE | `/api/flashcards/{id}` | Deletar flashcard |
| POST | `/api/flashcards/{id}/review` | Revisar card (SM-2) |
| GET | `/api/flashcards/due/count` | Cards pendentes |
| GET | `/api/notes` | Listar notas |
| POST | `/api/notes` | Criar nota |
| PUT | `/api/notes/{id}` | Atualizar nota |
| DELETE | `/api/notes/{id}` | Deletar nota |
| GET | `/api/notes/search?q=` | Buscar notas |
| GET | `/api/progress/dashboard` | Dados do dashboard |
| GET | `/api/progress/heatmap?year=` | Dados do heatmap |
| POST | `/api/progress/study` | Registrar sessão de estudo |

## Estrutura do Projeto

```
bsenem/
├── src/
│   ├── assets/styles/    # CSS (tokens, componentes, layout)
│   ├── components/       # Componentes vanilla JS
│   ├── pages/            # Páginas de cada funcionalidade
│   ├── tests/            # Testes unitários (Vitest)
│   ├── utils/            # Utilitários (keyboard, SRS, confetti)
│   └── main.js           # Entry point
├── backend/              # API REST PHP
│   ├── api/              # Router
│   ├── config/           # Database, CORS, Response
│   ├── controllers/      # Auth, Flashcards, Notes, Progress
│   ├── database/         # Schema SQL
│   └── middleware/        # Auth JWT
├── public/               # Assets estáticos + manifest.json
├── dist/                 # Build de produção
└── package.json
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `#dashboard` | Dashboard gamificado |
| `#video` | Videoaulas |
| `#audio` | Áudios |
| `#flashcards` | Flashcards SRS |
| `#notes` | Anotações |
| `#exams` | Simulados |

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `Espaço` | Play/Pause |
| `←/→` | Voltar/Avançar 10s |
| `↑/↓` | Volume +/- |
| `M` | Mute |
| `F` | Fullscreen |
| `Ctrl+K` | Busca global |
| `Ctrl+B` | Toggle sidebar |

## Deploy

### Netlify/Vercel
```bash
npm run build
npx netlify deploy --prod --dir=dist
```

### GitHub Pages
```bash
npm run build
# Copiar dist/ para branch gh-pages
```

### Servidor Estático
```nginx
server {
    listen 80;
    root /var/www/bs-estudos/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
```

## Roadmap

- [x] Fase 1-3: Foundation & UI Kit
- [x] Fase 4: Players
- [x] Fase 5: Flashcards SRS
- [x] Fase 6: Anotações
- [x] Fase 7: Simulados
- [x] Fase 8: Dashboard Gamificado
- [x] Fase 9: Backend PHP (API REST + SQLite)
- [x] Service Worker PWA
- [x] Testes unitários (Vitest)
- [ ] Fase 9: Tauri Desktop

## Licença

MIT
