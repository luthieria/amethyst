# Style Ownership Map

Use this file as the manual control index for styling and visual behavior.

- Markdown rendering: `assets/_markdown.scss`
- Graph appearance (colors, layout presentation, graph typography): `assets/quartz/styles/_graph.scss`
- Graph behavior (depth, zoom, force, legend toggles, path colors): `data/graphConfig.yaml`
- Globe layout positions (lat/lon/dx/dy/halo): `data/ethno-world-map.yaml`
- Globe runtime interaction tuning (`TUNING`): `assets/quartz/js/ethno-globe.js`
- Sidebar/layout customizations: `assets/custom/*.scss`

Notes:

- Keep both style pipelines active: `assets/book.scss` and `assets/quartz/styles/*`.
- JS deduplication (legacy vs Quartz) is intentionally deferred to a later step.
