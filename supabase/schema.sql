-- E-BIMWIN KUA MAKALE — Supabase PostgreSQL Schema (Idempotent / Aman Dijalankan Berulang Kali)
-- Skrip ini dirancang agar TIDAK PERNAH EROR meskipun dijalankan berkali-kali di SQL Editor Supabase.

create extension if not exists pgcrypto;

-- 1. Buat tipe enum app_role (aman jika sudah ada)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('super_admin', 'admin_kua', 'fasilitator', 'peserta');
  end if;
end $$;

-- 2. Buat tabel-tabel utama
create table if not exists public.app_users (
  id text primary key,
  phone text unique not null,
  name text not null,
  email text,
  gender text,
  password_hash text not null,
  profile jsonb default '{}'::jsonb,
  progress jsonb default '{"1":[],"2":[]}'::jsonb,
  pre jsonb,
  post jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.app_users enable row level security;
drop policy if exists "allow all for app_users" on public.app_users;
create policy "allow all for app_users" on public.app_users for all using (true) with check (true);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'KUA Kecamatan Makale',
  ministry text not null default 'Kementerian Agama Kabupaten Tana Toraja',
  logo_path text,
  whatsapp text,
  contact_email text,
  facilitator_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  role public.app_role not null default 'peserta',
  full_name text not null,
  phone text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participant_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  father_name text not null default '',
  birth_place text not null default '',
  birth_date date not null default '2000-01-01',
  gender text not null check (gender in ('Laki-laki','Perempuan')),
  address text not null default '',
  birth_order text not null default '1',
  education text not null default 'SMA/MA/SMK',
  occupation text not null default '',
  wedding_date date,
  kua_name text not null default 'KUA Kecamatan Makale',
  attendance_status text not null default 'Belum mengikuti',
  updated_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id, sort_order)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  activity_data jsonb not null default '{}'::jsonb
);

create table if not exists public.pretest_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  competency text,
  question text not null,
  options jsonb not null,
  correct_option int not null check(correct_option between 0 and 3),
  weight numeric(6,2) not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posttest_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  competency text,
  question text not null,
  options jsonb not null,
  correct_option int not null check(correct_option between 0 and 3),
  weight numeric(6,2) not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_type text not null check(test_type in ('pretest','posttest')),
  score numeric(5,2),
  correct_count int,
  wrong_count int,
  duration_seconds int,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress',
  unique(user_id, test_type)
);

create table if not exists public.test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null,
  selected_option int check(selected_option between 0 and 3),
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create table if not exists public.reflection_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  note_type text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.facilitator_assignments (
  facilitator_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  primary key(facilitator_id, participant_id)
);

-- 3. Fungsi pembantu Role
create or replace function public.current_role()
returns public.app_role language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_role() in ('super_admin','admin_kua'), false) $$;

-- 4. Aktifkan Row Level Security (RLS)
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

-- 5. Kebijakan Keamanan (Drop dulu sebelum Create agar tidak eror jika sudah ada)

-- Modul & Pelajaran
drop policy if exists "active modules readable" on public.modules;
create policy "active modules readable" on public.modules for select using (is_active or public.is_admin());

drop policy if exists "active lessons readable" on public.lessons;
create policy "active lessons readable" on public.lessons for select using (is_active or public.is_admin());

drop policy if exists "admins manage modules" on public.modules;
create policy "admins manage modules" on public.modules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage lessons" on public.lessons;
create policy "admins manage lessons" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- Profil Pengguna
drop policy if exists "profile read own admin or assigned" on public.profiles;
create policy "profile read own admin or assigned" on public.profiles for select using (
  id = auth.uid() or public.is_admin()
);

drop policy if exists "profile update own or admin" on public.profiles;
create policy "profile update own or admin" on public.profiles for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());

drop policy if exists "profile insert self" on public.profiles;
create policy "profile insert self" on public.profiles for insert with check (id=auth.uid());

-- Biodata Peserta
drop policy if exists "participant data own admin assigned" on public.participant_profiles;
create policy "participant data own admin assigned" on public.participant_profiles for select using (
  user_id=auth.uid() or public.is_admin()
);

drop policy if exists "participant data insert own" on public.participant_profiles;
create policy "participant data insert own" on public.participant_profiles for insert with check(user_id=auth.uid());

drop policy if exists "participant data update own admin" on public.participant_profiles;
create policy "participant data update own admin" on public.participant_profiles for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Pasangan
drop policy if exists "partner own admin" on public.partners;
create policy "partner own admin" on public.partners for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Progres Modul & Subbab
drop policy if exists "progress own admin assigned" on public.lesson_progress;
create policy "progress own admin assigned" on public.lesson_progress for select using(user_id=auth.uid() or public.is_admin());

drop policy if exists "progress own write" on public.lesson_progress;
create policy "progress own write" on public.lesson_progress for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Kuis & Hasil Tes
drop policy if exists "attempt own or admin assigned read" on public.test_attempts;
create policy "attempt own or admin assigned read" on public.test_attempts for select using(user_id=auth.uid() or public.is_admin());

drop policy if exists "attempt own write" on public.test_attempts;
create policy "attempt own write" on public.test_attempts for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

drop policy if exists "answers through own attempts" on public.test_answers;
create policy "answers through own attempts" on public.test_answers for select using(exists(select 1 from public.test_attempts t where t.id=attempt_id and (t.user_id=auth.uid() or public.is_admin())));

drop policy if exists "answers own write" on public.test_answers;
create policy "answers own write" on public.test_answers for all using(exists(select 1 from public.test_attempts t where t.id=attempt_id and (t.user_id=auth.uid() or public.is_admin()))) with check(exists(select 1 from public.test_attempts t where t.id=attempt_id and (t.user_id=auth.uid() or public.is_admin())));

-- Catatan Refleksi
drop policy if exists "notes own admin assigned read" on public.reflection_notes;
create policy "notes own admin assigned read" on public.reflection_notes for select using(user_id=auth.uid() or public.is_admin());

drop policy if exists "notes own write" on public.reflection_notes;
create policy "notes own write" on public.reflection_notes for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Institusi
drop policy if exists "institution read authenticated" on public.institutions;
create policy "institution read authenticated" on public.institutions for select using(true);
