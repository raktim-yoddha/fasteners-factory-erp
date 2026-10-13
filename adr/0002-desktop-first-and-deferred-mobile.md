# ADR 0002: Desktop/backend first; mobile deferred

Date: 2026-10-13. Status: owner-directed.

The owner requests direct implementation without subagents, prioritizes Electron desktop then multi-person/multi-role backend, and excludes mobile for now. Preserve already written native drafts, but exclude them from active pnpm workspaces, lint, builds and acceptance. Mobile commands fail with a clear deferred explanation.

This changes current delivery ordering and gates without claiming mobile canceled or complete. The public/shared web surface remains supporting presentation. Do not create a separate backend or duplicate UI just to fill platform directories.
