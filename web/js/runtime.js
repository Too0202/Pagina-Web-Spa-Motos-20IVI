/* Spa Motos 20IVI · capa de compatibilidad con Supabase.
 * Expone a la app la API claude.use('db' | 'user' | 'downloads') respaldada por Supabase.
 * Aquí NO hay secretos: solo la URL y la clave "anon" (pública por diseño). Lo que cada
 * persona puede leer o escribir lo decide Row Level Security en la base de datos.
 */
(function () {
  'use strict';
  const C = window.APP_CONFIG || {};
  const ok = !!(window.supabase && C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/TU-PROYECTO|PEGA_AQUI/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY));
  if (!ok) console.error('[Spa Motos] Falta configurar web/config.js (SUPABASE_URL y SUPABASE_ANON_KEY).');
  const sb = ok ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  }) : null;
  window.sb = sb;
  window.AUTH_DOMAIN = 'users.spamotos.app';
  window.AUTH_EMAIL = (u) => String(u || '').trim().toLowerCase() + '@' + window.AUTH_DOMAIN;

  // Perfil en caché (solo rol y usuario; NO contraseñas). La seguridad real la impone la base de datos.
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('sm_profile') || 'null'); } catch (e) {}
  window.PROFILE = profile;
  try {
    if (profile) sessionStorage.setItem('sm_auth', JSON.stringify({ role: profile.role, id: profile.staff_id || null }));
    else sessionStorage.removeItem('sm_auth');
  } catch (e) {}

  // Si el perfil existe pero la sesión ya venció, se limpia y se recarga.
  const ready = (async () => {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    if (!data.session && profile) {
      try { localStorage.removeItem('sm_profile'); sessionStorage.removeItem('sm_auth'); } catch (e) {}
      location.reload();
      return null;
    }
    return data.session;
  })();

  // ---------- Almacén de documentos sobre la tabla "docs" ----------
  const PAGE = 1000;
  async function fetchRows(coll, filters) {
    let all = [], from = 0;
    for (;;) {
      let q = sb.from('docs').select('id,data').eq('collection', coll).order('id').range(from, from + PAGE - 1);
      for (const [f, op, v] of filters) {
        const col = 'data->>' + f;
        q = op === '==' ? q.eq(col, String(v)) : op === '>=' ? q.gte(col, String(v)) : op === '<=' ? q.lte(col, String(v)) : q;
      }
      const { data, error } = await q;
      if (error) throw error;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }
  const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  function watch(filter, fn) {
    const ch = sb.channel('c' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter }, () => fn())
      .subscribe();
    return () => sb.removeChannel(ch);
  }
  const snap = (rows) => ({ docs: rows.map((r) => ({ id: r.id, data: () => r.data })), size: rows.length });

  function query(coll, filters) {
    return {
      where(f, op, v) { return query(coll, [...filters, [f, op, v]]); },
      async get() { return snap(await fetchRows(coll, filters)); },
      onSnapshot(cb, err) {
        let dead = false;
        const run = async () => {
          try { const r = await fetchRows(coll, filters); if (!dead) cb(snap(r)); }
          catch (e) { if (!dead && err) err(e); }
        };
        run();
        const off = watch('collection=eq.' + coll, debounce(run, 200));
        return () => { dead = true; off(); };
      },
    };
  }
  function docRef(coll, id) {
    const ref = {
      async get() {
        const { data, error } = await sb.from('docs').select('data').eq('collection', coll).eq('id', id).maybeSingle();
        if (error) throw error;
        return { exists: !!data, id, data: () => (data ? data.data : undefined) };
      },
      async set(d) {
        const { error } = await sb.from('docs').upsert({ collection: coll, id, data: d, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
      async update(p) {
        const { error } = await sb.rpc('doc_merge', { p_coll: coll, p_id: id, p_patch: p });
        if (error) throw error;
      },
      async delete() {
        const { error } = await sb.from('docs').delete().eq('collection', coll).eq('id', id);
        if (error) throw error;
      },
      onSnapshot(cb, err) {
        let dead = false;
        const run = async () => {
          try { const s = await ref.get(); if (!dead) cb(s); } catch (e) { if (!dead && err) err(e); }
        };
        run();
        const off = watch('id=eq.' + id, debounce(run, 200));
        return () => { dead = true; off(); };
      },
    };
    return ref;
  }
  const dbShim = {
    collection: (c) => ({
      doc: (id) => docRef(c, id),
      where: (f, o, v) => query(c, [[f, o, v]]),
      get: () => query(c, []).get(),
      onSnapshot: (cb, e) => query(c, []).onSnapshot(cb, e),
    }),
  };

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { status: 'saved' };
    },
  };

  window.claude = {
    use: async (name) => {
      await ready;
      if (name === 'user') {
        const adm = () => !!(profile && profile.role === 'admin');
        return { canEdit: adm, isOwner: adm, can: () => null };
      }
      if (name === 'db') return sb && profile ? dbShim : null; // visitantes: sin acceso directo a tablas
      if (name === 'downloads') return downloads;
      return null;
    },
  };
})();
