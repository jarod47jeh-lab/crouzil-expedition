-- Équipe « Responsables » (responsables d'exploitation, d'expédition…)
alter table public.employees drop constraint if exists employees_team_check;
alter table public.employees add constraint employees_team_check
  check (team in ('resp', 'chauf', 'prep', 'bureau', 'commande'));
