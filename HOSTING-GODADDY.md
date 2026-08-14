# GoDaddy/cPanel deployment

CEleste Studio 1.3.0 can run on ordinary GoDaddy Web Hosting/cPanel. The editor itself is browser JavaScript; PHP provides legacy share-link compatibility and the public Community Level Browser.

## What the hosting account needs

Required:

- Apache/cPanel static hosting
- PHP 8.x
- a writable `storage/` directory for shared projects and community records
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

## Legacy share links

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

Studio no longer exposes a button for creating new project-share links. The
endpoint remains deployed so existing links keep working. Anyone who has an
older unlisted link can open that project, so treat the link itself as the
access token.

## Community Level Browser

`community.php` powers the public level browser and stores runtime data under:

```text
storage/community/
```

Studio can publish the currently active level as an independent public copy. Community users can:

- search levels;
- sort by **Most popular**, **Newest**, **Most liked**, **Most downloaded**, or **Most commented**;
- like or dislike levels;
- leave public comments;
- see view/download/comment/reaction counts;
- open a level directly in Studio;
- download a `.celproj` copy;
- copy direct `?level=<id>` links.

Community item IDs are random 128-bit values. The endpoint has request-size limits and basic per-IP action rate limits. Reactions also use a browser-generated client identifier to reduce accidental duplicate voting. This is a lightweight public community system, not a user-account/authentication service.

The popularity score combines positive reactions, negative reactions, downloads, comments, and views. It is intended for discovery and is not a fraud-proof global ranking.

## The Celeste cartridge is not deployed or shared

The GoDaddy ZIP does **not** contain the original Celeste Classic cartridge.

**Set original Celeste .p8** opens a local browser file picker. The chosen text `.p8` is validated and stored in that browser's IndexedDB. It is not placed in `.celproj` data and is never POSTed to `share.php` or `community.php`.

## Required deployment files

The CI-generated GoDaddy ZIP contains this runtime structure:

```text
.htaccess
index.html
bootstrap.js
share.php
community.php
app.js
interaction-fix.js
styles.css
community.css
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
public_html/CEleste-Studio/
```

`index.html`, `share.php`, `community.php`, and `storage/` must be directly inside that document root, not inside an extra ZIP-name folder.

A subdomain can point at the same document root.

If the Git repository itself is already checked out directly inside the public web directory, updating that checkout updates the live files; a separate cPanel deployment target is not necessary unless you intentionally use one.

## Permissions

Normal cPanel permissions are usually sufficient:

- directories: `755`
- files: `644`

PHP must be able to create runtime data inside `storage/`. On typical GoDaddy shared hosting PHP runs as the account user, so extracting the ZIP from cPanel File Manager or checking the repository out under the same account normally gives the correct ownership.

Do not make the entire site world-writable. If storage is not writable, fix ownership/permissions on `storage/` instead.

## Health checks

After deployment, these URLs should both return JSON containing `"ok":true`:

```text
share.php?health=1
community.php?health=1
```

If **Browse levels** or **Publish level** remain disabled, test the community health endpoint first.

## HTTPS

Use HTTPS. The browser-local cart vault and clipboard APIs work best in a secure context. GoDaddy AutoSSL is sufficient when available.

The included root `.htaccess` declares JavaScript/module/WebAssembly MIME types, disables stale caching for application/API code, and sets the site's security headers.

## Updating later

Extract a newer GoDaddy ZIP over the existing Studio document root, or update the live Git checkout. Do not delete `storage/` if you want existing unlisted share links, published community levels, reactions, comments, and counters to keep working.

The browser-local original cartridge is stored in IndexedDB and is unaffected by server-file updates.

## Verification checklist

After deployment:

1. Open the HTTPS Studio URL and confirm the editor loads immediately with no password prompt.
2. Open `share.php?health=1` and confirm `"ok":true`.
3. Open `community.php?health=1` and confirm `"ok":true`.
4. Confirm **Browse levels** and **Publish level** become enabled and that no project-share button appears.
5. Publish a small active level and confirm it appears in **Browse levels**.
6. Like it, dislike/unselect the reaction, and post a test comment.
7. Test **Most popular**, **Newest**, **Most liked**, **Most downloaded**, and **Most commented** sorting.
8. Copy the direct community level link and open it in a private/incognito window.
9. Open the level in Studio and download its `.celproj`.
10. If legacy share data exists, test an older unlisted link in a private/incognito window.
11. Click **Set original Celeste .p8**, run Preview, and confirm the original-cart preview starts.
12. Confirm `.8xv` export/import still works.
13. Open DevTools > Network and verify the original Celeste `.p8` is never uploaded.
14. Request a guessed path under `storage/` and confirm Apache returns access denied rather than stored JSON.
