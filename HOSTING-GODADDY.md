# Future GoDaddy/cPanel deployment

The current CEleste Studio build is intended for private/local use, but the production runtime remains compatible with ordinary GoDaddy Web Hosting/cPanel if it is appropriate to host it later.

## No server runtime required

Production is static. GoDaddy does **not** need:

- Node.js
- npm
- PHP
- a database
- a background service
- WebSockets
- a build command

The server only returns HTML/CSS/JavaScript/WebAssembly files.

## The Celeste cartridge is not deployed

The GoDaddy ZIP does **not** contain the original Celeste Classic cartridge.

After the user unlocks Studio in the browser, **Set original Celeste .p8** opens a local file picker. The chosen text `.p8` is validated and stored in that browser's IndexedDB. It is never POSTed or uploaded anywhere.

This means the hosted Studio files can exist without redistributing the original cartridge.

## Password gate caveat

`private-gate.js` prevents the editor application modules from loading until `window.celestePrivatePassword(password)` succeeds. The repository stores a SHA-256 digest rather than the plaintext password.

This is still client-side JavaScript. It is useful as a casual/private gate, but it is **not equivalent to HTTP Basic Auth, cPanel Directory Privacy, or another server-side access control**. A determined visitor who already knows the URL can request static files directly.

If this is ever made reachable from the public internet and real access control is required, use GoDaddy/cPanel's server-side directory protection in addition to the JavaScript gate. The Studio code itself does not depend on that feature.

`robots.txt` is set to `Disallow: /` to discourage indexing; that is also not authentication.

## Required deployment files

The CI-generated GoDaddy ZIP contains this runtime structure:

```text
.htaccess
index.html
private-gate.js
app.js
interaction-fix.js
styles.css
robots.txt
THIRD-PARTY-NOTICES.md
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

There is deliberately no `celeste.p8` and no hand-written fallback physics cartridge.

## cPanel layout

Use a separate document root such as:

```text
public_html/celeste-studio/
```

`index.html` must be directly in that directory, not inside an extra ZIP-name folder.

A subdomain can point at the same document root if desired.

## HTTPS

Use HTTPS. The private gate uses Web Crypto (`crypto.subtle`) and the browser-local cart vault uses normal modern browser storage APIs. GoDaddy AutoSSL is sufficient when available on the hosting account.

The included `.htaccess` declares the correct JavaScript/module/WebAssembly MIME types and disables stale caching for application code.

## Updating later

Extract a newer CI-generated GoDaddy ZIP over the existing Studio document root. The browser-local original cartridge is stored in IndexedDB, not in the web directory, so updating site files does not package or overwrite it.

## Verification checklist

After a future deployment:

1. Open the HTTPS Studio URL.
2. Confirm only the private password screen is visible initially.
3. Enter the password and confirm the editor loads.
4. Click **Set original Celeste .p8** and choose a compatible text `.p8`.
5. Build/open a level and run Preview.
6. Confirm the preview status says **ORIGINAL CART PHYSICS**.
7. Confirm Z/X/arrows behave like the supplied original cart.
8. Confirm `.8xv` export/import still works.
9. Open DevTools > Network and verify no Celeste `.p8` is uploaded or requested from the server.
