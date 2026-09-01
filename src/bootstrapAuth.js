import { api as defaultApi } from './utils/api.js';
import { LoginPage } from './pages/LoginPage.js';

export async function bootstrapAuth({ api = defaultApi, mount, createLogin = (options) => new LoginPage(options), createShell } = {}) {
  const response = await api.get('/auth/me').catch(() => ({ success: false }));
  if (response?.success && response.data?.user?.id) {
    const shell = createShell({ user: response.data.user });
    mount(shell.render());
    await shell.start?.(window.location.hash.replace(/^#/, '') || 'dashboard');
    return { state: 'authenticated', shell };
  }
  const login = createLogin({ api, onSuccess: () => bootstrapAuth({ api, mount, createLogin, createShell }) });
  mount(login.render());
  return { state: 'anonymous', login };
}
