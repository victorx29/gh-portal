(() => {
  const d = document, $ = s => d.querySelector(s), dlg = $('#modal'), dlg2 = $('#modal2'), root = d.documentElement;
  try { const t = localStorage.getItem('gh.theme'); if (t) root.dataset.theme = t; if (localStorage.getItem('gh.col') === '1' && $('#side')) $('#side').classList.add('c'); } catch (e) {}
  // Buscador sobre listas de unidades (<select data-buscar>): filtra por nombre o código y conserva los superiores de cada coincidencia,
  // para no perder la escalera. Una opción puede ocultarse por empresa (data-he) o por la búsqueda (data-hb).
  const plano = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const vis = o => { const h = o.dataset.he === '1' || o.dataset.hb === '1'; o.hidden = h; o.disabled = h && !o.selected; };   // disabled: Safari no oculta opciones
  function filtraSel(sel, txt) {
    const t = plano(txt.trim()), ops = [...sel.options].filter(o => o.dataset.a !== undefined), keep = new Set();
    if (t) ops.forEach(o => { if (plano(o.textContent + ' ' + (o.dataset.t || '')).includes(t)) o.dataset.a.split(',').forEach(id => keep.add(id)); });
    ops.forEach(o => { o.dataset.hb = !t || keep.has(o.value) ? '0' : '1'; vis(o); });
  }
  function buscadores(scope) {
    scope.querySelectorAll('select[data-buscar]').forEach(sel => {
      if (sel.dataset.listo) return; sel.dataset.listo = '1';
      const inp = document.createElement('input'), lab = sel.id && scope.querySelector('label[for="' + sel.id + '"]');
      inp.type = 'search'; inp.className = 'buscar-sel'; inp.placeholder = 'Buscar por nombre o código…'; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', 'Buscar en ' + (lab ? lab.textContent.trim() : 'la lista')); if (sel.id) inp.setAttribute('aria-controls', sel.id);
      sel.parentNode.insertBefore(inp, sel);
      inp.addEventListener('input', () => filtraSel(sel, inp.value));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sel.focus(); } });   // Enter no envía el formulario
    });
  }
  // Unidades del formulario de requisición: solo las que pertenecen o sirven a la empresa elegida (data-e="1,3")
  function unidades(scope) {
    const em = scope.querySelector('#f-empresa'), un = scope.querySelector('#f-unidad'); if (!em || !un) return;
    [...un.options].forEach(o => { if (o.dataset.e !== undefined) { o.dataset.he = o.dataset.e.split(',').includes(em.value) ? '0' : '1'; vis(o); } });
    if (un.selectedOptions[0] && un.selectedOptions[0].dataset.he === '1') { un.value = ''; [...un.options].forEach(vis); }
    perfiles(scope);
  }
  // Perfiles del formulario: generales, o los de esa empresa y esa unidad (o una superior)
  function perfiles(scope) {
    const em = scope.querySelector('#f-empresa'), un = scope.querySelector('#f-unidad'), pf = scope.querySelector('#f-perfil'); if (!em || !un || !pf) return;
    const E = em.value, o = un.selectedOptions[0], A = o && o.dataset.a ? o.dataset.a.split(',') : [];
    [...pf.options].forEach(op => {
      if (op.dataset.g === undefined) return;
      const pe = op.dataset.pe ? op.dataset.pe.split(',') : [], pu = op.dataset.pu ? op.dataset.pu.split(',') : [];
      op.hidden = !(op.dataset.g === '1' || ((pe.length || pu.length) && E && A.length && (!pe.length || pe.includes(E)) && (!pu.length || pu.some(x => A.includes(x)))));
    });
    if (pf.selectedOptions[0] && pf.selectedOptions[0].hidden) pf.value = '';
    plazas(scope);
  }
  // Nuevo puesto: perfiles del área elegida (alcance en la unidad o una superior, o en una empresa que atiende) y generales; «otras áreas» bajo casilla
  function perfilesPuesto(scope) {
    const un = scope.querySelector('#pu-u'), pf = scope.querySelector('#pu-p'), todos = scope.querySelector('#pu-todos'); if (!un || !pf) return;
    const o = un.selectedOptions[0], A = o && o.dataset.a ? o.dataset.a.split(',') : [], EM = o && o.dataset.e ? o.dataset.e.split(',') : [];
    [...pf.options].forEach(op => {
      if (op.dataset.g === undefined) { if (!op.value) op.textContent = un.value ? 'Selecciona el perfil' : 'Elige primero la unidad'; return; }
      const pu = op.dataset.pu ? op.dataset.pu.split(',') : [], pe = op.dataset.pe ? op.dataset.pe.split(',') : [];
      const aplica = op.dataset.g === '1' || pu.some(x => A.includes(x)) || (!pu.length && pe.some(x => EM.includes(x)));
      op.dataset.he = un.value && (aplica || (todos && todos.checked)) ? '0' : '1'; vis(op);
    });
    if (pf.selectedOptions[0] && pf.selectedOptions[0].dataset.he === '1') { pf.value = ''; [...pf.options].forEach(vis); }
  }
  // Plazas para reemplazo: solo las de la unidad elegida
  function plazas(scope) {
    const un = scope.querySelector('#f-unidad'), pz = scope.querySelector('#f-plaza'); if (!un || !pz) return;
    [...pz.options].forEach(o => { if (o.dataset.u !== undefined) { o.dataset.hu = o.dataset.u === un.value ? '0' : '1'; o.hidden = o.dataset.hu === '1'; } });
    if (pz.selectedOptions[0] && pz.selectedOptions[0].hidden) pz.value = '';
  }
  // Campos condicionales: data-when="campo=valor" o "campo=a|b"; el campo se busca en el mismo formulario
  const cond = scope => scope.querySelectorAll('[data-when]').forEach(el => {
    const [n, v] = el.dataset.when.split('='), f = (el.closest('form') || scope).querySelector('[name="' + n + '"]');
    // casilla: su valor si está marcada; botones de opción: el valor del marcado del grupo
    const val = !f ? '' : f.type === 'checkbox' ? (f.checked ? f.value : '') : f.type === 'radio' ? (((el.closest('form') || scope).querySelector('[name="' + n + '"]:checked') || {}).value || '') : f.value;
    el.hidden = !f || !v.split('|').includes(val);
  });
  async function abrir(url, target) {
    const r = await fetch(url, { headers: { 'X-Modal': '1' }, credentials: 'same-origin' });
    if (!r.ok) { if (target === dlg) location.href = url; return; }
    target.innerHTML = await r.text(); buscadores(target); unidades(target); perfilesPuesto(target); cond(target); if (!target.open) target.showModal();
  }
  window.ghAbrir = url => abrir(url, dlg);   // lo usa el diagrama de estructura
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-modal],[data-modal2]');
    if (a) { e.preventDefault(); abrir(a.getAttribute('href'), a.hasAttribute('data-modal2') ? dlg2 : dlg); return; }
    if (e.target.closest('[data-perfil-ver]')) {
      const f = e.target.closest('form'), t = f && f.querySelector('#f-tipo'), z = f && f.querySelector('#f-plaza'), v = f && f.querySelector('#f-perfil');
      const id = t && t.value === 'reemplazo' ? (z && z.selectedOptions[0] && z.selectedOptions[0].dataset.p) : v && v.value;
      if (id) abrir('/perfiles/' + id + '/vista', dlg2); return;
    }
    const c = e.target.closest('[data-close]'); if (c) { const m = c.closest('dialog'); if (m) m.close(); return; }
    if (e.target === dlg || e.target === dlg2) e.target.close();
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (e.target.closest('#th')) { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); root.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('gh.theme', root.dataset.theme); } catch (x) {} }
    if (e.target.closest('#cl')) { const k = $('#side').classList.toggle('c'); try { localStorage.setItem('gh.col', k ? '1' : '0'); } catch (x) {} }
  });
  d.addEventListener('change', e => {
    if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
    if (e.target.matches('#f-empresa')) unidades(e.target.closest('form'));
    if (e.target.matches('#f-unidad')) perfiles(e.target.closest('form'));
    if (e.target.matches('#pu-u, #pu-todos')) perfilesPuesto(e.target.closest('form'));
    if (e.target.matches('#f-plaza')) {   // la plaza manda la empresa si ya la tiene
      const o = e.target.selectedOptions[0], em = e.target.form.querySelector('#f-empresa');
      if (o && o.dataset.e && em && em.value !== o.dataset.e) { em.value = o.dataset.e; unidades(e.target.form); e.target.value = o.value; }
    }
    const f = e.target.closest('form'); if (f) cond(f);
  });
  // Filtro de listas de casillas: <input data-filtra> seguido de .chklist
  d.addEventListener('input', e => {
    if (!e.target.matches('[data-filtra]')) return;
    const t = e.target.value.trim().toLowerCase(), l = e.target.nextElementSibling;
    if (l) [...l.querySelectorAll('label')].forEach(x => { x.hidden = !!t && !x.textContent.toLowerCase().includes(t); });
  });
  // ---- Avisos flotantes: los de éxito se cierran solos (salvo cursor o foco encima); los de error quedan hasta cerrarlos ----
  const toast = $('.toast');
  if (toast) {
    const quitar = () => { toast.classList.add('sale'); setTimeout(() => toast.remove(), 250); };
    if (!toast.classList.contains('err')) { let t = setTimeout(quitar, 6000); const pausa = () => clearTimeout(t); toast.addEventListener('mouseenter', pausa); toast.addEventListener('focusin', pausa); toast.addEventListener('mouseleave', () => { t = setTimeout(quitar, 3000); }); }
    toast.querySelector('[data-toast-x]').addEventListener('click', quitar);
  }
  // ---- Confirmación con el modal del portal: <form data-confirm="…"> o <button data-confirm="…">; data-peligro = acción irreversible ----
  function confirmar(msg, okTxt, peligro) {
    return new Promise(res => {
      let dl = d.getElementById('gh-confirm');
      if (!dl) {
        dl = d.createElement('dialog'); dl.id = 'gh-confirm'; dl.className = 'confirm'; dl.setAttribute('aria-labelledby', 'gh-confirm-t'); dl.setAttribute('aria-describedby', 'gh-confirm-m');
        dl.innerHTML = '<h2 id="gh-confirm-t">¿Confirmas?</h2><p id="gh-confirm-m"></p><p class="act"><button type="button" class="btn" data-r="no">Cancelar</button> <button type="button" class="btn p" data-r="si">Confirmar</button></p>';
        d.body.appendChild(dl);
      }
      dl.querySelector('#gh-confirm-m').textContent = msg;
      const si = dl.querySelector('[data-r=si]'), no = dl.querySelector('[data-r=no]');
      si.textContent = okTxt || 'Confirmar'; si.className = 'btn ' + (peligro ? 'peligro' : 'p');
      const fin = v => { dl.close(); res(v); };
      si.onclick = () => fin(true); no.onclick = () => fin(false); dl.oncancel = e => { e.preventDefault(); fin(false); };
      dl.showModal(); no.focus();   // el foco empieza en la opción segura
    });
  }
  const confirmados = new WeakSet();
  d.addEventListener('submit', e => {
    const f = e.target, b = e.submitter, src = b && b.dataset.confirm ? b : f.dataset.confirm ? f : null;
    if (!src) return;
    if (confirmados.has(f)) { confirmados.delete(f); return; }
    e.preventDefault();
    confirmar(src.dataset.confirm, src.dataset.ok, src.hasAttribute('data-peligro')).then(ok => { if (ok) { confirmados.add(f); f.requestSubmit(b || undefined); } });
  }, true);
  cond(d); buscadores(d);
  // Volver a abrir el modal tras guardar: ?abrir=<id requisición> o ?modal=/ruta/interna
  const qs = new URLSearchParams(location.search), ab = qs.get('abrir'), md = qs.get('modal');
  if (ab && dlg) abrir('/requisiciones/' + encodeURIComponent(ab), dlg);
  else if (md && dlg && /^\/[a-z]/.test(md) && !md.startsWith('//')) abrir(md, dlg);
  if ((ab || md) && history.replaceState) { qs.delete('abrir'); qs.delete('modal'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '')); }
})();
