-- Libro de puntos y revisión de inasistencias. Sin backfill ni recompensas.
begin;
create table public.point_program_rules (
 id uuid primary key default gen_random_uuid(),
 effective_month date not null unique check(extract(day from effective_month)=1),
 points_enabled boolean not null default true,
 attendance_points integer not null default 10 check(attendance_points between 0 and 10000),
 cancellation_points integer not null default 3 check(cancellation_points between 0 and 10000),
 cancellation_limit integer not null default 2 check(cancellation_limit between 0 and 20),
 cancellation_notice_minutes integer not null default 60 check(cancellation_notice_minutes between 0 and 10080),
 first_bonus_count integer not null default 8 check(first_bonus_count between 1 and 100),
 first_bonus_points integer not null default 20 check(first_bonus_points between 0 and 10000),
 second_bonus_count integer not null default 12 check(second_bonus_count>first_bonus_count and second_bonus_count<=200),
 second_bonus_points integer not null default 30 check(second_bonus_points>=first_bonus_points and second_bonus_points<=10000),
 absences_enabled boolean not null default true,
 absence_period text not null default 'calendar_month' check(absence_period in ('calendar_month','rolling_days')),
 absence_window_days integer not null default 90 check(absence_window_days between 1 and 365),
 second_absence_days integer not null default 3 check(second_absence_days between 1 and 30),
 third_absence_days integer not null default 5 check(third_absence_days between second_absence_days and 60),
 closeout_delay_minutes integer not null default 15 check(closeout_delay_minutes between 0 and 1440),
 created_at timestamptz not null default clock_timestamp(),
 created_by uuid references public.profiles(id) on delete restrict
);
insert into public.point_program_rules(effective_month) values(date_trunc('month',clock_timestamp() at time zone 'America/Bogota')::date);
create table public.point_periods (
 user_id uuid not null references public.profiles(id) on delete restrict,
 month_start date not null check(extract(day from month_start)=1),
 rules_id uuid not null references public.point_program_rules(id) on delete restrict,
 bonus_revision integer not null default 0 check(bonus_revision>=0),
 primary key(user_id,month_start)
);
create index point_periods_rules_idx on public.point_periods(rules_id);
create table public.point_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 month_start date not null,
 kind text not null check(kind in ('attendance','cancellation','monthly_bonus','reversal','adjustment')),
 amount integer not null check(amount between -1000000 and 1000000),
 event_key text not null unique check(length(event_key) between 1 and 180),
 reservation_id uuid references public.reservations(id) on delete restrict,
 attendance_id uuid references public.attendance(reservation_id) on delete restrict,
 reverses_id uuid unique references public.point_transactions(id) on delete restrict,
 reason text not null check(reason in ('validated_attendance','timely_cancellation','monthly_bonus_change','attendance_invalidated','correction','appeal')),
 created_at timestamptz not null default clock_timestamp(),
 created_by uuid references public.profiles(id) on delete restrict,
 foreign key(user_id,month_start) references public.point_periods(user_id,month_start) on delete restrict,
 check((kind='attendance')=(attendance_id is not null)),
 check((kind='reversal')=(reverses_id is not null)),
 check(kind not in ('attendance','cancellation') or amount>=0),
 check(kind<>'adjustment' or amount<>0)
);
create index point_transactions_user_time_idx on public.point_transactions(user_id,created_at desc,id);
create index point_transactions_period_idx on public.point_transactions(user_id,month_start,kind);
create index point_transactions_reservation_idx on public.point_transactions(reservation_id);
create index point_transactions_attendance_idx on public.point_transactions(attendance_id);
create index point_transactions_actor_idx on public.point_transactions(created_by);
create table public.attendance_invalidations (
 reservation_id uuid primary key references public.attendance(reservation_id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 reason text not null check(reason in ('duplicate_evidence','incorrect_entry','verified_absence')),
 invalidated_at timestamptz not null default clock_timestamp(),
 invalidated_by uuid not null references public.profiles(id) on delete restrict
);
create index attendance_invalidations_user_idx on public.attendance_invalidations(user_id);
create index attendance_invalidations_actor_idx on public.attendance_invalidations(invalidated_by);
create table public.gym_slot_closeouts (
 slot_id uuid primary key references public.gym_slots(id) on delete restrict,
 evidence text not null check(evidence='attendance_reconciled'),
 closed_at timestamptz not null default clock_timestamp(),
 closed_by uuid not null references public.profiles(id) on delete restrict
);
create index gym_slot_closeouts_actor_idx on public.gym_slot_closeouts(closed_by);
create table public.absence_cases (
 id uuid primary key default gen_random_uuid(),
 reservation_id uuid not null unique,
 user_id uuid not null,
 slot_id uuid not null references public.gym_slot_closeouts(slot_id) on delete restrict,
 occurred_at timestamptz not null,
 rules_id uuid not null references public.point_program_rules(id) on delete restrict,
 review_requested_at timestamptz default clock_timestamp(),
 status text not null default 'pending_review' check(status in ('pending_review','justified','unjustified')),
 decision_reason text check(decision_reason in ('evidence_confirmed','justification_accepted','insufficient_evidence')),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 unique(id,user_id),
 foreign key(reservation_id,user_id,slot_id) references public.reservations(id,user_id,slot_id) on delete restrict
);
create index absence_cases_user_time_idx on public.absence_cases(user_id,occurred_at,id);
create index absence_cases_review_idx on public.absence_cases(status,occurred_at);
create index absence_cases_slot_idx on public.absence_cases(slot_id);
create index absence_cases_rules_idx on public.absence_cases(rules_id);
create index absence_cases_reviewer_idx on public.absence_cases(reviewed_by);
create table public.absence_justifications (
 case_id uuid primary key,
 user_id uuid not null,
 reason text not null check(reason in ('unforeseen_event','reservation_dispute','access_problem')),
 submitted_at timestamptz not null default clock_timestamp(),
 foreign key(case_id,user_id) references public.absence_cases(id,user_id) on delete restrict
);
create index absence_justifications_user_idx on public.absence_justifications(user_id);
create table public.working_calendar (
 day date primary key,
 is_working boolean not null,
 verified_by uuid not null references public.profiles(id) on delete restrict,
 verified_at timestamptz not null default clock_timestamp()
);
create index working_calendar_verifier_idx on public.working_calendar(verified_by);
create table public.absence_sanctions (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null,
 user_id uuid not null,
 ordinal integer not null check(ordinal>=1),
 kind text not null check(kind in ('warning','suspension','administrative_review','pending_calendar')),
 business_days integer not null default 0 check(business_days between 0 and 60),
 restriction_id uuid unique references public.gym_access_restrictions(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 created_by uuid not null references public.profiles(id) on delete restrict,
 revoked_at timestamptz,
 foreign key(case_id,user_id) references public.absence_cases(id,user_id) on delete restrict,
 check((kind='suspension')=(restriction_id is not null))
);
create unique index absence_sanctions_active_case_idx on public.absence_sanctions(case_id) where revoked_at is null;
create index absence_sanctions_user_idx on public.absence_sanctions(user_id,created_at);
create index absence_sanctions_actor_idx on public.absence_sanctions(created_by);

do $$ declare t text; begin
 foreach t in array array['point_program_rules','point_periods','point_transactions','attendance_invalidations','gym_slot_closeouts','absence_cases','absence_justifications','working_calendar','absence_sanctions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create trigger z_audit_change after insert or update or delete on public.%I for each row execute function activant_private.audit_change()',t);
 end loop;
 foreach t in array array['point_program_rules','point_transactions','attendance_invalidations','gym_slot_closeouts','absence_justifications'] loop
 execute format('create trigger immutable before update or delete on public.%I for each row execute function activant_private.prevent_rewrite()',t);
 end loop;
end; $$;
create policy read_rules on public.point_program_rules for select to authenticated using(activant_private.active_user());
create policy read_periods on public.point_periods for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_point_transactions on public.point_transactions for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_attendance_invalidations on public.attendance_invalidations for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin') or activant_private.has_role('gym_staff'));
create policy read_closeouts on public.gym_slot_closeouts for select to authenticated using(activant_private.has_role('admin') or activant_private.has_role('gym_staff'));
create policy read_absence_cases on public.absence_cases for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_justifications on public.absence_justifications for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
create policy read_working_calendar on public.working_calendar for select to authenticated using(activant_private.active_user());
create policy read_sanctions on public.absence_sanctions for select to authenticated using(user_id=(select auth.uid()) or activant_private.has_role('admin'));
commit;
