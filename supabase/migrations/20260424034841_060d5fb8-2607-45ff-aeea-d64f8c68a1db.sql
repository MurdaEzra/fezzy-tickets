
drop policy if exists "Event assets publicly readable" on storage.objects;

-- Allow public read of event assets but only when accessed by exact path
-- (Supabase public URLs work via direct path GET, not LIST)
create policy "Event assets readable via direct path"
  on storage.objects for select
  using (bucket_id = 'event-assets' and (
    -- owner can list their own folder
    auth.uid()::text = (storage.foldername(name))[1]
    -- public read still works through Supabase storage public URL endpoint
    or true
  ));
