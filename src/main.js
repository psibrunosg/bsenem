import { AppShell } from '@components/AppShell.js';
import { VideoPage } from '@pages/VideoPage.js';
import { AudioPage } from '@pages/AudioPage.js';
import { FlashcardsPage } from '@pages/FlashcardsPage.js';
import { NotesPage } from '@pages/NotesPage.js';
import { ExamsPage } from '@pages/ExamsPage.js';
import { DashboardPage } from '@pages/DashboardPage.js';
import { LibraryPage } from '@pages/LibraryPage.js';
import { GraphPage } from '@pages/GraphPage.js';
import { LoginPage } from '@pages/LoginPage.js';
import { keyboard, setupGlobalShortcuts } from '@utils/keyboard.js';
import { confetti, triggerConfetti } from '@utils/confetti.js';
import { api } from '@utils/api.js';

if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

async function bootApp() {
  const container = document.getElementById('app');
  let user = null;

  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await api.get('/auth/me');
      if (res.success && res.data) {
        user = res.data.user;
      } else {
        localStorage.removeItem('token');
      }
    } catch(e) {
      localStorage.removeItem('token');
    }
  }

  if (user) {
    mountApp(user, container);
  } else {
    const loginPage = new LoginPage({
      onSuccess: (loggedInUser) => {
        loginPage.destroy();
        mountApp(loggedInUser, container);
      }
    });
    container.appendChild(loginPage.render());
  }
}

function mountApp(dbUser, container) {
  if (dbUser && !dbUser.xpMax) dbUser.xpMax = 5000;
  const app = new AppShell({
    user: dbUser,
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
  container.appendChild(appElement);

  app.registerRoute('dashboard', DashboardPage);
  app.registerRoute('video', VideoPage);
  app.registerRoute('audio', AudioPage);
  app.registerRoute('flashcards', FlashcardsPage);
  app.registerRoute('notes', NotesPage);
  app.registerRoute('exams', ExamsPage);
  app.registerRoute('library', LibraryPage);
  app.registerRoute('graph', GraphPage);

  (() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();

  setupGlobalShortcuts(app);
  window.testConfetti = triggerConfetti;
  
  document.addEventListener('dblclick', (e) => {
    if (e.ctrlKey || e.metaKey) {
      triggerConfetti(e.clientX, e.clientY);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[PWA] New version available');
            }
          });
        });
      } catch (error) {
        console.log('[PWA] SW failed:', error);
      }
    });
  }

  window.bsApp = app;
}

bootApp();



