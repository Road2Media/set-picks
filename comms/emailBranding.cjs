'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Email branding assets — do not conflate layers:
 *
 * 1. **In-body header hero** — horizontal gradient wordmark at
 *    `/branding/email-gradient-wordmark.png` via {@link buildEmailWordmarkHeroHtml}.
 *    CSS background (not a linked `<img>`) so clients cannot open the raw PNG on tap;
 *    Outlook gets a conditional unlinked `<img>` fallback. Used by service shell +
 *    marketing `MarketingLayout`.
 *
 * 2. **Inbox sender badge** — small avatar beside the sender name in Gmail/Apple Mail list
 *    views. NOT driven by the HTML hero. BIMI on `default._bimi.setlistpickem.com`
 *    points at {@link EMAIL_BIMI_LOGO_PATH} (SVG Tiny PS). Domain favicon is only a
 *    partial fallback. See docs/comms-triggers/EMAIL_INBOX_BADGE.md (#498).
 *
 * 3. **Legacy vinyl path** (`EMAIL_IN_BODY_LOGO_PATH` / `buildEmailInBodyLogoUrl`) — kept for
 *    call-site stability; do not use for new email headers.
 */
const EMAIL_IN_BODY_LOGO_PATH = '/favicon/web-app-manifest-512x512.png';
/** Public CDN path — deploy via Vercel (`public/branding/`). */
const EMAIL_WORDMARK_GRADIENT_PATH = '/branding/email-gradient-wordmark.png';
const EMAIL_WORDMARK_PNG_FILE = 'email-gradient-wordmark.png';
/** Resend inline attachment id — referenced as `cid:…` in the HTML shell. */
const EMAIL_WORDMARK_INLINE_CONTENT_ID = 'email-gradient-wordmark';
/** ~96% of the 416px inner shell width; height tracks email-gradient-wordmark.svg (~3:1). */
const EMAIL_SHELL_WORDMARK_WIDTH_PX = 400;
const EMAIL_SHELL_WORDMARK_HEIGHT_PX = 132;
/** design.md brand tokens — service / marketing email shells. */
const EMAIL_BRAND_PRIMARY = '#2dd4bf';
const EMAIL_BRAND_PRIMARY_STRONG = '#14b8a6';
const EMAIL_BRAND_BG_DEEP = '#020617';
/**
 * Domain-favicon fallback for clients that fetch `/favicon.ico` from the From host.
 * Not the BIMI logo. Not injected into email HTML.
 */
const EMAIL_INBOX_BADGE_FAVICON_PATH = '/favicon/favicon-96x96.png';
/**
 * BIMI `l=` logo. Square SVG Tiny PS in `public/bimi/logo.svg`.
 * Host on www (apex 308s, and BIMI rejects a redirect). Not injected into email HTML.
 */
const EMAIL_BIMI_LOGO_PATH = '/bimi/logo.svg';
/** BIMI selector. The TXT name is `{selector}._bimi.{domain}`. */
const EMAIL_BIMI_SELECTOR = 'default';
/** Organizational domain of `updates@setlistpickem.com`. */
const EMAIL_BIMI_DOMAIN = 'setlistpickem.com';
const DEFAULT_SITE_URL = 'https://www.setlistpickem.com';

/** @type {string | null} */
let cachedWordmarkDataUri = null;

/**
 * Absolute URL for the large in-body header logo (opened email).
 * @param {string} [siteUrl]
 * @returns {string}
 */
function buildEmailInBodyLogoUrl(siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}${EMAIL_IN_BODY_LOGO_PATH}`;
}

/** @deprecated Use buildEmailInBodyLogoUrl — kept for call-site stability. */
function buildEmailLogoUrl(siteUrl = DEFAULT_SITE_URL) {
  return buildEmailInBodyLogoUrl(siteUrl);
}

/**
 * Hosted PNG URL (optional — requires web deploy of `public/branding/`).
 * @param {string} [siteUrl]
 * @returns {string}
 */
function buildEmailWordmarkUrl(siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}${EMAIL_WORDMARK_GRADIENT_PATH}`;
}

/**
 * Absolute URL of the BIMI logo. Defaults to www so the URL does not 308.
 * Inbox clients fetch this only after DNS publishes it; email HTML does not.
 * @param {string} [siteUrl]
 * @returns {string}
 */
function buildEmailInboxBadgeLogoUrl(siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}${EMAIL_BIMI_LOGO_PATH}`;
}

/**
 * DNS name for the BIMI TXT record (`default._bimi.setlistpickem.com`).
 * @returns {string}
 */
function buildBimiDnsHost() {
  return `${EMAIL_BIMI_SELECTOR}._bimi.${EMAIL_BIMI_DOMAIN}`;
}

/**
 * BIMI TXT value. Omits `a=` until a human hosts a VMC or CMC PEM.
 * A blank certificate URL is omitted. A non-HTTPS evidence URL throws.
 * The logo URL is always the production www host — BIMI is looked up on the From
 * domain, not on a preview origin.
 * @param {string} [certificateUrl]
 * @returns {string}
 */
function buildBimiTxtRecord(certificateUrl) {
  const logo = buildEmailInboxBadgeLogoUrl(DEFAULT_SITE_URL);
  if (certificateUrl == null || String(certificateUrl).trim() === '') {
    return `v=BIMI1; l=${logo};`;
  }
  const cert = String(certificateUrl).trim();
  if (!/^https:\/\//i.test(cert) || /\s/.test(cert)) {
    throw new Error('BIMI certificate URL must be a single https URL');
  }
  return `v=BIMI1; l=${logo}; a=${cert};`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Non-clickable horizontal brand hero for email headers (service + marketing).
 * CSS background for modern clients; MSO conditional unlinked `<img>` fallback.
 *
 * @param {string} [siteUrl]
 * @param {{ wordmarkSrc?: string }} [opts]
 * @returns {string} HTML fragment (no outer wrapper)
 */
function buildEmailWordmarkHeroHtml(siteUrl = DEFAULT_SITE_URL, opts = {}) {
  const resolved =
    typeof opts.wordmarkSrc === 'string' && opts.wordmarkSrc.trim()
      ? opts.wordmarkSrc.trim()
      : buildEmailWordmarkUrl(siteUrl);
  const src = escapeHtmlAttr(resolved);
  const w = EMAIL_SHELL_WORDMARK_WIDTH_PX;
  const h = EMAIL_SHELL_WORDMARK_HEIGHT_PX;
  const blockStyle = [
    `width:${w}px`,
    'max-width:100%',
    `height:${h}px`,
    'margin:0 auto',
    `background-image:url('${src}')`,
    'background-size:contain',
    'background-repeat:no-repeat',
    'background-position:center',
  ].join(';');

  return `<!--[if mso]>
<img src="${src}" width="${w}" height="${h}" alt="Setlist Pick'em" style="display:block;margin:0 auto;max-width:${w}px;width:100%;height:auto;border:0;" />
<![endif]-->
<!--[if !mso]><!-->
<div role="presentation" aria-hidden="true" style="${blockStyle}"></div>
<!--<![endif]-->`;
}

/**
 * @returns {Buffer}
 */
function readEmailWordmarkPngBuffer() {
  const pngPath = path.join(__dirname, EMAIL_WORDMARK_PNG_FILE);
  return fs.readFileSync(pngPath);
}

/**
 * @deprecated CID inline attachments — Gmail treats these as downloadable files. Use {@link buildEmailWordmarkUrl}.
 * @returns {string}
 */
function buildEmailWordmarkCidSrc() {
  return `cid:${EMAIL_WORDMARK_INLINE_CONTENT_ID}`;
}

/**
 * Resend inline attachment for the service comms shell wordmark (Node SDK shape).
 * @returns {{ filename: string, content: string, contentType: string, inlineContentId: string }}
 */
function buildEmailWordmarkResendAttachment() {
  const buf = readEmailWordmarkPngBuffer();
  return {
    filename: EMAIL_WORDMARK_PNG_FILE,
    content: buf.toString('base64'),
    contentType: 'image/png',
    inlineContentId: EMAIL_WORDMARK_INLINE_CONTENT_ID,
  };
}

/**
 * REST API attachment shape for raw `fetch` to api.resend.com (preview script).
 * SDK maps camelCase itself; do not pass `inlineContentId` to the REST API.
 *
 * @param {ReturnType<typeof buildEmailWordmarkResendAttachment>} attachment
 * @returns {{ filename: string, content: string, content_type: string, inline_content_id: string }}
 */
function formatWordmarkAttachmentForResendApi(attachment) {
  return {
    filename: attachment.filename,
    content: attachment.content,
    content_type: attachment.contentType,
    inline_content_id: attachment.inlineContentId,
  };
}

/**
 * Data URI for **local file preview only** — Gmail and most clients strip `data:` images in sent mail.
 * @returns {string}
 */
function buildEmailWordmarkInlineSrc() {
  if (cachedWordmarkDataUri) return cachedWordmarkDataUri;
  cachedWordmarkDataUri = `data:image/png;base64,${readEmailWordmarkPngBuffer().toString('base64')}`;
  return cachedWordmarkDataUri;
}

module.exports = {
  EMAIL_IN_BODY_LOGO_PATH,
  EMAIL_WORDMARK_GRADIENT_PATH,
  EMAIL_WORDMARK_INLINE_CONTENT_ID,
  EMAIL_SHELL_WORDMARK_WIDTH_PX,
  EMAIL_SHELL_WORDMARK_HEIGHT_PX,
  EMAIL_BRAND_PRIMARY,
  EMAIL_BRAND_PRIMARY_STRONG,
  EMAIL_BRAND_BG_DEEP,
  EMAIL_INBOX_BADGE_FAVICON_PATH,
  EMAIL_BIMI_LOGO_PATH,
  EMAIL_BIMI_SELECTOR,
  EMAIL_BIMI_DOMAIN,
  buildEmailInBodyLogoUrl,
  buildEmailLogoUrl,
  buildEmailWordmarkUrl,
  buildEmailInboxBadgeLogoUrl,
  buildBimiDnsHost,
  buildBimiTxtRecord,
  buildEmailWordmarkHeroHtml,
  buildEmailWordmarkCidSrc,
  buildEmailWordmarkResendAttachment,
  formatWordmarkAttachmentForResendApi,
  buildEmailWordmarkInlineSrc,
};
