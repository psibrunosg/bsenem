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
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build
```

## Estrutura do Projeto

```
bsenem/
├── src/
│   ├── assets/styles/    # CSS (tokens, componentes, layout)
│   ├── components/       # Componentes vanilla JS
│   ├── pages/            # Páginas de cada funcionalidade
│   ├── utils/            # Utilitários (keyboard, SRS, confetti)
│   └── main.js           # Entry point
├── public/               # Assets estáticos
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
- [ ] Fase 9: Backend PHP + Tauri Desktop
- [ ] Service Worker PWA
- [ ] Testes unitários

## Licença

MIT
