# Changelog

## 1.2.0 — 2026-08-12

- Added a public Community Level Browser for published single levels.
- Added sorting by most popular, newest, most liked, most downloaded, and most commented.
- Added search across level title, author, publisher, and description.
- Added likes, dislikes, comments, view counts, download counts, and popularity scoring.
- Added direct community-level links using `?level=<id>`.
- Added **Open in Studio** and `.celproj` download actions for community levels.
- Added **Publish level** for the currently active level, with an independent public copy.
- Added PHP-backed community storage with random IDs, request limits, per-IP action rate limits, and storage protected by the existing `storage/.htaccess`.
- Added community regression tests and production-package validation.

## 1.1.0 — 2026-08-12

- Removed the client-side Studio password gate; the hosted editor now loads directly.
- Added PHP-backed project sharing with random share links and `.celproj` downloads.
- Added automatic loading of `?share=<id>` links into browser autosave without mutating the stored shared copy.
- Added protected server-side project storage, upload-size validation, and a basic per-IP sharing rate limit.
- Kept original Celeste `.p8` cartridges browser-local; project sharing never uploads or stores them.
- Updated the GoDaddy/cPanel production package to include `share.php` and protected storage while keeping MySQL optional/unneeded.

## 1.0.0 — 2026-08-07

- First complete CEleste Studio release.
- Multi-level and multi-room editing.
- `.celproj` project backups.
- Valid `.8xv` single-level and pack import/export.
- TI checksum and CELV CRC32 validation.
- Undo/redo, autosave, and themes.
- Replaced placeholder editor blocks with the Celeste Classic/PICO-8 sprite atlas used by the calculator port.
- Reworked the playable preview around the original PICO-8 player constants and tile flags, including 30 Hz movement, jump buffering, coyote time, wall movement, 8-way dash, spikes, springs, balloons, moving platforms, and top exits.
- Expanded the palette to every standalone original Celeste Classic map-tile family plus complete logical gameplay pieces instead of internal sprite fragments.
- Added real supported rotation counterparts for directional spikes, moving platforms, and matching terrain/decor families.
- Fake walls, big chests, memorials, moving platforms, flying strawberries, and balloons now render/place as complete pieces.
- Added key/locked-chest puzzle behavior, strawberry-containing chest/fake-wall options, and configurable two-/three-dash big chests.
- Added compound-piece footprint/overlap validation and CELV entity-flag round-trip regression tests.
- Expanded playable preview state for keys/chests, fake-wall breaks, falling floors, flying strawberries, fruit persistence, and big-chest dash upgrades.

## 0.1.0-alpha — 2026-08-06

- Internal pre-release build retained for history.
