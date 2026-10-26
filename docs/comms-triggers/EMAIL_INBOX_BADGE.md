# Email inbox sender badge (BIMI / domain favicon)

**Issue:** [#498](https://github.com/Road2Media/set-picks/issues/498)

## Two different logos (do not conflate)

| Layer | What you see | Controlled by | Asset |
|-------|--------------|---------------|-------|
| **In-body header** | Gradient wordmark when the email is **open** | HTML in `MarketingLayout` / `buildBrandedEmailHtml` | `comms/emailBranding.cjs` → `/branding/email-gradient-wordmark.png` |
| **Inbox sender badge** | Small circle beside **Setlist Pick'em** in the **inbox list** | BIMI on the From domain. Domain favicon is only a partial fallback. **Not** the email template | `public/bimi/logo.svg` + DNS (#498) |

**Typical symptom:** the opened email shows the wordmark; the inbox list shows a generic letter or blue person icon. Changing the in-body image will not fix that circle. Gmail does not use the HTML header for the list avatar.

---

## In-body logo (working — keep separate)

- Shared helper: `comms/emailBranding.cjs` → `buildEmailWordmarkUrl()` / `buildEmailWordmarkHeroHtml()`
- Marketing: `emails/src/components/MarketingLayout.jsx`
- Service comms: `functions/commsEmailWorker.js` → `buildBrandedEmailHtml()`
- Legacy path `buildEmailInBodyLogoUrl()` still returns `/favicon/web-app-manifest-512x512.png` for old call sites. Do not point BIMI at it.

---

## Inbox badge — what actually fixes the circle

Both marketing and service mail use `Setlist Pick'em <updates@setlistpickem.com>`. One BIMI record covers both. There is no per-template avatar.

### Primary: BIMI

1. **DMARC** on `setlistpickem.com` at `p=quarantine` or `p=reject`, with SPF or DKIM alignment for `updates@setlistpickem.com`. Already true (see audit below).
2. **Logo** — square SVG Tiny PS, solid background, no scripts, no external refs, under 32 KB. Shipped at `public/bimi/logo.svg` (traced from `public/favicon/favicon-96x96.png`, the same mark as the site icon).
3. **Stable URL with no redirect** — `https://www.setlistpickem.com/bimi/logo.svg`. The apex 308s to www, so the BIMI `l=` tag must use **www**. `vercel.json` sets `Content-Type: image/svg+xml` on `/bimi/*`.
4. **DNS TXT** (human, Cloudflare — not an app deploy):

   ```text
   default._bimi.setlistpickem.com.  TXT  "v=BIMI1; l=https://www.setlistpickem.com/bimi/logo.svg;"
   ```

   That string is `buildBimiTxtRecord()` in `comms/emailBranding.cjs`. Do not publish it until production `www` returns the SVG as `image/svg+xml`. Today, before this ships to production, that path is the SPA HTML fallback.

5. **Evidence certificate** — Gmail shows the logo only with a VMC or a CMC in the `a=` tag (`buildBimiTxtRecord(pemUrl)`). Publishing `l=` alone does nothing in Gmail. Apple Mail can show a BIMI logo without a certificate; treat that as client-dependent, not as a guarantee.

### Partial fallback: domain favicon

Some non-Gmail clients fetch `https://<from-domain>/favicon.ico` when BIMI is absent. Apex and www already return `200 image/vnd.microsoft.icon` (apex 308s to www). That fallback does not fix Gmail's generic circle.

| Check | URL |
|-------|-----|
| www | `https://www.setlistpickem.com/favicon.ico` → `/favicon/favicon.ico` |
| Apex | `https://setlistpickem.com/favicon.ico` → 308 → www |
| BIMI logo | `https://www.setlistpickem.com/bimi/logo.svg` |

---

## DNS audit — rechecked 2026-10-22 (#498)

Live `dig` against public DNS. SPF on the Resend return-path is no longer missing.

| Record | Found | Verdict |
|--------|-------|---------|
| DMARC `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | BIMI policy prerequisite met. `rua` is still the registrar default |
| DKIM `resend._domainkey` | RSA key published | Signs `d=setlistpickem.com` |
| TXT `send.setlistpickem.com` | `v=spf1 include:amazonses.com ~all` | Present (was missing on 2026-08-03) |
| MX `send.setlistpickem.com` | `10 feedback-smtp.us-east-1.amazonses.com` | Resend return-path |
| BIMI `default._bimi` | none | Not published. Logo file is in the repo as of v1.91.0; DNS is still human |
| Favicon apex / www | 308 → www, then `200 image/vnd.microsoft.icon` | Reachable |

August 2026 detail (SPF gap, since closed) stays in git history of this file. Do not re-add the `send` SPF TXT.

### Human actions still required

Do these in order. None of them are an app or Firebase deploy.

1. **Wait until production serves the logo.** After this change is on `www`, `curl -sI https://www.setlistpickem.com/bimi/logo.svg` must show `200` and `content-type: image/svg+xml`. Publishing the TXT earlier fetches the SPA HTML shell.
2. **Publish the TXT** in the `setlistpickem.com` DNS zone (Cloudflare):

   `default._bimi.setlistpickem.com TXT "v=BIMI1; l=https://www.setlistpickem.com/bimi/logo.svg;"`

3. **Decide the Gmail certificate** (business call):
   - **VMC** (DigiCert or Entrust, about $1,000–1,500/yr) needs a registered trademark of the logo. Gmail shows the logo plus the verified check.
   - **CMC** (Common Mark Certificate) drops the trademark requirement when the mark has 12+ months of verifiable use. Gmail shows the logo without the check.
   - Host the PEM at an HTTPS URL that does not redirect, then change the TXT to `buildBimiTxtRecord(pemUrl)` (adds `a=`). The certificate embeds this SVG. VMC and CMC use the same file. Do not replace `public/bimi/logo.svg` after the certificate is issued unless the certificate is reissued to match.
4. **Optional Gmail-only fallback:** a Google account for `updates@setlistpickem.com` with the brand mark as its profile photo. Gmail shows that avatar without BIMI. Covers Gmail only.
5. **Optional:** repoint DMARC `rua` to a mailbox someone reads.

---

## DNS audit commands (human)

```bash
dig +short TXT _dmarc.setlistpickem.com
dig +short TXT send.setlistpickem.com
dig +short TXT default._bimi.setlistpickem.com
curl -sI https://www.setlistpickem.com/bimi/logo.svg | head -15
curl -sI https://www.setlistpickem.com/favicon.ico | head -5
curl -sI https://setlistpickem.com/favicon.ico | head -8
```

Resend: `setlistpickem.com` verified, DKIM active, From `updates@setlistpickem.com`.

---

## QA checklist

- [ ] **Opened email** — gradient wordmark in the header (regression guard)
- [ ] **Production logo** — `https://www.setlistpickem.com/bimi/logo.svg` is `200` + `image/svg+xml` before any TXT publish
- [ ] **Gmail inbox list** — brand icon instead of the generic circle, only after TXT + VMC or CMC
- [ ] Gmail web + iOS
- [ ] Apple Mail inbox list (may show BIMI from `l=` alone; confirm on a device)
- [ ] Service comms from `updates@setlistpickem.com` — same badge as marketing (same From domain)

---

## Related

- #456 branded HTML shell (in-body — working)
- #497 closed as duplicate (mis-scoped in-body bug)
- #662 SERP favicon (separate from this inbox badge)
- `vercel.json` `/favicon.ico` rewrite (domain favicon fallback only)
- `comms/bimiLogo.test.js` — Tiny PS contract and the TXT string
