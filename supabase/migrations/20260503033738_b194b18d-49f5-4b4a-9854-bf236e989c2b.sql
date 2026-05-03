ALTER TABLE public.leases     ALTER COLUMN public_slug SET DEFAULT public.gen_public_slug();
ALTER TABLE public.properties ALTER COLUMN public_slug SET DEFAULT public.gen_public_slug();