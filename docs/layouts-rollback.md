# Layouts Beta Rollback

Use this document to disable or remove the Layouts beta while preserving the current stable Job Workspace.

## Preferred immediate rollback: disable only

1. Set `LAYOUTS_BETA_ENABLED=false` in the deployment environment.
2. redeploy the application.
3. Verify the Layouts tab is absent and all existing Job Workspace tabs still work.
4. Leave `job_layouts` and stored previews/exports intact while the beta is evaluated.

This is the safest rollback. It changes no customer/job data and allows the feature to be re-enabled.

## July 2026 version-2 drawing-model rollback

The refined editor writes `document_data.version = 2`. Version 2 adds:

- Portrait/landscape page orientation
- Independent grid visibility and snapping
- Object opacity, rotation, scale, lock state, and layer order
- Highlighter strokes
- Embedded compressed photo objects
- Partial-stroke erase results (one stroke may become several stroke objects)

No database column or table is changed by this editor revision. However, the original
version-1 editor does not understand version-2 JSON. Therefore:

1. The safest rollback remains `LAYOUTS_BETA_ENABLED=false`.
2. Do not deploy the original version-1 editor while version-2 records remain accessible.
3. To restore editing without data loss, deploy the last version-2-compatible application.
4. A code rollback to the version-1 editor requires either restoring a pre-upgrade database
   backup or running a purpose-built JSON downgrade/export process first.
5. PNG/PDF exports are flattened safety copies and cannot reconstruct editable objects.

Opening a version-1 document in the revised editor is non-destructive. It is normalized in
memory and is only written back as version 2 after the user changes the drawing or metadata.
Existing Door and Stairs objects remain readable even though their creation buttons are gone.

## Full code rollback in reverse order

1. Revert the Layouts implementation commit(s), keeping unrelated later work.
2. Remove the Layouts tab/props/rendering from `components/jobs/JobWorkspace.tsx`.
3. Remove Layouts tab parsing and lazy data loading from `app/leads/[id]/page.tsx`.
4. Remove `app/actions/job-layouts.ts`.
5. Remove `lib/services/job-layouts.ts`.
6. Remove `lib/features/layouts-beta.ts`.
7. Remove `components/layouts/`.
8. Remove the Layouts permission keys from `lib/auth/roles.ts`.
9. Remove `LAYOUTS_BETA_ENABLED` from deployment configuration and `.env.example`.
10. Run lint/build and regression-test every pre-existing Job Workspace tab.

## Database rollback

Run only after the feature flag is disabled and the compatible application version is deployed.

```sql
begin;

delete from public.role_permissions
where permission_key in ('layouts.view', 'layouts.manage', 'layouts.archive');

delete from public.permission_definitions
where key in ('layouts.view', 'layouts.manage', 'layouts.archive');

drop table if exists public.job_layouts;

drop function if exists public.set_job_layout_updated_at();

commit;
```

The table drop permanently removes all editable layout models. Export data first if it must be retained.

## Storage cleanup

The feature does not add a bucket. It uses the existing private `job-attachments` bucket.

Optional destructive cleanup:

1. List objects under `{jobId}/layouts/` for each affected job.
2. Confirm the paths are Layouts previews and not normal job files.
3. Remove those preview objects.
4. Do not delete the `job-attachments` bucket.

PNG/PDF exports saved through Job Files are normal `job_attachments` records. Keep them unless the business explicitly requests their deletion. Removing them should use the existing attachment deletion workflow so metadata and storage remain consistent.

## Data migration implications

- Disabling the flag is non-destructive.
- Reverting application code is non-destructive if the table/storage remain.
- Reverting specifically to the version-1 editor is not compatible with saved version-2 JSON.
- Dropping `job_layouts` permanently removes editable drawings.
- Removing preview objects permanently removes previews but not editable JSON until the table is dropped.
- Saved PNG/PDF exports remain ordinary Job Files and are independent of the Layouts table.
- Existing jobs, customers, tasks, appointments, files, photos, messages, and activities are not migrated by this feature.

## Rollback verification

- [ ] `LAYOUTS_BETA_ENABLED=false`.
- [ ] Layouts tab is absent.
- [ ] Direct `?tab=layouts` resolves to Overview.
- [ ] Layout actions reject requests while disabled.
- [ ] Overview loads.
- [ ] Timeline loads.
- [ ] Tasks load and can be changed.
- [ ] Calendar loads and appointments can be changed.
- [ ] Files and Photos load and upload.
- [ ] Communications load.
- [ ] Existing job attachments remain accessible.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Recovery / re-enable

If the database migration and data were retained:

1. Deploy the Layouts-compatible application version.
2. Set `LAYOUTS_BETA_ENABLED=true`.
3. Verify permission definitions and role grants.
4. Open a known saved layout and confirm its editable model and preview.
5. Test an autosave and export before reopening access to the full beta group.

For records upgraded to document version 2, recovery must use a version-2-compatible build.
