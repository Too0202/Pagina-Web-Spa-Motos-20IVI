// Configuración pública. Aquí NO van secretos.
// La "anon key" es pública por diseño: lo que se puede hacer con ella lo limita RLS en la base de datos.
// NUNCA pongas aquí la clave "service_role".
window.APP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "PEGA_AQUI_LA_ANON_KEY"
};
