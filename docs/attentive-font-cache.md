# Attentive fonts — "Use efficient cache lifetimes" (PSI)

PageSpeed Insights flags ~600 KB of font files served from **`creatives.attn.tv`** /
`cdn.attn.tv` with **no cache lifetime** ("None"):

| File | Size |
|---|---|
| Matter-Medium_*.otf | 241 KB |
| Matter-Medium_*.woff2 | 139 KB |
| TAYBirdie….otf | 99 KB |
| TAYRosemary_*.otf | 79 KB |
| font_*.woff | 58 KB |
| font_*.woff | 36 KB |

## What these are
These are **Attentive's** copies of our brand fonts (Matter, TAY Birdie, TAY Rosemary,
FFBlur = `font.woff`), uploaded into Attentive's on-site sign-up **creative** so the
popup matches the brand. Attentive serves them from its own CDN with poor cache headers.

They are **duplicates** — the theme already serves the same fonts from Shopify's CDN
(`cdn.shopify.com`, 1-year immutable cache). See `assets/base.css` `@font-face` blocks.

## Why the theme can't fix it
Cache headers are set by the server that hosts the file. These files live on
`attn.tv`, which we do not control, so **no theme change can set their cache lifetime.**
The fix is in the Attentive dashboard (or by deferring Attentive).

## How to fix (Attentive dashboard / marketing)
Pick one, in order of impact:

1. **Remove the custom uploaded fonts from the Attentive creative.** In the creative
   editor, set the popup text to a system stack (e.g. Arial/Helvetica) or a Google
   Font Attentive caches well. Removes all six downloads. (Brand call on popup look.)
2. **Defer Attentive** so its script/creative loads after LCP (on scroll or a short
   delay). The popup doesn't need to appear in the first ~2 s; its fonts then load off
   the critical path. Biggest LCP win.
3. If custom fonts must stay, upload **woff2-only, Latin-subset** versions to Attentive
   (the `.otf` files above are the raw, uncompressed originals — the 241 KB one alone
   is larger than our entire Shopify-hosted set).
4. Re-evaluate whether Attentive is earning its performance cost.

## Theme-side work (done separately)
Our own fonts are already well-cached. The related theme improvements (preload the
heading face, metric-matched fallbacks to kill font-swap CLS, drop legacy `.eot`) are
in the `feature/font-lcp-preload` branch — independent of the Attentive issue above.
