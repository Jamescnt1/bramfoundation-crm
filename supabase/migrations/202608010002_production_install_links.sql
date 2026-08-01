begin;

-- Preserve existing install scheduling work by associating appointments when
-- the relationship is unambiguous: a job has one installation scope, or the
-- appointment's crew scope names the material category/scope.
insert into public.job_material_scope_appointments (material_scope_id, appointment_id)
select scopes.id, appointments.id
from public.job_material_scopes scopes
join public.appointments appointments
  on appointments.job_id = scopes.job_id
 and appointments.appointment_type = 'installation'
 and appointments.status <> 'cancelled'
join public.material_categories categories on categories.id = scopes.material_category_id
where scopes.installation_required
  and (
    (select count(*) from public.job_material_scopes siblings
      where siblings.job_id = scopes.job_id and siblings.installation_required) = 1
    or lower(coalesce(appointments.installation_scope, '')) like '%' || lower(categories.name) || '%'
    or (scopes.description is not null and lower(appointments.installation_scope) like '%' || lower(scopes.description) || '%')
  )
on conflict do nothing;

commit;
