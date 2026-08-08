# Host CEleste Studio on GoDaddy Web Hosting (cPanel)

CEleste Studio does **not** need Node.js in production. It is a static browser application. The server only returns HTML, CSS, JavaScript modules, the sprite atlas, the generated-preview Lua template, and a WebAssembly PICO-8 runtime.

No PHP, Node.js, npm, database, cron job, WebSocket server, build service, account system, or paid add-on is required.

## Use the generated deployment ZIP

The GitHub Actions **Static deploy package** workflow creates `CEleste-Studio-GoDaddy-Upload.zip`. Use that ZIP rather than copying individual repository files. During CI it downloads the pinned Fake-08 browser runtime, verifies that a generated Studio cartridge loads and steps inside the actual WebAssembly VM, and then includes every production file in the ZIP.

The public document root contains this structure:

```text
.htaccess
index.html
app.js
interaction-fix.js
styles.css
robots.txt
THIRD-PARTY-NOTICES.md
assets/
  pico8-atlas.png
lib/
  format.mjs
  pico8-cart.mjs
  pico8-preview.mjs
preview-runtime/
  celeste-preview.lua
  fake08.js
  fake08.wasm
```

The rest of the repository (`tests`, `package.json`, development docs, CI files, etc.) is not required by the live site.

## Recommended URL: a subdomain

A dedicated subdomain such as `studio.example.com` is cleaner than mixing the editor into an existing website's root.

In GoDaddy Web Hosting (cPanel):

1. Open the GoDaddy product page.
2. Under **Web Hosting**, select **Manage** for the cPanel hosting account.
3. Select **cPanel Admin**.
4. Open **Domains**.
5. Select **Create a New Domain**.
6. Enter the subdomain, for example `studio.example.com`.
7. Clear **Share document root**.
8. Set a dedicated document root, for example `public_html/celeste-studio`.
9. Submit the domain.

If the domain's DNS is managed in the same GoDaddy account, cPanel normally handles the hosted subdomain association. If DNS is managed separately, point the subdomain at the hosting account as appropriate.

## Upload

1. Open GoDaddy **Web Hosting > Manage**.
2. Use **File Manager** for the domain/subdomain.
3. Open the document root you selected.
4. Upload `CEleste-Studio-GoDaddy-Upload.zip`.
5. Extract it in File Manager.
6. Make sure `index.html` itself is directly in the document root — not one extra folder deep.

Example:

```text
public_html/celeste-studio/index.html
public_html/celeste-studio/app.js
public_html/celeste-studio/.htaccess
public_html/celeste-studio/lib/pico8-preview.mjs
public_html/celeste-studio/preview-runtime/fake08.wasm
```

## Why `.htaccess` is included

The supplied `.htaccess`:

- makes `index.html` the directory index;
- declares `.js`/`.mjs` as JavaScript;
- declares `.wasm` as `application/wasm`, which is required for efficient browser WebAssembly loading;
- prevents stale HTML/JavaScript/Lua glue after an update while allowing binary/static assets to cache normally;
- adds conservative security/referrer headers.

It intentionally does not require URL rewriting or server-side code.

## Real PICO-8 preview

Preview is still completely static-host compatible. The visitor's browser loads `fake08.wasm`, Studio generates a temporary `.p8` cartridge from the current level entirely in memory, Fake-08 executes that cart locally, and Studio displays the VM's 128×128 framebuffer. No level data is sent to a server.

## Updating Studio later

Replace the site's contents with the newer generated GoDaddy ZIP while preserving the directory structure. The cache rules are designed so visitors receive updated application code without needing a hard refresh.

## Verification checklist

After upload, open the public URL in a normal/private browser window and verify:

- the editor loads without a blank page;
- the sprite palette displays real Celeste/PICO-8 art;
- adding and rotating pieces works;
- Preview says **Real PICO-8 cartridge running in Fake-08** and responds to arrows/Z/X;
- after a Climb Chest, C acts as the preview grab key (MATH on calculator);
- Save Project downloads a `.celproj` file;
- Export Level downloads an `.8xv` file;
- importing that `.8xv` works again;
- refreshing the page preserves autosaved work in that browser.

Browser autosave uses the visitor's local browser storage. User projects are not uploaded to the GoDaddy account.
