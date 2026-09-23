// src/utils/icons.js

/** Replaces <i data-lucide> placeholders inside an element that is already in the document. */
export function renderIcons(root) {
  if (typeof lucide !== 'undefined' && root?.isConnected) lucide.createIcons({ root });
}
