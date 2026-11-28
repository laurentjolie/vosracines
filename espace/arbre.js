// Vos Racines : visualiseur d'arbre ascendant, façon Family Echo (29/10/2026).
// Données : { titre, racine, personnes: {id: {p,n,u,s,sosa,na,ba,de,me,niv,v,cache,fam,no,src}}, familles: [{h,w,mar,enfants}] }
const W = () => (innerWidth < 720 ? 168 : 220), H = () => (innerWidth < 720 ? 80 : 92);
const GAP = 28, GAP_COUPLE = 48, GAP_GEN = 72, PLUS = 3;
const PROF = () => (innerWidth < 720 ? 2 : 3);
// 28/11/2026 (Laurent) : trois formes de l'arbre (arbre, roue, frise) et un passage animé de l'une à l'autre
try { CSS.registerProperty({name: '--fs', syntax: '<length>', inherits: true, initialValue: '16px'}); } catch (e) {}
const NS = 'http://www.w3.org/2000/svg';
const MODES = {arbre: 'Arbre', roue: 'Roue', frise: 'Frise', carte: 'Carte'};
const ICONES = {
  arbre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8.5" y="16" width="7" height="5" rx="1"/><path d="M6.5 8v3.5h11V8M12 11.5V16"/></svg>',
  roue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21M12 3v5.5M12 15.5V21"/></svg>',
  carte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  frise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 20h18M6 20v-2M12 20v-2M18 20v-2"/><rect x="3" y="11" width="10" height="4" rx="1"/><rect x="9" y="4" width="12" height="4" rx="1"/></svg>'};
const PERIODES = [[1789, 1799, 'Révolution'], [1803, 1815, 'Guerres napoléoniennes'], [1870, 1871, 'Guerre de 1870'], [1914, 1918, 'Première Guerre mondiale'], [1939, 1945, 'Seconde Guerre mondiale']];
const rad = a => a * Math.PI / 180;
const pt = (r, a) => `${(r * Math.cos(rad(a))).toFixed(1)} ${(r * Math.sin(rad(a))).toFixed(1)}`;
function secteur(r0, r1, a0, a1) { const g = a1 - a0 > 180 ? 1 : 0; return `M${pt(r1, a0)} A${r1} ${r1} 0 ${g} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 ${g} 0 ${pt(r0, a0)} Z`; }
const lisible = a => { let r = ((a % 360) + 360) % 360; if (r > 90 && r <= 270) r -= 180; else if (r > 270) r -= 360; return r; };
const rayon = g => (g <= 3 ? 120 + g * 100 : 420 + (g - 3) * 150);
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// 02/11/2026 (audit UX, D1) : 5e élément = le mot court affiché sur la carte, à la place du glyphe (couleur seule, 15 px)
const PREUVE = {acte: ['●', 'p-acte', 'Acte lu', 'nous avons lu l’acte', 'Acte'], piste: ['◐', 'p-piste', 'Piste', 'indiqué par d’autres chercheurs, pas encore vérifié', 'Piste'],
  hypothese: ['○', 'p-hyp', 'Hypothèse', 'probable, à confirmer', 'Supposé'], famille: ['◆', 'p-fam', 'Donné par la famille', 'information transmise par la famille', 'Famille']};
// 29/10 : le trait dit la solidite du lien de parente (du parent vers l'enfant), pas seulement la personne
const LIEN = {acte: {w: 3, d: '', lib: 'Lien prouvé par un acte'}, piste: {w: 2.2, d: '9 6', lib: 'Lien probable (piste)'},
  hypothese: {w: 2.2, d: '1.5 6', lib: 'Lien supposé (hypothèse)'}, famille: {w: 2.2, d: '12 4 2 4', lib: 'Lien donné par la famille'}, inconnu: {w: 2, d: '4 4', lib: 'Lien non vérifié'}};
const lienDe = x => { const n = x && ((x.li && x.li.niv) || x.nl); if (!n) return LIEN.inconnu; if (n.startsWith('hyp')) return LIEN.hypothese; return LIEN[n] || LIEN.piste; };
const LIBNL = {acte: 'prouvé par un acte', piste: 'probable : une piste, pas encore d’acte lu', hypothese: 'supposé : une hypothèse à confirmer', famille: 'donné par la famille'};
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
// 17/11/2026 (Laurent) : pas de lien vers un site qui demande une connexion (Filae, recherches et registres Geneanet,
// FamilySearch, MyHeritage, Ancestry) ; les arbres publics de Geneanet (gw.geneanet.org) restent liés.
const CONNEXION = /(^|\.)filae\.com\b|geneanet\.org\/(fonds|registres|cercles|premium|archives)|familysearch\.org|myheritage\.|ancestry\./i;
export const lienPublic = u => { try { const x = new URL(String(u || '')); return CONNEXION.test(x.hostname + x.pathname) ? '' : x.href; } catch (e) { return ''; } };
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
  const R = data.registre || {};
  // 02/11/2026 (chantier 3, tâche 9) : recherches familiales en attente de validation (PISTES-FAMILLE-*.md), administrateur seul
  const AV = opt.admin ? (data.a_valider || []) : [];
  const LIBAV = {acte: ['Prouvé', 'p-acte'], piste: ['Piste', 'p-piste'], hypothese: ['Hypothèse', 'p-hyp'], echec: ['Échec', ''], autre: ['Note', '']};
  const NIVR = {'prouvé': 'Prouvé : lu sur l’image', 'piste forte': 'Piste forte : relevé avec cote, ou deux sources concordantes', 'piste': 'Piste : index ou arbre en ligne', 'hypothèse': 'Hypothèse : un seul indice', 'écarté': 'Écarté : homonyme ou document rejeté'};
  const RANGR = {acte: 0, piste: 1, hypothese: 2, ecarte: 3};
  const triRa = ra => ra.filter(([i]) => R[i]).sort((x, y) => (RANGR[R[x[0]].niv] ?? 1) - (RANGR[R[y[0]].niv] ?? 1) || String(R[x[0]].d || '').localeCompare(String(R[y[0]].d || '')));
  const nivLien = x => { const n = (x.li && x.li.niv) || x.nl || ''; return n.startsWith('hyp') ? 'hypothese' : n; };
  const egoNom = (P[ego] && (P[ego].u || P[ego].p) || '').split(' ')[0];
  let focus = ego, ouverts = {}, choisi = null, k = 1, tx = 0, ty = 0, positions = {}, tout = false;
  let mode = (() => { try { const m = localStorage.getItem('vr-mode'); return MODES[m] ? m : 'arbre'; } catch (e) { return 'arbre'; } })();
  let vusCles = {}, bornes = null, secteurs = [], rafDecor = 0, enCours = [], friseInfo = null;

  racineEl.innerHTML = `
  <div class="vue" tabindex="-1"><div class="scene"><svg></svg><div class="cartes"></div></div></div>
  <div class="flottant recherche" role="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    <label class="cache-visuel" for="cherche">Rechercher une personne</label>
    <input id="cherche" type="search" placeholder="Rechercher une personne" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sugg">
    <ul class="suggestions" id="sugg" role="listbox" hidden></ul>
  </div>
  <div class="fil" hidden></div>
  <div class="axe-collant" hidden aria-hidden="true"></div>
  <div class="flottant periode" hidden><button class="p-ouvrir" data-p="ouvrir">Qui vivait en… ?</button><span class="p-corps" hidden><label for="p-an">Qui vivait en</label> <input id="p-an" type="number" inputmode="numeric"> <input class="p-curseur" type="range" aria-label="Année"> <button data-p="liste">Voir la liste</button> <button data-p="fermer" aria-label="Fermer">✕</button></span></div>
  <div class="flottant modes" role="group" aria-label="Forme de l’arbre">${Object.entries(MODES).map(([m, lib]) => `<button data-mode="${m}" aria-pressed="false" title="Voir sous forme de ${lib.toLowerCase()}">${ICONES[m]}<span>${lib}</span></button>`).join('')}</div>
  <div class="flottant ensemble"><button class="ens-menu" data-a="menu" aria-expanded="false">Plus ▾</button><button data-a="entier">Ouvrir l’arbre en entier</button>${Object.values(P).filter(p => p.pep && !p.cache).length ? `<button data-a="pepites">✦ Les personnes bien documentées (${Object.values(P).filter(p => p.pep && !p.cache).length})</button>` : ''}${(data.actes || []).length ? `<button data-a="actes">Les actes du livre (${data.actes.length})</button>` : ''}${AV.length ? `<button data-a="avalider">Recherches à valider (${AV.length})</button>` : ''}<button data-a="tout">Vue d’ensemble</button><button data-a="imprimer">Imprimer cette vue</button></div>
  <div class="acte-vue" hidden role="dialog" aria-modal="true" aria-label="Acte"></div>
  <div class="flottant zoom">
    <button data-a="plus" aria-label="Agrandir">+</button><button data-a="moins" aria-label="Réduire">−</button>
    <button data-a="moi" class="moi" aria-label="Revenir à ${esc(egoNom)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg><span>Revenir à ${esc(egoNom)}</span></button>
  </div>
  <div class="flottant legende"><button aria-expanded="true">Légende<span class="leg-plus"> : couleurs, preuves et traits</span></button><div class="corps">
    <ul>${['l1','l2','l3','l4'].map((l, i) => `<li><span class="sw" style="background:var(--${l})"></span>${esc(nomLignee(i))}</li>`).join('')}</ul>
    <ul>${['acte','piste','hypothese','famille'].map(n => `<li><span class="preuve mot ${PREUVE[n][1]}">${PREUVE[n][4]}</span><span><b>${PREUVE[n][2]}</b> : ${PREUVE[n][3]}</span></li>`).join('')}
    <li><span style="width:16px;text-align:center">🔒</span><span>Personne vivante : seul le prénom est affiché</span></li></ul>
    <p class="leg-titre">Les personnes bien documentées</p><ul><li><span class="sw pepite-sw"></span><span>Halo doré : une personne sur qui on en sait davantage (guerre, décoration, presse, justice, voyage, histoire de famille)</span></li></ul>
    <p class="leg-titre">Les traits entre parents et enfants</p>
    <ul>${['acte','piste','hypothese','famille'].map(n => `<li><svg width="44" height="10" aria-hidden="true"><path d="M2 5 H42" stroke="var(--ink-soft)" stroke-width="${LIEN[n].w}" stroke-linecap="round" ${LIEN[n].d ? `stroke-dasharray="${LIEN[n].d}"` : ''}/></svg><span>${LIEN[n].lib}</span></li>`).join('')}</ul></div></div>
  <aside class="fiche" hidden aria-label="Fiche de la personne"></aside>`;
  const vue = racineEl.querySelector('.vue'), scene = racineEl.querySelector('.scene'), svg = scene.querySelector('svg'),
        cartesEl = scene.querySelector('.cartes'), fiche = racineEl.querySelector('.fiche'), fil = racineEl.querySelector('.fil');

  function nomLignee(i) {
    const s = 4 + i, x = Object.values(P).find(p => p.sosa && p.sosa.includes(s));
    const role = ['Grand-père paternel', 'Grand-mère paternelle', 'Grand-père maternel', 'Grand-mère maternelle'][i];
    return x && x.n ? `${role} : les ${x.n.charAt(0) + x.n.slice(1).toLowerCase()}` : role;
  }

  // ---------- disposition ----------
  // 17/11/2026 (Laurent : « s'il n'y a qu'un seul ancêtre dans une direction il faut afficher plus un ») : le bouton annonce
  // le nombre de générations réellement disponibles au-dessus (au plus PLUS), au lieu de PLUS en dur.
  const hauteurs = {};
  function hauteur(id, vu = new Set()) {
    if (id in hauteurs) return hauteurs[id];
    if (vu.has(id)) return 0; vu.add(id);
    const f = parents[id]; let h = 0;
    if (f) for (const z of [f.h, f.w]) if (z && P[z]) h = Math.max(h, 1 + hauteur(z, vu));
    return (hauteurs[id] = h);
  }
  function construire() {
    const w = W(), h = H(); let curseur = 0; const noeuds = [], liens = [], plusBtns = [];
    function place(id, g, lim) {
      const x = P[id]; const f = parents[id];
      const montre = f && !x.cache && (tout || g < lim);
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
    for (const n of noeuds) { n.x = n.cx - w / 2; n.y = y(n.g); n.w = w; n.h = h; positions[n.id] = n; }
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

  function carteHTML(id, x, y, extra = '', geo = {}, cleCarte = id) {
    const p = P[id]; if (!p) return '';
    // 28/11/2026 : géométrie propre à la roue et à la frise (taille, rotation, taille du texte) et clé stable pour l'animation
    const st = `left:${x}px;top:${y}px` + (geo.w ? `;width:${geo.w.toFixed(1)}px;height:${geo.h.toFixed(1)}px;--fs:${geo.fs}px` : '') + (geo.rot ? `;transform:rotate(${geo.rot.toFixed(2)}deg)` : '');
    const da = `data-k="${esc(cleCarte)}" data-g="${geo.g || 0}"${geo.rot ? ` data-rot="${geo.rot.toFixed(2)}"` : ''}`;
    if (p.cache) return `<div class="carte vivant ${extra}" ${da} style="${st}" title="Personne vivante : seul le prénom est affiché." role="img" aria-label="${esc(p.p)}, personne vivante : seul le prénom est affiché">
      <span class="nom">${esc(p.p)}</span><svg class="cadenas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>`;
    const l = lignee(p), pv = preuve(p.niv), est = id === ego;
    const dates = [an(p.na) || an(p.ba), an(p.de)].some(Boolean) ? `${an(p.na) || an(p.ba) || '?'}${p.de ? ' · ' + an(p.de) : (p.v ? '' : ' · ?')}` : '';
    const lieu = lieuCourt((p.na || p.ba || {}).p) || (p.me && p.me[0] ? met(p.me[0])[0] : '');
    const lab = [nomComplet(p), dates.replace(' · ', ' à '), lieu, pv ? pv[2] : '', p.pep ? 'personne bien documentée' : ''].filter(Boolean).join(', ');
    return `<button class="carte ${est ? 'ego' : l} ${choisi === id ? 'choisie' : ''} ${p.pep ? 'pepite' : ''} ${pv ? 'avec-preuve' : ''} ${extra}" data-id="${esc(id)}" ${da} style="${st}" ${est ? `data-ruban="${esc(egoNom)}"` : ''} aria-label="${esc(lab)}">
      <span class="nom" title="${esc(nomComplet(p))}">${esc(nomComplet(p))}</span><span class="dates">${esc(dates)}</span><span class="lieu">${esc(lieu)}</span>
      ${pv ? `<span class="preuve mot ${pv[1]}" aria-hidden="true">${pv[4]}</span>` : ''}${p.pep ? '<span class="etoile" aria-hidden="true">✦</span>' : ''}</button>`;
  }

  function dessinerArbre() {
    const L = construire(), {w, h} = L; let html = '', paths = '';
    for (const n of L.noeuds) html += carteHTML(n.id, n.x, n.y, '', {g: n.g}, cle(n.id));
    for (const n of L.liens) {
      const mid = n.y - GAP_GEN / 2, cl = colLien(n), L = lienDe(P[n.id]);
      const st = `stroke="${cl}" stroke-width="${L.w}" fill="none" stroke-linecap="round" ${L.d ? `stroke-dasharray="${L.d}"` : ''}`;
      const ps = [n.pere, n.mere].filter(Boolean);
      // 30/10 : le trait est cliquable et ouvre l'explication du lien
      const dd = [`M${n.cx} ${n.y} V${mid}`, ps.length === 2 ? `M${ps[0].cx} ${ps[0].y + h} V${mid} H${ps[1].cx} V${ps[1].y + h}` : `M${ps[0].cx} ${ps[0].y + h} V${mid} H${n.cx}`];
      paths += `<g class="lien" data-lien="${esc(n.id)}"><title>${L.lib} : touchez pour savoir pourquoi</title>${dd.map(d => `<path class="vis" d="${d}" ${st} stroke-linejoin="round"/>`).join('')}${dd.map(d => `<path class="clic" d="${d}" stroke="transparent" stroke-width="18" fill="none"/>`).join('')}</g>`;
      const m = n.f && n.f.mar;
      if (ps.length === 2) html += `<span class="anneau" data-lien="${esc(n.id)}" title="Touchez pour savoir pourquoi ce lien" style="left:${(ps[0].cx + ps[1].cx) / 2}px;top:${mid}px">∞${m && m.d ? ' ' + esc(an(m)) : ''}</span>`;
    }
    for (const n of L.plusBtns) { const k = Math.min(PLUS, hauteur(n.id)) || 1; html += `<button class="plus" data-plus="${esc(n.id)}" style="left:${n.cx - 75}px;top:${n.y - 52}px">+ ${k} génération${k > 1 ? 's' : ''}</button>`; }
    if (L.desc.length) {
      const foc = positions[focus];
      html += `<span class="titre-enfants" style="left:${foc.cx}px;top:${foc.y + h + 20}px">${L.desc.length === 1 ? 'Parmi ses enfants' : 'Ses enfants'}</span>`;
      for (const d of L.desc) { html += carteHTML(d.id, d.x, d.y, 'desc', {g: 0}, cle(d.id)); const L = lienDe(P[d.id]); paths += `<path d="M${foc.cx} ${foc.y + h} V${foc.y + h + 14} M${d.x + w / 2} ${d.y} V${d.y - 10} H${foc.cx}" stroke="var(--line-strong)" stroke-width="${L.w}" ${L.d ? `stroke-dasharray="${L.d}"` : ''} fill="none"/>`; }
    }
    svg.innerHTML = paths; cartesEl.innerHTML = html;
  }

  // ---------- 28/11/2026 (Laurent) : trois formes de l'arbre et passage animé ----------
  // Arbre (ci-dessus), roue (le point focal au centre, ses ascendants en anneaux, comme demandé par Stéphane) et frise
  // (chaque personne est un rectangle posé sur l'axe du temps, de sa naissance à sa mort). D'une forme à l'autre, chaque
  // carte glisse, tourne et se redimensionne jusqu'à sa nouvelle place ; celles qui apparaissent sortent de leur enfant,
  // celles qui disparaissent y rentrent ; le décor (traits, secteurs, axe) se dessine ensuite.
  const cle = id => { const n = (vusCles[id] = (vusCles[id] || 0) + 1); return n === 1 ? id : `${id}~${n}`; };
  const kmin = () => ((tout || mode !== 'arbre') ? 0.05 : 0.25);
  function dessiner() {
    finirDecor(); vusCles = {}; bornes = null; positions = {}; secteurs = []; friseInfo = null; if (typeof majPeriode === 'function' && mode !== 'frise') perEl.hidden = true;
    vue.dataset.mode = mode;
    if (mode === 'roue') dessinerRoue(); else if (mode === 'frise') dessinerFrise(); else if (mode === 'carte') dessinerCarte(); else dessinerArbre();
    majFil();
  }
  function dessinerRoue() {
    const G = Math.min(hauteur(focus), tout ? 9 : 7), R = rayon(G);
    let html = '', fonds = '', vides = '';
    const cw = innerWidth < 720 ? 176 : 204, ch = innerWidth < 720 ? 80 : 88;
    html += carteHTML(focus, -cw / 2, -ch / 2, 'centre', {g: 0, w: cw, h: ch, fs: 16}, cle(focus));
    positions[focus] = {x: -cw / 2, y: -ch / 2, w: cw, h: ch, cx: 0, cy: 0};
    const file = [{id: focus, s: 1, g: 0}];
    while (file.length) {
      const {id, s, g} = file.shift(); const x = P[id], f = parents[id];
      if (g >= G || x.cache) continue;
      [[f && f.h, 0], [f && f.w, 1]].forEach(([z, d]) => {
        const g2 = g + 1, s2 = s * 2 + d, n = 2 ** g2, span = 360 / n, a0 = 180 + (s2 - n) * span, a1 = a0 + span, r0 = rayon(g), r1 = rayon(g2);
        if (!z || !P[z]) { vides += `<path class="vide" d="${secteur(r0 + 3, r1 - 3, a0 + 0.5, a1 - 0.5)}"/>`; return; }
        const p = P[z], l = lignee(p), am = (a0 + a1) / 2, rm = (r0 + r1) / 2, arc = rad(span) * rm, ep = r1 - r0;
        fonds += `<path class="sect" d="${secteur(r0, r1, a0, a1)}" style="fill:${p.cache ? 'var(--bg-2)' : LIGNEE.includes(l) ? `var(--${l}-tint)` : 'var(--band)'}"/>`;
        secteurs.push({r0, r1, a0, a1, g: g2});
        let w, h, rot, fs;
        if (g2 <= 3) { w = Math.min(arc * 0.84, 236); h = ep * 0.66; rot = am + 90; fs = [16, 17, 15, 13.5][g2]; }
        else { w = ep * 0.88; h = Math.min(arc * 0.8, 46); rot = am; fs = Math.max(7.5, Math.min(13.5, h * 0.34)); }
        rot = lisible(rot);
        const cx = rm * Math.cos(rad(am)), cy = rm * Math.sin(rad(am));
        html += carteHTML(z, cx - w / 2, cy - h / 2, 'r' + (h < 30 ? ' court' : ''), {g: g2, w, h, fs, rot}, cle(z));
        if (!positions[z]) positions[z] = {x: cx - w / 2, y: cy - h / 2, w, h, cx, cy};
        file.push({id: z, s: s2, g: g2});
      });
    }
    svg.innerHTML = `<g class="roue-fond">${fonds}</g><g class="roue-vides">${vides}</g><circle class="roue-centre" r="${rayon(0)}"/>${G ? `<circle class="roue-bord" r="${R + 8}"/>` : ''}`;
    svg.querySelectorAll('path.sect').forEach((el, i) => { secteurs[i].el = el; });
    cartesEl.innerHTML = html;
    bornes = {x0: -R - 24, x1: R + 24, y0: -R - 24, y1: R + 24};
  }
  const nomGen = g => (g === 0 ? (nomComplet(P[focus]).split(' ')[0] || '') : (['', 'Parents', 'Grands-parents', 'Arrière-grands-parents'][g] || `Génération ${g}`));
  function dessinerFrise() {
    const Gm = tout ? 14 : 6, PX = innerWidth < 720 ? 4 : 4.6, HC = 34, GL = 5, GB = 28, ici = new Date().getFullYear();
    const liste = [], file = [{id: focus, s: 1, g: 0, enf: null}];
    while (file.length) {
      const it = file.shift(); liste.push(it);
      const x = P[it.id], f = parents[it.id];
      if (it.g < Gm && f && !x.cache) [[f.h, 0], [f.w, 1]].forEach(([z, d]) => { if (z && P[z]) file.push({id: z, s: it.s * 2 + d, g: it.g + 1, enf: it}); });
    }
    for (const it of liste) {   // les enfants passent avant leurs parents : une naissance inconnue s'estime d'après l'enfant
      const p = P[it.id]; if (p.cache) continue;
      let b = +an(p.na) || +an(p.ba) || 0, e = +an(p.de) || 0, est = false, estB = !b;
      if (!b && e) b = e - 60;
      if (!b && it.enf && it.enf.b) b = it.enf.b - 30;
      if (!b) continue;
      // 28/11/2026 (Laurent) : une personne sans décès connu et qui peut être en vie va jusqu'à aujourd'hui ; rien au-delà d'aujourd'hui
      if (!e) { if (p.v || b > ici - 105) e = ici; else { e = b + 62; est = true; } }
      Object.assign(it, {b, e: Math.max(Math.min(e, ici), b + 1), est, estB, ok: true});
    }
    for (const it of [...liste].reverse()) {   // sans aucune date (souvent un vivant) : d'après ses parents
      const p = P[it.id]; if (it.ok || p.cache) continue;
      const pa = liste.filter(z => z.enf === it && z.ok); if (!pa.length) continue;
      const b = Math.max(...pa.map(z => z.b)) + 28;
      Object.assign(it, {b, e: Math.max(b + 1, (p.v || b > ici - 105) ? ici : Math.min(ici, b + 62)), est: !(p.v || b > ici - 105), estB: true, ok: true});
    }
    const vis = liste.filter(i => i.ok), sans = liste.filter(i => !i.ok && !P[i.id].cache).length;
    if (!vis.length) { svg.innerHTML = ''; cartesEl.innerHTML = '<p class="frise-vide">Aucune date connue pour placer ces personnes sur une frise.</p>'; return; }
    const debut = Math.floor((Math.min(...vis.map(i => i.b)) - 8) / 10) * 10, finA = Math.min(ici, Math.ceil((Math.max(...vis.map(i => i.e)) + 4) / 10) * 10), X = a => (a - debut) * PX;
    const parG = {}; vis.forEach(i => (parG[i.g] = parG[i.g] || []).push(i));
    let base = 0; const bandes = [];
    Object.keys(parG).map(Number).sort((a, b) => a - b).forEach(g => {
      const L = parG[g].sort((a, b) => a.s - b.s), voies = [];
      for (const i of L) {
        i.x = X(i.b); i.w = Math.max(104, X(i.e) - i.x);
        let v = voies.findIndex(z => z + 10 <= i.x); if (v < 0) { v = voies.length; voies.push(0); }
        voies[v] = i.x + i.w; i.voie = v;
      }
      const bas = base - GB, haut = bas - voies.length * (HC + GL);
      L.forEach(i => { i.y = bas - (i.voie + 1) * (HC + GL) + GL; });
      bandes.push({g, haut, bas}); base = haut;
    });
    const xa = X(debut) - 190, xb = X(finA) + 24, haut = base - 40;
    let fond = '', axe = '', liens = '', html = '';
    bandes.forEach((b, j) => {
      if (j % 2) fond += `<rect class="bande" x="${xa}" y="${b.haut + GL}" width="${xb - xa}" height="${b.bas - b.haut}"/>`;
      fond += `<text class="nom-bande" x="${X(debut) - 18}" y="${(b.haut + b.bas) / 2 + 8}">${esc(nomGen(b.g))}</text>`;
    });
    PERIODES.filter(([a, z]) => z >= debut && a <= finA).forEach(([a, z, t], j) => {
      fond += `<rect class="periode" x="${X(a)}" y="${haut}" width="${Math.max(4, X(z + 1) - X(a))}" height="${-haut}"/><text class="periode-t" x="${X(a)}" y="${haut - 10 - (j % 2) * 18}">${esc(t)}</text>`;
    });
    for (let a = debut; a <= finA; a += 10) {
      const c50 = a % 50 === 0, c100 = a % 100 === 0;
      if (c50) fond += `<path class="grille${c100 ? ' siecle' : ''}" d="M${X(a)} ${haut} V0"/>`;
      axe += `<path class="tic" d="M${X(a)} 0 V${c50 ? 10 : 5}"/>` + (c50 ? `<text class="annee${c100 ? ' siecle' : ''}" x="${X(a)}" y="32">${a}</text>` : '');
    }
    if (ici <= finA) axe += `<path class="ici" d="M${X(ici)} ${haut} V0"/><text class="ici-t" x="${X(ici)}" y="${haut - 10}">Aujourd’hui</text>`;
    vis.forEach(i => {   // trait vertical du parent vers l'enfant, à l'année de naissance de l'enfant : on lit l'âge du parent
      const c = i.enf; if (!c || !c.ok) return;
      const cible = c.x + (i.s % 2 ? 24 : 10), xp = Math.min(Math.max(cible, i.x + 6), i.x + i.w - 6), Ln = lienDe(P[c.id]), l = lignee(P[i.id]);
      const col = LIGNEE.includes(l) ? `var(--${l})` : 'var(--line-strong)';
      const d = xp === cible ? `M${xp} ${i.y + HC} V${c.y}` : `M${xp} ${i.y + HC} V${c.y - 10} H${cible} V${c.y}`;
      liens += `<path d="${d}" stroke="${col}" stroke-width="${Ln.w * 0.8}" ${Ln.d ? `stroke-dasharray="${Ln.d}"` : ''}/><circle cx="${xp}" cy="${i.y + HC}" r="3.2" fill="${col}"/>`;
    });
    vis.forEach(i => {
      html += carteHTML(i.id, i.x, i.y, 'f' + (i.est ? ' estime' : '') + (i.estB ? ' estime-debut' : '') + (i.w < 190 ? ' etroit' : ''), {g: i.g, w: i.w, h: HC, fs: 14}, cle(i.id));
      if (!positions[i.id]) positions[i.id] = {x: i.x, y: i.y, w: i.w, h: HC, cx: i.x + i.w / 2, cy: i.y + HC / 2};
    });
    if (sans) html += `<p class="frise-note" style="left:${X(debut)}px;top:50px">${sans} personne${sans > 1 ? 's' : ''} sans date connue ${sans > 1 ? 'ne figurent' : 'ne figure'} pas sur la frise.</p>`;
    svg.innerHTML = `<g class="frise-fond">${fond}</g><g class="frise-liens">${liens}</g><g class="frise-axe"><path class="axe-ligne" d="M${X(debut) - 10} 0 H${xb}"/>${axe}</g>`;
    cartesEl.innerHTML = html;
    bornes = {x0: xa, x1: xb, y0: haut - 50, y1: 80}; friseInfo = {debut, finA, PX, vis, haut};
    majPeriode();
  }

  // 28/11/2026 (Laurent) : dans la frise, l'axe des années reste en bas de l'écran quand on remonte vers les anciennes générations
  const axeEl = racineEl.querySelector('.axe-collant');
  function majAxe() {
    if (!axeEl) return;
    const r = vue.getBoundingClientRect();
    if (mode !== 'frise' || !friseInfo || ty < r.height - 40) { axeEl.hidden = true; return; }
    const {debut, finA, PX} = friseInfo, dec = 10 * PX * k, pas = dec >= 46 ? 10 : dec * 5 >= 46 ? 50 : 100;
    let h = `<path class="axe-ligne" d="M${Math.max(0, tx - 10 * k)} 12 H${Math.min(r.width, (finA - debut) * PX * k + tx)}"/>`;
    for (let a = Math.ceil(debut / 10) * 10; a <= finA; a += 10) {
      const x = (a - debut) * PX * k + tx; if (x < -30 || x > r.width + 30) continue;
      const lab = a % pas === 0, c100 = a % 100 === 0;
      if (dec >= 6 || lab) h += `<path class="tic" d="M${x.toFixed(1)} 12 V${lab ? 20 : 16}"/>`;
      if (lab) h += `<text class="annee${c100 ? ' siecle' : ''}" x="${x.toFixed(1)}" y="36">${a}</text>`;
    }
    axeEl.innerHTML = `<svg width="${r.width}" height="44">${h}</svg>`; axeEl.hidden = false;
  }

  // ---------- 28/11/2026 (Laurent) : vue Carte. Chaque personne est un point posé sur son lieu de naissance (à défaut baptême,
  // mariage, décès) ; chaque lieu se touche et donne la liste des personnes qui y ont un acte (naissance, mariage, décès, acte lu).
  let FOND = null, fondEnCours = false;
  const LIEUX = data.lieux || {};
  const nomLieu = s => { const ps = String(s).split(/,(?![^(]*\))/).map(x => x.trim()); const q = ps.find(x => x.includes('(')) || ps[ps.length - 1]; return q.replace(/\s*\(.*$/, ''); };
  const qualLieu = s => { const m = String(s).match(/\(([^)]*)\)/); return m ? m[1] : ''; };
  const KC = Math.cos(rad(46.5)), SC = 230;
  const proj = ([lon, lat]) => [lon * SC * KC, -lat * SC];
  let lieuxVus = {};
  function chargerFond() {
    if (FOND || fondEnCours) return; fondEnCours = true;
    import('./carte-fond.js').then(m => { FOND = m.FOND; if (mode === 'carte') { const g = svg.querySelector('.carte-fond'); if (g) { g.innerHTML = fondSVG(); g.animate([{opacity: 0}, {opacity: 1}], {duration: 500}); } } }).catch(() => {}).finally(() => { fondEnCours = false; });
  }
  function fondSVG() {
    if (!FOND) return '';
    const d = arr => { let s = ''; for (let i = 0; i < arr.length; i += 2) { const [x, y] = proj([arr[i] / 100, arr[i + 1] / 100]); s += (i ? 'L' : 'M') + x.toFixed(0) + ' ' + y.toFixed(0); } return s + 'Z'; };
    return `<path class="terre" d="${FOND.terre.map(d).join('')}"/><path class="france" d="${FOND.fr.map(d).join('')}"/><path class="deps" d="${FOND.deps.map(d).join('')}"/>`;
  }
  function evenementsDe(id) {   // [{lieu, lib, an}]
    const p = P[id], out = [], f = p.s === 'F' ? 'e' : '';
    if (p.na && p.na.p) out.push({lieu: p.na.p, lib: `Né${f}`, an: an(p.na)});
    if (p.ba && p.ba.p) out.push({lieu: p.ba.p, lib: `Baptisé${f}`, an: an(p.ba)});
    for (const u of unions[id] || []) if (u.mar && u.mar.p) { const z = P[u.h === id ? u.w : u.h]; out.push({lieu: u.mar.p, lib: `Marié${f}` + (z && !z.cache ? ' avec ' + nomComplet(z) : ''), an: an(u.mar)}); }
    if (p.de && p.de.p) out.push({lieu: p.de.p, lib: `Décédé${f}`, an: an(p.de)});
    for (const [i] of p.ra || []) { const a = R[i]; if (a && a.lieu && !out.some(o => o.lieu === a.lieu && o.an === String(a.d || '').slice(0, 4) && a.ty && o.lib.toLowerCase().startsWith(String(a.ty).slice(0, 3).toLowerCase()))) out.push({lieu: a.lieu, lib: a.t || a.ty || 'Acte', an: String(a.d || '').slice(0, 4), acte: i}); }
    return out.filter(o => LIEUX[o.lieu]);
  }
  function dessinerCarte() {
    const Gm = tout ? 14 : 7, liste = [], vu = new Set(), file = [{id: focus, g: 0}];
    while (file.length) {
      const it = file.shift(); if (vu.has(it.id)) continue; vu.add(it.id);
      const x = P[it.id]; if (!x || x.cache) continue; liste.push(it);
      const f = parents[it.id]; if (it.g < Gm && f) [f.h, f.w].forEach(z => { if (z && P[z]) file.push({id: z, g: it.g + 1}); });
    }
    lieuxVus = {}; let sans = 0;
    const cleL = s => LIEUX[s].map(v => v.toFixed(3)).join(',');
    for (const it of liste) {
      const ev = evenementsDe(it.id); if (!ev.length) { sans++; continue; }
      it.ou = ev.find(e => /^Né|^Bapt/.test(e.lib)) || ev.find(e => /^Mari/.test(e.lib)) || ev[0];
      for (const e of ev) { const k0 = cleL(e.lieu), L = lieuxVus[k0] = lieuxVus[k0] || {k: k0, noms: {}, c: proj(LIEUX[e.lieu]), gens: new Map(), dots: []}; L.noms[e.lieu] = 1; if (!L.gens.has(it.id)) L.gens.set(it.id, []); L.gens.get(it.id).push(e); }
      lieuxVus[cleL(it.ou.lieu)].dots.push(it);
    }
    let html = '', pts = [];
    for (const L of Object.values(lieuxVus)) {
      const n = L.gens.size, [cx, cy] = L.c, nom = nomLieu(Object.keys(L.noms).sort((a, b) => a.length - b.length)[0]);
      L.nom = nom; L.r = Math.max(9, 7 + 4.2 * Math.sqrt(L.dots.length));
      L.dots.sort((a, b) => a.g - b.g).forEach((it, i) => {   // les personnes en tournesol autour du lieu
        const a = i * 2.39996, r = i ? 6.2 * Math.sqrt(i) : 0, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        html += carteHTML(it.id, x - 6, y - 6, 'c', {g: it.g, w: 12, h: 12, fs: 1}, cle(it.id));
        if (!positions[it.id]) positions[it.id] = {x: x - 6, y: y - 6, w: 12, h: 12, cx: x, cy: y};
      });
      html += `<button class="lieu-pt${n >= 3 ? ' grand' : ''}" data-lieu="${esc(L.k)}" style="left:${cx}px;top:${cy}px;--r:${L.r.toFixed(1)}px" aria-label="${esc(nom)} : ${n} personne${n > 1 ? 's' : ''}" title="${esc(nom)} (${n})"><span>${esc(nom)}</span></button>`;
      pts.push([cx, cy]);
    }
    if (!pts.length) { svg.innerHTML = ''; cartesEl.innerHTML = '<p class="frise-vide">Aucun lieu situé sur la carte pour ces personnes.</p>'; bornes = {x0: -200, x1: 200, y0: -60, y1: 60}; return; }
    if (sans) html += `<p class="frise-note carte-note" style="left:${Math.min(...pts.map(p => p[0]))}px;top:${Math.max(...pts.map(p => p[1])) + 40}px">${sans} personne${sans > 1 ? 's' : ''} sans lieu connu ${sans > 1 ? 'ne figurent' : 'ne figure'} pas sur la carte.</p>`;
    svg.innerHTML = `<g class="carte-fond">${fondSVG()}</g>`;
    cartesEl.innerHTML = html;
    const dedans = pts.filter(([x, y]) => x >= proj([-15, 0])[0] && x <= proj([40, 0])[0] && y >= proj([0, 62])[1] && y <= proj([0, 30])[1]);   // le cadrage ignore les lieux lointains (Antilles, Amérique)
    const xs = (dedans.length ? dedans : pts).map(p => p[0]), ys = (dedans.length ? dedans : pts).map(p => p[1]), m = 90;
    bornes = {x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, y0: Math.min(...ys) - m, y1: Math.max(...ys) + m};
    chargerFond();
  }
  function ouvrirLieu(k0) {
    const L = lieuxVus[k0]; if (!L) return;
    const gens = [...L.gens.entries()].sort((a, b) => (+(a[1][0].an) || 9999) - (+(b[1][0].an) || 9999));
    const quals = [...new Set(Object.keys(L.noms).map(qualLieu).filter(Boolean))];
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(L.nom)}${quals.length ? ` <small>(${esc(quals.join(', '))})</small>` : ''}</h2><button class="fermer">Fermer</button></div>
      <p class="acte-ref">${gens.length} personne${gens.length > 1 ? 's' : ''} avec un acte ici, de la plus ancienne à la plus récente.</p>
      <div class="liens actes lieu-liste">${gens.map(([id, evs]) => { const p = P[id], l = lignee(p);
        return `<button data-voir="${esc(id)}"><span class="pt" style="background:${l && l !== 'ego' ? `var(--${l})` : 'var(--accent)'}"></span><span><b>${esc(nomComplet(p))}</b><small>${esc(evs.sort((a, b) => (+a.an || 0) - (+b.an || 0)).map(e => [e.lib, e.an].filter(Boolean).join(' ')).join(' · '))}</small></span></button>`; }).join('')}</div></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelector('.fermer').focus();
  }

  // 28/11/2026 (Laurent) : « par la date ». Dans la frise, on choisit une année : un trait la marque, les personnes qui n'étaient
  // pas en vie s'estompent, et la liste donne les vivants de cette année-là avec leur âge.
  const perEl = racineEl.querySelector('.periode'), pAn = perEl.querySelector('#p-an'), pCur = perEl.querySelector('.p-curseur');
  let anneeChoisie = null;
  function majPeriode() {
    const ok = mode === 'frise' && friseInfo; perEl.hidden = !ok; if (!ok) return;
    const {debut, finA, vis, haut, PX} = friseInfo;
    pCur.min = pAn.min = debut; pCur.max = pAn.max = finA;
    perEl.querySelector('.p-corps').hidden = anneeChoisie === null; perEl.querySelector('.p-ouvrir').hidden = anneeChoisie !== null;
    svg.querySelector('.frise-curseur')?.remove();
    const vivants = new Set();
    if (anneeChoisie !== null) {
      const a = anneeChoisie; pCur.value = a; if (document.activeElement !== pAn) pAn.value = a;
      vis.forEach(i => { if (i.b <= a && i.e >= a) vivants.add(i.id); });
      const x = (a - debut) * PX, g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'frise-curseur');
      g.innerHTML = `<path d="M${x} ${haut} V0"/><text x="${x}" y="${haut - 30}">${a}</text>`; svg.appendChild(g);
      perEl.querySelector('[data-p=liste]').textContent = `Voir les ${vivants.size} personne${vivants.size > 1 ? 's' : ''}`;
    }
    cartesEl.querySelectorAll('.carte.f').forEach(c => c.classList.toggle('eteint', anneeChoisie !== null && !vivants.has(c.dataset.id)));
  }
  function choisirAnnee(a) {
    if (!friseInfo) return; a = Math.round(+a); if (!isFinite(a)) return;
    anneeChoisie = Math.max(friseInfo.debut, Math.min(friseInfo.finA, a)); majPeriode();
  }
  perEl.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b || !friseInfo) return;
    if (b.dataset.p === 'ouvrir') { const r = vue.getBoundingClientRect(); choisirAnnee(friseInfo.debut + ((r.width / 2 - tx) / k) / friseInfo.PX); pCur.focus(); }
    if (b.dataset.p === 'fermer') { anneeChoisie = null; majPeriode(); }
    if (b.dataset.p === 'liste') listeVivants();
  });
  pCur.addEventListener('input', () => choisirAnnee(pCur.value));
  pAn.addEventListener('change', () => choisirAnnee(pAn.value));
  pAn.addEventListener('keydown', e => { if (e.key === 'Enter') choisirAnnee(pAn.value); });
  function listeVivants() {
    const a = anneeChoisie, L = friseInfo.vis.filter(i => i.b <= a && i.e >= a).sort((x, y) => x.b - y.b);
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>En ${a}</h2><button class="fermer">Fermer</button></div>
      <p class="acte-ref">${L.length} personne${L.length > 1 ? 's' : ''} de cet arbre ${L.length > 1 ? 'étaient' : 'était'} en vie, de la plus âgée à la plus jeune.</p>
      <div class="liens actes lieu-liste">${L.map(i => { const p = P[i.id], l = lignee(p), age = a - i.b;
        return `<button data-voir="${esc(i.id)}"><span class="pt" style="background:${l && l !== 'ego' ? `var(--${l})` : 'var(--accent)'}"></span><span><b>${esc(nomComplet(p))}</b><small>${i.estB ? 'environ ' : ''}${age ? age + ' an' + (age > 1 ? 's' : '') : 'naissance cette année-là'}${an(p.de) && +an(p.de) === a ? ', mort cette année-là' : ''}</small></span></button>`; }).join('')}</div></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelector('.fermer').focus();
  }

  // ---------- passage animé ----------
  const reduit = matchMedia('(prefers-reduced-motion: reduce)');
  const DUREE = 860, COURBE = 'cubic-bezier(.62,.02,.2,1)';
  function finirDecor() { cancelAnimationFrame(rafDecor); rafDecor = 0; secteurs.forEach(z => z.el && z.el.setAttribute('d', secteur(z.r0, z.r1, z.a0, z.a1))); }
  function finirAnims() {
    enCours.forEach(a => { try { a.finish(); } catch (e) {} }); enCours = [];
    cartesEl.querySelectorAll('.fantome').forEach(e => e.remove()); scene.querySelectorAll('svg.fantome-svg').forEach(e => e.remove());
    cartesEl.querySelectorAll('.r-attente').forEach(e => e.classList.replace('r-attente', 'r')); cartesEl.querySelectorAll('.c-attente').forEach(e => e.classList.replace('c-attente', 'c'));
    finirDecor();
  }
  const fsDe = el => getComputedStyle(el).getPropertyValue('--fs').trim() || '16px';
  function releve() {
    const m = {};
    cartesEl.querySelectorAll('[data-k]').forEach(el => {
      const L = parseFloat(el.style.left) || 0, T = parseFloat(el.style.top) || 0, w = el.offsetWidth, h = el.offsetHeight;
      m[el.dataset.k] = {el, L, T, w, h, cx: L + w / 2, cy: T + h / 2, rot: +el.dataset.rot || 0, fs: fsDe(el), r: el.classList.contains('r')};
    });
    return m;
  }
  function ancre(id, cartes) {   // la carte la plus proche en descendant (enfant, petit-enfant…) dans un ensemble de cartes
    const vu = new Set([id]); let f = [id];
    for (let n = 0; n < 14 && f.length && vu.size < 400; n++) {
      const suiv = [];
      for (const x of f) for (const z of enfants[x] || []) { if (cartes[z]) return cartes[z]; if (!vu.has(z)) { vu.add(z); suiv.push(z); } }
      f = suiv;
    }
    return null;
  }
  // 28/11/2026 (Laurent : « page précédente doit défaire la dernière action sur l'arbre ») : chaque changement de forme,
  // de personne au centre ou de profondeur prend une entrée d'historique ; « précédent » la rejoue à l'envers, animée.
  const etatArbre = () => ({mode, focus, tout, ouverts: {...ouverts}});
  let enRetour = false;
  function pousser() {
    if (enRetour) return;
    const e = etatArbre(), st = history.state || {};
    if (st.ar && JSON.stringify(st.ar) === JSON.stringify(e)) return;
    if (st.fiche && fiche.hidden) { const {fiche: _f, ...reste} = st; history.replaceState({...reste, ar: e}, ''); return; }   // la fiche vient de se fermer pour ce changement
    history.pushState({...st, ar: e}, '');
  }
  function appliquerEtat(a) {
    mode = MODES[a.mode] ? a.mode : 'arbre'; focus = P[a.focus] ? a.focus : ego; tout = !!a.tout; ouverts = {...(a.ouverts || {})};
    try { localStorage.setItem('vr-mode', mode); } catch (x) {}
    majModes(); const be = racineEl.querySelector('.ensemble [data-a=entier]'); if (be) be.textContent = tout ? 'Revenir à la vue simple' : 'Ouvrir l’arbre en entier';
    dessiner(); if (focus === ego || tout) premiereVue(); else centrerSur(focus);
  }
  function surRetour(e) {
    if (!racineEl.isConnected) { removeEventListener('popstate', surRetour); return; }
    const a = e.state && e.state.ar; if (!a) return;
    if (JSON.stringify(a) === JSON.stringify(etatArbre())) return;
    enRetour = true; try { transition(() => appliquerEtat(a)); } finally { enRetour = false; }
  }
  addEventListener('popstate', surRetour);
  function transition(changer) {
    finirAnims();
    const ok = !reduit.matches && typeof Element.prototype.animate === 'function' && cartesEl.querySelectorAll('[data-k]').length < 450;
    const av = ok ? releve() : null, cam0 = {k, tx, ty, t: scene.style.transform}, svg0 = ok ? svg.innerHTML : '';
    changer();
    pousser();
    if (av && cartesEl.querySelectorAll('[data-k]').length < 450) animer(av, cam0, svg0);
  }
  function animer(av, cam0, svg0) {
    const run = a => { enCours.push(a); return a; };
    const els = [...cartesEl.querySelectorAll('[data-k]')];
    // roue : les cartes gardent leur fond pendant le vol et le perdent en arrivant sur leur secteur
    const cl = {roue: 'r', carte: 'c'}[mode];
    const attente = cl ? els.filter(el => el.classList.contains(cl) && av[el.dataset.k] && !av[el.dataset.k].el.classList.contains(cl)) : [];
    attente.forEach(el => el.classList.replace(cl, cl + '-attente'));
    const geo = els.map(el => ({el, k: el.dataset.k, id: el.dataset.k.split('~')[0], L: parseFloat(el.style.left) || 0, T: parseFloat(el.style.top) || 0,
      w: el.offsetWidth, h: el.offsetHeight, rot: +el.dataset.rot || 0, g: +el.dataset.g || 0, fs: fsDe(el)}));
    const neuf = {}; geo.forEach(x => { neuf[x.k] = x; });
    // 28/11/2026 (Laurent) : la personne au centre garde sa place à l'écran pendant que l'arbre se transforme autour d'elle,
    // puis la vue glisse jusqu'au cadrage final (la caméra garde l'échelle de départ pendant la métamorphose).
    const o = av[focus], n = neuf[focus], camF = scene.style.transform || 'none';
    if (o && n) {
      const sx = o.cx * cam0.k + cam0.tx, sy = o.cy * cam0.k + cam0.ty, nx = n.L + n.w / 2, ny = n.T + n.h / 2;
      const camM = `translate(${sx - nx * cam0.k}px,${sy - ny * cam0.k}px) scale(${cam0.k})`;
      const Z = Math.abs(cam0.k - k) < 1e-3 && Math.abs(sx - nx * k - tx) < 2 && Math.abs(sy - ny * k - ty) < 2 ? 0 : 650, f = DUREE / (DUREE + Z);
      run(scene.animate(Z ? [{transform: cam0.t || 'none', easing: COURBE}, {transform: camM, offset: f, easing: 'cubic-bezier(.45,0,.25,1)'}, {transform: camF}]
                          : [{transform: cam0.t || 'none'}, {transform: camM}], {duration: DUREE + Z, easing: Z ? 'linear' : COURBE}));
    } else run(scene.animate([{transform: cam0.t || 'none'}, {transform: camF}], {duration: DUREE, easing: COURBE}));
    for (const x of geo) {
      const o = av[x.k], delai = Math.min(Math.max(x.g, 0), 9) * 34;
      let de;
      if (o) de = {transform: `translate(${o.cx - (x.L + o.w / 2)}px,${o.cy - (x.T + o.h / 2)}px) rotate(${o.rot}deg)`, width: o.w + 'px', height: o.h + 'px', '--fs': o.fs, opacity: 1};
      else {
        const a = ancre(x.id, av), c = a ? [a.cx, a.cy] : [x.L + x.w / 2, x.T + x.h / 2];
        de = {transform: `translate(${c[0] - (x.L + x.w * 0.2)}px,${c[1] - (x.T + x.h * 0.2)}px) rotate(${a ? a.rot : x.rot}deg)`, width: x.w * 0.4 + 'px', height: x.h * 0.4 + 'px', '--fs': x.fs, opacity: 0};
      }
      run(x.el.animate([de, {transform: `translate(0px,0px) rotate(${x.rot}deg)`, width: x.w + 'px', height: x.h + 'px', '--fs': x.fs, opacity: 1}],
        {duration: DUREE, delay: delai, easing: COURBE, fill: 'backwards'}));
    }
    if (attente.length) setTimeout(() => attente.forEach(el => el.classList.replace(cl + '-attente', cl)), DUREE * 0.5);
    for (const k0 in av) if (!neuf[k0]) {   // les cartes qui quittent la vue rentrent dans leur enfant
      const o = av[k0], el = o.el;
      el.classList.add('fantome'); el.removeAttribute('data-id'); el.removeAttribute('data-k'); el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1;
      cartesEl.appendChild(el);
      const a = ancre(k0.split('~')[0], neuf), c = a ? [a.L + a.w / 2, a.T + a.h / 2] : [o.cx, o.cy];
      const fx = el.animate([{transform: `translate(0px,0px) rotate(${o.rot}deg)`, width: o.w + 'px', height: o.h + 'px', opacity: 1},
        {transform: `translate(${c[0] - (o.L + o.w * 0.2)}px,${c[1] - (o.T + o.h * 0.2)}px) rotate(${a ? a.rot : o.rot}deg)`, width: o.w * 0.4 + 'px', height: o.h * 0.4 + 'px', opacity: 0}],
        {duration: DUREE * 0.75, easing: COURBE, fill: 'forwards'});
      fx.onfinish = () => el.remove(); run(fx);
    }
    if (svg0) {
      const gs = document.createElementNS(NS, 'svg'); gs.setAttribute('class', 'fantome-svg'); gs.innerHTML = svg0; scene.insertBefore(gs, svg);
      const fx = gs.animate([{opacity: 1}, {opacity: 0}], {duration: 300, easing: 'ease-out', fill: 'forwards'}); fx.onfinish = () => gs.remove(); run(fx);
    }
    cartesEl.querySelectorAll('.anneau,.plus,.titre-enfants,.frise-note,.lieu-pt').forEach(e => run(e.animate([{opacity: 0}, {opacity: 1}], {duration: 320, delay: DUREE * 0.75, fill: 'backwards'})));
    entreeDecor(run);
  }
  function entreeDecor(run) {
    if (mode === 'arbre' || mode === 'carte') { run(svg.animate([{opacity: 0}, {opacity: 1}], {duration: 420, delay: DUREE * (mode === 'carte' ? 0.2 : 0.62), fill: 'backwards'})); return; }
    if (mode === 'frise') {
      [['.frise-fond', 140], ['.frise-axe', 0], ['.frise-liens', DUREE * 0.72]].forEach(([q, d]) => { const g = svg.querySelector(q); if (g) run(g.animate([{opacity: 0}, {opacity: 1}], {duration: 460, delay: d, fill: 'backwards'})); });
      const axe = svg.querySelector('.axe-ligne');
      if (axe) { const L = axe.getTotalLength(); axe.style.strokeDasharray = `${L}`; run(axe.animate([{strokeDashoffset: `${L}`}, {strokeDashoffset: '0'}], {duration: DUREE, easing: COURBE})); }
      return;
    }
    // roue : les secteurs se déplient du centre vers l'extérieur, anneau après anneau
    ['.roue-centre', '.roue-vides', '.roue-bord'].forEach((q, j) => { const e = svg.querySelector(q); if (e) run(e.animate([{opacity: 0}, {opacity: 1}], {duration: 420, delay: j ? DUREE * 0.7 : 0, fill: 'backwards'})); });
    const t0 = performance.now();
    const pas = t => {
      let fini = true;
      for (const z of secteurs) {
        const p = Math.min(1, Math.max(0, (t - t0 - 60 - z.g * 75) / 600)); if (p < 1) fini = false;
        const e = 1 - Math.pow(1 - p, 3), am = (z.a0 + z.a1) / 2, da = (z.a1 - z.a0) / 2 * e;
        z.el.setAttribute('d', e > 0.002 ? secteur(z.r0, z.r0 + (z.r1 - z.r0) * e, am - da, am + da) : 'M0 0');
      }
      rafDecor = fini ? 0 : requestAnimationFrame(pas);
    };
    secteurs.forEach(z => z.el.setAttribute('d', 'M0 0'));
    rafDecor = requestAnimationFrame(pas);
  }
  const modesEl = racineEl.querySelector('.modes');
  function majModes() { modesEl.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode))); }
  majModes();
  modesEl.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]'); if (!b || b.dataset.mode === mode) return;
    // 28/11/2026 (Laurent, 2e demande) : entre arbre et roue, la personne au centre ne bouge pas du tout à l'écran :
    // le cadrage final garde son point d'écran (seule l'échelle change ensuite, autour d'elle).
    const fixe = ['arbre', 'roue'].includes(mode) && ['arbre', 'roue'].includes(b.dataset.mode), n0 = positions[focus];
    const ecran = fixe && n0 ? [n0.cx * k + tx, (n0.cy ?? (n0.y + H() / 2)) * k + ty] : null;
    transition(() => {
      mode = b.dataset.mode; try { localStorage.setItem('vr-mode', mode); } catch (x) {} majModes(); dessiner(); premiereVue();
      const n1 = positions[focus];
      if (ecran && n1) {
        const fy = n1.cy ?? (n1.y + H() / 2);
        if (mode === 'roue') {   // la roue entière tient autour de la personne restée en place (au besoin un peu plus petite)
          const r = vue.getBoundingClientRect(), R = Math.max(1, ...Object.values(positions).map(n => Math.hypot(n.cx - n1.cx, (n.cy ?? (n.y + H() / 2)) - fy) + 40));
          const place = Math.min(ecran[0], r.width - ecran[0], ecran[1] - 100, r.height - ecran[1]) - 12;
          if (place > 0) k = Math.max(kmin(), k * 0.55, Math.min(k, place / R));
        }
        tx = ecran[0] - n1.cx * k; ty = ecran[1] - fy * k; appliquer();
      }
    });
  });
  function colLien(n) {
    const l = lignee(P[n.id]);
    if (n.g >= 2 && l && l !== 'ego') return `var(--${l})`;
    return 'var(--line-strong)';
  }

  // ---------- vue (déplacement, zoom) ----------
  function appliquer() {
    scene.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
    vue.classList.toggle('compact', mode === 'arbre' && k < 0.5);
    majAxe(); scene.style.setProperty('--ki', String(Math.min(3, 1 / k)));
    try { localStorage.setItem('vr-vue-' + data.id, JSON.stringify({tx, ty, k, focus})); } catch (e) {}
  }
  function centrerSur(id, kk = k) {
    const n = positions[id]; if (!n) return;
    k = kk; const r = vue.getBoundingClientRect();
    tx = r.width / 2 - n.cx * k; ty = r.height * (mode === 'arbre' ? 0.62 : 0.52) - (n.cy ?? (n.y + H() / 2)) * k; appliquer();
  }
  function toutVoir() {
    const ns = Object.values(positions); if (!ns.length) return;
    let x0 = Math.min(...ns.map(n => n.x)), x1 = Math.max(...ns.map(n => n.x + (n.w || W()))), y0 = Math.min(...ns.map(n => n.y)), y1 = Math.max(...ns.map(n => n.y + (n.h || H())));
    if (bornes) ({x0, x1, y0, y1} = bornes);
    const r = vue.getBoundingClientRect();
    k = Math.max(kmin(), Math.min(1.2, Math.min((r.width - 40) / (x1 - x0), (r.height - 140) / (y1 - y0))));
    tx = (r.width - (x1 - x0) * k) / 2 - x0 * k; ty = 110 + (r.height - 140 - (y1 - y0) * k) / 2 - y0 * k; appliquer();
  }
  function premiereVue() {
    if (mode === 'frise' && bornes) {   // la frise se lit en largeur : tout le temps à l'écran, les générations au-dessus en faisant glisser
      const r = vue.getBoundingClientRect(), lg = bornes.x1 - bornes.x0;
      k = Math.max(innerWidth < 720 ? 0.8 : 0.3, Math.min(1, (r.width - 40) / lg));
      tx = r.width / 2 - (k * lg <= r.width - 40 ? (bornes.x0 + bornes.x1) / 2 : positions[focus] ? positions[focus].cx : bornes.x1 - (r.width / 2 - 20) / k) * k; ty = r.height - 24 - bornes.y1 * k; appliquer(); return;
    }
    toutVoir(); if (mode === 'roue' || mode === 'carte') return;
    const mini = mode === 'frise' ? (innerWidth < 720 ? 0.5 : 0.42) : (innerWidth < 720 ? 0.62 : 0.45);
    if (k < mini) centrerSur(mode === 'frise' ? focus : ego, mini);
  }
  function zoomer(f, cx, cy) {
    const r = vue.getBoundingClientRect(); cx = cx ?? r.width / 2; cy = cy ?? r.height / 2;
    const nk = Math.max(kmin(), Math.min(2, k * f)); tx = cx - (cx - tx) * nk / k; ty = cy - (cy - ty) * nk / k; k = nk; appliquer();
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
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), nk = Math.max(kmin(), Math.min(2, pince.k * d / pince.d));
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
    const lp = e.target.closest('[data-lieu]'); if (lp) { ouvrirLieu(lp.dataset.lieu); return; }
    const li = e.target.closest('[data-lien]'); if (li) { ouvrirLien(li.dataset.lien); return; }
    const pl = e.target.closest('[data-plus]');
    if (pl) { const id = pl.dataset.plus; const n = positions[id]; transition(() => { ouverts[id] = (n ? n.g : 0) + PLUS; dessiner(); centrerSur(id); }); return; }
    const c = e.target.closest('.carte[data-id]'); if (c) ouvrirFiche(c.dataset.id);
  });
  vue.addEventListener('dblclick', e => { const c = e.target.closest('.carte[data-id]'); if (c) recentrer(c.dataset.id); });
  racineEl.querySelector('.zoom').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'plus') zoomer(1.25); if (a === 'moins') zoomer(0.8);
    if (a === 'moi') transition(() => { focus = ego; ouverts = {}; dessiner(); premiereVue(); });
  });
  racineEl.querySelector('.ensemble').addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a; const ens = racineEl.querySelector('.ensemble');
    if (a === 'menu') { const o = ens.classList.toggle('ouvert'); e.target.closest('button').setAttribute('aria-expanded', String(o)); return; }
    ens.classList.remove('ouvert'); racineEl.querySelector('.ens-menu')?.setAttribute('aria-expanded', 'false');
    if (a === 'tout') toutVoir(); if (a === 'imprimer') print(); if (a === 'actes') listeActes(); if (a === 'pepites') listePepites(); if (a === 'avalider') listeAValider();
    if (a === 'entier') { const b = e.target.closest('button'); transition(() => { tout = !tout; if (tout) focus = ego; b.textContent = tout ? 'Revenir à la vue simple' : 'Ouvrir l’arbre en entier'; dessiner(); if (tout) toutVoir(); else premiereVue(); }); }
  });
  const leg = racineEl.querySelector('.legende');
  const legBtn = leg.querySelector('button');
  const legVue = (() => { try { return localStorage.getItem('vr-legende'); } catch (e) { return null; } })();
  // 02/11/2026 (audit UX, D1) : légende ouverte à la première visite, repliée ensuite (le choix est mémorisé).
  // Sur téléphone elle couvrirait presque tout l'arbre : elle y reste repliée, la bulle d'aide suffit.
  legBtn.title = 'Fermer la légende';
  if (legVue || innerWidth < 720) { legBtn.title = 'Afficher la légende'; legBtn.setAttribute('aria-expanded', 'false'); leg.querySelector('.corps').hidden = true; }
  if (!legVue && innerWidth >= 720) { try { localStorage.setItem('vr-legende', '1'); } catch (e) {} }
  legBtn.addEventListener('click', () => { const o = legBtn.getAttribute('aria-expanded') === 'true'; legBtn.setAttribute('aria-expanded', String(!o)); legBtn.title = o ? 'Afficher la légende' : 'Fermer la légende'; leg.querySelector('.corps').hidden = o; try { localStorage.setItem('vr-legende', '1'); } catch (e) {} });
  addEventListener('keydown', e => {
    if (e.target.matches('input')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') fermerFiche();
    if (e.key === '+' || e.key === '=') zoomer(1.25); if (e.key === '-') zoomer(0.8);
    if (e.key === '/') { e.preventDefault(); racineEl.querySelector('#cherche').focus(); }
    if (e.key === 'm' || e.key === 'M') transition(() => { focus = ego; dessiner(); centrerSur(ego); });
    const pas = {ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80]}[e.key];
    if (pas && !e.target.closest('.fiche')) { tx += pas[0]; ty += pas[1]; appliquer(); }
  });

  // ---------- recentrage et fil ----------
  function recentrer(id) { transition(() => { focus = id; ouverts = {}; dessiner(); if (id === ego) premiereVue(); else centrerSur(id); }); }
  function majFil() {
    if (focus === ego) { fil.hidden = true; return; }
    fil.hidden = false;
    fil.innerHTML = `Vous regardez l’arbre de <b>${esc(nomComplet(P[focus]))}</b>. <button data-r="1">Revenir à ${esc(egoNom)}</button>`;
    fil.querySelector('button').onclick = () => recentrer(ego);
  }

  // ---------- fiche ----------
  function evt(lib, e, extra = '', pq = '') {
    if (!e) return '';
    const pv = preuve(e.niv), quand = dateLongue(e.d), ou = e.p ? ` à ${esc(lieuCourt(e.p))}` : '';
    return `<li><span class="pv ${pv ? pv[1] : ''}" title="${pv ? esc(pv[2] + ' : ' + pv[3]) : ''}">${pv ? pv[0] : ''}</span><span>${lib} ${quand ? (/^\d{4}$/.test(e.d) ? 'en ' : 'le ') + esc(quand) : ''}${ou}${extra}${pq}</span></li>`;
  }
  // 06/11/2026 (Laurent) : toute supposition dit d'où elle vient. Sous un fait qui n'est pas prouvé par un acte lu,
  // la source notée pour cet événement ; à défaut, on le dit franchement.
  // 06/11/2026 (Laurent : « il devrait être plus facile à trouver ») : un bouton « Voir l'acte » sur la ligne même du fait.
  function voirActe(p, ev, e) {
    const T = {naissance: ['Naissance', 'Baptême'], 'baptême': ['Baptême', 'Naissance'], 'décès': ['Décès', 'Sépulture'], mariage: ['Mariage']}[ev] || [];
    const c = (p.ra || []).map(([i]) => i).filter(i => R && R[i] && T.includes(R[i].ty) && R[i].img);
    const an4 = x => String(x || '').slice(0, 4);
    if (e && !c.length && e.d) {   // pas d'acte de cet événement, mais une mention marginale dans un autre acte lu (ex. mariage noté en marge de la naissance)
      const m = (p.ra || []).map(([i]) => i).find(i => R && R[i] && R[i].img && R[i].ty !== T[0] && String(R[i].tr || '').includes(an4(e.d)));
      return m ? ` <button class="btn-lien voir-acte" data-reg="${esc(m)}">Voir la mention (${esc(String(R[m].ty || 'acte').toLowerCase())})</button>` : '';
    }
    if (!e || !c.length) return '';
    const best = c.find(i => e.d && an4(R[i].d) === an4(e.d)) || c[0];
    return ` <button class="btn-lien voir-acte" data-reg="${esc(best)}">Voir l’acte</button>`;
  }
  // 16/11/2026 (retour de Paul : trop de redites) : la source d'un fait s'affiche une fois, sous le fait, repliée si elle est longue ;
  // elle ne revient pas dans la liste du bas. Sans source rattachée au fait, rien sous la ligne quand la liste du bas existe ;
  // sans aucune source, on le dit en une ligne.
  let montrees = new Set();
  function dou(p, ev, e) {
    if (!e || e.niv === 'acte' || e.niv === 'famille') return '';
    const k = (p.so || []).findIndex(x => x.ev === ev);
    if (k >= 0) {
      const s = p.so[k]; montrees.add(k);
      const t = String(s.t || ''), voir = lienPublic(s.url) ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">voir</a>` : '';
      if (t.length <= 160) return `<span class="pq">Source : ${esc(t)}${voir}</span>`;
      return `<details class="pq"><summary>Source : ${esc(t.slice(0, 140).replace(/\s+\S*$/, ''))}…</summary><p>${esc(t)}${voir}</p></details>`;
    }
    return (p.so || []).length || (p.ra || []).length ? '' : '<span class="pq">Aucune source notée : une piste à vérifier.</span>';
  }
  function ouvrirFiche(id) {
    const p = P[id]; if (!p || p.cache) return;
    montrees = new Set();
    choisi = id; cartesEl.querySelectorAll('.choisie').forEach(c => c.classList.remove('choisie'));
    cartesEl.querySelector(`[data-id="${CSS.escape(id)}"]`)?.classList.add('choisie');
    const f = p.s === 'F', l = lignee(p), e = f ? 'e' : '';
    const unis = (unions[id] || []).map(u => {
      const autre = P[u.h === id ? u.w : u.h];
      return evt(`Marié${e}`, u.mar || (autre ? {} : null), autre ? ` avec <button class="btn-lien" data-voir="${esc(u.h === id ? u.w : u.h)}">${esc(nomComplet(autre))}</button>` : '', voirActe(p, 'mariage', u.mar) + dou(p, 'mariage', u.mar));
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
      ${pa && (P[pa.h] || P[pa.w]) ? `<p class="lien-niv"><svg width="44" height="10" aria-hidden="true"><path d="M2 5 H42" stroke="var(--ink-soft)" stroke-width="${lienDe(p).w}" stroke-linecap="round" ${lienDe(p).d ? `stroke-dasharray="${lienDe(p).d}"` : ''}/></svg><span>Lien avec ses parents : <b>${esc((LIBNL[nivLien(p)] || 'non vérifié').split(' : ')[0])}</b> <button class="btn-lien" data-pourquoi="${esc(id)}">Pourquoi ?</button></span></p>` : ''}
      <ul class="evts">${evt(`Né${e}`, p.na, '', voirActe(p, 'naissance', p.na) + dou(p, 'naissance', p.na))}${!p.na ? evt(`Baptisé${e}`, p.ba, '', voirActe(p, 'baptême', p.ba) + dou(p, 'baptême', p.ba)) : ''}${unis}${evt(`Décédé${e}`, p.de, '', voirActe(p, 'décès', p.de) + dou(p, 'décès', p.de))}</ul>
      ${p.me && p.me.length ? `<h3>Métier${p.me.length > 1 ? 's' : ''}</h3><p>${p.me.map(m => { const [x, y] = met(m); return esc(x) + (y ? ` (${esc(y)})` : ''); }).join(', ')}</p>` : ''}
      ${p.pep ? `<div class="pep-bloc"><h3>✦ Pourquoi cette personne est bien documentée</h3>${(p.pep.r || []).length ? `<p class="pep-r">${p.pep.r.map(r => `<span>${esc(r)}</span>`).join('')}</p>` : ''}${(p.pep.x || []).map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
      ${(p.ra || []).length ? `<h3>Actes et documents consultés (${p.ra.length})</h3><div class="liens actes registre">${triRa(p.ra).map(([i, r]) => { const a = R[i]; const pv = preuve(a.niv); return `<button data-reg="${esc(i)}"><span class="pv ${pv ? pv[1] : ''}">${pv ? pv[0] : ''}</span><span><b>${esc(a.t || a.ty)}</b><small>${esc([NIVR[a.nv] || (pv && pv[2]), r && r !== 'sujet' && r !== 'défunt' ? 'comme ' + r : ''].filter(Boolean).join(' · '))}</small></span></button>`; }).join('')}</div>` : ''}
      ${(() => { const vus = new Set(), so = (p.so || []).filter((x, k) => { const t = sansAccent(String(x.t || '')).replace(/\W+/g, ' ').trim(); if (montrees.has(k) || vus.has(t) || (!opt.admin && /^confiance\b/.test(t))) return false; vus.add(t); return true; }); return so.length ? `<h3>${(p.ra || []).length || montrees.size ? 'Autres sources' : 'Sources et actes lus'} (${so.length})</h3><ul class="sources">${so.map(x => { const pv = preuve(x.niv); return `<li>${pv ? `<span class="pv ${pv[1]}" title="${esc(pv[2])}">${pv[0]}</span>` : '<span class="pv"></span>'}<div>${x.ev ? `<b>${esc(x.ev.charAt(0).toUpperCase() + x.ev.slice(1))}</b>` : ''}<p>${esc(x.t)}</p>${lienPublic(x.url) ? `<a href="${esc(lienPublic(x.url))}" target="_blank" rel="noopener noreferrer">Voir sur le site des archives</a>` : ''}${opt.admin && x.l ? `<small>dossier de recherche, ligne ${x.l}</small>` : ''}</div></li>`; }).join('')}</ul>` : ''; })()}
      ${(p.ac || []).length ? `<h3>Ses actes reproduits (${p.ac.length})</h3><div class="liens actes">${p.ac.map(i => data.actes[i]).filter(Boolean).map((a, j) => `<button data-acte="${p.ac[j]}"><b>${esc(a.titre)}</b><small>${esc(a.ref)}</small></button>`).join('')}</div>` : ''}
      ${pa && (P[pa.h] || P[pa.w]) ? `<h3>Ses parents</h3><div class="liens">${[pa.h, pa.w].filter(z => P[z]).map(lien).join('')}</div>` : ''}
      ${ks.length ? `<h3>${ks.length === 1 ? 'Parmi ses enfants' : 'Ses enfants'}</h3><div class="liens">${ks.map(lien).join('')}</div>` : ''}
      ${avDe(id).length ? `<h3>Recherches à valider (admin, ${avDe(id).length})</h3><div class="liens actes">${avDe(id).map(([x, j]) => `<button data-av="${j}"><span><b>${esc(x.t)}</b><small>${esc([x.lib, x.f + ', ligne ' + x.l].filter(Boolean).join(' · '))}</small></span></button>`).join('')}</div>` : ''}
      ${opt.admin && (p.no || (p.src && p.src.length)) ? `<h3>Notes de recherche (admin)</h3><div class="note">${esc(p.no || '')}${p.src && p.src.length ? '\nSources : ' + esc(p.src.join(', ')) : ''}</div>` : ''}
      <div class="actions"><button class="btn btn-1" data-recentrer="${esc(id)}">Voir son arbre</button></div></div>`;
    // 16/11/2026 : la fiche ouverte prend une entrée d'historique, le bouton « précédent » la referme
    if (fiche.hidden && !(history.state && history.state.fiche)) history.pushState({...(history.state || {}), fiche: 1}, '');
    fiche.hidden = false; fiche.classList.remove('pleine');
    fiche.querySelector('.fermer').onclick = fermerFiche;
    fiche.querySelector('.poignee').onclick = () => fiche.classList.toggle('pleine');
    fiche.querySelector('[data-recentrer]').onclick = () => { fiche.hidden = true; choisi = null; recentrer(id); };
    fiche.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => voir(b.dataset.voir));
    fiche.querySelectorAll('[data-acte]').forEach(b => b.onclick = () => ouvrirActe(+b.dataset.acte));
    fiche.querySelectorAll('[data-reg]').forEach(b => b.onclick = () => ouvrirRegistre(b.dataset.reg));
    fiche.querySelectorAll('[data-pourquoi]').forEach(b => b.onclick = () => ouvrirLien(b.dataset.pourquoi));
    fiche.querySelectorAll('[data-av]').forEach(b => b.onclick = () => ouvrirAValider(+b.dataset.av));
    fiche.querySelector('.fermer').focus({preventScroll: true});
  }
  function fermerFiche() { if (!fiche.hidden && history.state && history.state.fiche) history.back(); fiche.hidden = true; choisi = null; cartesEl.querySelectorAll('.choisie').forEach(c => c.classList.remove('choisie')); }
  function voir(id) {
    if (!P[id] || P[id].cache) return;
    if (!positions[id]) recentrer(id); else centrerSur(id);
    const c = cartesEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (c) { c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }
    ouvrirFiche(id);
  }

  // ---------- actes ----------
  const av = racineEl.querySelector('.acte-vue');
  function fermerActe() { av.hidden = true; av.innerHTML = ''; }
  async function ouvrirActe(i) {
    const a = (data.actes || [])[i]; if (!a) return;
    const qui = (a.personnes || []).filter(z => P[z] && !P[z].cache);
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(a.titre)}</h2><button class="fermer">Fermer</button></div>
      <p class="acte-ref">${esc(a.ref)}</p>
      ${a.img ? '<div class="acte-img"><span class="petit">Chargement de l’image…</span></div>' : ''}
      ${a.texte ? `<h3>Ce que dit l’acte</h3><div class="acte-texte">${a.texte}</div>` : ''}
      ${a.trad ? `<h3>En français d’aujourd’hui</h3><div class="acte-texte">${a.trad}</div>` : ''}
      ${a.note ? `<p class="acte-note">${a.note}</p>` : ''}
      ${qui.length ? `<h3>Dans cet acte</h3><div class="liens">${qui.map(z => `<button data-voir="${esc(z)}">${esc(nomComplet(P[z]))}</button>`).join('')}</div>` : ''}</div>`;
    av.hidden = false;
    av.querySelector('.fermer').onclick = fermerActe;
    av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelector('.fermer').focus();
    // 02/11/2026 (audit UX, D2) : pas de cadre vide ; une image introuvable retire son cadre au lieu d'afficher « Image non disponible »
    if (a.img) try {
      const src = opt.image ? await opt.image(a.img) : null; const box = av.querySelector('.acte-img'); if (!box) return;
      if (src) box.innerHTML = `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${esc(a.titre)}"></a><span class="petit">Touchez l’image pour l’ouvrir en grand.</span>`; else box.remove();
    } catch (e) { av.querySelector('.acte-img')?.remove(); }
  }
  // 30/10 : explication d'un lien enfant -> parents, et fiche d'un acte du registre des actes vus
  function ouvrirLien(id) {
    const p = P[id], pa = parents[id]; if (!p || p.cache || !pa) return;
    const li = p.li || {}, n = nivLien(p), L = lienDe(p), qui = [pa.h, pa.w].filter(z => P[z] && !P[z].cache);
    const ac = (li.ac || []).filter(i => R[i]);
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(nomComplet(p))} et ses parents</h2><button class="fermer">Fermer</button></div>
      <p class="lien-niv grand"><svg width="56" height="12" aria-hidden="true"><path d="M2 6 H54" stroke="var(--ink)" stroke-width="${L.w + 0.6}" stroke-linecap="round" ${L.d ? `stroke-dasharray="${L.d}"` : ''}/></svg><b>${esc(L.lib)}</b></p>
      <p class="pourquoi">${esc(li.pq || 'Nous n’avons pas encore consigné l’explication de ce lien.')}</p>
      ${ac.length ? `<h3>${ac.length > 1 ? 'Les documents qui le fondent' : 'Le document qui le fonde'}</h3><div class="liens actes registre">${ac.map(i => { const a = R[i], pv = preuve(a.niv); return `<button data-reg="${esc(i)}"><span class="pv ${pv ? pv[1] : ''}">${pv ? pv[0] : ''}</span><span><b>${esc(a.t)}</b><small>${esc(a.pr || '')}</small></span></button>`; }).join('')}</div>` : ''}
      <h3>Les personnes</h3><div class="liens"><button data-voir="${esc(id)}">${esc(nomComplet(p))}</button>${qui.map(z => `<button data-voir="${esc(z)}">${esc(nomComplet(P[z]))}</button>`).join('')}</div>
      <details class="niveaux"><summary>Comment nous classons les liens</summary><ul>
        <li><b>Prouvé</b> : nous avons lu, sur l’image du registre, un acte qui nomme les parents (naissance, baptême, mariage, décès).</li>
        <li><b>Probable</b> : pas encore d’acte lu, mais un relevé indexé avec sa cote, ou deux sources indépendantes qui concordent.</li>
        <li><b>Supposé</b> : un seul indice, ou un recoupement par élimination. À confirmer.</li>
        <li><b>Donné par la famille</b> : personnes vivantes ou récentes ; nous ne faisons pas de recherche sur les vivants.</li></ul></details></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelectorAll('[data-reg]').forEach(b => b.onclick = () => ouvrirRegistre(b.dataset.reg, () => ouvrirLien(id)));
    av.querySelector('.fermer').focus();
  }
  async function ouvrirRegistre(i, retour) {
    const a = R[i]; if (!a) return; const pv = preuve(a.niv);
    const qui = Object.entries(P).filter(([, x]) => !x.cache && (x.ra || []).some(([j]) => j === i)).map(([z]) => z);
    const quand = a.d ? dateLongue(a.d) : '';
    // 02/11/2026 (audit UX, D2) : sans image chez nous, le lien vers l'image des archives passe en premier et en gros
    const ouTrouver = [a.so, a.co && !(a.so || '').includes(a.co) ? 'référence ' + a.co : '', a.vu ? 'vue ' + a.vu : ''].filter(Boolean).join(', ');
    const lienArchives = lienPublic(a.u) ? `<p class="lien-archives"><a class="btn btn-2" href="${esc(a.u)}" target="_blank" rel="noopener noreferrer">Voir le document en ligne</a>${ouTrouver ? `<span class="petit">${esc(ouTrouver)}</span>` : ''}</p>` : '';
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(a.t || a.ty)}</h2><button class="fermer">${retour ? 'Retour' : 'Fermer'}</button></div>
      <p class="acte-ref">${esc([a.ty, quand, a.lieu].filter(Boolean).join(' · '))}</p>
      <p class="niv-acte"><span class="pv ${pv ? pv[1] : ''}">${pv ? pv[0] : ''}</span> <b>${esc(NIVR[a.nv] || (pv ? pv[2] : ''))}</b>${a.pn ? ` : ${esc(a.pn)}` : ''}</p>
      ${a.img ? '<div class="acte-img"><span class="petit">Chargement de l’image…</span></div>' : lienArchives}
      ${a.pr ? `<h3>Ce que ce document établit</h3><p>${esc(a.pr)}</p>` : ''}
      ${a.tr ? `<h3>Ce qu’on y lit</h3><div class="acte-texte">« ${esc(a.tr)} »</div>` : ''}
      ${ouTrouver ? `<h3>Où le trouver</h3><p class="acte-ref">${esc(ouTrouver)}</p>` : ''}
      ${lienPublic(a.u) && a.img ? `<p><a href="${esc(a.u)}" target="_blank" rel="noopener noreferrer">Voir sur le site des archives</a></p>` : ''}
      ${qui.length ? `<h3>Dans ce document</h3><div class="liens">${qui.map(z => `<button data-voir="${esc(z)}">${esc(nomComplet(P[z]))}</button>`).join('')}</div>` : ''}
      ${opt.admin && (a.ln || []).length ? `<p class="petit">Dossier de recherche, ligne${a.ln.length > 1 ? 's' : ''} ${a.ln.join(', ')}</p>` : ''}</div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = retour || fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelector('.fermer').focus();
    if (a.img) try {
      const src = opt.image ? await opt.image(a.img) : null; const box = av.querySelector('.acte-img'); if (!box) return;
      if (src) box.innerHTML = `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${esc(a.t || '')}"></a><span class="petit">Touchez l’image pour l’ouvrir en grand.</span>`;
      else box.outerHTML = lienArchives;
    } catch (e) { const box = av.querySelector('.acte-img'); if (box) box.outerHTML = lienArchives; }
  }
  function listeActes() {
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>Les actes du livre</h2><button class="fermer">Fermer</button></div>
      <div class="liens actes">${(data.actes || []).map((a, i) => `<button data-acte="${i}"><b>${esc(a.titre)}</b><small>${esc(a.ref)}</small></button>`).join('')}</div></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-acte]').forEach(b => b.onclick = () => ouvrirActe(+b.dataset.acte));
  }
  function listePepites() {
    const L = Object.entries(P).filter(([, p]) => p.pep && !p.cache).sort((a, b) => Math.min(...(a[1].sosa || [9e9])) - Math.min(...(b[1].sosa || [9e9])));
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>✦ Les personnes bien documentées de l’arbre</h2><button class="fermer">Fermer</button></div>
      <p class="acte-ref">Les personnes sur qui on en sait plus que les actes habituels.</p>
      <div class="liens actes">${L.map(([id, p]) => `<button data-voir="${esc(id)}"><b>${esc(nomComplet(p))}</b><small>${esc([[an(p.na) || an(p.ba), an(p.de)].filter(Boolean).join(' à '), (p.pep.r || []).join(', ') || ((p.pep.x || [''])[0].slice(0, 110) + '…')].filter(Boolean).join(' · '))}</small></button>`).join('')}</div></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
  }
  // 02/11/2026 (chantier 3, tâche 9) : recherches à valider (admin). Chaque bloc d'un fichier PISTES-FAMILLE : niveau,
  // titre, texte, personnes de l'arbre qu'il nomme (fiches @I ou @F), captures d'actes (vignettes publiées avec les actes).
  function avDe(id) { return AV.map((x, j) => [x, j]).filter(([x]) => (x.qui || []).includes(id)); }
  function avBouton(x, j) {
    const n = LIBAV[x.niv] || LIBAV.autre;
    return `<button data-av="${j}"><span class="pv ${n[1]}"></span><span><b>${esc(x.t)}</b><small>${esc([x.lib, (x.qui || []).filter(z => P[z]).map(z => nomComplet(P[z])).slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</small></span></button>`;
  }
  function listeAValider() {
    const groupes = []; AV.forEach((x, j) => { const k = x.f + ' · ' + (x.piste || ''); const g = groupes.find(y => y.k === k); if (g) g.l.push([x, j]); else groupes.push({k, f: x.f, piste: x.piste, l: [[x, j]]}); });
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>Recherches à valider</h2><button class="fermer">Fermer</button></div>
      <p class="acte-ref">Trouvailles des recherches familiales, pas encore reportées dans l’arbre. Visible par l’administrateur seul.</p>
      ${groupes.map(g => `<h3>${esc(g.piste || g.f)}</h3><p class="petit">${esc(g.f)}</p><div class="liens actes registre">${g.l.map(([x, j]) => avBouton(x, j)).join('')}</div>`).join('')}</div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-av]').forEach(b => b.onclick = () => ouvrirAValider(+b.dataset.av, listeAValider));
    av.querySelector('.fermer').focus();
  }
  function ouvrirAValider(j, retour) {
    const x = AV[j]; if (!x) return; const n = LIBAV[x.niv] || LIBAV.autre;
    const qui = (x.qui || []).filter(z => P[z] && !P[z].cache);
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(x.t)}</h2><button class="fermer">${retour ? 'Retour' : 'Fermer'}</button></div>
      <p class="acte-ref">${esc([x.piste, x.f + ', ligne ' + x.l].filter(Boolean).join(' · '))}</p>
      <p class="niv-acte"><span class="pv ${n[1]}"></span> <b>${esc(x.lib)}</b> : à valider avant de reporter dans l’arbre</p>
      ${x.x ? `<div class="note">${esc(x.x)}</div>` : ''}
      ${(x.caps || []).length ? `<h3>Captures (${x.caps.length})</h3><div class="liens">${x.caps.map((c, k) => `<button data-cap="${k}">${esc(c.fi)}</button>`).join('')}</div>` : ''}
      ${qui.length ? `<h3>Dans l’arbre</h3><div class="liens">${qui.map(z => `<button data-voir="${esc(z)}">${esc(nomComplet(P[z]))}</button>`).join('')}</div>` : ''}</div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = retour || fermerActe; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { fermerActe(); voir(b.dataset.voir); });
    av.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => ouvrirCapture(x.caps[+b.dataset.cap], () => ouvrirAValider(j, retour)));
    av.querySelector('.fermer').focus();
  }
  async function ouvrirCapture(c, retour) {
    av.innerHTML = `<div class="acte-carte"><div class="acte-tete"><h2>${esc(c.fi)}</h2><button class="fermer">Retour</button></div>
      <div class="acte-img"><span class="petit">Chargement de l’image…</span></div></div>`;
    av.hidden = false; av.querySelector('.fermer').onclick = retour; av.onclick = e => { if (e.target === av) fermerActe(); };
    av.querySelector('.fermer').focus();
    try {
      const src = opt.image ? await opt.image(c.img) : null; const box = av.querySelector('.acte-img'); if (!box) return;
      if (src) box.innerHTML = `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${esc(c.fi)}"></a><span class="petit">Touchez l’image pour l’ouvrir en grand.</span>`;
      else box.innerHTML = '<p class="petit">Capture pas encore publiée dans l’espace (publier_actes_famille.py).</p>';
    } catch (e) { const box = av.querySelector('.acte-img'); if (box) box.innerHTML = '<p class="petit">Capture pas encore publiée dans l’espace.</p>'; }
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && !av.hidden) fermerActe(); });

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
  { const st = history.state || {};
    if (st.ar && (!st.p || st.id === data.id)) { const a = st.ar; mode = MODES[a.mode] ? a.mode : mode; focus = P[a.focus] ? a.focus : ego; tout = !!a.tout; ouverts = {...(a.ouverts || {})}; majModes(); if (tout) { const be = racineEl.querySelector('.ensemble [data-a=entier]'); if (be) be.textContent = 'Revenir à la vue simple'; } }
    else history.replaceState({...st, ar: etatArbre()}, ''); }
  dessiner();
  // 03/11/2026 (Laurent : « quand on ouvre la page de l'arbre, il faut qu'il soit centré ») : on n'ouvre plus sur la dernière
  // position déplacée (souvenir de l'appareil), mais toujours centré sur la personne du livre ; et on recentre une fois la
  // page posée (la zone de l'arbre peut avoir une taille nulle au premier instant), puis à chaque redimensionnement tant
  // que le lecteur n'a pas encore bougé l'arbre lui-même.
  let touche = false;
  premiereVue();
  const recaler = () => { if (!touche && vue.getBoundingClientRect().width > 0) premiereVue(); };
  requestAnimationFrame(() => requestAnimationFrame(recaler)); setTimeout(recaler, 400);
  ['pointerdown', 'wheel', 'keydown'].forEach(ev => vue.addEventListener(ev, () => { touche = true; }, {passive: true}));
  try { new ResizeObserver(recaler).observe(vue); } catch (e) { addEventListener('resize', recaler); }
  let bulleVue = null; try { bulleVue = localStorage.getItem('vr-bulle'); } catch (e) {}
  if (!bulleVue) {
    const b = document.createElement('div'); b.className = 'bulle'; b.textContent = 'Touchez une personne pour lire sa fiche. Pincez ou utilisez + et − pour agrandir.';
    racineEl.appendChild(b); const off = () => { b.remove(); try { localStorage.setItem('vr-bulle', '1'); } catch (e) {} vue.removeEventListener('pointerdown', off); };
    vue.addEventListener('pointerdown', off); setTimeout(off, 9000);
  }
  addEventListener('resize', () => dessiner());
  return {recentrer, voir, detruire: () => { racineEl.innerHTML = ''; }};
}
