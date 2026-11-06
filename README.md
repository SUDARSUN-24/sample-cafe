# Sample Cafe: one-page website template for Bangkok cafes and shops

A fast, bilingual (Thai first, English second) one-page site for a small shop. It is built to turn a
first-time visitor on a phone into a customer: **Directions**, **LINE**, **Call** or walking in.

- Plain HTML, CSS and JavaScript. **No build step, no frameworks, no trackers, no CDN.**
- **Everything shop-specific is in one file: [`site/config.js`](site/config.js).**
- Drag the `site` folder onto Netlify, or deploy it with the Vercel CLI, and it's live.
- **Live demo:** https://sample-cafe-bangkok.vercel.app

All content is fictional demo content for "Sample Cafe". Put a real shop's details in only with the
owner's permission.

```
sample-cafe/
├── site/                  ← THE WEBSITE. This is the folder you drag onto Netlify.
│   ├── config.js          ← edit this for each shop
│   ├── index.html         ← page skeleton (filled from config by the bake step)
│   ├── 404.html           ← "page not found" (generated)
│   ├── netlify.toml       ← security + cache headers (Netlify)
│   ├── vercel.json        ← the same headers (Vercel)
│   ├── css/  js/  assets/ ← styles, scripts, fonts, photos
│   └── robots.txt, sitemap.xml, site.webmanifest, icons (generated)
├── images-src/            ← original photos (NOT uploaded; tools/images.py makes web versions)
├── tools/
│   ├── images.py          ← resize photos, make AVIF/WebP, placeholders, favicons, OG image
│   ├── bake.mjs           ← copy config.js content into the HTML (for Google + link previews)
│   ├── serve.mjs          ← local test server that behaves like Netlify
│   └── tests/             ← screenshots, click-through tests, Lighthouse + accessibility
├── README.md              ← you are here
├── HOW_IT_WORKS.md        ← every file explained, for learning
└── CREDITS.md             ← photo, font and code credits
```

**You need:** [Node.js](https://nodejs.org) 22+ and, only for new photos, Python 3.10+ with
`pip install pillow` (Pillow 11.3 or newer, for AVIF).

---

## Preview it on your computer

```bash
node tools/serve.mjs
```

Then open http://localhost:8080. Double-clicking `site/index.html` also works, but the map preview
and "copy address" are limited there. Use the server for real testing.

---

## Rebrand for a new shop in under 30 minutes

| Time | Step |
| --- | --- |
| 5 min | **Collect** the shop name (Thai and English), address, map pin, hours, phone, LINE link, Instagram, menu with prices, 10–15 photos, and the owner's OK. |
| 10 min | **Edit `site/config.js`** from top to bottom. Every place that needs changing is marked `CHANGE-ME`. |
| 5 min | **Photos:** put them in `images-src/` with the names used in `config.photos`, then run `python tools/images.py`. |
| 1 min | **Bake:** `node tools/bake.mjs`. Read the "Please check" list it prints. |
| 4 min | **Check** at http://localhost:8080 on desktop *and* on your phone (same Wi-Fi: `http://<your-PC-IP>:8080`). |
| 5 min | **Deploy** (see below), then test the live link on a phone. |

**Change the colors:** set `theme:` in config.js to `"warmClassic"`, `"modernMinimal"` or
`"freshGreen"`. Or copy one of the themes, rename it, change the hex colors, then run
`node tools/tests/contrast.mjs` to confirm text stays readable (4.5:1).

**Where do I get the map pin?** In Google Maps, right-click the shop and click the numbers at the
top of the menu (e.g. `13.70536, 100.60143`) to copy them.

**LINE link:** in LINE Official Account Manager, use the "Add friend" URL
(`https://line.me/R/ti/p/@yourid`). The QR code on the page is generated from this link.

---

## CHANGE-ME checklist

Tick every line before showing a client.

**config.js**
- [ ] `site.url`: the real address (e.g. `https://somchai-coffee.netlify.app`, no `/` at the end)
- [ ] `site.demoNotice: false`: removes the "demo website" note in the footer
- [ ] `business.name` (th + en), `monogram`, `tagline`, `eyebrow`, `schemaType`
- [ ] `theme`
- [ ] `contact.phone` (`+66…` format) and `phoneDisplay`
- [ ] `contact.line.id` and `contact.line.url`: **scan the QR on the page with your phone to test it**
- [ ] `contact.instagram`
- [ ] `location.address`, `street`, `locality`, `postalCode`, **`geo`** (check the pin on the map!)
- [ ] `location.steps`: walk the route yourself or ask the owner; name things a first-timer can see
- [ ] `location.transit` and `parking`
- [ ] `hours.weekly`, `closedDates`, `note`
- [ ] `photos`: one entry per photo with **alt text in both languages** that describes the photo
- [ ] `signature.items` and `menu.categories`: names, prices, badges
- [ ] `story`: 2–3 true sentences from the owner
- [ ] `reviews`: **real reviews only** (see below). Set `isSample: false` only when they are real,
      or delete the items to hide the section.
- [ ] `seo.title` (about 60 characters) and `seo.description` (about 150)

**Files**
- [ ] Old demo photos removed from `images-src/` and replaced with the shop's photos
- [ ] `python tools/images.py` then `node tools/bake.mjs` run, with no warnings left
- [ ] `frame-src` in `netlify.toml` / `vercel.json` matches `location.embed` (OSM or Google)
- [ ] After deploy: link preview tested by sending the URL to yourself in LINE

### About reviews

Never invent testimonials. That's misleading to customers and against consumer protection rules.
Use reviews the shop really received, with the reviewer's permission, or clearly attributed (for
example "Google review, March 2026"). Put the platform in `source`. While `isSample` is `true`, the
page shows a visible "sample text" label. Reviews are never added to Google structured data, because
Google doesn't allow a business to mark up reviews of itself.

---

## Image prep guide

**Never hotlink photos from other websites.** Use the shop's own photos, or photos the shop has
the rights to.

| Photo | Used for | Shoot / crop as | Minimum source size |
| --- | --- | --- | --- |
| `hero` | Full-screen top photo | Landscape 3:2, subject a little right of centre, calm dark area at the bottom for text | **3000 × 2000** |
| Signature items | 4 menu highlight cards | Square-ish or portrait, the dish fills the frame | 1600 px wide |
| `story-*` | Arch-shaped photo in "Our story" | Portrait 4:5 works best | 1600 px wide |
| Gallery `g-*` | Grid + full-screen viewer | Mix of landscape and 1–2 portrait (`size: "tall"`) | 1920 px wide |
| Find-us step photo | e.g. the entrance or the sign | Landscape 3:2, taken from where customers arrive | 1280 px wide |

**Tips that make a shop look expensive:**
- Shoot in daylight near a window. Turn off the yellow ceiling lights. No flash.
- Keep the phone level, step back, and show one thing per photo.
- Take the hero photo with nothing important in the bottom third (the name goes there).
- Use the same time of day for all photos so the colors match. `images.py` also applies one gentle,
  consistent color grade to every photo.

**Then:**
1. Save as JPEG (or PNG/WebP) in `images-src/`, named exactly like the key in `config.photos`
   (e.g. `images-src/latte.jpg` → `"latte"`). Use lowercase with dashes.
2. Add alt text for each photo in `config.photos` (what a blind visitor needs to know, in one sentence).
3. If a crop cuts off the important part, set `focus: "x% y%"` (e.g. `"30% 60%"` = left and lower).
4. Run `python tools/images.py`, then `node tools/bake.mjs`.

What `images.py` makes for each photo: AVIF + WebP at up to 6 widths (400–1920 px; up to 2560 px
for the hero) for responsive `srcset`, two JPEG fallbacks, a tall 9:16 crop of the hero for phones,
a tiny blurred placeholder, and content-hashed file names so long browser caching is safe. It also
makes the 1200×630 link-preview image and the favicons. Typical result: the phone hero is about
33 KB on a typical phone and about 200 KB on the sharpest screens, instead of a multi-megabyte
original.

---

## Deploy to Netlify (drag and drop)

1. Run `node tools/bake.mjs` one last time.
2. Go to https://app.netlify.com/drop (log in or create a free account).
3. Drag the **`site`** folder (not the whole project) onto the page. Wait about 30 seconds.
4. Netlify gives you a random address. Click **Site configuration → Change site name** to get
   e.g. `somchai-coffee.netlify.app`.
5. If the address changed, update `site.url` in `config.js`, run `node tools/bake.mjs`, and drag the
   folder again: **Deploys → drag a new folder onto the deploy area** (this updates the same site).
6. **Check the security headers arrived:**
   ```bash
   curl -I https://somchai-coffee.netlify.app
   ```
   You should see `content-security-policy`, `x-frame-options` and `referrer-policy`. If they are
   missing, `netlify.toml` wasn't read:
   - Make sure it is directly inside the `site` folder you dropped, not in a sub-folder.
   - If it still doesn't work, move the same `[[headers]]` rules into a file called `_headers`
     in `site/` (Netlify's other header format: search "custom headers" on
     https://docs.netlify.com). Or deploy from GitHub: connect the repo
     and set the publish directory to `site`. Both of those always apply headers.
   - The site still works without the headers. It just loses the extra security layer.
7. Test the live site with https://pagespeed.web.dev (choose "Mobile").
8. Optional: **Domain management → Add a domain** to use the shop's own domain. HTTPS is free and
   automatic.

Updating later: edit config → bake → drag the `site` folder onto the site's **Deploys** page.

> **Note (November 2026):** Netlify's free plan now adds a "Hosted on Netlify" badge script to
> every page. This site's security policy blocks it, so the badge doesn't show, but the browser
> console logs 2 errors and Lighthouse Best Practices drops to about 92. A paid Netlify plan can
> switch the badge off. Otherwise use Vercel (below), which adds nothing to the page.

## Deploy to Vercel (what the demo uses)

The demo is live at **https://sample-cafe-bangkok.vercel.app**. `site/vercel.json` holds the
same security and cache headers as `netlify.toml`. `site/.vercelignore` keeps tool files out of
the upload.

```bash
npx vercel@latest login                                    # once, opens the browser
cd site
npx vercel@latest link --yes --project <shop-name>         # once per shop
npx vercel@latest build --prod
npx vercel@latest deploy --prebuilt --prod --yes
```

1. The last command prints the live address (`Aliased https://…vercel.app`). If the name you
   wanted was taken, Vercel adds a word to it (e.g. `-peach`). For a nicer address, run
   `npx vercel@latest domains add <nice-name>.vercel.app <shop-name>` and deploy again.
2. Put that address in `site.url` in `config.js`, run `node tools/bake.mjs`, and repeat the last
   two commands.
3. Check the headers: `curl -I https://<address>` should show `content-security-policy`.

Vercel's free (Hobby) plan is for **non-commercial** use. That's fine for this demo and your
portfolio. A paying client's site needs Vercel Pro, or Netlify.

---

## Testing

```bash
cd tools && npm install && cd ..   # once: Playwright, Lighthouse, axe (uses your installed Chrome)
node tools/serve.mjs               # keep running in a second terminal

node --test tools/tests/hours.test.mjs   # opening-hours logic (no browser needed)
node tools/tests/contrast.mjs      # color contrast of all 3 themes
node tools/tests/interactions.mjs  # clicks every button, tab, lightbox, toggle (77 checks)
node tools/tests/screens.mjs       # screenshots at 360/390/768/1440 → ./shots
node tools/tests/audit.mjs         # Lighthouse (median of 3) + axe accessibility scan
```

Tip: keep `tools/node_modules` out of OneDrive, or pause syncing while installing.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Changed config but LINE/Facebook preview shows old text | Run `node tools/bake.mjs` and redeploy. Previews are cached by LINE for a while too. |
| Console says "config.js changed since the last bake" | Same: run the bake. The page still works meanwhile. |
| A photo is grey | Its name in `config.photos` doesn't match a file in `images-src/`, or `images.py` wasn't run. |
| Map preview stays blank after tapping | `frame-src` in `netlify.toml` must include the map site you chose in `location.embed`. |
| "Open now" is wrong | Check `hours.weekly` uses 24-hour `"HH:MM"`; the time zone is `Asia/Bangkok`. |
| A word (e.g. "Müller", "€", Japanese) shows in a different-looking font | The fonts include all Thai letters but only basic English letters and a few symbols, so other characters fall back to the phone's font. See "Fonts" in HOW_IT_WORKS.md to add them. |
