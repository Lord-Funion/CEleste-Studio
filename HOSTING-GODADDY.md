# GoDaddy/cPanel deployment

CEleste Studio 1.1.0 can run on ordinary GoDaddy Web Hosting/cPanel. The editor itself is browser JavaScript; PHP is used only for project sharing.

## What the hosting account needs

Required:

- Apache/cPanel static hosting
- PHP (PHP 8.x recommended)
- a writable `storage/` directory for shared project records
- HTTPS

Not required:

- MySQL or phpMyAdmin
- Node.js/npm
- Python
- Ruby
- Perl
- WebSockets
- a background process

The MySQL, Python, Ruby, and other cPanel tools can stay unused for this build.

## No password gate

The hosted Studio is public. `index.html` loads the editor directly through `bootstrap.js`; there is no JavaScript password screen and no password hash in the production source.

`robots.txt` and the `X-Robots-Tag` header still discourage indexing. They are not authentication.

## Project sharing

`share.php` stores CEleste project JSON under:

```text
storage/shares/
```

The included `storage/.htaccess` denies direct web access to everything under `storage/`. Shared projects are read and downloaded only through `share.php` after the random share ID is supplied.

The endpoint:

- accepts project JSON only;
- limits each upload to 4 MiB;
- uses a 128-bit random share ID;
- applies a basic per-IP hourly upload limit;
- never receives the browser-local original Celeste cartridge;
- does not require a database.

Anyone who has a share link can open that shared project, so treat the link itself as the access token.

## The Celeste cartridge is not deployed or shared

The GoDaddy ZIP does **not** contain the original Celeste Classic cartridge.

**Set original Celeste .p8** opens a local browser file picker. The chosen text `.p8` is validated and stored in that browser's IndexedDB. It is not placed in `.celproj` data and is never POSTed to `share.php`.

## Required deployment files

The CI-generated GoDaddy ZIP contains this runtime structure:

```text
.htaccess
index.html
bootstrap.js
share.php
app.js
interaction-fix.js
styles.css
robots.txt
THIRD-PARTY-NOTICES.md
storage/
  .htaccess
assets/
  pico8-atlas.png
lib/
  format.mjs
  private-cart.mjs
  pico8-cart.mjs
  pico8-preview.mjs
preview-runtime/
  fake08.js
  fake08.wasm
```

There is deliberately no `celeste.p8`.

## cPanel layout

Use a separate document root such as:

```text
public_html/celeste-studio/
```

`index.html`, `share.php`, and `storage/` must be directly inside that document root, not inside an extra ZIP-name folder.

A subdomain can point at the same document root.

## Permissions

Normal cPanel permissions are usually sufficient:

- directories: `755`
- files: `644`

PHP must be able to create files inside `storage/shares/` and `storage/rate/`. On typical GoDaddy shared hosting PHP runs as the account user, so extracting the ZIP from cPanel File Manager normally gives the correct ownership.

If **Share project** stays disabled on the hosted site, open `share.php?health=1` in the browser. A working installation returns JSON with `"ok":true`. If it reports that storage is not writable, fix the ownership/permissions of `storage/` rather than making the entire site world-writable.

## HTTPS

Use HTTPS. The browser-local cart vault and clipboard APIs work best in a secure context. GoDaddy AutoSSL is sufficient when available.

The included root `.htaccess` declares JavaScript/module/WebAssembly MIME types, disables stale caching for application/API code, and sets the site's security headers.

## Updating later

Extract a newer GoDaddy ZIP over the existing Studio document root. Do not delete `storage/` if you want existing share links to keep working. Extracting over the directory should preserve existing `storage/shares/*.json` records.

The browser-local original cartridge is stored in IndexedDB and is unaffected by server-file updates.

## Verification checklist

After deployment:

1. Open the HTTPS Studio URL and confirm the editor loads immediately with no password prompt.
2. Confirm **Share project** becomes enabled.
3. Make a small project, click **Share project**, and copy the generated link.
4. Open that link in a private/incognito window and confirm the shared project loads.
5. Confirm the shared-project dialog can download a `.celproj` copy.
6. Click **Set original Celeste .p8** and choose a compatible text `.p8`.
7. Run Preview and confirm the original-cart preview starts.
8. Confirm `.8xv` export/import still works.
9. Open DevTools > Network and verify the original Celeste `.p8` is never uploaded.
10. Request a guessed path under `storage/` and confirm Apache returns access denied rather than the stored JSON.
