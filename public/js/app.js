(() => {
  const d = document, $ = s => d.querySelector(s), dlg = $('#modal');
  const root = d.documentElement;
  try { const t = localStorage.getItem('gh.theme'); if (t) root.dataset.theme = t; if (localStorage.getItem('gh.col') === '1' && $('#side')) $('#side').classList.add('c'); } catch (e) {}
  function areas(scope) {
    const em = scope.querySelector('#f-empresa'), ar = scope.querySelector('#f-area'); if (!em || !ar) return;
    [...ar.options].forEach(o => { o.hidden = !!o.dataset.e && o.dataset.e !== em.value; });
    if (ar.selectedOptions[0] && ar.selectedOptions[0].hidden) ar.value = '';
  }
  async function abrir(url) {
    const r = await fetch(url, { headers: { 'X-Modal': '1' }, credentials: 'same-origin' });
    if (!r.ok) { location.href = url; return; }
    dlg.innerHTML = await r.text(); areas(dlg); dlg.showModal();
  }
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-modal]');
    if (a && dlg) { e.preventDefault(); abrir(a.getAttribute('href')); return; }
    if (e.target.closest('[data-close]') || e.target === dlg) dlg.close();
    if (e.target.closest('#th')) { const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); root.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('gh.theme', root.dataset.theme); } catch (x) {} }
    if (e.target.closest('#cl')) { const c = $('#side').classList.toggle('c'); try { localStorage.setItem('gh.col', c ? '1' : '0'); } catch (x) {} }
  });
  d.addEventListener('change', e => {
    if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
    if (e.target.matches('#f-empresa')) areas(e.target.closest('form'));
  });
})();
