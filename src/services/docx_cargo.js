// Lee una «Descripción de Cargo» en Word (.docx) con la plantilla de GH y devuelve su contenido estructurado.
// El archivo es DATO: solo se extrae texto de las celdas, nunca se ejecuta nada. Límites contra archivos maliciosos (zip bomba).
const JSZip = require('jszip');
const MAX_XML = 8 * 1024 * 1024;
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const des = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
// Párrafos de un fragmento XML de Word (texto de cada <w:p>, con tabulaciones y saltos)
const parrafos = xml => [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(m => {
  let t = ''; for (const r of m[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) t += r[1] !== undefined ? des(r[1]) : ' ';
  return t.replace(/\s+/g, ' ').trim();
}).filter(Boolean);
async function celdas(buffer) {
  let zip; try { zip = await JSZip.loadAsync(buffer); } catch (e) { throw new Error('no es un Word (.docx) válido'); }
  const f = zip.file('word/document.xml'); if (!f) throw new Error('no es un Word (.docx) válido');
  if (f._data && f._data.uncompressedSize > MAX_XML) throw new Error('el documento es demasiado grande');
  const xml = await f.async('string'); if (xml.length > MAX_XML) throw new Error('el documento es demasiado grande');
  const out = [], vistas = new Set();
  for (const m of xml.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)) { const ps = parrafos(m[0]), k = ps.join('\n'); if (ps.length && !vistas.has(k)) { vistas.add(k); out.push(ps); } }
  if (!out.length) out.push(parrafos(xml));   // sin tablas: se intenta con el texto corrido
  return out;
}
const tras = (p, etiqueta) => { const i = p.indexOf(':'); return i >= 0 && norm(p.slice(0, i)).startsWith(norm(etiqueta).slice(0, 6)) ? p.slice(i + 1).trim() : p.trim(); };
// Reparte párrafos entre sub-etiquetas («Educación:», «Experiencia:»…); lo que no empieza con etiqueta se suma a la anterior
function secciones(ps, etiquetas) {
  const r = {}; let k = null;
  for (const p of ps) {
    const i = p.indexOf(':'), cab = i > 0 ? norm(p.slice(0, i)) : '', e = i > 0 && i < 40 ? etiquetas.find(([, alias]) => alias.some(a => cab.startsWith(a))) : null;
    if (e) { k = e[0]; r[k] = p.slice(i + 1).trim(); } else if (k) r[k] = (r[k] ? r[k] + '\n' : '') + p;
  }
  return r;
}
const titulo = s => {   // «ANALISTA DE DESARROLLO» → «Analista de Desarrollo»
  if (s !== s.toUpperCase()) return s.trim();
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u', 'en', 'a', 'para', 'por', 'con']);
  return s.toLowerCase().split(/\s+/).map((w, i) => i && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
const fecha = s => { const m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(String(s || '')); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const lista = (ps, etiqueta) => { const l = ps.slice(); if (l.length) l[0] = tras(l[0], etiqueta); return l.map(x => x.replace(/^[\s•\-–·*]+/, '').trim()).filter(Boolean); };

async function leer(buffer) {
  const cs = await celdas(buffer), r = { responsabilidades: {}, avisos: [], control: {} };
  for (const c of cs) {
    const n = norm(c[0]);
    if (n.startsWith('descripciondecargo')) continue;
    if (n.startsWith('departamento')) { r.departamento = tras(c.join(' '), 'Departamento'); continue; }
    if (n.startsWith('reportaa')) { r.reporta_doc = tras(c.join(' '), 'Reporta a'); continue; }
    if (n.startsWith('objetivo')) { r.objetivo = lista(c, 'Objetivo').join('\n'); continue; }
    if (n.startsWith('funciones')) { r.funciones = lista(c, 'Funciones'); continue; }
    if (n.startsWith('perfildelcargo')) {
      const s = secciones(c.slice(1).concat(tras(c[0], 'Perfil del Cargo') ? [tras(c[0], 'Perfil del Cargo')] : []),
        [['educacion', ['educacion']], ['competencias_conductuales', ['competenciasconductuales']], ['certificaciones', ['certificaciones']], ['experiencia', ['experiencia']], ['conocimientos', ['conocimientos']], ['idiomas', ['idiomas']]]);
      Object.assign(r, s); continue;
    }
    if (n.startsWith('competencias')) { r.competencias = lista(c, 'Competencias'); continue; }   // «Competencias:» o «Competencias Clave:»
    if (n.startsWith('responsabilidades')) {
      Object.assign(r.responsabilidades, secciones(c.slice(1), [['dinero', ['dinero']], ['informacion', ['informacionconfidencial', 'informacion']], ['decisiones', ['tomadedecisiones', 'decisiones']], ['supervision', ['supervision']]]));
      continue;
    }
    if (n.startsWith('fechadeactualizacion')) { r.control.fecha_actualizacion = fecha(c.join(' ')); continue; }
    if (n.startsWith('fechaderevision')) { r.control.fecha_revision = fecha(c.join(' ')); continue; }
    if (n.startsWith('aprobadopor')) { const v = tras(c.join(' '), 'Aprobado por'); if (v && norm(v) !== 'aprobadopor') r.control.aprobado_por = v; continue; }
    if (n.startsWith('revisadopor')) { const v = tras(c.join(' '), 'Revisado por'); if (v && norm(v) !== 'revisadopor') r.control.revisado_por = v; continue; }
    if (n.startsWith('trabajadorocupante')) { const v = tras(c.join(' '), 'Trabajador ocupante'); if (v && norm(v) !== 'trabajadorocupante') r.avisos.push('Trae «Trabajador ocupante»: se ignora, porque sale de la plaza ocupada'); continue; }
    if (!r.cargo && c.length === 1 && c[0].length <= 120 && !c[0].includes(':')) r.cargo = titulo(c[0]);
  }
  if (!r.cargo) throw new Error('no se encontró el nombre del cargo');
  if (!r.objetivo) r.avisos.push('No tiene «Objetivo»');
  if (!(r.funciones || []).length) r.avisos.push('No tiene «Funciones»');
  if (!r.educacion) r.avisos.push('No tiene «Educación» en el Perfil del Cargo');
  if (!r.competencias_conductuales && (r.competencias || []).length) r.avisos.push('No tiene «Competencias conductuales» (se importan solo las competencias)');
  return r;
}
module.exports = { leer, norm, titulo };
