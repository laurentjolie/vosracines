// Vos Racines : relecture du livre (30/10/2026). Toutes les doubles pages, le texte sélectionnable, chaque image nommée,
// et les commentaires à côté. Les pages viennent de Firestore (arbres/{id}/livre/{n}, publiées depuis HQ par publier_livre.py).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GENRES = [['correction', 'Correction'], ['ambiance', 'Ambiance, ton'], ['creuser', 'À creuser']];
const GLIB = Object.fromEntries(GENRES);
const FONTE = '"Georgia", "Times New Roman", serif';
const ctx = document.createElement('canvas').getContext('2d');

// 02/11/2026 (Laurent, D1) : deux itérations seulement. livre.etape vaut « premier_jet » (le client commente, on refait
// une version) ou « bat » (bon à tirer : encore des modifications possibles, puis « Je valide pour l'impression »).
// La validation (arbres/{id}/validation/bat : qui, quand, version) ferme les commentaires et rend le PDF téléchargeable.
const quandFr = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'}); };
export function etatLivre(a) {
  const L = a.livre || {}, v = L.version ? ' ' + L.version : '';
  if (L.etape === 'premier_jet') return `premier jet${v}`;
  if (L.etape === 'bat') return a.validation ? `bon à tirer${v} validé pour l’impression le ${quandFr(a.validation.quand)} par ${a.validation.par}${a.validation.version && a.validation.version !== L.version ? ` (validation donnée sur la version ${a.validation.version})` : ''}` : `bon à tirer${v}, en attente de la validation du client`;
  return `version${v}, étape non précisée`;
}
export async function telechargerPdf(meta, S, b) {
  const P = (meta.livre || {}).pdf || {}; if (!P.morceaux) return;
  const lib = b.textContent; b.disabled = true;
  try {
    const parts = await S.pdf(meta.id, P.morceaux, (k, n) => { b.textContent = `Préparation du PDF… ${Math.round(k / n * 100)} %`; });
    const blob = new Blob(parts.map(s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }), {type: 'application/pdf'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = P.nom || 'livre.pdf'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    b.textContent = lib;
  } catch (e) { console.error(e); b.textContent = 'Le téléchargement n’a pas marché, réessayer'; }
  b.disabled = false;
}

// planches : la page 1 seule (à droite, comme un livre ouvert), puis 2-3, 4-5...
function planches(n) { const out = [[null, 1]]; for (let p = 2; p <= n; p += 2) out.push([p, p + 1 <= n ? p + 1 : null]); return out; }
const libPlanche = ([g, d]) => g && d ? `Pages ${g} et ${d}` : `Page ${g || d}`;

export function ouvrirRelecture(el, meta, S, U, opt = {}) {
  const N = (meta.livre || {}).pages || 0, PL = planches(N);
  const admin = !!opt.admin;
  const L = meta.livre || {}, etape = L.etape || '';
  let retours = [], courante = 0, ref = null;
  let validation = 'validation' in meta ? meta.validation : undefined;   // undefined : pas encore lue
  const verrou = () => !admin && !!validation;   // livre validé : plus de commentaire du client
  const titreEtape = etape === 'bat' ? 'Relire le bon à tirer' : etape === 'premier_jet' ? 'Feuilleter le premier jet' : 'Relire le livre';
  el.innerHTML = `<div class="relecture">
    <div class="rl-tete"><div><h1>${titreEtape}</h1><p class="petit">${esc(meta.titre)} · version ${esc(L.version || '')} · ${N} pages</p></div>
      <p class="rl-aide">Écrivez votre remarque sur la page affichée, dans le cadre « Commentaires ». Pour viser une phrase précise, vous pouvez aussi la sélectionner, ou toucher le numéro d’une image.</p>
      <div class="rl-zoom" role="group" aria-label="Taille des pages"><button type="button" data-z="-" aria-label="Rapetisser">−</button><span class="rl-z">100 %</span><button type="button" data-z="+" aria-label="Agrandir">+</button><button type="button" data-z="1">Ajuster</button></div>
      ${admin ? `<label class="rl-ouvrir"><input type="checkbox" ${meta.relecture ? 'checked' : ''}> Relecture ouverte au client</label>` : ''}</div>
    <div class="rl-etape-zone" aria-live="polite"></div>
    <div class="rl-corps">
      <div class="rl-pages">${PL.map((pl, k) => `<section class="planche" data-pl="${k}" aria-label="${libPlanche(pl)}"><h2 class="rl-lib">${libPlanche(pl)}</h2><div class="pl-pages">${pl.map(n => n ? `<div class="pg" data-n="${n}" style="aspect-ratio:148/210"><span class="pg-num">${n}</span></div>` : '<div class="pg vide" aria-hidden="true"></div>').join('')}</div></section>`).join('')}</div>
      <aside class="rl-notes" aria-label="Commentaires">
        <h2 class="rl-ici"></h2>
        <form class="rl-form"><div class="rl-ref" hidden></div>
          <fieldset class="rl-genre"><legend class="cache-visuel">Type de remarque</legend>${GENRES.map(([k, l], i) => `<label><input type="radio" name="genre" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
          <label class="cache-visuel" for="rl-texte">Votre commentaire</label>
          <textarea id="rl-texte" rows="4" placeholder="Votre remarque sur cette double page…"></textarea>
          <button class="btn btn-1" type="submit">Ajouter le commentaire</button><span class="note-ok" role="status"></span></form>
        <div class="rl-liste"></div>
        <label class="rl-tous"><input type="checkbox"> Voir tous les commentaires du livre</label>
      </aside></div>
    <button class="rl-citer" hidden>Commenter ce passage</button>
    <button class="rl-mobile btn btn-1">Commentaires</button></div>`;
  const pagesEl = el.querySelector('.rl-pages'), notes = el.querySelector('.rl-notes'), form = el.querySelector('.rl-form'),
        txt = el.querySelector('#rl-texte'), refEl = el.querySelector('.rl-ref'), liste = el.querySelector('.rl-liste'),
        tous = el.querySelector('.rl-tous input'), citer = el.querySelector('.rl-citer');

  // ---------- pages, chargées à l'approche
  const charge = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { charge.unobserve(e.target); remplir(e.target); } }), {rootMargin: '1200px 0px'});
  el.querySelectorAll('.pg[data-n]').forEach(p => charge.observe(p));
  async function remplir(div) {
    const n = +div.dataset.n;
    let p; try { p = await S.page(meta.id, n); } catch (e) { div.insertAdjacentHTML('beforeend', '<span class="petit pg-err">Page indisponible</span>'); return; }
    if (!p) return;
    div.style.aspectRatio = `${p.w}/${p.h}`; div.querySelector('.pg-num')?.remove();
    const ratio = p.h / p.w;
    div.insertAdjacentHTML('afterbegin', `<img src="${p.i}" alt="Page ${n}" draggable="false"><div class="pg-texte">${(p.l || []).map(([x, y, w, h, sz, t]) => {
      const fs = sz * ratio * 100;   // en cqw (pourcentage de la largeur de la page)
      ctx.font = `${fs * 10}px ${FONTE}`; const mes = ctx.measureText(t).width || 1, sx = (w * 1000) / mes;
      return `<span style="left:${x * 100}%;top:${y * 100}%;font-size:${fs}cqw;transform:scaleX(${sx.toFixed(3)})">${esc(t)}</span>`;
    }).join(' ')}</div>${(p.im || []).map(([x, y, w, h, nom]) => `<button class="pg-img" data-img="${esc(nom)}" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%" aria-label="Image ${esc(nom)} : la commenter"><span>Image ${esc(nom)}</span></button>`).join('')}`);
  }

  // ---------- zoom (01/11, Laurent) : boutons, Ctrl ou ⌘ + molette, touches + et - ; le texte sélectionnable suit (unités cqw)
  let z = 1;
  function zoomer(nz, cx) {
    nz = Math.max(0.5, Math.min(3, Math.round(nz * 4) / 4)); if (nz === z) return;
    const r = pagesEl.getBoundingClientRect(), fx = (pagesEl.scrollLeft + (cx ?? r.width / 2)) / pagesEl.scrollWidth, fy = (pagesEl.scrollTop + r.height / 2) / pagesEl.scrollHeight;
    z = nz; pagesEl.style.setProperty('--z', z); el.querySelector('.rl-z').textContent = Math.round(z * 100) + ' %';
    pagesEl.classList.toggle('zoome', z > 1);
    pagesEl.scrollLeft = fx * pagesEl.scrollWidth - (cx ?? r.width / 2); pagesEl.scrollTop = fy * pagesEl.scrollHeight - r.height / 2;
  }
  el.querySelector('.rl-zoom').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; zoomer(b.dataset.z === '+' ? z + 0.25 : b.dataset.z === '-' ? z - 0.25 : 1); });
  pagesEl.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomer(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - pagesEl.getBoundingClientRect().left); }, {passive: false});
  addEventListener('keydown', e => { if (e.target.matches('textarea, input')) return; if (e.key === '+' || e.key === '=') zoomer(z + 0.25); if (e.key === '-') zoomer(z - 0.25); });

  // ---------- planche courante
  const vis = new Map();
  const suit = new IntersectionObserver(es => {
    es.forEach(e => vis.set(+e.target.dataset.pl, e.intersectionRatio));
    let best = courante, r = -1; vis.forEach((v, k) => { if (v > r) { r = v; best = k; } });
    if (best !== courante) { courante = best; afficher(); }
  }, {threshold: [0, 0.25, 0.5, 0.75, 1]});
  el.querySelectorAll('.planche').forEach(s => suit.observe(s));

  // ---------- références : passage sélectionné ou image
  function poserRef(r) {
    ref = r;
    refEl.hidden = !r;
    refEl.innerHTML = r ? `<span>${r.ref ? `Image ${esc(r.ref)}` : `Page ${r.page}`}${r.citation ? ` : « ${esc(r.citation.slice(0, 220))}${r.citation.length > 220 ? '…' : ''} »` : ''}</span><button type="button" aria-label="Retirer la référence">×</button>` : '';
    if (r) refEl.querySelector('button').onclick = () => poserRef(null);
  }
  function selectionCourante() {
    const s = getSelection(); if (!s || s.isCollapsed) return null;
    const t = s.toString().replace(/\s+/g, ' ').trim(); if (t.length < 2) return null;
    const pg = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('.pg[data-n]');
    return pg ? {page: +pg.dataset.n, citation: t, rect: s.getRangeAt(0).getBoundingClientRect()} : null;
  }
  const majCiter = () => {
    const s = selectionCourante();
    if (!s || verrou()) { citer.hidden = true; return; }
    citer.hidden = false; citer.style.left = `${Math.min(innerWidth - 220, Math.max(8, s.rect.left))}px`; citer.style.top = `${Math.max(8, s.rect.top - 48)}px`;
    citer.onclick = () => { poserRef({page: s.page, citation: s.citation}); citer.hidden = true; getSelection().removeAllRanges(); ouvrirMobile(); txt.focus(); };
  };
  document.addEventListener('selectionchange', () => setTimeout(majCiter, 10));
  pagesEl.addEventListener('scroll', () => { citer.hidden = true; }, {passive: true});
  pagesEl.addEventListener('click', e => {
    const b = e.target.closest('[data-img]'); if (!b || verrou()) return;
    const pg = b.closest('.pg'); poserRef({page: +pg.dataset.n, ref: b.dataset.img}); ouvrirMobile(); txt.focus();
  });

  // ---------- commentaires
  const pagesDe = k => PL[k].filter(Boolean);
  function carte(r) {
    const quand = r.cree ? new Date(r.cree).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'}) : '';
    return `<article class="rl-com ${r.statut === 'fait' ? 'fait' : ''}" data-r="${esc(r.id)}">
      <p class="rl-com-ref">${r.genre && r.genre !== 'correction' ? `<span class="rl-badge ${esc(r.genre)}">${esc(GLIB[r.genre] || '')}</span> ` : ''}<button class="btn-lien" data-aller="${r.page}">${r.ref ? `Image ${esc(r.ref)}` : `Page ${r.page}`}</button>${r.citation ? ` : « ${esc(r.citation)} »` : ''}</p>
      <p class="rl-com-txt">${esc(r.texte)}</p>
      <p class="petit">${admin ? esc(r.auteur) + ' · ' : ''}${esc(quand)}${r.statut === 'fait' ? ' · corrigé' : ''}</p>
      ${r.reponse ? `<p class="rl-com-rep"><b>Réponse de Vos Racines :</b> ${esc(r.reponse)}</p>` : ''}
      ${admin ? `<form class="rl-rep" data-rep="${esc(r.id)}"><label class="cache-visuel" for="rep-${esc(r.id)}">Réponse au client</label><input id="rep-${esc(r.id)}" type="text" maxlength="500" value="${esc(r.reponse || '')}" placeholder="Répondre au client (une ligne)"><button class="btn" type="submit">${r.reponse ? 'Modifier la réponse' : 'Répondre'}</button></form>` : ''}
      <div class="rangee">${admin ? `<button class="btn" data-fait="${esc(r.id)}">${r.statut === 'fait' ? 'Rouvrir' : 'Marquer corrigé'}</button>` : ''}${admin || r.auteur === U.email ? `<button class="btn-lien" data-suppr="${esc(r.id)}">Supprimer</button>` : ''}</div></article>`;
  }
  function afficher() {
    const ps = pagesDe(courante);
    el.querySelector('.rl-ici').textContent = libPlanche(PL[courante]);
    txt.placeholder = `Votre remarque sur ${ps.length > 1 ? 'cette double page' : 'cette page'}…`;
    const L = (tous.checked ? retours : retours.filter(r => ps.includes(r.page))).sort((a, b) => a.page - b.page || String(a.cree).localeCompare(String(b.cree)));
    liste.innerHTML = L.length ? L.map(carte).join('') : `<p class="petit">${tous.checked ? 'Aucun commentaire pour l’instant.' : 'Aucun commentaire sur ces pages.'}</p>`;
    el.querySelector('.rl-mobile').textContent = `Commentaires (${retours.filter(r => ps.includes(r.page)).length})`;
  }
  liste.addEventListener('click', async e => {
    const a = e.target.closest('[data-aller]'); if (a) { aller(+a.dataset.aller); return; }
    const f = e.target.closest('[data-fait]');
    if (f) { const r = retours.find(x => x.id === f.dataset.fait); r.statut = r.statut === 'fait' ? 'ouvert' : 'fait'; await S.majRetour(meta.id, r.id, {statut: r.statut}); afficher(); return; }
    const s = e.target.closest('[data-suppr]');
    if (s && confirmer(s)) { await S.supprimerRetour(meta.id, s.dataset.suppr); retours = retours.filter(x => x.id !== s.dataset.suppr); afficher(); }
  });
  // 02/11/2026 (audit UX, F3) : l'administrateur répond sous chaque commentaire (champ « reponse », déjà permis par firestore.rules)
  liste.addEventListener('submit', async e => {
    const f = e.target.closest('[data-rep]'); if (!f) return;
    e.preventDefault();
    const r = retours.find(x => x.id === f.dataset.rep); if (!r) return;
    const v = f.querySelector('input').value.trim().slice(0, 500), b = f.querySelector('button'); b.disabled = true;
    try { await S.majRetour(meta.id, r.id, {reponse: v}); r.reponse = v; afficher(); }
    catch (err) { console.error(err); b.disabled = false; b.textContent = 'L’envoi n’a pas marché, réessayer'; }
  });
  function confirmer(b) { if (b.dataset.ok) return true; b.dataset.ok = 1; b.textContent = 'Confirmer la suppression'; return false; }
  tous.onchange = afficher;
  form.onsubmit = async e => {
    e.preventDefault();
    const t = txt.value.trim(); if (!t) { txt.focus(); return; }
    const genre = (form.querySelector('input[name=genre]:checked') || {}).value || 'correction';
    const r = {page: ref ? ref.page : pagesDe(courante)[0], ref: ref && ref.ref || '', citation: ref && ref.citation ? ref.citation.slice(0, 1000) : '', texte: t, genre};
    const b = form.querySelector('button[type=submit]'); b.disabled = true;
    try { const id = await S.ajouterRetour(meta.id, r); retours.push({...r, id, auteur: U.email, cree: new Date().toISOString(), statut: 'ouvert'}); txt.value = ''; poserRef(null); form.querySelector('.note-ok').textContent = 'Merci, c’est noté.'; setTimeout(() => form.querySelector('.note-ok').textContent = '', 2500); afficher(); }
    catch (err) { console.error(err); form.querySelector('.note-ok').textContent = 'L’envoi n’a pas marché. Réessayez dans un instant.'; }
    b.disabled = false;
  };
  function aller(n) { const pg = el.querySelector(`.pg[data-n="${n}"]`); if (pg) pg.closest('.planche').scrollIntoView({behavior: 'smooth', block: 'start'}); }

  // ---------- mobile : le panneau des commentaires s'ouvre par-dessus
  const mob = el.querySelector('.rl-mobile');
  function ouvrirMobile() { if (innerWidth < 900) notes.classList.add('ouvert'); }
  mob.onclick = () => notes.classList.toggle('ouvert');
  notes.addEventListener('click', e => { if (e.target === notes) notes.classList.remove('ouvert'); });

  // ---------- étape du livre (02/11/2026, D1) : premier jet, bon à tirer, validation pour l'impression
  const zone = el.querySelector('.rl-etape-zone');
  function majEtape() {
    form.hidden = verrou();
    let ferme = notes.querySelector('.rl-ferme');
    if (verrou() && !ferme) { notes.insertAdjacentHTML('afterbegin', '<p class="rl-ferme">Vous avez validé ce livre pour l’impression : il n’est plus modifiable. Vos commentaires restent visibles ci-dessous.</p>'); }
    if (!verrou() && ferme) ferme.remove();
    if (etape === 'premier_jet') { zone.innerHTML = `<div class="rl-etape"><p><b>Premier jet.</b> Vos commentaires nous servent à préparer le bon à tirer : la version que vous relirez, que vous pourrez encore faire corriger, puis valider pour l’impression.</p></div>`; return; }
    if (etape !== 'bat') { zone.innerHTML = ''; return; }
    if (validation === undefined) { zone.innerHTML = ''; return; }
    if (validation) {
      const pdf = L.pdf && L.pdf.morceaux > 0;
      zone.innerHTML = `<div class="rl-etape valide"><p><b>Livre validé pour l’impression</b> le ${esc(quandFr(validation.quand))}${admin ? ` par ${esc(validation.par)}${validation.version && validation.version !== L.version ? ` (sur la version ${esc(validation.version)}, différente de la version publiée)` : ''}` : ''}. ${admin ? 'Le client peut télécharger le PDF.' : 'Il n’est plus modifiable.'}</p>
        ${pdf ? `<button class="btn btn-1" data-pdf>Télécharger le livre (PDF)</button>` : `<p class="petit">${admin ? 'Aucun PDF publié pour ce livre : relancer publier_livre.py avec --etape bat.' : 'Le PDF n’est pas encore disponible : nous vous écrivons dès qu’il l’est.'}</p>`}</div>`;
      const b = zone.querySelector('[data-pdf]'); if (b) b.onclick = () => telechargerPdf(meta, S, b);
      return;
    }
    if (admin) { zone.innerHTML = `<div class="rl-etape bat"><p><b>Bon à tirer ${esc(L.version || '')}</b> : en attente de la validation du client.</p></div>`; return; }
    zone.innerHTML = `<div class="rl-etape bat"><p><b>Bon à tirer.</b> C’est la dernière relecture : signalez dans les commentaires ce qu’il faut encore changer, nous le corrigeons. Quand tout vous convient, validez le livre pour l’impression ; le PDF vous est alors remis.</p>
      <button class="btn btn-1" data-valider>Je valide pour l’impression</button>
      <div class="rl-confirmer" role="alertdialog" aria-labelledby="rl-conf-t" aria-describedby="rl-conf-d" hidden></div></div>`;
    const conf = zone.querySelector('.rl-confirmer'), bv = zone.querySelector('[data-valider]');
    bv.onclick = () => {
      const ouverts = retours.filter(r => r.auteur === U.email && r.statut !== 'fait').length;
      conf.innerHTML = `<p id="rl-conf-t"><b>Valider le livre pour l’impression ?</b></p>
        <p id="rl-conf-d">Après validation, le livre ne sera plus modifié : il est bon pour l’impression tel que vous le voyez, et vous pourrez télécharger le PDF.${ouverts ? ` Attention : ${ouverts === 1 ? 'un de vos commentaires n’a' : `${ouverts} de vos commentaires n’ont`} pas encore été traité${ouverts === 1 ? '' : 's'} ; si vous validez maintenant, ${ouverts === 1 ? 'il ne sera pas pris' : 'ils ne seront pas pris'} en compte.` : ''}</p>
        <div class="rangee"><button class="btn btn-1" data-oui>Oui, je valide pour l’impression</button><button class="btn" data-non>Pas encore</button></div><p class="msg-erreur" role="alert"></p>`;
      conf.hidden = false; bv.hidden = true; conf.querySelector('[data-non]').focus();
      conf.querySelector('[data-non]').onclick = () => { conf.hidden = true; bv.hidden = false; bv.focus(); };
      conf.querySelector('[data-oui]').onclick = async e => {
        e.target.disabled = true;
        try {
          await S.valider(meta.id, L.version || '');
          validation = (await S.validation(meta.id).catch(() => null)) || {par: U.email, quand: new Date().toISOString(), version: L.version || ''};
          meta.validation = validation; poserRef(null); citer.hidden = true; notes.classList.remove('ouvert'); majEtape();
        } catch (err) { console.error(err); e.target.disabled = false; conf.querySelector('.msg-erreur').textContent = 'La validation n’a pas été enregistrée. Réessayez dans un instant ; si cela recommence, écrivez-nous.'; }
      };
    };
  }
  if (etape === 'bat' && validation === undefined) S.validation(meta.id).then(v => { validation = v || null; majEtape(); }).catch(e => { console.error(e); validation = null; majEtape(); });
  majEtape();

  if (admin) el.querySelector('.rl-ouvrir input').onchange = async e => { await S.ouvrirRelecture(meta.id, e.target.checked); meta.relecture = e.target.checked; };
  S.retours(meta.id, admin ? null : U.email).then(x => { retours = x; afficher(); }).catch(e => { console.error(e); afficher(); });
  afficher();
}
