-- Table senarai guru untuk sistem Tempahan Bilik.
-- Asing dari guru_delima (sistem ID DELIMA). Booking link by NAMA string,
-- jadi `nama` dijadikan unique. Jalankan di Supabase → SQL Editor.

create table if not exists guru_tempahan (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  no_telefon text,
  created_at timestamptz default now()
);

-- App guna anon key sahaja (sama macam table lain). Benarkan baca + tulis.
alter table guru_tempahan enable row level security;

create policy "guru_tempahan anon all"
  on guru_tempahan for all
  to anon
  using (true) with check (true);

-- (Pilihan) live-sync antara device:
alter publication supabase_realtime add table guru_tempahan;
