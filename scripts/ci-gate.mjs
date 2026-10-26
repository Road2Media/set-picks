/**
 * CLI for the `ci-gate` job in `.github/workflows/ci.yml`.
 */
import { evaluateCiGate } from "./lib/ciGate.mjs";

const results = {
  changes: process.env.CI_GATE_CHANGES || "",
  verify: process.env.CI_GATE_VERIFY || "",
  build: process.env.CI_GATE_BUILD || "",
  functions: process.env.CI_GATE_FUNCTIONS || "",
  rules: process.env.CI_GATE_RULES || "",
};

const decision = evaluateCiGate(results);
console.log(JSON.stringify({ results, ok: decision.ok, failures: decision.failures }));
if (!decision.ok) process.exit(1);
