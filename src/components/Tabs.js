// src/components/Tabs.js
export class Tabs {
  constructor(options = {}) {
    this.tabs = options.tabs ?? []; // [{ id, label, icon, content, disabled, badge }]
    this.activeTab = options.activeTab ?? (this.tabs[0]?.id ?? '');
    this.orientation = options.orientation ?? 'horizontal'; // horizontal, vertical
    this.variant = options.variant ?? 'line'; // line, enclosed, soft
    this.onChange = options.onChange ?? (() => {});
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `tabs tabs-${this.orientation} tabs-${this.variant}`;
    
    this.element.innerHTML = `
      <div class="tabs-list" role="tablist" aria-orientation="${this.orientation}">
        ${this.tabs.map((tab, index) => `
          <button
            role="tab"
            id="tab-${tab.id}"
            class="tabs-trigger ${this.activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}"
            aria-selected="${this.activeTab === tab.id}"
            aria-controls="tabpanel-${tab.id}"
            tabindex="${this.activeTab === tab.id ? '0' : '-1'}"
            data-tab="${tab.id}"
            ${tab.disabled ? 'disabled' : ''}
          >
            ${tab.icon ? `<i data-lucide="${tab.icon}" class="w-4 h-4" aria-hidden="true"></i>` : ''}
            <span class="tabs-trigger-label">${this.escapeHtml(tab.label)}</span>
            ${tab.badge ? `<span class="badge badge-primary">${this.escapeHtml(tab.badge)}</span>` : ''}
          </button>
        `).join('')}
        ${this.variant === 'line' ? '<div class="tabs-indicator" aria-hidden="true"></div>' : ''}
      </div>
      <div class="tabs-content">
        ${this.tabs.map(tab => `
          <div
            role="tabpanel"
            id="tabpanel-${tab.id}"
            class="tabs-panel ${this.activeTab === tab.id ? 'active' : ''}"
            aria-labelledby="tab-${tab.id}"
            ${this.activeTab !== tab.id ? 'hidden' : ''}
            tabindex="0"
          >
            ${tab.content ?? ''}
          </div>
        `).join('')}
      </div>
    `;

    this.bindEvents();
    this.updateIndicator();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    const triggers = this.element.querySelectorAll('.tabs-trigger');
    const panels = this.element.querySelectorAll('.tabs-panel');

    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const tabId = trigger.dataset.tab;
        if (!trigger.disabled) this.setActiveTab(tabId);
      });

      trigger.addEventListener('keydown', (e) => {
        const tabsArray = Array.from(triggers).filter(t => !t.disabled);
        const currentIndex = tabsArray.indexOf(trigger);
        
        let newIndex = currentIndex;
        if (this.orientation === 'horizontal') {
          if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabsArray.length;
          else if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
        } else {
          if (e.key === 'ArrowDown') newIndex = (currentIndex + 1) % tabsArray.length;
          else if (e.key === 'ArrowUp') newIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
        }
        
        if (e.key === 'Home') newIndex = 0;
        if (e.key === 'End') newIndex = tabsArray.length - 1;
        
        if (newIndex !== currentIndex) {
          e.preventDefault();
          tabsArray[newIndex].focus();
          tabsArray[newIndex].click();
        }
      });
    });
  }

  setActiveTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || tab.disabled) return;

    this.activeTab = tabId;

    // Update triggers
    this.element.querySelectorAll('.tabs-trigger').forEach(trigger => {
      const isActive = trigger.dataset.tab === tabId;
      trigger.classList.toggle('active', isActive);
      trigger.setAttribute('aria-selected', isActive);
      trigger.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update panels
    this.element.querySelectorAll('.tabs-panel').forEach(panel => {
      const isActive = panel.id === `tabpanel-${tabId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
      if (isActive) panel.focus();
    });

    this.updateIndicator();
    this.onChange(tabId, tab);
  }

  updateIndicator() {
    const indicator = this.element.querySelector('.tabs-indicator');
    const activeTrigger = this.element.querySelector('.tabs-trigger.active');
    if (indicator && activeTrigger && this.variant === 'line') {
      const rect = activeTrigger.getBoundingClientRect();
      const listRect = this.element.querySelector('.tabs-list').getBoundingClientRect();
      indicator.style.width = `${rect.width}px`;
      indicator.style.transform = `translateX(${rect.left - listRect.left}px)`;
    }
  }

  // Public methods
  addTab(tab) {
    this.tabs.push(tab);
    this.rebuild();
  }

  removeTab(tabId) {
    this.tabs = this.tabs.filter(t => t.id !== tabId);
    if (this.activeTab === tabId) {
      this.activeTab = this.tabs[0]?.id ?? '';
    }
    this.rebuild();
  }

  disableTab(tabId, disabled = true) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.disabled = disabled;
      this.rebuild();
    }
  }

  setTabBadge(tabId, badge) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.badge = badge;
      this.rebuild();
    }
  }

  setTabContent(tabId, content) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.content = content;
      const panel = this.element.querySelector(`#tabpanel-${tabId}`);
      if (panel) panel.innerHTML = content;
    }
  }

  rebuild() {
    const parent = this.element.parentNode;
    if (parent) {
      this.element.remove();
      parent.appendChild(this.render());
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}