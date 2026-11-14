-- Ofertas de cupos y notificaciones internas. Extensión aditiva, sin backfill.
begin;
alter table public.app_settings
 add column waitlist_offer_minutes integer not null default 5 check(waitlist_offer_minutes between 1 and 30),
 add column reservation_reminders_enabled boolean not null default false,
 add column reservation_reminder_minutes integer not null default 60 check(reservation_reminder_minutes between 5 and 1440);
alter table public.waitlist add constraint waitlist_identity unique(id,user_id,slot_id);

create table public.waitlist_offers (
 id uuid primary key default gen_random_uuid(),
 waitlist_id uuid not null unique,
 user_id uuid not null,
 slot_id uuid not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','expired','revoked')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 responded_at timestamptz,
 response_by uuid references auth.users(id) on delete restrict,
 reason text check(reason in ('accepted','declined','timeout','left_queue','no_longer_eligible','slot_unavailable')),
 reservation_id uuid unique,
 foreign key(waitlist_id,user_id,slot_id) references public.waitlist(id,user_id,slot_id) on delete restrict,
 foreign key(reservation_id,user_id,slot_id) references public.reservations(id,user_id,slot_id) on delete restrict deferrable initially deferred,
 check(expires_at>created_at and expires_at<=created_at+interval '30 minutes'),
 check((status='pending')=(responded_at is null)),
 check((status='pending')=(reason is null)),
 check((status='accepted')=(reservation_id is not null)),
 check(responded_at is null or responded_at>=created_at),
 check(status<>'accepted' or responded_at<expires_at)
);
create index waitlist_offers_slot_pending on public.waitlist_offers(slot_id,expires_at) where status='pending';
create index waitlist_offers_slot_status on public.waitlist_offers(slot_id,status);
create index waitlist_offers_user_history on public.waitlist_offers(user_id,created_at desc);
create table activant_private.waitlist_jobs (
 slot_id uuid primary key references public.gym_slots(id) on delete restrict,
 run_after timestamptz not null
);
revoke all on activant_private.waitlist_jobs from public,anon,authenticated,service_role;
create index waitlist_jobs_due on activant_private.waitlist_jobs(run_after,slot_id);

create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 -- Referencia auth.users: el asignador no invierte el orden perfil -> franja.
 user_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('reservation_confirmed','reservation_cancelled','waitlist_offer','waitlist_expired','waitlist_unavailable','reservation_reminder')),
 event_key text not null unique check(length(event_key) between 1 and 200),
 slot_id uuid not null references public.gym_slots(id) on delete restrict,
 reservation_id uuid references public.reservations(id) on delete restrict,
 offer_id uuid references public.waitlist_offers(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz check(read_at is null or read_at>=created_at)
);
create index notifications_user_history on public.notifications(user_id,created_at desc,id);
create index notifications_unread on public.notifications(user_id) where read_at is null;

-- Señal mínima para Realtime: nunca publica reservas ni identidades de asistentes.
create table public.gym_availability_signals (
 slot_id uuid primary key references public.gym_slots(id) on delete restrict,
 revision bigint not null default 1,
 changed_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
 foreach t in array array['waitlist_offers','notifications','gym_availability_signals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end; $$;
create policy own_offers on public.waitlist_offers for select to authenticated
 using(activant_private.active_user() and user_id=(select auth.uid()));
create policy own_notifications on public.notifications for select to authenticated
 using(activant_private.active_user() and user_id=(select auth.uid()));
create policy active_availability on public.gym_availability_signals for select to authenticated using(activant_private.active_user());
create trigger z_audit_change after insert or update or delete on public.waitlist_offers
 for each row execute function activant_private.audit_change();

create function activant_private.signal_gym_availability(p_slot uuid) returns void
language sql security definer set search_path='' as $$
 insert into public.gym_availability_signals(slot_id) values(p_slot)
 on conflict(slot_id) do update set revision=public.gym_availability_signals.revision+1,changed_at=clock_timestamp();
$$;
create function activant_private.held_gym_seats(p_slot uuid) returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.waitlist_offers o where o.slot_id=p_slot and
 ((o.status='pending' and o.expires_at>statement_timestamp()) or
 (o.status='accepted' and not exists(select 1 from public.reservations r where r.id=o.reservation_id)));
$$;
create function activant_private.guard_waitlist_offer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or old.status<>'pending' or new.id<>old.id or new.waitlist_id<>old.waitlist_id
 or new.user_id<>old.user_id or new.slot_id<>old.slot_id or new.created_at<>old.created_at or new.expires_at<>old.expires_at
 or new.status='pending' then
 raise exception 'La historia de ofertas es inmutable.' using errcode='42501'; end if;
 return new;
end; $$;
create trigger guard_waitlist_offer before update or delete on public.waitlist_offers for each row execute function activant_private.guard_waitlist_offer();

-- La única exclusión de cupos es la fila de gym_slots, compartida con reservas.
-- No adquiere bloqueos de perfil de candidatos: se revalidan al aceptar.
create function activant_private.dispatch_gym_waitlist(p_slot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; cfg public.app_settings; o public.waitlist_offers; w public.waitlist;
 v_reason text; v_free integer; v_now timestamptz; v_offer uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Se requiere READ COMMITTED.' using errcode='0A000'; end if;
 select * into s from public.gym_slots where id=p_slot for update;
 if not found then return; end if;
 select * into cfg from public.app_settings where singleton;
 v_now=clock_timestamp();
 for o in select * from public.waitlist_offers where slot_id=s.id and status='pending' order by created_at,id for update loop
 v_reason=activant_private.booking_denial(o.user_id,s,v_now,cfg.booking_window_hours,cfg.reservations_enabled);
 if o.expires_at<=v_now or (v_reason is not null and v_reason<>'slot_full') then
 update public.waitlist_offers set status=case when o.expires_at<=v_now then 'expired' else 'revoked' end,
 responded_at=clock_timestamp(),reason=case when o.expires_at<=v_now then 'timeout' else 'slot_unavailable' end where id=o.id;
 update public.waitlist set status='expired',updated_at=clock_timestamp() where id=o.waitlist_id and status='waiting';
 insert into public.notifications(user_id,kind,event_key,slot_id,offer_id)
 values(o.user_id,case when o.expires_at<=v_now then 'waitlist_expired' else 'waitlist_unavailable' end,'offer-end:'||o.id,s.id,o.id) on conflict(event_key) do nothing;
 end if;
 end loop;
 v_free=s.capacity-(select count(*)::integer from public.reservations where slot_id=s.id and status='confirmed')-activant_private.held_gym_seats(s.id);
 for w in select q.* from public.waitlist q where q.slot_id=s.id and q.status='waiting'
 and not exists(select 1 from public.waitlist_offers f where f.waitlist_id=q.id)
 order by q.created_at,q.id limit 500 for update loop
 v_now=clock_timestamp();
 v_reason=activant_private.booking_denial(w.user_id,s,v_now,cfg.booking_window_hours,cfg.reservations_enabled);
 if v_reason is not null and v_reason<>'slot_full' then
 update public.waitlist set status='expired',updated_at=v_now where id=w.id;
 insert into public.notifications(user_id,kind,event_key,slot_id) values(w.user_id,'waitlist_unavailable','queue-end:'||w.id,s.id) on conflict(event_key) do nothing;
 elsif v_free>0 then
 insert into public.waitlist_offers(waitlist_id,user_id,slot_id,created_at,expires_at)
 values(w.id,w.user_id,s.id,v_now,least(v_now+make_interval(mins=>cfg.waitlist_offer_minutes),s.starts_at)) returning id into v_offer;
 insert into public.notifications(user_id,kind,event_key,slot_id,offer_id)
 values(w.user_id,'waitlist_offer','offer:'||v_offer,s.id,v_offer) on conflict(event_key) do nothing;
 v_free=v_free-1;
 end if;
 end loop;
 if exists(select 1 from public.waitlist where slot_id=s.id and status='waiting') then
 insert into activant_private.waitlist_jobs(slot_id,run_after)
 values(s.id,case when s.starts_at<=clock_timestamp() or
 (exists(select 1 from public.waitlist q where q.slot_id=s.id and q.status='waiting' and not exists(select 1 from public.waitlist_offers f where f.waitlist_id=q.id))
 and (v_free>0 or s.status<>'open' or not cfg.reservations_enabled)) then clock_timestamp() else
 least(s.starts_at,coalesce((select min(expires_at) from public.waitlist_offers where slot_id=s.id and status='pending'),s.starts_at)) end)
 on conflict(slot_id) do update set run_after=excluded.run_after;
 else delete from activant_private.waitlist_jobs where slot_id=s.id; end if;
 perform activant_private.signal_gym_availability(s.id);
end; $$;

create or replace function public.join_gym_waitlist(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; cfg public.app_settings; v_reason text; v_id uuid; v_user uuid=auth.uid();
begin
 perform activant_private.lock_eligible_user(v_user);
 select * into cfg from public.app_settings where singleton for share;
 select * into s from public.gym_slots where id=p_slot_id for update;
 if not found then raise exception 'La franja no existe.' using errcode='23503'; end if;
 perform activant_private.dispatch_gym_waitlist(s.id);
 v_reason=activant_private.booking_denial(v_user,s,clock_timestamp(),cfg.booking_window_hours,cfg.reservations_enabled);
 if v_reason is not null and v_reason<>'slot_full' then raise exception 'No puedes ingresar a esta lista.' using errcode='23514',detail=v_reason; end if;
 if (select count(*) from public.reservations where slot_id=s.id and status='confirmed')+activant_private.held_gym_seats(s.id)<s.capacity then
 raise exception 'Hay cupos disponibles. Puedes reservar directamente.' using errcode='23514',detail='seats_available'; end if;
 insert into public.waitlist(user_id,slot_id) values(v_user,s.id) returning id into v_id;
 perform activant_private.dispatch_gym_waitlist(s.id);
 return v_id;
end; $$;

create or replace function public.leave_gym_waitlist(p_waitlist_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare w public.waitlist;
begin
 if not activant_private.active_user() then raise exception 'Se requiere una cuenta activa.' using errcode='42501'; end if;
 select * into w from public.waitlist where id=p_waitlist_id and user_id=auth.uid();
 if not found then raise exception 'No puedes modificar esta solicitud.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 perform 1 from public.gym_slots where id=w.slot_id for update;
 select * into w from public.waitlist where id=w.id for update;
 if w.status<>'waiting' then return; end if;
 update public.waitlist_offers set status='declined',reason='left_queue',responded_at=clock_timestamp(),response_by=auth.uid() where waitlist_id=w.id and status='pending';
 update public.waitlist set status='cancelled',updated_at=clock_timestamp() where id=w.id;
 perform activant_private.dispatch_gym_waitlist(w.slot_id);
end; $$;

create function public.respond_gym_waitlist_offer(p_offer_id uuid,p_accept boolean)
returns table(outcome text,reservation_id uuid)
language plpgsql security definer set search_path='' as $$
declare o public.waitlist_offers; cfg public.app_settings; s public.gym_slots; v_reason text; v_res uuid; v_decided timestamptz;
begin
 if not activant_private.active_user() or p_accept is null then raise exception 'Se requiere una cuenta activa.' using errcode='42501'; end if;
 select * into o from public.waitlist_offers where id=p_offer_id and user_id=auth.uid();
 if not found then raise exception 'No puedes responder esta oferta.' using errcode='42501'; end if;
 -- Mismo orden perfil/configuración/franja/reserva que las reservas ordinarias.
 perform 1 from public.profiles where id=auth.uid() for share;
 if p_accept then perform activant_private.lock_eligible_user(auth.uid()); end if;
 select * into cfg from public.app_settings where singleton for share;
 select * into s from public.gym_slots where id=o.slot_id for update;
 perform activant_private.dispatch_gym_waitlist(o.slot_id);
 select * into o from public.waitlist_offers where id=p_offer_id for update;
 if o.status<>'pending' then return query select o.status,o.reservation_id; return; end if;
 v_reason=activant_private.booking_denial(auth.uid(),s,clock_timestamp(),cfg.booking_window_hours,cfg.reservations_enabled);
 v_decided=clock_timestamp();
 if o.expires_at<=v_decided then
 update public.waitlist_offers set status='expired',reason='timeout',responded_at=v_decided where id=o.id;
 update public.waitlist set status='expired',updated_at=v_decided where id=o.waitlist_id;
 insert into public.notifications(user_id,kind,event_key,slot_id,offer_id)
 values(o.user_id,'waitlist_expired','offer-end:'||o.id,s.id,o.id) on conflict(event_key) do nothing;
 perform activant_private.dispatch_gym_waitlist(s.id);
 return query select 'expired'::text,null::uuid; return;
 end if;
 if p_accept and v_reason is not null then
 update public.waitlist_offers set status='revoked',reason='no_longer_eligible',responded_at=clock_timestamp(),response_by=auth.uid() where id=o.id;
 update public.waitlist set status='expired',updated_at=clock_timestamp() where id=o.waitlist_id;
 perform activant_private.dispatch_gym_waitlist(s.id);
 return query select 'revoked'::text,null::uuid; return;
 end if;
 if p_accept then
 v_res=gen_random_uuid();
 -- FK diferida permite vincular el único cupo antes del INSERT validado habitual.
 update public.waitlist_offers set status='accepted',reason='accepted',responded_at=v_decided,response_by=auth.uid(),reservation_id=v_res where id=o.id;
 insert into public.reservations(id,user_id,slot_id) values(v_res,auth.uid(),s.id);
 update public.waitlist set status='promoted',reservation_id=v_res,updated_at=clock_timestamp() where id=o.waitlist_id;
 else
 update public.waitlist_offers set status='declined',reason='declined',responded_at=clock_timestamp(),response_by=auth.uid() where id=o.id;
 update public.waitlist set status='cancelled',updated_at=clock_timestamp() where id=o.waitlist_id;
 end if;
 perform activant_private.dispatch_gym_waitlist(s.id);
 return query select case when p_accept then 'accepted' else 'declined' end,v_res;
end; $$;

create function public.get_my_gym_waitlist()
returns table(id uuid,slot_id uuid,status public.waitlist_status,joined_at timestamptz,queue_position bigint,
 starts_at timestamptz,ends_at timestamptz,offer_id uuid,offer_status text,expires_at timestamptz,reservation_id uuid,observed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not activant_private.active_user() then raise exception 'Se requiere una cuenta activa.' using errcode='42501'; end if;
 return query select w.id,w.slot_id,w.status,w.created_at,
 case when w.status='waiting' then (select count(*) from public.waitlist q where q.slot_id=w.slot_id and q.status='waiting' and (q.created_at,q.id)<=(w.created_at,w.id)) else null end,
 s.starts_at,s.ends_at,o.id,o.status,o.expires_at,w.reservation_id,statement_timestamp()
 from public.waitlist w join public.gym_slots s on s.id=w.slot_id left join public.waitlist_offers o on o.waitlist_id=w.id
 where w.user_id=auth.uid() order by (w.status='waiting') desc,w.created_at desc,w.id limit 100;
end; $$;
create function public.mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not activant_private.active_user() then raise exception 'Se requiere una cuenta activa.' using errcode='42501'; end if;
 update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_notification_id and user_id=auth.uid();
 if not found then raise exception 'La notificación no existe.' using errcode='42501'; end if;
end; $$;
create function public.admin_update_notification_rules(p_offer_minutes integer,p_reminders_enabled boolean,p_reminder_minutes integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_offer_minutes is null or p_reminders_enabled is null or p_reminder_minutes is null then raise exception 'Completa la configuración.' using errcode='22004'; end if;
 update public.app_settings set waitlist_offer_minutes=p_offer_minutes,reservation_reminders_enabled=p_reminders_enabled,
 reservation_reminder_minutes=p_reminder_minutes,updated_at=clock_timestamp(),updated_by=auth.uid() where singleton;
end; $$;

revoke all on all functions in schema activant_private from public,anon,authenticated,service_role;
-- Conserva solo los predicados RLS originales y los específicos del programa.
grant execute on function activant_private.has_role(public.app_role),activant_private.active_user() to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['join_gym_waitlist','leave_gym_waitlist','respond_gym_waitlist_offer','get_my_gym_waitlist','mark_notification_read','admin_update_notification_rules']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
commit;
