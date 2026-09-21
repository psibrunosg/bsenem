import { api as defaultApi } from './utils/api.js';
import { LoginPage } from './pages/LoginPage.js';
import { normalizeUserProfile } from './utils/user.js';

export async function bootstrapAuth({ api = defaultApi, mount, createLogin = (options) => new LoginPage(options), createShell } = {}) {
  const dependencies = { api, mount, createLogin, createShell };
  const response = await api.get('/auth/me').catch(() => ({ success: false, status: 0 }));
  if (response?.success && response.data?.user?.id) {
    const shell = createShell({ user: normalizeUserProfile(response.data.user) });
    mount(shell.render());
    await shell.start?.(window.location.hash.replace(/^#/, '') || 'dashboard');
    return { state: 'authenticated', shell };
  }
  if (response?.status !== 401) {
    const unavailable = renderUnavailable(() => bootstrapAuth(dependencies));
    mount(unavailable);
    return { state: 'unavailable', unavailable };
  }
  const login = createLogin({ api, onSuccess: () => bootstrapAuth({ api, mount, createLogin, createShell }) });
  mount(login.render());
  return { state: 'anonymous', login };
}

function renderUnavailable(onRetry) {
  const element = document.createElement('main');
  element.className = 'auth-unavailable';
  const title = document.createElement('h1');
  title.textContent = 'Não foi possível verificar sua sessão';
  const message = document.createElement('p');
  message.textContent = 'O serviço pode estar temporariamente indisponível. Sua sessão não foi encerrada.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-primary';
  retry.dataset.action = 'retry-auth';
  retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', async () => {
    retry.disabled = true;
    await onRetry();
  });
  element.append(title, message, retry);
  return element;
}
