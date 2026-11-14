-- SOLO datos sintéticos, reproducibles y protegidos contra ejecución accidental.
-- El runner crea una base nueva con este prefijo y habilita fixture_mode.
do $$ begin
 if current_database() not like 'activant_dbtest_%' or current_setting('activant.fixture_mode',true) is distinct from 'on' then
 raise exception 'Fixtures permitidos únicamente en la base aislada del runner.'; end if;
end; $$;

insert into auth.users(id,email,raw_user_meta_data)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'fixture-'||n||'@example.invalid','{"role":"admin","is_active":true}'::jsonb
from generate_series(1,130) as n;
update public.profiles set is_active=(id<>'20000000-0000-4000-8000-000000000006'),affiliation_type='servidor_planta'
where id<>'20000000-0000-4000-8000-000000000900';
insert into public.user_roles(user_id,role) values
 ('20000000-0000-4000-8000-000000000001','admin'),
 ('20000000-0000-4000-8000-000000000002','admin'),
 ('20000000-0000-4000-8000-000000000003','gym_staff');
update public.gym_eligibility set is_eligible=true,valid_from=clock_timestamp()-interval '1 day',valid_until=clock_timestamp()+interval '30 days';
update public.gym_eligibility set is_eligible=false where user_id='20000000-0000-4000-8000-000000000007';
update public.gym_eligibility set valid_from=clock_timestamp()-interval '2 days',valid_until=clock_timestamp()-interval '1 day'
where user_id='20000000-0000-4000-8000-000000000008';
update public.gym_eligibility set valid_from=clock_timestamp()+interval '1 day' where user_id='20000000-0000-4000-8000-000000000009';
update public.gym_eligibility set valid_until=clock_timestamp()+interval '1 hour' where user_id='20000000-0000-4000-8000-000000000013';
insert into public.affiliation_types(code,label,is_active) values('fixture_inactiva','Categoría sintética inactiva',false);
update public.profiles set affiliation_type='fixture_inactiva' where id='20000000-0000-4000-8000-000000000010';

insert into public.gym_slots(id,starts_at,ends_at,capacity)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 clock_timestamp()+interval '2 hours'+make_interval(hours=>n*2),
 clock_timestamp()+interval '3 hours'+make_interval(hours=>n*2),
 case when n=2 then 1 else 20 end from generate_series(1,5) as n;
insert into public.gym_slots(id,starts_at,ends_at)
values('30000000-0000-4000-8000-000000000100',clock_timestamp()-interval '5 minutes',clock_timestamp()+interval '1 hour');
-- Historia sintética anterior al inicio de la franja actual. Solo el propietario
-- de la base de pruebas desactiva este guard durante la carga; se restaura antes
-- de cualquier prueba. Las FK, índices y auditoría permanecen habilitados.
alter table public.reservations disable trigger guard_reservation;
insert into public.reservations(id,user_id,slot_id,created_at)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000100',clock_timestamp()-interval '1 hour'
from unnest(array[4,5,11,12]) as n;
alter table public.reservations enable trigger guard_reservation;
