import '@styles/main.css';
import { AppShell } from '@components/AppShell.js';
import { FlashcardsPage } from '@pages/FlashcardsPage.js';
import { NotesPage } from '@pages/NotesPage.js';
import { ExamsPage } from '@pages/ExamsPage.js';
import { DashboardPage } from '@pages/DashboardPage.js';
import { ProfilePage } from '@pages/ProfilePage.js';
import { SettingsPage } from '@pages/SettingsPage.js';
import { HelpPage } from '@pages/HelpPage.js';
import { StudyLibraryPage } from '@pages/StudyLibraryPage.js';
import { bootstrapAuth } from './bootstrapAuth.js';
import { api } from '@utils/api.js';

const root = document.getElementById('app');
const mount = (element) => root.replaceChildren(element);

function createShell({ user }) {
  const shell = new AppShell({ user, onLogout: () => bootstrap() });
  [['dashboard', DashboardPage], ['video', class extends StudyLibraryPage { constructor(options) { super({ ...options, contentMode: 'video' }); } }], ['audio', class extends StudyLibraryPage { constructor(options) { super({ ...options, contentMode: 'audio' }); } }], ['documents', class extends StudyLibraryPage { constructor(options) { super({ ...options, contentMode: 'document' }); } }], ['flashcards', FlashcardsPage], ['notes', NotesPage], ['exams', ExamsPage], ['study-library', StudyLibraryPage], ['profile', ProfilePage], ['settings', SettingsPage], ['help', HelpPage]]
    .forEach(([route, component]) => shell.registerRoute(route, component));
  return shell;
}

function bootstrap() {
  return bootstrapAuth({ api, mount, createShell });
}

bootstrap();
