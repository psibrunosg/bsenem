// src/pages/LoginPage.js
import { api } from '@utils/api.js';

export class LoginPage {
  constructor(options = {}) {
    this.onSuccess = options.onSuccess || (() => {});
    this.element = null;
    this.mode = 'login'; // login, register, forgot, reset
    this.turnstileToken = '';
    // This is the Cloudflare Turnstile dummy sitekey for testing (always passes).
    // In production, replace with your real site key or fetch it from the backend.
    this.siteKey = '1x00000000000000000000AA'; 
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'login-page fade-in';
    this.element.style.cssText = `
      display: flex;
      min-height: 100vh;
      width: 100vw;
      background: var(--bg-primary);
      color: var(--text-primary);
      position: absolute;
      top: 0;
      left: 0;
      z-index: 9999;
    `;

    // Load Turnstile script
    if (!document.getElementById('cf-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cf-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    this.renderContent();
    return this.element;
  }

  renderContent() {
    let title, subtitle, formHtml, toggleHtml;

    if (this.mode === 'login') {
      title = 'BS Estudos';
      subtitle = 'Bem-vindo de volta! Faça login para continuar.';
      formHtml = `
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">E-mail</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="mail" class="w-5 h-5"></i></span>
            <input type="email" id="auth-email" class="input" placeholder="exemplo@email.com" required style="width: 100%;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">Senha</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="lock" class="w-5 h-5"></i></span>
            <input type="password" id="auth-password" class="input" placeholder="••••••••" required style="width: 100%;">
          </div>
          <div style="text-align: right; margin-top: 4px;">
            <button type="button" data-action="go-forgot" style="background: none; border: none; color: var(--text-muted); font-size: 12px; cursor: pointer; padding: 0;">Esqueci minha senha</button>
          </div>
        </div>
        <div id="cf-turnstile-container"></div>
        <div id="auth-error" style="display: none; padding: 12px; background: var(--error-bg); color: var(--error); border-radius: var(--radius-md); font-size: 13px;"></div>
        <div id="auth-success" style="display: none; padding: 12px; background: var(--success-bg); color: var(--success); border-radius: var(--radius-md); font-size: 13px;"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; height: 44px;">Entrar</button>
      `;
      toggleHtml = `Ainda não tem uma conta? <button type="button" data-action="go-register" style="background: none; border: none; color: var(--orange-600); font-weight: 600; cursor: pointer; padding: 0 4px;">Registre-se</button>`;
    } else if (this.mode === 'register') {
      title = 'Criar Conta';
      subtitle = 'Comece seus estudos agora mesmo.';
      formHtml = `
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">Nome</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="user" class="w-5 h-5"></i></span>
            <input type="text" id="auth-name" class="input" placeholder="Seu nome" required style="width: 100%;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">E-mail</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="mail" class="w-5 h-5"></i></span>
            <input type="email" id="auth-email" class="input" placeholder="exemplo@email.com" required style="width: 100%;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">Senha</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="lock" class="w-5 h-5"></i></span>
            <input type="password" id="auth-password" class="input" placeholder="••••••••" required style="width: 100%;">
          </div>
        </div>
        <div id="cf-turnstile-container"></div>
        <div id="auth-error" style="display: none; padding: 12px; background: var(--error-bg); color: var(--error); border-radius: var(--radius-md); font-size: 13px;"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; height: 44px;">Criar Conta</button>
      `;
      toggleHtml = `Já tem uma conta? <button type="button" data-action="go-login" style="background: none; border: none; color: var(--orange-600); font-weight: 600; cursor: pointer; padding: 0 4px;">Faça login</button>`;
    } else if (this.mode === 'forgot') {
      title = 'Recuperar Senha';
      subtitle = 'Digite seu e-mail para receber as instruções.';
      formHtml = `
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">E-mail</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="mail" class="w-5 h-5"></i></span>
            <input type="email" id="auth-email" class="input" placeholder="exemplo@email.com" required style="width: 100%;">
          </div>
        </div>
        <div id="cf-turnstile-container"></div>
        <div id="auth-error" style="display: none; padding: 12px; background: var(--error-bg); color: var(--error); border-radius: var(--radius-md); font-size: 13px;"></div>
        <div id="auth-success" style="display: none; padding: 12px; background: var(--success-bg); color: var(--success); border-radius: var(--radius-md); font-size: 13px;"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; height: 44px;">Enviar E-mail</button>
        <button type="button" data-action="go-reset" class="btn btn-outline" style="width: 100%; justify-content: center; height: 44px; margin-top: 8px;">Já tenho um token</button>
      `;
      toggleHtml = `<button type="button" data-action="go-login" style="background: none; border: none; color: var(--text-secondary); font-weight: 600; cursor: pointer; padding: 0 4px;"><i data-lucide="arrow-left" class="w-4 h-4 inline-block mr-1"></i> Voltar ao Login</button>`;
    } else if (this.mode === 'reset') {
      title = 'Nova Senha';
      subtitle = 'Digite o token que enviamos e sua nova senha.';
      formHtml = `
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">Token de Recuperação</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="key" class="w-5 h-5"></i></span>
            <input type="text" id="auth-token" class="input" placeholder="Cole o token aqui" required style="width: 100%;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">Nova Senha</label>
          <div class="input-group">
            <span class="input-icon"><i data-lucide="lock" class="w-5 h-5"></i></span>
            <input type="password" id="auth-password" class="input" placeholder="••••••••" required style="width: 100%;">
          </div>
        </div>
        <div id="cf-turnstile-container"></div>
        <div id="auth-error" style="display: none; padding: 12px; background: var(--error-bg); color: var(--error); border-radius: var(--radius-md); font-size: 13px;"></div>
        <div id="auth-success" style="display: none; padding: 12px; background: var(--success-bg); color: var(--success); border-radius: var(--radius-md); font-size: 13px;"></div>
        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; height: 44px;">Redefinir Senha</button>
      `;
      toggleHtml = `<button type="button" data-action="go-login" style="background: none; border: none; color: var(--text-secondary); font-weight: 600; cursor: pointer; padding: 0 4px;"><i data-lucide="arrow-left" class="w-4 h-4 inline-block mr-1"></i> Voltar ao Login</button>`;
    }

    this.element.innerHTML = `
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px;">
        <div class="card" style="width: 100%; max-width: 400px; padding: 32px; background: var(--bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); border: 1px solid var(--border-light);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-lg); background: var(--orange-100); color: var(--orange-600); margin-bottom: 16px;">
              <i data-lucide="brain-circuit" style="width: 32px; height: 32px;"></i>
            </div>
            <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${title}</h1>
            <p style="color: var(--text-secondary); font-size: 14px;">${subtitle}</p>
          </div>

          <form id="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
            ${formHtml}
          </form>

          <div style="margin-top: 24px; text-align: center; font-size: 14px; color: var(--text-secondary);">
            ${toggleHtml}
          </div>
        </div>
      </div>
      <div style="flex: 1; background: linear-gradient(135deg, var(--orange-500) 0%, var(--orange-700) 100%); display: none; flex-direction: column; justify-content: center; align-items: center; padding: 48px; color: white;" class="login-hero">
        <div style="max-width: 480px; text-align: center;">
          <h2 style="font-size: 36px; font-weight: 800; margin-bottom: 16px; line-height: 1.2;">Domine seus estudos de forma inteligente.</h2>
          <p style="font-size: 18px; opacity: 0.9; line-height: 1.5;">Mapas mentais automáticos, repetição espaçada e micro cortes integrados em uma plataforma focada no seu engajamento.</p>
        </div>
      </div>
      <style>
        @media (min-width: 900px) { .login-hero { display: flex !important; } }
      </style>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    this.renderTurnstile();
  }

  renderTurnstile() {
    this.turnstileToken = '';
    const container = this.element.querySelector('#cf-turnstile-container');
    if (container && window.turnstile) {
      window.turnstile.render(container, {
        sitekey: this.siteKey,
        callback: (token) => { this.turnstileToken = token; }
      });
    } else if (container) {
      // Retry if script not loaded yet
      setTimeout(() => this.renderTurnstile(), 500);
    }
  }

  bindEvents() {
    const form = this.element.querySelector('#auth-form');
    
    // Delegation for toggle buttons
    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      
      const action = btn.dataset.action;
      if (action === 'go-login') { this.mode = 'login'; this.renderContent(); }
      if (action === 'go-register') { this.mode = 'register'; this.renderContent(); }
      if (action === 'go-forgot') { this.mode = 'forgot'; this.renderContent(); }
      if (action === 'go-reset') { this.mode = 'reset'; this.renderContent(); }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const errorBox = this.element.querySelector('#auth-error');
      const successBox = this.element.querySelector('#auth-success');
      if(errorBox) errorBox.style.display = 'none';
      if(successBox) successBox.style.display = 'none';
      
      const emailEl = this.element.querySelector('#auth-email');
      const passwordEl = this.element.querySelector('#auth-password');
      const nameEl = this.element.querySelector('#auth-name');
      const tokenEl = this.element.querySelector('#auth-token');
      
      const email = emailEl ? emailEl.value : '';
      const password = passwordEl ? passwordEl.value : '';
      const name = nameEl ? nameEl.value : '';
      const token = tokenEl ? tokenEl.value : '';

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-color: white; border-top-color: transparent;"></div>';
      submitBtn.disabled = true;

      try {
        let res;
        
        if (this.mode === 'register') {
          res = await api.post('/auth/register', { name, email, password, turnstileToken: this.turnstileToken });
        } else if (this.mode === 'login') {
          res = await api.post('/auth/login', { email, password, turnstileToken: this.turnstileToken });
        } else if (this.mode === 'forgot') {
          res = await api.post('/auth/forgot-password', { email, turnstileToken: this.turnstileToken });
        } else if (this.mode === 'reset') {
          res = await api.post('/auth/reset-password', { token, password, turnstileToken: this.turnstileToken });
        }

        if (res.success) {
          if (this.mode === 'login' || this.mode === 'register') {
            localStorage.setItem('token', res.data.token);
            this.onSuccess(res.data.user);
          } else if (this.mode === 'forgot') {
            successBox.textContent = res.data.message || 'Instruções enviadas.';
            successBox.style.display = 'block';
            this.mode = 'reset';
            setTimeout(() => this.renderContent(), 2000);
          } else if (this.mode === 'reset') {
            successBox.textContent = res.data.message || 'Senha alterada.';
            successBox.style.display = 'block';
            this.mode = 'login';
            setTimeout(() => this.renderContent(), 2000);
          }
        } else {
          errorBox.textContent = res.error || 'Erro na requisição.';
          errorBox.style.display = 'block';
          if (window.turnstile) window.turnstile.reset();
        }
      } catch (err) {
        errorBox.textContent = 'Erro de conexão com o servidor.';
        errorBox.style.display = 'block';
        if (window.turnstile) window.turnstile.reset();
      } finally {
        if(submitBtn) {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
