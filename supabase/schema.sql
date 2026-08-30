create extension if not exists pgcrypto;
create table if not exists public.employees (
 id uuid primary key default gen_random_uuid(), employee_code text unique not null, name text not null,
 phone text, department text, joining_date date not null default current_date, active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete cascade,
 attendance_date date not null, status text not null check(status in ('present','absent','leave','half_day')),
 marked_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(employee_id,attendance_date)
);
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
create policy "authenticated can read employees" on public.employees for select to authenticated using (true);
create policy "authenticated can insert employees" on public.employees for insert to authenticated with check (true);
create policy "authenticated can update employees" on public.employees for update to authenticated using (true) with check (true);
create policy "authenticated can read attendance" on public.attendance for select to authenticated using (true);
create policy "authenticated can insert attendance" on public.attendance for insert to authenticated with check (true);
create policy "authenticated can update attendance" on public.attendance for update to authenticated using (true) with check (true);
create index if not exists attendance_date_idx on public.attendance(attendance_date);
create index if not exists attendance_employee_idx on public.attendance(employee_id);
