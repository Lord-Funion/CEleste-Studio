# Third-Party Notices

CEleste Studio's browser preview uses open-source compatibility/runtime work. This notice applies to those components; it does not change the license of CEleste Studio itself.

## Fake-08

- Project: `jtothebell/fake-08`
- Purpose: PICO-8-compatible player/emulator used by the browser preview through WebAssembly.
- License: MIT License.
- Deployment source: the static-package workflow fetches `fake08.js` and `fake08.wasm` from the pinned p3a integration commit `bcd2b7ecc341341e8063b51431822b07a0eff1fb`. p3a identifies the upstream Fake-08 project and its MIT license.

Copyright and license notices from Fake-08 and its upstream dependencies remain applicable to those components.

## Celeste Classic reference implementation

- Project: `NoelFB/Celeste`
- File family: `Source/PICO-8/Classic.cs` and related PICO-8 compatibility code.
- Purpose: behavior reference for the generated preview cartridge. The repository describes `Classic.cs` as an attempt to reproduce Celeste Classic line-for-line while translating Lua to C#.
- License: MIT License for code in that repository.

The Studio preview runtime is a modified/clean implementation for custom CELV levels and CEleste-specific entities; it does **not** redistribute the original Lexaloffle BBS Celeste cartridge.

## Celeste / PICO-8 names and assets

Celeste is by Maddy Thorson and Noel Berry / Extremely OK Games. PICO-8 is by Lexaloffle Games. CEleste Studio and CEleste are unofficial community projects and are not affiliated with or endorsed by those parties.
