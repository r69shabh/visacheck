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

`npm run preview` serves the built site. Netlify builds with `npm run build` and publishes `dist/` from the connected branch.

## Files and launch

- `index.html`, `terms.html`, `src/style.css`, and `src/app.js`: responsive checker, privacy/terms, browser storage and UI.
- `src/rules.js` and `src/countries.js`: audit logic, official references, and country options. The tool identifies the destination country, not the exact local visa application centre; check local filing jurisdiction and mission-specific document requirements separately.
- `src/config.js` and `src/payment.js`: product ID, checkout URL and public Gumroad license verification. The browser stores a local verified flag, not the license itself. This client-side gate is not DRM.
- `src/pdfs.js`: lazy-loaded PDF generation. Use Latin spellings for PDF input.
- `test/*.test.js`: rule, payment integration contract and PDF unit tests.

Enable license keys on the Gumroad product before going live. To smoke-test, redeem a private 100%-off creator discount, retrieve the purchase license key, load the sample trip, unlock with the key and download both PDFs. The checkout and license verification must be tested separately from the unit suite.
