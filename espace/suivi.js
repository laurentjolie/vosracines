// Vos Racines : onglet « Archiviste » de l'administration (02/11/2026, demande de Laurent).
// 1. Administrations : toutes les demandes d'actes, ce qui a été répondu, ce qui est en attente ou à faire à la main.
// 2. Clients : toute la discussion avec chaque client, et ce qu'il a choisi ou commenté dans l'espace (orientation, relecture, dépôts).
// Données : suivi/{ref} (écrit par HQ, suivi.py, toutes les 10 minutes) ; choix, retours et dépôts lus dans arbres/{id}.
import {etatLivre} from './relecture.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST = {acte: ['Acte reçu', 'ok'], reponse: ['Réponse reçue', 'rep'], attente: ['En attente', 'att'], main: ['À faire à la main', 'main'], ecartee: ['Non envoyée', 'off']};
const ORDRE = ['main', 'attente', 'reponse', 'acte', 'ecartee'];
const jour = t => { if (!t) return ''; const d = new Date(String(t).replace(' ', 'T')); return isNaN(d) ? String(t).slice(0, 10) : d.toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: '2-digit'}); };
const heure = t => { if (!t) return ''; const d = new Date(String(t).replace(' ', 'T')); return isNaN(d) ? String(t) : d.toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'}); };
const dateActe = d => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d || ''); };
const domaine = a => String(a || '').split('@').pop().replace(/[<>]/g, '');
// le corps d'un mail, sans l'historique cité (« Le sam. 17 oct. … a écrit : » et les lignes « > »)
function sansCitation(t) {
  const L = String(t || '').split('\n'); const out = [];
  for (let i = 0; i < L.length; i++) {
    const l = L[i].trim(), deux = (l + ' ' + (L[i + 1] || '').trim()).trim();
    // 09/11 : « Le lun. 9 nov. 2026 à 08:20, L'archiviste <\narchiviste@…> a écrit : » tient souvent sur deux lignes
    if (/^\s*>/.test(L[i]) || /^(Le|On) .{6,160}(a écrit|wrote)\s*:?\s*$/.test(l) || (/^(Le|On) /.test(l) && /^(Le|On) .{6,200}(a écrit|wrote)\s*:?\s*$/.test(deux))
        || /^-{2,} ?(Original|Message d'origine)/i.test(l) || /^(De|From) ?:/.test(l) && /^(Envoy|Sent|Date)/.test((L[i + 1] || '').trim())) break;
    out.push(L[i]);
  }
  return out.join('\n').trim();
}
// 09/11 (Laurent : « mise en page convenable ») : les messageries des clients coupent les lignes vers 72 caractères ;
// on recolle une ligne à la suivante quand elle est longue et ne finit pas une phrase, sans toucher aux listes ni aux paragraphes
function deplier(t) {
  const L = String(t || '').replace(/\r/g, '').split('\n'); const out = [];
  for (const l of L) {
    const p = out.length ? out[out.length - 1] : null;
    if (p !== null && p.length >= 55 && l.trim() && !/[.!?:;]\s*$/.test(p) && !/^\s*([-*•–]|\d+[.)]|[A-ZÉÈ][a-zé]+ ?:)/.test(l)) out[out.length - 1] = p.replace(/\s+$/, '') + ' ' + l.trim();
    else out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export async function ouvrirSuivi(el, S, arbres, opt = {}) {
  const cle = opt.cleEmail || (e => String(e || '').toLowerCase());
  el.innerHTML = '<p class="petit">Chargement…</p>';
  const suivis = (await S.suivis()).sort((a, b) => String(b.dernier).localeCompare(String(a.dernier)));
  // arbres de clients sans commande (familles de Laurent et de Lucile) : leurs choix et relectures comptent aussi
  const lies = new Set(suivis.flatMap(s => s.arbres || []));
  const horsCmd = arbres.filter(a => !lies.has(a.id) && (a.proposition || a.livre) && (a.lecteurs || []).length).map(a => ({ref: 'arbre:' + a.id, client: '', titre: a.titre, emails: a.lecteurs || [], arbres: [a.id], discussion: [], demandes: [], horsCmd: true}));
  // 02/11 : un client = une boîte mail réelle (les points d'une adresse Gmail ne comptent pas) ; ses commandes et ses arbres sont réunis
  const G = new Map();
  for (const s of suivis) s.titre = s.titre || (arbres.find(a => a.id === (s.arbres || [])[0]) || {}).titre || '';
  for (const s of [...suivis, ...horsCmd]) {
    const k = cle((s.emails || [])[0] || s.ref);
    if (!G.has(k)) G.set(k, {cle: k, nom: '', emails: new Set(), dossiers: [], dernier: ''});
    const g = G.get(k); (s.emails || []).forEach(e => g.emails.add(e)); g.dossiers.push(s);
    if (s.client && s.client.length > g.nom.length) g.nom = s.client;
    if (String(s.dernier || '') > g.dernier) g.dernier = String(s.dernier || '');
  }
  const clientsG = [...G.values()].map(g => ({...g, emails: [...new Set([...g.emails].map(e => e.toLowerCase()))], nom: g.nom || [...g.emails][0]})).sort((a, b) => b.dernier.localeCompare(a.dernier));
  let vue = opt.client ? 'clients' : 'admin', filtre = '', cmd = '', choisi = opt.client && clientsG.some(g => g.cle === opt.client) ? opt.client : (clientsG[0] || {}).cle;
  function rendre() {
    el.innerHTML = `<div class="sv-onglets" role="tablist">
        <button role="tab" aria-selected="${vue === 'admin'}" data-vue="admin">Administrations</button>
        <button role="tab" aria-selected="${vue === 'clients'}" data-vue="clients">Clients</button></div>
      <div id="sv-corps"></div>`;
    el.querySelectorAll('[data-vue]').forEach(b => b.onclick = () => { vue = b.dataset.vue; rendre(); });
    vue === 'admin' ? administrations(el.querySelector('#sv-corps')) : clients(el.querySelector('#sv-corps'));
  }

  function administrations(c) {
    const lignes = suivis.flatMap(s => (s.demandes || []).map(d => ({...d, s})));
    const compte = Object.fromEntries(ORDRE.map(k => [k, lignes.filter(x => x.statut === k).length]));
    const visibles = lignes.filter(x => (!filtre || x.statut === filtre) && (!cmd || x.s.ref === cmd))
      .sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut) || String(b.t).localeCompare(String(a.t)));
    const autres = suivis.flatMap(s => (s.autres || []).map(a => ({...a, s})));
    // 02/11/2026 (audit UX, G5) : l'heure du dernier changement reçu de HQ (suivi.py n'écrit un dossier que s'il a changé)
    const majHQ = suivis.map(s => String(s.maj || '')).sort().pop() || '';
    c.innerHTML = `<p class="petit">Les demandes de copies d'actes envoyées par l'archiviste aux mairies et aux services d'archives, et ce qu'ils ont répondu. HQ vérifie toutes les dix minutes${majHQ ? ` ; dernier changement reçu le <b>${esc(heure(majHQ))}</b>` : ''}.</p>
      <div class="sv-chips">${ORDRE.map(k => `<button class="sv-chip sv-${ST[k][1]}" aria-pressed="${filtre === k}" data-f="${k}">${ST[k][0]} <b>${compte[k]}</b></button>`).join('')}
        <label class="cache-visuel" for="sv-cmd">Commande</label><select id="sv-cmd"><option value="">Toutes les commandes</option>${suivis.filter(s => (s.demandes || []).length).map(s => `<option value="${esc(s.ref)}" ${cmd === s.ref ? 'selected' : ''}>${esc(s.client)}${s.pour ? ' pour ' + esc(s.pour) : ''}</option>`).join('')}</select></div>
      ${visibles.length ? `<ul class="sv-dem">${visibles.map(x => `<li class="sv-d">
        <span class="sv-badge sv-${ST[x.statut][1]}">${ST[x.statut][0]}${x.statut === 'attente' && x.jours != null ? ` <small>depuis ${x.jours} j</small>` : ''}</span>
        <div class="sv-quoi"><b>${esc(String(x.type || '').replace(/^acte de /, 'Acte de '))} : ${esc(x.personne)}</b>${x.date ? ` <span class="petit">(${esc(dateActe(x.date))})</span>` : ''}
          <div class="petit">${esc(x.commune || '')}${x.courriel ? ` · ${esc(x.courriel)}` : ''} · demandé le ${esc(jour(x.t))} · <i>${esc(x.s.client)}${x.s.pour ? ' pour ' + esc(x.s.pour) : ''}</i></div>
          ${x.statut === 'main' ? `<div class="sv-note">Pas d'adresse électronique trouvée pour cette mairie : demande à faire sur son site ou par courrier.</div>` : ''}
          ${x.statut === 'ecartee' ? `<div class="sv-note">${esc(x.etat)}</div>` : ''}
          ${(x.reponses || []).map(r => `<details class="sv-rep"><summary>Réponse du ${esc(heure(r.t))} (${esc(domaine(r.de))})${r.pieces ? ` · ${r.pieces} pièce${r.pieces > 1 ? 's' : ''} jointe${r.pieces > 1 ? 's' : ''}` : ''}</summary><p>${esc(sansCitation(r.texte)) || '<i>(sans texte)</i>'}</p></details>`).join('')}
          ${(x.pieces || []).length ? `<div class="petit">Pièces reçues : ${x.pieces.map(esc).join(', ')}</div>` : ''}
          ${x.raison ? `<details class="sv-rep"><summary>Pourquoi cette demande</summary><p>${esc(x.raison)}</p></details>` : ''}
        </div></li>`).join('')}</ul>` : '<p>Aucune demande dans cette sélection.</p>'}
      ${autres.length && !filtre ? `<h2 class="sv-h2">Réponses non rattachées à une demande</h2><ul class="sv-dem">${autres.filter(a => !cmd || a.s.ref === cmd).map(a => `<li class="sv-d"><span class="sv-badge sv-off">À classer</span><div class="sv-quoi"><b>${esc(a.sujet || '(sans objet)')}</b><div class="petit">${esc(a.de)} · ${esc(heure(a.t))} · <i>${esc(a.s.client)}</i></div><details class="sv-rep"><summary>Lire</summary><p>${esc(sansCitation(a.texte))}</p></details></div></li>`).join('')}</ul>` : ''}`;
    c.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = filtre === b.dataset.f ? '' : b.dataset.f; administrations(c); });
    c.querySelector('#sv-cmd').onchange = e => { cmd = e.target.value; administrations(c); };
  }

  function clients(c) {
    c.innerHTML = `<div class="sv-cli">
      <nav class="sv-liste" aria-label="Clients">${clientsG.map(g => { const n = g.dossiers.reduce((t, s) => t + (s.discussion || []).length, 0);
        return `<button data-c="${esc(g.cle)}" aria-current="${choisi === g.cle}"><b>${esc(g.nom)}</b>
        <span class="petit">${g.dossiers.map(s => esc(s.horsCmd ? s.titre : (s.titre || 'commande …' + (s.court || '')))).join(' · ')}</span>
        <span class="petit">${n} message${n > 1 ? 's' : ''}${g.dernier ? ' · ' + esc(jour(g.dernier)) : ''}</span></button>`; }).join('')}</nav>
      <div class="sv-fil" id="sv-fil"></div></div>`;
    c.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { choisi = b.dataset.c; clients(c); c.querySelector('#sv-fil').scrollIntoView({behavior: 'smooth', block: 'start'}); });
    const g = clientsG.find(x => x.cle === choisi) || clientsG[0];
    const f = c.querySelector('#sv-fil');
    if (!g) { f.innerHTML = '<p>Aucun client.</p>'; return; }
    // 09/11 (Laurent : « les mails dans l'ordre ») : un client à plusieurs commandes avait un fil par commande, le plus récent
    // en premier ; désormais l'espace par commande, puis UNE discussion, tous les messages par ordre chronologique
    const plusieurs = g.dossiers.length > 1;
    const msgs = g.dossiers.flatMap(s => (s.discussion || []).map(m => ({...m, dos: s.horsCmd ? '' : (s.titre || 'commande …' + (s.court || '')) + (s.pour ? ' pour ' + s.pour : '')})))
      .sort((a, b) => String(a.t).localeCompare(String(b.t)));
    f.innerHTML = `<h2 class="sv-h2">${esc(g.nom)}</h2><p class="petit">${g.emails.map(esc).join(' · ')}</p>` + g.dossiers.map((s, i) => `<div class="sv-dossier" id="sv-d${i}"></div>`).join('')
      + (g.dossiers.every(s => s.horsCmd) ? '' : `<section><h3 class="sv-h3">Discussion avec l'archiviste${plusieurs ? ' (toutes les commandes, dans l\'ordre)' : ''}</h3>${msgs.length ? `<ol class="sv-msgs">${msgs.map(m => {
        const t = m.sens === 'entrant' ? deplier(sansCitation(m.texte)) : sansCitation(m.texte), complet = String(m.texte || '').trim();
        return `<li class="sv-m sv-${m.sens === 'entrant' ? 'in' : m.sens === 'note' ? 'note' : 'out'}"><div class="sv-tete"><b>${m.sens === 'entrant' ? esc(m.de || 'Client') : m.sens === 'note' ? 'Note' : 'Archiviste'}</b> · ${esc(heure(m.t))}${plusieurs && m.dos ? ' · <i>' + esc(m.dos) + '</i>' : ''}${m.essai ? ' · <i>essai, non envoyé</i>' : ''}</div>
          ${m.sujet ? `<div class="sv-suj">${esc(m.sujet)}</div>` : ''}<div class="sv-txt">${esc(t)}</div>${complet.length > t.length + 20 ? `<details class="sv-rep"><summary>Message complet, avec l'historique cité</summary><div class="sv-txt">${esc(complet)}</div></details>` : ''}</li>`; }).join('')}</ol>` : '<p class="petit">Aucun échange.</p>'}</section>`);
    g.dossiers.forEach((s, i) => fil(f.querySelector('#sv-d' + i), s, plusieurs, true));
  }

  async function fil(f, s, plusieurs, sansDiscussion) {
    const nomDossier = s.horsCmd ? s.titre : `${s.titre ? esc(s.titre) : 'Commande'}${s.pour ? ' pour ' + esc(s.pour) : ''} <span class="petit">· commande …${esc(s.court || '')}</span>`;
    f.innerHTML = `${plusieurs ? `<h3 class="sv-dos">${s.horsCmd ? esc(nomDossier) : nomDossier}</h3>` : ''}
      <section><h3 class="sv-h3">Dans l'espace : choix, relecture, documents</h3><div id="sv-esp"><p class="petit">Chargement…</p></div></section>
      ${s.horsCmd || sansDiscussion ? '' : `<section><h3 class="sv-h3">Discussion avec l'archiviste</h3>${(s.discussion || []).length ? `<ol class="sv-msgs">${s.discussion.map(m => {
        const t = m.sens === 'entrant' ? deplier(sansCitation(m.texte)) : sansCitation(m.texte), complet = String(m.texte || '').trim();
        return `<li class="sv-m sv-${m.sens === 'entrant' ? 'in' : m.sens === 'note' ? 'note' : 'out'}"><div class="sv-tete"><b>${m.sens === 'entrant' ? esc(m.de || 'Client') : m.sens === 'note' ? 'Note' : 'Archiviste'}</b> · ${esc(heure(m.t))}${m.essai ? ' · <i>essai, non envoyé</i>' : ''}</div>
          ${m.sujet ? `<div class="sv-suj">${esc(m.sujet)}</div>` : ''}<div class="sv-txt">${esc(t)}</div>${complet.length > t.length + 20 ? `<details class="sv-rep"><summary>Message complet, avec l'historique cité</summary><div class="sv-txt">${esc(complet)}</div></details>` : ''}</li>`; }).join('')}</ol>` : '<p class="petit">Aucun échange.</p>'}</section>`}`;
    const esp = f.querySelector('#sv-esp');
    const blocs = [];
    for (const id of s.arbres || []) {
      const a = arbres.find(x => x.id === id) || {id, titre: id};
      const [P, choix, retours, depots, val] = await Promise.all([S.proposition(id).catch(() => null), S.tousChoix(id).catch(() => []), S.retours(id).catch(() => []), S.mesDepots(id).catch(() => []),
        a.livre && a.livre.etape === 'bat' && S.validation ? S.validation(id).catch(() => null) : null]);
      blocs.push(`<div class="sv-arbre"><h4>${esc(a.titre)}</h4>
        <p class="petit">Orientation ${a.orientation ? 'ouverte' : 'fermée'} · Relecture ${a.relecture ? 'ouverte' : 'fermée'}</p>
        ${a.livre ? `<p class="petit etat-livre${val ? ' valide' : ''}">Livre : ${esc(etatLivre({...a, validation: val}))}</p>` : ''}
        ${choix.length ? choix.map(ch => carteChoix(ch, P)).join('') : '<p class="petit">Aucun choix enregistré.</p>'}
        ${retours.length ? `<h5>Commentaires de relecture (${retours.length})</h5><ul class="sv-ret">${retours.sort((x, y) => (x.page || 0) - (y.page || 0)).map(r => `<li><b>Page ${esc(r.page)}</b> · ${esc({correction: 'Correction', ambiance: 'Ambiance, ton', creuser: 'À creuser'}[r.genre] || r.genre || '')} · ${esc(r.auteur)} · ${esc(heure(r.cree))}${r.statut ? ` · <i>${esc(r.statut)}</i>` : ''}${r.citation ? `<blockquote>${esc(r.citation)}</blockquote>` : ''}<div>${esc(r.texte)}</div></li>`).join('')}</ul>` : ''}
        ${depots.length ? `<h5>Documents déposés (${depots.length})</h5><ul class="sv-ret">${depots.map(d => `<li>${esc(d.nom)} <span class="petit">(${esc(d.usage || '')}${d.note ? ', ' + esc(d.note) : ''}) · ${esc(d.auteur)} · ${esc(heure(d.cree && d.cree.toDate ? d.cree.toDate().toISOString() : d.cree))}</span></li>`).join('')}</ul>` : ''}</div>`);
    }
    esp.innerHTML = blocs.join('') || '<p class="petit">Pas encore d\'arbre dans l\'espace.</p>';
  }

  function carteChoix(ch, P) {
    P = P || {};
    const nomDe = (liste, id) => { const x = (P[liste] || []).find(y => y.id === id); if (x) return x.titre || x.nom; const m = String(id || '').match(/^(photo|document|doc|autre):(.*)$/); return m ? `${{photo: 'Photo', document: 'Document', doc: 'Document', autre: 'Autre chose'}[m[1]]} (${m[2].replace(/_/g, ' ')})` : id; };
    const titre = !ch.titre ? '' : String(ch.titre).startsWith('libre:') ? `« ${ch.titre.slice(6)} » (titre libre)` : nomDe('titres', ch.titre);
    const im = (ch.images || []).map(i => { const x = (P.images || []).find(y => y.id === i); return x ? `${x.titre}${x.libre === false || x.libre === 'False' ? ' (non libre)' : ''}` : i; });
    const L = [['Titre', titre], ['Habillage', ch.theme && nomDe('themes', ch.theme)], ['Couverture', ch.couverture && (nomDe('couvertures', ch.couverture) + (ch.couverture_note ? ` : ${ch.couverture_note}` : ''))],
      ['Quatrième', ch.quatrieme && (nomDe('quatriemes', ch.quatrieme) + (ch.quatrieme_note ? ` : ${ch.quatrieme_note}` : ''))], ['Images', im.join(' ; ')],
      ['Usage privé', ch.usage_prive ? 'oui, images non libres acceptées pour un livre de famille' : 'non coché'], ['Ambiance', ch.ambiance], ['À creuser', ch.creuser]];
    const maj = ch.maj && ch.maj.toDate ? ch.maj.toDate().toISOString() : ch.maj;
    return `<div class="sv-choix"><div class="sv-tete"><b>${esc(ch.email)}</b> · choix enregistrés le ${esc(heure(maj))}</div>
      <dl>${L.map(([k, v]) => `<dt>${k}</dt><dd>${v ? esc(v) : '<span class="petit">non renseigné</span>'}</dd>`).join('')}</dl></div>`;
  }

  rendre();
}
