---
name: Explicit photo deletion semantics
description: Why post edits succeed even when physical photo deletion needs a retry.
---
Treat a successful post change and a pending storage deletion as separate outcomes. Keep retries durable and owner-visible; deny new public reads of unreferenced photos even during storage outages. Never purge an object still referenced by another post.

**Why:** Database edits and remote object deletion cannot commit atomically. Reporting the entire edit as failed after committing it invites duplicate operations, while silently swallowing cleanup failures leaves owners unable to finish deletion. Previously cached public URLs cannot be recalled immediately.

**How to apply:** Preserve these semantics when changing photo publication, replacement, removal, or retry processing. Coordinate reference checks and storage mutations across server instances, not only within one process.
