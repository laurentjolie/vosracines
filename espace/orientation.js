// Vos Racines : orienter le livre, du premier jet au bon à tirer (30/10/2026, demande de Laurent).
// Le client choisit le style, la couverture et la quatrième, dépose ses documents, choisit des images, dit l'ambiance voulue
// et ce qu'il aimerait qu'on creuse. Pas de relecture fine ici : elle vient avec le bon à tirer.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MO = 1024 * 1024, MORCEAU = 900000, MAX_MORCEAUX = 40;

async function enJpeg(file, max = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
const enDataURL = file => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });

export async function ouvrirOrientation(el, meta, S, U, opt = {}) {
  el.innerHTML = '<div class="chargement">Chargement…</div>';
  const [prop, choix0, depots0] = await Promise.all([S.proposition(meta.id).catch(() => null), S.choix(meta.id, U.email).catch(() => null), S.mesDepots(meta.id, U.email).catch(() => [])]);
  const P = prop || {themes: [], couvertures: [], quatriemes: [], images: []};
  let choix = {theme: '', couverture: '', quatrieme: '', images: [], ambiance: '', creuser: '', usage_prive: false, ...(choix0 || {})};
  let depots = depots0 || [];
  const img = async nom => { try { return await S.image(meta.id, nom); } catch (e) { return null; } };

  const carteChoix = (groupe, x, sel) => `<label class="or-carte ${sel ? 'choisie' : ''}"><input type="radio" name="${groupe}" value="${esc(x.id)}" ${sel ? 'checked' : ''}>
    <span class="or-vign" data-img="${esc(x.img || (x.apercus || [])[0] || '')}"></span><span class="or-nom"><b>${esc(x.nom || x.titre)}</b>${x.desc ? `<small>${esc(x.desc)}</small>` : ''}</span></label>`;
  const persoCarte = (groupe) => {
    const d = depots.filter(z => z.usage === groupe); const id = d.length ? 'perso:' + d[d.length - 1].id : '';
    return `<label class="or-carte perso ${choix[groupe] && choix[groupe].startsWith('perso:') ? 'choisie' : ''}"><input type="radio" name="${groupe}" value="${esc(id)}" ${choix[groupe] && choix[groupe].startsWith('perso:') ? 'checked' : ''} ${id ? '' : 'disabled'}>
      <span class="or-vign vide">${d.length ? esc(d[d.length - 1].nom) : 'Votre photo'}</span><span class="or-nom"><b>Votre photo</b><small><button type="button" class="btn-lien" data-deposer="${groupe}">${d.length ? 'Choisir une autre photo' : 'Choisir une photo'}</button></small></span></label>`;
  };

  function rendre() {
    el.innerHTML = `<div class="orientation"><div class="or-int">
      <h1>Orienter votre livre</h1>
      <p class="or-chapo">Voici le premier jet de <b>${esc(meta.titre)}</b>. Avant la version finale, dites-nous l’allure et l’ambiance que vous voulez. Inutile de relire mot à mot : la relecture fine viendra avec le bon à tirer.</p>
      ${meta.livre ? `<p><button class="btn" data-feuilleter>Feuilleter le premier jet</button></p>` : ''}
      <ol class="or-etapes">
      <li><h2>Le style du livre</h2><p class="aide">Trois habillages, le même texte.</p>
        <div class="or-grille">${P.themes.map(t => carteChoix('theme', t, choix.theme === t.id)).join('') || '<p class="petit">Les styles arrivent bientôt.</p>'}</div></li>
      <li><h2>La couverture</h2><p class="aide">Une image du livre, ou une photo à vous (un portrait de famille, une maison, un village).</p>
        <div class="or-grille">${P.couvertures.map(t => carteChoix('couverture', t, choix.couverture === t.id)).join('')}${persoCarte('couverture')}</div></li>
      <li><h2>La quatrième de couverture</h2><p class="aide">L’image du dos du livre.</p>
        <div class="or-grille">${P.quatriemes.map(t => carteChoix('quatrieme', t, choix.quatrieme === t.id)).join('')}${persoCarte('quatrieme')}</div></li>
      <li><h2>Vos documents de famille</h2><p class="aide">Photos, livret de famille, lettres, faire-part, papiers militaires : tout ce qui peut nourrir le livre. Une photo prise au téléphone suffit.</p>
        <div class="or-depot"><button type="button" class="btn btn-1" data-deposer="document">Ajouter des documents</button><span class="note-ok" id="or-etat" role="status"></span></div>
        <ul class="or-depots">${depots.map(d => `<li><span>${esc(d.nom)}</span><small>${esc({couverture: 'pour la couverture', quatrieme: 'pour la quatrième', document: 'document', photo: 'photo'}[d.usage] || '')}${d.complet ? '' : ' · envoi incomplet'}</small><button type="button" class="btn-lien" data-suppr="${esc(d.id)}">Retirer</button></li>`).join('')}</ul></li>
      <li><h2>Des images pour illustrer</h2><p class="aide">Nous avons repéré ces images (cartes postales, lieux, époques). Cochez celles que vous voulez voir dans votre livre, ou ajoutez le lien d’une image trouvée ailleurs.</p>
        <div class="or-images">${P.images.map(x => `<label class="or-image"><input type="checkbox" value="${esc(x.id)}" ${choix.images.includes(x.id) ? 'checked' : ''}>
          ${x.apercu ? `<img src="${esc(x.apercu)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="or-vign vide">Aperçu sur le site</span>'}
          <span><b>${esc(x.titre)}</b><small>${esc([x.lieu, x.epoque, x.source].filter(Boolean).join(' · '))}</small>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Voir l’image</a>` : ''}</span></label>`).join('') || '<p class="petit">La sélection d’images arrive bientôt.</p>'}</div>
        <div class="or-lien"><label class="etiq" for="or-url">Le lien d’une autre image</label><div class="rangee"><input id="or-url" type="url" placeholder="https://…"><button type="button" class="btn" data-ajurl>Ajouter</button></div>
          <ul class="or-urls">${choix.images.filter(i => i.startsWith('http')).map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.length > 70 ? u.slice(0, 70) + '…' : u)}</a> <button type="button" class="btn-lien" data-rurl="${esc(u)}">Retirer</button></li>`).join('')}</ul></div>
        <label class="or-prive"><input type="checkbox" id="or-prive" ${choix.usage_prive ? 'checked' : ''}> Ces images sont pour notre livre de famille, à usage privé.</label></li>
      <li><h2>L’ambiance</h2><p class="aide">Le ton, ce qui vous plaît, ce qui vous manque, ce que vous voudriez voir plus ou moins.</p>
        <label class="cache-visuel" for="or-amb">L’ambiance</label><textarea id="or-amb" rows="5" placeholder="Par exemple : plus de photos de famille, un ton plus léger, moins de dates…">${esc(choix.ambiance)}</textarea></li>
      <li><h2>À creuser</h2><p class="aide">Un ancêtre, un lieu, une légende ou une question qui vous tient à cœur : nous y consacrons du temps de recherche avant la version finale.</p>
        <label class="cache-visuel" for="or-cre">À creuser</label><textarea id="or-cre" rows="4" placeholder="Par exemple : on dit que l’arrière-grand-père a été blessé à Verdun, est-ce vrai ?">${esc(choix.creuser)}</textarea></li>
      </ol>
      <div class="or-pied"><button class="btn btn-1" data-enreg>Enregistrer mes choix</button><span class="note-ok" id="or-ok" role="status"></span>
        <p class="petit">Vos choix restent modifiables. Nous vous écrivons quand la version finale est prête à relire.</p></div>
      <input type="file" id="or-fichier" hidden multiple accept="image/*,application/pdf"></div></div>`;
    el.querySelectorAll('.or-vign[data-img]').forEach(async v => { const n = v.dataset.img; if (!n) return; const src = await img(n); if (src) v.style.backgroundImage = `url("${src}")`; });
    brancher();
  }

  let usageDepot = 'document';
  function brancher() {
    el.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { choix[r.name] = r.value; el.querySelectorAll(`input[name=${r.name}]`).forEach(x => x.closest('.or-carte').classList.toggle('choisie', x.checked)); sauver(); });
    el.querySelectorAll('.or-images input').forEach(c => c.onchange = () => { choix.images = c.checked ? [...new Set([...choix.images, c.value])] : choix.images.filter(i => i !== c.value); sauver(); });
    el.querySelector('#or-prive').onchange = e => { choix.usage_prive = e.target.checked; sauver(); };
    el.querySelector('[data-ajurl]').onclick = () => { const u = el.querySelector('#or-url').value.trim(); if (!/^https?:\/\//.test(u)) return el.querySelector('#or-url').focus(); choix.images = [...new Set([...choix.images, u])]; sauver(true); };
    el.querySelectorAll('[data-rurl]').forEach(b => b.onclick = () => { choix.images = choix.images.filter(i => i !== b.dataset.rurl); sauver(true); });
    el.querySelectorAll('textarea').forEach(t => t.oninput = () => { choix[t.id === 'or-amb' ? 'ambiance' : 'creuser'] = t.value; sauverPlusTard(); });
    el.querySelector('[data-enreg]').onclick = () => sauver(false, true);
    const fic = el.querySelector('#or-fichier');
    el.querySelectorAll('[data-deposer]').forEach(b => b.onclick = e => { e.preventDefault(); usageDepot = b.dataset.deposer; fic.multiple = usageDepot === 'document'; fic.accept = usageDepot === 'document' ? 'image/*,application/pdf' : 'image/*'; fic.click(); });
    fic.onchange = () => deposer([...fic.files]);
    el.querySelectorAll('[data-suppr]').forEach(b => b.onclick = async () => { await S.supprimerDepot(meta.id, b.dataset.suppr); depots = depots.filter(d => d.id !== b.dataset.suppr); rendre(); });
    const f = el.querySelector('[data-feuilleter]'); if (f && opt.feuilleter) f.onclick = opt.feuilleter;
  }

  let minuteur = null;
  const sauverPlusTard = () => { clearTimeout(minuteur); minuteur = setTimeout(() => sauver(), 1500); };
  async function sauver(redessiner = false, signaler = false) {
    clearTimeout(minuteur);
    const ok = el.querySelector('#or-ok');
    try {
      await S.enregistrerChoix(meta.id, U.email, {theme: choix.theme || '', couverture: choix.couverture || '', quatrieme: choix.quatrieme || '', images: choix.images.slice(0, 59), ambiance: (choix.ambiance || '').slice(0, 7900), creuser: (choix.creuser || '').slice(0, 7900), usage_prive: !!choix.usage_prive});
      if (ok) { ok.textContent = signaler ? 'Vos choix sont enregistrés. Merci !' : 'Enregistré'; setTimeout(() => { if (ok) ok.textContent = ''; }, 2500); }
    } catch (e) { console.error(e); if (ok) ok.textContent = 'L’enregistrement n’a pas marché. Réessayez dans un instant.'; }
    if (redessiner) rendre();
  }

  async function deposer(files) {
    const etat = el.querySelector('#or-etat'); const usage = usageDepot;
    for (const [i, f] of files.entries()) {
      etat.textContent = `Envoi de ${f.name} (${i + 1}/${files.length})…`;
      try {
        const data = f.type.startsWith('image/') ? await enJpeg(f) : f.type === 'application/pdf' && f.size < 20 * MO ? await enDataURL(f) : null;
        if (!data) { etat.textContent = `${f.name} : format non pris en charge (photo ou PDF de moins de 20 Mo).`; continue; }
        const parts = []; for (let k = 0; k < data.length; k += MORCEAU) parts.push(data.slice(k, k + MORCEAU));
        if (parts.length > MAX_MORCEAUX) { etat.textContent = `${f.name} est trop lourd.`; continue; }
        const nom = f.type.startsWith('image/') ? f.name.replace(/\.\w+$/, '') + '.jpg' : f.name;
        const id = await S.deposer(meta.id, {nom: nom.slice(0, 190), type: f.type.startsWith('image/') ? 'image/jpeg' : f.type, taille: data.length, usage}, parts);
        depots.push({id, nom, usage, complet: true});
        if (usage !== 'document') choix[usage] = 'perso:' + id;
      } catch (e) { console.error(e); etat.textContent = `${f.name} : l’envoi n’a pas marché.`; return; }
    }
    if (usage !== 'document') await sauver();
    rendre(); const e2 = el.querySelector('#or-etat'); if (e2) e2.textContent = 'Merci, c’est bien arrivé.';
  }
  rendre();
}
