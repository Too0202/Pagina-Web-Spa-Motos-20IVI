# Spa Motos 20IVI

Página y sistema de gestión de citas para lavado de motos: reservas de clientes, seguimiento del lavado por etapas,
agenda semanal, caja, clientes, reportes y panel de administración. Interfaz estática (HTML/CSS/JS) + backend seguro en
[Supabase](https://supabase.com) (PostgreSQL, Auth y Edge Functions). Se publica gratis en GitHub Pages.

```
web/                       Sitio estático (lo que se publica)
  index.html  config.js    config.js solo lleva URL y anon key (públicas)
  css/ js/ assets/         js/app.js = interfaz · js/runtime.js = capa de datos · js/backend.js = login, RPC y equipo
supabase/
  schema.sql               Tablas, permisos (RLS), funciones públicas validadas en el servidor
  seed.sql                 Servicios, precios, combos, formas de pago y sede iniciales (sin datos personales)
  seed_admin.sql           Alta de tu cuenta de administrador
  functions/admin-users/   Edge Function: crear empleados y cambiar contraseñas (solo admin)
.github/workflows/pages.yml  Publicación automática en GitHub Pages
SECURITY.md                Modelo de seguridad, límites conocidos y lista de verificación
```

## Puesta en marcha (≈ 20 minutos)

### 1. Crear el proyecto en Supabase
1. Crea una cuenta y un proyecto en supabase.com (región cercana, p. ej. São Paulo). Guarda la contraseña de la base de datos en un gestor de contraseñas.
2. **SQL Editor → New query**: pega y ejecuta `supabase/schema.sql`, y luego `supabase/seed.sql`.
3. **Authentication → Sign In / Providers → Email**: **desactiva "Allow new users to sign up"** (nadie debe poder registrarse solo), y sube "Minimum password length" a 8.
4. **Authentication → Users → Add user → Create new user** con el correo `TU_USUARIO@users.spamotos.app`, una contraseña larga y única, y *Auto Confirm User*. Luego ejecuta `supabase/seed_admin.sql` (cambiando `TU_USUARIO` por el mismo texto).
5. **Project Settings → API**: copia la *Project URL* y la clave **anon public**. (La clave `service_role` NO la copies a ningún archivo.)

### 2. Desplegar la función que crea empleados
```bash
npm i -g supabase            # o: brew install supabase/tap/supabase
supabase login
supabase link --project-ref TU_REF
supabase functions deploy admin-users
```
La función usa las variables que Supabase inyecta en el servidor (`SUPABASE_SERVICE_ROLE_KEY`); no hay que escribirla en ningún lado.

### 3. Publicar la web en GitHub Pages
1. Crea un repositorio en GitHub y sube este proyecto.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: crea `SUPABASE_URL` y `SUPABASE_ANON_KEY` (pueden ser variables normales: son públicas).
4. Haz *push* a `main`. La acción genera `web/config.js` y publica el sitio.

Para probar en local: edita `web/config.js` y ejecuta `cd web && python3 -m http.server 8080` → http://localhost:8080.

### 4. Primer uso
- **Administrador**: `https://TU-SITIO/#admin` → entra con tu usuario y contraseña. Ve a **Ajustes** y cambia el *código de aliado*, pon tu WhatsApp y revisa precios en **Precios**.
- **Empleados**: **Admin → Equipo** → crea cada empleado con usuario y contraseña. Ellos entran por `https://TU-SITIO/#taller`.
- **Clientes**: comparte `https://TU-SITIO/` (sin nada al final). No necesitan cuenta: reservan con la placa.

## Probar antes de abrir al público
1. Reserva como cliente (ventana de incógnito) y confirma que la cita aparece en Admin → Agenda.
2. Intenta reservar la misma hora desde dos pestañas: la segunda debe fallar con "horario ocupado".
3. Entra como empleado: debe ver solo sus lavados de hoy/mañana, sin precios ni teléfonos.
4. Desde una ventana sin sesión, abre la consola del navegador y ejecuta
   `await sb.from('docs').select('*')` → debe responder **vacío o error de permisos**.

## Qué cambió respecto a la versión de prueba
- Las contraseñas ya no existen en la página ni en la base de datos como datos legibles: las gestiona Supabase Auth.
- El precio y los descuentos los calcula el servidor; el cliente no puede alterarlos.
- El código de aliado nunca llega al navegador del público.
- El público solo ejecuta funciones con permisos mínimos; no puede leer tablas.
- Ver `SECURITY.md` para los límites conocidos.
