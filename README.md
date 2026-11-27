# VisaCheck

Free, browser-based Schengen short-stay visa file checker for applicants worldwide. An optional $9 USD Gumroad purchase unlocks client-generated cover letter and itinerary PDFs.

## Run locally

Use Node.js 22.12+:

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run preview` serves the built site locally.

## Verify and submit VisaCheck for free indexing

The production canonical origin defaults to `https://visacheck-isxx.onrender.com`. If the published domain changes, set `SITE_URL` to the new HTTPS origin (no path) **at build time**. The same value controls canonical URLs, structured data, `sitemap.xml`, and the sitemap URL in `robots.txt`.

After this change is merged, Rishabh (or someone with access to the Render service and accounts) should:

1. In [Google Search Console](https://search.google.com/search-console), add the **URL prefix** property `https://visacheck-isxx.onrender.com/` and choose **HTML tag** verification. Copy only the `content` value of the `google-site-verification` tag, not the whole tag. Use a URL-prefix property, not the DNS-based Domain option; the site is on a Render subdomain.
2. In [Bing Webmaster Tools](https://www.bing.com/webmasters/), add `https://visacheck-isxx.onrender.com/` manually and select **HTML Meta Tag** verification. Copy the `content` value of the `msvalidate.01` tag. Alternatively, Bing can import the verified Google Search Console property instead of using a separate token.
3. In the [Render dashboard](https://dashboard.render.com/), open the VisaCheck service → **Environment** → **Add Environment Variable**. Set `GOOGLE_SITE_VERIFICATION` and, for manual Bing verification, `BING_SITE_VERIFICATION`. Choose **Save, rebuild, and deploy** (or trigger a new build and deploy after saving); restarting an existing build is not enough. The build writes the tags into the homepage HTML only when their tokens are set. Keep them in Render for future verification checks.
4. Once the rebuilt homepage is public, click **Verify** in the respective dashboards. In Google’s **Sitemaps**, submit `sitemap.xml` for the property. In Bing’s **Sitemaps**, submit [https://visacheck-isxx.onrender.com/sitemap.xml](https://visacheck-isxx.onrender.com/sitemap.xml). Optionally inspect the homepage and each guide with **URL Inspection** and request indexing. Submission does not guarantee indexing or ranking, and none of these steps requires a paid plan.

## Deploy to Cloudflare Pages

Connect the GitHub repository and set the production branch to `main`, the build command to `npm run build`, and the build output directory to `dist`. Pages reads Node 22 from `.node-version` and applies the security headers copied from `public/_headers`. No redirects are required. The existing `netlify.toml` remains available for Netlify deployments.

## Files and launch

- `index.html`, `terms.html`, `src/style.css`, and `src/app.js`: responsive checker, privacy/terms, browser storage and UI.
- `src/rules.js` and `src/countries.js`: audit logic, official references, and country options. The tool identifies the destination country, not the exact local visa application centre; check local filing jurisdiction and mission-specific document requirements separately.
- `src/config.js` and `src/payment.js`: product ID, checkout URL and public Gumroad license verification. The browser stores a local verified flag, not the license itself. This client-side gate is not DRM.
- `src/pdfs.js`: lazy-loaded PDF generation. Use Latin spellings for PDF input.
- `test/*.test.js`: rule, payment integration contract and PDF unit tests.

Enable license keys on the Gumroad product before going live. To smoke-test, redeem a private 100%-off creator discount, retrieve the purchase license key, load the sample trip, unlock with the key and download both PDFs. The checkout and license verification must be tested separately from the unit suite.
