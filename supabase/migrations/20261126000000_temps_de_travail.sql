-- =====================================================================
-- Temps de travail des chauffeurs-livreurs : paramètres réglementaires et
-- modèles enregistrés (contrôle d'une journée, simulation de tournée).
-- Droits : lecture pour tout membre actif ; écriture réservée à
-- l'administrateur (public.is_admin()), appliquée par les règles RLS.
-- Les saisies des autres utilisateurs ne sont jamais enregistrées.
-- =====================================================================

create table if not exists public.worktime_settings (
  id smallint primary key default 1 check (id = 1),
  -- valeurs et textes des règles P1 à P11 ; un objet vide = valeurs par défaut de l'application
  params jsonb not null default '{}'::jsonb,
  rules jsonb not null default '{}'::jsonb,
  verified_on date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid
);
insert into public.worktime_settings (id, verified_on) values (1, date '2026-11-26') on conflict (id) do nothing;

create table if not exists public.worktime_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('controle', 'simulation')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid
);

do $$
declare t text;
begin
  foreach t in array array['worktime_settings', 'worktime_templates'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- la ligne de paramètres ne se supprime pas
drop policy if exists worktime_settings_delete on public.worktime_settings;
