# Experiment playbook (Phase 2)

Rules for A/B testing comms copy and channel mix after v1 baselines exist.

## Prerequisites

Before launching an experiment:

1. Trigger is `shipped` with ≥ 2 weeks of `comms_delivered` data
2. GA4 dimensions from [MEASUREMENT_PLAN.md](./MEASUREMENT_PLAN.md) registered
3. Primary metric defined in TRIGGER_CATALOG row
4. GitHub issue documents hypothesis and success criteria

## Variant assignment

Stable per-user assignment:

```text
bucket = hash(uid + experimentId) % 100
variant A: bucket < 50
variant B: bucket >= 50
```

Store assignment in delivery payload: `payload.variant` or `templateId` suffix (`welcome-first-login-a`).

Never re-randomize mid-experiment.

## Experiment registry

Maintain in `docs/comms-triggers/experiments/` (create per experiment):

| Field | Example |
|-------|---------|
| `experimentId` | `exp_welcome_copy_2026_07` |
| `triggerId` | `first_login_welcome` |
| `variants` | `control`, `variant_b` |
| `primaryMetric` | `comms_opened` rate within 24h |
| `guardrailMetrics` | `comms_pref_changed` (lifecycle off), push disable rate |
| `minSamplePerVariant` | 500 users |
| `startDate` / `endDate` | Fixed window |
| `status` | `draft` / `running` / `shipped` / `killed` |

## Guardrails

| Rule | Value |
|------|-------|
| Max concurrent experiments per family | 1 |
| Max concurrent experiments total | 2 |
| Min runtime | 7 days or 1 complete show cycle |
| Stop early if | Guardrail degrades > 20% vs control |

## Decision matrix

| Outcome | Action |
|---------|--------|
| Variant wins (p < 0.05 or practical significance) | Promote to new template semver; retire loser |
| No difference | Keep control; document learnings |
| Variant loses | Kill variant; do not retry without new hypothesis |
| Guardrail breach | Stop experiment immediately; rollback variant traffic to 0% |

## Channel experiments

Test one dimension at a time:

- Copy only (same channels)
- Channel mix only (e.g. push+inApp vs inApp-only)
- Send timing only (e.g. T-24h vs T-12h)

## Rollout after win

1. Drafter merges winning copy to `implementationModule`
2. Architect sets experiment `status: shipped`, variant 100% `control` name with winning content
3. Bump `template.version` in registry metadata (future field)
4. Analyst posts 30-day post-ship monitoring note

## What not to experiment on (v1)

- P0 auth or compliance messages without legal review
- Dedup keys or pref defaults
- Commercial content (Phase 3 has separate playbook)
