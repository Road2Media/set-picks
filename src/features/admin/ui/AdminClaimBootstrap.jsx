import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Panel } from '../../../shared/ui/Card';
import Button from '../../../shared/ui/Button';
import { setAdminClaim } from '../api/setAdminClaimApi';

/**
 * One-click bootstrap for the `admin: true` custom claim (issue #139 PR A
 * follow-up). Rendered inside `AdminForm`, which is already gated by
 * `useAuth().isAdmin` (claim OR legacy-email fallback). This component reads
 * the current ID token locally, and:
 *  - if the claim is already present, shows a confirmation pill,
 *  - if the claim is missing, renders a "Grant admin claim to myself" button
 *    that invokes the `setAdminClaim` callable, force-refreshes the ID token
 *    so `useAuth().isAdmin` flips to the claim-based value, and hides itself.
 *
 * Exists so PMs / non-engineers can complete the claim bootstrap without
 * opening DevTools. Once every real admin has a claim and PR B has dropped
 * the legacy-email fallback, this component can be deleted.
 */
export default function AdminClaimBootstrap({ user }) {
  const [status, setStatus] = useState('checking');
  const [isGranting, setIsGranting] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        if (!cancelled) setStatus('missing');
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        if (cancelled) return;
        setStatus(tokenResult?.claims?.admin === true ? 'present' : 'missing');
      } catch {
        if (!cancelled) setStatus('missing');
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleGrant = async () => {
    if (!user) return;
    setErrorText('');
    setIsGranting(true);
    try {
      await setAdminClaim({ admin: true });
      await user.getIdTokenResult(true);
      setStatus('present');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String(e.message)
            : 'Failed to grant admin claim.';
      setErrorText(msg);
    } finally {
      setIsGranting(false);
    }
  };

  if (status === 'checking') return null;

  if (status === 'present') {
    return (
      <Panel className="mb-4 mt-4">
        <p className="text-xs text-emerald-400/90 font-bold uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          Admin claim active on your account
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="mb-4 mt-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-hidden />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            One-time admin claim bootstrap
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            You currently have admin access via legacy email. Grant the
            <code className="text-slate-300"> admin </code>
            custom claim to your account so access survives the upcoming
            Firestore rules tightening (issue #139 PR B).
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isGranting}
        onClick={handleGrant}
        className="w-full sm:w-auto uppercase tracking-widest gap-2"
      >
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        {isGranting ? 'Granting claim…' : 'Grant admin claim to myself'}
      </Button>
      {errorText ? (
        <p className="text-xs font-bold text-red-400 ml-1" role="alert">
          {errorText}
        </p>
      ) : null}
    </Panel>
  );
}
