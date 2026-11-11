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
${c >= 7 ? `<a class="pill" style="display:inline-block;margin-top:8px;color:inherit" target="_blank" href="https://wa.me/${wd(b.phone)}?text=${encodeURIComponent('Hola ' + b.name + ', tu moto ya está lista en Spa Motos 20IVI 🏍️✨')}">Avisar por WhatsApp</a>` : ''}
<small class="ron">Las etapas y el cobro los maneja el empleado.</small></div>`;
  }

  /* ---------- 5. Servicios completados (archivo por persona) ---------- */
  function doneCard(b, mode) {
    const paid = b.pay === 'ok', canPay = mode === 'staff' && cfg.set.sc !== false;
    const end = b.tEnd || b.t7;
    return `<div class="job fin"><div class="jh"><b>${lab(b.start)} · ${esc(mode === 'staff' ? b.name.split(' ')[0] : b.name)}</b><span>🔖 ${esc(b.placa || '—')} · 🏍️ ${esc(b.moto || '—')}</span></div>
<small class="sv">${b.svc.map(esc).join(', ')} · ${COP(b.total)}${end ? ' · 🏁 ' + hhmm(end) : ''}</small>
<div class="ro">${paid ? `<span class="badge ok">✅ Pagado${b.pm ? ' · ' + esc(b.pm) : ''}</span>` : '<span class="badge">💰 Por cobrar</span>'}</div>
${!paid && canPay ? `<button class="btn" style="margin-top:8px" onclick="payB('${b.id}')">💰 Cobrar ${COP(b.total)}</button>` : ''}
${mode === 'adm' ? `<div class="acts"><span onclick="detB('${b.id}')">🔎 Detalle</span><span onclick="sendRcp('${b.id}')">🧾 Recibo</span></div>` : ''}</div>`;
  }

  function doneSec(list, mode, key) {
    if (!list.length) return '';
    const un = list.filter((b) => b.pay !== 'ok').length;
    S.dnOpen = S.dnOpen || {};
    const open = S.dnOpen[key] !== undefined ? S.dnOpen[key] : (mode === 'staff' && un > 0);
    return `<details class="dnsec" ${open ? 'open' : ''} ontoggle="S.dnOpen=S.dnOpen||{};S.dnOpen['${key}']=this.open"><summary>✅ Servicios completados (${list.length})${un ? ` · ${un} por cobrar` : ''}</summary>${list.map((b) => doneCard(b, mode)).join('')}</details>`;
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

  // Seguro extra: el administrador no cambia etapas
  const _ss = window.setStg;
  window.setStg = function (id, i) {
    if (isAdm()) { toast('Solo los empleados pueden cambiar las etapas del lavado'); return; }
    return _ss.apply(this, arguments);
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

  /* ---------- botón "Activar avisos" en el panel del admin ---------- */
  const _r = render;
  render = function () {
    _r();
    const tb = document.querySelector('.tb');
    if (tb && isAdm() && 'Notification' in window && Notification.permission === 'default' && !document.getElementById('nbtn')) {
      tb.insertAdjacentHTML('beforeend', '<button class="btn g" id="nbtn" onclick="enableNotif()">🔔 Activar avisos</button>');
    }
  };
  render();
})();
