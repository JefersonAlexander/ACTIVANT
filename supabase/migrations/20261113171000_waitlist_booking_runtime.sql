begin;
-- Se añade un control de retención al guard existente. No sustituye sus reglas.
create function activant_private.guard_waitlist_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_capacity integer; v_held integer;
begin
 if new.status<>'confirmed' then return new; end if;
 -- guard_reservation ya bloqueó perfil, configuración y franja.
 perform activant_private.dispatch_gym_waitlist(new.slot_id);
 if exists(select 1 from public.waitlist_offers where slot_id=new.slot_id and user_id=new.user_id and status='pending' and expires_at>clock_timestamp()) then
 raise exception 'Confirma tu oferta desde la lista de espera.' using errcode='23514',detail='offer_response_required'; end if;
 select capacity into v_capacity from public.gym_slots where id=new.slot_id;
 if exists(select 1 from public.waitlist q where q.slot_id=new.slot_id and q.status='waiting' and not exists(select 1 from public.waitlist_offers o where o.waitlist_id=q.id))
 and not exists(select 1 from public.waitlist_offers o where o.status='accepted' and o.reservation_id=new.id and o.user_id=new.user_id and o.slot_id=new.slot_id) then
 raise exception 'La lista de espera tiene prioridad.' using errcode='23514',detail='waitlist_priority'; end if;
 select count(*)::integer into v_held from public.waitlist_offers o where o.slot_id=new.slot_id and
 ((o.status='pending' and o.expires_at>clock_timestamp()) or
 (o.status='accepted' and o.reservation_id<>new.id and not exists(select 1 from public.reservations r where r.id=o.reservation_id)));
 if (select count(*) from public.reservations where slot_id=new.slot_id and status='confirmed')+v_held>=v_capacity then
 raise exception 'El cupo está ofrecido a la lista de espera.' using errcode='23514',detail='waitlist_priority'; end if;
 return new;
end; $$;
create trigger z_guard_waitlist_capacity before insert on public.reservations for each row execute function activant_private.guard_waitlist_capacity();

create function activant_private.reservation_notifications() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_kind text;
begin
 if tg_op='INSERT' and new.status='confirmed' then v_kind='reservation_confirmed';
 elsif tg_op='UPDATE' and old.status='confirmed' and new.status='cancelled' then v_kind='reservation_cancelled';
 else return null; end if;
 insert into public.notifications(user_id,kind,event_key,slot_id,reservation_id)
 values(new.user_id,v_kind,v_kind||':'||new.id,new.slot_id,new.id) on conflict(event_key) do nothing;
 perform activant_private.dispatch_gym_waitlist(new.slot_id);
 return null;
end; $$;
create trigger waitlist_reservation_notifications after insert or update on public.reservations for each row execute function activant_private.reservation_notifications();

create function activant_private.guard_slot_holds() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.capacity<(select count(*) from public.reservations where slot_id=old.id and status='confirmed')+activant_private.held_gym_seats(old.id) then
 raise exception 'La capacidad debe cubrir las reservas y las ofertas vigentes.' using errcode='23514',detail='capacity_below_holds'; end if;
 -- Conserva las fechas ofrecidas aunque aún no exista reserva confirmada.
 if (new.starts_at<>old.starts_at or new.ends_at<>old.ends_at) and exists(select 1 from public.waitlist where slot_id=old.id) then
 raise exception 'La franja tiene historial de lista de espera.' using errcode='23514',detail='waitlist_slot_history'; end if;
 return new;
end; $$;
create trigger z_guard_slot_holds before update on public.gym_slots for each row execute function activant_private.guard_slot_holds();
create function activant_private.slot_waitlist_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.dispatch_gym_waitlist(new.id); return null;
end; $$;
create trigger waitlist_slot_change after update on public.gym_slots for each row execute function activant_private.slot_waitlist_change();

create or replace function public.get_gym_slot_availability(p_start timestamptz,p_end timestamptz)
returns table(slot_id uuid,starts_at timestamptz,ends_at timestamptz,capacity integer,status public.gym_slot_status,
 occupied integer,available integer,booking_opens_at timestamptz,can_book boolean,blocking_reason text,
 reservation_id uuid,observed_at timestamptz,total_matches bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid=auth.uid(); cfg public.app_settings; v_now timestamptz=statement_timestamp();
begin
 if not activant_private.active_user() then raise exception 'Se requiere un perfil activo.' using errcode='42501'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or p_end-p_start>interval '32 days' then
 raise exception 'El rango del calendario no es válido.' using errcode='22023'; end if;
 select * into cfg from public.app_settings where singleton;
 return query select s.id,s.starts_at,s.ends_at,s.capacity,s.status,c.n,greatest(0,s.capacity-c.n-h.n),
 s.starts_at-make_interval(hours=>cfg.booking_window_hours),reason.value is null,reason.value,own.id,v_now,count(*) over()
 from public.gym_slots s
 cross join lateral(select count(*)::integer n from public.reservations r where r.slot_id=s.id and r.status='confirmed') c
 cross join lateral(select activant_private.held_gym_seats(s.id) n) h
 cross join lateral(select activant_private.booking_denial(v_user,s,v_now,cfg.booking_window_hours,cfg.reservations_enabled) value) base
 cross join lateral(select case when base.value is not null then base.value
 when exists(select 1 from public.waitlist_offers o where o.slot_id=s.id and o.user_id=v_user and o.status='pending' and o.expires_at>v_now) then 'offer_response_required'
 when c.n+h.n>=s.capacity then 'slot_full' else null end value) reason
 left join public.reservations own on own.slot_id=s.id and own.user_id=v_user and own.status='confirmed'
 where s.starts_at>=p_start and s.starts_at<p_end and s.status<>'cancelled'
 order by s.starts_at,s.id limit 500;
end; $$;

-- Job exclusivo del propietario SQL: no RPC público, no endpoint HTTP ni claves.
create function activant_private.run_waitlist_maintenance() returns void
language plpgsql security definer set search_path='' as $$
declare s record; r record; cfg public.app_settings;
begin
 -- Impide dos ejecuciones del job a la vez; las acciones siguen por franja.
 if not pg_try_advisory_xact_lock(71420,1) then return; end if;
 perform set_config('lock_timeout','5s',true);
 for s in select g.id from activant_private.waitlist_jobs j join public.gym_slots g on g.id=j.slot_id where j.run_after<=clock_timestamp()
 order by j.run_after,g.id limit 100 for update of g skip locked loop
 perform activant_private.dispatch_gym_waitlist(s.id);
 end loop;
 select * into cfg from public.app_settings where singleton;
 if cfg.reservation_reminders_enabled then
 for s in select g.id from public.gym_slots g where g.status='open' and g.starts_at>clock_timestamp()
 and g.starts_at<=clock_timestamp()+make_interval(mins=>cfg.reservation_reminder_minutes)
 and exists(select 1 from public.reservations b join public.profiles p on p.id=b.user_id where b.slot_id=g.id and b.status='confirmed' and p.is_active
 and not exists(select 1 from public.notifications n where n.event_key='reminder:'||b.id))
 order by g.starts_at,g.id limit 100 for update skip locked loop
 for r in select * from public.reservations where slot_id=s.id and status='confirmed' order by id loop
 insert into public.notifications(user_id,kind,event_key,slot_id,reservation_id)
 select r.user_id,'reservation_reminder','reminder:'||r.id,r.slot_id,r.id
 where exists(select 1 from public.profiles where id=r.user_id and is_active)
 on conflict(event_key) do nothing;
 end loop;
 end loop;
 end if;
end; $$;

-- Una pausa/reanudación también despierta colas sin oferta, sin bloquear perfiles.
create function activant_private.wake_waitlists() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.reservations_enabled is distinct from old.reservations_enabled or new.booking_window_hours<>old.booking_window_hours then
 insert into activant_private.waitlist_jobs(slot_id,run_after)
 select distinct slot_id,clock_timestamp() from public.waitlist where status='waiting'
 on conflict(slot_id) do update set run_after=excluded.run_after;
 end if;
 return null;
end; $$;
create trigger wake_waitlists after update on public.app_settings for each row execute function activant_private.wake_waitlists();

-- Incluye colas que existieran antes de esta migración, sin reescribirlas.
insert into activant_private.waitlist_jobs(slot_id,run_after)
select distinct slot_id,clock_timestamp() from public.waitlist where status='waiting';

-- Idempotente. Se ejecuta de nuevo tras habilitar Cron desde Supabase.
create function activant_private.install_waitlist_runtime() returns void
language plpgsql security definer set search_path='' as $$
declare t text;
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
 execute $job$select cron.schedule('activant-waitlist-maintenance','* * * * *','select activant_private.run_waitlist_maintenance();')$job$;
 else raise notice 'Habilita pg_cron y ejecuta supabase/operations/enable_waitlist_jobs.sql para la expiración automática.'; end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 foreach t in array array['notifications','waitlist_offers','gym_availability_signals'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
 execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
 else raise notice 'Realtime no está disponible en este clúster; la interfaz conserva actualización periódica.'; end if;
end; $$;
revoke all on all functions in schema activant_private from public,anon,authenticated,service_role;
grant execute on function activant_private.has_role(public.app_role),activant_private.active_user() to authenticated;
select activant_private.install_waitlist_runtime();
commit;
