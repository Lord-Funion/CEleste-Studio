# Host CEleste Studio on GoDaddy Web Hosting (cPanel)

CEleste Studio does **not** need Node.js in production. It is a static browser application. The server only needs to return the HTML, CSS, JavaScript modules, and sprite atlas files.

No PHP, Node.js, npm, database, cron job, WebSocket server, build service, account system, or paid add-on is required.

## Files required on the public website

Preserve this structure in the site's document root:

```text
.htaccess
index.html
app.js
styles.css
robots.txt
assets/
  pico8-atlas.png
lib/
  format.mjs
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
4. Upload the deployment ZIP or the required files above.
5. If uploading a ZIP, extract it in File Manager.
6. Make sure `index.html` itself is directly in the document root — not one extra folder deep.

Example of the correct layout:

```text
public_html/celeste-studio/index.html
public_html/celeste-studio/app.js
public_html/celeste-studio/styles.css
public_html/celeste-studio/.htaccess
public_html/celeste-studio/lib/format.mjs
public_html/celeste-studio/assets/pico8-atlas.png
```

## Why `.htaccess` is included

The supplied `.htaccess` does three useful things for shared Apache hosting:

- makes `index.html` the directory index;
- declares `.mjs` as JavaScript so ES-module imports are served with a browser-acceptable MIME type;
- prevents old HTML/JS/CSS from being aggressively cached after an update while allowing the sprite image to cache normally.

It intentionally does not require URL rewriting or server-side code.

## Updating Studio later

Overwrite the public runtime files with the newer versions while keeping the same directory structure. The cache rules are designed so visitors receive updated application code without needing a hard refresh.

## Verification checklist

After upload, open the public URL in a normal/private browser window and verify:

- the editor loads without a blank page;
- the sprite palette displays real Celeste/PICO-8 art;
- adding and rotating pieces works;
- Preview opens and runs;
- Save Project downloads a `.celproj` file;
- Export Level downloads an `.8xv` file;
- importing that `.8xv` works again;
- refreshing the page preserves autosaved work in that browser.

Browser autosave uses the visitor's local browser storage. User projects are not uploaded to your GoDaddy account.
