-- Crea tu cuenta de administrador (una sola vez)
--
-- 1) Supabase → Authentication → Users → "Add user" → "Create new user"
--      Email:      TU_USUARIO@users.spamotos.app     (ej. dueno@users.spamotos.app)
--      Password:   una contraseña larga y única (mín. 12 caracteres)
--      Marca "Auto Confirm User".
--    En la página entrarás escribiendo solo TU_USUARIO (sin el @...).
--
-- 2) Cambia TU_USUARIO abajo (en minúsculas, mismo texto del correo) y ejecuta:
insert into public.profiles (id, username, role)
select id, 'TU_USUARIO', 'admin'
from auth.users
where email = 'TU_USUARIO@users.spamotos.app'
on conflict (id) do update set role = 'admin';
