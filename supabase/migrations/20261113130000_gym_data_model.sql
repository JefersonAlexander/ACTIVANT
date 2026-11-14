-- Extensión aditiva. No altera valores existentes de profiles ni elimina objetos.
begin;
create schema activant_private;
revoke all on schema activant_private from public, anon, authenticated, service_role;
grant usage on schema activant_private to authenticated;

create type public.app_role as enum ('user', 'gym_staff', 'admin');
create type public.gym_slot_status as enum ('open', 'closed', 'cancelled');
create type public.reservation_status as enum ('confirmed', 'cancelled');
create type public.waitlist_status as enum ('waiting', 'promoted', 'cancelled', 'expired');
create type public.attendance_method as enum ('staff', 'qr');

create table public.affiliation_types (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  is_active boolean not null default true
);
insert into public.affiliation_types(code,label) values
 ('servidor_planta','Servidor de planta'), ('contratista','Contratista'), ('practicante','Practicante');
alter table public.profiles add column affiliation_type text references public.affiliation_types(code) on delete restrict;
create index profiles_affiliation_idx on public.profiles(affiliation_type);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'user',
  granted_at timestamptz not null default clock_timestamp(),
  granted_by uuid references public.profiles(id) on delete restrict,
  primary key(user_id,role)
);
create index user_roles_role_idx on public.user_roles(role,user_id);
create index user_roles_granted_by_idx on public.user_roles(granted_by);

create table public.gym_eligibility (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_eligible boolean not null default false,
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  authorized_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  check(valid_until is null or valid_until > valid_from)
);
create index gym_eligibility_authorized_by_idx on public.gym_eligibility(authorized_by);

create table public.gym_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 20 check(capacity > 0),
  status public.gym_slot_status not null default 'open',
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check(ends_at > starts_at),
  exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&) where (status <> 'cancelled')
);
create index gym_slots_schedule_idx on public.gym_slots(starts_at,status);
create index gym_slots_created_by_idx on public.gym_slots(created_by);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  slot_id uuid not null references public.gym_slots(id) on delete restrict,
  status public.reservation_status not null default 'confirmed',
  created_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  check((status='cancelled') = (cancelled_at is not null)),
  check(cancelled_at is null or cancelled_at >= created_at),
  unique(id,user_id,slot_id)
);
create unique index reservations_one_confirmed_idx on public.reservations(user_id,slot_id) where status='confirmed';
create index reservations_slot_status_idx on public.reservations(slot_id,status);
create index reservations_user_history_idx on public.reservations(user_id,created_at desc);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  slot_id uuid not null references public.gym_slots(id) on delete restrict,
  status public.waitlist_status not null default 'waiting',
  reservation_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check((status='promoted') = (reservation_id is not null)),
  foreign key(reservation_id,user_id,slot_id) references public.reservations(id,user_id,slot_id) on delete restrict
);
create unique index waitlist_one_waiting_idx on public.waitlist(user_id,slot_id) where status='waiting';
create unique index waitlist_reservation_idx on public.waitlist(reservation_id) where reservation_id is not null;
create index waitlist_queue_idx on public.waitlist(slot_id,created_at,id) where status='waiting';
create index waitlist_slot_idx on public.waitlist(slot_id);
create index waitlist_user_history_idx on public.waitlist(user_id,created_at desc);

create table public.qr_challenges (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  check(expires_at > created_at and expires_at <= created_at + interval '5 minutes'),
  check(consumed_at is null or (consumed_at >= created_at and consumed_at <= expires_at)),
  check(revoked_at is null or revoked_at >= created_at),
  check(not(consumed_at is not null and revoked_at is not null)),
  unique(id,reservation_id)
);
create index qr_challenges_reservation_idx on public.qr_challenges(reservation_id);
create index qr_challenges_issued_by_idx on public.qr_challenges(issued_by);
create index qr_challenges_expiry_idx on public.qr_challenges(expires_at) where consumed_at is null and revoked_at is null;

create table public.attendance (
  reservation_id uuid primary key references public.reservations(id) on delete restrict,
  checked_in_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  method public.attendance_method not null,
  qr_challenge_id uuid unique,
  foreign key(qr_challenge_id,reservation_id) references public.qr_challenges(id,reservation_id) on delete restrict,
  check((method='qr') = (qr_challenge_id is not null))
);
create index attendance_recorded_by_idx on public.attendance(recorded_by);
create index attendance_time_idx on public.attendance(checked_in_at);

-- Configuración operativa tipada: nunca un almacén de secretos o diagnósticos.
create table public.app_settings (
  singleton boolean primary key default true check(singleton),
  default_slot_capacity integer not null default 20 check(default_slot_capacity > 0),
  qr_ttl_seconds integer not null default 120 check(qr_ttl_seconds between 30 and 300),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references public.profiles(id) on delete restrict
);
insert into public.app_settings(singleton) values(true);
create index app_settings_updated_by_idx on public.app_settings(updated_by);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid references public.profiles(id) on delete restrict,
  database_actor text not null,
  operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
  entity_table text not null,
  entity_key jsonb not null,
  old_values jsonb,
  new_values jsonb
);
create index audit_logs_actor_time_idx on public.audit_logs(actor_id,occurred_at desc);
create index audit_logs_entity_time_idx on public.audit_logs(entity_table,occurred_at desc);

create function activant_private.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
 where r.user_id=(select auth.uid()) and r.role=p_role and p.is_active);
$$;
create function activant_private.active_user() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and is_active);
$$;
create function activant_private.require_admin() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not activant_private.has_role('admin') then raise exception 'Se requiere un administrador activo.' using errcode='42501'; end if;
end; $$;
create function activant_private.require_staff() returns void
language plpgsql security definer set search_path='' as $$
begin
 if not (activant_private.has_role('admin') or activant_private.has_role('gym_staff')) then
 raise exception 'Se requiere personal autorizado de gimnasio.' using errcode='42501'; end if;
end; $$;
create function activant_private.lock_eligible_user(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles; e public.gym_eligibility; v_category boolean;
begin
 select * into p from public.profiles where id=p_user_id for share;
 if not found or not p.is_active or p.affiliation_type is null then
 raise exception 'El usuario no está activo y habilitado.' using errcode='42501'; end if;
 select is_active into v_category from public.affiliation_types where code=p.affiliation_type for share;
 select * into e from public.gym_eligibility where user_id=p_user_id for share;
 if not found or not coalesce(v_category,false) or not e.is_eligible or e.valid_from > clock_timestamp()
 or (e.valid_until is not null and e.valid_until <= clock_timestamp()) then
 raise exception 'El usuario no está activo y habilitado.' using errcode='42501'; end if;
end; $$;

create function activant_private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_key jsonb;
begin
 if tg_op <> 'INSERT' then v_old=to_jsonb(old)-'token_hash'; end if;
 if tg_op <> 'DELETE' then v_new=to_jsonb(new)-'token_hash'; end if;
 v_row=coalesce(v_new,v_old);
 v_key=case tg_table_name
 when 'user_roles' then jsonb_build_object('user_id',v_row->'user_id','role',v_row->'role')
 when 'gym_eligibility' then jsonb_build_object('user_id',v_row->'user_id')
 when 'attendance' then jsonb_build_object('reservation_id',v_row->'reservation_id')
 when 'app_settings' then jsonb_build_object('singleton',v_row->'singleton')
 when 'affiliation_types' then jsonb_build_object('code',v_row->'code')
 else jsonb_build_object('id',v_row->'id') end;
 insert into public.audit_logs(actor_id,database_actor,operation,entity_table,entity_key,old_values,new_values)
 values(auth.uid(),session_user,tg_op,tg_table_name,v_key,v_old,v_new);
 return null;
end; $$;
create function activant_private.prevent_rewrite() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'El registro es inmutable.' using errcode='42501'; end; $$;
create trigger audit_logs_immutable before update or delete on public.audit_logs for each row execute function activant_private.prevent_rewrite();
create trigger attendance_immutable before update or delete on public.attendance for each row execute function activant_private.prevent_rewrite();

create function activant_private.initialize_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_roles(user_id,role) values(new.id,'user');
 insert into public.gym_eligibility(user_id) values(new.id);
 return new;
end; $$;
create trigger a_initialize_profile after insert on public.profiles for each row execute function activant_private.initialize_profile();
-- Solo inserta filas en tablas nuevas; no cambia los perfiles existentes.
insert into public.user_roles(user_id,role) select id,'user' from public.profiles;
insert into public.gym_eligibility(user_id) select id from public.profiles;

do $$ declare t text; begin
 foreach t in array array['affiliation_types','profiles','user_roles','gym_eligibility','gym_slots','reservations','attendance','waitlist','qr_challenges','app_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on table public.%I from public, anon, authenticated, service_role',t);
 if t <> 'qr_challenges' then execute format('grant select on table public.%I to authenticated',t); end if;
 execute format('create trigger z_audit_change after insert or update or delete on public.%I for each row execute function activant_private.audit_change()',t);
 end loop;
end; $$;
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public,anon,authenticated,service_role;
grant select on public.audit_logs to authenticated,service_role;
revoke all on sequence public.audit_logs_id_seq from public,anon,authenticated,service_role;
grant select(id,reservation_id,issued_by,created_at,expires_at,consumed_at,revoked_at) on public.qr_challenges to authenticated;

-- Se conserva users_read_own_profile de la migración anterior.
create policy admins_read_profiles on public.profiles for select to authenticated using (activant_private.has_role('admin'));
create policy read_affiliations on public.affiliation_types for select to authenticated using (activant_private.active_user());
create policy read_roles on public.user_roles for select to authenticated using (user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_eligibility on public.gym_eligibility for select to authenticated using (user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_slots on public.gym_slots for select to authenticated using (activant_private.active_user());
create policy read_reservations on public.reservations for select to authenticated using (user_id=(select auth.uid()) or activant_private.has_role('admin') or activant_private.has_role('gym_staff'));
create policy read_waitlist on public.waitlist for select to authenticated using (user_id=(select auth.uid()) or activant_private.has_role('admin') or activant_private.has_role('gym_staff'));
create policy read_attendance on public.attendance for select to authenticated using (
 exists(select 1 from public.reservations r where r.id=reservation_id and r.user_id=(select auth.uid()))
 or activant_private.has_role('admin') or activant_private.has_role('gym_staff'));
create policy read_qr_metadata on public.qr_challenges for select to authenticated using (
 issued_by=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_settings on public.app_settings for select to authenticated using (activant_private.active_user());
create policy read_audit on public.audit_logs for select to authenticated using (activant_private.has_role('admin'));

revoke all on all functions in schema activant_private from public,anon,authenticated,service_role;
grant execute on function activant_private.has_role(public.app_role),activant_private.active_user() to authenticated;
commit;
