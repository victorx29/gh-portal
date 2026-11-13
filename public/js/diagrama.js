// Diagrama de estructura: cajas de arriba hacia abajo, línea sólida (jerárquica) y punteada (funcional). Sin librerías externas.
(() => {
  const dataEl = document.getElementById('dg-data'); if (!dataEl) return;
  const data = JSON.parse(dataEl.textContent), svg = document.getElementById('dg-svg'), cont = document.getElementById('dg'), NS = 'http://www.w3.org/2000/svg';
  const W = 214, H = 88, GX = 22, GY = 54, PAD = 36, APILAR = 4, FF = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
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
  const empresa = (n, max = MAX) => {
    if (n.pie) return { t: corta(n.pie, FE, max), full: n.pie + (n.empresas.length ? '\n' + n.empresas.map(e => e.r).join(', ') : '') };
    if (!n.empresas.length) return { t: n.unidad_id ? '—' : 'Corporativa', full: 'Corporativa' };
    const pre = n.hereda ? 'Hereda ' : (!n.propia && n.comparte ? 'Sirve a ' : ''), full = n.empresas.map(e => e.r).join(', ');
    if (mide(pre + full, FE) <= max) return { t: pre + full, full };
    // Siglas una por una; si no caben todas, «+N» para no perder la cuenta
    const sig = n.empresas.map(e => e.s || e.r); let k = sig.length;
    while (k > 1 && mide(pre + sig.slice(0, k).join(', ') + (k < sig.length ? ' +' + (sig.length - k) : ''), FE) > max) k--;
    return { t: corta(pre + sig.slice(0, k).join(', ') + (k < sig.length ? ' +' + (sig.length - k) : ''), FE, max), full };
  };
  // ---- Disposición ----
  // h = horizontal (norma) · c = compacta (apila hojas) · k = cascada por columnas (2 niveles en horizontal y el resto en cascada)
  const MODO = data.disp === 'c' ? 'c' : data.disp === 'k' ? 'k' : 'h', HC = 54, IND = 22, GK = 8;
  const by = new Map(data.nodes.map(n => [n.id, { ...n, hijos: [], h: H }]));
  for (const n of by.values()) { const p = by.get(n.padre); if (p) p.hijos.push(n); }
  const ord = (a, b) => (a.rango != null ? a.rango : 1e9) - (b.rango != null ? b.rango : 1e9) || a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es');
  for (const n of by.values()) { n.hijos.sort(ord); n.apila = MODO === 'c' && n.hijos.length >= APILAR && n.hijos.every(h => !h.hijos.length); }
  const raices = [...by.values()].filter(n => !by.has(n.padre)).sort(ord);
  let altoMax = 0;
  // Filas por nivel jerárquico (solo en horizontal y si hay niveles): cada rango presente es una fila; un puesto va en la fila de su nivel,
  // nunca más arriba que una fila bajo su jefe (si su nivel es igual o superior al del jefe, se marca para revisar)
  const rangos = [...new Set(data.nodes.map(n => n.rango).filter(x => x != null))].sort((a, b) => a - b), idxR = new Map(rangos.map((r, i) => [r, i]));
  const FILAS = MODO === 'h' && rangos.length > 0;
  const asignar = (n, padre) => {
    const quiere = n.rango != null ? idxR.get(n.rango) : null, pf = padre ? padre.fila : null;
    n.fila = pf == null ? (quiere != null ? quiere : 0) : quiere != null && quiere > pf ? quiere : pf + 1;
    // Se marca solo el puesto cuyo nivel es igual o superior al de su jefe (el dato mal cargado), no a sus dependientes
    if (padre && n.rango != null && padre.rango != null && n.rango <= padre.rango) n.fueraNivel = true;
    n.hijos.forEach(h => asignar(h, n));
  };
  // Cascada: el subárbol baja con sangría; cajas bajas (nombre y empresa)
  const prof = (n, d) => n.hijos.reduce((m, h) => Math.max(m, prof(h, d + 1)), d);
  const cascada = (n, x, y) => { n.hijos.forEach(h => { h.mini = true; h.h = HC; h.x = x + IND; h.y = y; altoMax = Math.max(altoMax, y + HC); y = cascada(h, x + IND, y + HC + GK); }); return y; };
  const ancho = n => {
    if (n._w != null) return n._w;
    if (n.columna) return (n._w = W + IND * prof(n, 0));
    if (!n.hijos.length) return (n._w = W);
    if (n.apila) return (n._w = W + 30);
    return (n._w = Math.max(W, n.hijos.reduce((s, h) => s + ancho(h), 0) + GX * (n.hijos.length - 1)));
  };
  if (MODO === 'k') raices.forEach(r => r.hijos.forEach(c => { c.columna = true; }));
  const ubica = (n, izq, arriba) => {
    const w = ancho(n); n.y = FILAS ? n.fila * (H + GY) : arriba; altoMax = Math.max(altoMax, n.y + n.h);
    if (n.columna) { n.x = izq; cascada(n, izq, arriba + H + 14); return; }
    if (n.apila) { n.x = izq; let y = arriba + H + 18; n.hijos.forEach(h => { h.x = izq + 30; h.y = y; altoMax = Math.max(altoMax, y + H); y += H + 14; }); return; }
    n.x = izq + (w - W) / 2; if (!n.hijos.length) return;
    const tot = n.hijos.reduce((s, h) => s + ancho(h), 0) + GX * (n.hijos.length - 1); let x = izq + (w - tot) / 2;
    n.hijos.forEach(h => { ubica(h, x, arriba + H + GY); x += ancho(h) + GX; });
  };
  if (FILAS) raices.forEach(r => asignar(r, null));
  let x0 = 0; raices.forEach(r => { ubica(r, x0, 0); x0 += ancho(r) + 60; });
  const total = { w: Math.max(W, x0 - 60), h: altoMax };
  // ---- Dibujo ----
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const txt = (p, x, y, s, f, fill, extra) => { const t = el('text', Object.assign({ x, y, fill, style: 'font:' + f }, extra || {}), p); t.textContent = s; return t; };
  const defs = el('defs', {}, svg), mk = el('marker', { id: 'dg-fl', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', fill: C.wa }, mk);
  const gL = el('g', {}, svg), gF = el('g', { id: 'dg-fun' }, svg), gN = el('g', {}, svg);
  const linea = (d, salta) => { const p = el('path', { d, fill: 'none', stroke: C.ln, 'stroke-width': 1.4 }, gL); if (salta) p.setAttribute('stroke-dasharray', '2 3'); };
  for (const n of by.values()) {
    if (!n.hijos.length) continue;
    if (n.columna || n.mini || n.apila) {   // espina vertical a la izquierda y ramas horizontales
      const sx = n.x + (n.apila ? 15 : 11), ult = n.hijos[n.hijos.length - 1];
      linea(`M${sx} ${n.y + n.h}V${ult.y + ult.h / 2}`); n.hijos.forEach(h => linea(`M${sx} ${h.y + h.h / 2}H${h.x}`, h.salta)); continue;
    }
    const px = n.x + W / 2, py = n.y + n.h, my = py + GY / 2;
    n.hijos.forEach(h => linea(`M${px} ${py}V${my}H${h.x + W / 2}V${h.y}`, h.salta));
  }
  for (const l of data.links) {
    const a = by.get(l.de), b = by.get(l.a); if (!a || !b) continue;
    // Línea punteada recta en ángulo, como en los organigramas de GH: de lado a lado si no se solapan en horizontal; si no, de arriba abajo
    let d;
    if (a.x + W < b.x || b.x + W < a.x) {
      const der = b.x > a.x, x1 = der ? a.x + W : a.x, x2 = der ? b.x : b.x + W, y1 = a.y + a.h / 2, y2 = b.y + b.h / 2, xm = der ? x2 - 12 : x2 + 12;   // gira junto al destino, por el pasillo entre cajas
      d = `M${x1} ${y1}H${xm}V${y2}H${x2}`;
    } else {
      const abajo = b.y > a.y, y1 = abajo ? a.y + a.h : a.y, y2 = abajo ? b.y : b.y + b.h, x1 = a.x + W * 0.7, x2 = b.x + W * 0.7, ym = abajo ? y2 - 12 : y2 + 12;
      d = `M${x1} ${y1}V${ym}H${x2}V${y2}`;
    }
    el('path', { d, fill: 'none', stroke: C.wa, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'marker-end': 'url(#dg-fl)' }, gF);
  }
  for (const n of by.values()) {
    const hcW = n.hcTxt ? mide(n.hcTxt, '600 ' + FE) + 10 : 0, e = empresa(n, MAX - hcW), g = el('g', { transform: `translate(${n.x},${n.y})`, 'data-id': n.id, class: 'dg-n', opacity: n.ctx ? 0.45 : 1 }, gN);
    el('title', {}, g).textContent = [n.fueraNivel ? '⚠ Su nivel jerárquico es igual o superior al de su jefe: revisa el nivel del perfil o la línea de reporte' : '', n.rangoNombre ? 'Nivel: ' + n.rangoNombre : '', n.externa ? '(Depende funcionalmente de esta vista; su superior jerárquico está fuera)' : '', n.nombre, n.tipo + ' · ' + n.codigo, e.full,
      n.aprueba ? 'Aprueba: ' + (n.aprobadores.join(', ') || 'sin director asignado') : '', n.hcTxt ? 'Plantilla: ' + n.hcTxt : '', n.funcionalFuera.length ? 'Dependencia funcional: ' + n.funcionalFuera.join(', ') : ''].filter(Boolean).join('\n');
    el('rect', Object.assign({ width: W, height: n.h, rx: n.mini ? 7 : 9, fill: C.bg, stroke: n.aprueba ? (n.aprobadores.length ? C.ok : C.wa) : C.bd, 'stroke-width': n.aprueba ? 1.8 : 1 },
      n.externa || n.fueraNivel ? { 'stroke-dasharray': '5 4', stroke: C.wa } : {}), g);
    if (n.mini) {   // caja de cascada: franja lateral de color, nombre (2 líneas) y empresa
      el('rect', { x: 1, y: 1, width: 4, height: n.h - 2, rx: 2, fill: banda(n.nivelBanda != null ? n.nivelBanda : n.nivel) }, g);
      const FM = '600 12px ' + FF; envuelve(n.nombre, FM, MAX, 2).forEach((l, i) => txt(g, 12, 18 + i * 14, l, FM, C.tx));
      txt(g, 12, n.h - 8, e.t, '11px ' + FF, C.mu); if (n.hcTxt) txt(g, W - 10, n.h - 8, n.hcTxt, '600 11px ' + FF, C.tx, { 'text-anchor': 'end' });
      if (n.aprueba) txt(g, W - 10, 18, '✓', '700 12px ' + FF, n.aprobadores.length ? C.ok : C.wa, { 'text-anchor': 'end' });
      continue;
    }
    el('rect', { x: 1, y: 1, width: W - 2, height: 5, rx: 3, fill: banda(n.nivelBanda != null ? n.nivelBanda : n.nivel) }, g);
    txt(g, 12, 22, corta(n.tipo, FT, n.aprueba ? 86 : MAX), FT, C.mu);
    if (n.aprueba) txt(g, W - 12, 22, corta('✓ ' + (n.aprobadores[0] || 'sin director'), FT, 110), '600 ' + FT, n.aprobadores.length ? C.ok : C.wa, { 'text-anchor': 'end' });
    envuelve(n.nombre, FN, MAX, 2).forEach((l, i) => txt(g, 12, 41 + i * 16, l, FN, C.tx));
    txt(g, 12, H - 12, e.t, FE, C.mu); if (n.hcTxt) txt(g, W - 12, H - 12, n.hcTxt, '600 ' + FE, C.tx, { 'text-anchor': 'end' });
    if (!n.hcTxt && n.funcionalFuera.length) txt(g, W - 12, H - 12, '⇢', '600 13px ' + FF, C.wa, { 'text-anchor': 'end' });
  }
  // ---- Vista: zoom y desplazamiento sobre el viewBox ----
  const base = { x: -PAD, y: -PAD, w: total.w + PAD * 2, h: total.h + PAD * 2 }; let vb = { ...base };
  const qs = new URLSearchParams(location.search); qs.delete('panel'); const CLAVE = 'dg-vista:' + location.pathname + '?' + qs.toString();
  try { const g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null'); if (g && g.w > 0) vb = g; } catch (e) { /* sin almacenamiento: vista completa */ }
  const aplica = () => { svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); try { sessionStorage.setItem(CLAVE, JSON.stringify(vb)); } catch (e) { /* opcional */ } };
  const ajustar = () => { vb = { ...base }; aplica(); };
  const zoom = (k, fx = 0.5, fy = 0.5) => { const nw = Math.min(base.w * 4, Math.max(W * 1.5, vb.w / k)), nh = vb.h * nw / vb.w; vb.x += (vb.w - nw) * fx; vb.y += (vb.h - nh) * fy; vb.w = nw; vb.h = nh; aplica(); };
  aplica();   // vista guardada (al volver de guardar) o la completa
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
    if (!n) return;
    const url = (data.ver === 'puestos' ? '/config/plantilla/puesto/' : '/config/estructura/') + n.dataset.id;
    if (data.editar) panel.abrir(url, by.get(+n.dataset.id)); else if (window.ghAbrir) window.ghAbrir(url);
  });
  cont.addEventListener('keydown', e => {
    const p = vb.w * 0.1, m = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, -p], ArrowDown: [0, p] }[e.key];
    if (m) { e.preventDefault(); vb.x += m[0]; vb.y += m[1]; aplica(); } else if (e.key === '+' || e.key === '=') zoom(1.2); else if (e.key === '-') zoom(0.83); else if (e.key === '0') ajustar();
  });
  const dot = document.getElementById('dg-dot'); const verDot = () => { gF.style.display = dot && !dot.checked ? 'none' : ''; }; if (dot) { dot.addEventListener('change', verDot); verDot(); }
  // ---- Modo edición: panel lateral con los formularios de siempre y acciones rápidas ----
  const ed = document.getElementById('dg-editar');
  if (ed) { const u = new URL(location.href); u.searchParams.delete('panel'); if (data.editar) u.searchParams.delete('editar'); else u.searchParams.set('editar', '1'); ed.href = u.pathname + u.search; }
  const panel = (() => {
    const el = document.getElementById('dg-panel'), c = document.getElementById('dg-panel-c'), acc = document.getElementById('dg-panel-acc'), t = document.getElementById('dg-panel-t');
    if (!el) return { abrir() {} };
    const volver = url => { const u = new URL(location.href); u.searchParams.set('panel', url); return u.pathname + u.search; };
    const boton = (txt, url) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = txt; b.addEventListener('click', () => abrir(url, null, true)); return b; };
    let nodoActual = null;
    async function abrir(url, nodo, mantener) {
      if (!/^\/config\/[a-z]/.test(url) || url.startsWith('//')) return;
      if (nodo) nodoActual = nodo; else if (!mantener) nodoActual = null;
      el.hidden = false; el.classList.add('abierto'); c.innerHTML = '<p class="sub">Cargando…</p>';
      // Acciones rápidas según la caja
      acc.innerHTML = ''; const n = nodoActual;
      if (n && data.ver === 'puestos') {
        t.textContent = n.nombre;
        acc.append(boton('+ Cargo que le reporta', '/config/plantilla/puesto/nuevo?unidad=' + n.unidad_id + '&reporta=' + n.id), boton('+ Plazas', '/config/plantilla/puesto/' + n.id + '?agregar=1'), boton('+ Línea punteada', '/config/plantilla/puesto/' + n.id + '?funcional=1'), boton('Ficha del puesto', '/config/plantilla/puesto/' + n.id));
      } else if (n) {
        t.textContent = n.nombre;
        acc.append(boton('+ Unidad dependiente', '/config/estructura/nueva?padre=' + n.id), boton('+ Puesto', '/config/plantilla/puesto/nuevo?unidad=' + n.id), boton('Ficha de la unidad', '/config/estructura/' + n.id));
      } else t.textContent = 'Editar';
      try {
        const r = await fetch(url, { headers: { 'X-Modal': '1' } }); if (!r.ok) throw new Error(r.status);
        c.innerHTML = await r.text();
      } catch (e) { c.innerHTML = '<p class="flash err">No se pudo abrir (' + e.message + '). Puede que ya no exista.</p>'; return; }
      c.querySelectorAll('.mh [data-close], .act [data-close]').forEach(b => b.remove());
      c.querySelectorAll('form').forEach(f => { if ((f.method || '').toLowerCase() !== 'post') return; const h = document.createElement('input'); h.type = 'hidden'; h.name = '_volver'; h.value = volver(url); f.appendChild(h); });
      if (window.ghIniciar) window.ghIniciar(c);
      const foco = c.querySelector('input:not([type=hidden]),select,textarea'); if (foco && url.includes('/nuevo')) foco.focus();
    }
    // Enlaces de los fragmentos que abrirían otro modal: se abren en el panel
    c.addEventListener('click', e => { const a = e.target.closest('a[data-modal]'); if (a && c.contains(a)) { e.preventDefault(); e.stopPropagation(); abrir(a.getAttribute('href'), null, true); } }, true);
    document.getElementById('dg-panel-x').addEventListener('click', () => { el.hidden = true; el.classList.remove('abierto'); const u = new URL(location.href); u.searchParams.delete('panel'); history.replaceState(null, '', u.pathname + u.search); });
    // Al volver de guardar, se reabre lo que mostraba el panel
    const ini = new URLSearchParams(location.search).get('panel');
    if (data.editar && ini) { const id = +(/\/(\d+)(?:\?|$)/.exec(ini) || [])[1]; const n = /\/(puesto|estructura)\/(\d+)/.test(ini) ? by.get(id) : null; abrir(ini, n && ((data.ver === 'puestos') === /puesto/.test(ini)) ? n : null); }
    return { abrir };
  })();
  // ---- Pantalla completa (con el respaldo webkit de Safari) ----
  const wrap = document.getElementById('dg-wrap'), fs = document.getElementById('dg-fs');
  const enFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (fs && wrap && (wrap.requestFullscreen || wrap.webkitRequestFullscreen)) {
    fs.addEventListener('click', () => { if (enFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap); });
    const cambio = () => { const on = !!enFs(); fs.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa'; fs.setAttribute('aria-pressed', on); ajustar(); cont.focus(); };
    document.addEventListener('fullscreenchange', cambio); document.addEventListener('webkitfullscreenchange', cambio);
  } else if (fs) fs.hidden = true;
  // ---- Imprimir / PDF y exportar imagen ----
  // La hoja se orienta según la forma del diagrama: ancho → horizontal; alto (cascada larga) → vertical
  const hoja = document.createElement('style'); document.head.appendChild(hoja);
  const orienta = () => { hoja.textContent = '@page{size:' + (base.w >= base.h ? 'landscape' : 'portrait') + ';margin:10mm}' + (base.w < base.h ? '@media print{.dg{height:215mm!important}}' : ''); };
  orienta();
  const pr = document.getElementById('dg-print'); if (pr) pr.addEventListener('click', () => { ajustar(); window.print(); });
  window.addEventListener('beforeprint', () => { orienta(); ajustar(); });
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
