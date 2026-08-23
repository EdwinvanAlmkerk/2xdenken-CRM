-- ── Storage-policies voor bucket 'dossier-bestanden' ────────────
-- Bijlagen bij dossiers, facturen én inkoopfacturen worden opgeslagen in de
-- bucket 'dossier-bestanden', met de record-id als eerste map (bv.
-- "<inkoopfactuur-id>/<timestamp>_bestand.pdf"). Een eerdere policy stond
-- uploads waarschijnlijk alleen toe voor bestaande dossier-mappen, waardoor
-- een bijlage bij een inkoopfactuur faalde met:
--   403 "new row violates row-level security policy".
--
-- Deze policies staan ingelogde (authenticated) gebruikers toe om objecten in
-- deze bucket te lezen, uploaden, wijzigen en verwijderen. Dat past bij het
-- vertrouwensmodel van de app: alle ingelogde gebruikers zijn eigen personeel
-- en zien toch al alle dossiers/facturen. Bestaande policies blijven bestaan
-- (permissive policies worden met OR gecombineerd), dus dit verruimt alleen.

drop policy if exists "dossier_bestanden_auth_select" on storage.objects;
create policy "dossier_bestanden_auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'dossier-bestanden');

drop policy if exists "dossier_bestanden_auth_insert" on storage.objects;
create policy "dossier_bestanden_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dossier-bestanden');

drop policy if exists "dossier_bestanden_auth_update" on storage.objects;
create policy "dossier_bestanden_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'dossier-bestanden')
  with check (bucket_id = 'dossier-bestanden');

drop policy if exists "dossier_bestanden_auth_delete" on storage.objects;
create policy "dossier_bestanden_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dossier-bestanden');
