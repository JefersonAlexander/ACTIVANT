-- QR compartido del gimnasio. Conserva las asistencias y desafíos personales históricos.
begin;
create table activant_private.gym_display_challenges (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.gym_slots(id) on delete restrict,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 issued_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null,
 expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '15 seconds')
);
create index gym_display_challenges_expiry_idx on activant_private.gym_display_challenges(expires_at);
create index gym_display_challenges_slot_idx on activant_private.gym_display_challenges(slot_id);
create index gym_display_challenges_issuer_idx on activant_private.gym_display_challenges(issued_by);
create table activant_private.attendance_rate_limits (
 user_id uuid not null references public.profiles(id) on delete cascade,
 operation text not null check(operation in ('scan','issue','manual')),
 minute_start timestamptz not null, minute_count integer not null,
 hour_start timestamptz not null, hour_count integer not null,
 primary key(user_id,operation)
);
alter table activant_private.gym_display_challenges enable row level security;
alter table activant_private.attendance_rate_limits enable row level security;
revoke all on activant_private.gym_display_challenges,activant_private.attendance_rate_limits from public,anon,authenticated,service_role;

alter table public.attendance add column display_challenge_id uuid references activant_private.gym_display_challenges(id) on delete restrict;
alter table public.attendance add column manual_reason text check(manual_reason in ('camera_unavailable','device_unavailable','connectivity','accessibility'));
alter table public.attendance drop constraint attendance_check;
alter table public.attendance add constraint attendance_evidence_check check(
 (method='qr' and num_nonnulls(qr_challenge_id,display_challenge_id)=1 and manual_reason is null)
 or (method='staff' and qr_challenge_id is null and display_challenge_id is null)
);
create index attendance_display_challenge_idx on public.attendance(display_challenge_id) where display_challenge_id is not null;

-- Límites durables por identidad y operación, serializados por fila. Los rechazos de
-- negocio se devuelven como resultados: lanzar una excepción desharía el contador.
create function activant_private.attendance_attempt(p_operation text,p_minute_limit integer,p_hour_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_now timestamptz=clock_timestamp(); v_min integer; v_hour integer;
begin
 insert into activant_private.attendance_rate_limits as l(user_id,operation,minute_start,minute_count,hour_start,hour_count)
 values(auth.uid(),p_operation,date_trunc('minute',v_now),1,date_trunc('hour',v_now),1)
 on conflict(user_id,operation) do update set
 minute_start=date_trunc('minute',v_now),
 minute_count=case when l.minute_start=date_trunc('minute',v_now) then least(l.minute_count+1,p_minute_limit+1) else 1 end,
 hour_start=date_trunc('hour',v_now),
 hour_count=case when l.hour_start=date_trunc('hour',v_now) then least(l.hour_count+1,p_hour_limit+1) else 1 end
 returning minute_count,hour_count into v_min,v_hour;
 return v_min<=p_minute_limit and v_hour<=p_hour_limit;
end; $$;

-- Orden de bloqueo compartido con reservas: perfil/habilitación, franja, reserva.
create function activant_private.attendance_denial(p_reservation_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots; v_now timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Se requiere READ COMMITTED.' using errcode='0A000'; end if;
 select * into r from public.reservations where id=p_reservation_id;
 if not found then return 'no_reservation'; end if;
 begin
 perform activant_private.lock_eligible_user(r.user_id);
 exception when insufficient_privilege then return 'not_eligible'; end;
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=p_reservation_id for update;
 v_now=clock_timestamp();
 if r.status<>'confirmed' then return 'reservation_cancelled'; end if;
 if s.status='cancelled' or v_now<s.starts_at or v_now>=s.ends_at then return 'outside_window'; end if;
 if not exists(select 1 from public.gym_eligibility where user_id=r.user_id and valid_from<=s.starts_at and (valid_until is null or valid_until>=s.ends_at)) then return 'not_eligible'; end if;
 if exists(select 1 from public.gym_access_restrictions where user_id=r.user_id and revoked_at is null and starts_at<=v_now and (ends_at is null or ends_at>v_now)) then return 'access_restricted'; end if;
 if exists(select 1 from public.attendance where reservation_id=r.id) then return 'already_recorded'; end if;
 return null;
end; $$;
create function activant_private.display_challenge_valid(p_id uuid,p_slot_id uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from activant_private.gym_display_challenges q
 join public.profiles p on p.id=q.issued_by and p.is_active
 where q.id=p_id and q.slot_id=p_slot_id and q.created_at<=clock_timestamp() and q.expires_at>clock_timestamp()
 and exists(select 1 from public.user_roles where user_id=q.issued_by and role in ('gym_staff','admin')));
$$;
create or replace function activant_private.guard_attendance() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_denial text; r public.reservations;
begin
 v_denial=activant_private.attendance_denial(new.reservation_id);
 if v_denial is not null then raise exception 'La reserva no admite asistencia.' using errcode='23514',detail=v_denial; end if;
 select * into r from public.reservations where id=new.reservation_id;
 if new.recorded_by is distinct from auth.uid() then raise exception 'Responsable inválido.' using errcode='42501'; end if;
 if new.method='staff' then
 perform activant_private.require_staff();
 if new.manual_reason is null then raise exception 'El registro manual exige un motivo.' using errcode='23514'; end if;
 elsif new.qr_challenge_id is not null or r.user_id is distinct from auth.uid()
 or not activant_private.display_challenge_valid(new.display_challenge_id,r.slot_id) then
 raise exception 'QR inválido.' using errcode='23514',detail='invalid_qr';
 end if;
 new.checked_in_at=clock_timestamp();
 if not exists(select 1 from public.gym_slots where id=r.slot_id and starts_at<=new.checked_in_at and ends_at>new.checked_in_at) then
 raise exception 'Fuera de horario.' using errcode='23514',detail='outside_window'; end if;
 if new.method='qr' and not exists(select 1 from activant_private.gym_display_challenges where id=new.display_challenge_id and created_at<=new.checked_in_at and expires_at>new.checked_in_at) then
 raise exception 'QR vencido.' using errcode='23514',detail='expired_qr'; end if;
 return new;
end; $$;

create function public.issue_gym_display_qr() returns table(outcome text,token text,expires_at timestamptz,server_now timestamptz,slot_id uuid,starts_at timestamptz,ends_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; v_now timestamptz; v_token text; v_expiry timestamptz;
begin
 perform activant_private.require_staff();
 if not activant_private.attendance_attempt('issue',8,480) then return query select 'rate_limited',null::text,null::timestamptz,clock_timestamp(),null::uuid,null::timestamptz,null::timestamptz; return; end if;
 v_now=clock_timestamp();
 select * into s from public.gym_slots where status<>'cancelled' and gym_slots.starts_at<=v_now and gym_slots.ends_at>v_now order by gym_slots.starts_at limit 1 for share;
 if not found then return query select 'no_current_slot',null::text,null::timestamptz,v_now,null::uuid,null::timestamptz,null::timestamptz; return; end if;
 -- Dos UUID v4 generados en PostgreSQL: 244 bits aleatorios. Nunca se persiste el token.
 v_token=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 v_expiry=least(v_now+interval '15 seconds',s.ends_at);
 insert into activant_private.gym_display_challenges(slot_id,token_hash,issued_by,created_at,expires_at)
 values(s.id,encode(sha256(convert_to(v_token,'UTF8')),'hex'),auth.uid(),v_now,v_expiry);
 return query select 'ok',v_token,v_expiry,v_now,s.id,s.starts_at,s.ends_at;
end; $$;

create function public.check_in_gym_qr(p_token text) returns table(outcome text,reservation_id uuid,checked_in_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare q activant_private.gym_display_challenges; r public.reservations; v_denial text; v_time timestamptz;
begin
 if auth.uid() is null or not activant_private.active_user() then return query select 'inactive_account',null::uuid,null::timestamptz; return; end if;
 if not activant_private.attendance_attempt('scan',10,60) then return query select 'rate_limited',null::uuid,null::timestamptz; return; end if;
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return query select 'invalid_qr',null::uuid,null::timestamptz; return; end if;
 select * into q from activant_private.gym_display_challenges where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if not found then return query select 'invalid_qr',null::uuid,null::timestamptz; return; end if;
 if not activant_private.display_challenge_valid(q.id,q.slot_id) then return query select 'expired_qr',null::uuid,null::timestamptz; return; end if;
 select * into r from public.reservations where user_id=auth.uid() and reservations.slot_id=q.slot_id order by (status='confirmed') desc,created_at desc limit 1;
 if not found then return query select 'no_reservation',null::uuid,null::timestamptz; return; end if;
 -- El subbloque conserva el contador incluso si el trigger detecta una carrera al expirar.
 begin
 v_denial=activant_private.attendance_denial(r.id);
 if v_denial is null and not activant_private.display_challenge_valid(q.id,q.slot_id) then v_denial='expired_qr'; end if;
 if v_denial is null then
 insert into public.attendance(reservation_id,recorded_by,method,display_challenge_id)
 values(r.id,auth.uid(),'qr',q.id) returning attendance.checked_in_at into v_time;
 end if;
 exception when check_violation then v_denial='expired_qr'; when unique_violation then v_denial='already_recorded'; end;
 return query select coalesce(v_denial,'ok'),case when v_denial is null then r.id else null end,v_time;
end; $$;
create function public.record_gym_manual_attendance(p_reservation_id uuid,p_reason text) returns table(outcome text,reservation_id uuid,checked_in_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_denial text; v_time timestamptz;
begin
 perform activant_private.require_staff();
 if not activant_private.attendance_attempt('manual',30,300) then return query select 'rate_limited',null::uuid,null::timestamptz; return; end if;
 if p_reason is null or p_reason not in ('camera_unavailable','device_unavailable','connectivity','accessibility') then
 return query select 'invalid_reason',null::uuid,null::timestamptz; return; end if;
 begin
 v_denial=activant_private.attendance_denial(p_reservation_id);
 if v_denial is null then
 insert into public.attendance(reservation_id,recorded_by,method,manual_reason)
 values(p_reservation_id,auth.uid(),'staff',p_reason) returning attendance.checked_in_at into v_time;
 end if;
 exception when check_violation then v_denial='outside_window'; when unique_violation then v_denial='already_recorded'; end;
 return query select coalesce(v_denial,'ok'),case when v_denial is null then p_reservation_id else null end,v_time;
end; $$;

-- Desactiva la API preliminar, sin borrar funciones, desafíos ni asistencias históricas.
revoke all on function public.issue_gym_qr_challenge(uuid),public.consume_gym_qr_challenge(text),public.record_gym_attendance(uuid) from public,anon,authenticated,service_role;
revoke all on function activant_private.attendance_attempt(text,integer,integer),activant_private.attendance_denial(uuid),activant_private.display_challenge_valid(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.issue_gym_display_qr(),public.check_in_gym_qr(text),public.record_gym_manual_attendance(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.issue_gym_display_qr(),public.check_in_gym_qr(text),public.record_gym_manual_attendance(uuid,text) to authenticated;
comment on function public.check_in_gym_qr(text) is 'QR compartido de 15 segundos; identidad auth.uid(), reloj PostgreSQL y límites persistentes. No registrar argumentos en logs.';
commit;
