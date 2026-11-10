// Diagrama de estructura: cajas de arriba hacia abajo, línea sólida (jerárquica) y punteada (funcional). Sin librerías externas.
(() => {
  const dataEl = document.getElementById('dg-data'); if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent), svg = document.getElementById('dg-svg'), cont = document.getElementById('dg'), NS = 'http://www.w3.org/2000/svg';
  const W = 214, H = 88, GX = 22, GY = 54, PAD = 36, APILAR = data.disp === 'c' ? 4 : Infinity,   // horizontal (norma) por defecto
    FF = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
  // Colores fijos de «papel»: el diagrama se ve, imprime y exporta igual en tema claro u oscuro
  const C = { bg: '#ffffff', bd: '#c9d3e0', tx: '#111827', mu: '#5b6573', ok: '#0f7a5c', wa: '#b36b00', ln: '#7b8794' };
  const banda = n => n <= 10 ? '#0d2a5c' : n <= 25 ? '#1d5fd1' : n <= 40 ? '#3b82f6' : n <= 60 ? '#6366f1' : '#94a3b8';
  const cx = document.createElement('canvas').getContext('2d'), mide = (t, f) => { cx.font = f; return cx.measureText(t).width; };
  const corta = (t, f, max) => { if (mide(t, f) <= max) return t; while (t.length > 1 && mide(t + '…', f) > max) t = t.slice(0, -1); return t + '…'; };
  const envuelve = (t, f, max, n) => {
    const out = []; let cur = '';
    for (const w of String(t).split(/\s+/)) { const p = cur ? cur + ' ' + w : w; if (mide(p, f) <= max) cur = p; else { if (cur) out.push(cur); cur = w; } }
    if (cur) out.push(cur);
    return out.length > n ? out.slice(0, n - 1).concat(corta(out.slice(n - 1).join(' '), f, max)) : out.map(l => corta(l, f, max));
  };
  const FE = '12px ' + FF, FN = '600 13px ' + FF, FT = '11px ' + FF, MAX = W - 24;
  // Empresa: la razón social si cabe en la caja; si no, las siglas (la razón social completa queda en el tooltip y en la leyenda)
  const empresa = n => {
    if (!n.empresas.length) return { t: 'Corporativa', full: 'Corporativa' };
    const pre = n.hereda ? 'Hereda ' : (!n.propia && n.comparte ? 'Sirve a ' : ''), full = n.empresas.map(e => e.r).join(', ');
    if (mide(pre + full, FE) <= MAX) return { t: pre + full, full };
    // Siglas una por una; si no caben todas, «+N» para no perder la cuenta
    const sig = n.empresas.map(e => e.s || e.r); let k = sig.length;
    while (k > 1 && mide(pre + sig.slice(0, k).join(', ') + (k < sig.length ? ' +' + (sig.length - k) : ''), FE) > MAX) k--;
    return { t: corta(pre + sig.slice(0, k).join(', ') + (k < sig.length ? ' +' + (sig.length - k) : ''), FE, MAX), full };
  };
  // ---- Disposición ----
  const by = new Map(data.nodes.map(n => [n.id, { ...n, hijos: [] }]));
  for (const n of by.values()) { const p = by.get(n.padre); if (p) p.hijos.push(n); }
  const ord = (a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es');
  for (const n of by.values()) { n.hijos.sort(ord); n.apila = n.hijos.length >= APILAR && n.hijos.every(h => !h.hijos.length); }
  const raices = [...by.values()].filter(n => !by.has(n.padre)).sort(ord);
  const ancho = n => n._w != null ? n._w : (n._w = !n.hijos.length ? W : n.apila ? W + 30 : Math.max(W, n.hijos.reduce((s, h) => s + ancho(h), 0) + GX * (n.hijos.length - 1)));
  let altoMax = 0;
  const ubica = (n, izq, arriba) => {
    const w = ancho(n); n.y = arriba; altoMax = Math.max(altoMax, arriba + H);
    if (n.apila) { n.x = izq; let y = arriba + H + 18; n.hijos.forEach(h => { h.x = izq + 30; h.y = y; altoMax = Math.max(altoMax, y + H); y += H + 14; }); return; }
    n.x = izq + (w - W) / 2; if (!n.hijos.length) return;
    const tot = n.hijos.reduce((s, h) => s + ancho(h), 0) + GX * (n.hijos.length - 1); let x = izq + (w - tot) / 2;
    n.hijos.forEach(h => { ubica(h, x, arriba + H + GY); x += ancho(h) + GX; });
  };
  let x0 = 0; raices.forEach(r => { ubica(r, x0, 0); x0 += ancho(r) + 60; });
  const total = { w: Math.max(W, x0 - 60), h: altoMax };
  // ---- Dibujo ----
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const txt = (p, x, y, s, f, fill, extra) => { const t = el('text', Object.assign({ x, y, fill, style: 'font:' + f }, extra || {}), p); t.textContent = s; return t; };
  const defs = el('defs', {}, svg), mk = el('marker', { id: 'dg-fl', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', fill: C.wa }, mk);
  const gL = el('g', {}, svg), gF = el('g', { id: 'dg-fun' }, svg), gN = el('g', {}, svg);
  for (const n of by.values()) {
    if (!n.hijos.length) continue;
    const linea = d => el('path', { d, fill: 'none', stroke: C.ln, 'stroke-width': 1.4 }, gL);
    if (n.apila) { const sx = n.x + 15, ult = n.hijos[n.hijos.length - 1]; linea(`M${sx} ${n.y + H}V${ult.y + H / 2}`); n.hijos.forEach(h => { const p = linea(`M${sx} ${h.y + H / 2}H${h.x}`); if (h.salta) p.setAttribute('stroke-dasharray', '2 3'); }); continue; }
    const px = n.x + W / 2, py = n.y + H, my = py + GY / 2;
    n.hijos.forEach(h => { const p = linea(`M${px} ${py}V${my}H${h.x + W / 2}V${h.y}`); if (h.salta) p.setAttribute('stroke-dasharray', '2 3'); });
  }
  for (const l of data.links) {
    const a = by.get(l.de), b = by.get(l.a); if (!a || !b) continue;
    const der = b.x + W / 2 >= a.x + W / 2, x1 = der ? a.x + W : a.x, x2 = der ? b.x : b.x + W, y1 = a.y + H / 2, y2 = b.y + H / 2, dx = Math.max(50, Math.abs(x2 - x1) / 2) * (der ? 1 : -1);
    el('path', { d: `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, fill: 'none', stroke: C.wa, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'marker-end': 'url(#dg-fl)' }, gF);
  }
  for (const n of by.values()) {
    const e = empresa(n), g = el('g', { transform: `translate(${n.x},${n.y})`, 'data-id': n.id, class: 'dg-n', opacity: n.ctx ? 0.45 : 1 }, gN);
    el('title', {}, g).textContent = [n.externa ? '(Depende funcionalmente de esta vista; su superior jerárquico está fuera)' : '', n.nombre, n.tipo + ' · ' + n.codigo, e.full, n.aprueba ? 'Aprueba: ' + (n.aprobadores.join(', ') || 'sin director asignado') : '',
      n.funcionalFuera.length ? 'Dependencia funcional: ' + n.funcionalFuera.join(', ') : ''].filter(Boolean).join('\n');
    el('rect', Object.assign({ width: W, height: H, rx: 9, fill: C.bg, stroke: n.aprueba ? (n.aprobadores.length ? C.ok : C.wa) : C.bd, 'stroke-width': n.aprueba ? 1.8 : 1 }, n.externa ? { 'stroke-dasharray': '5 4', stroke: C.wa } : {}), g);
    el('rect', { x: 1, y: 1, width: W - 2, height: 5, rx: 3, fill: banda(n.nivel) }, g);
    txt(g, 12, 22, corta(n.tipo, FT, n.aprueba ? 86 : MAX), FT, C.mu);
    if (n.aprueba) txt(g, W - 12, 22, corta('✓ ' + (n.aprobadores[0] || 'sin director'), FT, 110), '600 ' + FT, n.aprobadores.length ? C.ok : C.wa, { 'text-anchor': 'end' });
    envuelve(n.nombre, FN, MAX, 2).forEach((l, i) => txt(g, 12, 41 + i * 16, l, FN, C.tx));
    txt(g, 12, H - 12, e.t, FE, C.mu);
    if (n.funcionalFuera.length) txt(g, W - 12, H - 12, '⇢', '600 13px ' + FF, C.wa, { 'text-anchor': 'end' });
  }
  // ---- Vista: zoom y desplazamiento sobre el viewBox ----
  const base = { x: -PAD, y: -PAD, w: total.w + PAD * 2, h: total.h + PAD * 2 }; let vb = { ...base };
  const aplica = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const ajustar = () => { vb = { ...base }; aplica(); };
  const zoom = (k, fx = 0.5, fy = 0.5) => { const nw = Math.min(base.w * 4, Math.max(W * 1.5, vb.w / k)), nh = vb.h * nw / vb.w; vb.x += (vb.w - nw) * fx; vb.y += (vb.h - nh) * fy; vb.w = nw; vb.h = nh; aplica(); };
  ajustar();
  document.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => b.dataset.z === 'fit' ? ajustar() : zoom(+b.dataset.z)));
  cont.addEventListener('wheel', e => { e.preventDefault(); const r = cont.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.15 : 0.87, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
  let arr = null;
  cont.addEventListener('pointerdown', e => { arr = { x: e.clientX, y: e.clientY, vb: { ...vb }, mov: false }; cont.setPointerCapture(e.pointerId); });
  cont.addEventListener('pointermove', e => {
    if (!arr) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y; if (Math.abs(dx) + Math.abs(dy) > 4) arr.mov = true;
    const s = vb.w / cont.clientWidth; vb.x = arr.vb.x - dx * s; vb.y = arr.vb.y - dy * s; aplica();
  });
  cont.addEventListener('pointerup', e => {
    const fue = arr && arr.mov; arr = null; if (fue || !data.esHoy) return;
    const n = document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest && x.closest('.dg-n')).find(Boolean);
    if (n && window.ghAbrir) window.ghAbrir('/config/estructura/' + n.dataset.id);
  });
  cont.addEventListener('keydown', e => {
    const p = vb.w * 0.1, m = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key];
    if (m) { e.preventDefault(); vb.x += m[0]; vb.y += m[1]; aplica(); } else if (e.key === '+' || e.key === '=') zoom(1.2); else if (e.key === '-') zoom(0.83); else if (e.key === '0') ajustar();
  });
  const dot = document.getElementById('dg-dot'); const verDot = () => { gF.style.display = dot && !dot.checked ? 'none' : ''; }; if (dot) { dot.addEventListener('change', verDot); verDot(); }
  // ---- Pantalla completa (con el respaldo webkit de Safari) ----
  const wrap = document.getElementById('dg-wrap'), fs = document.getElementById('dg-fs');
  const enFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (fs && wrap && (wrap.requestFullscreen || wrap.webkitRequestFullscreen)) {
    fs.addEventListener('click', () => { if (enFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap); });
    const cambio = () => { const on = !!enFs(); fs.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa'; fs.setAttribute('aria-pressed', on); ajustar(); cont.focus(); };
    document.addEventListener('fullscreenchange', cambio); document.addEventListener('webkitfullscreenchange', cambio);
  } else if (fs) fs.hidden = true;
  // ---- Imprimir / PDF y exportar imagen ----
  const pr = document.getElementById('dg-print'); if (pr) pr.addEventListener('click', () => { ajustar(); window.print(); });
  window.addEventListener('beforeprint', ajustar);
  const png = document.getElementById('dg-png');
  if (png) png.addEventListener('click', () => {
    const titulo = (document.querySelector('.dg-h h1') || {}).textContent || 'Estructura organizativa', sub = ((document.querySelector('.dg-h .sub') || {}).textContent || '').trim();
    const cl = svg.cloneNode(true), top = 64, esc = 2, w = base.w, h = base.h + top;
    cl.setAttribute('viewBox', `${base.x} ${base.y - top} ${w} ${h}`); cl.setAttribute('width', w * esc); cl.setAttribute('height', h * esc);
    const fondo = document.createElementNS(NS, 'rect'); Object.entries({ x: base.x, y: base.y - top, width: w, height: h, fill: '#fff' }).forEach(([k, v]) => fondo.setAttribute(k, v)); cl.insertBefore(fondo, cl.firstChild);
    [[titulo, '700 20px ' + FF, C.tx, base.y - top + 30], [sub, '13px ' + FF, C.mu, base.y - top + 52]].forEach(([s, f, c, y]) => { const t = document.createElementNS(NS, 'text'); t.setAttribute('x', base.x + PAD); t.setAttribute('y', y); t.setAttribute('fill', c); t.setAttribute('style', 'font:' + f); t.textContent = s; cl.appendChild(t); });
    if (dot && !dot.checked) { const f = cl.querySelector('#dg-fun'); if (f) f.remove(); }
    // data: (no blob:) porque la política de seguridad del portal solo permite imágenes propias o en línea
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl)), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = w * esc; c.height = h * esc; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
      c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'estructura-' + data.fecha + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
    };
    img.onerror = () => { alert('No se pudo generar la imagen. Usa «Imprimir o PDF».'); };
    img.src = url;
  });
})();
