// Edge Function: gestión segura de usuarios (empleados).
// Solo la puede usar un ADMINISTRADOR autenticado. La clave service_role vive
// únicamente en el servidor de Supabase (variable de entorno), nunca en la web.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DOMAIN = "users.spamotos.app";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const USER_RE = /^[a-z0-9._-]{3,30}$/;
const passOk = (p: string) => typeof p === "string" && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) ¿Quién llama? Se verifica el token del usuario.
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "No autenticado" }, 401);

    // 2) ¿Es administrador?
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (me?.role !== "admin") return json({ error: "Solo administradores" }, 403);

    const b = await req.json();
    const username = String(b.username ?? "").trim().toLowerCase();

    if (b.action === "create") {
      if (!USER_RE.test(username)) return json({ error: "Usuario inválido (3-30 letras, números, . _ -)" }, 400);
      if (!passOk(b.password)) return json({ error: "La contraseña debe tener 8+ caracteres, letras y números" }, 400);
      const staffId = String(b.staff_id ?? "").slice(0, 40);
      if (!staffId) return json({ error: "Falta el empleado" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${DOMAIN}`, password: b.password, email_confirm: true,
      });
      if (error || !created.user) return json({ error: error?.message ?? "No se pudo crear" }, 400);
      const { error: pe } = await admin.from("profiles").insert({ id: created.user.id, username, role: "staff", staff_id: staffId });
      if (pe) { await admin.auth.admin.deleteUser(created.user.id); return json({ error: "Ese usuario ya existe" }, 400); }
      return json({ ok: true });
    }

    const { data: target } = await admin.from("profiles").select("id, role").eq("username", username).single();
    if (!target) return json({ error: "Usuario no encontrado" }, 404);
    if (target.role !== "staff") return json({ error: "Solo se administran empleados" }, 403);

    if (b.action === "setpass") {
      if (!passOk(b.password)) return json({ error: "La contraseña debe tener 8+ caracteres, letras y números" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id, { password: b.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (b.action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (_e) {
    return json({ error: "Error interno" }, 500);
  }
});
