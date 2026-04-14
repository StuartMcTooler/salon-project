

## Plan: Create /support and /marketing pages

Two new public pages with SEO meta tags, matching the existing PrivacyPolicy page style.

### Changes

1. **Create `src/pages/Support.tsx`** — Static support page with the provided content, back button, and Helmet for SEO meta tags.

2. **Create `src/pages/Marketing.tsx`** — Static marketing/landing page with the provided content, back button, and Helmet for SEO meta tags.

3. **Install `react-helmet-async`** — For setting page title and meta description per page.

4. **Update `src/App.tsx`** — Add `/support` and `/marketing` routes above the catch-all. Wrap with `HelmetProvider`.

5. **Update `index.html`** — Add default meta description fallback.

Both pages will follow the same layout pattern as the existing Privacy Policy page (max-w-3xl, back button, clean typography).

