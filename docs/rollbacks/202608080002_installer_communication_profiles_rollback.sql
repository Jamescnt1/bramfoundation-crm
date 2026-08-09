-- Foundation CRM Phase 2 rollback.
-- Removes installer communication contacts without changing installer crews,
-- appointments, jobs, employees, or the Phase 1 communication foundation.

begin;

drop table if exists public.installer_contacts;
drop function if exists public.prepare_installer_contact();

commit;
