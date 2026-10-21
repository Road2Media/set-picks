# Firebase Auth Email Templates — Manual Configuration Runbook

Firebase Authentication still sends email address verification and email address change. Those templates **must be customized in the Firebase Console**. They cannot be configured via code or the Firebase CLI.

Password reset mail is not one of those templates. See §1. The app calls `requestPasswordResetEmail` and Resend sends a `www.setlistpickem.com` link (#1049).

## Why This Is Manual

Firebase Auth email templates are project-level settings stored in the Firebase backend. There is no Terraform/CLI path for the web-app email body or subject line. Branding updates require a human to open the Console and save the template.

Related issue: [#120 — Custom communications for in-app actions](https://github.com/your-org/set-picks/issues/120)

---

## Firebase Console Location

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project **`set-picks`**
3. Navigate to **Authentication → Templates** (left sidebar, under "Build")

You will see four template types:
- **Password reset** (legacy template only; live mail is Resend, see §1)
- **Email address verification**
- **Email address change**
- **SMS verification** (not applicable — SMS not enabled)

---

## Templates to Customize

### 1. Password Reset — sent by Resend, not this template (#1049)

Splash and account security do **not** call `sendPasswordResetEmail`. They call the `requestPasswordResetEmail` Cloud Function. Firebase Admin issues the `oobCode`. Resend mails the only link:

`https://www.setlistpickem.com/password-reset-complete?oobCode=…`

From `Setlist Pick 'Em <updates@setlistpickem.com>`. The Firebase password-reset template is not the message users get.

Do **not**:

- Edit **Customize action URL** (it rejects `www.setlistpickem.com` because the site is on Vercel, not Firebase Hosting)
- Add `www.setlistpickem.com` to Firebase Hosting
- Point Auth SMTP at Resend
- Change `VITE_FIREBASE_AUTH_DOMAIN` or the Vercel `/__/auth/*` proxy to fix the mail host

Leave the Firebase template in place so a link that was already sent can still open until it expires (about an hour). Deploy steps and the request shape are in `docs/API.md` §2.7.

---

### 2. Email Address Verification

**Trigger:** After new account creation (if email verification is enabled).

| Field | Recommended value |
|-------|------------------|
| **Subject** | `Verify your Setlist Pick 'Em email` |

**Suggested body:**

```
Hi,

Welcome to Setlist Pick 'Em! Please verify your email address to complete your account setup.

%LINK%

If you didn't create this account, you can safely ignore this email.

— The Setlist Pick 'Em team
```

---

### 3. Email Address Change

**Trigger:** When a user changes their email in Account Security settings (revocation email sent to the old address).

| Field | Recommended value |
|-------|------------------|
| **Subject** | `Your Setlist Pick 'Em email address was changed` |

**Suggested body:**

```
Hi,

The email address for your Setlist Pick 'Em account was recently changed.

If you made this change, no further action is needed.

If you did not make this change, click the link below to revoke it and secure your account:

%LINK%

— The Setlist Pick 'Em team
```

---

## Custom Send Domain (Optional)

By default Firebase sends from `noreply@<project-id>.firebaseapp.com`. To send from a branded domain (e.g., `noreply@setlistpickem.com`):

1. In the Firebase Console, go to **Authentication → Templates → Edit** (top of page)
2. Click **"Customize domain"**
3. Add a verified sending domain and configure the required DNS records (SPF, DKIM, DMARC)
4. This requires ownership of the domain and access to DNS settings

> Note: Custom domains for Firebase Auth emails are distinct from the app's custom `authDomain` setting configured in `src/shared/lib/firebase.js` (that affects the OAuth redirect domain, not email sending).

---

## Logo / Branding

To add a logo to Auth emails:

1. In the Firebase Console, go to **Authentication → Templates**
2. Click the **pencil icon** next to "Customize Action URL" near the top
3. Under **"Customize"**, upload a logo image (PNG/JPG, recommended: 120×30 px on a transparent or white background)
4. The logo appears at the top of all Firebase Auth emails

---

## Verification Checklist (after updating templates)

- [ ] Trigger a password reset from the splash page and from account security. The link host is `www.setlistpickem.com`, path `/password-reset-complete`, with `oobCode`. It is not `set-picks.firebaseapp.com`
- [ ] Confirm verification and email-change mail still use Firebase `%LINK%` (those templates are unchanged)
- [ ] Check spam folder — SPF/DKIM records may need to be verified if using a custom domain
- [ ] Test on mobile email clients (Gmail app, Apple Mail) for rendering

---

## What Is NOT In Scope Here

The following require a separate transactional email provider (e.g., SendGrid) and backend Cloud Functions — deferred to a future sprint per issue #120:

- Branded HTML email for pick confirmation
- Post-show recap email
- Welcome email series
- Setlist lock reminder email

See [docs/IN_APP_ADS_EPIC.md](./IN_APP_ADS_EPIC.md) and the comms backlog for the full email roadmap.
