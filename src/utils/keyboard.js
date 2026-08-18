// src/utils/keyboard.js
export class Keyboard {
  constructor() {
    this.bindings = new Map();
    this.globalBindings = new Map();
    this.enabled = true;
    this.handler = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handler);
  }

  bind(keys, callback, options = {}) {
    const { global = false, preventDefault = true, allowInInputs = false } = options;
    const keyCombo = this.normalizeKeys(keys);
    const binding = { callback, preventDefault, allowInInputs };
    if (global) {
      this.globalBindings.set(keyCombo, binding);
    } else {
      this.bindings.set(keyCombo, binding);
    }
    return () => this.unbind(keys, { global });
  }

  unbind(keys, options = {}) {
    const { global = false } = options;
    const keyCombo = this.normalizeKeys(keys);
    if (global) {
      this.globalBindings.delete(keyCombo);
    } else {
      this.bindings.delete(keyCombo);
    }
  }

  normalizeKeys(keys) {
    return keys.toLowerCase().split('+').sort().join('+');
  }

  handleKeyDown(event) {
    if (!this.enabled) return;

    const activeElement = document.activeElement;
    const isInput = activeElement?.tagName === 'INPUT' || 
                    activeElement?.tagName === 'TEXTAREA' || 
                    activeElement?.isContentEditable;

    const keyParts = [];
    if (event.ctrlKey || event.metaKey) keyParts.push('ctrl');
    if (event.shiftKey) keyParts.push('shift');
    if (event.altKey) keyParts.push('alt');
    if (event.key !== 'Control' && event.key !== 'Shift' && event.key !== 'Alt' && event.key !== 'Meta') {
      keyParts.push(event.key.toLowerCase());
    }
    const keyCombo = keyParts.sort().join('+');

    // Check global bindings first
    const globalBinding = this.globalBindings.get(keyCombo);
    if (globalBinding) {
      if (!isInput || globalBinding.allowInInputs) {
        if (globalBinding.preventDefault) event.preventDefault();
        globalBinding.callback(event);
        return;
      }
    }

    // Check regular bindings
    const binding = this.bindings.get(keyCombo);
    if (binding) {
      if (!isInput || binding.allowInInputs) {
        if (binding.preventDefault) event.preventDefault();
        binding.callback(event);
      }
    }
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  destroy() { document.removeEventListener('keydown', this.handler); }
}

// Singleton instance
export const keyboard = new Keyboard();

// Default global shortcuts
export function setupGlobalShortcuts(actions) {
  const { 
    playPause, seekBackward10, seekForward10, 
    seekBackward30, seekForward30, volumeUp, volumeDown, 
    mute, fullscreen, speedCycle, nextTrack, prevTrack,
    search, toggleSidebar, showHelp 
  } = actions;

  if (playPause) keyboard.bind('space', playPause, { global: true, allowInInputs: false });
  if (seekBackward10) keyboard.bind('arrowleft', seekBackward10, { global: true });
  if (seekForward10) keyboard.bind('arrowright', seekForward10, { global: true });
  if (seekBackward30) keyboard.bind('shift+arrowleft', seekBackward30, { global: true });
  if (seekForward30) keyboard.bind('shift+arrowright', seekForward30, { global: true });
  if (volumeUp) keyboard.bind('arrowup', volumeUp, { global: true });
  if (volumeDown) keyboard.bind('arrowdown', volumeDown, { global: true });
  if (mute) keyboard.bind('m', mute, { global: true });
  if (fullscreen) keyboard.bind('f', fullscreen, { global: true });
  if (speedCycle) keyboard.bind('s', speedCycle, { global: true });
  if (nextTrack) keyboard.bind('n', nextTrack, { global: true });
  if (prevTrack) keyboard.bind('p', prevTrack, { global: true });
  if (search) keyboard.bind('ctrl+k', search, { global: true, allowInInputs: true });
  if (toggleSidebar) keyboard.bind('ctrl+b', toggleSidebar, { global: true });
  if (showHelp) keyboard.bind('?', showHelp, { global: true });
}