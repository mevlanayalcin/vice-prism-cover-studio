// Showcase and box-case preview, loaded on demand with import() so the studio's first load stays
// small. The showcase presents the finished cover at export resolution under studio light with
// the other post sizes beside it; the box case wraps the live cover onto a 3D collector's case
// with a printed spine, built from CSS 3D transforms over a copy of the poster canvas.

const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Copy a rendered cover into a fresh canvas (the poster canvas keeps redrawing underneath). */
function copyCanvas(source, maxW = source.width) {
  const k = Math.min(1, maxW / source.width);
  const c = document.createElement('canvas');
  c.width = Math.round(source.width * k);
  c.height = Math.round(source.height * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/**
 * A 3D box case: the cover on the front face, a spine carrying the title, the case's top edge.
 * `height` is the on-screen front height in CSS pixels.
 */
export function buildBoxCase(cover, { title, grade, height = 420, spin = -26 }) {
  const ratio = cover.width / cover.height;
  const h = height;
  const w = Math.round(h * ratio);
  const d = Math.round(Math.max(22, h * 0.07));
  const scene = el('div', 'box3d');
  scene.style.setProperty('--w', `${w}px`);
  scene.style.setProperty('--h', `${h}px`);
  scene.style.setProperty('--d', `${d}px`);
  const box = el('div', 'box3d-case');
  box.style.transform = `rotateX(6deg) rotateY(${spin}deg)`;
  const front = el('div', 'box3d-face box3d-front');
  const art = copyCanvas(cover, w * 2);
  front.append(art, el('i', 'box3d-sheen'));
  const spine = el('div', 'box3d-face box3d-spine', `<b>VP</b><span>${escapeHtml(title)}</span><em>17+</em>`);
  spine.style.background = `linear-gradient(180deg, #0a0a0d 0 9%, ${grade.accent} 9%, ${grade.accent2} 60%, #0a0a0d 60%)`;
  const top = el('div', 'box3d-face box3d-top');
  const back = el('div', 'box3d-face box3d-back');
  box.append(back, spine, top, front);
  scene.append(box, el('i', 'box3d-floor'));
  return scene;
}

/**
 * Open the showcase over the studio. `renderCover(sizeId)` returns a canvas of the current cover
 * at that post size; `onExport` runs the real exporter. Esc or Close dismisses it.
 */
export function openShowcase({ state, sizes, renderCover, grade, layoutName, panels, onExport }) {
  document.querySelector('.showcase')?.remove();
  const size = sizes.find((s) => s.id === state.size) ?? sizes[0];
  const tall = size.height >= size.width;
  const root = el('div', `showcase ${tall ? 'is-tall' : 'is-wide'}`);
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Cover showcase');
  const title = (state.caption.title || 'VICE HORIZON').toUpperCase();
  const bar = el('header', 'sc-bar', `
    <span class="sc-brand"><i></i>VICE PRISM <b>Showcase</b></span>
    <span class="sc-meta"><em>Export ready</em> ${size.width} × ${size.height} · PNG · ${panels} panels · ${escapeHtml(layoutName)} · ${escapeHtml(grade.name)}</span>
    <span class="sc-actions"><button type="button" class="sc-export">↓ Export PNG</button><button type="button" class="sc-close">Close · Esc</button></span>`);
  const stage = el('div', 'sc-stage');
  const hero = el('figure', 'sc-hero');
  const cover = renderCover(size.id);
  hero.append(copyCanvas(cover));
  stage.append(hero);

  const strip = el('div', 'sc-sizes');
  for (const s of sizes) {
    const card = el('figure', `sc-size${s.id === size.id ? ' on' : ''}`);
    const thumb = s.id === size.id ? copyCanvas(cover, 360) : copyCanvas(renderCover(s.id, 'draft'), 360);
    card.append(thumb, el('figcaption', '', `<b>${s.ratio}</b>${s.width} × ${s.height}`));
    strip.append(card);
  }

  if (tall) {
    const side = el('aside', 'sc-side');
    side.append(buildBoxCase(cover, { title, grade, height: 330, spin: -30 }));
    side.append(el('div', 'sc-spec', `<b>${escapeHtml(title)}</b><span>${escapeHtml(state.caption.subtitle || '')}</span><em>Collector's box case · live 3D preview</em>`));
    side.append(strip);
    stage.append(side);
  } else {
    stage.append(strip);
  }
  root.append(bar, stage);
  document.body.append(root);

  const close = () => {
    root.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  window.addEventListener('keydown', onKey);
  bar.querySelector('.sc-close').addEventListener('click', close);
  bar.querySelector('.sc-export').addEventListener('click', () => onExport?.());
  return { close, root };
}
