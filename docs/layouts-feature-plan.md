# Layouts Beta Feature Plan

Status: Planned beta implementation  
Feature flag: `LAYOUTS_BETA_ENABLED`  
Stable rollback reference: the Git commit immediately before the Layouts implementation

## Purpose

Layouts adds an editable, job-scoped drawing and measurement workspace to the existing Job Workspace. It is intentionally guarded so the current stable workspace can be restored without changing unrelated tabs or records.

## Baseline architecture before Layouts

- Next.js App Router with React Server Components by default.
- Job Workspace route: `app/leads/[id]/page.tsx`.
- Job Workspace client shell: `components/jobs/JobWorkspace.tsx`.
- Existing URL-backed tabs: Overview, Timeline, Tasks, Calendar, Files, Photos, and Communications.
- Heavy tab data is fetched only when its tab is active.
- Service flow: Page → server action/service → Supabase.
- Authentication and permissions are enforced by server services in `lib/services`.
- Files and photos use the private Supabase Storage bucket `job-attachments`.
- Attachment metadata is stored in `public.job_attachments`.
- Signed URLs are generated server-side.
- No drawing/canvas or PDF library is installed.

## Guard and rollout

- New server-only environment flag: `LAYOUTS_BETA_ENABLED=true`.
- Default behavior when missing or false: the Layouts tab is hidden and Layouts actions/services reject use.
- The flag is documented in `.env.example`.
- The feature will be enabled first in a beta environment and only after its migration is applied.

## Database changes

Migration: `supabase/migrations/202607240003_job_layouts_beta.sql`

New table: `public.job_layouts`

- `id uuid` primary key
- `job_id uuid` references `public.jobs(id)` with cascade delete
- `name text`
- `document_data jsonb` stores the editable vector drawing model
- `page_count integer`
- `preview_storage_path text` stores an optional rendered preview path separately from the editable model
- `created_by_employee_id uuid`
- `updated_by_employee_id uuid`
- `created_at timestamptz`
- `updated_at timestamptz`
- `archived_at timestamptz`
- `archived_by_employee_id uuid`

Indexes:

- Active layouts by job and update time
- Layout creator

New permission definitions:

- `layouts.view`
- `layouts.manage`
- `layouts.archive`

Default role grants follow the current attachment model:

- All active employee roles may view.
- Administrator, sales manager, salesperson, operations manager, installer, and office staff may manage.
- Administrator, sales manager, and operations manager may archive.

RLS policies protect reads and writes for authenticated active employees with matching permissions. The application still performs mutations through authenticated server services.

## Storage changes

No new bucket is introduced.

The existing private `job-attachments` bucket is reused:

- Editable drawing data remains in `job_layouts.document_data`.
- Rendered previews use `{jobId}/layouts/{layoutId}/preview.png`.
- Explicit PNG/PDF exports saved to Job Files use the existing attachment upload service and create normal `job_attachments` records.

This separation keeps editable data independent of previews and exported files.

## Routes and Job Workspace integration

No standalone public route is introduced.

- Existing job route gains `?tab=layouts`.
- The server route only loads layouts and layout permissions when that tab is active.
- `JobWorkspace` gains one compact browser-style Layouts tab.
- All existing workspace tabs and their layouts remain unchanged.
- The editor Client Component is lazy-loaded with `next/dynamic`.

## New application files

Planned:

- `lib/features/layouts-beta.ts`
- `lib/services/job-layouts.ts`
- `app/actions/job-layouts.ts`
- `app/api/jobs/[id]/layouts/[layoutId]/preview/route.ts`
- `components/layouts/types.ts`
- `components/layouts/LayoutWorkspace.tsx`
- `components/layouts/LayoutEditor.tsx`
- `components/layouts/layout-renderer.ts`
- `components/layouts/offline-store.ts`
- `components/layouts/pdf-export.ts`
- `supabase/migrations/202607240001_job_layouts_beta.sql`

Modified:

- `.env.example`
- `lib/auth/roles.ts`
- `app/leads/[id]/page.tsx`
- `components/jobs/JobWorkspace.tsx`

## Dependencies

No new npm dependency is planned.

- Drawing uses the native Canvas 2D and Pointer Events APIs.
- Apple Pencil is supported through browser Pointer Events where Safari exposes pen input.
- Offline drafts use IndexedDB.
- PNG export uses `HTMLCanvasElement.toBlob`.
- PDF export uses a small local browser-side PDF encoder around rendered JPEG pages.

## Editable document model

Each layout stores a versioned JSON document:

- Document version
- Active page
- Page list
- Page name and dimensions
- Grid settings
- Vector objects: freehand strokes, straight lines, rectangles, text, dimension lines, and symbols
- Object color, thickness, coordinates, and tool-specific metadata

Rendered preview images and exported files are derived artifacts and are not required to reopen or edit a layout.

## Phase 1 scope

- Multiple layouts per job
- Pen input for mouse, touch, and Apple Pencil-capable browsers
- Color and line thickness
- Eraser
- Undo and redo
- Straight lines and rectangles
- Text labels
- Pan and zoom
- Debounced autosave
- Editable persistence
- PNG export
- Multi-page PDF export
- Save exports into Job Files

## Phase 2 scope

- Dimension lines with feet/inches labels
- Room labels
- Door, stairs, and transition symbols
- Grid snapping
- Multiple pages
- Layout templates
- Offline field mode

Offline field mode stores an active layout draft and queued save in IndexedDB. When connectivity returns, the newest local revision is synchronized through the normal server action. Explicit Job Files uploads require connectivity.

## Explicitly excluded

- Automatic square-foot calculations
- Waste-factor calculations
- Plan scaling or scale calibration
- Version comparison
- Other previously proposed Phase 3 functionality

## Autosave safety

- Local IndexedDB save occurs before/dependent alongside remote autosave.
- Remote saves are debounced.
- Each save includes the client’s last known `updated_at`.
- The service rejects a stale save instead of silently overwriting a newer remote revision.
- The editor shows Saving, Saved, Offline, and Conflict/Error states.
- Reconnect retries the newest queued local draft.

## Data migration implications

- Existing jobs, attachments, and workspace data are not rewritten.
- The migration only adds the new table, permissions, policies, and indexes.
- Disabling the flag leaves saved layout data intact but inaccessible through the UI.
- Dropping the table permanently deletes editable layout models.
- Removing generated preview/export objects must be handled separately during a destructive rollback.

## Known beta limitations

- Apple Pencil pressure and palm rejection vary by iPadOS/Safari version.
- Offline editing requires the layout to have been opened or created online at least once.
- Concurrent editing is conflict-detected, not collaboratively merged.
- Eraser removes intersected vector objects/strokes; it is not a pixel-level bitmap eraser.
- Text entry uses a compact dialog rather than rich text.
- PDF output is flattened and not editable.
- Imported PDF/photo backgrounds are not part of this beta.
- Browser storage can be evicted by the operating system; remote autosave remains the durable source.

## Testing checklist

### Feature guard

- [ ] Flag absent/false hides Layouts and rejects actions.
- [ ] Flag true exposes Layouts only after migration.
- [ ] Other Job Workspace tabs are unchanged.

### Permissions and security

- [ ] Active employees with `layouts.view` can list/open layouts.
- [ ] Employees without `layouts.manage` cannot create or save.
- [ ] Employees without `layouts.archive` cannot archive.
- [ ] Signed preview URLs expire.
- [ ] Cross-job access is rejected.

### Drawing

- [ ] Mouse drawing works on desktop.
- [ ] Touch drawing works on iPad.
- [ ] Apple Pencil produces pointer input where supported.
- [ ] Pen color and thickness persist.
- [ ] Eraser, undo, and redo work.
- [ ] Line, rectangle, text, dimension, room label, and symbols render.
- [ ] Grid snapping works when enabled.
- [ ] Pan, wheel zoom, and pinch zoom do not scroll the surrounding page.

### Persistence and offline

- [ ] Multiple layouts can be created per job.
- [ ] Multiple pages persist.
- [ ] Autosave shows correct state.
- [ ] Refresh restores the editable model.
- [ ] Offline edits survive refresh and synchronize on reconnect.
- [ ] A stale concurrent save reports a conflict without data loss.

### Export

- [ ] Active page exports as PNG.
- [ ] All pages export as PDF.
- [ ] PNG/PDF can be saved into Job Files.
- [ ] Exported attachments appear in the existing Files tab.

### Regression

- [ ] Overview, Timeline, Tasks, Calendar, Files, Photos, and Communications behave as before.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
