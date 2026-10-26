export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (html) el.innerHTML = html;
  return el;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function toast(text: string, kind: 'ok' | 'info' | 'big' = 'info'): void {
  const t = h('div', { class: `toast toast-${kind}` }, text);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), kind === 'big' ? 2600 : 1800);
  setTimeout(() => t.remove(), kind === 'big' ? 3100 : 2300);
}

/** Floating "+5 🪙" text at a screen point. */
export function floatText(x: number, y: number, text: string): void {
  const t = h('div', { class: 'float-text' }, text);
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  document.body.append(t);
  setTimeout(() => t.remove(), 1300);
}

export function burst(x: number, y: number, emojis = ['💖', '✨', '⭐', '💛'], count = 10): void {
  for (let i = 0; i < count; i++) {
    const p = h('div', { class: 'burst' }, emojis[i % emojis.length]);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 60;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    document.body.append(p);
    setTimeout(() => p.remove(), 1000);
  }
}

export function confetti(count = 60): void {
  const colors = ['#ff8fb1', '#ffe066', '#7fd0ff', '#7ccf6a', '#c88bff', '#ffb84d'];
  for (let i = 0; i < count; i++) {
    const c = h('div', { class: 'confetti' });
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    c.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    document.body.append(c);
    setTimeout(() => c.remove(), 3800);
  }
}

export interface Modal {
  el: HTMLElement;
  close: () => void;
}

export function modal(html: string, opts: { className?: string; onClose?: () => void; dismissable?: boolean } = {}): Modal {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: `modal ${opts.className ?? ''}` }, html);
  back.append(box);
  document.body.append(back);
  const close = () => {
    back.classList.add('out');
    setTimeout(() => back.remove(), 200);
    opts.onClose?.();
  };
  if (opts.dismissable !== false) back.addEventListener('pointerdown', (e) => e.target === back && close());
  box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el: box, close };
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
}
