# Launch copy for Privacy and Terms

Held off the live policy until ads go live. Restore these passages, then check the item on [#421](https://github.com/Road2Media/set-picks/issues/421).

The live Privacy Policy and Terms of Service match `main` on every ad sentence. The Madison Square Garden public-board sentence in Privacy stays. It is not part of this copy.

Set **Last updated** to the day you restore this copy, in both markdown files and in `PrivacyPolicyContent.jsx` and `TermsOfServiceContent.jsx`. The copy below was dated November 10, 2026.

## Privacy Policy

In **Device and usage data**, replace the Advertising Identifiers bullet with:

- **House promos:** Standings can show one message from us: an image, short text, and a link, loaded from our own configuration. That message is not an ad network. It does not set an advertising cookie. Advertising identifiers such as IDFA and GAID are not collected. Your picks are not sent with that message.
- **Third-party ads:** We do not load a third-party advertising script. We do not send your account, picks, or a device advertising identifier to an ad network. If we add one later, this policy will name the partner before that script loads, and the script will stay unloaded until the Ad preferences choice below allows it.

On the local storage bullet, add “and the Ad preferences choice” after “notification cadence settings”.

In **How we use your information**, replace “Deliver, measure, and optimize third-party advertisements within the App.” with:

- Show a first-party promo that we operate ourselves, when that promo is turned on.

In **Third-party services**, replace the Advertising Partners bullet with:

- **Advertising partners:** None. We do not send personal information to an ad network.

Replace **Cookies and Tracking Technologies** with:

## Cookies and tracking technologies
The App uses cookies and similar tracking technologies set by Firebase for authentication sessions and by Google Analytics 4 for usage measurement.

Google Analytics 4 measures how the site is used. It is in the analytics category. It runs on the production site (www.setlistpickem.com and setlistpickem.com). The Ad preferences choice leaves it running. You can still opt out with your browser or a Google Analytics opt-out extension.

Advertising cookies are not in use. After you sign in, Account → Preferences includes [Ad preferences](/dashboard/profile/account#ad-preferences). The default keeps a future advertising script off. Choosing allow saves that choice in this browser only. It does not turn on an ad network. It does not change sign-in, gameplay, or analytics.

## Terms of Service

Replace **Advertisements and Monetization** with:

## Advertisements and Monetization
The core game stays free. There are no entry fees, no cash prizes, and no wagering.

We may show first-party promotional messages that we write and operate, such as a house promo on Standings. Those messages are not a third-party ad network.

We may later show third-party advertisements or sponsorships. None are on the site today. A third-party advertising script stays unloaded until the advertising choice in the Privacy Policy allows it.

We do not sell subscriptions, premium features, or in-app purchases. We may offer those later. An ad-free paid tier is not available.

By using the App, you agree to first-party promotional messages, and to third-party advertisements if we add them under the Privacy Policy.

## Legal page link

Add an Ad preferences link beside Privacy Policy and Terms of Service on the legal page footer (`src/features/legal/ui/LegalPageLayout.jsx`) and the legal door (`scripts/legal-boot-shell.mjs`). The href is `/dashboard/profile/account#ad-preferences`.

Account → Preferences shows that section on its own when ads are enabled. This file does not turn that on.
