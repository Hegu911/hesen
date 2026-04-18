
-- =====================================================================
-- COMPLETE SCHEMA: Profiles, Roles, Products, Canvas Products,
-- Orders, Saved Designs, Design Assets, Storage, Admin auto-seed
-- =====================================================================

-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.design_asset_kind AS ENUM ('sticker', 'template');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  avatar_url  text,
  phone       text,
  address     text,
  referral_code  text NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  referral_level text NOT NULL DEFAULT 'starter',
  referral_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role    public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== has_role() security definer ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ========== PRODUCTS ==========
CREATE TABLE public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  image_url   text,
  stock       integer NOT NULL DEFAULT 0,
  category    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ========== CANVAS PRODUCTS ==========
CREATE TABLE public.canvas_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  base_price   numeric(10,2) NOT NULL DEFAULT 0,
  image_url    text NOT NULL,
  width        text,
  height       text,
  material     text,
  is_available boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canvas_products ENABLE ROW LEVEL SECURITY;

-- ========== ORDERS ==========
CREATE TABLE public.orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number  text NOT NULL UNIQUE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text,
  address       text,
  items         jsonb NOT NULL DEFAULT '[]'::jsonb,
  total         numeric(10,2) NOT NULL DEFAULT 0,
  status        public.order_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ========== SAVED DESIGNS ==========
CREATE TABLE public.saved_designs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id    text NOT NULL,
  template_name  text,
  canvas_json    jsonb NOT NULL,
  preview_url    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;

-- ========== DESIGN ASSETS (stickers + templates uploaded by admin) ==========
CREATE TABLE public.design_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  kind        public.design_asset_kind NOT NULL DEFAULT 'sticker',
  image_url   text NOT NULL,
  category    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;

-- ========== TIMESTAMPS TRIGGER ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at        BEFORE UPDATE ON public.products        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER canvas_products_updated_at BEFORE UPDATE ON public.canvas_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_updated_at          BEFORE UPDATE ON public.orders          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== handle_new_user trigger (creates profile + auto-admin) ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  IF lower(NEW.email) = 'chaplyazerbaijan@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- profiles: users see their own; admins see all; users update their own
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles: users see their own; admins manage all
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"  ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products: public reads active; admins manage all
CREATE POLICY "Anyone views active products" ON public.products FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products"       ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- canvas_products: public reads available; admins manage all
CREATE POLICY "Anyone views available canvas products" ON public.canvas_products FOR SELECT USING (is_available = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage canvas products"          ON public.canvas_products FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- orders: users see own; admins manage all; anyone can insert (checkout)
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone creates orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage orders"  ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders"  ON public.orders FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- saved_designs: users own; admins see all
CREATE POLICY "Users view own designs"   ON public.saved_designs FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own designs" ON public.saved_designs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own designs" ON public.saved_designs FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- design_assets: public read of active; admin manage
CREATE POLICY "Anyone views active design assets" ON public.design_assets FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage design assets"       ON public.design_assets FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('design-assets', 'design-assets', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Public read
CREATE POLICY "Public read design-assets"  ON storage.objects FOR SELECT USING (bucket_id = 'design-assets');
CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Admin write design-assets
CREATE POLICY "Admin upload design-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'design-assets'  AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update design-assets" ON storage.objects FOR UPDATE TO authenticated USING      (bucket_id = 'design-assets'  AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete design-assets" ON storage.objects FOR DELETE TO authenticated USING      (bucket_id = 'design-assets'  AND public.has_role(auth.uid(), 'admin'));

-- Admin write product-images
CREATE POLICY "Admin upload product-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update product-images" ON storage.objects FOR UPDATE TO authenticated USING      (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete product-images" ON storage.objects FOR DELETE TO authenticated USING      (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
