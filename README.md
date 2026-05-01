# CardPromo LK

A Progressive Web App (PWA) to discover credit and debit card promotions available in Sri Lanka.

## Features

- Browse active promotions from multiple Sri Lankan banks
- Filter by bank, category, card type, and card network
- Full-text search across offers, merchants, and banks
- **My Cards** — select your cards locally (no login required, stored in browser)
- Show only promotions matched to your selected cards
- Offer detail pages with terms and conditions
- SEO-optimised with pre-rendered static HTML, structured data, and sitemap
- Installable as a PWA with offline support
- Mobile-first responsive design

## Tech Stack

| Tool | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite 6 | Build tool |
| Tailwind CSS v4 | Styling |
| React Router v7 | Routing |
| react-helmet-async | SEO meta tags |
| vite-plugin-pwa | PWA / service worker |
| Custom SSR prerender | Static site generation |
| LocalStorage | Selected cards persistence |

## Folder Structure

```
src/
  app/            App router and layout wiring
  components/
    cards/        CardSelector, SelectedCardsList
    common/       Badge, EmptyState, SearchInput
    layout/       Header, BottomNav, Footer, PageContainer
    offers/       OfferCard, OfferGrid, OfferFilters
    seo/          MetaTags, StructuredData
  data/           banks.json, cards.json, categories.json, offers.json
  hooks/          useLocalStorage, useSelectedCards, useOfferFilters
  pages/          HomePage, MyCardsPage, OfferDetailsPage, BankPage, CategoryPage
  styles/         global.css (Tailwind v4 theme)
  types/          TypeScript interfaces
  utils/          offerMatching, dateUtils, normalization
  entry-server.tsx  SSR render entry (used for pre-rendering)
  main.tsx          Client entry

scripts/
  prerender.ts        Generates static HTML per route
  generate-sitemap.ts Generates sitemap.xml
  generate-icons.ts   Generates PWA PNG icons from SVG

public/
  icons/          App icons (SVG + generated PNGs)
  robots.txt
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Generate PWA Icons (one-time setup)

```bash
npm install --save-dev sharp
npm run generate:icons
```

This creates `public/icons/icon-192.png` and `public/icons/icon-512.png` from the SVG source.

### Build (with SSG pre-rendering)

```bash
npm run build
```

This runs three steps:
1. `vite build` — client bundle to `dist/`
2. `vite build --ssr` — SSR bundle (temporary)
3. `tsx scripts/prerender.ts` — renders each route to static HTML
4. `tsx scripts/generate-sitemap.ts` — writes `dist/sitemap.xml`

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Cloudflare Pages (recommended)

1. Push to GitHub
2. Connect repo in Cloudflare Pages dashboard
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variable: `VITE_SITE_URL=https://your-domain.com`

Add a `public/_redirects` file for client-side routing:
```
/* /index.html 200
```

### GitHub Pages

1. Build: `npm run build`
2. Deploy `dist/` to GitHub Pages (via GitHub Actions or `gh-pages` package)
3. Since all routes are pre-rendered to `/route/index.html`, no redirect config is needed

### Netlify / Vercel

Both platforms support static output from `dist/` with zero config.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_SITE_URL` | Production site URL for sitemap | `https://cardpromo.lk` |

## Adding Promotions

Edit `src/data/offers.json`. Each offer follows the `Offer` interface in `src/types/offer.ts`.

Set `isActive: false` to hide an offer without deleting it (for expired tracking).

## Future Roadmap

- [ ] User accounts and saved profiles
- [ ] Push notifications for new offers
- [ ] Admin approval workflow
- [ ] Automated web scraping pipeline (bank websites, PDFs, social media)
- [ ] Backend API (FastAPI / NestJS + PostgreSQL)
- [ ] Bank and merchant submission portal
- [ ] Expansion to IN, SG, AE markets (`countryCode` field is ready)
- [ ] Location-based offers

## Privacy

CardPromo LK never asks for card numbers, CVV, expiry dates, NIC, or phone numbers. Only non-sensitive card identifiers (bank name, card type, network) are stored locally in the browser.

## Disclaimer

Promotion information is collected from public sources and may change without notice. Please verify the final offer details with the relevant bank or merchant before making a purchase.

---

© 2026 CardPromo LK
