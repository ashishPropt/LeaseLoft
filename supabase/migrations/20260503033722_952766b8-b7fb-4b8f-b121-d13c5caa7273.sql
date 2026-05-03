ALTER TABLE public.leases     ADD COLUMN public_slug text UNIQUE;
ALTER TABLE public.properties ADD COLUMN public_slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_public_slug()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END $$;

UPDATE public.leases     SET public_slug = public.gen_public_slug() WHERE public_slug IS NULL;
UPDATE public.properties SET public_slug = public.gen_public_slug() WHERE public_slug IS NULL;

ALTER TABLE public.leases     ALTER COLUMN public_slug SET NOT NULL;
ALTER TABLE public.properties ALTER COLUMN public_slug SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_public_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_slug IS NULL THEN
    NEW.public_slug := public.gen_public_slug();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER leases_set_public_slug
  BEFORE INSERT ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.set_public_slug();

CREATE TRIGGER properties_set_public_slug
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_public_slug();