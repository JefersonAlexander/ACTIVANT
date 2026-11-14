begin;
create function public.admin_list_activant_users(p_search text default '',p_page integer default 1)
returns table(id uuid,email text,is_active boolean,affiliation_type text,roles public.app_role[],is_eligible boolean,
 valid_from timestamptz,valid_until timestamptz,total_matches bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 perform activant_private.require_admin();
 if p_page is null or p_page not between 1 and 10000 or length(coalesce(p_search,''))>120 then raise exception 'Filtro de usuarios inválido.' using errcode='22023'; end if;
 return query select p.id,u.email::text,p.is_active,p.affiliation_type,
 array(select r.role from public.user_roles r where r.user_id=p.id order by r.role),e.is_eligible,e.valid_from,e.valid_until,count(*) over()
 from public.profiles p join auth.users u on u.id=p.id left join public.gym_eligibility e on e.user_id=p.id
 where coalesce(p_search,'')='' or position(lower(p_search) in lower(coalesce(u.email,'')))>0 or p.id::text=lower(p_search)
 order by p.created_at desc,p.id limit 20 offset (p_page-1)*20;
end; $$;

create function activant_private.check_report_range(p_start date,p_end date) returns void
language plpgsql immutable set search_path='' as $$
begin
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
 or p_end<p_start or p_end-p_start>92 then raise exception 'Selecciona entre 1 y 93 días.' using errcode='22023'; end if;
end; $$;
create function public.admin_get_gym_report(p_start date,p_end date,p_slot_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_now timestamptz=statement_timestamp();
begin
 perform activant_private.require_admin();
 perform activant_private.check_report_range(p_start,p_end);
 with scoped as materialized (
 select s.*,(s.starts_at at time zone 'America/Bogota')::date report_day from public.gym_slots s
 where s.starts_at>=p_start::timestamp at time zone 'America/Bogota'
 and s.starts_at<(p_end+1)::timestamp at time zone 'America/Bogota' and (p_slot_id is null or s.id=p_slot_id)
 ), effective as materialized (
 select r.id,r.user_id,r.slot_id,s.report_day from scoped s join public.reservations r on r.slot_id=s.id
 join public.attendance a on a.reservation_id=r.id left join public.attendance_invalidations i on i.reservation_id=r.id
 where i.reservation_id is null
 ), facts as materialized (
 select s.id,s.starts_at,s.ends_at,s.report_day,s.status,s.capacity,
 r.confirmed,r.cancelled,a.effective_attendances,c.absences,c.pending_reviews,d.demand,
 activant_private.held_gym_seats(s.id) held,
 round(100.0*r.confirmed/s.capacity,2) occupancy_percent,
 case when s.ends_at<=v_now and s.status<>'cancelled' then round(100.0*a.effective_attendances/s.capacity,2) else null end utilization_percent
 from scoped s
 cross join lateral(select count(*) filter(where status='confirmed')::integer confirmed,count(*) filter(where status='cancelled')::integer cancelled from public.reservations where slot_id=s.id) r
 cross join lateral(select count(*)::integer effective_attendances from effective where slot_id=s.id) a
 cross join lateral(select count(*) filter(where status='unjustified')::integer absences,
 count(*) filter(where status='pending_review' or review_requested_at is not null)::integer pending_reviews from public.absence_cases where slot_id=s.id) c
 cross join lateral(select count(*)::integer demand from (select user_id from public.reservations where slot_id=s.id union select user_id from public.waitlist where slot_id=s.id) users) d
 ), hourly as (
 select to_char(starts_at at time zone 'America/Bogota','HH24:MI') start_time,count(*) slots,sum(demand) demand,sum(effective_attendances) attendances
 from facts group by to_char(starts_at at time zone 'America/Bogota','HH24:MI')
 ), daily as (
 select f.report_day,sum(f.effective_attendances) attendances,sum(f.cancelled) cancellations,
 (select count(distinct e.user_id) from effective e where e.report_day=f.report_day) participants from facts f group by f.report_day
 )
 select jsonb_build_object(
 'observed_at',v_now,'total_slots',(select count(*) from facts),
 'summary',(select jsonb_build_object('reservations',coalesce(sum(confirmed),0),'cancellations',coalesce(sum(cancelled),0),
 'attendances',coalesce(sum(effective_attendances),0),'absences',coalesce(sum(absences),0),'pending_reviews',coalesce(sum(pending_reviews),0),
 'demand',coalesce(sum(demand),0),'capacity',coalesce(sum(capacity) filter(where status<>'cancelled'),0),
 'utilization_percent',round(100.0*coalesce(sum(effective_attendances) filter(where ends_at<=v_now and status<>'cancelled'),0)/nullif(sum(capacity) filter(where ends_at<=v_now and status<>'cancelled'),0),2),
 'participants',(select count(distinct user_id) from effective),
 'recurrent_users',(select count(*) from(select user_id from effective group by user_id having count(*)>=2) recurrent)) from facts),
 'slots',coalesce((select jsonb_agg(to_jsonb(t) order by t.starts_at,t.id) from(select * from facts order by starts_at,id limit 2000) t),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(to_jsonb(daily) order by report_day) from daily),'[]'::jsonb),
 'hourly',coalesce((select jsonb_agg(to_jsonb(hourly) order by start_time) from hourly),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;

create function public.admin_read_audit(p_start date,p_end date,p_slot_id uuid default null,p_page integer default 1,p_limit integer default 30)
returns table(id bigint,occurred_at timestamptz,actor_id uuid,database_actor text,operation text,entity_table text,entity_key jsonb,total_matches bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 perform activant_private.require_admin();perform activant_private.check_report_range(p_start,p_end);
 if p_page is null or p_page not between 1 and 10000 or p_limit is null or p_limit not between 1 and 5000 then raise exception 'Paginación inválida.' using errcode='22023'; end if;
 return query select a.id,a.occurred_at,a.actor_id,a.database_actor,a.operation,a.entity_table,a.entity_key,count(*) over()
 from public.audit_logs a where a.occurred_at>=p_start::timestamp at time zone 'America/Bogota'
 and a.occurred_at<(p_end+1)::timestamp at time zone 'America/Bogota'
 and (p_slot_id is null or (a.entity_table='gym_slots' and a.entity_key->>'id'=p_slot_id::text)
 or coalesce(a.new_values->>'slot_id',a.old_values->>'slot_id')=p_slot_id::text
 or exists(select 1 from public.reservations r where r.slot_id=p_slot_id and r.id::text=coalesce(a.new_values->>'reservation_id',a.old_values->>'reservation_id')))
 order by a.occurred_at desc,a.id desc limit p_limit offset (p_page-1)*p_limit;
end; $$;

create function public.admin_record_export(p_kind text,p_start date,p_end date,p_slot_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform activant_private.require_admin();perform activant_private.check_report_range(p_start,p_end);
 if p_kind not in ('franjas','participacion','auditoria') or p_kind is null then raise exception 'Exportación inválida.' using errcode='22023'; end if;
 insert into public.audit_logs(actor_id,database_actor,operation,entity_table,entity_key,new_values)
 values(auth.uid(),session_user,'INSERT','administrative_exports',jsonb_build_object('id',gen_random_uuid()),
 jsonb_build_object('kind',p_kind,'start',p_start,'end',p_end,'slot_id',p_slot_id));
end; $$;

-- Solicitud de invitación: protege reintentos/carreras y audita el uso de Auth Admin.
create table public.admin_invitation_requests (
 id uuid primary key,
 email text not null check(length(email) between 3 and 254 and email=lower(btrim(email))),
 status text not null default 'pending' check(status in ('pending','sent','uncertain','failed')),
 user_id uuid references public.profiles(id) on delete restrict,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 check((status='pending')=(completed_at is null))
);
create index admin_invitation_actor_time on public.admin_invitation_requests(created_by,created_at desc);
create index admin_invitation_email_time on public.admin_invitation_requests(email,created_at desc);
create index admin_invitation_user on public.admin_invitation_requests(user_id);
alter table public.admin_invitation_requests enable row level security;
revoke all on public.admin_invitation_requests from public,anon,authenticated,service_role;
grant select on public.admin_invitation_requests to authenticated;
create policy read_admin_invitations on public.admin_invitation_requests for select to authenticated using(activant_private.has_role('admin'));
create trigger z_audit_change after insert or update or delete on public.admin_invitation_requests for each row execute function activant_private.audit_change();
create function public.admin_begin_invitation(p_request_id uuid,p_email text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.admin_invitation_requests; v_email text=lower(btrim(p_email));
begin
 perform activant_private.require_admin();
 perform pg_advisory_xact_lock(71421,hashtext(v_email));
 select * into r from public.admin_invitation_requests where id=p_request_id;
 if found then
 if r.email<>v_email or r.created_by<>auth.uid() then raise exception 'La solicitud no corresponde al actor.' using errcode='42501'; end if;
 return false;
 end if;
 perform pg_advisory_xact_lock(71422,hashtext(auth.uid()::text));
 if exists(select 1 from public.admin_invitation_requests where email=v_email and (status in ('pending','uncertain') or created_at>clock_timestamp()-interval '10 minutes'))
 or (select count(*) from public.admin_invitation_requests where created_by=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=20 then
 raise exception 'Revisa las invitaciones recientes antes de reintentar.' using errcode='23514',detail='invitation_limit'; end if;
 insert into public.admin_invitation_requests(id,email,created_by) values(p_request_id,v_email,auth.uid());return true;
end; $$;
create function public.admin_finish_invitation(p_request_id uuid,p_status text,p_user_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.admin_invitation_requests;
begin
 perform activant_private.require_admin();
 select * into r from public.admin_invitation_requests where id=p_request_id and created_by=auth.uid() for update;
 if not found then raise exception 'La solicitud no corresponde al actor.' using errcode='42501'; end if;
 if r.status<>'pending' then return; end if;
 if p_status not in ('sent','uncertain','failed') or p_status is null then raise exception 'Estado inválido.' using errcode='22023'; end if;
 if p_status='sent' and not exists(select 1 from auth.users where id=p_user_id and lower(email)=r.email) then
 raise exception 'La identidad no coincide con la invitación.' using errcode='23514'; end if;
 update public.admin_invitation_requests set status=p_status,user_id=case when p_status='sent' then p_user_id end,completed_at=clock_timestamp() where id=r.id;
end; $$;

revoke all on function activant_private.check_report_range(date,date) from public,anon,authenticated,service_role;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['admin_list_activant_users','admin_get_gym_report','admin_read_audit','admin_record_export','admin_begin_invitation','admin_finish_invitation']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
commit;
