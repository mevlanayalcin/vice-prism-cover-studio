// Showcase and 3D box case, loaded on demand. The showcase shows the finished cover at export
// resolution with every post size beside it; the box case wraps the live cover onto a collector's
// case with a printed spine, built from CSS 3D transforms over a copy of the poster canvas.

const sheet = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('../showcase.css', import.meta.url).href });
await new Promise((resolve) => {
  sheet.onload = sheet.onerror = resolve;
  document.head.append(sheet);
});

const el = (tag, cls, html) => Object.assign(document.createElement(tag), { className: cls ?? '', innerHTML: html ?? '' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function copyCanvas(source, maxW = source.width) {
  const k = Math.min(1, maxW / source.width);
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(source.width * k), height: Math.round(source.height * k) });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export function buildBoxCase(cover, { title, grade, height = 420, spin = -26 }) {
  const w = Math.round((height * cover.width) / cover.height);
  const d = Math.round(Math.max(height < 120 ? 8 : 22, height * 0.07));
  const scene = el('div', 'box3d');
  scene.style.cssText = `--w:${w}px;--h:${height}px;--d:${d}px`;
  const box = el('div', 'box3d-case');
  box.style.transform = `rotateX(6deg) rotateY(${spin}deg)`;
  const front = el('div', 'box3d-face box3d-front');
  front.append(copyCanvas(cover, w * 2), el('i', 'box3d-sheen'));
  const spine = el('div', 'box3d-face box3d-spine', `<b>VP</b><span>${esc(title)}</span><em>17+</em>`);
  spine.style.background = `linear-gradient(180deg, #0a0a0d 0 9%, ${grade.accent} 9%, ${grade.accent2} 60%, #0a0a0d 60%)`;
  box.append(el('div', 'box3d-face box3d-back'), spine, el('div', 'box3d-face box3d-top'), front);
  scene.append(box, el('i', 'box3d-floor'));
  return scene;
}

export function openShowcase({ state, sizes, renderCover, grade, layoutName, panels, onExport }) {
  document.querySelector('.showcase')?.remove();
  const size = sizes.find((s) => s.id === state.size) ?? sizes[0];
  const tall = size.height >= size.width;
  const title = (state.caption.title || 'VICE HORIZON').toUpperCase();
  const root = el('div', `showcase ${tall ? 'is-tall' : 'is-wide'}`);
  root.setAttribute('role', 'dialog');
  const bar = el('header', 'sc-bar', `<span class="sc-brand"><i></i>VICE PRISM <b>Showcase</b></span>
    <span class="sc-meta"><em>Export ready</em> ${size.width} × ${size.height} · PNG · ${panels} panels · ${esc(layoutName)} · ${esc(grade.name)}</span>
    <span class="sc-actions"><button type="button" class="sc-export">↓ Export PNG</button><button type="button" class="sc-close">Close · Esc</button></span>`);
  const stage = el('div', 'sc-stage');
  const hero = el('figure', 'sc-hero');
  const cover = renderCover(size.id);
  hero.append(copyCanvas(cover));
  const strip = el('div', 'sc-sizes');
  for (const s of sizes) {
    const card = el('figure', `sc-size${s.id === size.id ? ' on' : ''}`);
    card.append(copyCanvas(s.id === size.id ? cover : renderCover(s.id, 'draft'), 360), el('figcaption', '', `<b>${s.ratio}</b>${s.width} × ${s.height}`));
    strip.append(card);
  }
  stage.append(hero);
  if (tall) {
    const side = el('aside', 'sc-side');
    side.append(buildBoxCase(cover, { title, grade, height: 330, spin: -30 }), el('div', 'sc-spec', `<b>${esc(title)}</b><span>${esc(state.caption.subtitle || '')}</span><em>Collector's box case · live 3D preview</em>`), strip);
    stage.append(side);
  } else {
    const box = el('figure', 'sc-size sc-box');
    box.append(buildBoxCase(cover, { title, grade, height: 50, spin: -32 }), el('figcaption', '', '<b>3D</b>box case'));
    strip.prepend(box);
    stage.append(strip);
  }
  root.append(bar, stage);
  document.body.append(root);
  const close = () => {
    root.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => event.key === 'Escape' && close();
  window.addEventListener('keydown', onKey);
  bar.querySelector('.sc-close').addEventListener('click', close);
  bar.querySelector('.sc-export').addEventListener('click', () => onExport?.());
  return { close, root };
}
