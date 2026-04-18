
-- Fix 1: search_path for set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: tighten orders insert policy
DROP POLICY IF EXISTS "Anyone creates orders" ON public.orders;
CREATE POLICY "Authenticated users create own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow guest checkout (anonymous) to insert orders without user_id
CREATE POLICY "Guests create orders without user_id"
ON public.orders FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Fix 3 & 4: restrict bucket listing to admins only (individual file URLs still work publicly)
DROP POLICY IF EXISTS "Public read design-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;

-- Allow public read of individual files only (no listing)
-- We do this by allowing SELECT only when name is provided (specific path)
-- The cleanest way: keep public select but advise via comment.
-- Actually, public buckets use public.bucket setting for direct file URLs;
-- objects RLS only restricts listing/queries via the API.
-- Solution: let only admins query objects, but file downloads via public URL still work
-- because public buckets bypass RLS for direct file access.
CREATE POLICY "Admins list design-assets" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'design-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins list product-images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
