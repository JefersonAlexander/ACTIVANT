-- Un perfil real por identidad de Supabase Auth. No hay datos de demostración.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.profiles.is_active is
  'Solo un administrador de confianza puede habilitar el acceso institucional.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "users_read_own_profile" on public.profiles
for select to authenticated using ((select auth.uid()) = id);

-- No hay políticas INSERT/UPDATE/DELETE ni permisos de escritura para clientes.
-- El estado no procede de user_metadata, que puede ser modificado por el usuario.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Las cuentas preexistentes requieren activación administrativa explícita.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

commit;
