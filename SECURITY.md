# Seguridad

## Principios
1. **Ninguna contraseña a la vista.** Se guardan solo en Supabase Auth (bcrypt). No existen en el código, en la base de datos de la app, en el repositorio ni en la interfaz. Los formularios de contraseña son de solo escritura.
2. **El navegador no es de confianza.** Todo lo importante (precios, descuentos, disponibilidad, permisos) se valida en la base de datos.
3. **Mínimo privilegio.** Cada rol solo accede a lo que necesita.

## Quién puede qué
| Rol | Lectura | Escritura |
|---|---|---|
| Público (sin cuenta) | Solo vía funciones: configuración pública (sin código de aliado), horarios ocupados (sin datos personales), seguimiento por placa (sin nombre, teléfono ni notas), % de descuento de una placa | Solo crear una cita (`create_booking`), validada y con precio calculado por el servidor |
| Empleado | Citas y horarios de **hoy y mañana** | Solo campos operativos de la cita (etapa, pago, reagendamiento); un *trigger* rechaza cambios a nombre, teléfono, precio, etc. |
| Administrador | Todo | Todo |

Los empleados se crean y eliminan únicamente desde la Edge Function `admin-users`, que verifica que quien llama sea administrador. La clave `service_role` solo existe en el servidor de Supabase.

## Qué NO debe subirse a GitHub
`service_role` key, contraseña de la base de datos, tokens de acceso, archivos `.env`. El `.gitignore` los excluye. La *anon key* y la URL son públicas por diseño. Si alguna vez subes un secreto por error: **rótalo** en Supabase (Project Settings → API / Database), no basta con borrarlo del repositorio.

## Límites conocidos (conviene saberlos)
- **Seguimiento por placa:** cualquiera que conozca una placa puede ver las fechas, servicios, etapa y estado de pago de esa moto (no ve nombre ni teléfono). Es el equilibrio entre comodidad y privacidad que se eligió. Para más privacidad se puede exigir un código de seguimiento enviado al cliente.
- **Empleados a nivel de base de datos:** la interfaz oculta teléfonos y precios al empleado, pero sus consultas pueden leer las citas de hoy/mañana completas. Si no confías en un empleado con conocimientos técnicos, el siguiente paso es servirle los datos por una función que los recorte.
- **Código de aliado:** se puede intentar adivinar por fuerza bruta. Usa un código largo (≥ 10 caracteres, no obvio), cámbialo si sospechas filtración, y activa el *rate limiting* de Supabase.
- **CSP con `unsafe-inline`:** la interfaz usa manejadores `onclick` en línea, así que la política de contenido no puede prohibir scripts en línea. Todo texto escrito por usuarios se escapa (`esc()`), pero conviene revisarlo si se agregan campos nuevos.
- **Script de CDN sin SRI:** `supabase-js` se carga de jsDelivr con versión fija. Para endurecerlo, descárgalo a `web/js/` y sírvelo desde tu propio sitio, o añade el atributo `integrity` con su hash.
- **Sin notificaciones automáticas:** WhatsApp/SMS/correo automáticos requieren un proveedor (por ejemplo WhatsApp Business API) y una función de servidor adicional.
- **Datos personales:** teléfonos y placas son datos personales (Ley 1581 de 2012, Colombia). Publica una política de tratamiento de datos y define cuánto tiempo conservas el historial.

## Lista de verificación antes de abrir al público
- [ ] Registro de nuevos usuarios **desactivado** en Supabase Auth.
- [ ] Contraseña del administrador larga y única; activada la verificación en dos pasos en tu cuenta de Supabase y GitHub.
- [ ] Código de aliado cambiado (no dejar el de ejemplo).
- [ ] Prueba de consola sin sesión: `sb.from('docs').select('*')` no devuelve datos.
- [ ] Copias de seguridad de Supabase activadas (plan Pro) o exportación periódica.
- [ ] Repositorio sin secretos (revisa el historial con `git log -p | grep -i service_role`).
- [ ] Activa *branch protection* y 2FA en GitHub.
