# CEleste Studio 1.0.0

A dependency-free static browser editor for custom levels used by the TI-84 Plus CE CEleste port.

## Features

- Multiple levels and ordered packs
- Multiple 16×16 rooms per level
- Terrain and entity palettes using existing CEleste IDs
- Pencil, eraser, flood fill, and eyedropper
- Spawn and exit markers
- 100-step undo/redo history
- Browser autosave and crash recovery
- Editable `.celproj` project backups
- Import of single-level or pack `.8xv` AppVars
- Export of valid archived `.8xv` AppVars
- Independent TI checksum and `CELV` CRC32 validation
- Basic in-browser movement/jump/dash preview
- Light and dark themes
- No server upload, account, telemetry, ads, subscription, or online DRM

## Run

```sh
npm test
npm run serve
```

The app is static and can be hosted from any ordinary web server. Browsers block some module features when opening `index.html` directly with `file://`, so local HTTP hosting is recommended.

## Release

Current release: **1.0.0**.

## Pricing target

- Launch: $0.99 one time
- Standard: $1.99 one time

Bug fixes and minor updates should remain free.

## Disclaimer

Unofficial community software. Not affiliated with or endorsed by Extremely OK Games, Maddy Thorson, Noel Berry, Texas Instruments, or the CE Programming Toolchain developers. It does not include assets from the commercial Celeste game.

## Repository status

This repository is private because CEleste Studio is intended to be paid software. Do not make the repository public or copy its source into the public CEleste repository. The shared `CELV` compatibility specification and calculator runtime remain in `Lord-Funion/CEleste`.

## License

Proprietary and confidential. See `LICENSE`.
