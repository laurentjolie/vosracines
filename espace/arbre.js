// Vos Racines : visualiseur d'arbre ascendant, façon Family Echo (29/10/2026).
// Données : { titre, racine, personnes: {id: {p,n,u,s,sosa,na,ba,de,me,niv,v,cache,fam,no,src}}, familles: [{h,w,mar,enfants}] }
const W = () => (innerWidth < 720 ? 168 : 220), H = () => (innerWidth < 720 ? 80 : 92);
const GAP = 28, GAP_COUPLE = 48, GAP_GEN = 72, PLUS = 3;
const PROF = () => (innerWidth < 720 ? 2 : 3);
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const PREUVE = {acte: ['●', 'p-acte', 'Acte lu', 'nous avons lu l’acte'], piste: ['◐', 'p-piste', 'Piste', 'indiqué par d’autres chercheurs, pas encore vérifié'],
  hypothese: ['○', 'p-hyp', 'Hypothèse', 'probable, à confirmer'], famille: ['◆', 'p-fam', 'Donné par la famille', 'information transmise par la famille']};
const preuve = n => PREUVE[n] || (n && n.startsWith('hyp') ? PREUVE.hypothese : n ? PREUVE.piste : null);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sansAccent = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const an = e => (e && e.d ? e.d.slice(0, 4) : '');
export function dateLongue(d) {
  if (!d) return '';
  const [y, m, j] = d.split('-');
  if (j) return `${+j === 1 ? '1er' : +j} ${MOIS[+m - 1]} ${y}`;
  if (m) return `${MOIS[+m - 1]} ${y}`;
  return y;
}
const met = m => Array.isArray(m) ? m : [m.m, m.a];
const lieuCourt = p => (p || '').replace(/\s*\(\d+[AB]?\)\s*$/, '');
export const nomComplet = x => x ? (x.cache ? x.p : [x.u || x.p, x.n].filter(Boolean).join(' ')) : '';
const LIGNEE = ['l1', 'l2', 'l3', 'l4'];
export function lignee(x) {
  const n = x && x.sosa && x.sosa.length ? Math.min(...x.sosa) : 0;
  if (!n) return '';
  if (n === 1) return 'ego';
  if (n === 2) return 'l1';
  if (n === 3) return 'l3';
  const g = Math.floor(Math.log2(n));
  return LIGNEE[(n >> (g - 2)) - 4];
}
function parente(x, ego) {
  const n = x.sosa && x.sosa.length ? Math.min(...x.sosa) : 0;
  if (!n) return '';
  if (n === 1) return '';
  const f = x.s === 'F', g = Math.floor(Math.log2(n)), cote = (n >> (g - 1)) === 2 ? 'paternel' : 'maternel';
  const de = /^[aeiouyhéèêàâîôû]/i.test(ego) ? `d’${ego}` : `de ${ego}`;
  if (g === 1) return `${f ? 'Mère' : 'Père'} ${de}`;
  const base = f ? 'grand-mère' : 'grand-père', c = f ? cote + 'le' : cote;
  if (g === 2) return `${f ? 'Grand-mère' : 'Grand-père'} ${c} ${de}`;
  if (g === 3) return `${f ? 'Arrière-grand-mère' : 'Arrière-grand-père'} ${c} ${de}`;
  if (g === 4) return `${f ? 'Arrière-arrière-grand-mère' : 'Arrière-arrière-grand-père'} ${c} ${de}`;
  return `Ancêtre ${de}, ${g} générations plus haut, côté ${cote}`;
}

export function creerArbre(racineEl, data, opt = {}) {
  const P = data.personnes, F = data.familles || [];
  const parents = {}, unions = {}, enfants = {};
  for (const f of F) {
    for (const k of f.enfants || []) parents[k] = f;
    for (const z of [f.h, f.w]) if (z) (unions[z] = unions[z] || []).push(f);
    for (const z of [f.h, f.w]) if (z) enfants[z] = (enfants[z] || []).concat(f.enfants || []);
  }
  const ego = P[data.racine] ? data.racine : Object.keys(P)[0];
  const egoNom = (P[ego] && (P[ego].u || P[ego].p) || '').split(' ')[0];
  let focus = ego, ouverts = {}, choisi = null, k = 1, tx = 0, ty = 0, positions = {};

  racineEl.innerHTML = `
  <div class="vue" tabindex="-1"><div class="scene"><svg></svg><div class="cartes"></div></div></div>
  <div class="flottant recherche" role="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    <label class="cache-visuel" for="cherche">Rechercher une personne</label>
    <input id="cherche" type="search" placeholder="Rechercher une personne" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sugg">
    <ul class="suggestions" id="sugg" role="listbox" hidden></ul>
  </div>
  <div class="fil" hidden></div>
  <div class="flottant ensemble"><button data-a="tout">Vue d’ensemble</button><button data-a="imprimer">Imprimer cette vue</button></div>
  <div class="flottant zoom">
    <button data-a="plus" aria-label="Agrandir">+</button><button data-a="moins" aria-label="Réduire">−</button>
    <button data-a="moi" class="moi" aria-label="Revenir à ${esc(egoNom)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg><span>Revenir à ${esc(egoNom)}</span></button>
  </div>
  <div class="flottant legende"><button aria-expanded="true">Légende</button><div class="corps">
    <ul>${['l1','l2','l3','l4'].map((l, i) => `<li><span class="sw" style="background:var(--${l})"></span>${esc(nomLignee(i))}</li>`).join('')}</ul>
    <ul>${['acte','piste','hypothese','famille'].map(n => `<li><span class="${PREUVE[n][1]}" style="width:16px;text-align:center">${PREUVE[n][0]}</span><span><b>${PREUVE[n][2]}</b> : ${PREUVE[n][3]}</span></li>`).join('')}
    <li><span style="width:16px;text-align:center">🔒</span><span>Personne vivante : seul le prénom est affiché</span></li></ul></div></div>
  <aside class="fiche" hidden aria-label="Fiche de la personne"></aside>`;
  const vue = racineEl.querySelector('.vue'), scene = racineEl.querySelector('.scene'), svg = scene.querySelector('svg'),
        cartesEl = scene.querySelector('.cartes'), fiche = racineEl.querySelector('.fiche'), fil = racineEl.querySelector('.fil');

  function nomLignee(i) {
    const s = 4 + i, x = Object.values(P).find(p => p.sosa && p.sosa.includes(s));
    const role = ['Grand-père paternel', 'Grand-mère paternelle', 'Grand-père maternel', 'Grand-mère maternelle'][i];
    return x && x.n ? `${role} : les ${x.n.charAt(0) + x.n.slice(1).toLowerCase()}` : role;
  }

  // ---------- disposition ----------
  function construire() {
    const w = W(), h = H(); let curseur = 0; const noeuds = [], liens = [], plusBtns = [];
    function place(id, g, lim) {
      const x = P[id]; const f = parents[id];
      const montre = f && !x.cache && (g < lim);
      let pere = null, mere = null;
      if (montre) {
        const l2 = Math.max(lim, ouverts[id] || 0);
        if (f.h && P[f.h]) pere = place(f.h, g + 1, Math.max(lim, ouverts[f.h] || 0, l2));
        if (pere) curseur += GAP_COUPLE - GAP;
        if (f.w && P[f.w]) mere = place(f.w, g + 1, Math.max(lim, ouverts[f.w] || 0, l2));
      }
      let cx;
      if (pere && mere) cx = (pere.cx + mere.cx) / 2;
      else if (pere || mere) cx = (pere || mere).cx;
      else { cx = curseur + w / 2; curseur += w + GAP; }
      const n = {id, g, cx, pere, mere, f};
      noeuds.push(n);
      if (!montre && f && !x.cache && ((f.h && P[f.h]) || (f.w && P[f.w]))) plusBtns.push(n);
      return n;
    }
    place(focus, 0, Math.max(PROF(), ouverts[focus] || 0));
    const gmax = Math.max(...noeuds.map(n => n.g));
    const y = g => (gmax - g) * (h + GAP_GEN) + 70;
    positions = {};
    for (const n of noeuds) { n.x = n.cx - w / 2; n.y = y(n.g); positions[n.id] = n; }
    for (const n of noeuds) if (n.pere || n.mere) liens.push(n);
    // enfants du point focal (sous lui), sauf l'ego
    const desc = [];
    if (focus !== ego) {
      const ks = [...new Set(enfants[focus] || [])].filter(k => P[k]);
      const total = ks.length * (w + GAP) - GAP, foc = positions[focus];
      ks.forEach((k2, i) => desc.push({id: k2, x: foc.cx - total / 2 + i * (w + GAP), y: foc.y + h + GAP_GEN + 18}));
    }
    return {noeuds, liens, plusBtns, desc, w, h};
  }

  function carteHTML(id, x, y, extra = '') {
    const p = P[id]; if (!p) return '';
    if (p.cache) return `<div class="carte vivant" style="left:${x}px;top:${y}px" title="Personne vivante : seul le prénom est affiché." role="img" aria-label="${esc(p.p)}, personne vivante : seul le prénom est affiché">
      <span class="nom">${esc(p.p)}</span><svg class="cadenas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>`;
    const l = lignee(p), pv = preuve(p.niv), est = id === ego;
    const dates = [an(p.na) || an(p.ba), an(p.de)].some(Boolean) ? `${an(p.na) || an(p.ba) || '?'}${p.de ? ' · ' + an(p.de) : (p.v ? '' : ' · ?')}` : '';
    const lieu = lieuCourt((p.na || p.ba || {}).p) || (p.me && p.me[0] ? met(p.me[0])[0] : '');
    const lab = [nomComplet(p), dates.replace(' · ', ' à '), lieu, pv ? pv[2] : ''].filter(Boolean).join(', ');
    return `<button class="carte ${est ? 'ego' : l} ${choisi === id ? 'choisie' : ''} ${extra}" data-id="${esc(id)}" style="left:${x}px;top:${y}px" ${est ? `data-ruban="${esc(egoNom)}"` : ''} aria-label="${esc(lab)}">
      <span class="nom" title="${esc(nomComplet(p))}">${esc(nomComplet(p))}</span><span class="dates">${esc(dates)}</span><span class="lieu">${esc(lieu)}</span>
      ${pv ? `<span class="preuve ${pv[1]}" aria-hidden="true">${pv[0]}</span>` : ''}</button>`;
  }

  function dessiner() {
    const L = construire(), {w, h} = L; let html = '', paths = '';
    for (const n of L.noeuds) html += carteHTML(n.id, n.x, n.y);
    for (const n of L.liens) {
      const mid = n.y - GAP_GEN / 2, cl = colLien(n);
      const ps = [n.pere, n.mere].filter(Boolean);
      paths += `<path d="M${n.cx} ${n.y} V${mid}" stroke="${cl}" stroke-width="2" fill="none"/>`;
      if (ps.length === 2) paths += `<path d="M${ps[0].cx} ${ps[0].y + h} V${mid} H${ps[1].cx} V${ps[1].y + h}" stroke="${cl}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
      else paths += `<path d="M${ps[0].cx} ${ps[0].y + h} V${mid} H${n.cx}" stroke="${cl}" stroke-width="2" fill="none"/>`;
      const m = n.f && n.f.mar;
      if (ps.length === 2) html += `<span class="anneau" style="left:${(ps[0].cx + ps[1].cx) / 2}px;top:${mid}px">∞${m && m.d ? ' ' + esc(an(m)) : ''}</span>`;
    }
    for (const n of L.plusBtns) html += `<button class="plus" data-plus="${esc(n.id)}" style="left:${n.cx - 75}px;top:${n.y - 52}px">+ ${PLUS} générations</button>`;
    if (L.desc.length) {
      const foc = positions[focus];
      html += `<span class="titre-enfants" style="left:${foc.cx}px;top:${foc.y + h + 20}px">Ses enfants</span>`;
      for (const d of L.desc) { html += carteHTML(d.id, d.x, d.y, 'desc'); paths += `<path d="M${foc.cx} ${foc.y + h} V${foc.y + h + 14} M${d.x + w / 2} ${d.y} V${d.y - 10} H${foc.cx}" stroke="var(--line-strong)" stroke-width="2" fill="none"/>`; }
    }
    svg.innerHTML = paths; cartesEl.innerHTML = html;
    majFil();
  }
  function colLien(n) {
    const l = lignee(P[n.id]);
    if (n.g >= 2 && l && l !== 'ego') return `var(--${l})`;
    return 'var(--line-strong)';
  }

  // ---------- vue (déplacement, zoom) ----------
  function appliquer() {
    scene.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    vue.classList.toggle('compact', k < 0.5);
    try { localStorage.setItem('vr-vue-' + data.id, JSON.stringify({tx, ty, k, focus})); } catch (e) {}
  }
  function centrerSur(id, kk = k) {
    const n = positions[id]; if (!n) return;
    k = kk; const r = vue.getBoundingClientRect();
    tx = r.width / 2 - n.cx * k; ty = r.height * 0.62 - (n.y + H() / 2) * k; appliquer();
  }
  function toutVoir() {
    const ns = Object.values(positions); if (!ns.length) return;
    const x0 = Math.min(...ns.map(n => n.x)), x1 = Math.max(...ns.map(n => n.x + W())), y0 = Math.min(...ns.map(n => n.y)), y1 = Math.max(...ns.map(n => n.y + H()));
    const r = vue.getBoundingClientRect();
    k = Math.max(0.25, Math.min(1.2, Math.min((r.width - 40) / (x1 - x0), (r.height - 140) / (y1 - y0))));
    tx = (r.width - (x1 - x0) * k) / 2 - x0 * k; ty = 110 + (r.height - 140 - (y1 - y0) * k) / 2 - y0 * k; appliquer();
  }
  function premiereVue() { toutVoir(); const mini = innerWidth < 720 ? 0.62 : 0.45; if (k < mini) centrerSur(ego, mini); }
  function zoomer(f, cx, cy) {
    const r = vue.getBoundingClientRect(); cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    const nk = Math.max(0.25, Math.min(2, k * f)); tx = cx - (cx - tx) * nk / k; ty = cy - (cy - ty) * nk / k; k = nk; appliquer();
  }
  const pts = new Map(); let depart = null, bouge = false, pince = null;
  vue.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 1) { depart = {x: e.clientX, y: e.clientY, tx, ty}; bouge = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pince = {d: Math.hypot(a.x - b.x, a.y - b.y), k, tx, ty, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2}; }
  });
  vue.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const r = vue.getBoundingClientRect();
    if (pts.size === 2 && pince) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), nk = Math.max(0.25, Math.min(2, pince.k * d / pince.d));
      const cx = pince.cx - r.left, cy = pince.cy - r.top; tx = cx - (cx - pince.tx) * nk / pince.k; ty = cy - (cy - pince.ty) * nk / pince.k; k = nk; bouge = true; appliquer(); return;
    }
    if (!depart) return;
    const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    if (!bouge && Math.hypot(dx, dy) < 10) return;
    if (!bouge) { bouge = true; vue.classList.add('glisse'); try { vue.setPointerCapture(e.pointerId); } catch (_) {} }
    tx = depart.tx + dx; ty = depart.ty + dy; appliquer();
  });
  const fin = e => { pts.delete(e.pointerId); if (pts.size < 2) pince = null; if (!pts.size) { depart = null; vue.classList.remove('glisse'); } };
  vue.addEventListener('pointerup', fin); vue.addEventListener('pointercancel', fin);
  vue.addEventListener('wheel', e => { e.preventDefault(); const r = vue.getBoundingClientRect(); zoomer(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, {passive: false});
  vue.addEventListener('click', e => {
    if (bouge) { bouge = false; return; }
    const pl = e.target.closest('[data-plus]');
    if (pl) { const id = pl.dataset.plus; const n = positions[id]; ouverts[id] = (n ? n.g : 0) + PLUS; dessiner(); centrerSur(id); return; }
    const c = e.target.closest('.carte[data-id]'); if (c) ouvrirFiche(c.dataset.id);
  });
  vue.addEventListener('dblclick', e => { const c = e.target.closest('.carte[data-id]'); if (c) recentrer(c.dataset.id); });
  racineEl.querySelector('.zoom').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'plus') zoomer(1.25); if (a === 'moins') zoomer(0.8);
    if (a === 'moi') { focus = ego; ouverts = {}; dessiner(); premiereVue(); }
  });
  racineEl.querySelector('.ensemble').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; if (a === 'tout') toutVoir(); if (a === 'imprimer') print();
  });
  const leg = racineEl.querySelector('.legende');
  const legBtn = leg.querySelector('button');
  const legVue = (() => { try { return localStorage.getItem('vr-legende'); } catch (e) { return null; } })();
  if (legVue || innerWidth < 720) { legBtn.setAttribute('aria-expanded', 'false'); leg.querySelector('.corps').hidden = true; }
  legBtn.addEventListener('click', () => { const o = legBtn.getAttribute('aria-expanded') === 'true'; legBtn.setAttribute('aria-expanded', String(!o)); leg.querySelector('.corps').hidden = o; try { localStorage.setItem('vr-legende', '1'); } catch (e) {} });
  addEventListener('keydown', e => {
    if (e.target.matches('input')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') fermerFiche();
    if (e.key === '+' || e.key === '=') zoomer(1.25); if (e.key === '-') zoomer(0.8);
    if (e.key === '/') { e.preventDefault(); racineEl.querySelector('#cherche').focus(); }
    if (e.key === 'm' || e.key === 'M') { focus = ego; dessiner(); centrerSur(ego); }
    const pas = {ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80]}[e.key];
    if (pas && !e.target.closest('.fiche')) { tx += pas[0]; ty += pas[1]; appliquer(); }
  });

  // ---------- recentrage et fil ----------
  function recentrer(id) { focus = id; ouverts = {}; dessiner(); if (id === ego) premiereVue(); else centrerSur(id); }
  function majFil() {
    if (focus === ego) { fil.hidden = true; return; }
    fil.hidden = false;
    fil.innerHTML = `Vous regardez l’arbre de <b>${esc(nomComplet(P[focus]))}</b>. <button data-r="1">Revenir à ${esc(egoNom)}</button>`;
    fil.querySelector('button').onclick = () => recentrer(ego);
  }

  // ---------- fiche ----------
  function evt(lib, e, extra = '') {
    if (!e) return '';
    const pv = preuve(e.niv), quand = dateLongue(e.d), ou = e.p ? ` à ${esc(lieuCourt(e.p))}` : '';
    return `<li><span class="pv ${pv ? pv[1] : ''}" title="${pv ? esc(pv[2] + ' : ' + pv[3]) : ''}">${pv ? pv[0] : ''}</span><span>${lib} ${quand ? (/^\d{4}$/.test(e.d) ? 'en ' : 'le ') + esc(quand) : ''}${ou}${extra}${pv ? `<span class="src">${esc(pv[2])}</span>` : ''}</span></li>`;
  }
  function ouvrirFiche(id) {
    const p = P[id]; if (!p || p.cache) return;
    choisi = id; cartesEl.querySelectorAll('.choisie').forEach(c => c.classList.remove('choisie'));
    cartesEl.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('choisie');
    const f = p.s === 'F', l = lignee(p), e = f ? 'e' : '';
    const unis = (unions[id] || []).map(u => {
      const autre = P[u.h === id ? u.w : u.h];
      return evt(`Marié${e}`, u.mar || (autre ? {} : null), autre ? ` avec <button class="btn-lien" data-voir="${esc(u.h === id ? u.w : u.h)}">${esc(nomComplet(autre))}</button>` : '');
    }).join('');
    const pa = parents[id], ks = [...new Set(enfants[id] || [])].filter(z => P[z]);
    const lien = z => `<button data-voir="${esc(z)}">${esc(nomComplet(P[z]))}${P[z].cache ? '' : ` <small>${esc([an(P[z].na) || an(P[z].ba), an(P[z].de)].filter(Boolean).join(' · '))}</small>`}</button>`;
    const pv = preuve(p.niv);
    fiche.style.setProperty('--bande', l && l !== 'ego' ? `var(--${l})` : 'var(--accent)');
    fiche.innerHTML = `<button class="poignee" aria-label="Agrandir la fiche"></button><div class="bande"></div><div class="contenu">
      <button class="fermer">Fermer</button>
      <h2>${esc(nomComplet(p))}</h2>
      <p class="parente">${esc(id === ego ? 'C’est la personne de ce livre.' : parente(p, egoNom) || 'Famille')}${p.fam ? ' · Informations transmises par la famille' : ''}</p>
      ${pv ? `<p><span class="${pv[1]}">${pv[0]}</span> <b>${esc(pv[2])}</b> : ${esc(pv[3])}</p>` : ''}
      <ul class="evts">${evt(`Né${e}`, p.na)}${!p.na ? evt(`Baptisé${e}`, p.ba) : ''}${unis}${evt(`Décédé${e}`, p.de)}</ul>
      ${p.me && p.me.length ? `<h3>Métier${p.me.length > 1 ? 's' : ''}</h3><p>${p.me.map(m => { const [x, y] = met(m); return esc(x) + (y ? ` (${esc(y)})` : ''); }).join(', ')}</p>` : ''}
      ${pa && (P[pa.h] || P[pa.w]) ? `<h3>Ses parents</h3><div class="liens">${[pa.h, pa.w].filter(z => P[z]).map(lien).join('')}</div>` : ''}
      ${ks.length ? `<h3>Ses enfants</h3><div class="liens">${ks.map(lien).join('')}</div>` : ''}
      ${opt.admin && (p.no || (p.src && p.src.length)) ? `<h3>Notes de recherche (admin)</h3><div class="note">${esc(p.no || '')}${p.src && p.src.length ? '\nSources : ' + esc(p.src.join(', ')) : ''}</div>` : ''}
      <div class="actions"><button class="btn btn-1" data-recentrer="${esc(id)}">Voir son arbre</button></div></div>`;
    fiche.hidden = false; fiche.classList.remove('pleine');
    fiche.querySelector('.fermer').onclick = fermerFiche;
    fiche.querySelector('.poignee').onclick = () => fiche.classList.toggle('pleine');
    fiche.querySelector('[data-recentrer]').onclick = () => { fermerFiche(); recentrer(id); };
    fiche.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => voir(b.dataset.voir));
    fiche.querySelector('.fermer').focus({preventScroll: true});
  }
  function fermerFiche() { fiche.hidden = true; choisi = null; cartesEl.querySelectorAll('.choisie').forEach(c => c.classList.remove('choisie')); }
  function voir(id) {
    if (!P[id] || P[id].cache) return;
    if (!positions[id]) recentrer(id); else centrerSur(id);
    const c = cartesEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (c) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
    ouvrirFiche(id);
  }

  // ---------- recherche ----------
  const inp = racineEl.querySelector('#cherche'), ul = racineEl.querySelector('#sugg');
  const index = Object.entries(P).filter(([, p]) => !p.cache).map(([id, p]) => ({id, p, t: sansAccent(nomComplet(p) + ' ' + (p.p || '') + ' ' + (p.n || ''))}));
  let sel = -1, res = [];
  inp.addEventListener('input', () => {
    const q = sansAccent(inp.value).trim().split(/\s+/).filter(Boolean);
    if (!q.length || q.join('').length < 2) { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    res = index.filter(x => q.every(m => x.t.includes(m))).slice(0, 8); sel = -1;
    ul.innerHTML = res.length ? res.map((x, i) => {
      const l = lignee(x.p);
      return `<li><button role="option" data-i="${i}" aria-selected="false"><span class="pt" style="background:${l && l !== 'ego' ? `var(--${l})` : 'var(--accent)'}"></span><span>${esc(nomComplet(x.p))}<small>${esc([[an(x.p.na) || an(x.p.ba), an(x.p.de)].filter(Boolean).join(' à '), lieuCourt((x.p.na || x.p.ba || {}).p)].filter(Boolean).join(', '))}</small></span></button></li>`;
    }).join('') : '<li class="petit" style="padding:10px">Personne de ce nom dans cet arbre.</li>';
    ul.hidden = false; inp.setAttribute('aria-expanded', 'true');
  });
  ul.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) choisir(+b.dataset.i); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(res.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); ul.querySelectorAll('[data-i]').forEach((b, i) => b.setAttribute('aria-selected', String(i === sel))); }
    if (e.key === 'Enter' && res.length) choisir(sel < 0 ? 0 : sel);
  });
  function choisir(i) { const x = res[i]; if (!x) return; ul.hidden = true; inp.value = ''; inp.blur(); voir(x.id); }

  // ---------- démarrage ----------
  dessiner();
  let rep = null; try { rep = JSON.parse(localStorage.getItem('vr-vue-' + data.id) || 'null'); } catch (e) {}
  if (rep && rep.focus && P[rep.focus] && rep.focus === focus) { tx = rep.tx; ty = rep.ty; k = rep.k; appliquer(); }
  else premiereVue();
  let bulleVue = null; try { bulleVue = localStorage.getItem('vr-bulle'); } catch (e) {}
  if (!bulleVue) {
    const b = document.createElement('div'); b.className = 'bulle'; b.textContent = 'Touchez une personne pour lire sa fiche. Pincez ou utilisez + et − pour agrandir.';
    racineEl.appendChild(b); const off = () => { b.remove(); try { localStorage.setItem('vr-bulle', '1'); } catch (e) {} vue.removeEventListener('pointerdown', off); };
    vue.addEventListener('pointerdown', off); setTimeout(off, 9000);
  }
  addEventListener('resize', () => dessiner());
  return {recentrer, voir, detruire: () => { racineEl.innerHTML = ''; }};
}
