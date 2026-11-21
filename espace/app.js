// Vos Racines : espace client (29/10/2026). Connexion par lien d'accès reçu par e-mail (Firebase Auth, lien généré sur HQ
// et envoyé par l'archiviste), arbres en lecture selon le compte, menu administrateur.
import {FIREBASE, EMULATEURS, CONTACT, VAPID} from './config.js';
import {creerArbre, nomComplet} from './arbre.js';
import {ouvrirRelecture, telechargerPdf, etatLivre} from './relecture.js';
import {ouvrirOrientation} from './orientation.js';
import {ouvrirSuivi} from './suivi.js';

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const DEV = params.get('dev');   // ?dev=client ou ?dev=admin : données locales (./dev/arbres), sans Firebase
const LOGO = `<a class="logo" href="./"><img src="../img/sceau-simple.svg" alt=""><span>Vos Racines</span></a>`;
const INSTALLEE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
// 18/11/2026 : le service worker est revérifié à chaque ouverture (icônes de notification, nouvelles versions)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => r.update()).catch(() => {});
const lire = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const ecrire = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };

// ---------------------------------------------------------------- source de données
// 09/11/2026 : ce qu'un lien de partage montre : les personnes et les familles de la version client, sans actes ni registre
function allege(x) {
  const P = {};
  for (const [k, p] of Object.entries(x.personnes || {})) { const q = {...p}; delete q.ac; delete q.no; delete q.src; P[k] = q; }
  return {personnes: P, familles: x.familles || []};
}
let S;   // {connexion, onUtilisateur, demanderLien, entrerParLien, estLien, compte, arbres, arbre, comptes, majCompte, sortir}
async function sourceFirebase() {
  const fb = await import('./vendor/firebase.js');
  const app = fb.initializeApp(FIREBASE), auth = fb.getAuth(app), db = fb.getFirestore(app);
  if (EMULATEURS) { fb.connectAuthEmulator(auth, `http://${location.hostname}:9099`, {disableWarnings: true}); fb.connectFirestoreEmulator(db, location.hostname, 8080); }
  await fb.setPersistence(auth, fb.browserLocalPersistence);
  const morceaux = async (id, quoi) => {
    const qs = await fb.getDocs(fb.collection(db, 'arbres', id, quoi));
    // 02/11/2026 (chantier 3) : a_valider = recherches familiales à valider, présentes dans la version admin seulement
    const out = {personnes: {}, familles: [], actes: [], registre: {}, a_valider: []};
    qs.docs.sort((a, b) => +a.id - +b.id).forEach(d => { let x = d.data(); if (typeof x.d === 'string') x = JSON.parse(x.d); Object.assign(out.personnes, x.personnes || {}); out.familles.push(...(x.familles || [])); out.actes.push(...(x.actes || [])); Object.assign(out.registre, x.registre || {}); out.a_valider.push(...(x.a_valider || [])); });
    return out;
  };
  return {
    onUtilisateur: cb => fb.onAuthStateChanged(auth, async u => {
      if (!u) return cb(null);
      const t = await u.getIdTokenResult();
      cb({email: (u.email || '').toLowerCase(), admin: !!t.claims.admin});
    }),
    demanderLien: email => fb.addDoc(fb.collection(db, 'demandes_acces'), {email, cree: fb.serverTimestamp()}),
    inscrire: (email, inscription) => fb.addDoc(fb.collection(db, 'demandes_acces'), {email, cree: fb.serverTimestamp(), inscription}),   // 17/11/2026 parcours gratuit
    estLien: (lien = location.href) => fb.isSignInWithEmailLink(auth, lien),
    entrerParLien: (email, lien = location.href) => fb.signInWithEmailLink(auth, email, lien),
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
    // 02/11/2026 (D1) : validation du bon à tirer par le client, puis PDF téléchargeable (morceaux base64 publiés depuis HQ)
    validation: async id => { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'validation', 'bat')); if (!d.exists()) return null; const x = d.data(); return {...x, quand: x.quand && x.quand.toDate ? x.quand.toDate().toISOString() : x.quand}; },
    abonnerPush: (id, sub) => fb.setDoc(fb.doc(db, 'push', id), {sub: JSON.stringify(sub), par: U.email, ua: navigator.userAgent.slice(0, 160), cree: fb.serverTimestamp()}),   // 18/11/2026
    valider: (id, version) => fb.setDoc(fb.doc(db, 'arbres', id, 'validation', 'bat'), {par: U.email, quand: fb.serverTimestamp(), version}),
    // 10/11/2026 (Laurent : une seule réouverture sans son accord) : on note la réouverture, puis on retire la validation
    reouvert: async id => (await fb.getDoc(fb.doc(db, 'arbres', id, 'validation', 'reouverture'))).exists(),
    devalider: async id => {
      await fb.setDoc(fb.doc(db, 'arbres', id, 'validation', 'reouverture'), {par: U.email, quand: fb.serverTimestamp()});
      await fb.deleteDoc(fb.doc(db, 'arbres', id, 'validation', 'bat'));
    },
    pdf: async (id, n, progres) => { const out = []; for (let k = 0; k < n; k++) { const d = await fb.getDoc(fb.doc(db, 'arbres', id, 'pdf', String(k))); if (!d.exists()) throw new Error('morceau ' + k + ' absent'); out.push(d.data().d); if (progres) progres(k + 1, n); } return out; },
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
    // 02/11/2026 (audit UX, G5) : chaque dossier garde l'heure de sa dernière écriture par HQ (champ maj du document)
    // 09/11/2026 (retour de Benjamin) : partage de l'arbre par un lien, sans compte, sans le livre ni les actes
    partager: async (meta, jours = 30) => {
      const a = new Uint8Array(18); crypto.getRandomValues(a);
      const j = Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
      const qs = await fb.getDocs(fb.collection(db, 'arbres', meta.id, 'client'));
      const morceaux = qs.docs.sort((x, y) => +x.id - +y.id).map(d => { let x = d.data(); if (typeof x.d === 'string') x = JSON.parse(x.d); return allege(x); });
      await fb.setDoc(fb.doc(db, 'partages', j), {arbre: meta.id, par: U.email, titre: meta.titre || '', sous_titre: meta.sous_titre || '', cree: fb.serverTimestamp(),
        expire: new Date(Date.now() + jours * 86400000), morceaux: morceaux.length});
      for (const [k, x] of morceaux.entries()) await fb.setDoc(fb.doc(db, 'partages', j, 'client', String(k)), {d: JSON.stringify(x)});
      return j;
    },
    mesPartages: async id => (await fb.getDocs(fb.query(fb.collection(db, 'partages'), fb.where('par', '==', U.email)))).docs
      .map(d => ({j: d.id, ...d.data()})).filter(x => x.arbre === id && x.expire && x.expire.toDate() > new Date()),
    arreterPartage: async j => {
      for (const d of (await fb.getDocs(fb.collection(db, 'partages', j, 'client'))).docs) await fb.deleteDoc(d.ref);
      await fb.deleteDoc(fb.doc(db, 'partages', j));
    },
    partage: async j => {
      const p = await fb.getDoc(fb.doc(db, 'partages', j)); if (!p.exists()) return null;
      const m = p.data(), out = {personnes: {}, familles: [], actes: [], registre: {}, a_valider: []};
      (await fb.getDocs(fb.collection(db, 'partages', j, 'client'))).docs.sort((a, b) => +a.id - +b.id)
        .forEach(d => { const x = JSON.parse(d.data().d); Object.assign(out.personnes, x.personnes || {}); out.familles.push(...(x.familles || [])); });
      return {...out, titre: m.titre, sous_titre: m.sous_titre, expire: m.expire && m.expire.toDate(), racine: '@1'};
    },
    // 18/11/2026 : visites du site (mesure d'audience de la page d'accueil), lecture admin
    visites: async depuis => (await fb.getDocs(fb.query(fb.collection(db, 'visites'), fb.where('cree', '>=', depuis)))).docs.map(d => { const x = d.data(); return {id: d.id, src: x.src || '', ref: x.ref || '', cree: x.cree && x.cree.toDate ? x.cree.toDate().toISOString() : ''}; }),
    suivis: async () => (await fb.getDocs(fb.collection(db, 'suivi'))).docs.filter(d => !d.id.startsWith('_')).map(d => ({...JSON.parse(d.data().d), maj: d.data().maj || ''})),
    travail: async () => { const d = await fb.getDoc(fb.doc(db, 'suivi', '_travail')); return d.exists() ? {...JSON.parse(d.data().d), maj: d.data().maj || ''} : null; },
    // 09/11 : une pièce jointe de mail (pj/{id}, morceaux base64) rendue en Blob
    pj: async id => {
      const m = await fb.getDoc(fb.doc(db, 'pj', id)); if (!m.exists()) throw new Error('pièce pas encore publiée par HQ (dix minutes au plus)');
      const x = m.data(), qs = await fb.getDocs(fb.collection(db, 'pj', id, 'm'));
      const b64 = qs.docs.sort((a, b) => +a.id - +b.id).map(d => d.data().d).join('');
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return {...x, blob: new Blob([u], {type: x.type || 'application/octet-stream'})};
    },
  };
}
let devRetours = [], devChoix = null, devDepots = [], devValidation = {};
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
    validation: async id => devValidation[id] || null,
    valider: async (id, version) => { devValidation[id] = {par: user.email, quand: new Date().toISOString(), version}; },
    reouvert: async id => !!(devValidation[id + ':r']),
    devalider: async id => { devValidation[id + ':r'] = true; delete devValidation[id]; },
    pdf: async (id, n, progres) => { const out = []; for (let k = 0; k < n; k++) { out.push(await (await fetch(`dev/pdf/${id}/${k}.txt`)).text()); if (progres) progres(k + 1, n); } return out; },
    ouvrirOrientationClient: async () => {},
    proposition: async id => { try { return await (await fetch(`dev/proposition/${id}.json`)).json(); } catch (e) { return null; } },
    choix: async () => devChoix, tousChoix: async () => devChoix ? [{email: user.email, ...devChoix}] : [],
    enregistrerChoix: async (id, e, x) => { devChoix = x; },
    mesDepots: async () => [...devDepots],
    deposer: async (id, m, parts) => { const x = {...m, id: 'd' + Date.now(), complet: true}; devDepots.push(x); return x.id; },
    supprimerDepot: async (id, did) => { devDepots = devDepots.filter(x => x.id !== did); },
    suivis: async () => { try { return await (await fetch('dev/suivi.json')).json(); } catch (e) { return []; } },
    travail: async () => { try { return await (await fetch('dev/travail.json')).json(); } catch (e) { return null; } },
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
// 17/11/2026 (parcours gratuit, feu vert de Laurent) : on commence sans payer ; le lien reçu par e-mail confirme l'adresse,
// puis l'archiviste écrit. L'arbre généalogique s'ouvre à une dizaine d'ancêtres ; la suite (recherches complètes, livre) est payante.
function ecranInscription(erreur = '', v = {}) {
  document.title = 'Commencer gratuitement · Vos Racines';
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Commencer gratuitement</h1>
    <p class="sous">Nous commençons l’arbre généalogique de votre famille, sans engagement. Dès qu’il compte une dizaine d’ancêtres sur quatre générations, il s’ouvre dans votre espace.</p>
    <form novalidate>
      <label class="etiq" for="prenom">Votre prénom</label>
      <input id="prenom" type="text" autocomplete="given-name" maxlength="60" value="${esc(v.prenom || '')}">
      <label class="etiq" for="email">Votre adresse e-mail</label>
      <input id="email" type="email" autocomplete="email" inputmode="email" maxlength="190" value="${esc(v.email || lire('vr-email') || '')}" ${erreur ? 'class="erreur" aria-invalid="true"' : ''}>
      <fieldset class="choix"><legend class="etiq">Pour qui ?</legend>
        <label><input type="radio" name="pourqui" value="moi" ${v.pourqui !== 'offrir' ? 'checked' : ''}> Ma famille</label>
        <label><input type="radio" name="pourqui" value="offrir" ${v.pourqui === 'offrir' ? 'checked' : ''}> La famille d’un proche, pour lui offrir</label>
      </fieldset>
      <div id="dest" ${v.pourqui === 'offrir' ? '' : 'hidden'}><label class="etiq" for="dest_prenom">Son prénom</label>
        <input id="dest_prenom" type="text" maxlength="40" value="${esc(v.dest_prenom || '')}"></div>
      <p class="msg-erreur" id="err" role="alert">${esc(erreur)}</p>
      <button class="btn btn-1" type="submit">Commencer</button>
    </form>
    <p class="petit" style="margin-top:12px">Vous recevez un e-mail de confirmation. Ensuite, notre archiviste vous écrit pour rassembler ce que vous savez de la famille. Pour aller plus loin (les recherches complètes et le livre, 49 €), vous déciderez une fois l’arbre vu.</p>
    <div class="pied-porte">Déjà client ? <a href="./">Entrer dans mon espace</a></div>
  </div></main>`;
  const f = $app.querySelector('form'), val = () => ({prenom: f.querySelector('#prenom').value.trim(), email: f.querySelector('#email').value.trim().toLowerCase(),
    pourqui: (f.querySelector('input[name=pourqui]:checked') || {}).value || 'moi', dest_prenom: f.querySelector('#dest_prenom').value.trim()});
  f.querySelectorAll('input[name=pourqui]').forEach(r => r.onchange = () => { $app.querySelector('#dest').hidden = val().pourqui !== 'offrir'; });
  f.addEventListener('submit', async e => {
    e.preventDefault(); const x = val();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email) || /[^\x21-\x7e]/.test(x.email)) return ecranInscription('Cette adresse e-mail ne semble pas complète (sans accent ni espace, avec un @ et un point).', x);
    f.querySelector('button').disabled = true;
    try { await S.inscrire(x.email, {prenom: x.prenom.slice(0, 60), pourqui: x.pourqui, dest_prenom: x.pourqui === 'offrir' ? x.dest_prenom.slice(0, 40) : ''}); }
    catch (err) { console.warn(err); return ecranInscription('L’inscription n’a pas pu partir. Réessayez dans un instant, ou écrivez-nous.', x); }
    ecrire('vr-email', x.email); ecranEnvoye(x.email, true);
  });
}
function ecranEnvoye(email, inscription = false) {
  $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}
    <h1>Regardez votre boîte mail</h1>
    ${inscription ? `<p>Un e-mail de confirmation vient de partir à <b>${esc(email)}</b>. Ouvrez-le et cliquez sur « Confirmer mon inscription » : notre archiviste vous écrit juste après.</p>`
      : `<p>Si l’adresse <b>${esc(email)}</b> est bien celle de votre livre, un e-mail de Vos Racines vient de partir. Ouvrez-le et cliquez sur le bouton « Ouvrir mon espace » : il vous fera entrer directement. Ce lien ne sert qu’une fois.</p>`}
    <div class="encart"><b>Vous ne voyez rien ?</b>L’e-mail peut mettre une ou deux minutes à arriver. Vérifiez aussi le dossier « Courrier indésirable » ou « Spam ». Si vous n’avez toujours rien, vous pouvez demander un nouveau lien.</div>
    ${INSTALLEE ? `<form id="coller" novalidate><label class="etiq" for="lien">Vous utilisez l’application : dans l’e-mail, copiez le lien du bouton (appui long sur « Ouvrir mon espace », puis « Copier le lien ») et collez-le ici.</label>
      <input id="lien" type="url" inputmode="url" autocomplete="off" placeholder="https://…">
      <p class="msg-erreur" role="alert"></p><button class="btn btn-1" type="submit">Entrer avec ce lien</button></form>` : ''}
    <div class="rangee"><button class="btn" id="renvoi" disabled>Renvoyer le lien</button><button class="btn-lien" id="autre">Utiliser une autre adresse</button></div>
    <div class="pied-porte">Toujours bloqué ? <a href="mailto:${CONTACT}">${CONTACT}</a></div>
  </div></main>`;
  const r = $app.querySelector('#renvoi'); let n = 60;
  const t = setInterval(() => { n--; r.textContent = n > 0 ? `Renvoyer le lien (dans ${n} s)` : 'Renvoyer le lien'; if (n <= 0) { r.disabled = false; clearInterval(t); } }, 1000);
  r.textContent = `Renvoyer le lien (dans ${n} s)`;
  r.onclick = async () => { r.disabled = true; try { await S.demanderLien(email); } catch (e) {} ecranEnvoye(email); };
  $app.querySelector('#autre').onclick = () => { clearInterval(t); ecrire('vr-email', null); ecranConnexion(); };
  const fc = $app.querySelector('#coller');
  if (fc) fc.addEventListener('submit', async e => {
    e.preventDefault();
    const lien = fc.querySelector('#lien').value.trim(), m = fc.querySelector('.msg-erreur');
    if (!S.estLien(lien)) { m.textContent = 'Ce n’est pas le bon lien : copiez celui du bouton « Ouvrir mon espace » dans l’e-mail.'; return; }
    try { await S.entrerParLien(email, lien); clearInterval(t); }
    catch (err) { console.warn(err); m.textContent = 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.'; }
  });
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
// 16/11/2026 (Laurent) : « précédent » revient à la page précédente au lieu de quitter l'appli.
// Chaque page s'inscrit dans l'historique ; popstate la reconstruit.
let restauration = false, cleCourante = null;
const cleEtat = st => st && st.p ? [st.p, st.id || '', st.v || '', st.o || '', st.vc || ''].join('|') : null;
function marquer(etat) {
  etat = {...etat, vc: vuComme || ''};
  const k = cleEtat(etat);
  if (restauration) { cleCourante = k; return; }
  if (k === cleCourante) return;
  if (cleCourante === null) history.replaceState(etat, ''); else history.pushState(etat, '');
  cleCourante = k;
}
addEventListener('popstate', async e => {
  const st = e.state || {};
  if (cleEtat(st) === cleCourante) { const f = document.querySelector('.fiche:not([hidden]) .fermer'); if (f && !st.fiche) f.click(); return; }
  if (!st.p || !U || restauration) return;
  restauration = true;
  try {
    vuComme = st.vc || null;
    if (st.p === 'admin') await pageAdmin(st.o);
    else if (st.p === 'accueil') { arbreActif = null; await accueil(); }
    else if (st.p === 'arbre') await ouvrirArbre(st.id, st.v);
    else {
      const m = await S.meta(st.id); if (!m) return accueil();
      if (m.livre && m.livre.etape === 'bat') m.validation = await S.validation(st.id).catch(() => null);
      if (st.p === 'relire') await relecture(m, !!st.adm);
      else if (st.p === 'orienter') await orientation(m, !!st.adm);
      else if (st.p === 'partage') await pagePartage(m);
    }
  } catch (x) { console.error(x); } finally { restauration = false; }
});
function barre(titre = '', selecteur = '') {
  const prenom = U.prenom || '';
  return `<header class="barre">${LOGO}<div class="titre-livre">${esc(titre)}</div>${selecteur}
    <div class="menu-compte"><button aria-expanded="false" aria-haspopup="true">${prenom ? 'Bonjour ' + esc(prenom) : 'Mon compte'} ▾</button>
    <ul hidden>
      <li><button data-m="livres">${U.admin ? 'Tous les arbres' : 'Vos livres'}</button></li>
${U.admin ? `<li><button data-m="notif">${'Notification' in window && Notification.permission === 'granted' ? 'Notifications : actives' : 'Activer les notifications'}</button></li>` : ''}
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
    if (a === 'notif') activerNotifications(x);   // 18/11/2026 (Laurent : dans le menu, plus discret)
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
  // 02/11/2026 (D1) : un bon à tirer validé donne le PDF, même si la relecture a été refermée
  await Promise.all(metas.filter(m => m.livre && m.livre.etape === 'bat').map(async m => { m.validation = await S.validation(m.id).catch(() => null); }));
  const relire = m => m.livre && (m.relecture || U.admin);
  const orienter = m => m.orientation || (U.admin && m.proposition);
  const pdfPret = m => m.validation && m.livre && m.livre.pdf && m.livre.pdf.morceaux > 0;
  const libRelire = m => m.livre && m.livre.etape === 'bat' ? (m.validation ? 'Revoir le livre validé' : 'Relire le bon à tirer') : m.livre && m.livre.etape === 'premier_jet' ? 'Feuilleter le premier jet' : 'Relire le livre';
  if (metas.length === 1 && !vuComme && !relire(metas[0]) && !orienter(metas[0]) && !pdfPret(metas[0])) return ouvrirArbre(metas[0].id, 'client');
  marquer({p: 'accueil'});
  document.title = 'Vos livres · Vos Racines';
  $app.innerHTML = barre() + `<main class="page"><h1>Vos livres</h1>
    ${metas.length ? `<div class="grille">${metas.map(m => `<article class="livre"><h2>${esc(m.titre)}</h2><p class="st">${esc(m.sous_titre || '')}</p>
      <div class="chiffres"><div><b>${m.n_ancetres || 0}</b><span>ancêtres</span></div><div><b>${m.n_personnes || 0}</b><span>personnes</span></div><div><b>${m.generations || 0}</b><span>générations</span></div></div>
      <div class="rangee"><button class="btn btn-1" data-o="${esc(m.id)}">Ouvrir l’arbre</button>${!vuComme ? `<button class="btn" data-partager="${esc(m.id)}">Partager l’arbre</button>` : ''}${orienter(m) ? `<button class="btn btn-2" data-orienter="${esc(m.id)}">Orienter mon livre</button>` : ''}${relire(m) ? `<button class="btn" data-relire="${esc(m.id)}">${libRelire(m)}</button>` : ''}${pdfPret(m) ? `<button class="btn btn-1" data-pdf="${esc(m.id)}">Télécharger le livre (PDF)</button>` : ''}</div>
      ${m.validation ? `<p class="maj">Validé pour l’impression le ${esc(dateFr(m.validation.quand))}.</p>` : ''}
      <p class="maj">Mis à jour le ${esc(dateFr(m.maj))}</p></article>`).join('')}</div>`
    : c.inscription ? `<p><b>Votre inscription est confirmée.</b> Notre archiviste vous écrit par e-mail pour rassembler ce que vous savez de la famille. Votre arbre généalogique apparaîtra ici dès qu’il comptera une dizaine d’ancêtres.</p><p>Une question ? <a href="mailto:${CONTACT}">${CONTACT}</a></p>`
    : `<p>Votre arbre n’est pas encore en ligne. Nous vous écrirons dès qu’il le sera. Une question ? <a href="mailto:${CONTACT}">${CONTACT}</a></p>`}</main>`;
  brancherBarre();
  $app.querySelectorAll('[data-o]').forEach(b => b.onclick = () => ouvrirArbre(b.dataset.o, 'client'));
  $app.querySelectorAll('[data-relire]').forEach(b => b.onclick = () => relecture(metas.find(m => m.id === b.dataset.relire), false));
  $app.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => telechargerPdf(metas.find(m => m.id === b.dataset.pdf), S, b));
  $app.querySelectorAll('[data-orienter]').forEach(b => b.onclick = () => orientation(metas.find(m => m.id === b.dataset.orienter), false));
  $app.querySelectorAll('[data-partager]').forEach(b => b.onclick = () => pagePartage(metas.find(m => m.id === b.dataset.partager)));
}

// 09/11/2026 (retour de Benjamin : « cela m'aurait été utile de pouvoir partager l'arbre pour demander une vérification ») :
// un lien en lecture seule, sans compte, valable 30 jours, sans le livre ni les actes ; arrêt possible à tout moment.
async function pagePartage(meta) {
  marquer({p: 'partage', id: meta.id});
  arbreActif = {id: meta.id, version: 'partage'};
  document.title = `Partager ${meta.titre} · Vos Racines`;
  const lienDe = j => `${location.origin}${location.pathname}?partage=${j}`;
  const rendre = async (nouveau = '') => {
    const liste = await S.mesPartages(meta.id).catch(() => []);
    $app.innerHTML = barre(meta.titre) + `<main class="page partage"><h1>Partager l’arbre</h1>
      <p>Pour faire vérifier les premières générations par un proche, envoyez-lui un lien : il verra l’arbre en lecture seule, sans créer de compte.</p>
      <ul class="petit"><li>Le lien montre l’arbre seulement : ni le livre, ni les actes, ni vos choix.</li><li>Les personnes vivantes y apparaissent comme dans votre espace, sans date ni lieu.</li><li>Toute personne qui a le lien peut voir l’arbre pendant 30 jours ; vous pouvez l’arrêter quand vous voulez.</li>${meta.livre ? '<li>Si le livre est une surprise, choisissez bien à qui vous envoyez le lien : le titre de l’arbre s’affiche.</li>' : ''}</ul>
      ${nouveau ? `<div class="note"><label for="pt-lien"><b>Votre lien</b></label><div class="rangee"><input id="pt-lien" readonly value="${esc(lienDe(nouveau))}"><button class="btn btn-1" id="pt-copier">Copier le lien</button></div></div>` : ''}
      <div class="rangee"><button class="btn${nouveau ? '' : ' btn-1'}" id="pt-creer">Créer un lien de partage</button><button class="btn" id="pt-retour">Retour à mes livres</button></div>
      ${liste.length ? `<h2>Liens en cours</h2><ul class="pt-liste">${liste.map(x => `<li><code>…${esc(x.j.slice(-6))}</code> · valable jusqu’au ${esc(dateFr(x.expire.toDate()))} <button class="btn" data-copier="${esc(x.j)}">Copier</button> <button class="btn" data-arreter="${esc(x.j)}">Arrêter ce partage</button></li>`).join('')}</ul>` : ''}</main>`;
    brancherBarre();
    $app.querySelector('#pt-retour').onclick = () => accueil();
    $app.querySelector('#pt-creer').onclick = async e => { e.target.disabled = true; e.target.textContent = 'Création du lien…';
      try { rendre(await S.partager(meta)); } catch (x) { console.error(x); e.target.disabled = false; e.target.textContent = 'Le lien n’a pas pu être créé, réessayer'; } };
    const copier = async (t, b) => { try { await navigator.clipboard.writeText(t); b.textContent = 'Copié'; } catch (x) { const i = $app.querySelector('#pt-lien'); if (i) i.select(); } };
    const c = $app.querySelector('#pt-copier'); if (c) c.onclick = () => copier(lienDe(nouveau), c);
    $app.querySelectorAll('[data-copier]').forEach(b => b.onclick = () => copier(lienDe(b.dataset.copier), b));
    $app.querySelectorAll('[data-arreter]').forEach(b => b.onclick = async () => { b.disabled = true; await S.arreterPartage(b.dataset.arreter); rendre(); });
  };
  rendre();
}

// Page publique d'un lien de partage : pas de connexion, l'arbre en lecture seule
async function ouvrirPartage(j) {
  $app.innerHTML = '<div class="chargement">Chargement de l’arbre…</div>';
  let d = null;
  try { d = await S.partage(j); } catch (e) { console.error(e); }
  if (!d) { $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}<h1>Ce lien n’est plus valable</h1><p>Le partage a été arrêté ou a expiré. Demandez un nouveau lien à la personne qui vous l’a envoyé.</p></div></main>`; return; }
  document.title = `${d.titre} · Vos Racines`;
  $app.innerHTML = `<header class="barre">${LOGO}<span class="titre-livre">${esc(d.titre)}</span></header>
    <div class="bandeau-admin bandeau-partage">Arbre partagé en lecture seule${d.expire ? `, jusqu’au ${esc(dateFr(d.expire))}` : ''}. Réalisé par <a href="https://vosracines.fr" target="_blank" rel="noopener">Vos Racines</a>.</div><div id="arbre"></div>`;
  creerArbre(document.getElementById('arbre'), d, {admin: false, image: null, partage: true});
}
async function orientation(meta, admin) {
  marquer({p: 'orienter', id: meta.id, adm: !!admin});
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
  marquer({p: 'relire', id: meta.id, adm: !!admin});
  arbreActif = {id: meta.id, version: 'relecture'};
  document.title = `Relire ${meta.titre} · Vos Racines`;
  $app.innerHTML = barre(meta.titre) + '<div id="relecture"></div>';
  brancherBarre();
  ouvrirRelecture(document.getElementById('relecture'), meta, S, U, {admin});
}
const dateFr = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', year: 'numeric'}); };

async function ouvrirArbre(id, version) {
  marquer({p: 'arbre', id, v: version});
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
// 18/11/2026 (conseil de Paul après 500 flyers) : chaque jour, visiteurs uniques de la page d'accueil, adresses récupérées
// (inscriptions gratuites reçues, comptes.inscription.demande) et taux de transformation = adresses / visiteurs.
// 19/11/2026 (Laurent : « un graphe serait mieux qu'un tableau ») : barres groupées par jour depuis le début de la mesure, tableau replié dessous.
function dessinerVisites(el, visites, comptes) {
  const jp = d => new Intl.DateTimeFormat('fr-CA', {timeZone: 'Europe/Paris'}).format(d);
  const DEBUT = '2026-11-18', V = {}, A = {}, F = {}, src = {};
  const nomSrc = x => ({direct: 'accès direct', 'com.google.android.googlequicksearchbox': 'Google (appli)', 'com.google.android.gm': 'Gmail'}[x]
    || (/(^|\.)google\./.test(x) ? 'Google' : /facebook/.test(x) ? 'Facebook' : /instagram/.test(x) ? 'Instagram' : /flyer|bal|qr|papier/.test(x) ? 'flyer' : x));
  for (const v of visites) { const j = String(v.id).slice(0, 10); V[j] = (V[j] || 0) + 1; if (/flyer|bal|qr|papier/.test(v.src)) F[j] = (F[j] || 0) + 1; const k = nomSrc(v.src || 'direct'); src[k] = (src[k] || 0) + 1; }
  for (const c of comptes) { const d = c.inscription && c.inscription.demande; if (d) { const j = String(d).slice(0, 10); A[j] = (A[j] || 0) + 1; } }
  const jours = []; for (let t = Date.now(); jours.length < 30; t -= 864e5) { const j = jp(new Date(t)); if (j < DEBUT) break; jours.unshift(j); }
  const tot = k => jours.reduce((n, j) => n + (k[j] || 0), 0), TV = tot(V), TA = tot(A);
  const pct = (a, v) => v ? (100 * a / v).toLocaleString('fr-FR', {maximumFractionDigits: 1}) + '\u00a0%' : '';
  const lib = (j, long) => new Date(j + 'T12:00:00').toLocaleDateString('fr-FR', long ? {weekday: 'short', day: 'numeric', month: 'short'} : {day: 'numeric', month: 'numeric'});
  const sources = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, n]) => `${esc(s)} ${n}`).join(' · ');
  // graphe : une seule échelle (des personnes), visiteurs en ocre, adresses en brique, valeur écrite au-dessus de chaque barre
  const W = Math.round(Math.max(320, Math.min(640, el.clientWidth || 640))), H = 210, G = 30, B = 26, HAUT = 18, n = jours.length, pw = W - G - 6, slot = pw / n;
  const bw = Math.max(6, Math.min(22, slot * 0.32)), max = Math.max(4, ...jours.map(j => V[j] || 0));
  const pas = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : max <= 60 ? 10 : 25, haut = Math.ceil(max / pas) * pas;
  const Y = v => H - B - v / haut * (H - B - HAUT);
  const barre = (x, v, cl) => { if (!v) return ''; const y = Y(v), h = H - B - y, r = Math.min(4, bw / 2, h);
    return `<path class="${cl}" d="M${x.toFixed(1)} ${H - B} V${(y + r).toFixed(1)} Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y + r).toFixed(1)} V${H - B}Z"/>`
      + `<text class="vs-val" x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}">${v}</text>`; };
  let grille = ''; for (let v = pas; v <= haut; v += pas) grille += `<line class="vs-grille" x1="${G}" x2="${W - 6}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="vs-axe" x="${G - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
  const tous = n <= 10 ? 1 : Math.ceil(n / 8);
  const groupes = jours.map((j, k) => { const x0 = G + k * slot + slot / 2 - bw - 1;
    return `<g class="vs-jour" data-k="${k}"><rect class="vs-cible" x="${(G + k * slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${H}"/>${barre(x0, V[j] || 0, 'vs-v')}${barre(x0 + bw + 2, A[j] || 0, 'vs-a')}`
      + ((n - 1 - k) % tous ? '' : `<text class="vs-axe" x="${(G + k * slot + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(lib(j))}</text>`) + '</g>'; }).join('');
  el.innerHTML = `<h2 class="sv-h2">Visites du site</h2>
    <p class="vs-tete"><b>${TV}</b> visiteur${TV > 1 ? 's' : ''} et <b>${TA}</b> adresse${TA > 1 ? 's' : ''} reçue${TA > 1 ? 's' : ''} depuis le 18/11${TV ? ` : taux de transformation <b>${pct(TA, TV)}</b>` : ''}</p>
    <p class="vs-legende"><span><i class="vs-v"></i>Visiteurs uniques (page d'accueil)</span><span><i class="vs-a"></i>Adresses reçues (inscription gratuite)</span></p>
    <div class="vs-graphe"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visiteurs et adresses par jour depuis le 18 novembre">${grille}<line class="vs-base" x1="${G}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/>${groupes}</svg><div class="vs-bulle" hidden></div></div>
    ${sources ? `<p class="petit">Sources des visites : ${sources}.</p>` : ''}
    <details class="vs-detail"><summary>Voir le tableau</summary><table class="adm-visites"><thead><tr><th>Jour</th><th>Visiteurs</th><th>dont flyer</th><th>Adresses</th><th>Taux</th></tr></thead><tbody>
    ${jours.slice().reverse().map(j => `<tr><td>${esc(lib(j, 1))}</td><td>${V[j] || 0}</td><td>${F[j] || 0}</td><td>${A[j] || 0}</td><td>${pct(A[j] || 0, V[j] || 0)}</td></tr>`).join('')}
    </tbody></table></details>`;
  const g = el.querySelector('.vs-graphe'), bulle = g.querySelector('.vs-bulle'), svg = g.querySelector('svg');
  g.querySelectorAll('.vs-jour').forEach(gr => {
    const k = +gr.dataset.k, j = jours[k];
    const montrer = () => { g.querySelectorAll('.vs-jour').forEach(x => x.classList.toggle('actif', x === gr));
      bulle.innerHTML = `<b>${esc(lib(j, 1))}</b><br>${V[j] || 0} visiteur${(V[j] || 0) > 1 ? 's' : ''}${F[j] ? `, dont ${F[j]} flyer` : ''}<br>${A[j] || 0} adresse${(A[j] || 0) > 1 ? 's' : ''}${V[j] ? ` · taux ${pct(A[j] || 0, V[j])}` : ''}`;
      bulle.hidden = false; const r = svg.getBoundingClientRect(), cx = (G + (k + .5) * slot) / W * r.width;
      bulle.style.left = Math.max(0, Math.min(r.width - bulle.offsetWidth, cx - bulle.offsetWidth / 2)) + 'px'; };
    gr.addEventListener('pointerenter', montrer); gr.addEventListener('pointerdown', montrer);
  });
  g.addEventListener('pointerleave', () => { bulle.hidden = true; g.querySelectorAll('.vs-jour').forEach(x => x.classList.remove('actif')); });
}
// 16/11/2026 (Laurent) : en haut de l'admin, les indicateurs dans le temps (cumul jour par jour).
// Inscriptions = commandes reçues (codes promo compris) ; clients = commandes payées avec un montant ; livres finis = bons à tirer validés ;
// chiffre d'affaires = montants payés (Stripe, en centimes dans commande.json). Une petite courbe par indicateur, pas d'axe double.
function dessinerKpis(el, suivis, arbres) {
  const jour = d => { const t = typeof d === 'number' ? (d < 1e12 ? d * 1000 : d) : Date.parse(d); return isNaN(t) ? null : new Date(new Date(t).toDateString()).getTime(); };
  const paye = x => x.paiement === 'paid' && (+x.montant || 0) > 0;
  const series = [
    ['Inscriptions', suivis.map(x => [jour(x.cree), 1]), v => String(v)],
    ['Clients payants', suivis.filter(paye).map(x => [jour(x.cree), 1]), v => String(v)],
    ['Livres finis', arbres.filter(a => a.validation && a.validation.quand).map(a => [jour(a.validation.quand), 1]), v => String(v)],
    ['Chiffre d’affaires', suivis.filter(paye).map(x => [jour(x.cree), (+x.montant || 0) / 100]), v => v.toLocaleString('fr-FR', {maximumFractionDigits: 0}) + ' €'],
  ].map(([t, ev, f]) => [t, ev.filter(e => e[0] !== null), f]);
  const tous = series.flatMap(s => s[1].map(e => e[0])); if (!tous.length) { el.hidden = true; return; }
  const J = 864e5, fin = jour(Date.now()), debut = Math.min(...tous) - J, n = Math.round((fin - debut) / J) + 1;
  const W = 300, H = 64, X = i => i / Math.max(1, n - 1) * W;
  const date = i => new Date(debut + i * J + J / 2).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'});
  el.innerHTML = series.map(([t, ev, f], k) => {
    const pas = new Array(n).fill(0); ev.forEach(e => { const i = Math.round((e[0] - debut) / J); if (i >= 0 && i < n) pas[i] += e[1]; });   // arrondi : les changements d'heure font des jours de 23 ou 25 h
    const cum = []; let c = 0; for (let i = 0; i < n; i++) { c += pas[i]; cum.push(c); }
    const max = Math.max(1, ...cum), Y = v => H - 3 - v / max * (H - 8);
    let d = `M0 ${Y(cum[0]).toFixed(1)}`; cum.forEach((v, i) => { if (i) d += ` H${X(i).toFixed(1)} V${Y(v).toFixed(1)}`; });
    const sem = cum[n - 1] - cum[Math.max(0, n - 8)];
    el._cum = el._cum || []; el._cum[k] = cum;
    return `<figure class="kpi" data-k="${k}"><figcaption>${esc(t)}</figcaption><b>${esc(f(cum[n - 1]))}</b><span class="petit">${sem ? '+' + esc(f(sem)) + ' en 7 jours' : 'rien en 7 jours'}</span>
      <div class="kpi-g"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t)} : ${esc(f(cum[n - 1]))} au ${esc(date(n - 1))}">
        <path d="${d} V${H} H0Z" class="kpi-aire"/><path d="${d}" class="kpi-ligne"/><line class="kpi-curseur" x1="0" x2="0" y1="0" y2="${H}" hidden/></svg>
        <div class="kpi-bulle" hidden></div></div><div class="kpi-axe petit"><span>${esc(date(0))}</span><span>aujourd’hui</span></div></figure>`;
  }).join('');
  el.querySelectorAll('.kpi').forEach(fg => {
    const k = +fg.dataset.k, g = fg.querySelector('.kpi-g'), svg = g.querySelector('svg'), cur = svg.querySelector('.kpi-curseur'), bulle = g.querySelector('.kpi-bulle'), f = series[k][2];
    const montrer = e => { const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1))));
      cur.setAttribute('x1', X(i)); cur.setAttribute('x2', X(i)); cur.hidden = false; bulle.hidden = false;
      bulle.textContent = `${date(i)} : ${f(el._cum[k][i])}`; const px = i / Math.max(1, n - 1) * r.width; bulle.style.left = Math.max(0, Math.min(r.width - bulle.offsetWidth, px - bulle.offsetWidth / 2)) + 'px'; };
    g.addEventListener('pointermove', montrer); g.addEventListener('pointerdown', montrer);
    g.addEventListener('pointerleave', () => { cur.hidden = true; bulle.hidden = true; });
  });
}
// 17/11/2026 (Laurent) : en haut de l'admin, les deux ou trois arbres sur lesquels l'archiviste travaille, et la file ; pas le détail.
function blocTravail(t) {
  if (!t) return '';
  const h = x => String(x || '').slice(11, 16);
  const ligne = e => e.quoi === 'recherche' ? `<li><b>${esc(e.arbre || e.qui)}</b>${e.arbre && e.qui && !e.arbre.includes(e.qui) ? ` <span class="petit">(${esc(e.qui)})</span>` : ''}<span class="petit">${e.passe ? ` · passe ${esc(e.passe)} sur ${esc(e.sur)}` : ''}${e.depuis ? ` · depuis ${esc(h(e.depuis))}` : ''}</span></li>`
    : e.quoi === 'livre' ? `<li><b>Livre : ${esc(e.livre)}</b> <span class="petit">(nouvelle version)</span></li>` : `<li><b>${esc(e.qui)}</b></li>`;
  const suite = (t.file || []).slice(0, 4).map(e => `<li>${esc(e.arbre || e.qui)}${e.arbre && e.qui && !e.arbre.includes(e.qui) ? ` <span class="petit">(${esc(e.qui)})</span>` : ''}${e.reprise ? ` <span class="petit">· vers ${esc(e.reprise)}</span>` : ''}</li>`).join('');
  return `<section class="travail"><div><h2>En ce moment</h2>${(t.en_cours || []).length ? `<ul>${t.en_cours.map(ligne).join('')}</ul>` : '<p class="petit">L’archiviste ne cherche rien en ce moment.</p>'}</div>
    <div><h2>Ensuite</h2>${suite ? `<ol>${suite}</ol>` : '<p class="petit">Rien en attente.</p>'}${(t.sommeil || []).length ? `<p class="petit">En sommeil, en attente de faits nouveaux : ${t.sommeil.map(e => esc(e.arbre || e.qui)).join(', ')}</p>` : ''}${(t.plafond || []).length ? `<p class="petit">Plafond de passes atteint pour cette version : ${t.plafond.map(e => esc(e.arbre || e.qui)).join(', ')}</p>` : ''}</div>
    <p class="petit maj-travail">Mis à jour à ${esc(h(t.maj))}</p></section>`;
}
// 18/11/2026 (Laurent : notifications dans l'appli Vos Racines) : abonnement Web Push de cet appareil, gardé dans Firestore
// (collection « push », administrateur seul) ; HQ envoie avec notifier.py. Sur iPhone, l'application doit être installée.
async function activerNotifications(b) {
  const dire = t => { b.textContent = t; };
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return dire('Notifications impossibles ici (sur iPhone : installer l’application d’abord)');
    if (await Notification.requestPermission() !== 'granted') return dire('Notifications refusées dans le navigateur');
    const reg = await navigator.serviceWorker.ready;
    const cle = Uint8Array.from(atob(VAPID.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: cle});
    const j = sub.toJSON(), h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(j.endpoint));
    await S.abonnerPush([...new Uint8Array(h)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''), j);
    dire('Notifications : actives sur cet appareil');
  } catch (e) { console.warn(e); dire('Échec : ' + (e.message || e)); }
}
async function pageAdmin(onglet) {
  if (onglet === 'arbres') onglet = 'clients';
  marquer({p: 'admin', o: onglet});
  document.title = 'Administration · Vos Racines';
  const [arbres, comptes, suivis, travail, visites] = await Promise.all([S.tousArbres(), S.comptes(), S.suivis ? S.suivis().catch(() => []) : [], S.travail ? S.travail().catch(() => null) : null, S.visites ? S.visites(new Date(Date.now() - 31 * 864e5)).catch(e => { console.warn(e); return []; }) : []]);
  // 02/11/2026 (D1) : étape du livre et validation du bon à tirer, visibles dans l'onglet Clients
  await Promise.all(arbres.filter(a => a.livre && a.livre.etape === 'bat').map(async a => { a.validation = await S.validation(a.id).catch(() => null); }));
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
  // 17/11/2026 (Laurent : « ré-attribuer les arbres sans client ») : l'arbre de travail d'une commande (cmd-<prénom>-<6 derniers caractères de la commande>)
  // va au client de cette commande, même quand il n'en est pas lecteur (il voit l'arbre de son livre).
  for (const a of arbres) {
    const m = /^cmd-.*-([a-z0-9]{6})$/.exec(a.id); if (!m) continue;
    const s = suivis.find(x => String(x.court || '').toLowerCase() === m[1]); const em = s && (s.emails || [])[0];
    if (em) groupe(em).arbres.add(a.id);
  }
  const clients = [...G.values()].map(g => ({...g, emails: [...g.emails], arbres: [...g.arbres], nom: [...g.noms].sort((x, y) => y.length - x.length)[0] || ''}))
    .sort((a, b) => (b.commandes.length ? 1 : 0) - (a.commandes.length ? 1 : 0) || a.cle.localeCompare(b.cle));
  // 21/11/2026 (Laurent) : deux clients au même prénom se distinguent par les premières lettres du nom de famille (« Stéphane M. », « Stéphane C. »)
  const sansAcc = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const premierMot = t => String(t || '').trim().split(/[\s,]+/)[0];
  const familleDe = c => { const f = c.commandes.map(s => s.famille).find(Boolean); if (f) return f;
    const pr = sansAcc(premierMot(c.nom));
    for (const e of c.emails) { const t = sansAcc(e.split('@')[0]).split(/[._+-]/).map(x => x.replace(/\d+$/, ''));
      if (t.length < 2) continue;
      const r = t.filter(x => x.length > 1 && x !== pr && !pr.startsWith(x)); if (r.length) return r[0][0].toUpperCase() + r[0].slice(1); }
    return ''; };
  const parPrenom = new Map();
  for (const c of clients) { const p = sansAcc(premierMot(c.nom)); if (p) { if (!parPrenom.has(p)) parPrenom.set(p, []); parPrenom.get(p).push(c); } }
  for (const L of parPrenom.values()) { if (L.length < 2) continue;
    const F = L.map(familleDe);
    L.forEach((c, i) => { const f = F[i]; if (!f) return; const autres = F.filter((x, j) => j !== i && x).map(sansAcc);
      let k = 1; while (k < f.length && autres.some(x => x.startsWith(sansAcc(f.slice(0, k))))) k++;
      c.nom = `${premierMot(c.nom)} ${f.slice(0, k)}${k < f.length ? '.' : ''}`; }); }
  const avecClient = new Set(clients.flatMap(c => c.arbres));
  const orphelins = arbres.filter(a => !avecClient.has(a.id));
  const titre = id => (arbres.find(a => a.id === id) || {}).titre || id;
  // 16/11/2026 (Laurent) : une ligne par fiche ; le détail et les actions passent dans le menu « ⋯ » (21/11 : « Ouvrir » aussi)
  const court = a => { if (!a) return 'aucun arbre'; const L = a.livre || {}, v = L.version ? ' ' + L.version : '';
    if (L.etape === 'bat') return a.validation ? `BAT${v} validé` : `BAT${v} à valider`;
    if (L.etape === 'premier_jet') return `premier jet${v}`;
    return `${a.n_ancetres || 0} ancêtres`; };
  const actionsArbre = (a, seul) => `<div class="adm-info"><b>${esc(a.titre)}</b> ${esc(a.sous_titre || '')} · ${a.n_ancetres || 0} ancêtres${a.maj ? ' · ' + esc(new Date(a.maj).toLocaleDateString('fr-FR')) : ''}${a.livre ? `<br>Livre : ${esc(etatLivre(a))}` : ''}</div>
    <button data-o="${esc(a.id)}" data-v="admin">Ouvrir</button><button data-o="${esc(a.id)}" data-v="client">Vue client</button>${a.proposition ? `<button data-or="${esc(a.id)}">Orientation${a.orientation ? ' (ouverte)' : ''}</button>` : ''}${a.livre ? `<button data-rl="${esc(a.id)}">Relecture${a.relecture ? ' (ouverte)' : ''}</button>` : ''}`;
  const ligne = (nom, sousTitre, a, valide, menu, f, ferme) => `<li class="adm-client" data-f="${esc(f)}"><div class="adm-ligne">
      <span class="adm-nom"><b>${esc(nom)}</b> <span class="petit${valide ? ' valide' : ''}">${esc(sousTitre)}</span>${ferme ? ' <span class="petit"><i>(pas ouvert)</i></span>' : ''}</span>
      <details class="adm-menu"><summary class="btn" aria-label="Autres actions">⋯</summary><div class="adm-pop">${menu}</div></details></div></li>`;
  const ligneClient = c => { const as = c.arbres.map(id => arbres.find(x => x.id === id)).filter(Boolean), a = as[0];
    const ferme = a && !(a.lecteurs || []).some(e => cleEmail(e) === c.cle);
    const menu = `<div class="adm-info">${c.emails.map(esc).join('<br>')}${c.commandes.length ? `<br>${c.commandes.length} commande${c.commandes.length > 1 ? 's' : ''}` : ''}</div>
      ${c.commandes.length ? `<button data-suivi="${esc(c.cle)}">Échanges</button>` : ''}<button data-mod="${esc(c.cle)}">Accès</button><button data-lien="${esc(c.emails[0])}">Envoyer un lien</button><button data-comme="${esc(c.emails[0])}">Voir comme ce client</button>
      ${as.map((x, k) => '<hr>' + actionsArbre(x, k === 0)).join('')}`;
    // 17/11/2026 (Laurent) : un cadeau se lit « livre d'Hélène : BAT à valider », et chaque arbre du client a son état
    const pourDe = x => { const s = c.commandes.find(k => (k.arbres || []).includes(x.id) && k.pour && !String(c.nom || '').toLowerCase().startsWith(String(k.pour).toLowerCase())); if (!s) return '';
      const p = String(s.pour).trim(); return `livre ${/^[aeiouyhâàéèêëîïôöûüÉÈÊÂÎÔÛ]/i.test(p) ? "d'" : 'de '}${p} : `; };
    // 17/11/2026 (Laurent) : passes de recherche par version (comptées depuis le 02/11), y compris la version en cours
    const P = c.commandes.map(k => k.passes).filter(x => x && x.par_version);
    const passesCourt = P.map(x => `${x.par_version[x.version] || 0}/${x.plafond} passes (V${x.version}${x.en_cours ? ', en cours' : ''})`).join(' · ');
    const passesDetail = P.map(x => 'Passes : ' + Object.keys(x.par_version).sort((u, v) => u - v).map(v => `V${v} ${x.par_version[v]}${+v === x.version ? `/${x.plafond}${x.en_cours ? ' en cours' : ''}` : ''}`).join(' · ')).join('<br>');
    const menuP = passesDetail ? menu.replace('</div>', `<br>${passesDetail}<br><span class="petit">comptées depuis le 02/11</span></div>`) : menu;
    return ligne(c.nom || c.emails[0], (as.length ? as.map(x => pourDe(x) + court(x)).join(' · ') : court(a)) + (passesCourt ? ' · ' + passesCourt : ''), a, a && a.validation, menuP,
      (c.nom + ' ' + c.emails.join(' ') + ' ' + c.arbres.map(titre).join(' ')).toLowerCase(), ferme); };
  $app.innerHTML = barre() + `<main class="page large"><div class="admin">
    <nav class="rail" aria-label="Administration"><button data-t="clients" aria-current="${onglet === 'clients'}">Clients</button><button data-t="archiviste" aria-current="${onglet === 'archiviste'}">Archiviste</button></nav>
    <section>${onglet === 'archiviste' ? `<h1>Archiviste</h1><div id="suivi"></div>` : `<h1>Clients</h1>
      ${blocTravail(travail)}
      <div class="kpis" id="kpis"></div>
      <div class="visites" id="visites"></div>
      <div class="outils"><label class="cache-visuel" for="filtre">Rechercher</label><input id="filtre" type="search" placeholder="Nom, adresse, titre…"></div>
      <ul class="adm-clients">${clients.map(ligneClient).join('')}</ul>
      ${orphelins.length ? `<h2 class="sv-h2">Arbres sans client</h2><ul class="adm-clients">${orphelins.map(a => ligne(a.titre, court(a), a, a.validation, actionsArbre(a, true), (a.titre + ' ' + (a.sous_titre || '')).toLowerCase())).join('')}</ul>` : ''}
      <form class="form-compte" id="fc" hidden><b>Modifier un accès</b>
        <label class="etiq" for="fc-email">Adresse e-mail du client</label><input id="fc-email" type="email" required>
        <div class="cases">${arbres.map(a => `<label><input type="checkbox" value="${esc(a.id)}"> ${esc(a.titre)}</label>`).join('')}</div>
        <div class="rangee"><button class="btn btn-1" type="submit">Enregistrer</button><label><input type="checkbox" id="fc-lien"> envoyer aussi un lien d’accès</label><span class="note-ok" id="fc-ok" role="status"></span></div></form>`}</section></div></main>`;
  brancherBarre();
  const kp = $app.querySelector('#kpis'); if (kp) try { dessinerKpis(kp, suivis, arbres); } catch (e) { console.warn(e); }
  const vi = $app.querySelector('#visites'); if (vi) try { dessinerVisites(vi, visites, comptes); } catch (e) { console.warn(e); }
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => pageAdmin(b.dataset.t));
  // un seul menu « ⋯ » ouvert à la fois ; il se referme après une action ou un clic ailleurs
  const menus = [...$app.querySelectorAll('.adm-menu')];
  menus.forEach(d => { d.addEventListener('toggle', () => { if (d.open) { menus.forEach(x => { if (x !== d) x.open = false; }); d.classList.remove('haut'); const r = d.querySelector('.adm-pop').getBoundingClientRect(); if (r.bottom > innerHeight - 8 && r.top - 52 > innerHeight - r.top) d.classList.add('haut'); } });
    d.querySelectorAll('.adm-pop button').forEach(b => b.addEventListener('click', () => setTimeout(() => { if (b.dataset.lien === undefined) d.open = false; }, 0))); });
  if (!pageAdmin.fermeMenus) { pageAdmin.fermeMenus = true; document.addEventListener('click', e => { if (!e.target.closest('.adm-menu')) document.querySelectorAll('.adm-menu[open]').forEach(x => x.open = false); }); }
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
      fc.hidden = false; fc.scrollIntoView({behavior: 'smooth'});
    });
    $app.querySelectorAll('[data-lien]').forEach(b => b.onclick = async () => { b.disabled = true; await S.envoyerLienA(b.dataset.lien); b.textContent = 'Lien envoyé'; });
    $app.querySelectorAll('[data-comme]').forEach(b => b.onclick = () => { vuComme = b.dataset.comme; accueil(); });
  }
}

// ---------------------------------------------------------------- démarrage
(async () => {
  try { S = DEV ? await sourceDev() : await sourceFirebase(); }
  catch (e) { console.error(e); $app.innerHTML = `<main class="porte"><div class="carte-porte">${LOGO}<h1>Un souci technique</h1><p>L’espace est momentanément indisponible. Réessayez dans quelques minutes, ou écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></div></main>`; return; }
  if (params.get('partage')) return ouvrirPartage(params.get('partage'));
  if (S.estLien()) { ecranEntrer(); }
  let premier = true;
  S.onUtilisateur(u => {
    U = u;
    if (u && u.admin) ecrire('vr-admin', '1');   // 18/11/2026 : les visites de l'administrateur ne sont pas comptées
    if (!u) { if (!S.estLien()) (location.hash === '#inscription' ? ecranInscription() : ecranConnexion()); return; }
    if (premier || !arbreActif) { premier = false; accueil(); }
  });
})();
