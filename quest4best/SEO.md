# Quest4Best website — SEO and Google Search Console

## What is already on the site

| Item                    | Where                                 | Detail                                                                                                               |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Page title (58 chars)   | `index.html`                          | `Quest4Best Consulting \| Strategic Advisory in South Africa`                                                        |
| Meta description (148)  | `index.html`                          | Strategy consulting for South African leaders: growth strategy, business transformation and leadership advisory.     |
| Keywords meta           | `index.html`                          | Included for completeness. Google ignores it, and Bing gives it little weight.                                       |
| Robots meta             | `index.html`                          | `index, follow`, large image previews allowed                                                                        |
| Canonical and hreflang  | `index.html`                          | `en-ZA` plus `x-default`, built from `VITE_SITE_URL`                                                                 |
| Open Graph / Twitter    | `index.html`                          | Title, description and a 1200×630 preview image for LinkedIn, WhatsApp and X                                         |
| Structured data         | `index.html` (JSON-LD)                | ProfessionalService with three services, contact point and area served; Person (Mlungisi Mathonsi); WebSite; WebPage |
| `sitemap.xml`           | Generated at build (`vite.config.ts`) | Home page, last-modified date, and every photograph as an image entry                                                |
| `robots.txt`            | Generated at build                    | Allows everything and points to the sitemap                                                                          |
| Search engine ownership | `GOOGLE_SITE_VERIFICATION` / `BING_…` | Meta tags injected at build when the repository variables are set                                                    |
| Crawlable content       | Pre-rendered HTML                     | All text is in the HTML before JavaScript runs                                                                       |
| Speed and accessibility | Lighthouse                            | Mobile 97 / Desktop 100 performance; 100 accessibility and SEO                                                       |

## Keyword plan

A single page ranks first for the brand and the person, then for specific phrases the page
genuinely covers. The broad, competitive phrases ("management consulting South Africa") need
more pages and links over time. See the next steps below.

| Priority | Keyword / phrase                         | Intent              | Where it appears                                         |
| -------- | ---------------------------------------- | ------------------- | -------------------------------------------------------- |
| 1        | Quest4Best Consulting (and variants)     | Brand               | Title, logo alt, structured data `alternateName`, footer |
| 1        | Mlungisi Mathonsi                        | Person / reputation | About heading, Person schema, image alt text             |
| 2        | strategic advisory South Africa          | Service, local      | Title, hero label, description, footer                   |
| 2        | strategy consulting South Africa         | Service, local      | Description, footer, keywords, schema `knowsAbout`       |
| 2        | leadership advisory / executive advisory | Service             | Service heading, description, schema service type        |
| 2        | business transformation consulting       | Service             | Service heading "Transformation", description, schema    |
| 3        | growth strategy consultant               | Service             | Service heading "Strategic Growth", description, schema  |
| 3        | independent strategy consultant          | Differentiator      | Hero label, hero supporting line                         |

Rules followed: no hidden text, no keyword stuffing, and every phrase is backed by real copy on
the page.

## Google Search Console: step by step

Do this once the site is live on its final domain.

1. Open <https://search.google.com/search-console> with the Google account that should own the
   site, then choose **Add property**.
2. **Recommended: Domain property** (`quest4best.co.za`). Google gives a TXT record. Add it at the
   domain's DNS host (the registrar or email provider). This covers `www`, `http` and `https` in
   one go and needs no site change.
3. **Alternative: URL-prefix property** (for example the GitHub Pages address). Choose **HTML
   tag** and copy only the `content="…"` value. In GitHub, go to Settings → Secrets and variables
   → Actions → Variables, add `GOOGLE_SITE_VERIFICATION` with that value, and re-run the deploy.
   Then click **Verify** in Search Console.
4. Go to **Sitemaps**, enter `sitemap.xml` and click **Submit**.
5. Go to **URL inspection**, paste the home page URL and click **Request indexing**.
6. Optional: the same for Bing at <https://www.bing.com/webmasters>. You can import directly from
   Search Console, or set `BING_SITE_VERIFICATION`.

Indexing usually takes a few days. Check **Performance** after two to four weeks to see which
searches show the site.

## After launch: what moves rankings

1. **Google Business Profile.** Create one if Quest4Best has a service area or office address.
   This matters most for local searches.
2. **LinkedIn.** Link the company page and Mlungisi's profile to the website, and send the URLs
   so they can be added to the structured data (`sameAs`). This ties the brand together for
   Google.
3. **Content.** Add an "Insights" section with two or three articles a quarter on real client
   questions (for example "How to decide between growth and consolidation"). Each article is a
   new page that can rank.
4. **Links.** Get mentions from business directories, industry bodies, speaking engagements and
   partner firms.
5. **Custom domain.** On GitHub Pages under `/Magugu-Nzimande/`, `robots.txt` is not at the
   domain root, so Google ignores it. The sitemap still works when submitted in Search Console.
   On `quest4best.co.za` everything is in the right place.
