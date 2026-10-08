CREATE TYPE public.app_role AS ENUM ('owner','manager','reception','housekeeping','restaurant','spa');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, hotel_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own staff row" ON public.staff_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.knowledge_entries TO service_role;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';

CREATE OR REPLACE FUNCTION public.has_hotel_role(_hotel_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.user_roles r join public.staff_members m on m.user_id = r.user_id and m.hotel_id = r.hotel_id
    where r.user_id = auth.uid() and r.hotel_id = _hotel_id and m.active and r.role = any(_roles)
  )
$$;

CREATE POLICY "Staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.has_hotel_role(hotel_id, ARRAY['owner','manager','reception','restaurant']::public.app_role[]));
CREATE POLICY "Staff read requests" ON public.service_requests FOR SELECT TO authenticated
  USING (public.has_hotel_role(hotel_id, ARRAY['owner','manager','reception','housekeeping','spa']::public.app_role[]));
CREATE POLICY "Staff read escalations" ON public.escalations FOR SELECT TO authenticated
  USING (public.has_hotel_role(hotel_id, ARRAY['owner','manager','reception']::public.app_role[]));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.escalations;
EXCEPTION WHEN others THEN NULL; END $$;