export class LocalMediaSession {
  constructor(item) { this.item = item; this.src = ''; this.captions = []; this.transcriptText = ''; this.diagnostics = []; this.urls = []; }
  static async open(item, library) {
    const session = new LocalMediaSession(item);
    session.src = session.url(await file(item.handle ?? item.fileHandle ?? library?.fileHandles?.get(item.id)));
    const sidecar = item.sidecarHandle ?? item.transcriptHandle ?? library?.fileHandles?.get(item.transcript?.id);
    if (!sidecar) return session;
    const transcript = await file(sidecar);
    const extension = String(item.transcript?.name ?? transcript.name).split('.').pop().toLowerCase();
    if (extension === 'txt') session.transcriptText = await transcript.text();
    if (extension === 'vtt') session.captions = [caption(session.url(transcript))];
    if (extension === 'srt') session.captions = [caption(session.url(new Blob([vtt(await transcript.text(), session.diagnostics)], { type: 'text/vtt' })) )];
    return session;
  }
  url(file) { const url = URL.createObjectURL(file); this.urls.push(url); return url; }
  close() { this.urls.forEach((url) => URL.revokeObjectURL(url)); this.urls = []; }
}
async function file(handle) {
  if (!handle?.getFile) throw unavailable();
  try { return await handle.getFile(); } catch { throw unavailable(); }
}
function unavailable() { return Object.assign(new Error('Arquivo local indisponível.'), { code: 'file-unavailable' }); }
function caption(src) { return { src, lang: 'pt', label: 'Português', default: true }; }
function vtt(source, diagnostics) {
  const cues = String(source).replace(/\r/g, '').split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split('\n').filter(Boolean);
    const time = lines.findIndex((line) => /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}$/.test(line));
    if (time < 0) { if (lines.length) diagnostics.push({ code: 'invalid-srt-cue', block }); return []; }
    return [`${lines[time].replaceAll(',', '.')}\n${lines.slice(time + 1).join('\n')}`];
  });
  return `WEBVTT\n\n${cues.join('\n\n')}`;
}
