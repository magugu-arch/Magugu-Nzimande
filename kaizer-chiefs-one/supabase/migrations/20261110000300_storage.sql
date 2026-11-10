-- Private storage for Fan Moments media. Files live under "<user id>/<post id>/<file>".
-- Nothing in this bucket is public: approved media is served through
-- short-lived signed URLs created by a server function.

insert into storage.buckets (id, name, public)
values ('fan-media', 'fan-media', false)
on conflict (id) do nothing;

create policy "fan media: upload into your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fan-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fan media: read your own files; moderators read all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fan-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or private.has_permission('moderation.read'))
  );

create policy "fan media: delete your own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fan-media' and (storage.foldername(name))[1] = auth.uid()::text);
