-- Nouvelles équipes : Bureau Direction et Service Commande
alter table public.employees drop constraint if exists employees_team_check;
alter table public.employees add constraint employees_team_check
  check (team in ('chauf', 'prep', 'bureau', 'commande'));
