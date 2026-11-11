/* Spa Motos 20IVI · extras (se carga después de mejoras.js)
   1. Placa válida (formato colombiano de moto)
   2. Política de tratamiento de datos (Ley 1581) con casilla de aceptación
   3. Mapa animado en la pestaña Sede
   4. Reporte por empleado en Excel o PDF
   5. Membresías (planes, venta, uso al cobrar, página para clientes)
   6. Recordatorios de cita para mañana por WhatsApp
   7. Avisos con la página cerrada (Web Push) */
(function () {
  'use strict';

  const isAdm = () => !!(S.auth && S.auth.role === 'admin');
  const adminView = () => location.hash === '#admin';
  const clientView = () => !['#admin', '#taller', '#pantalla'].includes(location.hash);
  const hasDb = () => typeof db !== 'undefined' && !!db;
  const enc = encodeURIComponent;
  const today = () => ymd(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const loaded = {};
  const loadScript = (u) => new Promise((ok, no) => {
    if (loaded[u]) return ok();
    const s = document.createElement('script');
    s.src = u; s.onload = () => { loaded[u] = 1; ok(); }; s.onerror = () => no(new Error('No se pudo cargar ' + u));
    document.head.appendChild(s);
  });
  const loadCss = (u) => new Promise((ok) => {
    if (loaded[u]) return ok();
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = u; l.onload = () => { loaded[u] = 1; ok(); }; l.onerror = () => ok();
    document.head.appendChild(l);
  });
  const modal = (html, wide) => {
    const o = document.getElementById('md'); if (o) o.remove();
    const m = document.createElement('div');
    m.id = 'md'; m.className = 'md';
    m.innerHTML = `<div class="mb" style="max-height:88vh;overflow:auto${wide ? ';max-width:720px' : ''}">${html}</div>`;
    document.body.appendChild(m);
  };
  const closeBtn = '<button class="btn g" onclick="document.getElementById(\'md\').remove()">Cerrar</button>';

  const css = document.createElement('style');
  css.textContent = `
.legal{text-align:center;margin:26px 0 8px;font-size:13px;opacity:.7}.legal a{cursor:pointer;text-decoration:underline;color:inherit}
.pol h4{margin:16px 0 4px;font-size:16px}.pol p,.pol li{font-size:14px;line-height:1.5;opacity:.9;margin:4px 0}.pol ul{padding-left:20px;margin:4px 0}
#fplh{display:block;font-size:13px;color:#ffb08f;margin:-4px 0 0}
.sm-wrap #sedemap{height:min(62vh,400px);border-radius:22px;overflow:hidden;border:1px solid #ffffff30;background:#0b2cb1}
.sm-btns{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}
.sm-pin{background:none;border:0}
.sm-pin b{position:absolute;left:0;right:0;top:0;font-size:36px;text-align:center;line-height:1;animation:smdrop .9s cubic-bezier(.2,.9,.3,1.3) both;filter:drop-shadow(0 6px 6px #0006)}
.sm-pin .ring{position:absolute;left:50%;bottom:6px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#1951fcaa;animation:smping 2s ease-out infinite}
.sm-pin .r2{animation-delay:1s}
@keyframes smdrop{from{transform:translateY(-120px) scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes smping{0%{transform:scale(.4);opacity:.9}100%{transform:scale(5);opacity:0}}
.mem-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end}
.rem-row{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e3ebfb;flex-wrap:wrap}`;
  document.head.appendChild(css);

  /* ================= 1. Placa válida ================= */
  const PLACA = /^[A-Z]{3}\d{2}[A-Z]?$/;
  const placaOk = (v) => PLACA.test(pk(v || ''));
  const PLACA_MSG = 'La placa debe tener 3 letras, 2 números y 1 letra (ej. ABC12D)';

  function applyNext() {
    if (!clientView() || S.page !== 'reserva' || S.step !== 2 || S.done) return;
    const n = document.getElementById('next');
    const bad = !placaOk(S.f.placa) || !S.f.cons;
    if (n && bad) n.disabled = true;
    const h = document.getElementById('fplh');
    if (h) h.textContent = (S.f.placa && !placaOk(S.f.placa)) ? '⚠️ ' + PLACA_MSG : '';
  }
  const _sn = window.syncNext;
  window.syncNext = function () { if (_sn) _sn.apply(this, arguments); applyNext(); };

  const _cb = window.confirmBooking;
  window.confirmBooking = function () {
    if (!placaOk(S.f.placa)) return toast('⚠️ ' + PLACA_MSG);
    if (!S.f.cons) return toast('⚠️ Debes aceptar la política de tratamiento de datos');
    return _cb.apply(this, arguments);
  };

  ['saveW', 'saveB'].forEach((n) => {
    const f = window[n];
    if (typeof f !== 'function') return;
    window[n] = function () {
      const el = document.getElementById(n === 'saveW' ? 'w6' : 'e8');
      if (el && el.value.trim() && !placaOk(el.value)) { alert(PLACA_MSG); return; }
      return f.apply(this, arguments);
    };
  });

  /* ================= 2. Política de datos ================= */
  window.verPolitica = function () {
    const s = cfg.set || {};
    const resp = s.legal ? esc(s.legal) : 'Spa Motos 20IVI';
    const contacto = [s.wa ? 'WhatsApp +' + esc(s.wa) : '', s.mail ? esc(s.mail) : '', s.addr ? esc(s.addr) : ''].filter(Boolean).join(' · ') || 'los canales de contacto de esta página';
    modal(`<div class="pol"><h3 style="font-size:28px">Política de tratamiento de datos personales</h3>
<p class="empty">Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia) · Actualizada: noviembre de 2026</p>
<h4>1. Responsable</h4><p><b>${resp}</b>. Contacto: ${contacto}.</p>
<h4>2. Datos que recogemos</h4><ul><li>Nombre y número de celular.</li><li>Placa y descripción de la moto.</li><li>Servicios solicitados, fecha, hora, notas que tú escribas y pagos del servicio.</li></ul>
<h4>3. Para qué los usamos</h4><ul><li>Agendar y prestar el servicio de lavado.</li><li>Avisarte por WhatsApp o llamada sobre tu cita, recordatorios y cuando tu moto esté lista.</li><li>Expedir recibos, llevar el historial de tus servicios y aplicar descuentos o membresías.</li><li>Mejorar nuestro servicio. No vendemos tus datos ni los usamos para publicidad de terceros.</li></ul>
<h4>4. Tus derechos</h4><p>Puedes conocer, actualizar y rectificar tus datos; pedir prueba de tu autorización; saber cómo los usamos; revocar la autorización y solicitar que los eliminemos (cuando no exista un deber legal de conservarlos); y presentar quejas ante la Superintendencia de Industria y Comercio.</p>
<h4>5. Cómo ejercer tus derechos</h4><p>Escríbenos por ${contacto}. Atendemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.</p>
<h4>6. Seguridad y proveedores</h4><p>Tus datos se guardan en un servicio de base de datos en la nube con conexión cifrada y acceso restringido al personal autorizado. Usamos WhatsApp para comunicarnos contigo; sus condiciones son las de ese servicio.</p>
<h4>7. Conservación</h4><p>Conservamos tus datos mientras sigas usando el servicio y por el tiempo que exija la ley. Este servicio no está dirigido a menores de edad.</p>
<h4>8. Autorización</h4><p>Al marcar la casilla al reservar, autorizas de forma libre, previa e informada el tratamiento de tus datos según esta política.</p>
<div style="margin-top:14px">${closeBtn}</div></div>`, true);
  };

  /* ================= 3. Mapa animado en Sede ================= */
  const LCSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  const LJS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  let smAnimated = false, smMap = null;

  function parseLoc(t) {
    t = String(t || '').trim();
    const m = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/) ||
      t.match(/^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/);
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }
  window.setLoc = function (v) {
    v = (v || '').trim();
    if (!v) { delete cfg.set.lat; delete cfg.set.lng; cfg.set.loc = ''; saveCfg(); toast('Ubicación borrada'); return render(); }
    const p = parseLoc(v);
    if (!p) return toast('⚠️ No pude leer la ubicación. Abre Google Maps, haz clic derecho sobre el local y copia los números de arriba (ej. 4.6097, -74.0817)');
    cfg.set.lat = p.lat; cfg.set.lng = p.lng; cfg.set.loc = v;
    saveCfg(); toast('✅ Ubicación guardada'); render();
  };
  async function geocode(addr) {
    const k = 'sm_geo:' + addr, c = ls.get(k);
    if (c) { try { return JSON.parse(c); } catch (e) {} }
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=' + enc(addr));
      const j = await r.json();
      if (j && j[0]) { const p = { lat: +j[0].lat, lng: +j[0].lon }; ls.set(k, JSON.stringify(p)); return p; }
    } catch (e) {}
    return null;
  }
  async function sedeMap() {
    if (S.page !== 'sede' || !clientView()) return;
    const ph = document.querySelector('.map');
    if (!ph) return;
    const addr = cfg.set.addr || '';
    let pt = cfg.set.lat && cfg.set.lng ? { lat: +cfg.set.lat, lng: +cfg.set.lng } : null;
    const box = document.createElement('div');
    box.className = 'sm-wrap';
    box.innerHTML = '<div id="sedemap"></div>';
    ph.replaceWith(box);
    if (!pt && addr) pt = await geocode(addr);
    if (!document.body.contains(box)) return;
    if (!pt) {
      box.innerHTML = `<div class="cd"><div class="ic">📍</div><h3>${esc(addr || 'Ubicación por confirmar')}</h3>${addr ? `<a class="btn" style="text-decoration:none" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${enc(addr)}">Abrir en Google Maps</a>` : ''}</div>`;
      return;
    }
    try { await Promise.all([loadCss(LCSS), loadScript(LJS)]); } catch (e) {
      box.innerHTML = `<div class="cd"><div class="ic">📍</div><h3>${esc(addr)}</h3><a class="btn" style="text-decoration:none" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}">Abrir en Google Maps</a></div>`;
      return;
    }
    if (!document.body.contains(box)) return;
    if (smMap) { try { smMap.remove(); } catch (e) {} }
    const el = box.querySelector('#sedemap');
    const first = !smAnimated;
    smAnimated = true;
    const map = smMap = L.map(el, { scrollWheelZoom: false }).setView(first ? [4.6, -74.1] : [pt.lat, pt.lng], first ? 6 : 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    const icon = L.divIcon({ className: 'sm-pin', html: '<span class="ring"></span><span class="ring r2"></span><b>📍</b>', iconSize: [44, 44], iconAnchor: [22, 40], popupAnchor: [0, -38] });
    const mk = L.marker([pt.lat, pt.lng], { icon }).addTo(map).bindPopup(`<b>Spa Motos 20IVI</b>${addr ? '<br>' + esc(addr) : ''}`);
    if (first) {
      setTimeout(() => { map.flyTo([pt.lat, pt.lng], 17, { duration: 3 }); map.once('moveend', () => { mk.openPopup(); map.scrollWheelZoom.enable(); }); }, 700);
    } else { mk.openPopup(); map.scrollWheelZoom.enable(); }
    box.insertAdjacentHTML('beforeend', `<div class="sm-btns"><a class="btn" style="text-decoration:none" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}&travelmode=driving">🧭 Cómo llegar</a><a class="btn g" style="text-decoration:none" target="_blank" href="https://waze.com/ul?ll=${pt.lat},${pt.lng}&navigate=yes">Abrir en Waze</a></div>`);
  }

  /* ================= 4. Reporte por empleado (Excel / PDF) ================= */
  const monthStart = () => { const d = new Date(); d.setDate(1); return ymd(d); };
  const er = () => S.er || (S.er = { from: monthStart(), to: today(), who: 'all' });
  const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);

  function repData() {
    const e = er(), com = (+cfg.set.com || 0) / 100;
    const L = (S.all || []).filter((b) => !b.wait && b.staff && b.date >= e.from && b.date <= e.to && (e.who === 'all' || b.staff === e.who))
      .sort((a, c) => (a.date === c.date ? a.start - c.start : a.date < c.date ? -1 : 1));
    const rows = cfg.staff.filter((p) => e.who === 'all' || p.id === e.who).map((p) => {
      const m = L.filter((b) => b.staff === p.id), paid = m.filter((b) => b.pay === 'ok'), cob = sum(paid, (b) => b.total);
      return { name: p.name, asignados: m.length, completados: m.filter((b) => sg(b) >= 7).length, cobrados: paid.length, facturado: sum(m, (b) => b.total), cobrado: cob, comision: Math.round(cob * com) };
    });
    const det = L.map((b) => ({
      fecha: b.date, hora: lab(b.start), empleado: sName(b.staff), cliente: b.name, placa: b.placa || '', moto: b.moto || '',
      servicios: (b.svc || []).join(', '), estado: sg(b) < 0 ? 'Pendiente' : sg(b) >= 7 ? 'Lista' : STG[sg(b)][0],
      total: +b.total || 0, pago: b.pay === 'ok' ? 'Pagado' : 'Pendiente', forma: b.pm || '',
    }));
    return { e, com: +cfg.set.com || 0, rows, det };
  }
  const RH_ = ['Empleado', 'Servicios asignados', 'Completados', 'Cobrados', 'Facturado', 'Cobrado', 'Comisión'];
  const DH_ = ['Fecha', 'Hora', 'Empleado', 'Cliente', 'Placa', 'Moto', 'Servicios', 'Estado', 'Total', 'Pago', 'Forma de pago'];
  const rowArr = (r) => [r.name, r.asignados, r.completados, r.cobrados, r.facturado, r.cobrado, r.comision];
  const detArr = (d) => [d.fecha, d.hora, d.empleado, d.cliente, d.placa, d.moto, d.servicios, d.estado, d.total, d.pago, d.forma];
  const totRow = (rows) => ['TOTAL', sum(rows, (r) => r.asignados), sum(rows, (r) => r.completados), sum(rows, (r) => r.cobrados), sum(rows, (r) => r.facturado), sum(rows, (r) => r.cobrado), sum(rows, (r) => r.comision)];

  function empRepHtml() {
    const e = er(), D = repData();
    return `<div class="sec"><h2>Reporte por empleado</h2><small>elige el rango y descárgalo en Excel o PDF</small></div>
<div class="cd"><div class="f"><label style="font-size:13px;color:var(--mut)">Desde<input type="date" value="${e.from}" onchange="S.er.from=this.value;render()"></label><label style="font-size:13px;color:var(--mut)">Hasta<input type="date" value="${e.to}" onchange="S.er.to=this.value;render()"></label><label style="font-size:13px;color:var(--mut)">Empleado<select onchange="S.er.who=this.value;render()"><option value="all">Todos</option>${cfg.staff.map((p) => `<option value="${p.id}" ${e.who === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
<div class="tw" style="margin-top:12px"><table class="tbl"><thead><tr>${RH_.map((h) => `<th>${h}${h === 'Comisión' ? ' (' + D.com + '%)' : ''}</th>`).join('')}</tr></thead><tbody>${D.rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${r.asignados}</td><td>${r.completados}</td><td>${r.cobrados}</td><td>${COP(r.facturado)}</td><td>${COP(r.cobrado)}</td><td><b>${COP(r.comision)}</b></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sin empleados.</td></tr>'}</tbody></table></div>
<p class="empty" style="margin:8px 0">La comisión se calcula sobre lo ya cobrado. ${D.det.length} servicio(s) en el rango.</p>
<button class="btn" onclick="expMenu()">⬇ Exportar…</button></div>`;
  }
  const _rep = repHtml;
  repHtml = function () { return _rep() + empRepHtml(); };

  window.expMenu = function () {
    modal(`<h3 style="font-size:30px">Exportar reporte</h3><p class="empty">Elige el formato del archivo.</p><div class="cards" style="grid-template-columns:1fr 1fr;margin:12px 0"><button class="btn" onclick="expEmp('xlsx')">📗 Excel (.xlsx)</button><button class="btn" onclick="expEmp('pdf')">📕 PDF</button></div>${closeBtn}`);
  };
  const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const PDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  const ATB_URL = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js';

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function csvFallback(D, base) {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const t = [RH_, ...D.rows.map(rowArr), totRow(D.rows), [], DH_, ...D.det.map(detArr)].map((r) => r.map(q).join(';')).join('\r\n');
    download(base + '.csv', new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }));
  }
  window.expEmp = async function (fmt) {
    const D = repData(), base = `reporte-empleados_${D.e.from}_${D.e.to}`;
    const m = document.getElementById('md'); if (m) m.remove();
    try {
      if (fmt === 'xlsx') {
        await loadScript(XLSX_URL);
        const wb = XLSX.utils.book_new();
        const w1 = XLSX.utils.aoa_to_sheet([['Reporte por empleado · Spa Motos 20IVI'], ['Desde', D.e.from, 'Hasta', D.e.to, 'Comisión %', D.com], [], RH_, ...D.rows.map(rowArr), totRow(D.rows)]);
        w1['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 13 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        const w2 = XLSX.utils.aoa_to_sheet([DH_, ...D.det.map(detArr)]);
        w2['!cols'] = [{ wch: 11 }, { wch: 7 }, { wch: 16 }, { wch: 22 }, { wch: 9 }, { wch: 18 }, { wch: 34 }, { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, w1, 'Resumen');
        XLSX.utils.book_append_sheet(wb, w2, 'Detalle');
        XLSX.writeFile(wb, base + '.xlsx');
      } else {
        await loadScript(PDF_URL); await loadScript(ATB_URL);
        const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16); doc.text('Reporte por empleado · Spa Motos 20IVI', 14, 16);
        doc.setFontSize(10); doc.text(`Del ${D.e.from} al ${D.e.to} · Comisión ${D.com}% sobre lo cobrado`, 14, 23);
        const money = (n) => '$ ' + Math.round(n).toLocaleString('es-CO');
        const fm = (r) => [r[0], r[1], r[2], r[3], money(r[4]), money(r[5]), money(r[6])];
        doc.autoTable({ startY: 28, head: [RH_], body: [...D.rows.map(rowArr).map(fm), fm(totRow(D.rows))], headStyles: { fillColor: [3, 25, 91] }, styles: { fontSize: 9 } });
        doc.autoTable({ startY: doc.lastAutoTable.finalY + 10, head: [DH_], body: D.det.map(detArr).map((r) => { r[8] = money(r[8]); return r; }), headStyles: { fillColor: [25, 81, 252] }, styles: { fontSize: 8 } });
        doc.save(base + '.pdf');
      }
      toast('✅ Reporte descargado');
    } catch (e) {
      csvFallback(D, base);
      toast('⚠️ No pude generar ' + (fmt === 'xlsx' ? 'el Excel' : 'el PDF') + ' (¿sin internet?). Descargué un CSV que abre en Excel.');
    }
  };

  /* ================= 5. Membresías ================= */
  const plans = () => cfg.plans || (cfg.plans = []);
  const ADMTAB = ['mem', 'Membresías', '🎟'];
  if (!ADM.some((t) => t && t[0] === 'mem')) {
    const i = ADM.findIndex((t) => t && t[0] === 'cli');
    ADM.splice(i < 0 ? ADM.length : i + 1, 0, ADMTAB);
  }
  TT.mem = ['Membresías', 'Planes prepagados y su uso'];

  let memW = false;
  function watchMem() {
    if (memW || !hasDb() || !isAdm()) return;
    memW = true;
    db.collection('members').onSnapshot((q) => {
      S.mem = q.docs.map((d) => d.data());
      if (adminView() && S.tab === 'mem' && !document.getElementById('md') && !typing()) render();
    }, () => { S.mem = null; });
  }
  setInterval(watchMem, 1500);

  const memActive = (m) => m.st !== 'off' && (m.used || 0) < (m.uses || 0) && m.end >= today();
  const memFor = (placa) => (S.mem || []).find((m) => m.placa === pk(placa || '') && memActive(m));

  window.planAdd = () => { plans().push({ id: 'p' + Date.now().toString(36), n: 'Plan mensual', price: 80000, uses: 4, days: 30, d: '4 lavados al mes' }); saveCfg(); render(); };
  window.planSet = (i, k, v) => { const p = plans()[i]; if (!p) return; p[k] = ['price', 'uses', 'days'].includes(k) ? Math.max(0, +v || 0) : v; saveCfg(); };
  window.planDel = async (i) => {
    const p = plans()[i]; if (!p) return;
    if (!await ask('¿Eliminar el plan <b>' + esc(p.n) + '</b>? Las membresías ya vendidas siguen vigentes.', 'Sí, eliminar')) return;
    plans().splice(i, 1); saveCfg(); render();
  };
  window.memSell = async () => {
    const g = (id) => document.getElementById(id).value;
    const p = plans().find((x) => x.id === g('ms-plan')), placa = pk(g('ms-pl')), name = g('ms-name').trim();
    if (!p) return toast('⚠️ Primero crea un plan');
    if (!placaOk(placa)) return toast('⚠️ ' + PLACA_MSG);
    if (name.length < 2) return toast('⚠️ Escribe el nombre del cliente');
    if (!hasDb()) return toast('⚠️ Sin conexión con la base de datos');
    const dup = (S.mem || []).find((m) => m.placa === placa && m.planId === p.id && memActive(m));
    if (dup && !await ask('Esa placa ya tiene este plan vigente. ¿Vender otro de todos modos?', 'Sí, vender')) return;
    const id = 'm' + Date.now().toString(36), t = today();
    await db.collection('members').doc(id).set({ id, placa, name, phone: g('ms-ph').trim(), planId: p.id, planName: p.n, price: p.price, uses: p.uses, used: 0, start: t, end: addDays(t, p.days), pm: g('ms-pm'), created: Date.now(), st: 'on' });
    toast('✅ Membresía registrada'); render();
  };
  window.memAdj = async (id, d) => {
    const m = (S.mem || []).find((x) => x.id === id); if (!m || !hasDb()) return;
    await db.collection('members').doc(id).update({ used: Math.max(0, Math.min(m.uses, (m.used || 0) + d)) });
  };
  window.memOff = async (id) => {
    if (!await ask('¿Cancelar esta membresía? Ya no podrá usarse.', 'Sí, cancelar')) return;
    await db.collection('members').doc(id).update({ st: 'off' });
  };

  function memHtml() {
    const P = plans(), M = S.mem || [], t = today();
    const act = M.filter(memActive).sort((a, c) => (a.end < c.end ? -1 : 1)), old = M.filter((m) => !memActive(m)).sort((a, c) => (c.created || 0) - (a.created || 0));
    const mes = M.filter((m) => (m.start || '') >= t.slice(0, 7) + '-01');
    const inp = 'style="font-size:13px;color:var(--mut)"';
    return `<div class="sec"><h2>Planes</h2><small>lo que ofreces a clientes frecuentes</small></div>
${P.map((p, i) => `<div class="cd" style="margin-bottom:10px"><div class="mem-row"><label ${inp}>Nombre<input value="${esc(p.n)}" onchange="planSet(${i},'n',this.value)"></label><label ${inp}>Precio (COP)<input type="number" value="${p.price}" onchange="planSet(${i},'price',this.value)"></label><label ${inp}>Lavados incluidos<input type="number" value="${p.uses}" onchange="planSet(${i},'uses',this.value)"></label><label ${inp}>Vigencia (días)<input type="number" value="${p.days}" onchange="planSet(${i},'days',this.value)"></label></div><div class="f" style="margin-top:8px;grid-template-columns:1fr auto"><input value="${esc(p.d || '')}" placeholder="Descripción corta (la ve el cliente)" onchange="planSet(${i},'d',this.value)"><button class="btn r" onclick="planDel(${i})">✕</button></div></div>`).join('') || '<p class="empty">Aún no hay planes. Crea el primero.</p>'}
<button class="btn g" onclick="planAdd()">+ Nuevo plan</button>
<div class="sec"><h2>Vender una membresía</h2><small>queda ligada a la placa</small></div>
<div class="cd">${P.length ? `<div class="mem-row"><label ${inp}>Plan<select id="ms-plan">${P.map((p) => `<option value="${p.id}">${esc(p.n)} · ${COP(p.price)}</option>`).join('')}</select></label><label ${inp}>Placa<input id="ms-pl" placeholder="ABC12D" maxlength="8" style="text-transform:uppercase"></label><label ${inp}>Nombre<input id="ms-name" placeholder="Cliente"></label><label ${inp}>Celular<input id="ms-ph" inputmode="tel" placeholder="300 123 4567"></label><label ${inp}>Pagó con<select id="ms-pm">${(cfg.pm || []).map((x) => `<option>${esc(x.n)}</option>`).join('')}</select></label></div><button class="btn" style="margin-top:10px" onclick="memSell()">Registrar venta</button>` : '<p class="empty">Crea un plan para poder venderlo.</p>'}</div>
<div class="sec"><h2>Membresías activas</h2><small>${act.length} vigente(s) · ${mes.length} vendida(s) este mes por ${COP(sum(mes, (m) => m.price))}</small></div>
<div class="cd"><div class="tw"><table class="tbl"><thead><tr><th>Cliente</th><th>Placa</th><th>Plan</th><th>Usos</th><th>Vence</th><th></th></tr></thead><tbody>${act.map((m) => `<tr><td>${esc(m.name)}<br><small>${esc(m.phone || '')}</small></td><td>${esc(m.placa)}</td><td>${esc(m.planName)}</td><td><b>${m.used || 0}/${m.uses}</b> <small>(quedan ${m.uses - (m.used || 0)})</small></td><td>${m.end}</td><td style="white-space:nowrap"><button class="pill" onclick="memAdj('${m.id}',1)">+1 uso</button> <button class="pill" onclick="memAdj('${m.id}',-1)">−1</button> <button class="pill" onclick="memOff('${m.id}')">Cancelar</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No hay membresías activas.</td></tr>'}</tbody></table></div></div>
${old.length ? `<details class="dnsec" style="margin-top:12px"><summary>Vencidas, agotadas o canceladas (${old.length})</summary>${old.map((m) => `<div class="rem-row"><span><b>${esc(m.name)}</b> · ${esc(m.placa)} · ${esc(m.planName)}</span><small>${m.used || 0}/${m.uses} · ${m.st === 'off' ? 'cancelada' : (m.used || 0) >= m.uses ? 'agotada' : 'vencida ' + m.end}</small></div>`).join('')}</details>` : ''}`;
  }
  const _ab = admBody;
  admBody = function () { return S.tab === 'mem' ? memHtml() : _ab(); };

  // Al cobrar: si la placa tiene membresía vigente, ofrecer usarla
  const _pv = window.payView;
  window.payView = function (id, mi) {
    _pv.apply(this, arguments);
    if (mi !== null) return;
    const b = (S.all || []).find((x) => x.id === id), el = document.getElementById('pb'), m = b && memFor(b.placa);
    if (!el || !m || b.pay === 'ok') return;
    const per = m.uses ? Math.round(m.price / m.uses) : 0;
    const c = el.querySelector('.cards');
    if (c) c.insertAdjacentHTML('beforebegin', `<div class="note" style="color:var(--tx)">🎟 Tiene la membresía <b>${esc(m.planName)}</b> · quedan <b>${m.uses - (m.used || 0)}</b> de ${m.uses} (vence ${m.end})</div><button class="btn" style="margin-bottom:10px;width:100%" onclick="useMem('${m.id}','${id}')">🎟 Cobrar con membresía</button>`);
  };
  window.useMem = async (mid, bid) => {
    const b = (S.all || []).find((x) => x.id === bid), m = (S.mem || []).find((x) => x.id === mid);
    if (!b || !m || !hasDb()) return;
    const per = m.uses ? Math.round(m.price / m.uses) : 0;
    await db.collection('bookings').doc(bid).update({ pay: 'ok', pm: 'Membresía', paidAt: Date.now(), memId: mid, totalOrig: b.total, total: per });
    await db.collection('members').doc(mid).update({ used: (m.used || 0) + 1, last: Date.now() });
    const x = document.getElementById('md'); if (x) x.remove();
    toast('🎟 Cobrado con membresía · quedan ' + (m.uses - (m.used || 0) - 1));
  };

  // Página pública de planes
  function planesHtml() {
    const L = plans(), wa = cfg.set.wa;
    return `<div class="pg"><h1>Mem<span>bresías</span></h1><p>Paga por adelantado y lava tu moto más barato, cuando quieras.</p><div class="cards">${L.map((p) => `<div class="cd"><div class="ic">🎟️</div><h3>${esc(p.n)}</h3><p>${esc(p.d || '')}</p><p><b style="color:var(--ac);font-size:30px">${COP(p.price)}</b><br><small>${p.uses} lavados · vigencia ${p.days} días${p.uses ? ' · ' + COP(p.price / p.uses) + ' por lavado' : ''}</small></p>${wa ? `<a class="btn" style="text-decoration:none" target="_blank" href="https://wa.me/${wd(wa)}?text=${enc('Hola, quiero la membresía ' + p.n + ' de Spa Motos 20IVI')}">Quiero este plan</a>` : ''}</div>`).join('') || '<p class="empty">Pronto tendremos planes.</p>'}</div></div>`;
  }
  const _pg2 = pages;
  pages = function () { return S.page === 'membresias' ? planesHtml() : _pg2(); };
  function syncTabs() {
    const i = TABS.findIndex((t) => t[0] === 'membresias'), want = plans().length > 0;
    if (want && i < 0) { const a = TABS.findIndex((t) => t[0] === 'aliados'); TABS.splice(a < 0 ? TABS.length : a + 1, 0, ['membresias', '🎟 Membresías']); }
    if (!want && i >= 0) { TABS.splice(i, 1); if (S.page === 'membresias') S.page = 'reserva'; }
  }

  /* ================= 6. Recordatorios para mañana ================= */
  const remList = () => { const tm = addDays(today(), 1); return (S.all || []).filter((b) => b.date === tm && !b.wait && b.staff).sort((a, c) => a.start - c.start); };
  window.remSend = (id) => {
    const b = (S.all || []).find((x) => x.id === id); if (!b) return;
    const f = b.name.split(' ')[0], dia = new Date(b.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const t = `Hola ${f}, te recordamos tu cita de mañana (${dia}) a las ${lab(b.start)} en Spa Motos 20IVI con ${sName(b.staff)} 🏍️✨. Si no puedes venir, avísanos por aquí. Recuerda que hay 10 minutos de tolerancia. ¡Te esperamos!`;
    window.open('https://wa.me/' + wd(b.phone) + '?text=' + enc(t), '_blank');
    if (hasDb()) db.collection('bookings').doc(id).update({ remD: Date.now() }).catch(() => {});
  };
  window.remNext = () => { const b = remList().find((x) => !x.remD); if (b) remSend(b.id); else toast('✅ Ya enviaste todos los recordatorios'); };
  function remHtml() {
    const L = remList(); if (!L.length) return '';
    const pend = L.filter((b) => !b.remD).length;
    return `<div class="pn" style="margin-bottom:14px"><div class="jh" style="align-items:center;margin-bottom:6px"><h3>Recordatorios para mañana</h3><span class="pill" style="cursor:pointer" onclick="remNext()">${pend ? `Enviar el siguiente (${pend})` : '✅ Todos enviados'}</span></div>${L.map((b) => `<div class="rem-row"><span><b>${lab(b.start)}</b> · ${esc(b.name)} <small>${esc(b.placa || '')}</small></span>${b.remD ? '<span class="badge ok">✅ Enviado</span>' : `<button class="pill" onclick="remSend('${b.id}')">📲 Enviar</button>`}</div>`).join('')}</div>`;
  }
  const _rs = resHtml;
  resHtml = function () { const c = remHtml(), h = _rs(); return c ? h.replace('<div class="dg">', c + '<div class="dg">') : h; };
  setInterval(() => { // 6:00 p. m.: aviso para enviar los recordatorios del día siguiente
    if (!isAdm()) return;
    const n = new Date(), k = 'sm_rem_' + today();
    if (n.getHours() < 18 || ls.get(k)) return;
    const p = remList().filter((b) => !b.remD).length;
    if (!p) return;
    ls.set(k, '1');
    toast('📲 Tienes ' + p + ' recordatorio(s) de mañana por enviar (Resumen)');
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Recordatorios de mañana', { body: p + ' cita(s) por recordar por WhatsApp', icon: 'assets/icon.png' }); } catch (e) {}
  }, 60000);

  /* ================= 7. Avisos con la página cerrada (Web Push) ================= */
  const VAPID = () => (window.APP_CONFIG && APP_CONFIG.VAPID_PUBLIC_KEY) || '';
  const u8 = (b64) => { const p = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  S.push = 'chk';
  async function pushState() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'nosup';
    if (!VAPID() || /TU_|PEGA/.test(VAPID())) return 'nokey';
    if (Notification.permission === 'denied') return 'denied';
    try { const r = await navigator.serviceWorker.getRegistration(); const s = r && await r.pushManager.getSubscription(); return s ? 'on' : 'off'; } catch (e) { return 'off'; }
  }
  async function pushRefresh() { const s = await pushState(); if (s !== S.push) { S.push = s; if (adminView() && S.tab === 'aj' && !typing()) render(); } }
  async function saveSub(sub) {
    const { data } = await sb.auth.getUser();
    if (!data || !data.user) throw new Error('Sin sesión');
    const { error } = await sb.from('push_subs').upsert({ endpoint: sub.endpoint, user_id: data.user.id, ua: navigator.userAgent.slice(0, 120) });
    if (error) throw error;
  }
  window.pushOn = async () => {
    try {
      if (S.push === 'nosup') return toast('Este navegador no permite avisos con la página cerrada. En iPhone, primero añade la página a la pantalla de inicio.');
      if (S.push === 'nokey') return toast('⚠️ Falta configurar la llave VAPID (mira la guía).');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { await pushRefresh(); return toast('No diste permiso para las notificaciones'); }
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID()) });
      await saveSub(sub);
      toast('✅ Listo: te avisaremos aunque la página esté cerrada');
    } catch (e) { toast('⚠️ ' + (e && e.message || 'No se pudo activar')); }
    pushRefresh(); render();
  };
  window.pushOff = async () => {
    try {
      const r = await navigator.serviceWorker.getRegistration(), s = r && await r.pushManager.getSubscription();
      if (s) { await sb.from('push_subs').delete().eq('endpoint', s.endpoint); await s.unsubscribe(); }
      toast('Avisos desactivados en este dispositivo');
    } catch (e) { toast('⚠️ ' + (e && e.message || 'No se pudo desactivar')); }
    pushRefresh(); render();
  };
  window.pushTest = () => {
    if (Notification.permission !== 'granted') return toast('Activa primero los avisos');
    navigator.serviceWorker.getRegistration().then((r) => r && r.showNotification('🛵 Nuevo servicio', { body: 'Así te llegará el aviso. Toca para abrir el panel.', icon: 'assets/icon.png', tag: 'prueba' }));
  };
  function pushBlock() {
    const st = S.push, txt = {
      chk: 'Revisando…', on: '✅ Activados en este dispositivo', off: 'Desactivados en este dispositivo', denied: '⛔ Bloqueados en el navegador (actívalos en los permisos del sitio)',
      nokey: '⚠️ Falta configurar la llave VAPID (guía paso 3)', nosup: 'Este navegador no los permite (en iPhone: añade la página a la pantalla de inicio)',
    }[st] || '';
    return `<div class="sec"><h2>Avisos con la página cerrada</h2><small>te avisa en el celular o computador cuando entra un servicio nuevo</small></div><div class="cd"><p>${txt}</p><div style="display:flex;gap:8px;flex-wrap:wrap">${st === 'off' ? '<button class="btn" onclick="pushOn()">🔔 Activar en este dispositivo</button>' : ''}${st === 'on' ? '<button class="btn g" onclick="pushTest()">Probar aviso</button><button class="btn r" onclick="pushOff()">Desactivar</button>' : ''}</div></div>`;
  }

  /* ---------- Ajustes: política, ubicación y avisos ---------- */
  const _ajy = ajHtml;
  ajHtml = function () {
    const s = cfg.set, f = (l, k, ph) => `<label style="color:var(--mut);font-size:13px">${l}<input value="${esc(s[k] || '')}" placeholder="${ph || ''}" onchange="cfg.set['${k}']=this.value;saveCfg()"></label>`;
    return _ajy() + `<div class="sec"><h2>Política de datos</h2><small>aparece en la política que ve el cliente</small></div><div class="f">${f('Razón social o nombre del responsable (y NIT)', 'legal', 'Ej. Spa Motos 20IVI S.A.S. · NIT 900.000.000-0')}${f('Correo de contacto', 'mail', 'contacto@tudominio.com')}</div><div class="acts"><span onclick="verPolitica()">👁 Ver la política como la ve el cliente</span></div>
<div class="sec"><h2>Ubicación en el mapa</h2><small>para la pestaña Sede</small></div><div class="f"><label style="color:var(--mut);font-size:13px">Coordenadas o enlace largo de Google Maps<input value="${esc(s.loc || '')}" placeholder="4.6097, -74.0817" onchange="setLoc(this.value)"></label></div><p class="empty">${s.lat ? '✅ Ubicación guardada: ' + (+s.lat).toFixed(5) + ', ' + (+s.lng).toFixed(5) : 'En Google Maps, haz clic derecho sobre tu local y toca los números de arriba para copiarlos. Si no pones nada, se intenta ubicar con la dirección.'}</p>` + pushBlock();
  };

  /* ---------- Render: piezas que van sobre la página del cliente ---------- */
  const _r = render;
  render = function () {
    syncTabs();
    _r();
    if (!clientView()) return;
    if (S.page === 'reserva' && S.step === 2 && !S.done) {
      const pl = document.getElementById('fpl');
      if (pl && !document.getElementById('fplh')) pl.insertAdjacentHTML('afterend', '<small id="fplh" class="wide"></small>');
      const fc = document.getElementById('fc');
      if (fc && !document.getElementById('consw')) {
        fc.parentNode.insertAdjacentHTML('beforeend', `<label class="cb wide" id="consw" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="cons" ${S.f.cons ? 'checked' : ''} onchange="S.f.cons=this.checked;syncNext()"> <span>Acepto la <a href="#" style="color:inherit;text-decoration:underline" onclick="verPolitica();return false">política de tratamiento de datos</a> (Ley 1581 de 2012).</span></label>`);
      }
      applyNext();
    }
    const a = document.getElementById('app');
    if (a && !a.querySelector('.legal')) a.insertAdjacentHTML('beforeend', '<p class="legal"><a onclick="verPolitica()">Política de tratamiento de datos</a></p>');
    if (S.page === 'sede') sedeMap();
  };

  // Atajo M → Membresías (se suma a los de mejoras.js)
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !adminView() || !isAdm() || document.getElementById('md')) return;
    const t = e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key.toLowerCase() === 'm') { e.preventDefault(); S.tab = 'mem'; render(); }
  });

  // Arranque: estado de los avisos y suscripción vigente
  setInterval(() => { if (isAdm()) pushRefresh(); }, 5000);
  (async () => {
    await new Promise((r) => setTimeout(r, 1500));
    if (isAdm() && window.sb && (await pushState()) === 'on') {
      try { const r = await navigator.serviceWorker.getRegistration(), s = r && await r.pushManager.getSubscription(); if (s) await saveSub(s); } catch (e) {}
    }
  })();

  render();
})();
