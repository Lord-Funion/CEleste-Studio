# CEleste Studio 1.0.0 — private production build

CEleste Studio is a static browser editor for CEleste custom levels and packs on the TI-84 Plus CE.

This build is designed primarily for **private/local use**. It remains deployable unchanged to ordinary static Apache/cPanel hosting such as GoDaddy Web Hosting if that becomes desirable later.

## What is different about Preview

Studio no longer contains a hand-written substitute for Celeste Classic player physics.

The private preview path works like this:

1. Unlock Studio with the JavaScript password gate.
2. Choose your own text-format original Celeste Classic `celeste.p8` using **Set original Celeste .p8**.
3. The browser validates it as a compatible Celeste cart and stores it only in that browser's IndexedDB.
4. When Preview is opened, Studio clones that browser-local cart in memory, replaces its map with the current Studio level, and appends the minimum custom-level glue required by CEleste features.
5. The resulting private modified cart runs in Fake-08 WebAssembly.

The original cart is **never included in this repository, the CI artifacts, the local ZIP, or the GoDaddy ZIP**, and it is never uploaded by Studio.

Before a Climb Chest changes movement, Madeline's normal movement/jump/dash/wall-jump code executes from the supplied original cartridge. The Studio patch layers custom level behavior around it rather than replacing the player implementation.

## Private preview additions

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
- Import/export of CELV `.8xv` AppVars
- Validation of room/entity limits and AppVar data
- Static-site operation: no server application, database, PHP, or Node runtime required

## Run privately on your computer

The production local package includes `serve-local.py` and **Start Private Studio.bat**.

On Windows, double-click:

```text
Start Private Studio.bat
```

It binds only to `127.0.0.1`, opens Studio in the default browser, and does not expose the editor to other computers on the network.

Or run:

```sh
python serve-local.py
```

ES modules, IndexedDB, WebAssembly, and the password hash work correctly through localhost. Do not open `index.html` directly with `file://`.

## JavaScript password gate

`private-gate.js` defines:

```js
window.celestePrivatePassword(password)
```

The plaintext password is not stored in the repository; the file contains only its SHA-256 digest. The gate prevents the editor modules from loading until the function succeeds.

This is deliberately a **client-side convenience/privacy gate**, not cryptographic server authentication. If this build is ever placed at a publicly reachable URL, someone who deliberately requests the static files can bypass a JavaScript-only gate. The original Celeste cart is still protected from that problem because it never exists on the web server.

To choose another password, generate a SHA-256 value locally:

```sh
node tools/hash-private-password.mjs "your new password"
```

Then replace `EXPECTED_SHA256` in `private-gate.js` with that output.

## Future GoDaddy compatibility

The CI workflow also produces a static GoDaddy/cPanel ZIP. It contains only Studio, Fake-08, and the gate—never the Celeste cartridge. Uploading it requires no Node.js on the hosting account.

See `HOSTING-GODADDY.md` for the future deployment layout and security caveat.

## Testing

```sh
npm test
```

The deployment CI additionally downloads the pinned Fake-08 browser runtime and runs `npm run test:fake08`. That smoke test patches a synthetic Celeste-compatible cart through the same production code path, loads the resulting `.p8` into Fake-08, verifies 30 Hz execution, and steps frames. No original Celeste cartridge is used in CI.

## Third-party/runtime notice

Fake-08 is used as the PICO-8-compatible WebAssembly runtime and is pinned by commit in CI. See `THIRD-PARTY-NOTICES.md`.

The original Celeste Classic cartridge is user-supplied and browser-local. Studio does not redistribute it.

## Disclaimer

Unofficial community software. Not affiliated with or endorsed by Extremely OK Games, Maddy Thorson, Noel Berry, Lexaloffle, Texas Instruments, Fake-08, or the CE Programming Toolchain developers.