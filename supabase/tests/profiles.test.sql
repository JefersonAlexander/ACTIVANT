-- Ejecutar únicamente en una base local de pruebas con supabase test db.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);
select has_table('public', 'profiles', 'Existe el perfil institucional');
select col_default_is('public', 'profiles', 'is_active', 'false', 'El acceso nace deshabilitado');
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-4000-8000-000000000001', 'profile-a@fixture.invalid', '{"is_active":true}'),
       ('10000000-0000-4000-8000-000000000002', 'profile-b@fixture.invalid', '{}');
select is((select is_active::text from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'false', 'Ignora activación en metadata');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'Anon no puede leer perfiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'No permite crear perfiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'No permite activar perfiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'No permite borrar perfiles');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq('select id from public.profiles', array['10000000-0000-4000-8000-000000000001'::uuid], 'RLS permite solo el perfil propio');
select throws_ok($sql$update public.profiles set is_active = true where id = '10000000-0000-4000-8000-000000000001'$sql$, '42501', 'permission denied for table profiles', 'Bloquea autoactivación');
select is((select count(*)::integer from public.profiles where id = '10000000-0000-4000-8000-000000000002'), 0, 'RLS oculta otros perfiles');
reset role;
select * from finish();
rollback;
