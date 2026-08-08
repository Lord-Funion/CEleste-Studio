# CEleste Studio 1.0.0

CEleste Studio is a dependency-free static browser editor for custom levels and packs used by the TI-84 Plus CE CEleste port.
https://lordfunion.dev/CEleste-Studio/

## Features

- Multiple levels and ordered packs
- Multiple 16×16 rooms per level
- Real Celeste Classic/PICO-8 sprite atlas in the grid, palette, entities, and preview
- Complete logical gameplay pieces instead of loose sprite fragments
  - 16×16 fake walls
  - 16×16 big/dash-upgrade chests
  - complete memorial signs
  - complete moving platforms
  - flying strawberries with wings
  - dash balloons with their companion art
- Every standalone original Celeste Classic map-tile family exposed through searchable categories
- Real PICO-8 counterpart rotation where the calculator can reproduce it
  - four spike directions
  - left/right moving platforms
  - supported terrain/decor rotation families
- Key and locked-chest puzzles
- Locked chests can contain strawberries
- Fake walls can contain strawberries
- Multiple direct/chest/fake-wall strawberry sources persist independently across deaths and restarts
- Big chests can upgrade Madeline to two or three dashes
- Climb Chest power-up: touch it to unlock `MATH` wall-grab/climbing with a 110-point stamina system for the rest of the level
- Falling floors, springs, balloons, normal/flying strawberries, keys, chests, fake walls, moving platforms, memorials, big chests, and summit flags
- PICO-8-style 30 Hz playable preview with acceleration, gravity, coyote time, jump buffering, wall slides/jumps, 8-way dash, spikes, springs, balloons, moving platforms, falling floors, key/chest state, fake-wall breaks, fruit collection, dash upgrades, deaths/restarts, and top-of-room transitions
- Pencil, eraser, flood fill, and eyedropper
- Player spawn placement; rooms complete by climbing through the top edge
- 100-step undo/redo history
- Browser autosave and crash recovery
- Editable `.celproj` project backups
- Import of single-level or pack `.8xv` AppVars
- Export of valid archived `.8xv` AppVars
- Entity option flags preserved through CELV and `.8xv` import/export
- Compound-piece footprint and overlap validation
- Independent TI checksum and `CELV` CRC32 validation
- Light and dark themes
- No server upload, account, telemetry, ads, subscription, or online DRM

## Sprite source

`assets/pico8-atlas.png` is synchronized with the sprite atlas used by the public `Lord-Funion/CEleste` calculator port. Studio and the calculator editor therefore render the same 8×8 source art.

Animation/helper frames that only exist as runtime states are not exposed as fake standalone level pieces. Multi-sprite gameplay objects are deliberately folded into one logical editor piece so exported levels behave like the game rather than requiring authors to assemble internal sprite fragments manually.

## Rotation

Press `R` to rotate the selected piece clockwise or `Shift+R` to rotate counter-clockwise. The inspector also has rotation buttons.

Studio only uses real Celeste Classic/PICO-8 counterpart tiles or gameplay directions that CEleste can reproduce. It does not create browser-only rotated art that would change when exported to a calculator.

## Gameplay properties

When a locked chest or fake wall is selected, its inspector lets you choose whether it contains a strawberry. When a big chest is selected, choose whether its orb upgrades Madeline to two or three dashes. These options are stored in the CELV entity `flags` byte and are consumed by the calculator runtime.

Each strawberry-producing entity is treated as its own collectible source. A room can therefore contain several normal/flying strawberries plus strawberry chests and strawberry fake walls; collecting one source does not make the others disappear after a death or restart. Keys remain available while a locked chest in the room still needs to be opened.

The summit flag is an optional summit/results object. It does not complete ordinary custom rooms. Rooms advance only when Madeline exits through the top edge, matching Celeste Classic.

## Local development

Node.js is useful for the automated test suite and the convenience local server only:

```sh
npm test
npm run serve
```

Node.js is **not** required on the production web host.

## Public production hosting

CEleste Studio is a static web application and is designed to run on ordinary Apache/cPanel shared hosting, including GoDaddy Web Hosting plans where Node.js is unavailable.

A live deployment only needs:

```text
.htaccess
index.html
app.js
styles.css
robots.txt
assets/pico8-atlas.png
lib/format.mjs
```

There is no production build command. Upload those files while preserving the `assets/` and `lib/` directories and the editor runs entirely in the visitor's browser. The included `.htaccess` provides the `.mjs` MIME type and conservative cache rules for shared Apache hosting.

See [`HOSTING-GODADDY.md`](HOSTING-GODADDY.md) for the exact cPanel deployment layout and checklist.

Because the application is client-side JavaScript, any files served to a public visitor can also be downloaded/read by that visitor even if this Git repository itself remains private.

## Release

Current release: **1.0.0**.

## Disclaimer

Unofficial community software. Not affiliated with or endorsed by Extremely OK Games, Maddy Thorson, Noel Berry, Texas Instruments, or the CE Programming Toolchain developers.

## Repository status

The repository can remain private while the browser application is hosted publicly. The shared `CELV` compatibility specification and calculator runtime remain in `Lord-Funion/CEleste`.

## License

Proprietary. See `LICENSE`.
