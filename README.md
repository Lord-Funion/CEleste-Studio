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
- Arbitrary 0°/90°/180°/270° CELV graphics rotation reproduced by the calculator and emulator preview
- Key and locked-chest puzzles
- Locked chests can contain strawberries
- Fake walls can contain strawberries
- Multiple direct/chest/fake-wall strawberry sources persist independently across deaths and restarts
- Big chests can upgrade Madeline to two or three dashes
- Climb Chest power-up: touch it to unlock `MATH` wall-grab/climbing with a 110-point stamina system for the rest of the level
- Falling floors, springs, balloons, normal/flying strawberries, keys, chests, fake walls, moving platforms, memorials, big chests, and summit flags
- Real PICO-8 cartridge preview executed by Fake-08 WebAssembly; Studio generates the current level into a cart so browser JavaScript does not reimplement player physics or collision
- Pencil, eraser, flood fill, and eyedropper
- Player spawn placement; rooms complete by exiting through the top edge
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

CELV stores rotation independently from sprite ID. Studio, the calculator runtime, and the emulator preview all preserve the same 0°, 90°, 180°, and 270° values. Rotation therefore does not require a separate counterpart sprite to exist.

## Gameplay properties

When a locked chest or fake wall is selected, its inspector lets you choose whether it contains a strawberry. When a big chest is selected, choose whether its orb upgrades Madeline to two or three dashes. These options are stored in the CELV entity `flags` byte and are consumed by the calculator runtime.

Each strawberry-producing entity is treated as its own collectible source. A room can therefore contain several normal/flying strawberries plus strawberry chests and strawberry fake walls; collecting one source does not make the others disappear after a death or restart. Keys remain available while a locked chest in the room still needs to be opened.

The summit flag is an optional summit/results object. It does not complete ordinary custom rooms. Rooms advance only when Madeline exits through the top edge, matching Celeste Classic.

## Real PICO-8 preview

The Preview button does not simulate Celeste physics in JavaScript. Studio generates a temporary `.p8` cartridge from the selected level and executes it in a PICO-8-compatible Fake-08 WebAssembly runtime. The cartridge uses the same Celeste atlas, tile flags, room data, gameplay entities, CEleste movement constants/order, arbitrary CELV rotations, and Climb Chest mechanics. JavaScript only generates the cartridge, forwards input, and displays the emulator framebuffer.

The runtime is a clean implementation based on the MIT-licensed official Celeste Classic reference in `NoelFB/Celeste` plus the current CEleste custom-level behavior. The unlicensed Lexaloffle BBS Celeste cartridge is not redistributed by Studio. Fake-08 is fetched from a pinned upstream build by the deployment workflow; see `THIRD-PARTY-NOTICES.md`.

The generated cart uses PICO-8's real 128×64 tile map. All 32 CELV rooms fit as an 8×4 room grid; PICO-8's shared lower sprite/map memory is encoded correctly for map rows 32–63. The browser preview runs at the cart's native 30 Hz update rate.

## Local development

Node.js is useful for the automated test suite and the convenience local server only:

```sh
npm test
npm run serve
```

The deploy workflow additionally downloads the pinned Fake-08 browser runtime and runs `npm run test:fake08`, which proves a generated Studio cart can be loaded and stepped by the actual WebAssembly VM.

Node.js is **not** required on the production web host.

## Public production hosting

CEleste Studio is a static web application and is designed to run on ordinary Apache/cPanel shared hosting, including GoDaddy Web Hosting plans where Node.js is unavailable.

The ready-to-upload CI artifact contains:

```text
.htaccess
index.html
app.js
interaction-fix.js
styles.css
robots.txt
THIRD-PARTY-NOTICES.md
assets/pico8-atlas.png
lib/format.mjs
lib/pico8-cart.mjs
lib/pico8-preview.mjs
preview-runtime/celeste-preview.lua
preview-runtime/fake08.js
preview-runtime/fake08.wasm
```

There is no production build command on the server. Upload the generated `CEleste-Studio-GoDaddy-Upload.zip` contents while preserving the directories. The included `.htaccess` provides the `.mjs` and WebAssembly MIME types and appropriate cache rules for shared Apache hosting.

See [`HOSTING-GODADDY.md`](HOSTING-GODADDY.md) for the exact cPanel deployment layout and checklist.

Because the application is client-side JavaScript/WebAssembly, any files served to a public visitor can also be downloaded/read by that visitor even if this Git repository itself remains private.

## Release

Current release: **1.0.0**.

## Disclaimer

Unofficial community software. Not affiliated with or endorsed by Extremely OK Games, Maddy Thorson, Noel Berry, Texas Instruments, Lexaloffle, Fake-08, or the CE Programming Toolchain developers.

## Repository status

The repository can remain private while the browser application is hosted publicly. The shared `CELV` compatibility specification and calculator runtime remain in `Lord-Funion/CEleste`.

## License

Proprietary. See `LICENSE`.
