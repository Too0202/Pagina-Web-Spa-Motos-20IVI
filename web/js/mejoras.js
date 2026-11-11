/* Spa Motos 20IVI · mejoras (se carga al final, después de mobile.js)
   1. Lavados y Agenda del admin: solo informativos (etapas y cobro: solo empleados) + recordatorio al cliente
   2. Aviso de nuevo servicio (sonido, notificación del navegador, título de la pestaña)
   3. Cierre de sesión del admin por inactividad
   4. Moto: marca + modelo en listas
   5. "Servicios completados" archivados bajo cada persona (admin y empleados) */
(function () {
  'use strict';

  const isAdm = () => !!(S.auth && S.auth.role === 'admin');
  const isStf = () => !!(S.auth && S.auth.role === 'staff');
  const hhmm = (t) => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  /* ---------- estilos ---------- */
  const css = document.createElement('style');
  css.textContent = `
.dnsec{margin-top:12px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid #ffffff1c;padding:2px 12px 10px}
.dnsec>summary{cursor:pointer;font-weight:700;padding:12px 0;list-style:none}
.dnsec>summary::-webkit-details-marker{display:none}
.dnsec>summary:after{content:'▾';float:right}
.dnsec[open]>summary:after{content:'▴'}
.adm .dnsec{background:#f4f7ff;border-color:#dbe6fb}
.ro{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.ron{display:block;margin-top:8px;font-size:12px;opacity:.7}
.mp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mp .mpo{grid-column:1/-1}
@media(max-width:380px){.mp{grid-template-columns:1fr}}`;
  document.head.appendChild(css);

  /* ---------- 1. Recordatorio por WhatsApp ---------- */
  window.recordar = function (id) {
    const b = (S.all || []).find((x) => x.id === id);
    if (!b) return;
    const f = b.name.split(' ')[0];
    const t = `Hola ${f}, ya puedes presentarte con tu moto para tu lavado en Spa Motos 20IVI 🏍️✨ Tu turno es a las ${lab(b.start)}${b.staff ? ' con ' + sName(b.staff) : ''}. Recuerda que hay 10 minutos de tolerancia.`;
    window.open('https://wa.me/' + wd(b.phone) + '?text=' + encodeURIComponent(t), '_blank');
    try { db && db.collection('bookings').doc(id).update({ rem: Date.now() }); } catch (e) {}
  };

  /* ---------- 1. Taller del admin: solo informativo ---------- */
  const stTxt = (b) => { const c = sg(b); return c < 0 ? '⏳ Pendiente' : c >= 7 ? '🏁 Lista' : STG[c][1] + ' ' + STG[c][0]; };

  function roCard(b) {
    const c = sg(b);
    return `<div class="job ${c >= 7 ? 'fin' : ''}"><div class="jh"><b>${lab(b.start)} · ${esc(b.name)}</b><span>🏍️ ${esc(b.moto || '—')}</span></div>
<div class="gr" onpointerdown="dragStart(event,'${b.id}')" title="Arrastra para cambiar de persona">⠿</div>
<small class="sv">${b.svc.map(esc).join(', ')}</small>${b.note ? `<small class="sv">📝 ${esc(b.note)}</small>` : ''}
<div class="acts"><span onclick="detB('${b.id}')">🔎 Detalle</span><span onclick="editB('${b.id}')">✏️ Editar</span><span onclick="delB('${b.id}')">🗑</span></div>
${stepper(b, false)}
<div class="ro"><span class="badge ${c >= 7 ? 'ok' : ''}">${stTxt(b)}</span>${b.pay === 'ok' ? '<span class="badge ok">✅ Pagado</span>' : ''}${b.rem ? `<span class="badge">🔔 Recordado ${hhmm(b.rem)}</span>` : ''}${c >= 0 && c < 7 && b.t0 ? `<span class="badge">⏱ ${Math.round((Date.now() - b.t0) / 60000)} min</span>` : ''}</div>
${c < 0 ? `<div class="acts"><span onclick="recordar('${b.id}')">🔔 Recordar al cliente</span></div>` : ''}
${c >= 7 ? `<div class="acts">${b.pay === 'ok' ? '' : `<span onclick="payB('${b.id}')" style="background:var(--ac2)!important;color:#fff!important;font-weight:700">💰 Cobrar ${COP(b.total)}</span>`}<span onclick="listaWA('${b.id}')">📲 Avisar por WhatsApp</span></div>` : ''}
<small class="ron">Las etapas las maneja el empleado; el cobro se hace aquí.</small></div>`;
  }

  /* ---------- 5. Servicios completados (archivo por persona) ---------- */
  function doneCard(b, mode) {
    const paid = b.pay === 'ok';
    return `<div class="job fin"><div class="jh"><b>${lab(b.start)} · ${esc(mode === 'staff' ? b.name.split(' ')[0] : b.name)}</b><span>🔖 ${esc(b.placa || '—')} · 🏍️ ${esc(b.moto || '—')}</span></div>
<small class="sv">${b.svc.map(esc).join(', ')}${mode === 'adm' ? ' · ' + COP(b.total) : ''}</small>
<div class="ro">${paid ? `<span class="badge ok">✅ Pagado${mode === 'adm' && b.pm ? ' · ' + esc(b.pm) : ''}</span>` : `<span class="badge">💰 ${mode === 'adm' ? 'Por cobrar' : 'Pago pendiente en caja'}</span>`}</div>
<div class="acts">${mode === 'adm' && !paid ? `<span onclick="payB('${b.id}')" style="background:var(--ac2)!important;color:#fff!important;font-weight:700">💰 Cobrar ${COP(b.total)}</span>` : ''}<span onclick="listaWA('${b.id}')">📲 Avisar por WhatsApp</span>${mode === 'adm' ? `<span onclick="detB('${b.id}')">🔎 Detalle</span><span onclick="sendRcp('${b.id}')">🧾 Recibo</span>` : ''}</div></div>`;
  }

  function doneSec(list, mode, key) {
    if (!list.length) return '';
    const un = list.filter((b) => b.pay !== 'ok').length;
    S.dnOpen = S.dnOpen || {};
    const open = S.dnOpen[key] !== undefined ? S.dnOpen[key] : (mode === 'adm' && un > 0);
    return `<details class="dnsec" ${open ? 'open' : ''} ontoggle="S.dnOpen=S.dnOpen||{};S.dnOpen['${key}']=this.open"><summary>✅ Servicios completados (${list.length})${un ? ` · ${un} sin pagar` : ''}</summary>${list.map((b) => doneCard(b, mode)).join('')}</details>`;
  }

  // Panel "Lavados" del admin
  const _th = tallerHtml;
  tallerHtml = function () {
    const h = _th(), i = h.lastIndexOf('<div class="cols">');
    if (i < 0) return h;
    const bs = S.books || [];
    const cols = cfg.staff.map((p) => {
      const m = bs.filter((b) => b.staff === p.id), act = m.filter((b) => sg(b) < 7), dn = m.filter((b) => sg(b) >= 7);
      return `<div class="col" data-s="${p.id}"><h3>${esc(p.name)} <small style="color:var(--mut);font-size:16px">${act.length} en curso${dn.length ? ' · ' + dn.length + ' completado(s)' : ''}</small></h3>${act.length ? act.map(roCard).join('') : '<div class="empty">Sin lavados pendientes</div>'}${doneSec(dn, 'adm', 'a' + p.id)}</div>`;
    }).join('');
    return h.slice(0, i) + `<p class="empty" style="margin:0 0 10px">Vista informativa: solo los empleados cambian las etapas del lavado y cobran.</p><div class="cols">${cols}</div>`;
  };

  // Vista del empleado
  const _sv = staffView;
  staffView = function () {
    const h = _sv();
    const p = cfg.staff.find((x) => x.id === S.auth.id);
    if (!p) return h;
    const bs = (S.books || []).filter((b) => b.staff === p.id && !b.wait).sort((a, c) => a.start - c.start);
    const act = bs.filter((b) => sg(b) < 7), dn = bs.filter((b) => sg(b) >= 7);
    // se conserva el encabezado/estadísticas/pausa; se reemplaza solo la lista de tarjetas
    const cut = h.indexOf('<div class="job'), cut2 = h.indexOf('<p class="empty">No tienes lavados');
    let head = h;
    if (cut >= 0 && (cut2 < 0 || cut < cut2)) head = h.slice(0, cut);
    else if (cut2 >= 0) head = h.slice(0, cut2);
    if (S.books === null) return h;
    const list = act.length ? act.map(staffCard).join('') : (bs.length ? '<p class="empty">No tienes lavados pendientes 🎉</p>' : '<p class="empty">No tienes lavados asignados este día.</p>');
    return head + list + doneSec(dn, 'staff', 'st');
  };

  // Agenda (ventana de detalle de la cita): sin etapas ni cobro, con recordatorio
  const _ef = evFill;
  evFill = function (id) {
    _ef(id);
    const el = document.getElementById('evm');
    if (!el) return;
    const b = (S.all || []).find((x) => x.id === id);
    el.querySelectorAll('.stp').forEach((s) => { s.classList.remove('a'); s.querySelectorAll('.sp').forEach((x) => x.removeAttribute('onclick')); });
    el.querySelectorAll('.acts span').forEach((x) => { if (/setStg|payB/.test(x.getAttribute('onclick') || '')) x.remove(); });
    const acts = el.querySelector('.acts');
    if (acts && b && sg(b) < 0) acts.insertAdjacentHTML('afterbegin', `<span onclick="recordar('${id}')">🔔 Recordar al cliente</span>`);
    if (acts && b && b.rem) acts.insertAdjacentHTML('beforebegin', `<p class="empty" style="margin:6px 0 0">🔔 Recordatorio enviado a las ${hhmm(b.rem)}</p>`);
  };

  // Mensaje de "moto lista" por WhatsApp
  window.listaWA = function (id) {
    const b = (S.all || []).find((x) => x.id === id);
    if (!b) return;
    const f = b.name.split(' ')[0];
    const t = `Hola ${f}, tu moto ya está lista en Spa Motos 20IVI 🏍️✨ Puedes pasar a recogerla. ¡Gracias por confiar en nosotros!`;
    return window.open('https://wa.me/' + wd(b.phone) + '?text=' + encodeURIComponent(t), '_blank');
  };

  // Etapas: solo empleados. Al pulsar "Lista" se abre WhatsApp con el aviso al cliente.
  const _ss = window.setStg;
  window.setStg = function (id, i) {
    if (isAdm()) { toast('Solo los empleados pueden cambiar las etapas del lavado'); return; }
    const b = (S.all || []).find((x) => x.id === id);
    if (i >= 7 && b && sg(b) < 7) {
      if (!listaWA(id)) toast('📲 Toca "Avisar por WhatsApp" en Servicios completados para avisar al cliente');
    }
    return _ss.apply(this, arguments);
  };

  // Cobro: solo el administrador
  const _pb = window.payB;
  window.payB = function (id) {
    if (!isAdm()) return;
    return _pb.apply(this, arguments);
  };

  /* ---------- 2. Aviso de nuevo servicio ---------- */
  let seen = null, mute = 0, unread = 0;
  const baseTitle = document.title;
  const beep = () => {
    try {
      const A = window.AudioContext || window.webkitAudioContext, c = new A();
      [[880, 0], [1175, 0.18]].forEach(([f, t]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, c.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.3);
        o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.32);
      });
      setTimeout(() => c.close(), 900);
    } catch (e) {}
  };
  const clearTitle = () => { unread = 0; document.title = baseTitle; };
  addEventListener('focus', clearTitle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clearTitle(); });

  ['manual', 'saveW'].forEach((n) => {
    const f = window[n];
    if (typeof f === 'function') window[n] = function () { mute = Date.now() + 20000; return f.apply(this, arguments); };
  });

  setInterval(() => {
    if (!S.all || !(isAdm() || isStf())) return;
    const ids = new Set(S.all.map((b) => b.id));
    if (seen === null) { seen = ids; return; }
    const nuevos = S.all.filter((b) => !seen.has(b.id) && (isAdm() || b.staff === S.auth.id));
    seen = ids;
    if (!nuevos.length || Date.now() < mute) return;
    nuevos.forEach((b) => {
      toast('🛵 Nuevo servicio: ' + b.name + ' · ' + b.date + ' ' + lab(b.start));
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Nuevo servicio de lavado', {
            body: `${b.name} · ${b.placa || '—'} · ${b.moto || ''}\n${b.date} ${lab(b.start)}${b.staff ? ' con ' + sName(b.staff) : ' (lista de espera)'} · ${COP(b.total)}`,
            icon: 'assets/icon.png', tag: b.id,
          });
        } catch (e) {}
      }
    });
    beep();
    if (document.hidden) { unread += nuevos.length; document.title = '(' + unread + ') 🛵 Nuevo servicio'; }
  }, 1500);

  window.enableNotif = function () {
    if (!('Notification' in window)) return toast('Este navegador no permite notificaciones');
    Notification.requestPermission().then((p) => { beep(); toast(p === 'granted' ? '🔔 Avisos activados' : 'Avisos no activados'); render(); });
  };

  /* ---------- 3. Cierre de sesión del admin por inactividad ---------- */
  const IDLE = 15 * 60 * 1000, WARN = 60 * 1000, KEY = 'sm_last';
  let last = Date.now(), warned = false, wrote = 0;
  try { last = +localStorage.getItem(KEY) || last; } catch (e) {}
  const touch = () => {
    last = Date.now();
    if (last - wrote > 10000) { wrote = last; try { localStorage.setItem(KEY, String(last)); } catch (e) {} }
  };
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove'].forEach((ev) => addEventListener(ev, touch, { passive: true, capture: true }));
  const idleCheck = () => {
    if (!isAdm()) return;
    try { last = Math.max(last, +localStorage.getItem(KEY) || 0); } catch (e) {}
    const idle = Date.now() - last;
    if (idle >= IDLE) {
      toast('🔒 Sesión cerrada por inactividad');
      setTimeout(() => window.logout && window.logout(), 900);
      last = Date.now();
    } else if (idle >= IDLE - WARN) {
      if (!warned) { warned = true; toast('🔒 Tu sesión se cerrará en 1 minuto por inactividad. Toca la pantalla para continuar.'); }
    } else warned = false;
  };
  setInterval(idleCheck, 10000);
  idleCheck();

  /* ---------- 4. Moto: marca y modelo ---------- */
  const MOTOS = {
    'Yamaha': 'FZ 2.0|FZ 3.0|FZ-S|FZ 25|XTZ 125|XTZ 150|XTZ 250|Tenere 250|Tenere 700|MT-03|MT-07|MT-09|R15|R3|NMAX|XMAX|Crypton|YBR 125|Fascino|Ray ZR',
    'Honda': 'CB 125F|CB 160F|CB 190R|CB 300R|CB 500F|XR 150L|XR 190L|XRE 190|XRE 300|CRF 300L|CBR 250R|CBR 500R|Navi|Wave 110|Dio|PCX 160|ADV 160|Elite 125|Africa Twin|Transalp',
    'AKT': 'NKD 125|TT 125|TT 150|TT 200|CR4 125|CR4 150|CR5 180|EVO NR 125|Dynamic Pro|Flex 125|Special 125|AK 200',
    'Suzuki': 'Gixxer 150|Gixxer 250|Gixxer SF|GN 125|AX4 110|Address 110|Burgman 125|Burgman 200|V-Strom 250|V-Strom 650|DR 150|GSX-R 150|Intruder 150|Hayate',
    'Bajaj': 'Pulsar NS 125|Pulsar NS 160|Pulsar NS 200|Pulsar N160|Pulsar N250|Pulsar 180|Pulsar RS 200|Dominar 250|Dominar 400|Boxer CT 100|Boxer CT 125|Discover 125|Platina 100',
    'TVS': 'Apache RTR 160|Apache RTR 200|Apache RR 310|Raider 125|Sport 100|NTORQ 125|Jupiter|Star City',
    'Kymco': 'Agility 125|Agility City|Agility Digital|Like 150|Xciting S 400|Downtown 350|AK 550',
    'Victory': 'Advance 100|Black 125|MRX 125|One 110',
    'Hero': 'Hunk 160R|Xpulse 200|Xtreme 160R|Ignitor 125|Eco Deluxe|Dash 125|Glamour',
    'KTM': 'Duke 200|Duke 250|Duke 390|Duke 790|RC 200|RC 390|Adventure 250|Adventure 390',
    'Royal Enfield': 'Classic 350|Bullet 350|Hunter 350|Meteor 350|Himalayan|Interceptor 650|Continental GT 650|Scram 411',
    'Kawasaki': 'Ninja 400|Ninja 650|Z400|Z650|Z900|Versys 650|KLX 230|Vulcan S',
    'Benelli': 'TNT 15|TNT 25|Leoncino 250|Leoncino 500|TRK 251|TRK 502|502C',
    'CFMoto': '250NK|300NK|450SR|650NK|800MT',
    'Vespa': 'Primavera 150|Sprint 150|GTS 300|LX 150',
    'BMW': 'G 310 R|G 310 GS|F 850 GS|R 1250 GS',
    'Triumph': 'Speed 400|Trident 660|Street Triple|Tiger 900|Bonneville',
    'Ducati': 'Monster|Scrambler|Multistrada|Panigale|Diavel',
    'Harley-Davidson': 'Iron 883|Street Bob|Fat Boy|Sportster S|Pan America',
    'Eléctrica': 'Super Soco|NIU|Yadea|Otra eléctrica',
  };
  Object.keys(MOTOS).forEach((k) => { MOTOS[k] = MOTOS[k].split('|'); });
  const OTRO = '__o';
  const mpOpts = (list, sel) => list.map((x) => `<option value="${esc(x)}" ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

  function mpHtml(id, val) {
    const v = (val || '').trim(), low = v.toLowerCase();
    let br = '', md = '', otro = '';
    for (const b of Object.keys(MOTOS)) {
      if (low === b.toLowerCase() || low.startsWith(b.toLowerCase() + ' ')) { br = b; md = v.slice(b.length).trim(); break; }
    }
    if (!br && v) { br = OTRO; otro = v; }
    else if (br && md) {
      const m = MOTOS[br].find((x) => x.toLowerCase() === md.toLowerCase());
      if (m) md = m; else { otro = md; md = OTRO; }
    }
    const showM = br && br !== OTRO, showO = br === OTRO || md === OTRO;
    return `<input type="hidden" id="${id}" data-mp="1" value="${esc(v)}">
<select class="mpb" onchange="mpChg('${id}',1)"><option value="">Marca…</option>${mpOpts(Object.keys(MOTOS), br)}<option value="${OTRO}" ${br === OTRO ? 'selected' : ''}>Otra marca…</option></select>
<select class="mpm" onchange="mpChg('${id}')" ${showM ? '' : 'hidden'}><option value="">Modelo…</option>${showM ? mpOpts(MOTOS[br], md) : ''}<option value="${OTRO}" ${md === OTRO ? 'selected' : ''}>Otro modelo…</option></select>
<input class="mpo" placeholder="${br === OTRO ? 'Escribe marca y modelo' : 'Escribe el modelo'}" value="${esc(otro)}" oninput="mpChg('${id}')" ${showO ? '' : 'hidden'}>`;
  }

  window.mpChg = function (id, brandChanged) {
    const h = document.getElementById(id), w = h && h.parentNode;
    if (!w) return;
    const sb = w.querySelector('.mpb'), sm = w.querySelector('.mpm'), so = w.querySelector('.mpo');
    const br = sb.value;
    if (brandChanged) {
      const known = br && br !== OTRO;
      sm.innerHTML = '<option value="">Modelo…</option>' + (known ? mpOpts(MOTOS[br], '') : '') + `<option value="${OTRO}">Otro modelo…</option>`;
      sm.hidden = !known;
      so.value = '';
    }
    const md = sm.value;
    so.hidden = !(br === OTRO || (br && md === OTRO));
    so.placeholder = br === OTRO ? 'Escribe marca y modelo' : 'Escribe el modelo';
    let val = '';
    if (br === OTRO) val = so.value.trim();
    else if (br) val = (br + ' ' + (md === OTRO ? so.value.trim() : md)).trim();
    h.value = val;
    if (id === 'fm') { S.f.moto = val; if (window.syncNext) syncNext(); }
  };

  function enhanceMoto() {
    ['fm', 'e3', 'w3'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.tagName !== 'INPUT' || el.type === 'hidden' || el.dataset.mp) return;
      const w = document.createElement('div');
      w.className = 'mp wide';
      w.innerHTML = mpHtml(id, el.value);
      el.replaceWith(w);
    });
  }
  new MutationObserver(enhanceMoto).observe(document.body, { childList: true, subtree: true });
  enhanceMoto();

  /* ---------- Combos con descuento (editables por el admin) ---------- */
  function combosHtml() {
    cfg.combos = cfg.combos || [];
    return `<div class="sec"><h2>Combos con descuento</h2><small>el descuento se aplica cuando el cliente elige todos los servicios del combo</small></div>
${cfg.combos.map((c, i) => `<div class="cd" style="margin-bottom:12px">
<div class="row s" style="grid-template-columns:1fr 90px 44px"><input value="${esc(c.n || '')}" placeholder="Nombre del combo" onchange="cmbSet(${i},'n',this.value)"><input type="number" min="0" max="100" value="${c.pct}" title="Descuento %" onchange="cmbSet(${i},'pct',this.value)"><button class="btn r" onclick="cmbDel(${i})">✕</button></div>
<small style="display:block;margin:8px 0 4px;opacity:.7">Servicios incluidos (mínimo 2) · descuento en %</small>
<div>${cfg.services.map((s) => `<label class="cb"><input type="checkbox" ${c.ids.includes(s.id) ? 'checked' : ''} onchange="cmbSvc(${i},'${s.id}',this.checked)"> ${esc(s.name)} · ${COP(s.price)}</label>`).join('')}</div>
</div>`).join('') || '<p class="empty">Aún no hay combos.</p>'}
<button class="btn g" onclick="cmbAdd()">+ Nuevo combo</button>`;
  }
  window.cmbSet = (i, k, v) => {
    if (!cfg.combos[i]) return;
    if (k === 'pct') { v = Math.max(0, Math.min(100, +v || 0)); }
    cfg.combos[i][k] = v; saveCfg();
  };
  window.cmbSvc = (i, id, on) => {
    const c = cfg.combos[i]; if (!c) return;
    c.ids = on ? [...new Set([...c.ids, id])] : c.ids.filter((x) => x !== id);
    saveCfg();
    if (c.ids.length < 2) toast('⚠️ Un combo necesita al menos 2 servicios para aplicarse');
  };
  window.cmbAdd = () => {
    cfg.combos.push({ n: 'Nuevo combo', ids: cfg.services.slice(0, 2).map((s) => s.id), pct: 10 });
    saveCfg(); render();
  };
  window.cmbDel = async (i) => {
    const c = cfg.combos[i]; if (!c) return;
    if (!await ask('¿Eliminar el combo <b>' + esc(c.n || '') + '</b>?', 'Sí, eliminar')) return;
    cfg.combos.splice(i, 1); saveCfg(); render();
  };
  // En Precios van los combos; en Ajustes se quita el bloque viejo y la opción de que empleados cobren
  const _ph = preciosHtml;
  preciosHtml = function () { return _ph() + combosHtml(); };
  const _ajx = ajHtml;
  ajHtml = function () {
    let h = _ajx();
    h = h.replace(/<div class="sec"><h2>Combos<\/h2>[\s\S]*?(?=<div class="sec"><h2>Cobro<\/h2>|$)/, '');
    h = h.replace(/<div class="sec"><h2>Cobro<\/h2>[\s\S]*$/, '');
    return h;
  };

  /* ---------- "Nueva cita": un solo lugar (Acciones rápidas del Resumen) + tecla N ---------- */
  const _t2 = tallerHtml;
  tallerHtml = function () {
    return _t2().replace(/<span onclick="walkin\(\)"[^>]*>\+ Nueva cita<\/span>/g, '');
  };

  /* ---------- Aviso al admin: moto lista (para cobrar) ---------- */
  let fin = null;
  setInterval(() => {
    if (!S.all || !isAdm()) return;
    const now = new Set(S.all.filter((b) => sg(b) >= 7).map((b) => b.id));
    if (fin === null) { fin = now; return; }
    const nuevos = S.all.filter((b) => now.has(b.id) && !fin.has(b.id) && b.pay !== 'ok');
    fin = now;
    if (!nuevos.length) return;
    nuevos.forEach((b) => toast('🏁 Moto lista: ' + b.name + ' · ' + (b.placa || '') + ' — por cobrar ' + COP(b.total)));
    beep();
  }, 1500);

  /* ---------- Ojito para ver/ocultar contraseñas ---------- */
  const eyeCss = document.createElement('style');
  eyeCss.textContent = `.pw{position:relative;display:block}.pw>input{width:100%;padding-right:46px}
.pw>button{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;cursor:pointer;font-size:18px;line-height:1;padding:8px;color:inherit;opacity:.75}`;
  document.head.appendChild(eyeCss);
  function addEyes() {
    document.querySelectorAll('input[type="password"]:not([data-eye])').forEach((el) => {
      el.dataset.eye = '1';
      const w = document.createElement('span');
      w.className = 'pw' + (el.classList.contains('wide') ? ' wide' : '');
      el.replaceWith(w);
      w.appendChild(el);
      const b = document.createElement('button');
      b.type = 'button'; b.tabIndex = -1; b.title = 'Mostrar u ocultar contraseña'; b.setAttribute('aria-label', 'Mostrar contraseña'); b.textContent = '👁';
      b.onclick = () => {
        const show = el.type === 'password';
        el.type = show ? 'text' : 'password';
        b.textContent = show ? '🙈' : '👁';
        b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        el.focus();
      };
      w.appendChild(b);
    });
  }
  new MutationObserver(addEyes).observe(document.body, { childList: true, subtree: true });
  addEyes();

  /* ---------- Pantalla de clientes (#pantalla): buscador por placa, solo lectura ---------- */
  const P = { q: '', rows: null, err: 0, last: Date.now(), tm: null };
  const pcss = document.createElement('style');
  pcss.textContent = `.pnl{max-width:820px;margin:10px auto 0;text-align:center}
.pnl h1{font-size:clamp(40px,7vw,72px);margin-bottom:6px}.pnl h1 span{color:var(--ac)}
#tq{font-size:clamp(26px,5vw,40px);text-align:center;letter-spacing:.12em;text-transform:uppercase;margin:18px 0;padding:18px}
.pnl .job{text-align:left}.pfoot{display:inline-block;margin-top:28px;font-size:12px;opacity:.45;color:inherit}`;
  document.head.appendChild(pcss);

  function pCard(b) {
    const c = sg(b);
    let msg, sub = '';
    if (b.wait) msg = '⏳ En lista de espera';
    else if (c < 0) msg = '⏳ Esperando turno';
    else if (c >= 7) msg = '🏁 ¡Tu moto está lista! Pasa a recogerla.';
    else {
      msg = STG[c][1] + ' ' + STG[c][0] + ' en curso';
      if (b.t0) sub = '⏱ Lleva ' + Math.max(0, Math.floor((Date.now() - b.t0) / 60000)) + ' min en el lavado';
    }
    const who = b.staff && !b.wait ? 'Te atiende <b>' + esc(sName(b.staff)) + '</b>' : '';
    return `<div class="job ${c >= 7 ? 'fin' : ''}"><div class="jh"><b>🏍️ ${esc(pk(P.q))}</b><span>${who}</span></div>${b.wait ? '' : stepper(b, false)}<p class="stl" style="font-size:22px;margin:12px 0 4px">${msg}</p>${sub ? `<p class="empty" style="margin:0">${sub}</p>` : ''}</div>`;
  }
  function pDraw() {
    const el = document.getElementById('pres');
    if (!el) return;
    const k = pk(P.q);
    if (k.length < 5) { el.innerHTML = '<p class="empty">Escribe la placa de tu moto para ver cómo va tu lavado.</p>'; return; }
    if (P.err) { el.innerHTML = '<div class="note">No pudimos consultar en este momento. Intenta de nuevo en unos segundos.</div>'; return; }
    if (P.rows === null) { el.innerHTML = '<p class="empty">Buscando…</p>'; return; }
    const hoy = ymd(new Date()), L = P.rows.filter((b) => b.date === hoy);
    el.innerHTML = L.length ? L.map(pCard).join('') : '<p class="empty">No encontramos un lavado de hoy con esa placa. Revisa que esté bien escrita.</p>';
  }
  async function pFetch() {
    const k = pk(P.q);
    if (k.length < 5) { pDraw(); return; }
    if (!window.sb) { P.err = 1; pDraw(); return; }
    try {
      let r = await sb.rpc('track_panel', { p_placa: k });
      if (r.error) r = await sb.rpc('track_booking', { p_placa: k });
      if (r.error) throw r.error;
      if (pk(P.q) === k) { P.rows = r.data || []; P.err = 0; }
    } catch (e) { P.err = 1; }
    pDraw();
  }
  window.pIn = function (el) {
    P.q = el.value; P.rows = null; P.err = 0; P.last = Date.now();
    clearTimeout(P.tm); pDraw();
    P.tm = setTimeout(pFetch, 350);
  };
  window.pGo = function () { clearTimeout(P.tm); P.last = Date.now(); pFetch(); };
  function renderPantalla() {
    const a = $('#app'), bar = $('#bar');
    bar.hidden = true;
    document.body.classList.remove('adm');
    if (!document.getElementById('tq')) {
      a.innerHTML = `<nav><img class="lg" src="${LG.d}" alt="Spa Motos 20IVI"></nav><div class="pnl"><h1>Sigue tu <span>moto</span></h1><p>Escribe la placa y mira en qué etapa va tu lavado.</p><input id="tq" placeholder="Placa (ej. ABC12D)" maxlength="8" autocomplete="off" autocapitalize="characters" value="${esc(P.q)}" oninput="pIn(this)" onkeydown="if(event.key==='Enter')pGo()"><div id="pres"></div><a class="pfoot" href="#taller">Acceso empleados</a></div>`;
    }
    pDraw();
  }
  // Se actualiza sola y, por privacidad, borra la placa tras 90 s sin usarse (tablet compartida)
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => { P.last = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    if (location.hash !== '#pantalla') return;
    if (P.q && Date.now() - P.last > 90000) {
      P.q = ''; P.rows = null; P.err = 0;
      const i = document.getElementById('tq'); if (i) i.value = '';
      pDraw(); return;
    }
    if (pk(P.q).length >= 5) pFetch();
  }, 8000);

  const _lk = linksHtml;
  linksHtml = function () {
    const u = ART + '#pantalla';
    const card = `<div class="cd lk"><div class="ic">📺</div><h3>Pantalla de clientes</h3><p>Para una tablet o TV del local: el cliente escribe su placa y ve su moto en vivo. No muestra datos privados ni permite cambiar nada.</p><code>${u}</code><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="cp('${u}')">Copiar</button></div></div>`;
    return _lk().replace('</div><div class="note">', card + '</div><div class="note">');
  };

  /* ---------- Atajos de teclado del panel admin ---------- */
  const KEYS = { r: 'res', a: 'ag', l: 'taller', c: 'caja', k: 'cli', p: 'rep', h: 'his', v: 'precios', e: 'equipo', b: 'bloq', w: 'link', j: 'aj', m: 'mem' };
  const KEYOF = {}; Object.keys(KEYS).forEach((k) => { KEYOF[KEYS[k]] = k; });
  window.kbHelp = function () {
    const o = document.getElementById('md'); if (o) o.remove();
    const m = document.createElement('div');
    m.id = 'md'; m.className = 'md';
    m.innerHTML = `<div class="mb"><h3 style="font-size:28px">Atajos de teclado</h3><div class="ticket" style="max-width:none"><div><span>Nueva cita</span><b>N</b></div>${ADM.filter(Boolean).map((t) => `<div><span>${t[1]}</span><b>${(KEYOF[t[0]] || '').toUpperCase()}</b></div>`).join('')}<div><span>Esta ayuda</span><b>?</b></div><div><span>Cerrar ventana</span><b>Esc</b></div></div><p class="empty">Funcionan cuando no estás escribiendo en un campo. Ctrl+N lo reserva el navegador (abre otra ventana), por eso se usa N sola.</p><button class="btn g" onclick="document.getElementById('md').remove()">Cerrar</button></div>`;
    document.body.appendChild(m);
  };
  addEventListener('keydown', (e) => {
    if (!isAdminView() || !isAdm() || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.altKey && k !== 'n') return;
    if (k === '?') { e.preventDefault(); kbHelp(); return; }
    if (document.getElementById('md')) return;
    if (k === 'n') { e.preventDefault(); walkin(); return; }
    if (!e.altKey && KEYS[k]) { e.preventDefault(); S.tab = KEYS[k]; render(); }
  });

  /* ---------- Render: rutas nuevas y retoques del panel ---------- */
  const _r = render;
  render = function () {
    if (location.hash === '#pantalla') { renderPantalla(); return; }
    if (location.hash === '#taller' && isAdm()) { S.tab = 'taller'; location.hash = '#admin'; return; }
    _r();
    document.querySelectorAll('.tb > .btn[onclick="walkin()"]').forEach((x) => x.remove());
    const tb = document.querySelector('.tb');
    if (tb && isAdm() && 'Notification' in window && Notification.permission === 'default' && !document.getElementById('nbtn')) {
      tb.insertAdjacentHTML('beforeend', '<button class="btn g" id="nbtn" onclick="enableNotif()">🔔 Activar avisos</button>');
    }
    const sbu = document.querySelector('.sbu');
    if (sbu && !sbu.querySelector('.kbh')) sbu.insertAdjacentHTML('afterbegin', '<button class="ni kbh" onclick="kbHelp()"><i>⌨</i><span>Atajos (?)</span></button>');
  };
  render();
})();
