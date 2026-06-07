-- =====================================================================
--  PEMBAIKAN KESELAMATAN RLS — Sistem Dashboard ICT SK Darau
--  Jalankan SEKALI di Supabase -> SQL Editor (run keseluruhan fail).
--
--  Model: anon key adalah PUBLIC (tertanam dalam bundle). RLS = satu-satunya
--  perlindungan. authenticated = admin yang login (Supabase Auth).
--
--  Dasar:
--   - murid_delima, guru_delima, penyelenggaraan_ict, log_ict  -> ADMIN sahaja
--   - tempahan_bilik   -> anon BACA + MOHON(pending); ubah/padam = admin
--   - peminjaman_ict   -> anon BACA + PINJAM(dipinjam); ubah/padam = admin
--   - bilik_khas, bilik_tutup, takwim_ict, guru_tempahan,
--     app_settings, barang_ict -> anon BACA sahaja; tulis = admin
-- =====================================================================

-- 1) Buang SEMUA policy sedia ada pada 12 table (mula bersih)
do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_settings','barang_ict','bilik_khas','bilik_tutup',
        'guru_delima','guru_tempahan','log_ict','murid_delima',
        'peminjaman_ict','penyelenggaraan_ict','takwim_ict','tempahan_bilik')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Pastikan RLS HIDUP pada semua table
alter table public.app_settings        enable row level security;
alter table public.barang_ict          enable row level security;
alter table public.bilik_khas          enable row level security;
alter table public.bilik_tutup         enable row level security;
alter table public.guru_delima         enable row level security;
alter table public.guru_tempahan       enable row level security;
alter table public.log_ict             enable row level security;
alter table public.murid_delima        enable row level security;
alter table public.peminjaman_ict      enable row level security;
alter table public.penyelenggaraan_ict enable row level security;
alter table public.takwim_ict          enable row level security;
alter table public.tempahan_bilik      enable row level security;

-- 3) ADMIN sahaja (tiada akses anon langsung) ---------------------------
create policy "admin all" on public.murid_delima
  for all to authenticated using (true) with check (true);
create policy "admin all" on public.guru_delima
  for all to authenticated using (true) with check (true);
create policy "admin all" on public.penyelenggaraan_ict
  for all to authenticated using (true) with check (true);
create policy "admin all" on public.log_ict
  for all to authenticated using (true) with check (true);

-- 4) anon BACA sahaja + admin tulis ------------------------------------
do $$
declare t text;
begin
  foreach t in array array['bilik_khas','bilik_tutup','takwim_ict',
                           'guru_tempahan','app_settings','barang_ict']
  loop
    execute format('create policy "anon read" on public.%I for select to anon using (true)', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 5) tempahan_bilik: anon baca + mohon (pending sahaja); admin penuh ----
create policy "anon read" on public.tempahan_bilik
  for select to anon using (true);
create policy "anon mohon pending" on public.tempahan_bilik
  for insert to anon with check (status = 'pending');
create policy "admin all" on public.tempahan_bilik
  for all to authenticated using (true) with check (true);

-- 6) peminjaman_ict: anon baca + pinjam (dipinjam sahaja); admin penuh --
create policy "anon read" on public.peminjaman_ict
  for select to anon using (true);
create policy "anon pinjam" on public.peminjaman_ict
  for insert to anon with check (status = 'dipinjam');
create policy "admin all" on public.peminjaman_ict
  for all to authenticated using (true) with check (true);
