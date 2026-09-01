export function renderLessonCard({ lesson, onOpenId } = {}) {
  const openId = lesson.video?.id || lesson.audio?.id;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `lesson-card lesson-card-${lesson.video ? 'video' : 'audio'}`;
  button.dataset.lessonId = lesson.id;
  if (openId) button.dataset.resourceId = openId;
  button.setAttribute('aria-label', `Abrir aula: ${lesson.title}`);

  const cover = document.createElement('span');
  cover.className = 'lesson-card-cover';
  cover.setAttribute('aria-hidden', 'true');
  if (lesson.video) {
    const placeholder = document.createElement('span');
    placeholder.className = 'lesson-card-video-placeholder';
    cover.appendChild(placeholder);
  } else {
    const waveform = document.createElement('span');
    waveform.className = 'lesson-card-waveform';
    cover.appendChild(waveform);
  }

  const body = document.createElement('span');
  body.className = 'lesson-card-body';
  const badge = document.createElement('span');
  badge.className = 'lesson-card-badge';
  badge.textContent = lesson.video && lesson.audio ? 'Vídeo e áudio' : lesson.video ? 'Vídeo' : 'Áudio';
  const title = document.createElement('span');
  title.className = 'lesson-card-title';
  title.textContent = lesson.title;
  body.append(badge, title);
  button.append(cover, body);
  button.addEventListener('click', () => onOpenId?.(openId));
  return button;
}

export function renderMaterialCard({ item, onOpenId } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lesson-card material-card';
  button.dataset.resourceId = item.id;
  button.setAttribute('aria-label', `Abrir PDF: ${item.title}`);

  const cover = document.createElement('span');
  cover.className = 'lesson-card-cover material-card-cover';
  cover.setAttribute('aria-hidden', 'true');
  const documentMark = document.createElement('span');
  documentMark.className = 'material-card-document';
  cover.appendChild(documentMark);

  const body = document.createElement('span');
  body.className = 'lesson-card-body';
  const badge = document.createElement('span');
  badge.className = 'lesson-card-badge';
  badge.textContent = 'PDF';
  const title = document.createElement('span');
  title.className = 'lesson-card-title';
  title.textContent = item.title;
  body.append(badge, title);
  button.append(cover, body);
  button.addEventListener('click', () => onOpenId?.(item.id));
  return button;
}
