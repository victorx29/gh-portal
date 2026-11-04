(() => {
  const d = document, $ = s => d.querySelector(s), dlg = $('#modal'), dlg2 = $('#modal2'), root = d.documentElement;
  try { const t = localStorage.getItem('gh.theme'); if (t) root.dataset.theme = t; if (localStorage.getItem('gh.col') === '1' && $('#side')) $('#side').classList.add('c'); } catch (e) {}
  function areas(scope) {
    const em = scope.querySelector('#f-empresa'), ar = scope.querySelector('#f-area'); if (!em || !ar) return;
    [...ar.options].forEach(o => { o.hidden = !!o.dataset.e && o.dataset.e !== em.value; });
    if (ar.selectedOptions[0] && ar.selectedOptions[0].hidden) ar.value = '';
  }
  // Campos condicionales: data-when="campo=valor" se muestra solo si ese campo tiene ese valor
  const cond = scope => scope.querySelectorAll('[data-when]').forEach(el => { const [n, v] = el.dataset.when.split('='), f = scope.querySelector('[name="' + n + '"]'); el.hidden = !f || f.value !== v; });
  async function abrir(url, target) {
    const r = await fetch(url, { headers: { 'X-Modal': '1' }, credentials: 'same-origin' });
    if (!r.ok) { if (target === dlg) location.href = url; return; }
    target.innerHTML = await r.text(); areas(target); cond(target); if (!target.open) target.showModal();
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
    if (e.target.matches('#f-empresa')) areas(e.target.closest('form'));
    const f = e.target.closest('form'); if (f) cond(f);
  });
  cond(d);
  const ab = new URLSearchParams(location.search).get('abrir'); if (ab && dlg) abrir('/requisiciones/' + encodeURIComponent(ab), dlg);
})();
