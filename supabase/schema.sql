-- =====================================================================
-- Spa Motos 20IVI · Esquema seguro para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================
-- MODELO DE SEGURIDAD
--  * El público (anon) NO puede leer ni escribir tablas. Solo llama a funciones
--    (RPC) que validan todo en el servidor y devuelven datos mínimos.
--  * Administrador y empleados inician sesión con Supabase Auth (las contraseñas
--    las guarda Supabase cifradas con bcrypt; nadie puede verlas).
--  * Row Level Security (RLS) decide qué ve y qué escribe cada rol.
--  * El precio de cada cita lo calcula el SERVIDOR (el cliente no puede
--    manipular totales ni descuentos).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  role        text not null check (role in ('admin','staff')),
  staff_id    text,
  created_at  timestamptz not null default now()
);

-- Almacén de documentos: config, bookings, slots, clients, cnotes, cierres
create table if not exists public.docs (
  collection  text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_date_idx  on public.docs ((data->>'date')) where collection in ('bookings','slots');
create index if not exists docs_placa_idx on public.docs ((data->>'placa')) where collection = 'bookings';

alter table public.profiles enable row level security;
alter table public.docs     enable row level security;

-- ---------- Funciones auxiliares ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
$$;

create or replace function public.today_bogota() returns text
language sql stable as $$
  select to_char((now() at time zone 'America/Bogota')::date, 'YYYY-MM-DD')
$$;

create or replace function public.tomorrow_bogota() returns text
language sql stable as $$
  select to_char((now() at time zone 'America/Bogota')::date + 1, 'YYYY-MM-DD')
$$;

-- ---------- Políticas (RLS) ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists docs_admin_all on public.docs;
create policy docs_admin_all on public.docs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Empleados: solo citas y horarios de HOY y MAÑANA
drop policy if exists docs_staff_select on public.docs;
create policy docs_staff_select on public.docs for select to authenticated
  using (public.is_staff() and collection in ('bookings','slots')
         and (data->>'date') between public.today_bogota() and public.tomorrow_bogota());

drop policy if exists docs_staff_update on public.docs;
create policy docs_staff_update on public.docs for update to authenticated
  using (public.is_staff() and collection in ('bookings','slots')
         and (data->>'date') between public.today_bogota() and public.tomorrow_bogota())
  with check (public.is_staff() and collection in ('bookings','slots')
         and (data->>'date') between public.today_bogota() and public.tomorrow_bogota());

drop policy if exists docs_staff_insert on public.docs;
create policy docs_staff_insert on public.docs for insert to authenticated
  with check (public.is_staff() and collection = 'slots'
         and (data->>'date') between public.today_bogota() and public.tomorrow_bogota());

drop policy if exists docs_staff_delete on public.docs;
create policy docs_staff_delete on public.docs for delete to authenticated
  using (public.is_staff() and collection = 'slots'
         and (data->>'date') between public.today_bogota() and public.tomorrow_bogota());

-- Los empleados SOLO pueden cambiar campos operativos de una cita
-- (etapa, pago, reagendamiento). No pueden editar nombre, teléfono, precio, etc.
create or replace function public.docs_staff_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text;
  allowed text[] := array['stg','st','t0','t1','t2','t3','t4','t5','t6','t7','tEnd',
                          'pay','pm','paidAt','late','lateFrom','moved','wait','staff','start'];
begin
  if tg_op = 'UPDATE' and public.is_staff() and not public.is_admin() then
    if new.collection <> old.collection or new.id <> old.id then
      raise exception 'no_permitido';
    end if;
    if new.collection = 'bookings' then
      for k in select jsonb_object_keys(coalesce(new.data,'{}'::jsonb) || coalesce(old.data,'{}'::jsonb)) loop
        if k = any(allowed) then continue; end if;
        if (new.data -> k) is distinct from (old.data -> k) then
          raise exception 'campo_no_permitido: %', k;
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists docs_staff_guard_trg on public.docs;
create trigger docs_staff_guard_trg before update on public.docs
  for each row execute function public.docs_staff_guard();

-- Actualización parcial de un documento (respeta RLS: security invoker)
create or replace function public.doc_merge(p_coll text, p_id text, p_patch jsonb) returns void
language sql security invoker as $$
  update public.docs set data = data || p_patch, updated_at = now()
  where collection = p_coll and id = p_id;
$$;

-- =====================================================================
-- FUNCIONES PÚBLICAS (RPC) · lo único que puede usar el público
-- =====================================================================

-- Configuración pública: servicios, precios, equipo (solo id y nombre),
-- combos, formas de pago, datos de la sede. NUNCA incluye el código de aliado.
create or replace function public.public_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_set(
           (data #- '{set,code}' #- '{set,au}' #- '{set,as}' #- '{set,ah}'),
           '{staff}',
           coalesce((select jsonb_agg(jsonb_build_object('id', e->>'id', 'name', e->>'name'))
                     from jsonb_array_elements(coalesce(data->'staff','[]'::jsonb)) e), '[]'::jsonb)
         )
  from public.docs where collection = 'config' and id = 'main'
$$;

-- Horarios ocupados de un día (sin datos personales)
create or replace function public.public_slots(p_date text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('staff', data->>'staff', 'i', (data->>'i')::int)), '[]'::jsonb)
  from public.docs
  where collection = 'slots' and p_date ~ '^\d{4}-\d{2}-\d{2}$' and data->>'date' = p_date
$$;

-- Descuento personal de una placa (solo el porcentaje)
create or replace function public.client_discount(p_placa text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'disc')::numeric::int from public.docs
                   where collection = 'clients'
                     and id = upper(regexp_replace(coalesce(p_placa,''), '[^A-Za-z0-9]', '', 'g'))), 0)
$$;

-- Valida un código de aliado: devuelve el % de descuento (0 si no es válido)
create or replace function public.validate_ally(p_code text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when btrim(coalesce(p_code,'')) <> ''
                 and upper(btrim(p_code)) = upper(coalesce(data->'set'->>'code','#'))
                then coalesce((data->'set'->>'ally')::numeric, 0)::int else 0 end
    from public.docs where collection = 'config' and id = 'main'), 0)
$$;

-- Seguimiento por placa: solo datos mínimos (sin teléfono, nombre ni notas)
create or replace function public.track_booking(p_placa text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', d.id, 'date', d.data->>'date', 'start', (d.data->>'start')::int,
           'n', (d.data->>'n')::int, 'svc', d.data->'svc', 'staff', d.data->>'staff',
           'stg', d.data->'stg', 'st', d.data->>'st', 'pay', d.data->>'pay', 'pm', d.data->>'pm',
           'total', (d.data->>'total')::int, 'late', d.data->'late', 'wait', d.data->'wait',
           'moved', d.data->'moved')) order by d.data->>'date' desc), '[]'::jsonb)
  from (
    select * from public.docs
    where collection = 'bookings'
      and length(upper(regexp_replace(coalesce(p_placa,''), '[^A-Za-z0-9]', '', 'g'))) >= 5
      and data->>'placa' = upper(regexp_replace(coalesce(p_placa,''), '[^A-Za-z0-9]', '', 'g'))
    order by data->>'date' desc limit 20
  ) d
$$;

-- Crear cita: valida TODO en el servidor, calcula el precio y evita dobles reservas
create or replace function public.create_booking(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c jsonb; v_placa text; v_name text; v_phone text; v_date text; v_staff text;
  v_start int; v_ids text[]; v_svc jsonb; v_names jsonb;
  v_sum numeric := 0; v_min int := 0; v_n int;
  v_combo jsonb; v_cd_amt numeric := 0; v_ally_amt numeric := 0; v_cli_amt numeric := 0;
  v_code text := ''; v_cli numeric := 0; v_pmi text := ''; v_id text; b jsonb; k int;
  v_today text; v_nowmin int;
  v_max int := 20;  -- 8:00 a 18:00 en bloques de 30 minutos
begin
  c := (select data from public.docs where collection = 'config' and id = 'main');
  if c is null then raise exception 'config_no_disponible'; end if;

  v_placa := upper(regexp_replace(coalesce(p->>'placa',''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_placa) not between 5 and 8 then raise exception 'placa_invalida'; end if;

  v_name := left(btrim(coalesce(p->>'name','')), 80);
  if length(v_name) < 2 then raise exception 'nombre_invalido'; end if;

  v_phone := left(regexp_replace(coalesce(p->>'phone',''), '[^0-9+ ]', '', 'g'), 20);
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then raise exception 'celular_invalido'; end if;

  v_date := coalesce(p->>'date','');
  if v_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'fecha_invalida'; end if;
  v_today := public.today_bogota();
  if v_date < v_today or v_date > to_char((now() at time zone 'America/Bogota')::date + 30, 'YYYY-MM-DD') then
    raise exception 'fecha_fuera_de_rango';
  end if;

  v_staff := coalesce(p->>'staff','');
  if not exists (select 1 from jsonb_array_elements(c->'staff') s where s->>'id' = v_staff) then
    raise exception 'persona_invalida';
  end if;

  begin v_start := (p->>'start')::int; exception when others then raise exception 'hora_invalida'; end;

  select array(select jsonb_array_elements_text(coalesce(p->'svc','[]'::jsonb))) into v_ids;
  if coalesce(cardinality(v_ids), 0) not between 1 and 12 then raise exception 'servicios_invalidos'; end if;

  select coalesce(jsonb_agg(s), '[]'::jsonb) into v_svc
  from jsonb_array_elements(c->'services') s where s->>'id' = any(v_ids);
  if jsonb_array_length(v_svc) <> cardinality(v_ids) then raise exception 'servicios_invalidos'; end if;

  select sum((s->>'price')::numeric), sum(coalesce((s->>'min')::int, 30)), jsonb_agg(s->>'name')
    into v_sum, v_min, v_names
  from jsonb_array_elements(v_svc) s;

  -- Combos
  for v_combo in select * from jsonb_array_elements(coalesce(c->'combos', '[]'::jsonb)) loop
    if jsonb_array_length(coalesce(v_combo->'ids','[]'::jsonb)) > 0
       and (select bool_and(x = any(v_ids)) from jsonb_array_elements_text(v_combo->'ids') x) then
      v_cd_amt := v_cd_amt + coalesce((v_combo->>'pct')::numeric, 0) / 100 *
        (select coalesce(sum((s->>'price')::numeric), 0) from jsonb_array_elements(v_svc) s
          where (s->>'id') in (select jsonb_array_elements_text(v_combo->'ids')));
    end if;
  end loop;

  -- Código de aliado (se valida aquí; el cliente nunca conoce el código real)
  v_code := btrim(coalesce(p->>'code',''));
  if v_code <> '' and upper(v_code) = upper(coalesce(c->'set'->>'code', '#')) then
    v_ally_amt := (v_sum - v_cd_amt) * coalesce((c->'set'->>'ally')::numeric, 0) / 100;
  else
    v_code := '';
  end if;

  -- Descuento personal por placa
  select coalesce((data->>'disc')::numeric, 0) into v_cli
  from public.docs where collection = 'clients' and id = v_placa;
  v_cli := coalesce(v_cli, 0);
  v_cli_amt := (v_sum - v_cd_amt - v_ally_amt) * v_cli / 100;

  -- Forma de pago prevista (solo valores configurados)
  if exists (select 1 from jsonb_array_elements(coalesce(c->'pm','[]'::jsonb)) m where m->>'n' = coalesce(p->>'pmi','')) then
    v_pmi := p->>'pmi';
  end if;

  v_n := greatest(1, ceil(v_min / 30.0))::int;
  if v_start < 0 or v_start + v_n > v_max then raise exception 'hora_invalida'; end if;

  if v_date = v_today then
    v_nowmin := extract(hour from (now() at time zone 'America/Bogota'))::int * 60
              + extract(minute from (now() at time zone 'America/Bogota'))::int;
    if 480 + v_start * 30 < v_nowmin then raise exception 'hora_pasada'; end if;
  end if;

  if (select count(*) from public.docs
       where collection = 'bookings' and data->>'placa' = v_placa and data->>'date' >= v_today) >= 5 then
    raise exception 'limite_de_citas';
  end if;

  -- Evita dobles reservas aunque dos personas reserven al mismo tiempo
  perform pg_advisory_xact_lock(hashtext('slots:' || v_date));
  if exists (select 1 from public.docs
              where collection = 'slots' and data->>'date' = v_date and data->>'staff' = v_staff
                and (data->>'i')::int between v_start and v_start + v_n - 1) then
    raise exception 'slot_ocupado';
  end if;

  v_id := 'b' || substr(md5(random()::text || clock_timestamp()::text), 1, 9);
  b := jsonb_build_object(
    'id', v_id, 'date', v_date, 'staff', v_staff, 'start', v_start, 'n', v_n,
    'svc', v_names, 'total', round(v_sum - v_cd_amt - v_ally_amt - v_cli_amt)::int,
    'name', v_name, 'phone', v_phone, 'placa', v_placa,
    'moto', left(btrim(coalesce(p->>'moto','')), 60),
    'note', left(btrim(coalesce(p->>'note','')), 300),
    'pmi', v_pmi, 'cd', v_cli, 'code', v_code, 'st', 'pend',
    'created', (extract(epoch from clock_timestamp()) * 1000)::bigint);

  insert into public.docs (collection, id, data) values ('bookings', v_id, b);
  for k in 0 .. v_n - 1 loop
    insert into public.docs (collection, id, data)
    values ('slots', v_id || '_' || k, jsonb_build_object('date', v_date, 'staff', v_staff, 'i', v_start + k, 'bid', v_id));
  end loop;

  return b;
end $$;

-- =====================================================================
-- PERMISOS: el público solo puede ejecutar las funciones públicas
-- =====================================================================
revoke all on public.docs     from anon;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.profiles to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.is_staff(),
      public.today_bogota(), public.tomorrow_bogota() to authenticated;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;
grant execute on function public.public_config(), public.public_slots(text),
      public.client_discount(text), public.validate_ally(text),
      public.track_booking(text), public.create_booking(jsonb) to anon, authenticated;

-- Tiempo real para administrador y empleados (RLS aplica)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when others then null;
end $$;
