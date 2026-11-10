import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, Mail, Smartphone } from 'lucide-react';

import { Panel } from '../../../shared/ui/Card';
import { isInstalled } from '../../install';
import { logCommsPrefChanged } from '../../comms';
import { useCommsEmailStatus } from '../model/useCommsEmailStatus';
import { useNotificationPrefs } from '../model/useNotificationPrefs';
import {
  canShowPushDisable,
  pushDisableUnavailableCopy,
} from '../model/pushDisablePolicy';
import { usePushTokenRegistration } from '../model/usePushTokenRegistration';

function ChannelToggle({ description, disabled, checked, label, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border-muted/60 bg-surface-inset/40 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{label}</span>
        <span className="mt-1 block text-xs font-bold leading-relaxed text-content-secondary">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded-sm border-border-muted/60 text-brand-primary focus:ring-brand-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/**
 * @param {{
 *   sectionId: string,
 *   title: string,
 *   summary?: string,
 *   leading?: React.ReactNode,
 *   open: boolean,
 *   onToggle: () => void,
 *   sectionRef?: React.Ref<HTMLLIElement>,
 *   children: React.ReactNode,
 * }} props
 */
function NotificationAccordionSection({
  sectionId,
  title,
  summary = '',
  leading = null,
  open,
  onToggle,
  sectionRef,
  children,
}) {
  const headerId = `${sectionId}-header`;
  const panelId = `${sectionId}-panel`;

  return (
    <Panel
      as="li"
      ref={sectionRef}
      padding="none"
      className="overflow-hidden"
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black uppercase tracking-widest text-content-secondary">
            {title}
          </span>
          {summary ? (
            <span className="mt-1 block text-xs font-bold leading-relaxed text-content-secondary">
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-content-secondary transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-border-muted/80 px-5 pb-5 pt-2"
        >
          {children}
        </div>
      ) : null}
    </Panel>
  );
}

const PUSH_FAMILIES = [
  {
    family: 'reminders',
    label: 'Lock reminders',
    description: 'A push on this device before picks lock, when push is turned on above.',
  },
  {
    family: 'results',
    label: 'Wins & final scores',
    description: 'A push when a show is scored, including if you topped the night.',
  },
  {
    family: 'nearMiss',
    label: 'Close calls',
    description: 'A push when you finished within a couple of points of the top score but did not win.',
  },
  {
    family: 'lifecycle',
    label: 'Tour & onboarding updates',
    description: 'Welcome notes, tour countdowns, and pick confirmations on this device.',
  },
];

const IN_APP_FAMILIES = [
  {
    family: 'reminders',
    label: 'Lock reminders',
    description: 'A message in Messages before picks lock.',
  },
  {
    family: 'results',
    label: 'Wins & final scores',
    description: 'A message in Messages when a show is scored, including if you topped the night.',
  },
  {
    family: 'lifecycle',
    label: 'Tour & onboarding updates',
    description: 'Welcome notes, tour countdowns, and pick confirmations in Messages.',
  },
];

const EMAIL_FAMILIES = [
  {
    family: 'results',
    label: 'Wins & final scores',
    description: 'Recap and rankings email after a show, a tour, or a year is scored.',
  },
  {
    family: 'lifecycle',
    label: 'Tour & onboarding updates',
    description:
      'Welcome notes, tour countdowns, and other tour email. A show-day pick reminder still goes out when you have not entered picks.',
  },
];

function CategoryToggleList({ families, channel, prefs, disabled, onChange }) {
  const channelPrefs = prefs?.[channel] || {};
  return (
    <div className="mt-4 space-y-2">
      {families.map((item) => (
        <ChannelToggle
          key={`${channel}.${item.family}`}
          label={item.label}
          description={item.description}
          checked={channelPrefs[item.family] === true}
          disabled={disabled}
          onChange={(value) => onChange(channel, item.family, value)}
        />
      ))}
    </div>
  );
}

/**
 * Per-channel notification prefs (#1045). Push, in-app, and email each store
 * their own family booleans. A missing channel key still follows the legacy
 * flat `notificationPrefs` value.
 *
 * @param {{
 *   focusSection?: 'push' | null,
 *   onFocusConsumed?: () => void,
 * }} props
 */
export default function NotificationPrefsPanel({
  focusSection = null,
  onFocusConsumed,
}) {
  const [openSection, setOpenSection] = useState(null);
  const [pendingPushFocus, setPendingPushFocus] = useState(false);
  const pushSectionRef = useRef(/** @type {HTMLLIElement | null} */ (null));

  useEffect(() => {
    if (focusSection !== 'push') return;
    setOpenSection('push');
    setPendingPushFocus(true);
    const el = pushSectionRef.current;
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onFocusConsumed?.();
  }, [focusSection, onFocusConsumed]);

  useEffect(() => {
    if (!pendingPushFocus || openSection !== 'push') return;
    const enableBtn = pushSectionRef.current?.querySelector?.(
      '[aria-label="Enable push notifications"]',
    );
    if (enableBtn instanceof HTMLElement) {
      enableBtn.focus({ preventScroll: true });
    }
    setPendingPushFocus(false);
  }, [pendingPushFocus, openSection]);

  const handleAccordion = useCallback((id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  }, []);

  const {
    enablePush,
    disablePush,
    errorMessage,
    permission,
    status,
    lastMessageTitle,
    triggerPushCanary,
    canaryStatus,
  } = usePushTokenRegistration();

  const installed =
    typeof window !== 'undefined' && isInstalled(window, navigator);
  const showPushDisable = canShowPushDisable({ isInstalled: installed });
  const disableUnavailableCopy = pushDisableUnavailableCopy({
    isInstalled: installed,
    permission,
  });

  const {
    prefs,
    setField,
    isSaving: prefsSaving,
    error: prefsError,
  } = useNotificationPrefs();
  const {
    status: emailStatus,
    loading: emailLoading,
    working: emailWorking,
    error: emailError,
    unsubscribe: unsubscribeEmail,
    resubscribe: resubscribeEmail,
  } = useCommsEmailStatus();

  const handlePrefChange = useCallback(
    (channel, family, value) => {
      logCommsPrefChanged({ prefKey: `${channel}.${family}`, enabled: value });
      setField(channel, family, value);
    },
    [setField],
  );

  const pushStatusLabel = {
    idle: 'Off',
    working: 'Enabling...',
    enabled: 'On',
    denied: 'Blocked',
    unsupported: 'Unsupported',
    error: 'Error',
  }[status] ?? 'Off';

  const emailSummary = emailLoading
    ? 'Checking status…'
    : !emailStatus.hasEmail
      ? 'Add an account email to receive updates.'
      : emailStatus.suppressed
        ? 'Email paused.'
        : emailStatus.lifecycleEnabled
          ? 'On — tour and onboarding emails are enabled.'
          : 'Off — tour and onboarding email is off.';

  const emailLeading = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-primary/30 bg-brand-primary/10">
      <Mail className="h-5 w-5 text-brand-primary" aria-hidden />
    </span>
  );

  const pushLeading = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-primary/30 bg-brand-primary/10">
      <Smartphone className="h-5 w-5 text-brand-primary" aria-hidden />
    </span>
  );

  const inAppLeading = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-primary/30 bg-brand-primary/10">
      <Bell className="h-5 w-5 text-brand-primary" aria-hidden />
    </span>
  );

  return (
    <div>
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-content-secondary">
        Push
      </p>
      <ul className="space-y-3">
        <NotificationAccordionSection
          sectionId="notif-push"
          title="Push notifications"
          summary={`Status: ${pushStatusLabel}. Tap to turn push on or off and send a test.`}
          leading={pushLeading}
          open={openSection === 'push'}
          onToggle={() => handleAccordion('push')}
          sectionRef={pushSectionRef}
        >
          <p className="text-sm font-bold leading-relaxed text-content-secondary">
            {installed
              ? 'Get lock reminders, score updates, and recap drops on this device. Tap Enable and allow notifications when prompted.'
              : 'Get lock reminders, score updates, and recap drops on your phone. Add Setlist Pick \'Em to your home screen for reliable push, then tap Enable and allow notifications.'}
          </p>
          {!showPushDisable && disableUnavailableCopy ? (
            <p className="mt-3 rounded-xl border border-border-muted/60 bg-surface-inset/60 px-3 py-2 text-xs font-bold leading-relaxed text-content-secondary">
              {disableUnavailableCopy}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              {pushStatusLabel}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {status === 'enabled' && showPushDisable ? (
                <button
                  type="button"
                  onClick={disablePush}
                  disabled={status === 'working'}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200 transition-colors hover:border-amber-500 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Disable push notifications"
                >
                  Disable
                </button>
              ) : null}
              {status !== 'enabled' ? (
                <button
                  type="button"
                  onClick={enablePush}
                  disabled={status === 'working'}
                  className="rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Enable push notifications"
                >
                  {status === 'working' ? 'Working...' : 'Enable'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={triggerPushCanary}
                disabled={status !== 'enabled' || canaryStatus === 'working'}
                className="rounded-lg border border-border-muted/60 bg-surface-inset/72 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-brand-primary/50 hover:bg-surface-panel/50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send test notification"
              >
                {canaryStatus === 'working' ? 'Sending...' : 'Send test notification'}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-content-secondary">
            Browser permission: <span className="font-bold text-white">{permission}</span>
            {' · '}
            Surface:{' '}
            <span className="font-bold text-white">{installed ? 'PWA' : 'browser'}</span>
          </p>
          {canaryStatus === 'sent' ? (
            <p className="mt-2 text-xs text-emerald-300">
              Test notification sent. Check this device for the alert (including the system
              notification tray if the app is in the background).
            </p>
          ) : null}
          {lastMessageTitle ? (
            <p className="mt-2 text-xs text-emerald-300">
              Foreground message received: <span className="font-bold">{lastMessageTitle}</span>
            </p>
          ) : null}
          {errorMessage ? <p className="mt-2 text-xs text-amber-300">{errorMessage}</p> : null}
        </NotificationAccordionSection>

        <NotificationAccordionSection
          sectionId="notif-categories"
          title="Push updates"
          summary="Reminders, scores, close calls, and tour updates on this device."
          open={openSection === 'categories'}
          onToggle={() => handleAccordion('categories')}
        >
          <p className="text-xs font-bold leading-relaxed text-content-secondary">
            These switches are for push only. Messages in the app and email have their own
            switches. Push still needs permission and Enable in Push notifications.
          </p>
          <CategoryToggleList
            families={PUSH_FAMILIES}
            channel="push"
            prefs={prefs}
            disabled={prefsSaving}
            onChange={handlePrefChange}
          />
          {prefsError ? <p className="mt-3 text-xs text-amber-300">{prefsError}</p> : null}
        </NotificationAccordionSection>
      </ul>

      <p className="mb-3 mt-8 text-xs font-black uppercase tracking-widest text-content-secondary">
        In the app
      </p>
      <ul className="space-y-3">
        <NotificationAccordionSection
          sectionId="notif-in-app"
          title="Messages"
          summary="Reminders, scores, and tour updates in your inbox."
          leading={inAppLeading}
          open={openSection === 'inApp'}
          onToggle={() => handleAccordion('inApp')}
        >
          <p className="text-xs font-bold leading-relaxed text-content-secondary">
            These messages stay in Messages. Turning one off does not change push or email.
          </p>
          <CategoryToggleList
            families={IN_APP_FAMILIES}
            channel="inApp"
            prefs={prefs}
            disabled={prefsSaving}
            onChange={handlePrefChange}
          />
          {prefsError ? <p className="mt-3 text-xs text-amber-300">{prefsError}</p> : null}
        </NotificationAccordionSection>
      </ul>

      <p className="mb-3 mt-8 text-xs font-black uppercase tracking-widest text-content-secondary">
        Email
      </p>
      <ul className="space-y-3">
        <NotificationAccordionSection
          sectionId="notif-email"
          title="Email"
          summary={emailSummary}
          leading={emailLeading}
          open={openSection === 'email'}
          onToggle={() => handleAccordion('email')}
        >
          <p className="text-sm font-bold leading-relaxed text-content-secondary">
            Unsubscribe pauses every email to this address. The switches under Email updates
            turn individual notes off without pausing the address. Show-day pick reminders still
            go out when you have not entered picks, unless email to this address is paused.
          </p>

          {emailStatus.suppressed && emailStatus.message ? (
            <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold leading-relaxed text-amber-100">
              {emailStatus.message}
            </p>
          ) : null}

          {!emailStatus.hasEmail ? (
            <p className="mt-3 text-xs font-bold leading-relaxed text-content-secondary">
              Add an email address to your account to receive tour and onboarding updates by email.
            </p>
          ) : null}

          {emailStatus.hasEmail ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                {emailStatus.suppressed
                  ? 'Paused'
                  : emailStatus.lifecycleEnabled
                    ? 'Receiving emails'
                    : 'Off (preference)'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {emailStatus.suppressed && emailStatus.canResubscribe ? (
                  <button
                    type="button"
                    onClick={resubscribeEmail}
                    disabled={emailWorking}
                    className="rounded-lg border border-brand-primary/40 bg-brand-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {emailWorking ? 'Working…' : 'Re-enable email'}
                  </button>
                ) : null}
                {!emailStatus.suppressed && emailStatus.lifecycleEnabled ? (
                  <button
                    type="button"
                    onClick={unsubscribeEmail}
                    disabled={emailWorking}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200 transition-colors hover:border-amber-500 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {emailWorking ? 'Working…' : 'Unsubscribe from email'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {emailError ? <p className="mt-3 text-xs text-amber-300">{emailError}</p> : null}
        </NotificationAccordionSection>

        <NotificationAccordionSection
          sectionId="notif-email-categories"
          title="Email updates"
          summary="Scores and tour email. Show-day pick reminders stay on unless email is paused."
          open={openSection === 'emailCategories'}
          onToggle={() => handleAccordion('emailCategories')}
        >
          <p className="text-xs font-bold leading-relaxed text-content-secondary">
            These switches are for email only. They do not change push or messages in the app.
            {emailStatus.suppressed
              ? ' Email is paused, so nothing sends until you re-enable it. These switches are saved for then.'
              : ''}
          </p>
          <CategoryToggleList
            families={EMAIL_FAMILIES}
            channel="email"
            prefs={prefs}
            disabled={prefsSaving}
            onChange={handlePrefChange}
          />
          {prefsError ? <p className="mt-3 text-xs text-amber-300">{prefsError}</p> : null}
        </NotificationAccordionSection>

        <NotificationAccordionSection
          sectionId="notif-privacy"
          title="Privacy & devices"
          summary="What we save on this device and how to turn alerts off."
          open={openSection === 'privacy'}
          onToggle={() => handleAccordion('privacy')}
        >
          <div className="space-y-3 text-sm font-bold leading-relaxed text-content-secondary">
            <p>
              When you turn on push, we save a small ID for this phone or browser so we can send the
              alerts you asked for. We also remember that you allowed notifications and a rough
              device type (for example, iPhone vs desktop) so delivery stays reliable.
            </p>
            <p>
              On iPhone, website alerts usually work best after you add Setlist Pick &apos;Em to your
              Home Screen and open it from there. Otherwise Apple may not show them.
            </p>
            <p>
              Turn off push above, change the push, in-app, or email switches, or sign out to stop
              new alerts from reaching this device. If you join a pool later, a message might mention
              that pool by name so you know what it&apos;s about.
            </p>
          </div>
        </NotificationAccordionSection>
      </ul>
    </div>
  );
}
