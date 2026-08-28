// src/main.js
import '@styles/main.css';
import { AppShell } from '@components/AppShell.js';
import { VideoPage } from '@pages/VideoPage.js';
import { AudioPage } from '@pages/AudioPage.js';
import { FlashcardsPage } from '@pages/FlashcardsPage.js';
import { NotesPage } from '@pages/NotesPage.js';
import { ExamsPage } from '@pages/ExamsPage.js';
import { DashboardPage } from '@pages/DashboardPage.js';
import { keyboard, setupGlobalShortcuts } from '@utils/keyboard.js';
import { confetti, triggerConfetti } from '@utils/confetti.js';

// Initialize Lucide icons
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// Create and mount AppShell
const app = new AppShell({
  user: {
    name: 'João Silva',
    email: 'joao@email.com',
    level: 5,
    xp: 3420,
    xpMax: 5000,
    streak: 12
  },
  subjects: [
    { id: 'math', name: 'Matemática', color: '#3b82f6', icon: 'calculator' },
    { id: 'portuguese', name: 'Português', color: '#10b981', icon: 'book-open' },
    { id: 'history', name: 'História', color: '#f59e0b', icon: 'landmark' },
    { id: 'geography', name: 'Geografia', color: '#8b5cf6', icon: 'globe' },
    { id: 'biology', name: 'Biologia', color: '#ec4899', icon: 'dna' },
    { id: 'chemistry', name: 'Química', color: '#ef4444', icon: 'flask-conical' },
    { id: 'physics', name: 'Física', color: '#06b6d4', icon: 'atom' },
    { id: 'english', name: 'Inglês', color: '#84cc16', icon: 'languages' }
  ]
});

const appElement = app.render();
document.getElementById('app').appendChild(appElement);

// Register routes
app.registerRoute('dashboard', DashboardPage);
app.registerRoute('video', VideoPage);
app.registerRoute('audio', AudioPage);
app.registerRoute('flashcards', FlashcardsPage);
app.registerRoute('notes', NotesPage);
app.registerRoute('exams', ExamsPage);

// Initialize theme from localStorage
(() => {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

// Global keyboard shortcuts setup - connected to app
setupGlobalShortcuts({
  playPause: () => app.miniPlayer.togglePlayPause(),
  seekBackward10: () => app.miniPlayer.onSeek(Math.max(0, app.miniPlayer.currentTime - 10)),
  seekForward10: () => app.miniPlayer.onSeek(Math.min(app.miniPlayer.duration, app.miniPlayer.currentTime + 10)),
  seekBackward30: () => app.miniPlayer.onSeek(Math.max(0, app.miniPlayer.currentTime - 30)),
  seekForward30: () => app.miniPlayer.onSeek(Math.min(app.miniPlayer.duration, app.miniPlayer.currentTime + 30)),
  volumeUp: () => app.miniPlayer.setVolume(Math.min(1, app.miniPlayer.volume + 0.1)),
  volumeDown: () => app.miniPlayer.setVolume(Math.max(0, app.miniPlayer.volume - 0.1)),
  mute: () => app.miniPlayer.toggleMute(),
  fullscreen: () => app.miniPlayer.onFullscreen(),
  speedCycle: () => app.miniPlayer.cyclePlaybackRate(),
  nextTrack: () => app.miniPlayer.onNext(),
  prevTrack: () => app.miniPlayer.onPrev(),
  search: () => {
    const searchInput = document.querySelector('.global-search .input');
    searchInput?.focus();
  },
  toggleSidebar: () => app.toggleSidebar(),
  showHelp: () => app.showShortcutsHelp()
});

// Test confetti on double-click (for debugging)
document.addEventListener('dblclick', (e) => {
  if (e.ctrlKey || e.metaKey) {
    triggerConfetti(e.clientX, e.clientY);
  }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[PWA] New version available');
          }
        });
      });
    } catch (error) {
      console.log('[PWA] Service Worker registration failed:', error);
    }
  });
}

// Make app globally accessible for debugging
window.bsApp = app;

console.log('🚀 BS Estudos iniciado!');
console.log('🎮 Atalhos globais ativos. Pressione "?" para ver a lista.');
console.log('🎉 Teste confetti: window.testConfetti() ou Ctrl+Duplo-clique');
console.log('📱 App disponível em: window.bsApp');
