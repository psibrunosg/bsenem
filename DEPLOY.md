# BS Estudos - Deploy & Continuity Plan

## ✅ Status Atual: FASES 1-3 CONCLUÍDAS

### Build de Produção
```bash
npm run build
```
**Output:** `dist/` (pronto para deploy estático)
- `index.html` - 1.21 kB
- `assets/index-D3LYjaMA.css` - 79 kB (12 kB gzip)
- `assets/index-Dtgicd6v.js` - 44 kB (11 kB gzip)

---

## 📦 O que está Implementado

### Fase 1: Foundation (Design System)
| Arquivo | Descrição |
|---------|-----------|
| `src/assets/styles/tokens.css` | Design tokens completos (light/dark + gamificação) |
| `src/assets/styles/reset.css` | Normalize + base styles + scrollbar customizada |
| `src/assets/styles/utilities.css` | Classes utilitárias tipo Tailwind + animações gamificadas |
| `src/assets/styles/main.css` | Entry point CSS |
| `index.html` | HTML com fonts, Lucide icons, PWA meta |
| `public/manifest.json` | PWA manifest |
| `vite.config.js` | Vite config com aliases |
| `package.json` | Dependências |
| `src/main.js` | Bootstrap + Lucide + atalhos globais |
| `src/utils/keyboard.js` | Sistema de atalhos (Mousetrap-like) |
| `src/utils/confetti.js` | Confetti canvas leve |

**Features:** Dark mode automático, tipografia Source Sans 3 + Literata + JetBrains Mono, paleta laranja, tokens gamificados (XP, streak, level, confetti), 12 atalhos globais.

---

### Fase 2: Layout Core
| Componente | Arquivo | Funcionalidades |
|------------|---------|-----------------|
| AppShell | `src/components/AppShell.js` | Layout grid responsivo, roteamento básico |
| Sidebar | `src/components/Sidebar.js` | Colapsável (260↔56px), mobile drawer, XP/streak, navegação |
| Header | `src/components/Header.js` | Busca global (Ctrl+K), theme toggle, user menu, command palette |
| MiniPlayer | `src/components/MiniPlayer.js` | Track info, controles, seek, volume, speed, fullscreen, persistente |

**CSS:** `src/assets/styles/layout/*.css` (4 arquivos)

**Atalhos globais conectados:** Espaço, ←/→, Shift+←/→, ↑/↓, M, F, S, N/P, Ctrl+K, Ctrl+B, ?

---

### Fase 3: UI Kit (21 componentes)
| Categoria | Componentes |
|-----------|-------------|
| **Form** | Button, ButtonGroup, Input, Textarea, Label, Select, Checkbox, CheckboxGroup, Radio, RadioGroup, Switch, Slider |
| **Feedback** | Modal (alert/confirm/prompt), Toast (5 tipos + achievement), Tooltip, Alert, InlineAlert, AlertBanner |
| **Navigation** | Tabs (3 variants), Dropdown |
| **Data Display** | Avatar, AvatarGroup, Badge, BadgeGroup, Progress, CircularProgress, StepProgress |
| **Utility** | Skeleton (7 layouts prontos: dashboard, list, table, form, video, sidebar) |

**CSS:** 17 arquivos em `src/assets/styles/components/`

**Exports:** `src/components/index.js` com registry + helpers `createComponent()` / `renderComponent()`

---

## 🚀 Deploy Imediato

### Opção 1: Netlify/Vercel (Recomendado)
```bash
# Netlify
npx netlify deploy --prod --dir=dist

# Vercel
npx vercel --prod dist
```

### Opção 2: GitHub Pages
```bash
# Configurar github-pages branch ou usar GitHub Actions
```

### Opção 3: Servidor Estático (Nginx/Apache)
```nginx
# Nginx config
server {
    listen 80;
    root /var/www/bs-estudos/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    gzip on; gzip_types text/css application/javascript;
}
```

### Opção 4: Desktop (Tauri) - Futuro
```bash
# Quando backend PHP estiver pronto
npm run tauri build
```

---

## 📋 Plano de Continuidade (Fases 4-9)

### Fase 4: Player Completo (Próxima)
| Componente | Status | Detalhes |
|------------|--------|----------|
| VideoPlayer | ✅ **CRIADO** (`src/components/VideoPlayer.js`) | Controles custom, PiP, teclas, qualidade, legendas, velocidade |
| AudioPlayer | ⏳ Pendente | Waveform, sleep timer, capítulos |
| Playlist | ⏳ Pendente | Queue, reorder, shuffle, repeat |
| CSS Players | ⏳ Pendente | `video.css`, `audio.css`, `playlist.css` |
| Integração MiniPlayer | ⏳ Pendente | Sync estado, atalhos globais |

**Próximos passos imediatos:**
1. Criar `AudioPlayer.js` com waveform canvas
2. Criar `Playlist.js` 
3. Criar CSS dos players
4. Integrar com `MiniPlayer` existente

---

### Fase 5: Flashcards SRS
| Componente | Descrição |
|------------|-----------|
| Flashcard | Flip 3D animado, frente/verso |
| ReviewQueue | Fila de revisão priorizada (SM-2) |
| CardControls | Botões Again/Hard/Good/Easy |
| SRSEngine | Algoritmo SM-2 com ease factor, interval, repetitions |
| StatsChart | Gráficos de retenção, heatmap |

---

### Fase 6: Notas/PDF
| Componente | Descrição |
|------------|-----------|
| MarkdownEditor | Toolbar, shortcuts, wiki-links `[[...]]`, tags, preview |
| PDFViewer | PDF.js integration, zoom, rotação, thumbnails |
| AnnotationToolbar | Highlight, underline, note, livre |
| NoteLinker | Backlinks, graph view, search |

---

### Fase 7: Simulados
| Componente | Descrição |
|------------|-----------|
| ExamPlayer | Timer, navegação, flag, review mode |
| QuestionCard | MC, TF, Essay, drag-drop |
| ResultsScreen | Score, percentis, revisão de erros, XP |
| ExamBuilder | Criação de provas, import CSV/JSON |

---

### Fase 8: Dashboard Gamificado
| Componente | Descrição |
|------------|-----------|
| HeatmapCalendar | Estilo GitHub (contribuições de estudo) |
| XPBar | Animada, level up animation |
| LevelBadge | Badge animado com glow |
| StreakCounter | Fire animation, freeze streak |
| ProgressRing | Circular animated |
| StatsDashboard | Tempo total, sessões, precisão, streaks |

---

### Fase 9: Backend PHP + Tauri Desktop
| Item | Descrição |
|------|-----------|
| PHP API REST | Endpoints: auth, subjects, resources, flashcards, notes, exams, progress |
| SQLite/PostgreSQL | Migrations, seeds, repositórios |
| Drive Scanner | Varre pasta Google Drive, indexa arquivos, extrai metadados |
| Tauri Sidecar | PHP built-in server (`php -S`) embutido no .exe |
| Installer | Inno Setup assinado, auto-update |
| Sync | Offline-first, sync quando online |

---

## 🗂️ Estrutura Atual do Projeto
```
bsenem/
├── dist/                    # Build de produção (pronto para deploy)
├── public/
│   └── manifest.json        # PWA
├── src/
│   ├── main.js              # Entry point
│   ├── assets/styles/
│   │   ├── tokens.css       # Design tokens
│   │   ├── reset.css
│   │   ├── utilities.css
│   │   ├── main.css
│   │   ├── layout/          # 4 arquivos
│   │   └── components/      # 17 arquivos
│   ├── components/
│   │   ├── AppShell.js
│   │   ├── Sidebar.js
│   │   ├── Header.js
│   │   ├── MiniPlayer.js
│   │   ├── VideoPlayer.js   # NOVO
│   │   ├── Button.js
│   │   ├── Input.js
│   │   ├── Select.js
│   │   ├── Modal.js
│   │   ├── Toast.js
│   │   ├── Tooltip.js
│   │   ├── Alert.js
│   │   ├── Tabs.js
│   │   ├── Dropdown.js
│   │   ├── Avatar.js
│   │   ├── Badge.js
│   │   ├── Progress.js
│   │   ├── Skeleton.js
│   │   ├── Checkbox.js
│   │   ├── Radio.js
│   │   ├── Switch.js
│   │   ├── Slider.js
│   │   └── index.js         # Exports + registry
│   └── utils/
│       ├── keyboard.js
│       └── confetti.js
├── index.html
├── vite.config.js
├── package.json
└── DEPLOY.md                # Este arquivo
```

---

## 🔧 Comandos Úteis
```bash
# Desenvolvimento
npm run dev          # localhost:8765

# Build produção
npm run build        # Gera dist/

# Preview build
npm run preview      # Testa build local

# Tauri (futuro)
npm run tauri dev    # Desktop dev
npm run tauri build  # Gera .exe/.dmg/.AppImage
```

---

## 🎯 Próxima Ação Recomendada

**Iniciar Fase 4 - AudioPlayer + Playlist + CSS Players**

Tempo estimado: 4-6h
1. `AudioPlayer.js` - waveform canvas, sleep timer, capítulos
2. `Playlist.js` - queue, drag-reorder, shuffle, repeat
3. `video.css`, `audio.css`, `playlist.css` - estilos
4. Integração com `MiniPlayer` e atalhos globais existentes

---

**Deploy pronto.** O `dist/` pode ser hospedado em qualquer CDN estático.