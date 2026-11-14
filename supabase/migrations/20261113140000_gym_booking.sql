-- Reservas: extensión aditiva. No elimina filas ni reescribe migraciones aplicadas.
begin;
alter table public.app_settings
 add column booking_window_hours integer not null default 24 check(booking_window_hours between 1 and 168),
 add column reservations_enabled boolean not null default true;

-- Bloqueo administrativo de acceso; no calcula ni aplica sanciones disciplinarias.
create table public.gym_access_restrictions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete restrict,
 kind text not null default 'restriction' check(kind in ('restriction','suspension')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 revoked_at timestamptz,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 check(ends_at>starts_at),
 check(revoked_at is null or revoked_at>=created_at)
);
create index gym_access_restrictions_user_window_idx on public.gym_access_restrictions(user_id,starts_at,ends_at) where revoked_at is null;
create index gym_access_restrictions_creator_idx on public.gym_access_restrictions(created_by);
alter table public.gym_access_restrictions enable row level security;
revoke all on public.gym_access_restrictions from public,anon,authenticated,service_role;
grant select on public.gym_access_restrictions to authenticated;
create policy read_access_restrictions on public.gym_access_restrictions for select to authenticated
 using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
create trigger z_audit_change after insert or update or delete on public.gym_access_restrictions
 for each row execute function activant_private.audit_change();

create function public.admin_update_booking_rules(p_window_hours integer,p_enabled boolean,p_default_capacity integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_window_hours is null or p_enabled is null or p_default_capacity is null then
 raise exception 'Completa la configuración de reservas.' using errcode='22004'; end if;
 update public.app_settings set booking_window_hours=p_window_hours,reservations_enabled=p_enabled,
 default_slot_capacity=p_default_capacity,updated_at=clock_timestamp(),updated_by=auth.uid() where singleton;
end; $$;
create function public.admin_add_gym_access_restriction(p_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_kind text default 'restriction') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform activant_private.require_admin();
 if p_user_id=auth.uid() then raise exception 'No puedes gestionar tu propio acceso.' using errcode='42501'; end if;
 -- Serializa la incorporación de restricciones con el bloqueo compartido del reservante.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'El perfil no existe.' using errcode='23503'; end if;
 insert into public.gym_access_restrictions(user_id,starts_at,ends_at,kind,created_by)
 values(p_user_id,p_starts_at,p_ends_at,p_kind,auth.uid()) returning id into v_id;
 return v_id;
end; $$;
create function public.admin_revoke_gym_access_restriction(p_restriction_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 perform activant_private.require_admin();
 select user_id into v_user from public.gym_access_restrictions where id=p_restriction_id;
 if v_user is null then raise exception 'La restricción no existe.' using errcode='23503'; end if;
 if v_user=auth.uid() then raise exception 'No puedes gestionar tu propio acceso.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=v_user for update;
 update public.gym_access_restrictions set revoked_at=clock_timestamp() where id=p_restriction_id and revoked_at is null;
end; $$;

-- Una sola definición de las condiciones, reutilizada por escritura y disponibilidad.
-- Los llamadores de escritura adquieren primero los bloqueos de perfil, elegibilidad,
-- configuración y franja. La lectura es informativa, nunca garantiza un cupo futuro.
create function activant_private.booking_denial(p_user uuid,p_slot public.gym_slots,p_now timestamptz,p_hours integer,p_enabled boolean) returns text
language plpgsql stable security definer set search_path='' as $$
begin
 if p_user is null or not exists(select 1 from public.profiles p
 join public.affiliation_types a on a.code=p.affiliation_type
 join public.gym_eligibility e on e.user_id=p.id
 where p.id=p_user and p.is_active and a.is_active and e.is_eligible
 and e.valid_from<=p_now and e.valid_from<=p_slot.starts_at
 and (e.valid_until is null or (e.valid_until>p_now and e.valid_until>=p_slot.ends_at))) then return 'not_eligible'; end if;
 if exists(select 1 from public.gym_access_restrictions r where r.user_id=p_user and r.revoked_at is null
 and ((r.starts_at<=p_now and r.ends_at>p_now) or tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(p_slot.starts_at,p_slot.ends_at,'[)'))) then return 'access_restricted'; end if;
 if exists(select 1 from public.reservations r where r.user_id=p_user and r.slot_id=p_slot.id and r.status='confirmed') then return 'already_reserved'; end if;
 if not p_enabled then return 'bookings_paused'; end if;
 if p_slot.status<>'open' then return 'slot_closed'; end if;
 if p_slot.starts_at<=p_now then return 'slot_started'; end if;
 if p_now<p_slot.starts_at-make_interval(hours=>p_hours) then return 'window_not_open'; end if;
 if (select count(*) from public.reservations r where r.slot_id=p_slot.id and r.status='confirmed')>=p_slot.capacity then return 'slot_full'; end if;
 return null;
end; $$;

create or replace function activant_private.guard_reservation() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; settings public.app_settings; reason text;
begin
 if current_setting('transaction_isolation')<>'read committed' then
 raise exception 'Las escrituras de cupos requieren aislamiento READ COMMITTED.' using errcode='0A000'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id or new.slot_id<>old.slot_id
 or new.created_at<>old.created_at or old.status='cancelled') then
 raise exception 'La identidad e historia de la reserva son inmutables.' using errcode='23514'; end if;
 if new.status='confirmed' then
 perform activant_private.lock_eligible_user(new.user_id);
 select * into settings from public.app_settings where singleton for share;
 end if;
 -- Todas las escrituras de ocupación comparten el bloqueo exclusivo de esta fila.
 select * into s from public.gym_slots where id=new.slot_id for update;
 if not found then raise exception 'La franja no existe.' using errcode='23503'; end if;
 if new.status='confirmed' then
 reason=activant_private.booking_denial(new.user_id,s,clock_timestamp(),settings.booking_window_hours,settings.reservations_enabled);
 if reason='already_reserved' then raise exception 'Ya tienes una reserva activa para esta franja.' using errcode='23505',detail=reason;
 elsif reason in ('not_eligible','access_restricted') then raise exception 'No tienes acceso para reservar esta franja.' using errcode='42501',detail=reason;
 elsif reason is not null then raise exception 'No se puede reservar esta franja.' using errcode='23514',detail=reason;
 end if;
 elsif exists(select 1 from public.attendance where reservation_id=new.id) then
 raise exception 'No se puede cancelar una asistencia registrada.' using errcode='23514',detail='attendance_recorded'; end if;
 return new;
end; $$;

create or replace function public.reserve_gym_slot(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid=auth.uid();
begin
 if v_user is null then raise exception 'Se requiere una sesión válida.' using errcode='42501'; end if;
 -- Una transacción: validación y conteo se ejecutan después de obtener el bloqueo.
 insert into public.reservations(user_id,slot_id) values(v_user,p_slot_id) returning id into v_id;
 update public.waitlist set status='promoted',reservation_id=v_id,updated_at=clock_timestamp()
 where user_id=v_user and slot_id=p_slot_id and status='waiting';
 return v_id;
end; $$;
create or replace function public.cancel_gym_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots; v_admin boolean;
begin
 select * into r from public.reservations where id=p_reservation_id;
 v_admin=activant_private.has_role('admin');
 if r.id is null or auth.uid() is null or (r.user_id<>auth.uid() and not v_admin) then
 raise exception 'No puedes modificar esta reserva.' using errcode='42501'; end if;
 -- Orden franja -> reserva, también utilizado por asistencia; sin inversión de bloqueos.
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=p_reservation_id for update;
 if r.status='cancelled' then return; end if; -- Idempotencia incluso tras iniciar la franja.
 if not v_admin and s.starts_at<=clock_timestamp() then
 raise exception 'La franja ya comenzó.' using errcode='23514',detail='slot_started'; end if;
 update public.reservations set status='cancelled',cancelled_at=clock_timestamp() where id=r.id;
 -- Conserva la invalidación de desafíos preexistentes; no incorpora un flujo QR.
 update public.qr_challenges set revoked_at=clock_timestamp() where reservation_id=r.id and consumed_at is null and revoked_at is null;
end; $$;

-- Solo agregados públicos de ocupación e identificador de la reserva del propio actor.
-- No expone identidades, lista de asistentes, tokens ni reservas de otras personas.
create function public.get_gym_slot_availability(p_start timestamptz,p_end timestamptz)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,capacity integer,status public.gym_slot_status,
 occupied integer,available integer,booking_opens_at timestamptz,can_book boolean,blocking_reason text,
 reservation_id uuid,observed_at timestamptz,total_matches bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid=auth.uid(); settings public.app_settings; v_now timestamptz=statement_timestamp();
begin
 if not activant_private.active_user() then raise exception 'Se requiere un perfil activo.' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_end-p_start>interval '32 days' then
 raise exception 'El rango del calendario no es válido.' using errcode='22023'; end if;
 select * into settings from public.app_settings where singleton;
 return query select s.id,s.starts_at,s.ends_at,s.capacity,s.status,c.n,greatest(0,s.capacity-c.n),
 s.starts_at-make_interval(hours=>settings.booking_window_hours),reason.value is null,reason.value,own.id,v_now,count(*) over()
 from public.gym_slots s
 cross join lateral(select count(*)::integer n from public.reservations r where r.slot_id=s.id and r.status='confirmed') c
 cross join lateral(select activant_private.booking_denial(v_user,s,v_now,settings.booking_window_hours,settings.reservations_enabled) value) reason
 left join public.reservations own on own.slot_id=s.id and own.user_id=v_user and own.status='confirmed'
 where s.starts_at>=p_start and s.starts_at<p_end and s.status<>'cancelled'
 order by s.starts_at,s.id limit 500;
end; $$;

revoke all on function activant_private.booking_denial(uuid,public.gym_slots,timestamptz,integer,boolean) from public,anon,authenticated,service_role;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['reserve_gym_slot','cancel_gym_reservation','get_gym_slot_availability',
 'admin_update_booking_rules','admin_add_gym_access_restriction','admin_revoke_gym_access_restriction']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
commit;
