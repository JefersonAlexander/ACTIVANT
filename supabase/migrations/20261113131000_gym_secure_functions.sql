-- API SQL privilegiada: sin escrituras arbitrarias de tablas desde PostgREST.
begin;
create function activant_private.guard_reservation() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots;
begin
 if current_setting('transaction_isolation') <> 'read committed' then
 raise exception 'Las escrituras de cupos requieren aislamiento READ COMMITTED.' using errcode='0A000'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.user_id<>old.user_id or new.slot_id<>old.slot_id
 or new.created_at<>old.created_at or old.status='cancelled') then
 raise exception 'La identidad e historia de la reserva son inmutables.' using errcode='23514'; end if;
 if new.status='confirmed' then perform activant_private.lock_eligible_user(new.user_id); end if;
 select * into s from public.gym_slots where id=new.slot_id for update;
 if not found then raise exception 'La franja no existe.' using errcode='23503'; end if;
 if new.status='confirmed' then
 perform activant_private.lock_eligible_user(new.user_id);
 if s.status<>'open' or s.starts_at<=clock_timestamp() then raise exception 'La franja no está disponible.' using errcode='23514'; end if;
 if not exists(select 1 from public.gym_eligibility where user_id=new.user_id and valid_from<=s.starts_at and (valid_until is null or valid_until>=s.ends_at)) then
 raise exception 'La habilitación no cubre la franja completa.' using errcode='42501'; end if;
 if exists(select 1 from public.reservations where user_id=new.user_id and slot_id=new.slot_id and status='confirmed' and id<>new.id) then
 raise exception 'Ya existe una reserva activa.' using errcode='23505'; end if;
 if (select count(*) from public.reservations where slot_id=new.slot_id and status='confirmed' and id<>new.id)>=s.capacity then
 raise exception 'La franja está completa.' using errcode='23514'; end if;
 elsif exists(select 1 from public.attendance where reservation_id=new.id) then
 raise exception 'No se puede cancelar una asistencia registrada.' using errcode='23514'; end if;
 return new;
end; $$;
create trigger guard_reservation before insert or update on public.reservations for each row execute function activant_private.guard_reservation();

create function activant_private.guard_slot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then
 raise exception 'Las escrituras de cupos requieren aislamiento READ COMMITTED.' using errcode='0A000'; end if;
 if new.id<>old.id or new.created_at<>old.created_at or new.created_by is distinct from old.created_by then
 raise exception 'La identidad de la franja es inmutable.' using errcode='23514'; end if;
 if (new.starts_at<>old.starts_at or new.ends_at<>old.ends_at) and exists(select 1 from public.reservations where slot_id=old.id) then
 raise exception 'No se puede cambiar el horario con historial de reservas.' using errcode='23514'; end if;
 if new.capacity<(select count(*) from public.reservations where slot_id=old.id and status='confirmed') then
 raise exception 'La capacidad no puede ser menor a las reservas activas.' using errcode='23514'; end if;
 if new.status='cancelled' and (exists(select 1 from public.reservations where slot_id=old.id and status='confirmed')
 or exists(select 1 from public.waitlist where slot_id=old.id and status='waiting')) then
 raise exception 'Primero deben gestionarse las reservas y la lista de espera.' using errcode='23514'; end if;
 return new;
end; $$;
create trigger guard_slot before update on public.gym_slots for each row execute function activant_private.guard_slot();

create function activant_private.guard_attendance() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots;
begin
 select * into r from public.reservations where id=new.reservation_id;
 if not found then raise exception 'La reserva no existe.' using errcode='23503'; end if;
 perform activant_private.lock_eligible_user(r.user_id);
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=new.reservation_id for update;
 if r.status<>'confirmed' or s.status='cancelled' or clock_timestamp()<s.starts_at or clock_timestamp()>=s.ends_at then
 raise exception 'La reserva no admite asistencia en este momento.' using errcode='23514'; end if;
 if new.checked_in_at<s.starts_at or new.checked_in_at>=s.ends_at then raise exception 'La asistencia está fuera de horario.' using errcode='23514'; end if;
 if new.recorded_by is distinct from auth.uid() then raise exception 'El responsable de asistencia no es válido.' using errcode='42501'; end if;
 if new.method='qr' and not exists(select 1 from public.qr_challenges where id=new.qr_challenge_id
 and reservation_id=r.id and consumed_at is not null and revoked_at is null) then
 raise exception 'El desafío QR no ha sido validado.' using errcode='23514'; end if;
 return new;
end; $$;
create trigger guard_attendance before insert on public.attendance for each row execute function activant_private.guard_attendance();

create function public.admin_set_profile_access(p_user_id uuid,p_is_active boolean,p_affiliation_type text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_user_id=auth.uid() then raise exception 'No puedes modificar tu propia habilitación de perfil.' using errcode='42501'; end if;
 update public.profiles set is_active=p_is_active,affiliation_type=p_affiliation_type where id=p_user_id;
 if not found then raise exception 'El perfil no existe.' using errcode='23503'; end if;
end; $$;
create function public.admin_set_user_role(p_user_id uuid,p_role public.app_role,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_user_id is null or p_role is null or p_enabled is null then raise exception 'Los parámetros de rol son obligatorios.' using errcode='22004'; end if;
 if p_user_id=auth.uid() then raise exception 'No puedes modificar tus propios roles.' using errcode='42501'; end if;
 if p_role='user' and not p_enabled then raise exception 'No se elimina el rol base.' using errcode='23514'; end if;
 if p_enabled then insert into public.user_roles(user_id,role,granted_by) values(p_user_id,p_role,auth.uid()) on conflict(user_id,role) do nothing;
 else delete from public.user_roles where user_id=p_user_id and role=p_role; end if;
end; $$;
create function public.admin_set_gym_eligibility(p_user_id uuid,p_is_eligible boolean,p_valid_from timestamptz,p_valid_until timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_user_id=auth.uid() then raise exception 'No puedes modificar tu propia habilitación de gimnasio.' using errcode='42501'; end if;
 -- Orden de bloqueo compartido con reservas y control de acceso.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'El perfil no existe.' using errcode='23503'; end if;
 insert into public.gym_eligibility(user_id,is_eligible,valid_from,valid_until,authorized_by)
 values(p_user_id,p_is_eligible,p_valid_from,p_valid_until,auth.uid())
 on conflict(user_id) do update set is_eligible=excluded.is_eligible,valid_from=excluded.valid_from,
 valid_until=excluded.valid_until,authorized_by=excluded.authorized_by,updated_at=clock_timestamp();
end; $$;
create function public.admin_upsert_affiliation_type(p_code text,p_label text,p_is_active boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 insert into public.affiliation_types(code,label,is_active) values(p_code,p_label,p_is_active)
 on conflict(code) do update set label=excluded.label,is_active=excluded.is_active;
end; $$;
create function public.admin_update_app_settings(p_default_slot_capacity integer,p_qr_ttl_seconds integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 update public.app_settings set default_slot_capacity=p_default_slot_capacity,qr_ttl_seconds=p_qr_ttl_seconds,
 updated_at=clock_timestamp(),updated_by=auth.uid() where singleton;
end; $$;
create function public.admin_create_gym_slot(p_starts_at timestamptz,p_ends_at timestamptz,p_capacity integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_capacity integer;
begin
 perform activant_private.require_admin();
 select coalesce(p_capacity,default_slot_capacity) into v_capacity from public.app_settings where singleton;
 insert into public.gym_slots(starts_at,ends_at,capacity,created_by) values(p_starts_at,p_ends_at,v_capacity,auth.uid()) returning id into v_id;
 return v_id;
end; $$;
create function public.admin_update_gym_slot(p_slot_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_capacity integer,p_status public.gym_slot_status) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 update public.gym_slots set starts_at=p_starts_at,ends_at=p_ends_at,capacity=p_capacity,status=p_status where id=p_slot_id;
 if not found then raise exception 'La franja no existe.' using errcode='23503'; end if;
end; $$;

create function public.reserve_gym_slot(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_user uuid=auth.uid();
begin
 if v_user is null then raise exception 'Se requiere una sesión válida.' using errcode='42501'; end if;
 -- El trigger bloquea usuario/habilitación/franja y valida vigencia, duplicados y capacidad.
 insert into public.reservations(user_id,slot_id) values(v_user,p_slot_id) returning id into v_id;
 update public.waitlist set status='promoted',reservation_id=v_id,updated_at=clock_timestamp()
 where user_id=v_user and slot_id=p_slot_id and status='waiting';
 return v_id;
end; $$;
create function public.cancel_gym_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots; v_admin boolean;
begin
 select * into r from public.reservations where id=p_reservation_id;
 v_admin=activant_private.has_role('admin');
 if not found or auth.uid() is null or (r.user_id<>auth.uid() and not v_admin) then
 raise exception 'No puedes modificar esta reserva.' using errcode='42501'; end if;
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=p_reservation_id for update;
 if r.status<>'confirmed' then raise exception 'La reserva ya está cancelada.' using errcode='23514'; end if;
 if not v_admin and s.starts_at<=clock_timestamp() then raise exception 'La franja ya comenzó.' using errcode='23514'; end if;
 update public.reservations set status='cancelled',cancelled_at=clock_timestamp() where id=r.id;
 update public.qr_challenges set revoked_at=clock_timestamp() where reservation_id=r.id and consumed_at is null and revoked_at is null;
end; $$;
create function public.join_gym_waitlist(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; v_id uuid; v_user uuid=auth.uid();
begin
 perform activant_private.lock_eligible_user(v_user);
 select * into s from public.gym_slots where id=p_slot_id for update;
 perform activant_private.lock_eligible_user(v_user);
 if s.id is null or s.status<>'open' or s.starts_at<=clock_timestamp() then raise exception 'La franja no está disponible.' using errcode='23514'; end if;
 if not exists(select 1 from public.gym_eligibility where user_id=v_user and valid_from<=s.starts_at and (valid_until is null or valid_until>=s.ends_at)) then
 raise exception 'La habilitación no cubre la franja completa.' using errcode='42501'; end if;
 if exists(select 1 from public.reservations where user_id=v_user and slot_id=s.id and status='confirmed') then raise exception 'Ya tienes una reserva activa.' using errcode='23505'; end if;
 if (select count(*) from public.reservations where slot_id=s.id and status='confirmed')<s.capacity then raise exception 'Hay cupos disponibles para reservar.' using errcode='23514'; end if;
 insert into public.waitlist(user_id,slot_id) values(v_user,s.id) returning id into v_id;
 return v_id;
end; $$;
create function public.leave_gym_waitlist(p_waitlist_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Se requiere una sesión válida.' using errcode='42501'; end if;
 update public.waitlist set status='cancelled',updated_at=clock_timestamp()
 where id=p_waitlist_id and status='waiting' and (user_id=auth.uid() or activant_private.has_role('admin'));
 if not found then raise exception 'No puedes modificar esta entrada de espera.' using errcode='42501'; end if;
end; $$;

create function public.issue_gym_qr_challenge(p_reservation_id uuid) returns table(challenge_id uuid,token text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots; v_token text; v_hash text; v_expires timestamptz; v_created timestamptz; v_id uuid; v_ttl integer;
begin
 select * into r from public.reservations where id=p_reservation_id;
 if not found or r.user_id is distinct from auth.uid() then raise exception 'No puedes generar este QR.' using errcode='42501'; end if;
 perform activant_private.lock_eligible_user(r.user_id);
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=p_reservation_id for update;
 v_created=clock_timestamp();
 if r.status<>'confirmed' or s.status='cancelled' or v_created<s.starts_at or v_created>=s.ends_at then raise exception 'La reserva no está en su franja de asistencia.' using errcode='23514'; end if;
 if exists(select 1 from public.attendance where reservation_id=r.id) then raise exception 'La asistencia ya está registrada.' using errcode='23514'; end if;
 select qr_ttl_seconds into v_ttl from public.app_settings where singleton;
 v_expires=least(v_created+make_interval(secs=>v_ttl),s.ends_at);
 -- Dos UUID aleatorios: 244 bits de entropía. Solo se persiste SHA-256.
 v_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 v_hash=encode(sha256(convert_to(v_token,'UTF8')),'hex');
 update public.qr_challenges set revoked_at=clock_timestamp() where reservation_id=r.id and consumed_at is null and revoked_at is null;
 insert into public.qr_challenges(reservation_id,token_hash,issued_by,created_at,expires_at)
 values(r.id,v_hash,auth.uid(),v_created,v_expires) returning id into v_id;
 return query select v_id,v_token,v_expires;
end; $$;
create function public.record_gym_attendance(p_reservation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_staff();
 insert into public.attendance(reservation_id,recorded_by,method) values(p_reservation_id,auth.uid(),'staff');
end; $$;
create function public.consume_gym_qr_challenge(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.qr_challenges; r public.reservations; v_now timestamptz;
begin
 perform activant_private.require_staff();
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'El QR no es válido.' using errcode='23514'; end if;
 select * into q from public.qr_challenges where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then raise exception 'El QR no es válido.' using errcode='23514'; end if;
 select * into r from public.reservations where id=q.reservation_id;
 perform activant_private.lock_eligible_user(r.user_id);
 perform 1 from public.gym_slots where id=r.slot_id for update;
 perform 1 from public.reservations where id=r.id for update;
 select * into q from public.qr_challenges where id=q.id for update;
 v_now=clock_timestamp();
 if q.consumed_at is not null or q.revoked_at is not null or q.expires_at<=v_now then raise exception 'El QR no es válido o ya fue utilizado.' using errcode='23514'; end if;
 update public.qr_challenges set consumed_at=v_now where id=q.id;
 insert into public.attendance(reservation_id,recorded_by,method,qr_challenge_id) values(r.id,auth.uid(),'qr',q.id);
 return r.id;
end; $$;

-- Sin permisos implícitos de ejecución para PUBLIC o anon.
revoke all on all functions in schema activant_private from public,anon,authenticated,service_role;
grant execute on function activant_private.has_role(public.app_role),activant_private.active_user() to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['admin_set_profile_access','admin_set_user_role','admin_set_gym_eligibility',
 'admin_upsert_affiliation_type','admin_update_app_settings','admin_create_gym_slot','admin_update_gym_slot','reserve_gym_slot',
 'cancel_gym_reservation','join_gym_waitlist','leave_gym_waitlist','issue_gym_qr_challenge','record_gym_attendance','consume_gym_qr_challenge']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
commit;
