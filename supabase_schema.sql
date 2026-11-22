-- ============================================================================
-- AWAREMIND GROWTH SPACE — SUPABASE PRODUCTION SCHEMA (ZERO N8N)
-- Jalankan seluruh script ini di Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. PROFILES (Otomatis dibuat saat user Login Google / Magic Link Email)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  is_premium boolean not null default false,
  streak int not null default 1,
  level_day int not null default 1,
  pin_code text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. APP SETTINGS (Link Grup WA Pembeli & QRIS Dinamis)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('wa_group_url', 'https://chat.whatsapp.com/GANTI_DENGAN_LINK_GRUP_WA_ASLI'),
  ('qris_image_url', ''),
  ('dana_number', '08XX-XXXX-XXXX (a.n. AwareMind Growth Space)')
on conflict (key) do nothing;

-- 3. PRODUCTS (Katalog 6 Ruang + Bundling — bisa ditambah lewat /admin)
create table if not exists public.products (
  id text primary key,
  space text not null,
  tag text not null default 'Toolkit',
  title text not null,
  format text not null default 'PDF',
  format_label text not null default 'PDF Interaktif',
  price int not null check (price >= 0),
  description text,
  contents jsonb not null default '[]'::jsonb,
  banner_url text,
  access_url text not null default '',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. ORDERS (Transaksi QRIS / DANA + Kode Referral 5% + Bukti Bayar)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  buyer_name text,
  items jsonb not null,
  subtotal int not null,
  referral_code text,
  discount_amount int not null default 0,
  total_amount int not null,
  pay_method text not null default 'QRIS' check (pay_method in ('QRIS', 'DANA')),
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- 5. USER LIBRARY (Akses Lifetime Produk per Akun)
create table if not exists public.user_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  product_title text not null,
  product_meta text,
  access_url text,
  unlocked_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- 6. JOURNALS (Refleksi Harian, Mood 1-5, Mode Jurnal, Crisis Flag)
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  space text not null,
  mode text not null default 'Tulis Bebas',
  mood_val int not null check (mood_val between 1 and 5),
  mood_label text not null,
  content text not null,
  is_crisis_flagged boolean not null default false,
  created_at timestamptz not null default now()
);

-- 7. SESSION BOOKINGS (HealMind Gratis & 1-on-1 Mentoring)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  session_title text not null,
  session_type text not null check (session_type in ('HealMind', 'Mentoring')),
  slot_label text not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.user_library enable row level security;
alter table public.journals enable row level security;
alter table public.bookings enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles (HARDENED: user biasa TIDAK BISA ubah role atau is_premium sendiri!)
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "Users update own safe fields" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_premium = (select p.is_premium from public.profiles p where p.id = auth.uid())
  );
create policy "Admins manage all profiles" on public.profiles for all using (public.is_admin());

-- Products (Publik hanya lihat katalog tanpa membocorkan link file jika ingin dipisah ke product_secrets)
create policy "Public read active products" on public.products for select using (is_active = true or public.is_admin());
create policy "Admins manage products" on public.products for all using (public.is_admin());

-- Settings (HARDENED: Link Grup WA hanya bisa dibaca pembeli yang sudah PAID atau Admin!)
create policy "Paid buyers or admins read private settings" on public.app_settings
  for select using (
    key <> 'wa_group_url'
    or public.is_admin()
    or exists (
      select 1 from public.orders o where o.user_id = auth.uid() and o.status = 'paid'
    )
  );
create policy "Admins manage settings" on public.app_settings for all using (public.is_admin());

-- Orders
create policy "Users create own orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Users read own orders" on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins update orders" on public.orders for update using (public.is_admin());

-- Library
create policy "Users read own library" on public.user_library for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins insert library" on public.user_library for insert with check (public.is_admin());

-- Journals
create policy "Users manage own journals" on public.journals for all using (auth.uid() = user_id);

-- Bookings
create policy "Users manage own bookings" on public.bookings for all using (auth.uid() = user_id or public.is_admin());

-- Milestone Komunitas RPC (Aman tanpa membocorkan data pembeli)
create or replace function public.get_milestone_count()
returns int language sql security definer as $$
  select least(100, count(distinct buyer_email)::int)
  from public.orders
  where status = 'paid';
$$;

-- ============================================================================
-- STORAGE BUCKETS (Jalankan atau buat via menu Storage di Supabase)
-- ============================================================================
insert into storage.buckets (id, name, public) values ('product-banners', 'product-banners', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('product-files', 'product-files', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', true) on conflict do nothing;

-- ============================================================================
-- JADIKAN EMAIL TIM SEBAGAI ADMIN (Ganti dengan email Google milik Fatih & Sofi)
-- ============================================================================
-- update public.profiles set role = 'admin' where email in ('email-fatih@gmail.com', 'sofi.collage@gmail.com');
