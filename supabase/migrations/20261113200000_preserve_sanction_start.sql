-- Corrección aditiva: sin reescribir decisiones ni datos existentes.
begin;
create or replace function activant_private.reconcile_absence_sanctions(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.absence_cases; cfg public.point_program_rules; old_s public.absence_sanctions; n integer; days integer;
 v_kind text; v_start timestamptz; v_from timestamptz; v_end timestamptz; v_now timestamptz; v_restriction uuid;
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
 -- Una decisión ya aplicada no depende de que exista calendario para HOY.
 select * into old_s from public.absence_sanctions where case_id=c.id and revoked_at is null for update;
 if old_s.id is not null and old_s.ordinal=n and old_s.kind=v_kind and old_s.business_days=days then continue; end if;
 v_now=clock_timestamp(); v_end=null;
 -- Una corrección conserva el primer inicio efectivo de suspensión de este caso.
 -- Así una justificación posterior no vuelve a iniciar una sanción cumplida.
 select min(r.starts_at) into v_start from public.absence_sanctions a
 join public.gym_access_restrictions r on r.id=a.restriction_id where a.case_id=c.id;
 v_start=coalesce(v_start,v_now);
 if v_kind='suspension' then
 v_end=activant_private.business_suspension_end(v_start,days);
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
 insert into public.gym_access_restrictions(user_id,kind,starts_at,ends_at,created_by) values(p_user,'suspension',v_start,v_end,auth.uid()) returning id into v_restriction;
 end if;
 insert into public.absence_sanctions(case_id,user_id,ordinal,kind,business_days,restriction_id,created_by)
 values(c.id,p_user,n,v_kind,days,v_restriction,auth.uid());
 end loop;
end; $$;

revoke all on function activant_private.reconcile_absence_sanctions(uuid) from public,anon,authenticated,service_role;
commit;
