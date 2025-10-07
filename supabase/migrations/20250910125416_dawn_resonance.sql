@@ .. @@
 drop policy if exists "matches org member crud" on public.matches;
 create policy "matches org member crud" on public.matches
   for select, insert, update, delete to authenticated
-  using (exists (select 1 from public.org_members m where m.org_id = matches.org_id and m.user_id = auth.uid()))
-  with check (exists (select 1 from public.org_members m where m.org_id = matches.org_id and m.user_id = auth.uid()));
+  using (matches.org_id in (select m.org_id from public.org_members m where m.user_id = auth.uid()))
+  with check (matches.org_id in (select m.org_id from public.org_members m where m.user_id = auth.uid()));