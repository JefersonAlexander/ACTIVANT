begin;
create function activant_private.business_suspension_end(p_start timestamptz,p_days integer) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare v_day date=(p_start at time zone 'America/Bogota')::date; v_working boolean; v_count integer=0; i integer;
begin
 -- Días completos posteriores a la decisión. Toda fecha, incluso no hábil, exige
 -- calendario verificado: no se presume la ausencia de festivos institucionales.
 for i in 1..366 loop
 v_day=v_day+1;
 select is_working into v_working from public.working_calendar where day=v_day;
 if not found then return null; end if;
 if v_working then v_count=v_count+1; end if;
 if v_count>=p_days then return (v_day+1)::timestamp at time zone 'America/Bogota'; end if;
 end loop;
 return null;
end; $$;
create function activant_private.reconcile_absence_sanctions(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.absence_cases; cfg public.point_program_rules; old_s public.absence_sanctions; n integer; days integer;
 v_kind text; v_from timestamptz; v_end timestamptz; v_now timestamptz; v_restriction uuid;
begin
 -- Bloqueo exclusivo compatible con las guardas de reserva/habilitación.
 perform 1 from public.profiles where id=p_user for update;
 for old_s in select s.* from public.absence_sanctions s join public.absence_cases a on a.id=s.case_id where s.user_id=p_user and s.revoked_at is null and a.status<>'unjustified' loop
 update public.absence_sanctions set revoked_at=clock_timestamp() where id=old_s.id;
 if old_s.restriction_id is not null then update public.gym_access_restrictions set revoked_at=clock_timestamp() where id=old_s.restriction_id and revoked_at is null; end if;
 end loop;
 for c in select * from public.absence_cases where user_id=p_user and status='unjustified' order by occurred_at,id loop
 select * into cfg from public.point_program_rules where id=c.rules_id;
 v_from=case when cfg.absence_period='calendar_month' then activant_private.point_month(c.occurred_at)::timestamp at time zone 'America/Bogota'
 else (((c.occurred_at at time zone 'America/Bogota')::date-(cfg.absence_window_days-1))::timestamp at time zone 'America/Bogota') end;
 select count(*)::integer into n from public.absence_cases a where a.user_id=p_user and a.status='unjustified' and a.occurred_at>=v_from and (a.occurred_at,a.id)<=(c.occurred_at,c.id);
 days=case n when 2 then cfg.second_absence_days when 3 then cfg.third_absence_days else 0 end;
 v_kind=case when not cfg.absences_enabled then 'administrative_review' when n=1 then 'warning' when n in (2,3) then 'suspension' else 'administrative_review' end;
 v_now=clock_timestamp(); v_end=null;
 if v_kind='suspension' then
 v_end=activant_private.business_suspension_end(v_now,days);
 if v_end is null then v_kind='pending_calendar'; end if;
 end if;
 select * into old_s from public.absence_sanctions where case_id=c.id and revoked_at is null for update;
 if old_s.id is not null and old_s.ordinal=n and old_s.kind=v_kind and old_s.business_days=days then continue; end if;
 if old_s.id is not null then
 update public.absence_sanctions set revoked_at=v_now where id=old_s.id;
 if old_s.restriction_id is not null then update public.gym_access_restrictions set revoked_at=clock_timestamp() where id=old_s.restriction_id and revoked_at is null; end if;
 end if;
 v_restriction=null;
 if v_kind='suspension' then
 insert into public.gym_access_restrictions(user_id,kind,starts_at,ends_at,created_by) values(p_user,'suspension',v_now,v_end,auth.uid()) returning id into v_restriction;
 end if;
 insert into public.absence_sanctions(case_id,user_id,ordinal,kind,business_days,restriction_id,created_by)
 values(c.id,p_user,n,v_kind,days,v_restriction,auth.uid());
 end loop;
end; $$;
create function public.staff_close_gym_slot(p_slot_id uuid,p_evidence_confirmed boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare s public.gym_slots; r public.reservations; cfg public.point_program_rules; v_count integer=0; v_rows integer;
begin
 perform activant_private.require_staff();
 if p_evidence_confirmed is distinct from true then raise exception 'Debes conciliar los registros e incidencias.' using errcode='23514',detail='evidence_required'; end if;
 perform p.id from public.profiles p where p.id in (select user_id from public.reservations where slot_id=p_slot_id and status='confirmed') order by p.id for share;
 select * into s from public.gym_slots where id=p_slot_id for update;
 if s.id is null or s.status='cancelled' then raise exception 'La franja no admite cierre.' using errcode='23514',detail='invalid_closeout'; end if;
 select * into cfg from public.point_program_rules where effective_month<=activant_private.point_month(s.starts_at) order by effective_month desc limit 1;
 if cfg.id is null or clock_timestamp()<s.ends_at+make_interval(mins=>cfg.closeout_delay_minutes) then raise exception 'Espera al cierre completo de la franja.' using errcode='23514',detail='closeout_too_early'; end if;
 insert into public.gym_slot_closeouts(slot_id,evidence,closed_by) values(s.id,'attendance_reconciled',auth.uid()) on conflict do nothing;
 for r in select * from public.reservations where slot_id=s.id and status='confirmed' order by user_id,id loop
 if exists(select 1 from public.attendance a where a.reservation_id=r.id and not exists(select 1 from public.attendance_invalidations i where i.reservation_id=a.reservation_id)) then continue; end if;
 cfg=activant_private.ensure_point_period(r.user_id,s.starts_at);
 if cfg.id is null or not cfg.absences_enabled or s.starts_at<cfg.created_at then continue; end if;
 insert into public.absence_cases(reservation_id,user_id,slot_id,occurred_at,rules_id) values(r.id,r.user_id,s.id,s.starts_at,cfg.id) on conflict(reservation_id) do nothing;
 get diagnostics v_rows=row_count; v_count=v_count+v_rows;
 end loop;
 return v_count;
end; $$;
create function public.submit_absence_justification(p_case_id uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.absence_cases; v_rows integer;
begin
 if not activant_private.active_user() then raise exception 'Se requiere perfil activo.' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('unforeseen_event','reservation_dispute','access_problem') then raise exception 'Selecciona un motivo.' using errcode='22023',detail='invalid_reason'; end if;
 perform 1 from public.profiles where id=auth.uid() for share;
 select * into c from public.absence_cases where id=p_case_id and user_id=auth.uid() for update;
 if not found then raise exception 'El caso no está disponible.' using errcode='42501'; end if;
 if c.status='justified' then return; end if;
 insert into public.absence_justifications(case_id,user_id,reason) values(c.id,auth.uid(),p_reason) on conflict do nothing;
 get diagnostics v_rows=row_count;
 if v_rows=1 then update public.absence_cases set review_requested_at=clock_timestamp() where id=c.id; end if;
 -- La solicitud por sí sola no revoca una decisión: exige revisión autorizada.
end; $$;
create function public.admin_review_absence(p_case_id uuid,p_status text,p_reason text,p_evidence_confirmed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare c public.absence_cases; r public.reservations; s public.gym_slots;
begin
 perform activant_private.require_admin();
 select * into c from public.absence_cases where id=p_case_id;
 if c.id is null or c.user_id=auth.uid() then raise exception 'No puedes revisar este caso.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=c.user_id for update;
 perform 1 from public.gym_slots where id=c.slot_id for update;
 perform 1 from public.reservations where id=c.reservation_id for update;
 select * into c from public.absence_cases where id=p_case_id for update;
 if p_status is null or p_reason is null or p_status not in ('justified','unjustified')
 or (p_status='unjustified' and (p_reason<>'evidence_confirmed' or p_evidence_confirmed is distinct from true))
 or (p_status='justified' and p_reason not in ('justification_accepted','insufficient_evidence')) then
 raise exception 'La decisión requiere motivo y evidencia suficiente.' using errcode='23514',detail='evidence_required'; end if;
 if p_status='unjustified' then
 select * into r from public.reservations where id=c.reservation_id;
 select * into s from public.gym_slots where id=c.slot_id;
 if r.status<>'confirmed' or s.status='cancelled' or s.ends_at>clock_timestamp()
 or not exists(select 1 from public.gym_slot_closeouts where slot_id=c.slot_id and evidence='attendance_reconciled')
 or exists(select 1 from public.attendance a where a.reservation_id=r.id and not exists(select 1 from public.attendance_invalidations i where i.reservation_id=a.reservation_id)) then
 raise exception 'La evidencia no permite confirmar inasistencia.' using errcode='23514',detail='insufficient_evidence'; end if;
 elsif p_reason='justification_accepted' and not exists(select 1 from public.absence_justifications where case_id=c.id) then
 raise exception 'No se ha presentado justificación.' using errcode='23514',detail='no_justification';
 end if;
 if c.status is distinct from p_status or c.decision_reason is distinct from p_reason or c.review_requested_at is not null then
 update public.absence_cases set status=p_status,decision_reason=p_reason,review_requested_at=null,reviewed_at=clock_timestamp(),reviewed_by=auth.uid() where id=c.id;
 end if;
 perform activant_private.reconcile_absence_sanctions(c.user_id);
end; $$;
create function public.admin_set_working_calendar(p_start date,p_end date,p_non_working date[],p_verified boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_day date; today date=(clock_timestamp() at time zone 'America/Bogota')::date;
begin
 perform activant_private.require_admin();
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>92 or p_start<=today or p_verified is distinct from true
 or p_non_working is null or cardinality(p_non_working)>93 or array_position(p_non_working,null) is not null
 or exists(select 1 from unnest(p_non_working) d where d<p_start or d>p_end) then
 raise exception 'Revisa las fechas y verifica el calendario institucional.' using errcode='22023',detail='invalid_calendar'; end if;
 v_day=p_start;
 while v_day<=p_end loop
 insert into public.working_calendar(day,is_working,verified_by)
 values(v_day,extract(isodow from v_day)<6 and not(v_day=any(p_non_working)),auth.uid())
 on conflict(day) do update set is_working=excluded.is_working,verified_by=excluded.verified_by,verified_at=clock_timestamp();
 v_day=v_day+1;
 end loop;
end; $$;
-- La cancelación administrativa y la revisión deben usar el mismo orden de bloqueo.
create or replace function public.cancel_gym_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.gym_slots; v_admin boolean;
begin
 select * into r from public.reservations where id=p_reservation_id;
 v_admin=activant_private.has_role('admin');
 if r.id is null or auth.uid() is null or (r.user_id<>auth.uid() and not v_admin) then raise exception 'No puedes modificar esta reserva.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=r.user_id for share;
 select * into s from public.gym_slots where id=r.slot_id for update;
 select * into r from public.reservations where id=p_reservation_id for update;
 if r.status='cancelled' then return; end if;
 if not v_admin and s.starts_at<=clock_timestamp() then raise exception 'La franja ya comenzó.' using errcode='23514',detail='slot_started'; end if;
 update public.reservations set status='cancelled',cancelled_at=clock_timestamp() where id=r.id;
 update public.qr_challenges set revoked_at=clock_timestamp() where reservation_id=r.id and consumed_at is null and revoked_at is null;
end; $$;
create function activant_private.guard_absence_cancellation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='confirmed' and new.status='cancelled' and exists(select 1 from public.absence_cases where reservation_id=old.id and status<>'justified') then
 raise exception 'Primero debes revisar el caso de inasistencia de esta reserva.' using errcode='23514',detail='case_review_required'; end if;
 return new;
end; $$;
create trigger guard_absence_cancellation before update on public.reservations for each row execute function activant_private.guard_absence_cancellation();
revoke all on function activant_private.guard_absence_cancellation() from public,anon,authenticated,service_role;
create function activant_private.guard_sanction_restriction() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.revoked_at is null and new.revoked_at is not null and exists(select 1 from public.absence_sanctions where restriction_id=old.id and revoked_at is null) then
 raise exception 'La restricción se revisa mediante su caso de inasistencia.' using errcode='23514',detail='review_case_required'; end if;
 return new;
end; $$;
create trigger guard_sanction_restriction before update on public.gym_access_restrictions for each row execute function activant_private.guard_sanction_restriction();
revoke all on function activant_private.business_suspension_end(timestamptz,integer),activant_private.reconcile_absence_sanctions(uuid),activant_private.guard_sanction_restriction() from public,anon,authenticated,service_role;
revoke all on function public.staff_close_gym_slot(uuid,boolean),public.submit_absence_justification(uuid,text),public.admin_review_absence(uuid,text,text,boolean),public.admin_set_working_calendar(date,date,date[],boolean) from public,anon,authenticated,service_role;
grant execute on function public.staff_close_gym_slot(uuid,boolean),public.submit_absence_justification(uuid,text),public.admin_review_absence(uuid,text,text,boolean),public.admin_set_working_calendar(date,date,date[],boolean) to authenticated;
commit;
