# Original-cartridge preview

CEleste Studio does not redistribute the original Celeste Classic cartridge.

- The editor itself is public and does not use a Studio password.
- Each user chooses their own text-format Celeste Classic `.p8` with **Set original Celeste .p8**.
- The chosen cartridge stays in that browser's IndexedDB.
- Preview patches the current Studio room data into a browser-local copy and runs it in Fake-08 WebAssembly.
- Project sharing uploads only CEleste project JSON. The original `.p8` is never included in a share or sent to `share.php`.
- `.p8.png` input is not supported; use a text `.p8` copy.

This keeps the hosted Studio and its share links separate from each user's locally supplied original cartridge.
