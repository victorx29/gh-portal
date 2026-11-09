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
  }
  // Campos condicionales: data-when="campo=valor" o "campo=a|b"; el campo se busca en el mismo formulario
  const cond = scope => scope.querySelectorAll('[data-when]').forEach(el => {
    const [n, v] = el.dataset.when.split('='), f = (el.closest('form') || scope).querySelector('[name="' + n + '"]');
    const val = f && f.type === 'checkbox' ? (f.checked ? f.value : '') : f && f.value;
    el.hidden = !f || !v.split('|').includes(val);
  });
  async function abrir(url, target) {
    const r = await fetch(url, { headers: { 'X-Modal': '1' }, credentials: 'same-origin' });
    if (!r.ok) { if (target === dlg) location.href = url; return; }
    target.innerHTML = await r.text(); buscadores(target); unidades(target); cond(target); if (!target.open) target.showModal();
  }
  window.ghAbrir = url => abrir(url, dlg);   // lo usa el diagrama de estructura
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-modal],[data-modal2]');
    if (a) { e.preventDefault(); abrir(a.getAttribute('href'), a.hasAttribute('data-modal2') ? dlg2 : dlg); return; }
    if (e.target.closest('[data-perfil-ver]')) { const v = $('#f-perfil'); if (v && v.value) abrir('/perfiles/' + v.value + '/vista', dlg2); return; }
    const c = e.target.closest('[data-close]'); if (c) { const m = c.closest('dialog'); if (m) m.close(); return; }
    if (e.target === dlg || e.target === dlg2) e.target.close();
    if (e.target.closest('#th')) { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); root.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('gh.theme', root.dataset.theme); } catch (x) {} }
    if (e.target.closest('#cl')) { const k = $('#side').classList.toggle('c'); try { localStorage.setItem('gh.col', k ? '1' : '0'); } catch (x) {} }
  });
  d.addEventListener('change', e => {
    if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
    if (e.target.matches('#f-empresa')) unidades(e.target.closest('form'));
    if (e.target.matches('#f-unidad')) perfiles(e.target.closest('form'));
    const f = e.target.closest('form'); if (f) cond(f);
  });
  // Filtro de listas de casillas: <input data-filtra> seguido de .chklist
  d.addEventListener('input', e => {
    if (!e.target.matches('[data-filtra]')) return;
    const t = e.target.value.trim().toLowerCase(), l = e.target.nextElementSibling;
    if (l) [...l.querySelectorAll('label')].forEach(x => { x.hidden = !!t && !x.textContent.toLowerCase().includes(t); });
  });
  cond(d); buscadores(d);
  // Volver a abrir el modal tras guardar: ?abrir=<id requisición> o ?modal=/ruta/interna
  const qs = new URLSearchParams(location.search), ab = qs.get('abrir'), md = qs.get('modal');
  if (ab && dlg) abrir('/requisiciones/' + encodeURIComponent(ab), dlg);
  else if (md && dlg && /^\/[a-z]/.test(md) && !md.startsWith('//')) abrir(md, dlg);
  if ((ab || md) && history.replaceState) { qs.delete('abrir'); qs.delete('modal'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '')); }
})();
