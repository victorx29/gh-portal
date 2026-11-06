(() => {
  const d = document, $ = s => d.querySelector(s), dlg = $('#modal'), dlg2 = $('#modal2'), root = d.documentElement;
  try { const t = localStorage.getItem('gh.theme'); if (t) root.dataset.theme = t; if (localStorage.getItem('gh.col') === '1' && $('#side')) $('#side').classList.add('c'); } catch (e) {}
  // Unidades del formulario de requisición: solo las que pertenecen o sirven a la empresa elegida (data-e="1,3")
  function unidades(scope) {
    const em = scope.querySelector('#f-empresa'), un = scope.querySelector('#f-unidad'); if (!em || !un) return;
    [...un.options].forEach(o => { if (o.dataset.e !== undefined) o.hidden = !o.dataset.e.split(',').includes(em.value); });
    if (un.selectedOptions[0] && un.selectedOptions[0].hidden) un.value = '';
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
    target.innerHTML = await r.text(); unidades(target); cond(target); if (!target.open) target.showModal();
  }
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
  cond(d);
  // Volver a abrir el modal tras guardar: ?abrir=<id requisición> o ?modal=/ruta/interna
  const qs = new URLSearchParams(location.search), ab = qs.get('abrir'), md = qs.get('modal');
  if (ab && dlg) abrir('/requisiciones/' + encodeURIComponent(ab), dlg);
  else if (md && dlg && /^\/[a-z]/.test(md) && !md.startsWith('//')) abrir(md, dlg);
  if ((ab || md) && history.replaceState) { qs.delete('abrir'); qs.delete('modal'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '')); }
})();
