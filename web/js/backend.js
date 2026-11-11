/* Spa Motos 20IVI · enlaces con el backend seguro.
 *  - Visitantes: todo por funciones RPC validadas en el servidor (sin acceso a tablas).
 *  - Administrador y empleados: inicio de sesión real con Supabase Auth.
 *  - Equipo: altas, cambios de contraseña y bajas por Edge Function (solo admin).
 * Ninguna contraseña se guarda ni se muestra en la página.
 */
(function () {
  'use strict';
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  };
  const pk2 = (p) => (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ERR = {
    placa_invalida: 'Revisa la placa (5 a 8 letras o números).',
    nombre_invalido: 'Escribe tu nombre.',
    celular_invalido: 'Revisa el celular.',
    fecha_invalida: 'Fecha no válida.',
    fecha_fuera_de_rango: 'Esa fecha no está disponible.',
    persona_invalida: 'Elige una persona de lavado.',
    hora_invalida: 'Elige una hora válida.',
    hora_pasada: 'Esa hora ya pasó.',
    servicios_invalidos: 'Revisa los servicios elegidos.',
    limite_de_citas: 'Esta placa ya tiene el máximo de citas pendientes.',
    slot_ocupado: 'Ese horario acaba de ser tomado. Elige otro.',
    config_no_disponible: 'Servicio no disponible. Intenta más tarde.',
  };
  const emsg = (e) => {
    const m = String((e && e.message) || e || '');
    return ERR[m] || ERR[(m.match(/[a-z_]+$/) || [''])[0]] || 'No se pudo completar. Intenta de nuevo.';
  };

  // ---------- Configuración pública (sin el código de aliado) ----------
  async function loadPublic() {
    try {
      const d = await rpc('public_config');
      if (!d || !d.services) return;
      const key = JSON.stringify(d);
      if (key === window._pubKey) return;
      window._pubKey = key;
      cfg = { set: DEF.set, combos: DEF.combos, pm: DEF.pm, ...d };
      S.sel = new Set([...S.sel].filter((id) => cfg.services.some((x) => x.id === id)));
      render();
    } catch (e) {}
  }

  // ---------- Flujos del visitante (por RPC) ----------
  const _ws = window.watchSlots;
  window.watchSlots = function () {
    if (db) return _ws();
    unsub.forEach((u) => u());
    unsub = [];
    const load = async () => {
      try {
        const rows = await rpc('public_slots', { p_date: S.date });
        const set = new Set(rows.map((r) => r.staff + '_' + r.i));
        const key = [...set].sort().join();
        S.blk = new Set();
        if (key !== S._tk) { S._tk = key; S.taken = set; if (!S.done && !isAdminView()) render(); }
      } catch (e) {}
    };
    S._tk = null;
    load();
    const t = setInterval(load, 8000);
    unsub.push(() => clearInterval(t));
  };

  window.confirmBooking = async function () {
    const p = {
      svc: [...S.sel], date: S.date, staff: S.staff, start: S.slot,
      name: S.f.name, phone: S.f.phone, placa: S.f.placa,
      moto: S.f.moto || '', note: S.f.note || '', pmi: S.f.pmi || '', code: S.f.code || '',
    };
    try {
      S.done = await rpc('create_booking', { p });
      S.cdisc = 0;
      render();
    } catch (e) {
      toast('⚠️ ' + emsg(e));
      window.watchSlots();
    }
  };

  const _tw = window.trackWatch;
  window.trackWatch = function () {
    if (db) return _tw();
    uT();
    if (!S.tp) return;
    const k = pk2(S.tp);
    const load = async () => {
      try { S.mine = await rpc('track_booking', { p_placa: k }); if (S.page === 'mimoto' && !isAdminView()) render(); } catch (e) {}
    };
    load();
    const t = setInterval(load, 8000);
    uT = () => clearInterval(t);
  };

  const _lc = window.lookClient;
  window.lookClient = async function (v) {
    if (db) return _lc(v);
    const o = S.cdisc || 0;
    S.cdisc = 0;
    const k = pk2(v);
    if (k.length >= 5) {
      try {
        const pct = await rpc('client_discount', { p_placa: k });
        if (pct > 0) { S.cdisc = +pct; if (S.cdisc !== o) toast('🎁 ¡Tienes ' + S.cdisc + '% de descuento por ser cliente!'); }
      } catch (e) {}
    }
    if (o !== S.cdisc) render();
  };

  window.checkCode = async function (v) {
    v = (v || '').trim();
    S.f.code = v;
    S.ok = false;
    if (v) { try { S.ok = (await rpc('validate_ally', { p_code: v })) > 0; } catch (e) {} }
    render();
  };

  // ---------- Inicio de sesión real ----------
  const card = (t, p, extra) => `<div class="cd" style="max-width:420px;margin:40px auto;text-align:center"><h3>${t}</h3><p>${p}</p>${extra || ''}</div>`;
  window.loginHtml = function (kind) {
    const adm = kind === 'admin';
    if (adm && S.auth && S.auth.role !== 'admin') {
      return card('Sin permisos', 'Tu cuenta no tiene acceso de administrador.', '<button class="btn g" onclick="logout()">Salir</button>');
    }
    return `<div class="cd" style="max-width:420px;margin:30px auto"><div class="ic">🔐</div><h3>${adm ? 'Acceso de administrador' : 'Acceso de empleados'}</h3><p>Ingresa con tu usuario y contraseña.</p><div class="f" style="margin-top:12px;grid-template-columns:1fr"><input id="lu" placeholder="Usuario" autocapitalize="off" autocomplete="username"><input id="lp" type="password" placeholder="Contraseña" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin('${kind}')"></div><button class="btn" style="margin-top:12px;width:100%" onclick="doLogin('${kind}')">Entrar</button></div>`;
  };
  const LK = { n: 0, t: 0 };
  window.doLogin = async function (kind) {
    const u = $('#lu').value.trim().toLowerCase(), p = $('#lp').value;
    if (Date.now() < LK.t) return toast('Demasiados intentos. Espera un minuto.');
    if (!u || !p) return toast('Escribe usuario y contraseña');
    const { data, error } = await sb.auth.signInWithPassword({ email: AUTH_EMAIL(u), password: p });
    if (error) {
      LK.n++; if (LK.n >= 5) { LK.t = Date.now() + 60000; LK.n = 0; }
      return toast('Usuario o contraseña incorrectos');
    }
    const { data: pr, error: e2 } = await sb.from('profiles').select('username,role,staff_id').eq('id', data.user.id).single();
    if (e2 || !pr) { await sb.auth.signOut(); return toast('Tu cuenta no tiene permisos'); }
    if (kind === 'admin' && pr.role !== 'admin') { await sb.auth.signOut(); return toast('Esta sección es solo para administradores'); }
    localStorage.setItem('sm_profile', JSON.stringify(pr));
    sessionStorage.setItem('sm_auth', JSON.stringify({ role: pr.role, id: pr.staff_id || null }));
    location.reload();
  };
  window.logout = async function () {
    try { await sb.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem('sm_profile'); sessionStorage.removeItem('sm_auth'); } catch (e) {}
    location.hash = '';
    location.reload();
  };

  // ---------- Mi cuenta y equipo (administrador) ----------
  const pwOk = (p) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
  const PW_MSG = 'La contraseña debe tener 8+ caracteres, con letras y números';
  async function adm(body) {
    const { data, error } = await sb.functions.invoke('admin-users', { body });
    if (error) {
      let m = error.message;
      try { const j = await error.context.json(); m = j.error || m; } catch (e) {}
      throw new Error(m);
    }
    return data;
  }
  window.PROFS = [];
  async function loadProfiles() {
    if (!isAdmin) return;
    const { data } = await sb.from('profiles').select('username,role,staff_id');
    window.PROFS = data || [];
    if (isAdminView() && S.tab === 'equipo') render();
  }
  const acc = (id) => (window.PROFS || []).find((p) => p.staff_id === id);

  window.credHtml = function () {
    return `<div class="sec"><h2>Mi cuenta</h2><small>cambiar contraseña</small></div><div class="cd"><div class="f"><input id="np1" type="password" placeholder="Nueva contraseña (mín. 8)" autocomplete="new-password"><input id="np2" type="password" placeholder="Repite la contraseña" autocomplete="new-password"></div><button class="btn" style="margin-top:8px" onclick="chgPass()">Cambiar contraseña</button></div><p class="empty">Las contraseñas las guarda Supabase Auth cifradas: nadie, ni tú, puede verlas.</p>`;
  };
  window.chgPass = async function () {
    const a = $('#np1').value, b = $('#np2').value;
    if (!pwOk(a)) return toast('⚠️ ' + PW_MSG);
    if (a !== b) return toast('⚠️ Las contraseñas no coinciden');
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) return toast('⚠️ ' + error.message);
    $('#np1').value = ''; $('#np2').value = '';
    toast('✅ Contraseña actualizada');
  };

  window.equipoHtml = function () {
    return `<div class="sec"><h2>Equipo</h2><small>nombre y acceso</small></div>${cfg.staff.map((p, i) => { const a = acc(p.id); return `<div class="cd" style="margin-bottom:10px"><div class="f"><input id="en${i}" placeholder="Nombre" value="${esc(p.name)}"><input id="su${i}" placeholder="Usuario" autocapitalize="off" value="${esc(a ? a.username : '')}"><input id="sp${i}" type="password" placeholder="${a ? 'Nueva contraseña (opcional)' : 'Contraseña (mín. 8, letras y números)'}" autocomplete="new-password"></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center"><button class="btn" onclick="saveEmp(${i})">Guardar</button><button class="btn r" id="del${i}" onclick="delEmp(${i})">Eliminar</button>${a ? '<span class="badge ok">✔ con acceso</span>' : '<span class="badge">sin acceso</span>'}</div></div>`; }).join('')}<div class="cd"><h3>Nuevo empleado</h3><div class="f"><input id="nn" placeholder="Nombre"><input id="nu" placeholder="Usuario (opcional)" autocapitalize="off"><input id="np" type="password" placeholder="Contraseña (mín. 8)" autocomplete="new-password"></div><button class="btn" style="margin-top:8px" onclick="addEmp()">+ Agregar empleado</button></div><p class="empty">Las contraseñas no se guardan en la página ni se pueden ver: las gestiona Supabase Auth.</p>`;
  };
  const USER_RE = /^[a-z0-9._-]{3,30}$/;
  window.saveEmp = async function (i) {
    try {
      const g = (id) => document.getElementById(id).value, t = cfg.staff[i], a = acc(t.id);
      const n = g('en' + i).trim(), p = g('sp' + i), u = g('su' + i).trim().toLowerCase() || (a ? a.username : '');
      if (!n) return toast('⚠️ Escribe el nombre');
      if (!a && (u || p)) {
        if (!USER_RE.test(u)) return toast('⚠️ Usuario inválido (3-30: letras, números, . _ -)');
        if (!pwOk(p)) return toast('⚠️ ' + PW_MSG);
        await adm({ action: 'create', username: u, password: p, staff_id: t.id });
      } else if (a) {
        let cur = a.username;
        if (p && !pwOk(p)) return toast('⚠️ ' + PW_MSG);
        if (u !== cur) {
          if (!USER_RE.test(u)) return toast('⚠️ Usuario inválido (3-30: letras, números, . _ -)');
          await adm({ action: 'setuser', username: cur, new_username: u });
          cur = u;
        }
        if (p) await adm({ action: 'setpass', username: cur, password: p });
      }
      t.name = n;
      if (await saveC()) toast('✅ Guardado');
      await loadProfiles();
      render();
    } catch (e) { toast('⚠️ ' + e.message); }
  };
  window.addEmp = async function () {
    try {
      const g = (id) => document.getElementById(id).value, n = g('nn').trim(), u = g('nu').trim().toLowerCase(), p = g('np');
      if (!n) return toast('⚠️ Escribe el nombre');
      const e = { id: 's' + Date.now(), name: n };
      if (u || p) {
        if (!USER_RE.test(u)) return toast('⚠️ Usuario inválido (3-30: letras, números, . _ -)');
        if (!pwOk(p)) return toast('⚠️ ' + PW_MSG);
        await adm({ action: 'create', username: u, password: p, staff_id: e.id });
      }
      cfg.staff.push(e);
      if (await saveC()) toast('✅ ' + n + ' agregado');
      await loadProfiles();
      render();
    } catch (e) { toast('⚠️ ' + e.message); }
  };
  window.delEmp = async function (i) {
    try {
      const b = document.getElementById('del' + i), t = cfg.staff[i], a = acc(t.id);
      if (!b.dataset.s) {
        b.dataset.s = 1; b.textContent = '¿Seguro? Toca otra vez';
        setTimeout(() => { if (b && b.isConnected) { delete b.dataset.s; b.textContent = 'Eliminar'; } }, 4000);
        return;
      }
      if ((S.all || []).some((x) => x.staff === t.id)) return toast('⚠️ Tiene citas asignadas; muévelas primero');
      if (a) await adm({ action: 'delete', username: a.username });
      cfg.staff.splice(i, 1);
      if (await saveC()) toast('✅ Empleado eliminado');
      await loadProfiles();
      render();
    } catch (e) { toast('⚠️ ' + e.message); }
  };

  // ---------- Arranque ----------
  (async () => {
    await claude.use('db');
    await new Promise((r) => setTimeout(r, 50)); // deja terminar el arranque de app.js
    if (!isAdmin) { await loadPublic(); setInterval(loadPublic, 60000); }
    if (!db) window.watchSlots();
    loadProfiles();
  })();
})();
