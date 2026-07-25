# Layouts Document Import Feature Plan

Status: Active guarded beta
Feature flag: `LAYOUTS_BETA_ENABLED`  
Stable rollback reference: the Git commit immediately before the Layouts implementation

## July 2026 Note Taker import revision

The active Layouts tab is now a document manager for layouts exported from Note Taker HD.
The browser drawing editor is disabled in the user interface because Pencil latency and
field connectivity did not meet the reliability standard for beta use.

Primary field workflow:

1. Export a PDF or image from Note Taker HD.
2. Save it to iPad Files, preferably in `Foundation Imports`.
3. Open the job's Layouts tab.
4. Select **Import from Note Taker**.
5. Choose the file, confirm its name/room/notes, and save.

Every import is stored once in the private `job-attachments` bucket, creates one normal
`job_attachments` record with category `Layout`, and creates a `job_layouts` metadata record
that references the attachment. It therefore appears in Layouts and Job Files without
duplicating the stored object.

Replacement imports are immutable versions. A new attachment and layout version supersede
the previous version; the latest version is shown by default and history remains available.

Existing drawing records are not migrated or deleted. They are labeled **Legacy drawing**
and remain read-only through their saved preview/export. The prior drawing engine files stay
in the repository for rollback but are no longer loaded by the active Layouts tab.

The import sheet is scrollable on iPhone/iPad Safari. Pending imports are stored as file
blobs plus metadata in IndexedDB when offline or after a failed connection, and retry when
the browser returns online. iOS may evict browser storage under pressure, so queued imports
are a recovery aid; the original Note Taker export in Files remains the source safety copy.

Supported imports: PDF, JPG/JPEG, PNG, WEBP, HEIC, and HEIF, up to 50 MB.

Migration: `supabase/migrations/202607250001_layout_document_imports.sql`

New metadata fields include attachment reference, room/area, notes, record kind, version,
superseded-layout reference, and latest-version status.

## Legacy July 2026 editor revision

This revision keeps the existing Job Workspace integration and database table, but upgrades
the editable drawing document from version 1 to version 2.

- Portrait (`900 × 1400`) is the default page orientation.
- Landscape (`1400 × 900`) remains available when a layout is created and while it is edited.
- Full-screen drawing visually removes all CRM chrome using an in-app fixed, full-viewport
  mode. It deliberately avoids Safari's native Fullscreen API so downward Pencil strokes
  cannot trigger the browser's swipe-to-close gesture.
- The page automatically fits and remains centered in the gray drawing workspace. Users can
  zoom with explicit controls, a mouse wheel, or a two-finger pinch; the page itself is not
  draggable.
- The editor is object based. Every editable item has transform, layer, visibility, lock, and
  opacity metadata.
- Existing version-1 documents are normalized in memory to version 2 when opened and are
  persisted as version 2 on their next edit/autosave.
- This is a JSON document-model migration only. No Supabase schema migration is required.

## Purpose

Layouts provides a reliable, job-scoped home for imported floor plans and measurement
documents. The earlier editable drawing workspace is retained only as a legacy fallback.

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
- Editable objects: freehand strokes, highlighter strokes, straight lines, rectangles, text,
  room labels, dimension lines, transition symbols, and photos
- Shared object metadata: opacity, rotation, scale, lock state, and layer order
- Page orientation and independent `showGrid`, `snapToGrid`, and grid-size settings
- Object color, thickness, coordinates, and tool-specific metadata

Version 2 removes Door and Stairs from the creation toolbar. Existing version-1 Door and
Stairs symbols remain renderable after normalization so opening an older drawing is
non-destructive.

Photos are resized client-side before insertion (maximum 1200 pixels on the longest edge)
and stored as compressed data URLs inside the editable JSON. This keeps them editable and
available to the existing IndexedDB offline draft. It also means photo-heavy drawings are
subject to the editable-document size limit. Rendered previews and explicit exports remain
separate derived artifacts.

Rendered preview images and exported files are derived artifacts and are not required to reopen or edit a layout.

## Phase 1 scope

- Multiple layouts per job
- Pen input for mouse, touch, and Apple Pencil-capable browsers
- Pen colors and five fixed pen widths
- Four translucent highlighter colors: yellow, green, blue, and pink
- Partial freehand-stroke eraser plus explicit whole-object deletion
- Undo and redo
- Straight lines and rectangles
- Text labels
- Select/grab with single- and multi-object selection
- Move, resize, rotate, duplicate, layer, lock, and delete object actions
- Editable mobile-camera/photo-library/file images
- Pan and zoom
- Full-screen drawing
- Debounced autosave
- Editable persistence
- PNG export
- Multi-page PDF export
- Save exports into Job Files

## Phase 2 scope

- Dimension lines with feet/inches labels
- Room labels
- Transition symbols
- Photo objects
- Grid size buttons: Off, Small, Medium, and Large
- Independent grid visibility and grid snapping
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

## Current beta limitations

- Apple Pencil pressure and palm rejection vary by iPadOS/Safari version.
- Offline editing requires the layout to have been opened or created online at least once.
- Concurrent editing is conflict-detected, not collaboratively merged.
- Partial erasing applies to freehand/highlighter strokes. Other object types use selection
  followed by Object Delete.
- Text entry uses a compact dialog rather than rich text.
- PDF output is flattened and not editable.
- HEIC/HEIF files can be stored and downloaded, but inline preview depends on browser support.
- Offline queue durability is controlled by iPadOS/Safari storage policies.
- Native iPad share-sheet integration requires a future companion app.
- Browser storage can be evicted by the operating system; remote autosave remains the durable source.
- Embedded photos increase `document_data` size. The service rejects documents above its
  3.5 MB editable-document limit rather than allowing an oversized autosave. Next.js Server
  Actions are configured with a 4 MB request limit to leave transport overhead.

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
- [ ] Pen/highlighter color and last-used widths persist during the editor session.
- [ ] Partial eraser, Object Delete, undo, and redo work.
- [ ] Line, rectangle, text, dimension, room label, transition, and photo objects render.
- [ ] Select supports one object and marquee multi-selection.
- [ ] Move, resize, rotate, duplicate, layer, lock, and delete work for applicable objects.
- [ ] Grid visibility and snapping can be controlled independently.
- [ ] Off, Small, Medium, and Large grid-size buttons work.
- [ ] Portrait is the default and orientation can be changed safely.
- [ ] Full-screen entry and exit work with browser API and iPad fallback.
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
- [ ] Highlighter alpha and inserted photos are preserved in PNG/PDF output.

### Regression

- [ ] Overview, Timeline, Tasks, Calendar, Files, Photos, and Communications behave as before.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
