begin;
create function activant_private.point_month(p_time timestamptz) returns date
language sql immutable set search_path='' as $$ select date_trunc('month',p_time at time zone 'America/Bogota')::date; $$;
create function activant_private.ensure_point_period(p_user uuid,p_time timestamptz) returns public.point_program_rules
language plpgsql security definer set search_path='' as $$
declare v_month date=activant_private.point_month(p_time); v_rules public.point_program_rules;
begin
 perform 1 from public.profiles where id=p_user for share;
 select r.* into v_rules from public.point_periods p join public.point_program_rules r on r.id=p.rules_id where p.user_id=p_user and p.month_start=v_month;
 if not found then
 select * into v_rules from public.point_program_rules where effective_month<=v_month order by effective_month desc limit 1;
 if not found then return null; end if;
 insert into public.point_periods(user_id,month_start,rules_id) values(p_user,v_month,v_rules.id) on conflict do nothing;
 end if;
 -- Snapshot de reglas inmutable por usuario/mes, serialización común a todos sus eventos.
 select r.* into v_rules from public.point_periods p join public.point_program_rules r on r.id=p.rules_id where p.user_id=p_user and p.month_start=v_month for update of p;
 return v_rules;
end; $$;
create function activant_private.reconcile_monthly_bonus(p_user uuid,p_month date) returns void
language plpgsql security definer set search_path='' as $$
declare cfg public.point_program_rules; v_count integer; v_current bigint; v_target integer; v_revision integer;
begin
 select r.* into cfg from public.point_periods p join public.point_program_rules r on r.id=p.rules_id where p.user_id=p_user and p.month_start=p_month for update of p;
 if not found then return; end if;
 select count(*) into v_count from public.point_transactions t where t.user_id=p_user and t.month_start=p_month and t.kind='attendance'
 and not exists(select 1 from public.attendance_invalidations where reservation_id=t.attendance_id);
 v_target=case when not cfg.points_enabled then 0 when v_count>=cfg.second_bonus_count then cfg.second_bonus_points when v_count>=cfg.first_bonus_count then cfg.first_bonus_points else 0 end;
 select coalesce(sum(amount),0) into v_current from public.point_transactions where user_id=p_user and month_start=p_month and kind='monthly_bonus';
 if v_target=v_current then return; end if;
 update public.point_periods set bonus_revision=bonus_revision+1 where user_id=p_user and month_start=p_month returning bonus_revision into v_revision;
 insert into public.point_transactions(user_id,month_start,kind,amount,event_key,reason,created_by)
 values(p_user,p_month,'monthly_bonus',(v_target-v_current)::integer,'bonus:'||p_user||':'||p_month||':'||v_revision,'monthly_bonus_change',auth.uid());
end; $$;
create function activant_private.award_attendance_points() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; cfg public.point_program_rules; v_month date=activant_private.point_month(new.checked_in_at);
begin
 select user_id into v_user from public.reservations where id=new.reservation_id;
 cfg=activant_private.ensure_point_period(v_user,new.checked_in_at);
 if cfg.id is null or not cfg.points_enabled or new.checked_in_at<cfg.created_at then return new; end if;
 insert into public.point_transactions(user_id,month_start,kind,amount,event_key,reservation_id,attendance_id,reason,created_by)
 values(v_user,v_month,'attendance',cfg.attendance_points,'attendance:'||new.reservation_id,new.reservation_id,new.reservation_id,'validated_attendance',auth.uid()) on conflict(event_key) do nothing;
 perform activant_private.reconcile_monthly_bonus(v_user,v_month);
 return new;
end; $$;
create trigger award_points after insert on public.attendance for each row execute function activant_private.award_attendance_points();
create function activant_private.award_cancellation_points() returns trigger
language plpgsql security definer set search_path='' as $$
declare cfg public.point_program_rules; v_start timestamptz; v_month date;
begin
 if old.status<>'confirmed' or new.status<>'cancelled' or auth.uid() is distinct from new.user_id then return new; end if;
 cfg=activant_private.ensure_point_period(new.user_id,new.cancelled_at);
 if cfg.id is null or not cfg.points_enabled or new.cancelled_at<cfg.created_at then return new; end if;
 select starts_at into v_start from public.gym_slots where id=new.slot_id;
 if new.cancelled_at>v_start-make_interval(mins=>cfg.cancellation_notice_minutes) then return new; end if;
 v_month=activant_private.point_month(new.cancelled_at);
 if (select count(*) from public.point_transactions where user_id=new.user_id and month_start=v_month and kind='cancellation')>=cfg.cancellation_limit then return new; end if;
 insert into public.point_transactions(user_id,month_start,kind,amount,event_key,reservation_id,reason,created_by)
 values(new.user_id,v_month,'cancellation',cfg.cancellation_points,'cancellation:'||new.id,new.id,'timely_cancellation',auth.uid()) on conflict(event_key) do nothing;
 return new;
end; $$;
create trigger award_cancellation_points after update on public.reservations for each row execute function activant_private.award_cancellation_points();

create function public.admin_invalidate_attendance(p_reservation_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations; a public.attendance; cfg public.point_program_rules; t public.point_transactions;
begin
 perform activant_private.require_admin();
 if p_reason is null or p_reason not in ('duplicate_evidence','incorrect_entry','verified_absence') then raise exception 'Selecciona un motivo válido.' using errcode='22023',detail='invalid_reason'; end if;
 select * into r from public.reservations where id=p_reservation_id;
 if r.id is null or r.user_id=auth.uid() then raise exception 'No puedes modificar esta asistencia.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=r.user_id for share;
 perform 1 from public.gym_slots where id=r.slot_id for update;
 perform 1 from public.reservations where id=r.id for update;
 select * into a from public.attendance where reservation_id=r.id;
 if not found then raise exception 'No existe asistencia validada.' using errcode='23514',detail='no_attendance'; end if;
 cfg=activant_private.ensure_point_period(r.user_id,a.checked_in_at);
 if exists(select 1 from public.attendance_invalidations where reservation_id=r.id) then return; end if;
 insert into public.attendance_invalidations(reservation_id,user_id,reason,invalidated_by) values(r.id,r.user_id,p_reason,auth.uid());
 select * into t from public.point_transactions where event_key='attendance:'||r.id;
 if found then
 insert into public.point_transactions(user_id,month_start,kind,amount,event_key,reservation_id,reverses_id,reason,created_by)
 values(r.user_id,t.month_start,'reversal',-t.amount,'attendance-reversal:'||r.id,r.id,t.id,'attendance_invalidated',auth.uid()) on conflict(event_key) do nothing;
 perform activant_private.reconcile_monthly_bonus(r.user_id,t.month_start);
 end if;
end; $$;
create function public.admin_adjust_points(p_user_id uuid,p_amount integer,p_reason text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare cfg public.point_program_rules; v_time timestamptz=clock_timestamp(); existing public.point_transactions; v_id uuid;
begin
 perform activant_private.require_admin();
 if p_user_id is null or p_user_id=auth.uid() or p_amount is null or p_amount=0 or abs(p_amount::bigint)>1000000 or p_request_id is null or p_reason is null or p_reason not in ('correction','appeal') then
 raise exception 'Revisa el destinatario, movimiento y motivo.' using errcode='22023',detail='invalid_adjustment'; end if;
 cfg=activant_private.ensure_point_period(p_user_id,v_time);
 if cfg.id is null then raise exception 'No hay reglas vigentes.' using errcode='23514'; end if;
 select * into existing from public.point_transactions where event_key='adjustment:'||p_request_id;
 if found then
 if existing.user_id<>p_user_id or existing.amount<>p_amount or existing.reason<>p_reason then raise exception 'La solicitud ya fue usada con otros valores.' using errcode='23514',detail='idempotency_conflict'; end if;
 return existing.id;
 end if;
 insert into public.point_transactions(user_id,month_start,kind,amount,event_key,reason,created_by)
 values(p_user_id,activant_private.point_month(v_time),'adjustment',p_amount,'adjustment:'||p_request_id,p_reason,auth.uid()) returning id into v_id;
 return v_id;
end; $$;
create function public.admin_create_point_rules(p_effective_month date,p_rules jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform activant_private.require_admin();
 if p_effective_month is null or p_effective_month<(date_trunc('month',clock_timestamp() at time zone 'America/Bogota')+interval '1 month')::date
 or extract(day from p_effective_month)<>1 or p_rules is null or jsonb_typeof(p_rules)<>'object' then raise exception 'Las reglas nuevas deben comenzar un mes futuro.' using errcode='22023',detail='future_rules_required'; end if;
 if exists(select 1 from jsonb_object_keys(p_rules) k where k<>all(array['points_enabled','attendance_points','cancellation_points','cancellation_limit','cancellation_notice_minutes','first_bonus_count','first_bonus_points','second_bonus_count','second_bonus_points','absences_enabled','absence_period','absence_window_days','second_absence_days','third_absence_days','closeout_delay_minutes'])) then raise exception 'Configuración no válida.' using errcode='22023'; end if;
 insert into public.point_program_rules(effective_month,points_enabled,attendance_points,cancellation_points,cancellation_limit,cancellation_notice_minutes,first_bonus_count,first_bonus_points,second_bonus_count,second_bonus_points,absences_enabled,absence_period,absence_window_days,second_absence_days,third_absence_days,closeout_delay_minutes,created_by)
 values(p_effective_month,(p_rules->>'points_enabled')::boolean,(p_rules->>'attendance_points')::integer,(p_rules->>'cancellation_points')::integer,(p_rules->>'cancellation_limit')::integer,(p_rules->>'cancellation_notice_minutes')::integer,(p_rules->>'first_bonus_count')::integer,(p_rules->>'first_bonus_points')::integer,(p_rules->>'second_bonus_count')::integer,(p_rules->>'second_bonus_points')::integer,(p_rules->>'absences_enabled')::boolean,(p_rules->>'absence_period'),(p_rules->>'absence_window_days')::integer,(p_rules->>'second_absence_days')::integer,(p_rules->>'third_absence_days')::integer,(p_rules->>'closeout_delay_minutes')::integer,auth.uid()) returning id into v_id;
 return v_id;
end; $$;

create function public.get_my_point_summary() returns table(balance bigint,month_start date,monthly_attendances integer,qualifying_attendances integer,monthly_bonus integer,attendance_points integer,cancellation_points integer,cancellation_limit integer,cancellation_notice_minutes integer,first_bonus_count integer,first_bonus_points integer,second_bonus_count integer,second_bonus_points integer,points_enabled boolean)
language plpgsql stable security definer set search_path='' as $$
declare cfg public.point_program_rules; v_month date=activant_private.point_month(statement_timestamp()); v_user uuid=auth.uid();
begin
 if not activant_private.active_user() then raise exception 'Se requiere perfil activo.' using errcode='42501'; end if;
 select r.* into cfg from public.point_periods p join public.point_program_rules r on r.id=p.rules_id where p.user_id=v_user and p.month_start=v_month;
 if not found then select * into cfg from public.point_program_rules where effective_month<=v_month order by effective_month desc limit 1; end if;
 return query select (select coalesce(sum(t.amount),0) from public.point_transactions t where t.user_id=v_user),v_month,
 (select count(*)::integer from public.attendance a join public.reservations r on r.id=a.reservation_id where r.user_id=v_user and a.checked_in_at>=(v_month::timestamp at time zone 'America/Bogota') and a.checked_in_at<((v_month+interval '1 month') at time zone 'America/Bogota') and not exists(select 1 from public.attendance_invalidations i where i.reservation_id=a.reservation_id)),
 (select count(*)::integer from public.point_transactions t where t.user_id=v_user and t.month_start=v_month and t.kind='attendance' and not exists(select 1 from public.attendance_invalidations where reservation_id=t.attendance_id)),
 (select coalesce(sum(t.amount),0)::integer from public.point_transactions t where t.user_id=v_user and t.month_start=v_month and t.kind='monthly_bonus'),
 cfg.attendance_points,cfg.cancellation_points,cfg.cancellation_limit,cfg.cancellation_notice_minutes,cfg.first_bonus_count,cfg.first_bonus_points,cfg.second_bonus_count,cfg.second_bonus_points,cfg.points_enabled;
end; $$;

-- Claves de auditoría también para tablas sin columna id.
create or replace function activant_private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_old jsonb; v_new jsonb; v_row jsonb; v_key jsonb;
begin
 if tg_op<>'INSERT' then v_old=to_jsonb(old)-'token_hash'; end if;
 if tg_op<>'DELETE' then v_new=to_jsonb(new)-'token_hash'; end if;
 v_row=coalesce(v_new,v_old);
 v_key=case tg_table_name
 when 'user_roles' then jsonb_build_object('user_id',v_row->'user_id','role',v_row->'role')
 when 'gym_eligibility' then jsonb_build_object('user_id',v_row->'user_id')
 when 'attendance' then jsonb_build_object('reservation_id',v_row->'reservation_id')
 when 'attendance_invalidations' then jsonb_build_object('reservation_id',v_row->'reservation_id')
 when 'gym_slot_closeouts' then jsonb_build_object('slot_id',v_row->'slot_id')
 when 'absence_justifications' then jsonb_build_object('case_id',v_row->'case_id')
 when 'working_calendar' then jsonb_build_object('day',v_row->'day')
 when 'point_periods' then jsonb_build_object('user_id',v_row->'user_id','month_start',v_row->'month_start')
 when 'app_settings' then jsonb_build_object('singleton',v_row->'singleton')
 when 'affiliation_types' then jsonb_build_object('code',v_row->'code')
 else jsonb_build_object('id',v_row->'id') end;
 insert into public.audit_logs(actor_id,database_actor,operation,entity_table,entity_key,old_values,new_values)
 values(auth.uid(),session_user,tg_op,tg_table_name,v_key,v_old,v_new);
 return null;
end; $$;
revoke all on function activant_private.point_month(timestamptz),activant_private.ensure_point_period(uuid,timestamptz),activant_private.reconcile_monthly_bonus(uuid,date),activant_private.award_attendance_points(),activant_private.award_cancellation_points() from public,anon,authenticated,service_role;
revoke all on function public.admin_invalidate_attendance(uuid,text),public.admin_adjust_points(uuid,integer,text,uuid),public.admin_create_point_rules(date,jsonb),public.get_my_point_summary() from public,anon,authenticated,service_role;
grant execute on function public.admin_invalidate_attendance(uuid,text),public.admin_adjust_points(uuid,integer,text,uuid),public.admin_create_point_rules(date,jsonb),public.get_my_point_summary() to authenticated;
commit;
