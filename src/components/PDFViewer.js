// src/components/PDFViewer.js
export class PDFViewer {
  constructor(options = {}) {
    this.src = options.src ?? null;
    this.title = options.title ?? 'Documento PDF';
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.rotation = 0;
    this.fitWidth = true;
    
    this.onPageChange = options.onPageChange ?? (() => {});
    this.onZoomChange = options.onZoomChange ?? (() => {});
    this.onLoad = options.onLoad ?? (() => {});
    this.onError = options.onError ?? (() => {});
    
    this.element = null;
    this.pdfDoc = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'pdf-viewer';
    
    this.element.innerHTML = `
      <div class="pdf-toolbar">
        <div class="pdf-toolbar-left">
          <button class="pdf-btn" data-action="prev-page" title="Página anterior">
            <i data-lucide="chevron-left" class="w-5 h-5"></i>
          </button>
          <div class="pdf-page-info">
            <input type="number" class="pdf-page-input" value="1" min="1" data-action="goto-page">
            <span class="pdf-page-separator">/</span>
            <span class="pdf-page-total">0</span>
          </div>
          <button class="pdf-btn" data-action="next-page" title="Próxima página">
            <i data-lucide="chevron-right" class="w-5 h-5"></i>
          </button>
        </div>
        
        <div class="pdf-toolbar-center">
          <span class="pdf-title">${this.title}</span>
        </div>
        
        <div class="pdf-toolbar-right">
          <button class="pdf-btn" data-action="zoom-out" title="Zoom out">
            <i data-lucide="zoom-out" class="w-5 h-5"></i>
          </button>
          <span class="pdf-zoom-level">100%</span>
          <button class="pdf-btn" data-action="zoom-in" title="Zoom in">
            <i data-lucide="zoom-in" class="w-5 h-5"></i>
          </button>
          <button class="pdf-btn" data-action="fit-width" title="Ajustar largura">
            <i data-lucide="columns" class="w-5 h-5"></i>
          </button>
          <button class="pdf-btn" data-action="rotate" title="Rotacionar">
            <i data-lucide="rotate-cw" class="w-5 h-5"></i>
          </button>
          <span class="pdf-separator"></span>
          <button class="pdf-btn" data-action="download" title="Download">
            <i data-lucide="download" class="w-5 h-5"></i>
          </button>
          <button class="pdf-btn" data-action="print" title="Imprimir">
            <i data-lucide="printer" class="w-5 h-5"></i>
          </button>
        </div>
      </div>
      
      <div class="pdf-content">
        <div class="pdf-loading">
          <div class="spinner"></div>
          <span>Carregando PDF...</span>
        </div>
        <div class="pdf-pages-container"></div>
      </div>
      
      <div class="pdf-thumbnails" style="display: none;">
        <div class="pdf-thumbnails-header">
          <span>Miniaturas</span>
          <button class="pdf-btn" data-action="toggle-thumbnails">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="pdf-thumbnails-list"></div>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      switch (action) {
        case 'prev-page':
          this.prevPage();
          break;
        case 'next-page':
          this.nextPage();
          break;
        case 'zoom-in':
          this.zoomIn();
          break;
        case 'zoom-out':
          this.zoomOut();
          break;
        case 'fit-width':
          this.toggleFitWidth();
          break;
        case 'rotate':
          this.rotate();
          break;
        case 'download':
          this.download();
          break;
        case 'print':
          this.print();
          break;
        case 'toggle-thumbnails':
          this.toggleThumbnails();
          break;
      }
    });

    // Page input
    const pageInput = this.element.querySelector('[data-action="goto-page"]');
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const page = parseInt(e.target.value);
        if (page >= 1 && page <= this.totalPages) {
          this.goToPage(page);
        }
      });
    }

    // Keyboard shortcuts
    this.element.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.prevPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          this.zoomIn();
          break;
        case '-':
          e.preventDefault();
          this.zoomOut();
          break;
        case '0':
          e.preventDefault();
          this.resetZoom();
          break;
      }
    });
  }

  async loadPDF(src) {
    this.src = src;
    this.showLoading(true);

    try {
      // Dynamic import of PDF.js
      const moduleName = 'pdfjs-dist';
      const pdfjsLib = await import(/* @vite-ignore */ moduleName);

      const loadingTask = pdfjsLib.getDocument(src);
      this.pdfDoc = await loadingTask.promise;
      
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      
      this.updatePageInfo();
      this.renderPages();
      this.onLoad(this.pdfDoc);
    } catch (error) {
      console.error('Error loading PDF:', error);
      this.onError(error);
      this.showError('Erro ao carregar o PDF');
    } finally {
      this.showLoading(false);
    }
  }

  async renderPages() {
    const container = this.element.querySelector('.pdf-pages-container');
    if (!container || !this.pdfDoc) return;

    container.innerHTML = '';

    for (let i = 1; i <= this.totalPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: this.scale * (window.devicePixelRatio || 1), rotation: this.rotation });
      
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.dataset.page = i;
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
      
      pageDiv.appendChild(canvas);
      container.appendChild(pageDiv);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    }

    this.scrollToPage(this.currentPage);
  }

  setSrc(src) {
    this.src = src;
    const container = this.element?.querySelector('.pdf-pages-container');
    if (!container) return;
    container.innerHTML = '';
    const object = document.createElement('object');
    object.type = 'application/pdf';
    object.data = src;
    object.className = 'pdf-local-document';
    container.appendChild(object);
    this.showLoading(false);
  }

  async renderCurrentPage() {
    const container = this.element.querySelector('.pdf-pages-container');
    if (!container || !this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: this.scale * (window.devicePixelRatio || 1), rotation: this.rotation });
    
    container.innerHTML = '';
    
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.dataset.page = this.currentPage;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
    canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
    
    pageDiv.appendChild(canvas);
    container.appendChild(pageDiv);

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;
  }

  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    
    this.currentPage = page;
    this.updatePageInfo();
    this.renderCurrentPage();
    this.onPageChange(this.currentPage, this.totalPages);
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  zoomIn() {
    this.scale = Math.min(3, this.scale + 0.25);
    this.updateZoomLevel();
    this.renderCurrentPage();
    this.onZoomChange(this.scale);
  }

  zoomOut() {
    this.scale = Math.max(0.25, this.scale - 0.25);
    this.updateZoomLevel();
    this.renderCurrentPage();
    this.onZoomChange(this.scale);
  }

  resetZoom() {
    this.scale = 1.0;
    this.updateZoomLevel();
    this.renderCurrentPage();
    this.onZoomChange(this.scale);
  }

  toggleFitWidth() {
    this.fitWidth = !this.fitWidth;
    const btn = this.element.querySelector('[data-action="fit-width"]');
    if (btn) btn.classList.toggle('active', this.fitWidth);
    
    if (this.fitWidth) {
      this.resetZoom();
    }
  }

  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.renderCurrentPage();
  }

  download() {
    if (!this.src) return;
    
    const a = document.createElement('a');
    a.href = this.src;
    a.download = `${this.title}.pdf`;
    a.click();
  }

  print() {
    window.print();
  }

  toggleThumbnails() {
    const thumbnails = this.element.querySelector('.pdf-thumbnails');
    if (thumbnails) {
      const isVisible = thumbnails.style.display !== 'none';
      thumbnails.style.display = isVisible ? 'none' : 'block';
    }
  }

  scrollToPage(page) {
    const pageEl = this.element.querySelector(`[data-page="${page}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth' });
    }
  }

  updatePageInfo() {
    const pageInput = this.element.querySelector('[data-action="goto-page"]');
    const pageTotal = this.element.querySelector('.pdf-page-total');
    
    if (pageInput) pageInput.value = this.currentPage;
    if (pageTotal) pageTotal.textContent = this.totalPages;
  }

  updateZoomLevel() {
    const zoomLevel = this.element.querySelector('.pdf-zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  showLoading(show) {
    const loading = this.element.querySelector('.pdf-loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  showError(message) {
    const container = this.element.querySelector('.pdf-pages-container');
    if (container) {
      container.innerHTML = `
        <div class="pdf-error">
          <i data-lucide="alert-circle" class="w-12 h-12"></i>
          <p>${message}</p>
          <button class="btn btn-primary" data-action="retry">Tentar novamente</button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons(container);
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
