begin;
-- Diccionario de categorías, sin contenidos ni actividad institucional inventada.
create table public.wellness_categories (
 code text primary key, label text not null unique
);
insert into public.wellness_categories values
 ('rutinas','Rutinas de actividad física'),('clases','Clases virtuales'),
 ('movilidad','Ejercicios de movilidad'),('pausas','Pausas activas'),('casa','Actividades en casa');
create table public.wellness_assets (
 id uuid primary key default gen_random_uuid(),
 object_path text not null unique,
 kind text not null check(kind in ('cover','video')),
 mime_type text not null,
 size_bytes bigint not null,
 status text not null default 'pending' check(status in ('pending','ready')),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 check((kind='cover' and mime_type in ('image/jpeg','image/png','image/webp') and size_bytes between 1 and 5242880)
 or (kind='video' and mime_type in ('video/mp4','video/webm') and size_bytes between 1 and 104857600)),
 check(object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$')
);
create index wellness_assets_creator on public.wellness_assets(created_by,created_at desc);
create table public.wellness_contents (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 3 and 160),
 description text not null check(length(btrim(description)) between 10 and 4000),
 category text not null references public.wellness_categories(code) on delete restrict,
 duration_minutes integer not null check(duration_minutes between 1 and 600),
 cover_asset_id uuid references public.wellness_assets(id) on delete restrict,
 video_asset_id uuid references public.wellness_assets(id) on delete restrict,
 external_url text check(external_url is null or (length(external_url)<=2048 and external_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]+(:443)?(/[^[:cntrl:][:space:]]*)?$' and external_url !~ '^https://[^/]*@')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 authorized_by uuid references public.profiles(id) on delete restrict,
 authorized_at timestamptz,
 published_at timestamptz,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 revision integer not null default 1,
 check(not(video_asset_id is not null and external_url is not null)),
 check((authorized_by is null)=(authorized_at is null)),
 check(status<>'published' or (cover_asset_id is not null and (video_asset_id is not null or external_url is not null) and authorized_by is not null and published_at is not null))
);
create index wellness_contents_catalog on public.wellness_contents(status,category,published_at desc,id);
create index wellness_contents_cover on public.wellness_contents(cover_asset_id);
create index wellness_contents_video on public.wellness_contents(video_asset_id);
create index wellness_contents_creator on public.wellness_contents(created_by);
create index wellness_contents_authorizer on public.wellness_contents(authorized_by);

create function activant_private.library_reader() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.affiliation_types a on a.code=p.affiliation_type
 where p.id=auth.uid() and p.is_active and a.is_active);
$$;
create function activant_private.can_read_wellness_asset(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select activant_private.has_role('admin') or (activant_private.library_reader() and exists(
 select 1 from public.wellness_assets a join public.wellness_contents c on c.cover_asset_id=a.id or c.video_asset_id=a.id
 where a.object_path=p_path and a.status='ready' and c.status='published'));
$$;
do $$ declare t text; begin
 foreach t in array array['wellness_categories','wellness_assets','wellness_contents'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end; $$;
create policy read_wellness_categories on public.wellness_categories for select to authenticated using(activant_private.active_user());
create policy read_wellness_contents on public.wellness_contents for select to authenticated using(
 activant_private.has_role('admin') or (status='published' and activant_private.library_reader()));
create policy read_wellness_assets on public.wellness_assets for select to authenticated using(activant_private.can_read_wellness_asset(object_path));
create trigger z_audit_change after insert or update or delete on public.wellness_contents for each row execute function activant_private.audit_change();
create trigger z_audit_change after insert or update or delete on public.wellness_assets for each row execute function activant_private.audit_change();

-- No se permite que un SELECT de descarga se convierta en un URL firmado compartible.
do $$ begin
 if to_regprocedure('storage.allow_only_operation(text)') is null then
 raise exception 'Se requiere Supabase Storage con storage.allow_only_operation(text). Actualiza Storage antes de aplicar esta migración.'; end if;
 if exists(select 1 from storage.buckets where id='activant-wellness') then
 raise exception 'El bucket activant-wellness ya existe. Verifica su uso antes de migrar; no se modifica un bucket preexistente.'; end if;
end; $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('activant-wellness','activant-wellness',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);

create function activant_private.can_upload_wellness_asset(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select activant_private.has_role('admin') and exists(select 1 from public.wellness_assets
 where object_path=p_path and created_by=auth.uid() and status='pending');
$$;
create policy wellness_upload on storage.objects for insert to authenticated with check(
 bucket_id='activant-wellness' and activant_private.can_upload_wellness_asset(name));
create policy wellness_authenticated_download on storage.objects for select to authenticated using(
 bucket_id='activant-wellness' and storage.allow_only_operation('storage.object.get_authenticated')
 and activant_private.can_read_wellness_asset(name));
-- Las políticas permisivas de otros buckets no deben abrir este bucket.
create policy wellness_download_guard on storage.objects as restrictive for select to authenticated using(
 case when bucket_id<>'activant-wellness' then true when auth.uid() is null then false else
 storage.allow_only_operation('storage.object.get_authenticated') and activant_private.can_read_wellness_asset(name) end);
create policy wellness_upload_guard on storage.objects as restrictive for insert to authenticated with check(
 case when bucket_id<>'activant-wellness' then true when auth.uid() is null then false else activant_private.can_upload_wellness_asset(name) end);
create policy wellness_no_overwrite on storage.objects as restrictive for update to authenticated,anon
 using(bucket_id<>'activant-wellness') with check(bucket_id<>'activant-wellness');
create policy wellness_no_delete on storage.objects as restrictive for delete to authenticated,anon using(bucket_id<>'activant-wellness');
create policy wellness_anon_guard on storage.objects as restrictive for all to anon
 using(bucket_id<>'activant-wellness') with check(bucket_id<>'activant-wellness');
create policy wellness_bucket_settings on storage.buckets as restrictive for all to authenticated,anon
 using(id<>'activant-wellness') with check(id<>'activant-wellness');
-- Sin UPDATE: los archivos son inmutables, incluso después de despublicar.
-- Sin DELETE de navegador: archivar conserva las evidencias y los archivos.

create function public.get_wellness_library_access() returns boolean
language sql stable security definer set search_path='' as $$
 select activant_private.library_reader() or activant_private.has_role('admin');
$$;
create function public.admin_prepare_wellness_asset(p_kind text,p_mime_type text,p_size_bytes bigint)
returns table(id uuid,object_path text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid=gen_random_uuid(); v_ext text;
begin
 perform activant_private.require_admin();
 v_ext=case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' end;
 if v_ext is null then raise exception 'Tipo de archivo no permitido.' using errcode='23514',detail='invalid_media'; end if;
 return query insert into public.wellness_assets(id,object_path,kind,mime_type,size_bytes,created_by)
 values(v_id,auth.uid()||'/'||v_id||'.'||v_ext,p_kind,p_mime_type,p_size_bytes,auth.uid())
 returning wellness_assets.id,wellness_assets.object_path;
end; $$;
create function public.admin_finalize_wellness_asset(p_asset_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.wellness_assets; v_meta jsonb;
begin
 perform activant_private.require_admin();
 select * into a from public.wellness_assets where id=p_asset_id and created_by=auth.uid() for update;
 if not found then raise exception 'El archivo no existe.' using errcode='42501'; end if;
 if a.status='ready' then return; end if;
 select metadata into v_meta from storage.objects where bucket_id='activant-wellness' and name=a.object_path;
 if v_meta is null or coalesce(v_meta->>'size','')!~'^[0-9]{1,12}$' then raise exception 'No se confirmó la carga del archivo.' using errcode='23514',detail='upload_incomplete'; end if;
 if (v_meta->>'size')::bigint<>a.size_bytes or v_meta->>'mimetype' is distinct from a.mime_type then
 raise exception 'El archivo no coincide con el registro autorizado.' using errcode='23514',detail='invalid_media'; end if;
 update public.wellness_assets set status='ready' where id=a.id;
end; $$;
create function public.admin_save_wellness_content(p_id uuid,p_revision integer,p_title text,p_description text,p_category text,
 p_duration_minutes integer,p_cover_asset_id uuid,p_video_asset_id uuid,p_external_url text,p_status text,p_authorized boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid=coalesce(p_id,gen_random_uuid()); c public.wellness_contents;
begin
 perform activant_private.require_admin();
 if p_id is not null then
 select * into c from public.wellness_contents where id=p_id for update;
 if not found then raise exception 'El contenido no existe.' using errcode='23503'; end if;
 if c.revision is distinct from p_revision then raise exception 'Otra persona actualizó el contenido.' using errcode='23514',detail='content_conflict'; end if;
 end if;
 if p_cover_asset_id is not null and not exists(select 1 from public.wellness_assets where id=p_cover_asset_id and kind='cover' and status='ready') then
 raise exception 'Selecciona una portada cargada.' using errcode='23514',detail='cover_required'; end if;
 if p_video_asset_id is not null and not exists(select 1 from public.wellness_assets where id=p_video_asset_id and kind='video' and status='ready') then
 raise exception 'Selecciona un video cargado.' using errcode='23514',detail='video_required'; end if;
 if p_status='published' and p_authorized is distinct from true then
 raise exception 'Confirma la autorización institucional del material antes de publicar.' using errcode='23514',detail='authorization_required'; end if;
 if p_id is null then
 insert into public.wellness_contents(id,title,description,category,duration_minutes,cover_asset_id,video_asset_id,external_url,status,
 authorized_by,authorized_at,published_at,created_by)
 values(v_id,btrim(p_title),btrim(p_description),p_category,p_duration_minutes,p_cover_asset_id,p_video_asset_id,nullif(p_external_url,''),p_status,
 case when p_authorized then auth.uid() end,case when p_authorized then clock_timestamp() end,
 case when p_status='published' then clock_timestamp() end,auth.uid());
 else
 update public.wellness_contents set title=btrim(p_title),description=btrim(p_description),category=p_category,duration_minutes=p_duration_minutes,
 cover_asset_id=p_cover_asset_id,video_asset_id=p_video_asset_id,external_url=nullif(p_external_url,''),status=p_status,
 authorized_by=case when p_authorized then auth.uid() end,authorized_at=case when p_authorized then clock_timestamp() end,
 published_at=case when p_status='published' then coalesce(c.published_at,clock_timestamp()) else c.published_at end,
 updated_at=clock_timestamp(),revision=c.revision+1 where id=v_id;
 end if;
 return v_id;
end; $$;

revoke all on function activant_private.library_reader(),activant_private.can_read_wellness_asset(text),activant_private.can_upload_wellness_asset(text) from public,anon,authenticated,service_role;
grant execute on function activant_private.library_reader(),activant_private.can_read_wellness_asset(text),activant_private.can_upload_wellness_asset(text) to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array['get_wellness_library_access','admin_prepare_wellness_asset','admin_finalize_wellness_asset','admin_save_wellness_content']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end; $$;
commit;
