# CSP spike for a future ad script

Phase 3 of epic #419 (#421). This document names the header changes a later pull request would make. **`vercel.json` is unchanged.** Do not add these hosts, and do not rename the report-only policy to an enforcing policy, in a pull request that does not load the matching script.

The live policy is `Content-Security-Policy-Report-Only` on three sources in `vercel.json`: the catch-all `/(.*)`, `/embed`, and `/embed/(.*)`. The embed blocks match the catch-all except `frame-ancestors *` instead of `frame-ancestors 'none'`. A later edit has to change all three strings together. `frame-ancestors` stays as it is. Ad iframes are `frame-src` (pages we embed), not `frame-ancestors` (who may embed us). Details of the current headers: `docs/SECURITY_HEADERS.md`.

`img-src` already allows `https:`. Ad images do not need a new image host. `'unsafe-eval'` stays off. `SECURITY_HEADERS.md` calls that out, and this spike does not relax it.

Local `npm run dev` does not apply `vercel.json`.

## What we will not adopt for Google Publisher Tag

Google's Publisher Tag guide says a domain allowlist is not a supported integration, because the hosts GPT calls change. The supported policy is strict CSP: a nonce, `'unsafe-inline'`, `'unsafe-eval'`, `'strict-dynamic'`, and `https:`.

Source: [Integrate with a Content Security Policy](https://developers.google.com/publisher-tag/guides/content-security-policy) (read 2026-11-10).

That policy conflicts with this app. `'unsafe-eval'` is explicitly excluded. `'strict-dynamic'` would trust later scripts loaded by an allowed script, which is wider than the host list we use for GA4, Firebase, and reCAPTCHA. Adopting it is a security decision for the Phase 4 pull request (#422), not a header tweak to land early.

GPT's own script URL, for reference, is `https://securepubads.g.doubleclick.net/tag/js/gpt.js`. Google also documents SafeFrame (`googletag.setConfig({ safeFrame: { forceSafeFrame: true } })`) so a creative iframe does not inherit the page policy. That call belongs in the Phase 4 provider, next to the script, not in `vercel.json`.

## Path that fits the current allowlist

Phase 4 picked EthicalAds. The comparison is `docs/ADS_PROGRAMMATIC_DECISION.md`. The exact additions for that choice are in the next section. Do not edit `vercel.json` in this change. Apply the additions only in the release that sets the EthicalAds env.

EthicalAds uses stable hosts and an image or text placement. It does not ask for `'unsafe-eval'`. The hosts are:

| Directive | Host |
|-----------|------|
| `script-src` | `https://media.ethicalads.io` |
| `connect-src` | `https://server.ethicalads.io` and `https://media.ethicalads.io` |
| `img-src` | Already covered by `https:` |

The client script is `https://media.ethicalads.io/media/client/ethicalads.min.js`. Their client has used `innerHTML`. Do not add `require-trusted-types-for 'script'` in the same change. Confirmed against the EthicalAds client discussion (2025) and the public script URL.

Carbon and BuySellAds are the same shape of decision: a small, named host list, reviewed in the Phase 4 pull request. They are not listed here as a ready-to-paste policy.

## Funding Choices, when Patrick turns it on

The consent runbook keeps the script off until `VITE_CMP_PROVIDER` and `VITE_CMP_SITE_ID` are set. The tag, when it exists, is loaded from:

`https://fundingchoicesmessages.google.com`

Add that origin to `script-src`, `frame-src`, and `connect-src` on all three CSP strings in the same release that sets the env. Until then the origin stays off the policy, which is correct, because the tag is not created.

## Hosts seen with AdSense and GPT

These show up in AdSense and GPT integrations. Google does not publish them as a stable allowlist. Treat them as a report-only soak list for a Phase 4 experiment, not as the policy to enforce.

| Directive | Origins |
|-----------|---------|
| `script-src` | `https://securepubads.g.doubleclick.net`, `https://pagead2.googlesyndication.com`, `https://tpc.googlesyndication.com`, `https://fundingchoicesmessages.google.com`, `https://www.googletagservices.com` |
| `frame-src` | `https://googleads.g.doubleclick.net`, `https://tpc.googlesyndication.com`, `https://fundingchoicesmessages.google.com` (`https://www.google.com` is already allowed) |
| `connect-src` | `https://securepubads.g.doubleclick.net`, `https://pagead2.googlesyndication.com`, `https://googleads.g.doubleclick.net`, `https://csi.gstatic.com`, `https://adservice.google.com`, `https://fundingchoicesmessages.google.com` |

`www.googletagservices.com` is legacy. Prefer to omit it unless a real creative fails without it.

AdSense's loader is `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`. Same rule: add the host in the pull request that inserts the script.

## Phase 4 paste list (EthicalAds only)

Do not edit `vercel.json` in the spike pull request. When Patrick turns the provider on, append these tokens and nothing from the Google table above.

The live header name stays `Content-Security-Policy-Report-Only`. Edit the same two directives on all three policies: the catch-all `/(.*)`, `/embed`, and `/embed/(.*)`. Leave `frame-ancestors` as it is on each one (`'none'` on the catch-all, `*` on the embed routes).

| Directive | Append |
| --- | --- |
| `script-src` | `https://media.ethicalads.io` |
| `connect-src` | `https://server.ethicalads.io` `https://media.ethicalads.io` |

`img-src` already allows `https:`. Do not add an image host.

Do not add `frame-src` for this placement. The proof of concept is an image unit, not an iframe.

Do not add `style-src` in the first paste. `'unsafe-inline'` already allows a style element. If a report-only violation names a stylesheet on `media.ethicalads.io`, append that one host to `style-src` then.

Do not add `https://*.ethicalads.io`. Name the host that the report shows. Do not add `https://ethicalads.blob.core.windows.net` unless a report names it. EthicalAds said in 2025 that creative bytes are served from `*.ethicalads.io`.

Do not add `'unsafe-eval'`, `'strict-dynamic'`, or a nonce in this paste. Those belong to GPT and AdSense, and this app's static header cannot mint a per-response nonce. Do not add `securepubads.g.doubleclick.net`, `pagead2.googlesyndication.com`, or the other Google rows in the same edit.

`https://fundingchoicesmessages.google.com` is still a separate paste, in the consent section above, and only in the release that sets `VITE_CMP_PROVIDER` and `VITE_CMP_SITE_ID`.

## Header change, when a script actually ships

1. Keep the header name `Content-Security-Policy-Report-Only` until a soak on production shows no unexpected reports. Do not flip to enforcing `Content-Security-Policy` in the ads pull request. The enforce steps stay in `docs/SECURITY_HEADERS.md`.
2. Append only the origins for the one provider that pull request loads. Leave the other rows in this file unapplied.
3. Edit the catch-all and both embed strings in `vercel.json` together.
4. Leave `frame-ancestors` alone. Leave `/__/auth/*` without `X-Frame-Options: DENY`.
5. Smoke sign-in, a Firestore read, and a production-host GA4 pageview after the preview deploy. The consent module must still not be what starts those.

A report-only violation is the expected signal that a host is missing. An enforcing policy that is too wide is the failure this spike is trying to avoid.
