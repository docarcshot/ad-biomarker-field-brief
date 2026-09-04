# Release test record

The release gate requires:

- JSON validation: required fields, dates, identifiers, relevance vocabulary, primary-source URLs, landscape verification dates, and coverage-audit consistency.
- Structural checks: every internal link resolves, every source entry has a permanent page, RSS contains no more than 30 items, feed autodiscovery is present, archive controls are complete, and assets are content-hashed.
- Browser checks: desktop and mobile layout, keyboard focus order, search, each filter, removable chips, clear all, all three sort modes, expandable-card state, permanent entry route, copy-link, copy-citation, light/dark/system themes, and no console errors.
- Workflow checks: zero-entry success advances status and rebuilds; failure records delayed state without advancing `reviewedThrough`; manual dispatch validates and deploys.

Detailed browser and workflow results are recorded in `release-audit.json` after the published URL is tested.
