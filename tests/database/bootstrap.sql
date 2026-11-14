-- SOLO para el clúster descartable del runner. No es una migración de Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create table auth.users (
 id uuid primary key, email text, raw_user_meta_data jsonb default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
-- Reproduce el perfil preexistente antes de las nuevas migraciones.
insert into auth.users(id,email) values('20000000-0000-4000-8000-000000000900','legacy@fixture.invalid');

-- Contrato mínimo de Storage SOLO para probar políticas SQL. No simula el servicio de archivos.
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,owner_id text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,anon;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.objects to anon;
create function storage.allow_only_operation(p_operation text) returns boolean language sql stable as $$
 select nullif(current_setting('test.storage_operation',true),'')=p_operation;
$$;
grant execute on function storage.allow_only_operation(text) to authenticated;
