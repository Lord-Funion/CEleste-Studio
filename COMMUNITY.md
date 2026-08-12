# CEleste Studio Community Browser

CEleste Studio 1.2.0 adds a public browser for individual CEleste levels on the PHP-enabled hosted build.

## Community features

- Publish the currently active level as an independent public copy.
- Search by level title, in-level author, publisher display name, or description.
- Sort by **Most popular**, **Newest**, **Most liked**, **Most downloaded**, or **Most commented**.
- Like or dislike a level from a browser installation.
- Post public comments with a display name.
- Open a community level directly in Studio.
- Download a community level as a `.celproj` file.
- Copy a direct `?level=<id>` link.
- Track public views and downloads.

The popularity ranking combines likes, dislikes, downloads, comments, and views. It is intended as a simple discovery score rather than a fraud-proof global ranking.

## Storage

Community records are stored under `storage/community/`. The repository's `storage/.htaccess` blocks direct web access to that directory. `community.php` is the only public API for reading or changing community data.

The endpoint uses random 128-bit item IDs and basic per-IP rate limits. Reactions also use a browser-generated client ID together with the connection address to reduce accidental duplicate voting. This is intentionally lightweight; it is not an account/authentication system and should not be treated as one.

The original Celeste Classic `.p8` cartridge is never uploaded by the community system. Published community data contains only CEleste Studio project/level data.

## Hosting requirements

The Community Browser needs the same hosted environment as project sharing:

- PHP 8.x
- writable `storage/`
- HTTPS recommended

MySQL is not required.

Health check:

```text
community.php?health=1
```

A working installation returns JSON containing `"ok":true`.
