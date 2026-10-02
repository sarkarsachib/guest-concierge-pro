create extension if not exists pgcrypto with schema extensions;

-- ========== Core tenant tables ==========
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  currency text not null default 'INR',
  tax_rate numeric not null default 0.05,
  approval_threshold numeric not null default 2000,
  modules jsonb not null default '{}'::jsonb,
  info jsonb not null default '{}'::jsonb,
  ai_rules text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.hotels to anon, authenticated;
grant all on public.hotels to service_role;
alter table public.hotels enable row level security;
create policy "Hotels are public" on public.hotels for select to anon, authenticated using (true);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  number text not null,
  room_type text not null default 'Deluxe',
  unique (hotel_id, number)
);
grant select on public.rooms to authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  code text not null,
  primary_guest_name text not null,
  check_in timestamptz not null,
  check_out timestamptz not null,
  status text not null default 'active',
  room_charge_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hotel_id, code)
);
grant select on public.stays to authenticated;
grant all on public.stays to service_role;
alter table public.stays enable row level security;

create table public.stay_guests (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  user_id uuid not null,
  display_name text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (stay_id, user_id)
);
grant select on public.stay_guests to authenticated;
grant all on public.stay_guests to service_role;
alter table public.stay_guests enable row level security;

-- Server-only credential tables (no client grants)
create table public.guest_invites (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  token_hash text unique not null,
  label text,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
grant all on public.guest_invites to service_role;
alter table public.guest_invites enable row level security;

create table public.room_qr_codes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_hash text unique not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
grant all on public.room_qr_codes to service_role;
alter table public.room_qr_codes enable row level security;

create table public.verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);
grant all on public.verification_attempts to service_role;
alter table public.verification_attempts enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid,
  actor_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- ========== Membership helper ==========
create or replace function public.is_stay_member(_stay_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.stay_guests g join public.stays s on s.id = g.stay_id
    where g.stay_id = _stay_id and g.user_id = auth.uid() and s.status = 'active'
  )
$$;

create policy "Members read their stay" on public.stays for select to authenticated using (public.is_stay_member(id));
create policy "Members read co-guests" on public.stay_guests for select to authenticated using (public.is_stay_member(stay_id));
create policy "Members read their room" on public.rooms for select to authenticated
  using (exists (select 1 from public.stays s where s.room_id = rooms.id and public.is_stay_member(s.id)));

-- ========== Commerce ==========
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  sort int not null default 0
);
grant select on public.menu_categories to anon, authenticated;
grant all on public.menu_categories to service_role;
alter table public.menu_categories enable row level security;
create policy "Menu categories public" on public.menu_categories for select to anon, authenticated using (true);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric not null,
  is_veg boolean not null default false,
  image_key text,
  tags text[] not null default '{}',
  options jsonb not null default '[]'::jsonb,
  available boolean not null default true,
  sort int not null default 0
);
grant select on public.menu_items to anon, authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "Menu items public" on public.menu_items for select to anon, authenticated using (true);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  module text not null,
  name text not null,
  description text not null default '',
  price numeric not null default 0,
  duration_minutes int,
  available boolean not null default true,
  sort int not null default 0
);
grant select on public.catalog_items to anon, authenticated;
grant all on public.catalog_items to service_role;
alter table public.catalog_items enable row level security;
create policy "Catalog public" on public.catalog_items for select to anon, authenticated using (true);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  payer_guest_id uuid not null references public.stay_guests(id),
  destination_room_id uuid not null references public.rooms(id),
  status text not null default 'received',
  status_history jsonb not null default '[]'::jsonb,
  subtotal numeric not null,
  tax numeric not null,
  total numeric not null,
  payment_method text not null default 'room',
  notes text,
  source text not null default 'browse',
  idempotency_key text unique not null,
  created_at timestamptz not null default now()
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Members read stay orders" on public.orders for select to authenticated using (public.is_stay_member(stay_id));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id),
  name text not null,
  qty int not null,
  unit_price numeric not null,
  options jsonb not null default '[]'::jsonb,
  line_total numeric not null
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "Members read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.is_stay_member(o.stay_id)));

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid not null references public.stay_guests(id),
  destination_room_id uuid not null references public.rooms(id),
  module text not null,
  title text not null,
  details text,
  catalog_item_id uuid references public.catalog_items(id),
  scheduled_for timestamptz,
  amount numeric not null default 0,
  status text not null default 'received',
  status_history jsonb not null default '[]'::jsonb,
  assigned_to text,
  source text not null default 'app',
  created_at timestamptz not null default now()
);
grant select on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;
create policy "Members read stay requests" on public.service_requests for select to authenticated using (public.is_stay_member(stay_id));

create table public.folio_charges (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric not null,
  source_type text,
  source_id uuid,
  charged_by_guest_id uuid references public.stay_guests(id),
  created_at timestamptz not null default now()
);
grant select on public.folio_charges to authenticated;
grant all on public.folio_charges to service_role;
alter table public.folio_charges enable row level security;
create policy "Members read folio" on public.folio_charges for select to authenticated using (public.is_stay_member(stay_id));

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid references public.stay_guests(id) on delete set null,
  title text not null,
  location text,
  category text not null default 'plan',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.itinerary_items to authenticated;
grant all on public.itinerary_items to service_role;
alter table public.itinerary_items enable row level security;
create policy "Members read itinerary" on public.itinerary_items for select to authenticated using (public.is_stay_member(stay_id));

create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  stay_id uuid not null references public.stays(id) on delete cascade,
  guest_id uuid not null references public.stay_guests(id),
  reason text not null,
  transcript jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select on public.escalations to authenticated;
grant all on public.escalations to service_role;
alter table public.escalations enable row level security;
create policy "Members read own escalations" on public.escalations for select to authenticated using (public.is_stay_member(stay_id));

create table public.concierge_threads (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid unique not null references public.stay_guests(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
grant all on public.concierge_threads to service_role;
alter table public.concierge_threads enable row level security;

alter publication supabase_realtime add table public.service_requests;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.folio_charges;
alter publication supabase_realtime add table public.itinerary_items;

-- ========== Seed: Beach View ==========
do $$
declare
  h uuid; r105 uuid; s uuid; c_start uuid; c_main uuid; c_bev uuid; c_des uuid;
begin
  insert into public.hotels (slug, name, tagline, approval_threshold, modules, info, ai_rules) values (
    'beach-view', 'Beach View', 'Oceanfront rooms on the Goa coast', 2000,
    '{"restaurant":true,"room_service":true,"housekeeping":true,"spa":true,"laundry":true,"minibar":true,"taxi":true,"experiences":true,"celebrations":true,"maintenance":true,"concierge":true,"ai_concierge":true}'::jsonb,
    jsonb_build_object(
      'wifi', jsonb_build_object('network','BeachView-Guest','password','sunset2026'),
      'contacts', jsonb_build_array(
        jsonb_build_object('name','Reception','phone','+91 832 000 0100'),
        jsonb_build_object('name','Emergency / Security','phone','+91 832 000 0911'),
        jsonb_build_object('name','Doctor on call','phone','+91 832 000 0122')),
      'facilities', jsonb_build_array(
        jsonb_build_object('name','Infinity pool','hours','7:00 – 21:00'),
        jsonb_build_object('name','The Tide restaurant','hours','7:00 – 23:00'),
        jsonb_build_object('name','Salt Spa','hours','9:00 – 20:00'),
        jsonb_build_object('name','Gym','hours','24 hours')),
      'local_guide', jsonb_build_array(
        jsonb_build_object('name','Candolim Beach','kind','Beach','distance_km',0.2,'note','Right outside. Calm water before 11am.'),
        jsonb_build_object('name','Fort Aguada','kind','Sight','distance_km',4,'note','17th-century fort, best at sunset (~18:20).'),
        jsonb_build_object('name','Fisherman''s Wharf','kind','Dinner','distance_km',6,'note','Goan seafood, ~₹1,800 for two.'),
        jsonb_build_object('name','Saturday Night Market, Arpora','kind','Shopping','distance_km',9,'note','Saturdays 18:00 onwards.'),
        jsonb_build_object('name','Sinquerim water sports','kind','Experience','distance_km',3,'note','Parasailing ~₹1,500 per person.'))
    ),
    E'Never promise services that are not in the catalog or menu.\nAlways propose charges and let the guest confirm; never claim something is booked until the system confirms it.\nEscalate emergencies, complaints and anything medical to reception immediately.\nUse a warm, professional tone. Keep replies short.'
  ) returning id into h;

  insert into public.rooms (hotel_id, number, room_type)
    select h, n::text, case when n >= 108 then 'Sea Suite' else 'Deluxe Sea View' end from generate_series(101,110) n;
  select id into r105 from public.rooms where hotel_id = h and number = '105';

  insert into public.stays (hotel_id, room_id, code, primary_guest_name, check_in, check_out)
    values (h, r105, '84721', 'Om Rai', now() - interval '1 day', now() + interval '2 days') returning id into s;

  insert into public.guest_invites (stay_id, token_hash, label, max_uses, expires_at)
    values (s, encode(extensions.digest('bv-demo-105-om', 'sha256'), 'hex'), 'Demo personal link', 100, now() + interval '30 days');
  insert into public.room_qr_codes (hotel_id, room_id, token_hash)
    values (h, r105, encode(extensions.digest('bv-qr-105', 'sha256'), 'hex'));

  insert into public.folio_charges (hotel_id, stay_id, category, description, amount, created_at) values
    (h, s, 'Room', 'Deluxe Sea View · 3 nights', 18000, now() - interval '1 day');

  insert into public.menu_categories (hotel_id, name, sort) values (h, 'Starters', 1) returning id into c_start;
  insert into public.menu_categories (hotel_id, name, sort) values (h, 'Mains', 2) returning id into c_main;
  insert into public.menu_categories (hotel_id, name, sort) values (h, 'Desserts', 3) returning id into c_des;
  insert into public.menu_categories (hotel_id, name, sort) values (h, 'Drinks', 4) returning id into c_bev;

  insert into public.menu_items (hotel_id, category_id, name, description, price, is_veg, image_key, tags, options, sort) values
    (h, c_start, 'Prawn Rava Fry', 'Semolina-crusted tiger prawns, kokum aioli', 520, false, 'prawns', '{seafood,goan}', '[]', 1),
    (h, c_start, 'Paneer Tikka', 'Charred cottage cheese, mint chutney', 380, true, 'paneer', '{grill}',
      '[{"group":"Spice","required":true,"multi":false,"choices":[{"name":"Mild","price":0},{"name":"Medium","price":0},{"name":"Hot","price":0}]}]', 2),
    (h, c_start, 'Masala Fries', 'Crisp fries, chaat masala, lime', 220, true, null, '{snack,kids}', '[]', 3),
    (h, c_main, 'Butter Chicken', 'Tandoori chicken in silky tomato-butter gravy', 480, false, 'butter-chicken', '{north-indian,popular}',
      '[{"group":"Portion","required":true,"multi":false,"choices":[{"name":"Regular","price":0},{"name":"Large","price":160}]},{"group":"Add-ons","required":false,"multi":true,"choices":[{"name":"Butter naan","price":80},{"name":"Jeera rice","price":120}]}]', 1),
    (h, c_main, 'Chicken Biryani', 'Dum-cooked basmati, raita, salan', 450, false, 'biryani', '{popular}',
      '[{"group":"Add-ons","required":false,"multi":true,"choices":[{"name":"Extra raita","price":40},{"name":"Boiled egg","price":30}]}]', 2),
    (h, c_main, 'Goan Fish Curry', 'Kingfish, coconut-kokum curry, red rice', 620, false, 'fish-curry', '{seafood,goan,signature}', '[]', 3),
    (h, c_main, 'Dal Makhani', 'Slow-cooked black lentils, cream', 340, true, null, '{north-indian}', '[]', 4),
    (h, c_main, 'Margherita Pizza', 'Wood-fired, buffalo mozzarella, basil', 420, true, null, '{kids}', '[]', 5),
    (h, c_des, 'Bebinca', 'Layered Goan coconut pudding, vanilla ice cream', 260, true, 'bebinca', '{goan,signature}', '[]', 1),
    (h, c_des, 'Chocolate Lava Cake', 'Warm centre, berry compote', 290, true, null, '{}', '[]', 2),
    (h, c_bev, 'Coke', '330 ml can', 90, true, null, '{cold}', '[]', 1),
    (h, c_bev, 'Fresh Lime Soda', 'Sweet, salted or mixed', 140, true, null, '{cold}',
      '[{"group":"Style","required":true,"multi":false,"choices":[{"name":"Sweet","price":0},{"name":"Salted","price":0},{"name":"Mixed","price":0}]}]', 2),
    (h, c_bev, 'Tender Coconut', 'Straight from the shell', 120, true, null, '{cold,local}', '[]', 3),
    (h, c_bev, 'Masala Chai', 'Brewed with ginger and cardamom', 110, true, null, '{hot}', '[]', 4);

  insert into public.catalog_items (hotel_id, module, name, description, price, duration_minutes, sort) values
    (h, 'housekeeping', 'Fresh towels', 'Bath and hand towels', 0, null, 1),
    (h, 'housekeeping', 'Room cleaning', 'Full room service', 0, null, 2),
    (h, 'housekeeping', 'Extra pillows', 'Two pillows', 0, null, 3),
    (h, 'housekeeping', 'Toiletries refill', 'Shampoo, soap, dental kit', 0, null, 4),
    (h, 'spa', 'Aromatherapy massage', 'Full body, essential oils', 3400, 60, 1),
    (h, 'spa', 'Balinese deep tissue', 'Firm pressure massage', 3800, 75, 2),
    (h, 'spa', 'Couples ritual', 'Side-by-side massage for two', 6200, 90, 3),
    (h, 'laundry', 'Wash & fold (per kg)', 'Back in 24 hours', 250, null, 1),
    (h, 'laundry', 'Express pressing (per item)', 'Back in 3 hours', 90, null, 2),
    (h, 'taxi', 'Airport drop (GOI)', 'Sedan, up to 4 guests', 1800, 60, 1),
    (h, 'taxi', 'Panjim city ride', 'Sedan, one way', 900, 40, 2),
    (h, 'experiences', 'Sunset cruise', 'Mandovi river, 1 hour, per person', 1200, 60, 1),
    (h, 'experiences', 'Spice plantation tour', 'Half day with lunch, per person', 1600, 240, 2),
    (h, 'experiences', 'Dolphin spotting boat', 'Morning boat ride, per person', 800, 90, 3),
    (h, 'celebrations', 'Room decoration', 'Balloons, petals and lights', 2500, null, 1),
    (h, 'celebrations', 'Celebration cake (1 kg)', 'Chocolate, red velvet or pineapple', 1400, null, 2),
    (h, 'celebrations', 'Flower bouquet', 'Fresh roses and lilies', 900, null, 3),
    (h, 'celebrations', 'Candlelight beach dinner for two', 'Private table on the sand, set menu', 4500, 120, 4),
    (h, 'celebrations', 'Photographer (1 hour)', 'Beach photo session', 3000, 60, 5),
    (h, 'minibar', 'Minibar restock', 'Replenish consumed items', 0, null, 1),
    (h, 'maintenance', 'Report an issue', 'AC, plumbing, lights, TV', 0, null, 1);

  insert into public.itinerary_items (stay_id, title, location, category, starts_at, ends_at) values
    (s, 'Breakfast', 'The Tide', 'dining', date_trunc('day', now()) + interval '3 hours', date_trunc('day', now()) + interval '4 hours');
end $$;