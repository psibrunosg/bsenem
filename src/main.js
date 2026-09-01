import '@styles/main.css';
import { AppShell } from '@components/AppShell.js';
import { VideoPage } from '@pages/VideoPage.js';
import { AudioPage } from '@pages/AudioPage.js';
import { FlashcardsPage } from '@pages/FlashcardsPage.js';
import { NotesPage } from '@pages/NotesPage.js';
import { ExamsPage } from '@pages/ExamsPage.js';
import { DashboardPage } from '@pages/DashboardPage.js';
import { LibraryPage } from '@pages/LibraryPage.js';
import { LocalLibraryService } from '@services/LocalLibraryService.js';
import { bootstrapAuth } from './bootstrapAuth.js';
import { api } from '@utils/api.js';

const root = document.getElementById('app');
const mount = (element) => root.replaceChildren(element);

function createShell({ user }) {
  const shell = new AppShell({ user, onLogout: () => bootstrap() });
  const library = new LocalLibraryService();
  library.setUser?.(user.id);
  shell.setLibraryService(library);
  [['dashboard', DashboardPage], ['video', VideoPage], ['audio', AudioPage], ['flashcards', FlashcardsPage], ['notes', NotesPage], ['exams', ExamsPage], ['library', LibraryPage]]
    .forEach(([route, component]) => shell.registerRoute(route, component));
  return shell;
}

function bootstrap() {
  return bootstrapAuth({ api, mount, createShell });
}

bootstrap();
