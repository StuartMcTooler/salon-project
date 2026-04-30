# Marketing Homepage — Final Build Plan

All corrections from the thread are locked in. Approve this plan and I'll write the files.

## Files

**Create**
- `src/pages/Home.tsx` — full marketing page with `<Helmet>` (your exact title + description). Tokens: accent `#10b981`, black `#0a0a0a`, soft grey `#f6f6f5`, italic tag colour `#2a2a2a`. Hero h1 + manifesto h2 use `font-weight: 800` + `letter-spacing: -0.03em`. Smooth-scroll anchors `#how`, `#why`, `#pricing`.
- `src/pages/RequestInvite.tsx` — placeholder. Black bg, "Invite-only" pill, h1 "Bookd is invite-only right now.", body copy referencing @bookd_ie, single CTA "Open Instagram →" → `https://instagram.com/bookd_ie`. No form. No backend.

**Modify**
- `src/pages/Index.tsx` — replace `navigate("/discover")` web branch with an in-place render of `<Home />` via a `showHome` state flag. Native (`isNativeApp()`) routing, password-recovery flow, and authenticated-redirect logic untouched.
- `src/App.tsx` — add `import RequestInvite` and register `<Route path="/request-invite" element={<RequestInvite />} />` above the catch-all.

**Untouched:** `Marketing.tsx`, `/discover`, `/preview/:handle`, all DB / edge functions, all Capacitor logic.

## Locked corrections (all in)

### A. "In the box" — 6 complement tiles (no overlap with pillars)
Revenue dashboard · Look book / visual history · Voice notes → text · Customer referrals · Rewards & loyalty · GDPR sign-off built in. Exact descriptions from your message.

### B. Comparison columns — Bookd card BLACK, Booksy card MUTED GREY
Bookd: `backgroundColor: #0a0a0a`, white text, accent-green check marks. Booksy/Square: `bg-neutral-50`, red `X` marks.

### C. Pillar sub-headlines — italic `#2a2a2a` tag between H3 and bullets
- Pillar 1: *"You own the relationship. Take it with you anywhere."*
- Pillar 2: *"Even when you're booked out, you still get paid."*
- Pillar 3: *"Stop watching gaps appear at 3pm."*

### D. NEW — Comparison cards SIDE-BY-SIDE on desktop/tablet
Container is an inline-style grid:
```
display: grid;
grid-template-columns: 1fr 1fr;
gap: 20px;
```
Collapses to single column only at `max-width: 720px` (via a Tailwind arbitrary-variant override `[@media(max-width:720px)]:!grid-cols-1`). Booksy/Square card on the LEFT, Bookd card on the RIGHT.

## Section order (final)

1. Sticky white nav — anchors + black "Request invite" CTA
2. Hero (black) — eyebrow pill, 3-line H1 with green "Boost your income.", subhead, green primary + outline secondary CTA, invite-only badge row, 3 stat tiles (No hardware / Same day / Yours)
3. How it works (white) — 3 numbered cards (Get your invite / Set your column / Get paid)
4. Why Bookd (soft grey) — 3 pillar cards with italic tag (correction C) + 4 bullets each
5. Manifesto (black) — "Your chair. Your clients. **Your money.** Your rules."
6. vs. The old way (white) — **2-column grid** (correction D), Booksy LEFT (grey), Bookd RIGHT (black)
7. In the box (soft grey) — 6 complement tiles (correction A)
8. Built for what's coming next (black rounded card on white) — 3 AI roadmap items with your exact copy
9. Pricing (white) — Bookd Pro card, €20/month, 6 features, 50¢ fine print, "Request an invite" CTA
10. Customer CTA strip (soft grey) — "Looking for a barber?" + outline "Find a barber" → /discover
11. Footer (white) — Bookd · Made in Ireland · Privacy / Terms / Contact

## Technical notes

- All custom hex values applied via inline `style={{}}` so `index.css` / `tailwind.config.ts` stay untouched.
- shadcn `Button` + `lucide-react` icons (already installed): ArrowRight, Activity, Image, Mic, Users, Shield, ShieldCheck, Wand2, Zap, Smartphone, Check, X, Instagram, ArrowLeft.
- Native (Capacitor) staff users still hit Index.tsx routing logic — they never see the homepage.
- No new dependencies. No DB migration. No edge function changes. No security-relevant changes.

## After build
You'll get a diff-style before/after summary covering all 4 touched files.
