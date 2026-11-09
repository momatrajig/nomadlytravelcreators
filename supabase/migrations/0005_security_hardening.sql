-- Supabase advisor fixes: view runs with the caller's rights, functions pin search_path,
-- the creator lookup is not callable anonymously (RLS policies still use it for signed in creators).
alter view public.latest_price_checks set (security_invoker = true);
alter function public.set_updated_at() set search_path = public;
alter function public.check_booking_ledger() set search_path = public;
revoke execute on function public.current_creator_id() from public, anon;
grant execute on function public.current_creator_id() to authenticated;
