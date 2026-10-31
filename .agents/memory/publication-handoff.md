---
name: Publication handoff
description: Preserve merge-only documentation when handing a published branch back to the main workspace.
---
After publishing a branch that joins independent histories, compare the workspace
tree against the published tree again after the task-completion rebase.

**Why:** The completion rebase flattened a publication merge and omitted
documentation introduced only by that merge, even though it reported success.
GitHub's published merge remained intact.

**How to apply:** Restore any omitted intended content as a normal local commit
before completing the task again. Do not force-push the rebased workspace branch
over the already-published history-preserving GitHub branch.
