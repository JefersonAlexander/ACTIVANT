-- Ejecutar como propietario SQL después de habilitar pg_cron en Supabase.
-- Idempotente. No contiene secretos ni habilita permisos de RPC a navegadores.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then
 raise exception 'Habilita la extensión pg_cron antes de activar las tareas de ACTIVANT.'; end if;
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
 raise exception 'No existe la publicación supabase_realtime.'; end if;
end; $$;
select activant_private.install_waitlist_runtime();
-- Monitor: la última ejecución debe ser succeeded; no basta con crear el job.
select jobid,jobname,schedule,active from cron.job where jobname='activant-waitlist-maintenance';
select j.jobname,d.status,d.start_time,d.end_time,d.return_message
from cron.job j join cron.job_run_details d using(jobid)
where j.jobname='activant-waitlist-maintenance' order by d.start_time desc limit 10;
