# Third-Party Notices

CEleste Studio's private preview uses a PICO-8-compatible runtime and can operate on a cartridge supplied locally by the user. This notice does not change the license of CEleste Studio itself.

## Fake-08

- Project: `jtothebell/fake-08`
- Purpose: PICO-8-compatible emulator/player used by Preview through WebAssembly.
- License: MIT License.
- Deployment source: CI fetches `fake08.js` and `fake08.wasm` from pinned integration commit `bcd2b7ecc341341e8063b51431822b07a0eff1fb`.

Fake-08 and applicable upstream notices remain applicable to those files.

## User-supplied Celeste Classic cartridge

CEleste Studio does **not** include, download, upload, commit, package, or redistribute the original Celeste Classic PICO-8 cartridge.

The private preview UI accepts a text `.p8` chosen by the user from their own computer. It is stored only in that browser's IndexedDB. Studio creates an in-memory modified copy for Preview and sends that private copy directly to the local Fake-08 WebAssembly instance.

No original cartridge is present in the GitHub repository or production ZIP artifacts.

## Compatibility reference

The public `NoelFB/Celeste` repository contains an MIT-licensed C# implementation of Celeste Classic under `Source/PICO-8/Classic.cs`, described there as a close/line-for-line behavior port of the original Lua game. It is useful as a compatibility reference, but Studio's production package does not embed that implementation either.

## Celeste / PICO-8 names and art

Celeste is by Maddy Thorson and Noel Berry / Extremely OK Games. PICO-8 is by Lexaloffle Games. CEleste Studio and CEleste are unofficial community projects and are not affiliated with or endorsed by those parties.
