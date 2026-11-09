-- E-BIMWIN KUA MAKALE — Supabase PostgreSQL starter schema
-- Jalankan melalui Supabase SQL Editor setelah meninjau kebijakan dan kebutuhan instansi.
-- Auth: gunakan Supabase Auth phone/password; aktifkan verifikasi nomor HP/SMS sesuai konfigurasi proyek.
create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','admin_kua','fasilitator','peserta');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'KUA Kecamatan Makale',
  ministry text not null default 'Kementerian Agama Kabupaten Tana Toraja',
  logo_path text, whatsapp text, contact_email text, facilitator_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  role public.app_role not null default 'peserta',
  full_name text not null,
  phone text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.participant_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  father_name text not null, birth_place text not null, birth_date date not null,
  gender text not null check (gender in ('Laki-laki','Perempuan')),
  address text not null, birth_order text not null, education text not null, occupation text not null,
  wedding_date date, kua_name text not null default 'KUA Kecamatan Makale',
  attendance_status text not null default 'Belum mengikuti',
  updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null, phone text,
  created_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null, description text,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null, content jsonb not null default '{}'::jsonb,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(module_id, sort_order)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz, activity_data jsonb not null default '{}'::jsonb,
  unique(user_id, lesson_id)
);

create table public.pretest_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  competency text, question text not null, options jsonb not null,
  correct_option int not null check(correct_option between 0 and 3),
  weight numeric(6,2) not null default 1, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.posttest_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  competency text, question text not null, options jsonb not null,
  correct_option int not null check(correct_option between 0 and 3),
  weight numeric(6,2) not null default 1, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_type text not null check(test_type in ('pretest','posttest')),
  score numeric(5,2), correct_count int, wrong_count int,
  duration_seconds int, started_at timestamptz not null default now(),
  submitted_at timestamptz, status text not null default 'in_progress',
  unique(user_id, test_type)
);

create table public.test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null,
  selected_option int check(selected_option between 0 and 3),
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create table public.reflection_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  note_type text not null, content text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.facilitator_assignments (
  facilitator_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  primary key(facilitator_id, participant_id)
);

-- Helper functions. Role assignment must be performed only by trusted administrators.
create or replace function public.current_role()
returns public.app_role language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_role() in ('super_admin','admin_kua'), false) $$;

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.participant_profiles enable row level security;
alter table public.partners enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.pretest_questions enable row level security;
alter table public.posttest_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_answers enable row level security;
alter table public.reflection_notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.facilitator_assignments enable row level security;

-- Publicly readable active learning content; write access only to admins.
create policy "active modules readable" on public.modules for select using (is_active or public.is_admin());
create policy "active lessons readable" on public.lessons for select using (is_active or public.is_admin());
create policy "admins manage modules" on public.modules for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage lessons" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- Profile owner and admins; facilitator sees assigned participants only.
create policy "profile read own admin or assigned" on public.profiles for select using (
 id = auth.uid() or public.is_admin() or
 (public.current_role()='fasilitator' and exists(select 1 from public.facilitator_assignments a where a.facilitator_id=auth.uid() and a.participant_id=profiles.id))
);
create policy "profile update own or admin" on public.profiles for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
create policy "profile insert self" on public.profiles for insert with check (id=auth.uid() and role='peserta');

create policy "participant data own admin assigned" on public.participant_profiles for select using (
 user_id=auth.uid() or public.is_admin() or exists(select 1 from public.facilitator_assignments a where a.facilitator_id=auth.uid() and a.participant_id=participant_profiles.user_id)
);
create policy "participant data insert own" on public.participant_profiles for insert with check(user_id=auth.uid());
create policy "participant data update own admin" on public.participant_profiles for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

create policy "partner own admin" on public.partners for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "progress own admin assigned" on public.lesson_progress for select using(user_id=auth.uid() or public.is_admin() or exists(select 1 from public.facilitator_assignments a where a.facilitator_id=auth.uid() and a.participant_id=lesson_progress.user_id));
-- Penulisan progres dilakukan melalui Edge Function/RPC tepercaya agar peserta tidak dapat menandai semua lesson selesai sendiri.
create policy "progress admin manage" on public.lesson_progress for all using(public.is_admin()) with check(public.is_admin());

-- Peserta tidak boleh membaca tabel bank soal secara langsung karena correct_option bersifat rahasia.
-- Edge Function tepercaya mengambil soal dan hanya mengirim teks + opsi tanpa kunci.
create policy "question admins manage" on public.pretest_questions for all using(public.is_admin()) with check(public.is_admin());
create policy "post questions admins manage" on public.posttest_questions for all using(public.is_admin()) with check(public.is_admin());

create policy "attempt own or admin assigned read" on public.test_attempts for select using(user_id=auth.uid() or public.is_admin() or exists(select 1 from public.facilitator_assignments a where a.facilitator_id=auth.uid() and a.participant_id=test_attempts.user_id));
-- Pembuatan dan pengiriman attempt dilakukan oleh Edge Function tepercaya; klien hanya membaca hasil miliknya.
create policy "attempt admin manage" on public.test_attempts for all using(public.is_admin()) with check(public.is_admin());

create policy "answers through own attempts" on public.test_answers for select using(exists(select 1 from public.test_attempts t where t.id=attempt_id and (t.user_id=auth.uid() or public.is_admin())));
-- Penulisan jawaban dan is_correct hanya melalui Edge Function tepercaya.
create policy "answers admin manage" on public.test_answers for all using(public.is_admin()) with check(public.is_admin());
create policy "notes own admin assigned read" on public.reflection_notes for select using(user_id=auth.uid() or public.is_admin() or exists(select 1 from public.facilitator_assignments a where a.facilitator_id=auth.uid() and a.participant_id=reflection_notes.user_id));
create policy "notes own write" on public.reflection_notes for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "logs admin read" on public.activity_logs for select using(public.is_admin());
create policy "logs actor insert" on public.activity_logs for insert with check(actor_id=auth.uid());
create policy "assignments admin manage" on public.facilitator_assignments for all using(public.is_admin()) with check(public.is_admin());
create policy "institution read authenticated" on public.institutions for select using(auth.uid() is not null);
create policy "institution admin manage" on public.institutions for all using(public.is_admin()) with check(public.is_admin());

-- IMPORTANT PRODUCTION HARDENING:
-- 1) Do not expose correct_option to participant clients. Replace direct question SELECT
--    with a safe view/RPC that returns question + options only.
-- 2) Grade and submit tests in a trusted Edge Function / server endpoint using service role.
-- 3) Tambahkan column-level grants/triggers agar klien tidak dapat mengubah role, is_active, score, is_correct, atau kolom sistem.
-- 4) Add audit triggers, rate limits, retention/deletion workflows, and tested policies.
-- 5) Review every policy with separate test accounts for all four roles before launch.
