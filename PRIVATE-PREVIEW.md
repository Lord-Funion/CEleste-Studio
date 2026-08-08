# Private original-cartridge preview

This Studio deployment is intentionally a personal/static build.

- `private-gate.js` gates the editor UI with a client-side password function before `app.js` is imported.
- The JavaScript gate is convenience/privacy, not strong server authentication. Static files can still be requested directly by someone who knows the URL.
- The original Celeste cartridge is **not** included in the repository, GitHub Actions artifact, or GoDaddy deployment ZIP.
- After unlocking Studio, use **Set original Celeste .p8** and choose your own text-format Celeste Classic cartridge.
- That `.p8` is kept only in that browser's IndexedDB.
- Preview patches Studio room/map data into the browser-local cartridge and runs the resulting private modified cart in Fake-08 WebAssembly.
- Normal Celeste player physics therefore execute from the original cart code. Studio only layers its custom-level glue on top (room count, Climb Chest support, and supported custom visuals).
- `.p8.png` input is intentionally not supported because it would require decoding/repacking the compressed cart format; use a text `.p8` copy.

The production host remains completely static and requires no Node.js, PHP, database, or server process.
