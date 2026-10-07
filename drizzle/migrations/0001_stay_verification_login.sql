alter table public.verification_attempts alter column user_id drop not null;
alter table public.verification_attempts add column if not exists client_key text;
create index if not exists verification_attempts_client_idx on public.verification_attempts (client_key, created_at);
update public.itinerary_items
  set starts_at = (((starts_at at time zone 'Asia/Kolkata')::date + time '08:00') at time zone 'Asia/Kolkata'),
      ends_at = (((starts_at at time zone 'Asia/Kolkata')::date + time '08:00') at time zone 'Asia/Kolkata') + (ends_at - starts_at)
  where title ilike '%breakfast%';