# Admin Console: User Management

A user management UI for an application administrator, built with React 19, TypeScript and TanStack Query. It sits on a client-side API layer written as if it were talking to a real HTTP backend.That backend is an in-memory stub seeded with sample user rows to simulate large-scale data.
```bash
npm install
npm run dev
npm test
npm run build      
```

Use the **Simulation** button in the top bar to add network latency, inject `503` failures, or make "another admin" edit the user you're viewing. Those switches show off the loading, error, retry and `412` conflict paths.




### Quality-of-life features
- **URL holds the list state.** Page, size, search, filters and sort live in the query string, so a filtered view can be bookmarked or shared, survives a reload, and Back returns you to the exact page. Opening a user and clicking the breadcrumb lands on the same page and filters.
- **Row actions menu:** view/edit, copy email, send password reset, suspend/reactivate. You don't need to open each user.
- **Search shortcut:** <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd>. It uses a modifier on purpose, because single-key shortcuts fail WCAG 2.1.4.
- **Create-user draft survives closing the dialog.** "Add another after this" supports batch entry.
- **Next page is prefetched**, so paging feels instant. The previous page stays on screen (dimmed, with a progress bar) while the next one loads, so the layout doesn't jump.
- **Unsaved-changes guard:** in-app navigation asks before discarding edits, and so does closing the tab.
- **Stale-data detection before save.** The detail view polls every 30s and refetches on window focus. If someone else changes the record while you're editing, you get a warning and the affected fields are flagged *before* you hit Save.
- **Role and status as radio cards**, each with a one-line description of what it means, so the admin doesn't have to guess what "Viewer" can do.
- Copy-able user ID, relative "last updated" time, and request IDs on error screens (handy for support tickets).




## API layer




## Scale

> *"Assume it is not safe to load or render all users at once."*

- **The client never holds more than one page** (≤100 rows), plus whatever pages React Query has cached for this session. Rendering cost is bounded by page size.
- **Pagination rather than infinite scroll or virtualisation.** The contract is skip/limit with a `total`, and admins usually *look someone up* or *jump somewhere*, not scroll through 500k rows. Numbered pages give position ("page 3,412 of 20,000"), are shareable in the URL, and suit keyboard and screen-reader users better than an endless list. Search and filters are the main way to find people; pagination is the fallback.
- **Search is debounced** (300ms) and in-flight requests are **cancelled** when params change, so a stale response can never overwrite a newer one.
- The in-memory data layer is optimized to behave like a standard indexed table, avoiding unnecessary re-renders. Filter and sort results are cached per query to ensure paging through large results remains highly efficient.
## Optimistic concurrency (ETag / If-Match)

The detail form remembers the version it was **started from** (`base`) and sends that ETag in `If-Match`. React Query keeps fetching the **latest** version in the background. Then:


The conflict dialog offers three choices:
1. **Review merged version** (default, safe): keeps your edits, takes their changes for every field you didn't touch, and sets the new ETag. Nothing is saved until you look it over and press Save.
2. **Overwrite with mine:** saves your form as-is against the new ETag. This is an explicit choice, and the copy says it replaces their changes.
3. **Discard my changes:** loads the saved version.

That's the "surface the conflict and let the admin choose to reload or overwrite" requirement, plus the merge option. In most admin conflicts the two people touched different fields (one changed a role, the other fixed a typo in the name), and plain reload-or-overwrite forces one of them to redo their work.


## UX decisions

- **Edit on a dedicated page, not in a drawer or modal.** Editing involves a form, metadata, a destructive-ish action (password reset) and possibly a conflict dialog on top. A page gives that room, a shareable URL (`/users/usr_…`), and natural Back behavior. The list state lives in the URL, so going back costs nothing. *Create* is a dialog because it's short and done in one go.
- **Form always editable, no "Edit" mode toggle.** It saves a click. The "Unsaved changes" tag, the disabled Save button, and Discard make the state clear.
- **Validation:** on first submit, then live as fields are fixed. It doesn't nag before you've finished typing. Focus moves to the first invalid field, and messages are tied to fields via `aria-describedby`. Server errors (e.g. duplicate email) land on the same field.

- **Every state is designed:**
  - Loading: skeleton rows on first load; dimmed table + progress bar on refetch; skeleton form on the detail page.
  - Empty: a filtered-empty state with "Clear filters", and a separate first-run state with "Add user".
  - Error: a full error state with "Try again" when nothing has loaded; a non-blocking banner that keeps stale data visible when a *refresh* fails; inline form errors on save.
  - Not found: unknown user IDs and unknown routes.
  - A route-level error boundary, so a render bug never shows a blank screen.

## Accessibility

Target: **WCAG 2.2 AA**. Highlights:

- **Structure:** a skip link, `header`/`nav`/`main` landmarks, one `h1` per page, a labelled breadcrumb, a unique `<title>` per route.
- **Focus management:** on route change, focus moves to the new page's `h1` (the h1 stays mounted from loading to loaded so focus isn't lost). Dialogs use native `<dialog>.showModal()` for a real focus trap, inert background and Escape handling, and return focus to the trigger when they close. Initial focus goes to the first field in forms and to **Cancel** in confirmations.
- **Keyboard:** everything is reachable and operable. The row actions menu follows the WAI-ARIA menu-button pattern (arrow keys, Home/End, Escape, Tab). Sortable headers are real buttons with `aria-sort`. The mobile nav closes on Escape.
- **Status messages:** result counts, toasts and loading text are in live regions. Error toasts use `role="alert"` and stay until dismissed.
- **Forms:** visible labels, `aria-invalid`, errors linked by `aria-describedby`, and specific fix-it messages . Radio groups use `fieldset`/`legend`.
- **Color and Contrast:** status badges carry text descriptive markers, not just raw color codes. High-contrast typography configurations are verified across both light and dark modes, honoring the native \prefers-color-scheme` setting. Forced-colors mode preserves clean visual boundaries.`

- **Reflow and motion:** no horizontal scrolling at 320px wide, with columns folding into the user cell on narrow screens. Animations are turned off under `prefers-reduced-motion`.
- **Automated checks:** `a11y.test.tsx` runs axe-core on the list, the create dialog in its error state, and the detail page.

I tested with the keyboard and axe. I have **not** run a full screen-reader pass (VoiceOver/NVDA). That would be the next step before shipping; see below.


## Trade-offs

- **Offset pagination at 500k rows.** `skip=480000` is expensive for a real database. The contract requires skip/limit, so I kept it, but I'd push for cursor/keyset pagination before launch (see below).
- **Search runs on the main thread in the stub** (~120ms over 500k rows). That's acceptable since it's debounced and only happens when the query changes. A real backend would use an index; the stub could also move to a Web Worker.
- **Data lives in memory only**, as the brief specifies. A reload resets it to the deterministic seed.


## What I'd do with more time

1. **Cursor-based pagination** (`?after=<opaque>`). Stable under concurrent inserts (offset pages shift when users are added) and O(1) at any depth. I'd keep page numbers in the UI for small result sets.
2. **Bulk actions:** row selection with "suspend / change role / resend invite" for N users, with per-row results for partial failure.
3. **Saved views / column chooser** ("Suspended admins", "Invited > 7 days").
4. **Audit trail on the detail page:** who changed what and when. The nav already has an Audit log entry for it.


