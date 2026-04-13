-- Run dit in Supabase Dashboard → SQL Editor
-- Aanmaken outlook_settings tabel voor Outlook .ics feed koppeling

create table if not exists outlook_settings (
  id text primary key,
  ics_url text,
  days_past integer default 30,
  days_future integer default 180,
  calendar_name text,
  updated_at timestamptz default now()
);

-- Zorg dat er een 'main' rij bestaat
insert into outlook_settings (id) values ('main') on conflict do nothing;
