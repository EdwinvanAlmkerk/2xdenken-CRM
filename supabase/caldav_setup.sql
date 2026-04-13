-- Run dit in Supabase Dashboard → SQL Editor
-- Aanmaken caldav_settings tabel voor iCloud/CalDAV koppeling

create table if not exists caldav_settings (
  id text primary key,
  apple_id text,
  app_password text,
  server_url text default 'https://caldav.icloud.com',
  principal_url text,
  calendar_url text,
  calendar_name text,
  updated_at timestamptz default now()
);

-- Zorg dat er een 'main' rij bestaat (net als email_settings)
insert into caldav_settings (id) values ('main') on conflict do nothing;
