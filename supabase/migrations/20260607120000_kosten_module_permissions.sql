-- Fix permissies voor kostenmodule-tabellen.
-- In sommige omgevingen krijgen nieuw aangemaakte tabellen geen
-- bruikbare rechten voor anon/authenticated of staat RLS nog aan.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kosten_types TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inkoopfacturen TO anon, authenticated;

ALTER TABLE public.kosten_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inkoopfacturen DISABLE ROW LEVEL SECURITY;