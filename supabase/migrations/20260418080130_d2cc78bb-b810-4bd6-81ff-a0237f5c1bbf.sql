INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'goranboyluhsn@gmail.com'
ON CONFLICT DO NOTHING;