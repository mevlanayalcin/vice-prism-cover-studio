// Original illustrated characters, cel-shaded in comic-noir style: two three-quarter busts and a
// full-length rim-lit figure. Each is drawn facing the viewer's left in a 1000-unit box (busts
// fill it from the crown at y≈100 to the chest at 1000) and mirrored with `flip`. Light model:
// a warm key from the left, a coloured rim from the right, magenta-plum form shadows, ink keylines.
// Invented people: no likeness of any game character or real person.

import { INK, P, crescent, halftone, inked, lin, rad, within } from './ink-kit.js';

const SKIN = { base: '#eba27e', light: '#ffd2ae', shade: '#a64a5c', deep: '#6d2140' };

function place(ctx, x, y, s, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s / 1000 : s / 1000, s / 1000);
  ctx.translate(-500, -1000);
}

/** Mirror-shade lenses: a whole sunset reflected in each, horizon line and a hard glint. */
function lens(ctx, path, pal, line = 7) {
  inked(ctx, path, lin(ctx, 0, 360, 0, 465, [[0, '#14082a'], [0.38, pal.lensMid], [0.58, pal.lensHot], [0.62, '#fff0c0'], [0.65, '#2a0b3e'], [1, '#0d0518']]), line);
  within(ctx, path, () => {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(380, 470);
    ctx.lineTo(560, 340);
    ctx.lineTo(585, 340);
    ctx.lineTo(405, 470);
    ctx.closePath();
    ctx.fill();
  });
}

/** Hair strand strokes: ink grooves and rim-lit glints along the waves. */
function strands(ctx, d, ink = 'rgba(10,10,13,0.75)', glint = null, width = 5) {
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = ink;
  ctx.stroke(P(d));
  if (glint) {
    ctx.save();
    ctx.translate(-5, -3);
    ctx.strokeStyle = glint;
    ctx.lineWidth = width * 0.6;
    ctx.stroke(P(d));
    ctx.restore();
  }
}

function skinPass(ctx, path, rim, shadeDx = 46) {
  inked(ctx, path, lin(ctx, 330, 0, 650, 0, [SKIN.light, SKIN.base, SKIN.base]), 0);
  crescent(ctx, path, shadeDx, 10, SKIN.shade, 0.92, SKIN.deep);
  crescent(ctx, path, shadeDx * 0.4, 22, SKIN.deep, 0.4);
  crescent(ctx, path, -10, 0, rim, 0.9);
}

/**
 * The Heiress: big sun-shot waves, mirror shades, gold hoops, an open blazer over a black top.
 * pal: { hair, hairLit, jacket, jacketShade, lip, rim, lensMid, lensHot, hoop }
 */
export function heiress(ctx, x, y, s, pal, flip = false) {
  place(ctx, x, y, s, flip);
  ctx.lineJoin = 'round';
  // back hair: one big rolling mass behind head and shoulders
  const back = P('M470 96C612 86 734 160 748 292C792 360 756 424 792 486C834 566 776 626 806 706C822 780 760 838 690 852L410 852C324 836 252 794 262 716C276 646 232 598 260 516C288 438 250 380 278 296C298 176 380 102 470 96Z');
  inked(ctx, back, lin(ctx, 260, 100, 800, 850, [pal.hairLit, pal.hair, '#0b0710']), 8);
  crescent(ctx, back, -14, 0, pal.rim, 0.75);
  strands(ctx, 'M300 330C270 420 310 470 282 560C262 640 300 700 290 780M736 330C770 410 740 470 776 540C806 610 770 690 790 760M330 260C300 340 330 400 300 470M712 420C736 500 712 560 740 640', 'rgba(10,10,13,0.7)', pal.hairLit, 6);
  // neck, with the jaw's cast shadow
  const neck = P('M438 600L446 780L610 780L604 560Z');
  inked(ctx, neck, SKIN.base, 6);
  inked(ctx, P('M444 640Q522 690 604 612L606 720Q526 744 446 712Z'), SKIN.shade, 0);
  // blazer, lapels and the black top
  const jacket = P('M100 1000L150 868C176 812 270 786 404 760L656 760C790 782 852 808 878 866L920 1000Z');
  inked(ctx, jacket, lin(ctx, 110, 760, 912, 1000, [pal.jacketLit ?? '#fff1e6', pal.jacket, pal.jacketShade]), 8);
  crescent(ctx, jacket, 70, 0, pal.jacketShade, 0.8, '#000');
  inked(ctx, P('M420 764L526 930L630 764Z'), '#121018', 6);
  inked(ctx, P('M404 760L512 1000L392 1000L318 828Z'), pal.jacket, 6);
  inked(ctx, P('M656 760L540 1000L668 1000L744 826Z'), pal.jacketShade, 6);
  crescent(ctx, jacket, -10, 0, pal.rim, 0.7);
  strands(ctx, 'M240 900Q280 860 330 850M800 880Q770 850 730 840M520 960L524 1000', 'rgba(10,10,13,0.5)', null, 4);
  // face
  const face = P('M420 238C378 268 358 318 360 360C356 382 348 396 350 412C348 444 344 472 336 500C340 542 358 582 380 612C402 644 442 662 472 662C524 662 572 622 602 576C622 546 632 510 634 480L642 300C602 240 502 224 420 238Z');
  skinPass(ctx, face, pal.rim);
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke(face);
  // ear and gold hoop
  inked(ctx, P('M626 420C652 410 668 440 660 476C654 500 640 512 626 506Z'), SKIN.shade, 5);
  ctx.lineWidth = 16;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.ellipse(640, 552, 26, 40, 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = pal.hoop ?? '#ffd36a';
  ctx.stroke();
  // nose, cheek plane and lips
  strands(ctx, 'M474 446C470 478 456 500 462 512C476 522 496 520 506 508', INK, null, 6);
  inked(ctx, P('M480 512Q500 530 520 512Q508 540 482 530Z'), SKIN.shade, 0);
  inked(ctx, P('M540 470Q600 500 612 560Q580 520 540 510Z'), SKIN.shade, 0);
  inked(ctx, P('M428 566C450 552 470 548 486 556C502 548 528 552 548 568C516 574 470 576 428 566Z'), pal.lip, 5);
  inked(ctx, P('M434 570C470 604 526 598 546 570C510 580 470 580 434 570Z'), pal.lip, 5);
  ctx.fillStyle = 'rgba(255,240,230,0.7)';
  ctx.beginPath();
  ctx.ellipse(490, 584, 18, 5, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // shades
  lens(ctx, P('M362 374C390 358 446 360 472 372C480 402 470 442 440 450C398 454 370 432 362 400Z'), pal);
  lens(ctx, P('M498 372C540 358 612 360 632 378C638 412 620 454 576 460C530 462 500 432 498 400Z'), pal);
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(470, 386);
  ctx.quadraticCurveTo(486, 376, 500, 386);
  ctx.moveTo(632, 382);
  ctx.lineTo(660, 396);
  ctx.stroke();
  // front hair: a side-swept wave over the brow, falling past the far cheek
  const front = P('M470 94C622 90 726 168 704 300C694 360 664 384 644 424C652 340 604 270 540 250C480 240 430 270 402 330C382 372 372 420 340 452C318 380 310 300 340 220C370 148 420 100 470 94Z');
  inked(ctx, front, lin(ctx, 330, 100, 700, 420, [pal.hairLit, pal.hair, pal.hair]), 8);
  halftone(ctx, front, '#000', 0.25, 0.8);
  strands(ctx, 'M470 120C560 130 640 190 660 300M440 130C400 180 380 260 360 380M520 160C600 200 640 260 650 360M410 200C440 160 520 150 580 180', 'rgba(10,10,13,0.7)', pal.hairLit, 6);
  ctx.restore();
}

/**
 * The Driver: slick swept-back hair, aviators, a square stubbled jaw, a pale linen jacket over a
 * printed shirt and a gold chain.
 * pal: { hair, hairLit, jacket, jacketShade, shirt, shirtPrint, rim, lensMid, lensHot, chain }
 */
export function driver(ctx, x, y, s, pal, flip = false) {
  place(ctx, x, y, s, flip);
  ctx.lineJoin = 'round';
  const neck = P('M424 600L420 760L640 760L630 540Z');
  inked(ctx, neck, SKIN.base, 6);
  inked(ctx, P('M424 650Q530 700 632 600L636 730Q530 750 422 720Z'), SKIN.shade, 0);
  // jacket and open shirt
  const jacket = P('M50 1000L100 850C130 790 240 760 390 728L670 728C830 756 900 790 920 850L970 1000Z');
  inked(ctx, jacket, lin(ctx, 60, 760, 960, 1000, [pal.jacketLit ?? '#fbf4ea', pal.jacket, pal.jacketShade]), 8);
  crescent(ctx, jacket, 80, 0, pal.jacketShade, 0.85, '#000');
  const shirt = P('M392 730L530 1000L666 730L624 712L530 840L436 712Z');
  inked(ctx, shirt, pal.shirt, 6);
  within(ctx, shirt, () => halftone(ctx, null, pal.shirtPrint, 0.7, 1.4, 0.8));
  inked(ctx, P('M446 728L530 850L614 728L596 800L530 880L466 800Z'), SKIN.base, 0);
  inked(ctx, P('M384 730L486 1000L350 1000L282 800Z'), pal.jacket, 6);
  inked(ctx, P('M676 730L576 1000L704 1000L776 800Z'), pal.jacketShade, 6);
  crescent(ctx, jacket, -10, 0, pal.rim, 0.75);
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(462, 750);
  ctx.quadraticCurveTo(530, 840, 604, 750);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = pal.chain ?? '#ffd36a';
  ctx.stroke();
  // face: broad jaw, stubble screened onto the lower third
  const face = P('M410 230C370 260 350 310 352 360C348 384 340 400 344 420C342 456 336 480 332 506C338 546 350 586 372 616C396 652 440 672 482 670C542 664 592 626 616 580C632 550 642 514 644 480L652 290C612 230 500 216 410 230Z');
  skinPass(ctx, face, pal.rim, 52);
  within(ctx, P('M330 520C352 610 430 676 494 672C566 664 616 610 640 516C596 560 520 566 480 566C420 566 366 546 330 520Z'), () => halftone(ctx, null, '#3a1a2a', 0.5, 0.55, 0.2));
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke(face);
  inked(ctx, P('M640 410C672 400 690 440 680 480C672 506 656 516 640 508Z'), SKIN.shade, 5);
  // brow, nose, mouth
  strands(ctx, 'M362 352Q410 336 470 350M500 350Q560 334 626 350', INK, null, 12);
  strands(ctx, 'M478 440C474 476 458 504 466 518C482 528 504 526 514 512', INK, null, 6);
  inked(ctx, P('M486 518Q506 536 526 516Q514 546 488 536Z'), SKIN.shade, 0);
  strands(ctx, 'M430 584C468 594 512 590 552 572', INK, null, 7);
  inked(ctx, P('M444 594Q490 612 540 586Q520 606 450 604Z'), SKIN.shade, 0);
  // aviators with a gold bar
  lens(ctx, P('M356 382C398 372 452 374 470 386C468 424 450 456 416 456C382 452 362 424 356 382Z'), pal, 7);
  lens(ctx, P('M494 386C532 374 612 374 634 386C632 430 606 464 568 464C524 462 498 430 494 386Z'), pal, 7);
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.chain ?? '#ffd36a';
  ctx.beginPath();
  ctx.moveTo(356, 382);
  ctx.lineTo(640, 384);
  ctx.lineTo(676, 400);
  ctx.stroke();
  // swept-back hair with a lit crest
  const hair = P('M350 340C326 290 318 240 336 200Q336 150 392 140Q414 94 478 104Q532 78 578 108Q640 104 658 158Q708 192 696 262Q704 296 692 316C686 342 674 364 660 394L650 314C624 288 592 276 560 276C530 276 506 290 476 282C432 270 392 290 350 340Z');
  inked(ctx, P('M640 300L664 300L666 430L646 440Z'), pal.hair, 4);
  inked(ctx, hair, lin(ctx, 350, 110, 690, 380, [pal.hairLit, pal.hair, pal.hair]), 8);
  crescent(ctx, hair, -10, -10, pal.rim, 0.85);
  strands(ctx, 'M352 236C400 170 520 150 650 210M372 286C420 220 540 196 676 270M430 276C480 236 580 236 668 310M452 136C420 160 396 196 386 240', 'rgba(10,10,13,0.75)', pal.hairLit, 6);
  ctx.restore();
}

/**
 * A full-length figure in silhouette, leaning back with a jacket over one shoulder: pure ink
 * with a rim light down the lit side. `y` is the feet, `h` the height.
 */
export function standingFigure(ctx, x, y, h, { rim = '#ff8a5b', body = INK, flip = false } = {}) {
  const k = h / 1000;
  const shape = P('M512 30C556 30 582 62 580 104C578 140 562 164 544 172L548 192C620 204 664 232 672 300L688 470Q690 520 660 540L640 560L632 600L628 760L660 984L590 992L540 690L514 600L494 692L468 990L398 984L420 760L410 600L404 560L384 540Q356 520 360 470L376 300C384 232 428 204 496 192L498 172C478 162 462 136 464 102C466 60 480 30 512 30Z');
  for (const [dx, color] of [[-9, rim], [0, body]]) {
    ctx.save();
    ctx.translate(x + dx * k, y);
    ctx.scale(flip ? -k : k, k);
    ctx.translate(-520, -1000);
    ctx.fillStyle = color;
    ctx.fill(shape);
    ctx.restore();
  }
}

/** Default palettes keyed by time of day, shared by the scenes. */
export const FIGURE_PALETTES = {
  sunset: { hair: '#2a1020', hairLit: '#8a3a3a', jacket: '#ff9a8a', jacketLit: '#ffe0cc', jacketShade: '#b2386a', lip: '#d4204e', rim: '#ffe08a', lensMid: '#9c2a86', lensHot: '#ff8a4a', hoop: '#ffd36a', shirt: '#1f9aa6', shirtPrint: '#ffd36a', chain: '#ffd36a' },
  neon: { hair: '#0d0814', hairLit: '#3a2a6a', jacket: '#3a2a7a', jacketLit: '#8a7ae0', jacketShade: '#150a33', lip: '#ff2f7a', rim: '#38e8ff', lensMid: '#3a2aa0', lensHot: '#ff3fc0', hoop: '#c0f8ff', shirt: '#ff2f87', shirtPrint: '#1a0a2a', chain: '#ffd36a' },
  coast: { hair: '#3a1c12', hairLit: '#b0663a', jacket: '#fff4e2', jacketLit: '#ffffff', jacketShade: '#5fbcb6', lip: '#e2404e', rim: '#fff3c0', lensMid: '#1a7a8a', lensHot: '#ffb46a', hoop: '#ffd36a', shirt: '#ff8a5a', shirtPrint: '#fff4e2', chain: '#ffd36a' },
};

/** Warm light pooled behind a bust, so the head always separates from a busy ground. */
export function haloBehind(ctx, x, y, r, color) {
  ctx.fillStyle = rad(ctx, x, y, 0, r, [color, color.replace(/[\d.]+\)$/, '0)')]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
