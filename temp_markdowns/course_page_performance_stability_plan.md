# Course Page Performance And Stability Plan

## Goals
- Reduce initial course-page load time and visible lag when switching modules.
- Prevent content blocks from derendering or resetting while the learner is reading.
- Keep the course page responsive even when a module contains a large number of content blocks.
- Avoid browser freezes and long main-thread stalls on large rich-text, media-heavy, and quiz-heavy modules.

## Current Risk Areas To Address
- Large modules render every content block at once, including heavy rich-text, documents, videos, and quizzes.
- The page keeps multiple moving pieces alive at the same time: course shell refreshes, module hydration, session heartbeats, quiz state, essay autosave, and document viewers.
- Rich-text blocks and embedded viewers can be expensive to mount and remount.
- Some learner-visible state still depends on volatile runtime/session state instead of a stable persisted snapshot.
- Background refreshes can replace or rehydrate the selected module while the learner is interacting with the page.

## Phase 1: Stabilize Rendering
- Keep selected module data stable once hydrated, and only merge targeted field updates instead of replacing the whole module object.
- Split the course shell from the module content tree so background enrollment/progress refreshes do not remount the content blocks.
- Memoize expensive derived values for parsed content blocks, quiz sections, document blocks, and upload requirements using stable module-content keys.
- Stop re-rendering every block when only one quiz answer or essay field changes by moving per-block state into smaller child components.
- Prevent heavyweight viewers such as PDFs, media players, and large HTML blocks from mounting until visible.

## Phase 2: Lazy Rendering And Viewport Loading
- Introduce viewport-based lazy rendering for content blocks so only nearby blocks mount initially.
- Use an intersection observer to progressively reveal the next groups of blocks as the learner scrolls.
- Keep lightweight placeholders or skeletons for blocks that are not mounted yet.
- Defer expensive block types first: document viewers, videos, very large text sections, and image-heavy sections.
- Preserve already-mounted blocks when possible so they do not unload while the learner scrolls slightly away.

## Phase 3: Virtualization For Large Modules
- Add a virtual-scrolling strategy for very large modules, but only after measuring which block types behave well with virtualization.
- Use a hybrid approach:
  - Virtualize simple text, quiz, and link blocks.
  - Keep complex embedded viewers in a buffered window so they do not constantly unmount/remount.
- Pre-measure or estimate block heights to reduce layout jumping.
- Maintain an overscan buffer so the learner does not see blank gaps during fast scroll.
- Ensure focus, keyboard navigation, and screen-reader order remain usable when virtualization is enabled.

## Phase 4: Data And Persistence Hardening
- Persist module-level practice quiz state and completion snapshots independently from transient session metadata.
- Move any learner-critical progress state needed after reload into stable database-backed records.
- Reduce duplicate reads during module load by batching completion, submission, and practice-quiz fetches where possible.
- Avoid re-fetching the full course/module payload when only progress or completion state changed.
- Add request de-duplication and stale-request cancellation for module hydration.

## Phase 5: Heavy Block Optimization
- Rich-text text blocks:
  - Sanitize and normalize once, then cache rendered HTML by module-content hash.
  - Chunk very large HTML sections into smaller render units when necessary.
- Document blocks:
  - Lazy-load PDF/document viewers only after explicit learner interaction or viewport entry.
  - Replace immediate full viewer mount with a preview card and open-on-demand behavior for very large documents.
- Media blocks:
  - Delay player initialization until the block is near the viewport.
  - Release heavy player resources when the learner leaves the module.
- Quiz blocks:
  - Isolate each block into a memoized component so one answer change does not re-render the whole module.

## Phase 6: Observability And Regression Protection
- Add lightweight performance instrumentation around:
  - course shell load time
  - module hydration time
  - first content block render
  - time to interactive for module content
  - long-task frequency on large modules
- Create stress-test fixtures for modules with:
  - 100+ text blocks
  - many quizzes
  - large rich-text sections
  - mixed media and document blocks
- Add browser QA scenarios for back navigation, tab switching, long reading sessions, and repeated module switches.

## Recommended Implementation Order
1. Stabilize selected-module rendering and stop unnecessary remounts.
2. Split heavy block types into lazy subtrees.
3. Add viewport-based progressive block rendering.
4. Add durable completion-time snapshots for learner-critical module state.
5. Benchmark very large modules and introduce hybrid virtualization only where it helps.
6. Add instrumentation and regression checks so later changes do not reintroduce lag or derendering.

## Success Criteria
- Module switching feels immediate and does not blank out content after background refreshes.
- Learners can scroll through very large modules without freezing the page.
- Heavy viewers do not mount until needed.
- Content blocks do not unexpectedly derender while the learner is reading.
- The course page remains responsive on long modules and lower-spec devices.
- Practice quiz state and module progress survive reloads and completion transitions reliably.