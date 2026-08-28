// src/pages/LibraryPage.js

import { idb } from '@utils/idb.js';

export class LibraryPage {
  constructor(options = {}) {
    this.app = options.app;
    this.element = null;
    this.directoryHandle = null;
    this.init();
    this.files = []; this.subtitlesFiles = [];
  }

  async init() {
    try {
      const handle = await idb.get('library-folder');
      if (handle) {
        // Request permission if needed
        const options = { mode: 'read' };
        if (await handle.queryPermission(options) === 'granted' || await handle.requestPermission(options) === 'granted') {
          this.directoryHandle = handle;
          await this.scanDirectory(handle);
        }
      }
    } catch (e) {
      console.log('No saved folder found');
    }
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'library-page';
    
    this.element.innerHTML = \
      <div class="page-header">
        <h1>Biblioteca Local (HD/Drive)</h1>
        <p>Acesse seus v�deos e PDFs diretamente do seu PC, sem fazer upload.</p>
      </div>
      
      <div class="library-content" style="padding: 24px;">
        <div class="library-controls" style="margin-bottom: 24px;">
          <button class="btn btn-primary" data-action="connect-folder">
            <i data-lucide="folder-open" class="w-5 h-5"></i>
            Conectar Pasta Local
          </button>
          <span class="library-status" style="margin-left: 12px; color: var(--text-secondary);">
            Nenhuma pasta conectada
          </span>
        </div>
        
        <div class="library-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;">
        </div>
      </div>
    \;

    this.bindEvents();

    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'connect-folder') {
        this.selectLocalFolder();
      } else if (action === 'play-video') {
        const index = e.target.closest('.library-item').dataset.index;
        this.playVideo(this.files[index]);
      }
    });
  }

  async selectLocalFolder() {
    try {
      if (!window.showDirectoryPicker) {
        alert('Seu navegador n�o suporta a API de leitura de pastas (File System Access API). Use Chrome ou Edge Desktop.');
        return;
      }

      const dirHandle = await window.showDirectoryPicker();
      await this.scanDirectory(dirHandle);
      this.directoryHandle = dirHandle;
      await idb.set('library-folder', dirHandle);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('Erro ao acessar a pasta: ' + err.message);
      }
    }
  }

  async scanDirectory(dirHandle) {
    this.element.querySelector('.library-status').textContent = 'Escaneando...';
    this.files = []; this.subtitlesFiles = [];
    
    await this.traverseDirectory(dirHandle, '');
    
    this.element.querySelector('.library-status').textContent = 
      \Pasta conectada: \ (\ arquivos)\;
      
    this.renderFiles();
  }

  async traverseDirectory(dirHandle, path) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (['mp4', 'webm', 'mkv', 'pdf'].includes(ext)) {
          this.files.push({ handle: entry, path: path + entry.name, type: ext, name: entry.name, basePath: path });
        } else if (['vtt', 'srt'].includes(ext)) {
          this.subtitlesFiles.push({ handle: entry, path: path + entry.name, type: ext, name: entry.name, basePath: path });
        }
      } else if (entry.kind === 'directory') {
        await this.traverseDirectory(entry, path + entry.name + '/');
      }
    }
  }

  renderFiles() {
    const grid = this.element.querySelector('.library-grid');
    if (this.files.length === 0) {
      grid.innerHTML = '<p class="text-secondary">Nenhum v�deo ou PDF encontrado nesta pasta.</p>';
      return;
    }

    grid.innerHTML = this.files.map((file, index) => \
      <div class="library-item card" data-index="\" style="padding: 16px; border-radius: var(--radius-lg); background: var(--surface-bg); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <i data-lucide="\" class="w-8 h-8 text-primary"></i>
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <strong title="\">\</strong>
            <div style="font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis;">\</div>
          </div>
        </div>
        \

  async playVideo(fileObj) {
    try {
      const file = await fileObj.handle.getFile();
      const url = URL.createObjectURL(file);
      
      const baseName = fileObj.name.replace(/\.[^/.]+$/, "");
      const matchedSubs = this.subtitlesFiles.filter(sub => sub.name.startsWith(baseName) && sub.basePath === fileObj.basePath);
      
      const subtitles = [];
      for (const sub of matchedSubs) {
        const subFile = await sub.handle.getFile();
        const subUrl = URL.createObjectURL(subFile);
        subtitles.push({
          src: subUrl,
          lang: sub.name.includes('en') ? 'en' : 'pt',
          label: sub.name.includes('en') ? 'Inglês' : 'Português',
          default: subtitles.length === 0
        });
      }
      
      this.app.navigate('video');
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('play-local-video', { 
          detail: { src: url, title: fileObj.name, subtitles } 
        }));
      }, 200);
      
    } catch (e) {
      console.error(e);
      alert('Erro ao reproduzir: ' + e.message);
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}



