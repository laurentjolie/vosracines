// Vos Racines : espace client (29/10/2026). Connexion par lien d'accès reçu par e-mail (Firebase Auth, lien généré sur HQ
// et envoyé par l'archiviste), arbres en lecture selon le compte, menu administrateur.
import {FIREBASE, EMULATEURS, CONTACT} from './config.js';
import {creerArbre, nomComplet} from './arbre.js';
import {ouvrirRelecture} from './relecture.js';
import {ouvrirOrientation} from './orientation.js';
import {ouvrirSuivi} from './suivi.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const DEV = params.get('dev');   // ?dev=client ou ?dev=admin : données locales (./dev/arbres), sans Firebase
const LOGO = `<a class="logo" href="./"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#F1E1C4"/><path d="M32 10v26M32 36c-8 0-14 6-16 14M32 36c8 0 14 6 16 14M32 36v16M24 24c4 2 6 6 8 12M40 24c-4 2-6 6-8 12" stroke="#5A3A22" stroke-width="3" fill="none" stroke-linecap="round"/></svg><span>Vos Racines</span></a>`;
const lire = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const ecrire = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

// ---------------------------------------------------------------- source de données
let S;   // {connexion, onUtilisateur, demanderLien, entrerParLien, estLien, compte, arbres, arbre, comptes, majCompte, sortir}
async function sourceFirebase() {
  const fb = await import('./vendor/firebase.js');
  const app = fb.initializeApp(FIREBASE), auth = fb.getAuth(app), db = fb.getFirestore(app);
  if (EMULATEURS) { fb.connectAuthEmulator(auth, `http://${location.hostname}:9099`, {disableWarnings: true}); fb.connectFirestoreEmulator(db, location.hostname, 8080); }
  await fb.setPersistence(auth, fb.browserLocalPersistence);
  const morceaux = async (id, quoi) => {
    const qs = await fb.getDocs(fb.collection(db, 'arbres', id, quoi));
    const out = {personnes: {}, familles: [], actes: [], registre: {}};
    qs.docs.sort((a, b) => +a.id - +b.id).forEach(d => { let x = d.data(); if (typeof x.d === 'string') x = JSON.parse(x.d); Object.assign(out.personnes, x.personnes || {}); out.familles.push(...(x.familles || [])); out.actes.push(...(x.actes || [])); Object.assign(out.registre, x.registre || {}); });
    return out;
  };
  return {
    onUtilisateur: cb => fb.onAuthStateChanged(auth, async u => {
      if (!u) return cb(null);
      const t = await u.getIdTokenResult();
      cb({email: (u.email || '').toLowerCase(), admin: !!t.claims.admin});
    }),
    demanderLien: email => fb.addDoc(fb.collection(db, 'demandes_acces'), {email, cree: fb.serverTimestamp()}),
    estLien: () => fb.isSignInWithEmailLink(auth, location.href),
    entrerParLien: email => fb.signInWithEmailLink(auth, email, location.href),
    compte: async email => { const d = await fb.getDoc(fb.doc(db, 'comptes', email)); return d.exists() ? d.data() : {arbres: []}; },
    meta: async id => { const d = await fb.getDoc(fb.doc(db, 'arbres', id)); return d.exists() ? {id, ...d.data()} : null; },
    tousArbres: async () => (await fb.getDocs(fb.collection(db, 'arbres'))).docs.map(d => ({id: d.id, ...d.data()})),
    arbre: async (id, version) => { const m = await S.meta(id); return {...m, ...(await morceaux(id, version)), racine: '@1'}; },
    comptes: async () => (await fb.getDocs(fb.collection(db, 'comptes'))).docs.map(d => ({email: d.id, ...d.data()})),
    majCompte: async (email, arbres, avant) => {
      await fb.setDoc(fb.doc(db, 'comptes', email), {arbres, maj: fb.serverTimestamp()}, {merge: true});
      for (const id of arbres.filter(a => !avant.includes(a))) await fb.updateDoc(fb.doc(db, 'arbres', id), {lecteurs: fb.arrayUnion(email)});
      for (const id of avant.filter(a => !arbres.includes(a))) await fb.updateDoc(fb.doc(db, 'arbres', id), {lecteurs: fb.arrayRemove(email)});
    },
    envoyerLienA: email => fb.addDoc(fb.collection(db, 'demandes_acces'), {email, cree: fb.serverTimestamp(), par: 'admin'}),
    image: async (id, nom) => { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'images', nom)); return d.exists() ? d.data().d : null; },
    sortir: () => fb.signOut(auth),
    // 30/10 : relecture du livre
    page: async (id, n) => { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'livre', String(n))); return d.exists() ? JSON.parse(d.data().d) : null; },
    retours: async (id, email) => {
      const c = fb.collection(db, 'arbres', id, 'retours');
      const qs = await fb.getDocs(email ? fb.query(c, fb.where('auteur', '==', email)) : c);
      return qs.docs.map(d => { const x = d.data(); return {...x, id: d.id, cree: x.cree && x.cree.toDate ? x.cree.toDate().toISOString() : x.cree}; });
    },
    ajouterRetour: async (id, r) => (await fb.addDoc(fb.collection(db, 'arbres', id, 'retours'), {...r, auteur: U.email, cree: fb.serverTimestamp(), statut: 'ouvert'})).id,
    majRetour: (id, rid, x) => fb.updateDoc(fb.doc(db, 'arbres', id, 'retours', rid), x),
    supprimerRetour: (id, rid) => fb.deleteDoc(fb.doc(db, 'arbres', id, 'retours', rid)),
    ouvrirRelecture: (id, oui) => fb.updateDoc(fb.doc(db, 'arbres', id), {relecture: !!oui}),
    // 30/10 : orientation du livre (premier jet -> BAT)
    ouvrirOrientationClient: (id, oui) => fb.updateDoc(fb.doc(db, 'arbres', id), {orientation: !!oui}),
    proposition: async id => { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'proposition', '0')); return d.exists() ? JSON.parse(d.data().d) : null; },
    choix: async (id, email) => { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'choix', email)); return d.exists() ? d.data() : null; },
    tousChoix: async id => (await fb.getDocs(fb.collection(db, 'arbres', id, 'choix'))).docs.map(d => ({email: d.id, ...d.data()})),
    enregistrerChoix: (id, email, x) => fb.setDoc(fb.doc(db, 'arbres', id, 'choix', email), {...x, maj: fb.serverTimestamp()}),
    mesDepots: async (id, email) => (await fb.getDocs(email ? fb.query(fb.collection(db, 'arbres', id, 'depots'), fb.where('auteur', '==', email)) : fb.collection(db, 'arbres', id, 'depots'))).docs.map(d => ({id: d.id, ...d.data()})),
    deposer: async (id, m, parts) => {
      const ref = await fb.addDoc(fb.collection(db, 'arbres', id, 'depots'), {...m, auteur: U.email, morceaux: parts.length, note: '', cree: fb.serverTimestamp(), complet: false});
      for (const [k, d] of parts.entries()) await fb.setDoc(fb.doc(db, 'arbres', id, 'depots', ref.id, 'm', String(k)), {d});
      await fb.updateDoc(ref, {complet: true}); return ref.id;
    },
    supprimerDepot: (id, did) => fb.deleteDoc(fb.doc(db, 'arbres', id, 'depots', did)),
    // 02/11 : suivi de l'archiviste (administrateur)
    suivis: async () => (await fb.getDocs(fb.collection(db, 'suivi'))).docs.map(d => JSON.parse(d.data().d)),
  };
}
let devRetours = [], devChoix = null, devDepots = [];
async function sourceDev() {   // données locales pour essayer l'interface sans Firebase
  const idx = await (await fetch('dev/arbres/index.json')).json();
  const comptes = {};
  for (const a of idx.arbres) for (const e of a.lecteurs || []) (comptes[e] = comptes[e] || {arbres: []}).arbres.push(a.id);
  const user = DEV === 'admin' ? {email: 'laurentjolie@gmail.com', admin: true} : {email: 'benjaminabdi@gmail.com', admin: false};
  let connecte = lire('vr-dev-sortie') ? null : user;
  return {
    onUtilisateur: cb => cb(connecte),
    demanderLien: async () => {}, estLien: () => false, entrerParLien: async () => {},
    compte: async e => comptes[e] || {arbres: []},
    meta: async id => idx.arbres.find(a => a.id === id),
    tousArbres: async () => idx.arbres,
    arbre: async (id, v) => ({...(await (await fetch(`dev/arbres/${id}.${v}.json`)).json()), racine: '@1'}),
    comptes: async () => Object.entries(comptes).map(([email, c]) => ({email, ...c})),
    majCompte: async (email, arbres) => { comptes[email] = {arbres}; },
    envoyerLienA: async () => {},
    image: async (id, nom) => `dev/arbres/images/${id}/${nom}`,
    sortir: async () => { ecrire('vr-dev-sortie', '1'); location.reload(); },
    page: async (id, n) => (await fetch(`dev/livre/${id}/${n}.json`)).json(),
    retours: async () => [...devRetours],
    ajouterRetour: async (id, r) => { const x = {...r, id: 'r' + Date.now(), auteur: user.email, cree: new Date().toISOString(), statut: 'ouvert'}; devRetours.push(x); return x.id; },
    majRetour: async () => {}, supprimerRetour: async (id, rid) => { devRetours = devRetours.filter(x => x.id !== rid); },
    ouvrirRelecture: async () => {},
    ouvrirOrientationClient: async () => {},
    proposition: async id => { try { return await (await fetch(`dev/proposition/${id}.json`)).json(); } catch (e) { return null; } },
    choix: async () => devChoix, tousChoix: async () => devChoix ? [{email: user.email, ...devChoix}] : [],
    enregistrerChoix: async (id, e, x) => { devChoix = x; },
    mesDepots: async () => [...devDepots],
    deposer: async (id, m, parts) => { const x = {...m, id: 'd' + Date.now(), complet: true}; devDepots.push(x); return x.id; },
    supprimerDepot: async (id, did) => { devDepots = devDepots.filter(x => x.id !== did); },
    suivis: async () => { try { return await (await fetch('dev/suivi.json')).json(); } catch (e) { return []; } },
  };
}

// ---------------------------------------------------------------- écrans de connexion
function ecranConnexion(erreur = '', valeur = lire('vr-email') || '') {
  document.title = 'Votre espace · Vos Racines';
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Votre espace Vos Racines</h1>
    <p class="sous">Retrouvez ici l’arbre de votre famille et votre livre.</p>
    <form novalidate>
      <label class="etiq" for="email">Votre adresse e-mail</label>
      <p class="aide" id="aide-email">Celle à laquelle nous vous écrivons pour votre livre.</p>
      <input id="email" type="email" autocomplete="email" inputmode="email" aria-describedby="aide-email err" value="${esc(valeur)}" ${erreur ? 'class="erreur" aria-invalid="true"' : ''}>
      <p class="msg-erreur" id="err" role="alert">${esc(erreur)}</p>
      <button class="btn btn-1" type="submit">Recevoir mon lien d’accès</button>
    </form>
    <p class="petit" style="margin-top:12px">Pas de mot de passe à retenir. Nous vous envoyons un e-mail avec un bouton ; il suffit de cliquer dessus pour entrer.</p>
    <div class="pied-porte">Une difficulté ? Écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>, nous vous répondons rapidement.</div>
  </div></main>`;
  const f = $app.querySelector('form'), inp = $app.querySelector('#email');
  if (!valeur) inp.focus();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const v = inp.value.trim().toLowerCase();
    if (!v) return ecranConnexion('Indiquez votre adresse e-mail pour recevoir le lien.', v);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return ecranConnexion('Cette adresse ne semble pas complète. Vérifiez qu’elle contient bien un @ et un point, par exemple marie.dupont@orange.fr.', v);
    // 02/11/2026 : sur un clavier AZERTY (Mac surtout), les chiffres sans la touche Maj donnent « &é"'(-è_çà ».
    // paul.jolie92@ devenait paul.jolieçé@ : aucun e-mail ne pouvait partir. On le dit, et on propose la bonne adresse.
    if (/[^\x21-\x7e]/.test(v)) {
      const AZ = {'&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', '§': '6', 'è': '7', '!': '8', 'ç': '9', 'à': '0'};
      const [l, d] = v.split('@'); const propose = l.replace(/[&é"'(§è!çà]/g, c => AZ[c]) + '@' + d;
      const ok = /^[\x21-\x7e]+$/.test(propose);
      return ecranConnexion(ok ? `Une adresse e-mail ne peut pas contenir d’accent ni de « ç ». Vouliez-vous écrire ${propose} ? Sur un clavier français, les chiffres s’obtiennent avec la touche Maj.`
                               : 'Une adresse e-mail ne peut pas contenir d’accent, de « ç » ni d’espace. Vérifiez-la, par exemple marie.dupont@orange.fr.', ok ? propose : v);
    }
    f.querySelector('button').disabled = true;
    try { await S.demanderLien(v); } catch (err) { console.warn(err); }
    ecrire('vr-email', v); ecranEnvoye(v);
  });
}
function ecranEnvoye(email) {
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Regardez votre boîte mail</h1>
    <p>Si l’adresse <b>${esc(email)}</b> est bien celle de votre livre, un e-mail de Vos Racines vient de partir. Ouvrez-le et cliquez sur le bouton « Ouvrir mon espace » : il vous fera entrer directement. Ce lien ne sert qu’une fois.</p>
    <div class="encart"><b>Vous ne voyez rien ?</b>L’e-mail peut mettre une ou deux minutes à arriver. Vérifiez aussi le dossier « Courrier indésirable » ou « Spam ». Si vous n’avez toujours rien, vous pouvez demander un nouveau lien.</div>
    <div class="rangee"><button class="btn" id="renvoi" disabled>Renvoyer le lien</button><button class="btn-lien" id="autre">Utiliser une autre adresse</button></div>
    <div class="pied-porte">Toujours bloqué ? <a href="mailto:${CONTACT}">${CONTACT}</a></div>
  </div></main>`;
  const r = $app.querySelector('#renvoi'); let n = 60;
  const t = setInterval(() => { n--; r.textContent = n > 0 ? `Renvoyer le lien (dans ${n} s)` : 'Renvoyer le lien'; if (n <= 0) { r.disabled = false; clearInterval(t); } }, 1000);
  r.textContent = `Renvoyer le lien (dans ${n} s)`;
  r.onclick = async () => { r.disabled = true; try { await S.demanderLien(email); } catch (e) {} ecranEnvoye(email); };
  $app.querySelector('#autre').onclick = () => { clearInterval(t); ecrire('vr-email', null); ecranConnexion(); };
}
function ecranEntrer(erreur = '', saisir = false) {   // page ouverte depuis l'e-mail : on ne consomme le lien qu'au clic (les antivirus « visitent » les liens)
  // 02/11/2026 : l'adresse retenue sur cet appareil peut être fausse (faute de frappe, autre personne, autre demande) :
  // on peut toujours la changer, et un refus repasse à la saisie au lieu de reproposer la même adresse.
  const connu = saisir ? '' : (lire('vr-email') || '');
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Bienvenue</h1>
    <form novalidate>
      ${connu ? `<p class="sous">Vous entrez avec l’adresse <b>${esc(connu)}</b>. <button type="button" class="btn-lien" id="pas-moi">Ce n’est pas mon adresse</button></p>` : `<p class="sous">Pour votre sécurité, confirmez l’adresse e-mail à laquelle vous avez reçu ce lien.</p>
      <label class="etiq" for="email">Votre adresse e-mail</label><input id="email" type="email" autocomplete="email" inputmode="email">`}
      <p class="msg-erreur" role="alert">${esc(erreur)}</p>
      <button class="btn btn-1" type="submit">Ouvrir mon espace</button>
    </form></div></main>`;
  const pm = $app.querySelector('#pas-moi'); if (pm) pm.onclick = () => { ecrire('vr-email', null); ecranEntrer('', true); };
  $app.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = (connu || $app.querySelector('#email').value).trim().toLowerCase();
    try {
      await S.entrerParLien(email); ecrire('vr-email', email);
      history.replaceState(null, '', location.pathname);
    } catch (err) {
      const c = String(err && err.code || '');
      if (/invalid-email/.test(c)) { ecrire('vr-email', null); return ecranEntrer(`Ce lien a été envoyé à une autre adresse que ${email}. Indiquez l’adresse qui a reçu l’e-mail.`, true); }
      ecranExpire(email);
    }
  });
}
function ecranExpire(email) {
  history.replaceState(null, '', location.pathname);
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Ce lien n’est plus valable</h1>
    <p>Pour protéger votre espace, un lien d’accès ne sert qu’une fois, pendant une durée limitée. Ce n’est pas grave : demandez-en un nouveau, il arrivera tout de suite.</p>
    <button class="btn btn-1" id="nouveau" style="width:100%">Recevoir un nouveau lien</button>
    <div class="pied-porte">Une difficulté ? <a href="mailto:${CONTACT}">${CONTACT}</a></div></div></main>`;
  $app.querySelector('#nouveau').onclick = () => ecranConnexion('', email || lire('vr-email') || '');
}

// ---------------------------------------------------------------- espace connecté
let U = null, vuComme = null, arbreActif = null;
function barre(titre = '', selecteur = '') {
  const prenom = U.prenom || '';
  return `<header class="barre">${LOGO}<div class="titre-livre">${esc(titre)}</div>${selecteur}
    <div class="menu-compte"><button aria-expanded="false" aria-haspopup="true">${prenom ? 'Bonjour ' + esc(prenom) : 'Mon compte'} ▾</button>
    <ul hidden>
      <li><button data-m="livres">${U.admin ? 'Tous les arbres' : 'Vos livres'}</button></li>
      <li><a href="mailto:${CONTACT}">Nous écrire</a></li>
      <li><button data-m="sortir">Se déconnecter de cet appareil</button></li>
      <li class="info">Connecté avec ${esc(U.email)}</li>
    </ul></div></header>
    ${vuComme ? `<div class="bandeau-admin">Vous voyez l’espace de <b>${esc(vuComme)}</b>. <button class="btn-lien" data-m="revenir">Revenir</button></div>` : ''}`;
}
function brancherBarre() {
  const m = $app.querySelector('.menu-compte'); if (!m) return;
  const b = m.querySelector('button'), ul = m.querySelector('ul');
  b.onclick = () => { const o = !ul.hidden; ul.hidden = o; b.setAttribute('aria-expanded', String(!o)); };
  $app.querySelectorAll('[data-m]').forEach(x => x.onclick = async () => {
    const a = x.dataset.m;
    if (a === 'sortir') { await S.sortir(); ecrire('vr-email', null); ecranConnexion(); }
    if (a === 'livres') { arbreActif = null; accueil(); }
    if (a === 'revenir') { vuComme = null; arbreActif = null; accueil(); }
  });
  document.addEventListener('click', e => { if (!m.contains(e.target)) { ul.hidden = true; b.setAttribute('aria-expanded', 'false'); } }, {once: true});
  const sel = $app.querySelector('#choix-arbre');
  if (sel) sel.onchange = () => ouvrirArbre(sel.value, sel.selectedOptions[0].dataset.v);
}
async function accueil() {
  if (U.admin && !vuComme) { U.prenom = U.prenom || 'Laurent'; return pageAdmin('clients'); }
  const email = vuComme || U.email;
  const c = await S.compte(email);
  if (!vuComme) U.prenom = c.prenom || '';
  const metas = (await Promise.all((c.arbres || []).map(id => S.meta(id).catch(() => null)))).filter(Boolean);
  const relire = m => m.livre && (m.relecture || U.admin);
  const orienter = m => m.orientation || (U.admin && m.proposition);
  if (metas.length === 1 && !vuComme && !relire(metas[0]) && !orienter(metas[0])) return ouvrirArbre(metas[0].id, 'client');
  document.title = 'Vos livres · Vos Racines';
  $app.innerHTML = barre() + `<main class="page"><h1>Vos livres</h1>
    ${metas.length ? `<div class="grille">${metas.map(m => `<article class="livre"><h2>${esc(m.titre)}</h2><p class="st">${esc(m.sous_titre || '')}</p>
      <div class="chiffres"><div><b>${m.n_ancetres || 0}</b><span>ancêtres</span></div><div><b>${m.n_personnes || 0}</b><span>personnes</span></div><div><b>${m.generations || 0}</b><span>générations</span></div></div>
      <div class="rangee"><button class="btn btn-1" data-o="${esc(m.id)}">Ouvrir l’arbre</button>${orienter(m) ? `<button class="btn btn-2" data-orienter="${esc(m.id)}">Orienter mon livre</button>` : ''}${relire(m) ? `<button class="btn" data-relire="${esc(m.id)}">Relire le livre</button>` : ''}</div>
      <p class="maj">Mis à jour le ${esc(dateFr(m.maj))}</p></article>`).join('')}</div>`
    : `<p>Votre arbre n’est pas encore en ligne. Nous vous écrirons dès qu’il le sera. Une question ? <a href="mailto:${CONTACT}">${CONTACT}</a></p>`}</main>`;
  brancherBarre();
  $app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => ouvrirArbre(b.dataset.o, 'client'));
  $app.querySelectorAll('[data-relire]').forEach(b => b.onclick = () => relecture(metas.find(m => m.id === b.dataset.relire), false));
  $app.querySelectorAll('[data-orienter]').forEach(b => b.onclick = () => orientation(metas.find(m => m.id === b.dataset.orienter), false));
}
async function orientation(meta, admin) {
  arbreActif = {id: meta.id, version: 'orientation'};
  document.title = `Orienter ${meta.titre} · Vos Racines`;
  $app.innerHTML = barre(meta.titre) + `<main class="page">${admin ? `<div class="bandeau-admin statique"><label><input type="checkbox" id="or-ouvert" ${meta.orientation ? 'checked' : ''}> Orientation ouverte au client</label> <span class="petit">Vous voyez ce que verra le client ; vos propres choix ne comptent pas.</span></div><div id="or-recus"></div>` : ''}<div id="orientation"></div></main>`;
  brancherBarre();
  if (admin) {
    $app.querySelector('#or-ouvert').onchange = async e => { await S.ouvrirOrientationClient(meta.id, e.target.checked); meta.orientation = e.target.checked; };
    const [cs, ds] = await Promise.all([S.tousChoix(meta.id).catch(() => []), S.mesDepots(meta.id, null).catch(() => [])]);
    const recus = cs.filter(c => c.email !== U.email);
    $app.querySelector('#or-recus').innerHTML = `<details class="or-recus" ${recus.length ? 'open' : ''}><summary>Choix reçus des clients (${recus.length}) · documents déposés (${ds.length})</summary>${recus.map(c => `<div class="note"><b>${esc(c.email)}</b> · style ${esc(c.theme || '?')} · couverture ${esc(c.couverture || '?')} · quatrième ${esc(c.quatrieme || '?')} · ${(c.images || []).length} image(s)${c.usage_prive ? ' (usage privé confirmé)' : ''}${c.ambiance ? `
Ambiance : ${esc(c.ambiance)}` : ''}${c.creuser ? `
À creuser : ${esc(c.creuser)}` : ''}</div>`).join('')}${ds.map(d => `<p class="petit">${esc(d.auteur)} : ${esc(d.nom)} (${esc(d.usage)})${d.complet ? '' : ' · incomplet'}</p>`).join('')}<p class="petit">HQ range les documents dans le dossier de la commande.</p></details>`;
  }
  ouvrirOrientation(document.getElementById('orientation'), meta, S, U, {admin, feuilleter: meta.livre ? () => relecture(meta, admin) : null});
}
async function relecture(meta, admin) {
  arbreActif = {id: meta.id, version: 'relecture'};
  document.title = `Relire ${meta.titre} · Vos Racines`;
  $app.innerHTML = barre(meta.titre) + '<div id="relecture"></div>';
  brancherBarre();
  ouvrirRelecture(document.getElementById('relecture'), meta, S, U, {admin});
}
const dateFr = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}); };

async function ouvrirArbre(id, version) {
  arbreActif = {id, version};
  $app.innerHTML = '<div class="chargement">Chargement de l’arbre…</div>';
  let d;
  try { d = await S.arbre(id, version); } catch (e) { console.error(e); $app.innerHTML = barre() + `<main class="page"><p>Cet arbre n’a pas pu être ouvert. Réessayez dans un instant, ou écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></main>`; brancherBarre(); return; }
  document.title = `${d.titre} · Vos Racines`;
  let sel = '';
  if (U.admin && !vuComme) {
    const tous = await S.tousArbres();
    sel = `<label class="cache-visuel" for="choix-arbre">Choisir un arbre</label><select id="choix-arbre">${tous.map(a => ['admin', 'client'].map(v => `<option value="${esc(a.id)}" data-v="${v}" ${a.id === id && v === version ? 'selected' : ''}>${esc(a.titre)}${v === 'client' ? ' (vue client)' : ''}</option>`).join('')).join('')}</select>`;
  }
  $app.innerHTML = barre(d.titre, sel) + '<div id="arbre"></div>';
  brancherBarre();
  creerArbre(document.getElementById('arbre'), d, {admin: U.admin && version === 'admin', image: nom => S.image(id, nom)});
}

// ---------------------------------------------------------------- administration
// 02/11/2026 (Laurent) : l'administration part des clients, plus des arbres. Les adresses Gmail qui ne diffèrent
// que par des points (lu.ouvry et luouvry) sont la même boîte : une seule ligne.
const cleEmail = e => {
  let [l, d] = String(e || '').trim().toLowerCase().split('@');
  if (!d) return l || '';
  if (d === 'googlemail.com') d = 'gmail.com';
  if (d === 'gmail.com') l = l.split('+')[0].replace(/\./g, '');
  return l + '@' + d;
};
async function pageAdmin(onglet) {
  if (onglet === 'arbres') onglet = 'clients';
  document.title = 'Administration · Vos Racines';
  const [arbres, comptes, suivis] = await Promise.all([S.tousArbres(), S.comptes(), S.suivis ? S.suivis().catch(() => []) : []]);
  // un client = toutes ses adresses (comptes de l'espace, adresses des commandes), regroupées par boîte réelle
  const G = new Map();
  const groupe = e => { const k = cleEmail(e); if (!G.has(k)) G.set(k, {cle: k, emails: new Set(), arbres: new Set(), noms: new Set(), commandes: []}); return G.get(k); };
  for (const c of comptes) { const g = groupe(c.email); g.emails.add(c.email); (c.arbres || []).forEach(a => g.arbres.add(a)); if (c.prenom) g.noms.add(String(c.prenom).trim()); }
  for (const s of suivis) {
    const em = (s.emails || [])[0]; if (!em) continue;
    const g = groupe(em); (s.emails || []).forEach(e => { if (cleEmail(e) === g.cle) g.emails.add(e); });
    g.commandes.push(s); if (s.client) g.noms.add(String(s.client).trim()); (s.arbres || []).forEach(a => g.arbres.add(a));
  }
  for (const a of arbres) for (const e of a.lecteurs || []) { const g = groupe(e); g.emails.add(e); g.arbres.add(a.id); }
  const clients = [...G.values()].map(g => ({...g, emails: [...g.emails], arbres: [...g.arbres], nom: [...g.noms].sort((x, y) => y.length - x.length)[0] || ''}))
    .sort((a, b) => (b.commandes.length ? 1 : 0) - (a.commandes.length ? 1 : 0) || a.cle.localeCompare(b.cle));
  const avecClient = new Set(clients.flatMap(c => c.arbres));
  const orphelins = arbres.filter(a => !avecClient.has(a.id));
  const titre = id => (arbres.find(a => a.id === id) || {}).titre || id;
  const boutonsArbre = a => `<div class="rangee"><button class="btn btn-1" data-o="${esc(a.id)}" data-v="admin">Ouvrir</button><button class="btn" data-o="${esc(a.id)}" data-v="client">Vue client</button>${a.proposition ? `<button class="btn" data-or="${esc(a.id)}">Orientation${a.orientation ? ' (ouverte)' : ''}</button>` : ''}${a.livre ? `<button class="btn" data-rl="${esc(a.id)}">Relecture${a.relecture ? ' (ouverte)' : ''}</button>` : ''}</div>`;
  const ligneArbre = (id, c) => { const a = arbres.find(x => x.id === id); if (!a) return ''; const ouvert = !c || (a.lecteurs || []).some(e => cleEmail(e) === c.cle);
    return `<li class="adm-arbre"><div><b>${esc(a.titre)}</b> <span class="petit">${esc(a.sous_titre || '')} · ${a.n_ancetres || 0} ancêtres${a.maj ? ' · ' + esc(new Date(a.maj).toLocaleDateString('fr-FR')) : ''}${ouvert ? '' : ' · <i>pas encore ouvert à ce client</i>'}</span></div>${boutonsArbre(a)}</li>`; };
  $app.innerHTML = barre() + `<main class="page large"><div class="admin">
    <nav class="rail" aria-label="Administration"><button data-t="clients" aria-current="${onglet === 'clients'}">Clients</button><button data-t="archiviste" aria-current="${onglet === 'archiviste'}">Archiviste</button></nav>
    <section>${onglet === 'archiviste' ? `<h1>Archiviste</h1><div id="suivi"></div>` : `<h1>Clients</h1>
      <div class="outils"><label class="cache-visuel" for="filtre">Rechercher</label><input id="filtre" type="search" placeholder="Nom, adresse, titre…"></div>
      <ul class="adm-clients">${clients.map(c => `<li class="adm-client" data-f="${esc((c.nom + ' ' + c.emails.join(' ') + ' ' + c.arbres.map(titre).join(' ')).toLowerCase())}">
        <div class="adm-tete"><div><b>${esc(c.nom || c.emails[0])}</b><div class="petit">${c.emails.map(esc).join(' · ')}${c.commandes.length ? ` · ${c.commandes.length} commande${c.commandes.length > 1 ? 's' : ''}` : ''}</div></div>
          <div class="rangee">${c.commandes.length ? `<button class="btn" data-suivi="${esc(c.cle)}">Échanges</button>` : ''}<button class="btn" data-mod="${esc(c.cle)}">Accès</button><button class="btn" data-lien="${esc(c.emails[0])}">Envoyer un lien</button><button class="btn" data-comme="${esc(c.emails[0])}">Voir comme ce client</button></div></div>
        ${c.arbres.length ? `<ul class="adm-arbres">${c.arbres.map(id => ligneArbre(id, c)).join('')}</ul>` : '<p class="petit">Aucun arbre ouvert à ce client.</p>'}</li>`).join('')}</ul>
      ${orphelins.length ? `<h2 class="sv-h2">Arbres sans client</h2><ul class="adm-arbres">${orphelins.map(a => ligneArbre(a.id, null)).join('')}</ul>` : ''}
      <form class="form-compte" id="fc"><b>Créer ou modifier un accès</b>
        <label class="etiq" for="fc-email">Adresse e-mail du client</label><input id="fc-email" type="email" required>
        <div class="cases">${arbres.map(a => `<label><input type="checkbox" value="${esc(a.id)}"> ${esc(a.titre)}</label>`).join('')}</div>
        <div class="rangee"><button class="btn btn-1" type="submit">Enregistrer</button><label><input type="checkbox" id="fc-lien"> envoyer aussi un lien d’accès</label><span class="note-ok" id="fc-ok" role="status"></span></div></form>`}</section></div></main>`;
  brancherBarre();
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => pageAdmin(b.dataset.t));
  $app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => ouvrirArbre(b.dataset.o, b.dataset.v));
  $app.querySelectorAll('[data-rl]').forEach(b => b.onclick = () => relecture(arbres.find(a => a.id === b.dataset.rl), true));
  $app.querySelectorAll('[data-or]').forEach(b => b.onclick = () => orientation(arbres.find(a => a.id === b.dataset.or), true));
  if (onglet === 'archiviste') ouvrirSuivi(document.getElementById('suivi'), S, arbres, {cleEmail, client: pageAdmin.client}).catch(e => { document.getElementById('suivi').innerHTML = `<p>Impossible de charger le suivi : ${esc(e.message || e)}</p>`; });
  pageAdmin.client = null;
  $app.querySelectorAll('[data-suivi]').forEach(b => b.onclick = () => { pageAdmin.client = b.dataset.suivi; pageAdmin('archiviste'); });
  const fl = $app.querySelector('#filtre');
  if (fl) fl.oninput = () => { const q = fl.value.toLowerCase(); $app.querySelectorAll('[data-f]').forEach(li => li.hidden = !li.dataset.f.includes(q)); };
  const fc = $app.querySelector('#fc');
  if (fc) {
    fc.onsubmit = async e => {
      e.preventDefault();
      const email = fc.querySelector('#fc-email').value.trim().toLowerCase(); if (!email) return;
      const choisis = [...fc.querySelectorAll('.cases input:checked')].map(i => i.value);
      const avant = (comptes.find(c => c.email === email) || {}).arbres || [];
      await S.majCompte(email, choisis, avant);
      if (fc.querySelector('#fc-lien').checked) await S.envoyerLienA(email);
      pageAdmin('clients');
    };
    $app.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => {
      const c = clients.find(x => x.cle === b.dataset.mod);
      const compte = comptes.find(x => cleEmail(x.email) === c.cle) || {email: c.emails[0], arbres: c.arbres};
      fc.querySelector('#fc-email').value = compte.email;
      fc.querySelectorAll('.cases input').forEach(i => i.checked = (compte.arbres || []).includes(i.value));
      fc.scrollIntoView({behavior: 'smooth'});
    });
    $app.querySelectorAll('[data-lien]').forEach(b => b.onclick = async () => { b.disabled = true; await S.envoyerLienA(b.dataset.lien); b.textContent = 'Lien envoyé'; });
    $app.querySelectorAll('[data-comme]').forEach(b => b.onclick = () => { vuComme = b.dataset.comme; accueil(); });
  }
}

// ---------------------------------------------------------------- démarrage
(async () => {
  try { S = DEV ? await sourceDev() : await sourceFirebase(); }
  catch (e) { console.error(e); $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}<h1>Un souci technique</h1><p>L’espace est momentanément indisponible. Réessayez dans quelques minutes, ou écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></div></main>`; return; }
  if (S.estLien()) { ecranEntrer(); }
  let premier = true;
  S.onUtilisateur(u => {
    U = u;
    if (!u) { if (!S.estLien()) ecranConnexion(); return; }
    if (premier || !arbreActif) { premier = false; accueil(); }
  });
})();
