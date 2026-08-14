# CEleste Studio 1.2.0

CEleste Studio is a browser editor for CEleste custom levels and packs on the TI-84 Plus CE.

The hosted editor is public: **there is no Studio password gate**. The GoDaddy/cPanel build supports a public Community Level Browser using a small same-origin PHP endpoint. Older unlisted `?share=` links remain readable for backwards compatibility, but Studio no longer exposes a Share Project button.

## Community Level Browser

Click **Browse levels** to explore public community levels. The browser supports:

- search by title, level author, publisher name, or description;
- **Most popular**, **Newest**, **Most liked**, **Most downloaded**, and **Most commented** sorting;
- likes and dislikes;
- public comments;
- view, download, comment, like, and dislike counts;
- direct `?level=<random-id>` links;
- **Open in Studio** to load a community level into the editor;
- `.celproj` downloads.

Click **Publish level** to publish the currently active level as an independent public copy. Later edits in your browser do not silently modify the already-published copy.

Community data is served by `community.php` and stored under protected `storage/community/`. Community IDs are random 128-bit values and the endpoint applies request-size and basic per-IP action limits. No MySQL database is required.

The popularity ranking is a discovery score based on likes, dislikes, downloads, comments, and views; it is intentionally lightweight rather than a fraud-proof ranking system.

See `COMMUNITY.md` for community-specific details.

## Legacy unlisted project links

Studio no longer exposes a **Share project** button. Existing `?share=<random-id>` links can still be opened so older links do not break.

- Opening the link loads a copy of that project into the visitor's browser autosave.
- The visitor can edit it without changing the original shared copy.
- The share dialog also exposes a `.celproj` download for the shared project.
- Share IDs are 128-bit random values.
- The PHP endpoint accepts CEleste project JSON only, with a 4 MiB request limit and a basic per-IP upload rate limit.
- Stored project records live under `storage/`, whose included `.htaccess` blocks direct web access.
- No MySQL database is required.

The original Celeste Classic `.p8` cartridge is **never** part of a shared or published project. It remains browser-local in IndexedDB and is never POSTed to `share.php` or `community.php`.

## Original-cartridge Preview

Studio does not contain a hand-written substitute for Celeste Classic player physics.

The preview path works like this:

1. Choose your own text-format original Celeste Classic `celeste.p8` using **Set original Celeste .p8**.
2. The browser validates it as a compatible Celeste cart and stores it only in that browser's IndexedDB.
3. When Preview is opened, Studio clones that browser-local cart in memory, replaces its map with the current Studio level, and appends the minimum custom-level glue required by CEleste features.
4. The resulting modified cart runs in Fake-08 WebAssembly.

The original cart is **never included in this repository, CI artifacts, the local ZIP, or the GoDaddy ZIP**, and it is never uploaded by Studio.

Before a Climb Chest changes movement, Madeline's normal movement/jump/dash/wall-jump code executes from the supplied original cartridge. The Studio patch layers custom level behavior around it rather than replacing the player implementation.

## Preview additions

The original-cart patch supports:

- Studio's ordered 16×16 rooms, packed into the original PICO-8 8×4 room map;
- original Celeste room transitions and death/restart behavior;
- arbitrary rotated terrain drawing, while directional spike collision uses the matching original spike direction;
- real entity flags from CELV;
- strawberry/empty locked chests;
- strawberry/empty fake walls;
- 2-dash and 3-dash big-chest behavior;
- per-source strawberry persistence instead of the original room-wide suppression rule;
- Climb Chest entity 129 and the custom grab/stamina mechanic;
- Silver Key entity 130 and solid Silver Gate entity 131, with persistent 0–63 link groups shared across the level;
- simple-sprite entity rotation, including ordinary locked chests;
- level completion after the final Studio room.

Some original Celeste entities are multi-sprite/custom-draw animations. If one of those is given an arbitrary rotation that cannot be losslessly inserted into the original cart's animation routine, Preview reports a warning; the CELV/calculator export still retains its full rotation value.

## Editor features

- Multiple levels and ordered packs
- Up to 32 rooms per level
- Full 16×16 room editor
- Complete logical gameplay pieces rather than loose compound fragments
- Arbitrary 0°/90°/180°/270° CELV rotation
- Pencil, eraser, fill, eyedropper, undo/redo
- Chest, fake-wall, big-chest and Climb Chest properties
- Linked Silver Keys and stackable Silver Gate blocks with link groups 0–63
- Browser autosave and `.celproj` project files
- Public community publishing and browsing
- Likes, dislikes, comments, popularity sorting, search, and download/view counters
- Import/export of CELV `.8xv` AppVars
- Validation of room/entity limits and AppVar data

## Run locally

The local package includes `serve-local.py` and **Start CEleste Studio.bat**.

On Windows, double-click:

```text
Start CEleste Studio.bat
```

Or run:

```sh
python serve-local.py
```

It binds only to `127.0.0.1`. ES modules, IndexedDB, and WebAssembly work through localhost. Do not open `index.html` directly with `file://`.

The local Python server does not execute PHP, so **Browse levels** and **Publish level** are automatically disabled there. Those community features are available on the PHP-enabled hosted build.

## GoDaddy/cPanel hosting

The hosted build needs ordinary Apache/cPanel hosting plus PHP 8.x for `share.php` and `community.php`. It does **not** require Node.js, Python, Ruby, MySQL, a background service, or WebSockets.

See `HOSTING-GODADDY.md` for deployment layout, permissions, health checks, and verification steps.

## Testing

```sh
npm test
```

CI syntax-checks both PHP endpoints, downloads the pinned Fake-08 browser runtime, and runs `npm run test:fake08`. The Fake-08 smoke test uses a synthetic compatible cart; no original Celeste cartridge is used in CI.

## Third-party/runtime notice

Fake-08 is used as the PICO-8-compatible WebAssembly runtime and is pinned by commit in CI. See `THIRD-PARTY-NOTICES.md`.

The original Celeste Classic cartridge is user-supplied and browser-local. Studio does not redistribute it.

## Disclaimer

Unofficial community software. Not affiliated with or endorsed by Extremely OK Games, Maddy Thorson, Noel Berry, Lexaloffle, Texas Instruments, Fake-08, or the CE Programming Toolchain developers.
