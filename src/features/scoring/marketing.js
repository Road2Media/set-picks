/**
 * Narrow marketing scoring surface (#832).
 * Avoid importing the root scoring barrel from the marketing entry — that graph
 * also re-exports Firestore-backed standings hooks.
 */
export { default as HowScoringChangedContent } from './ui/HowScoringChangedContent';
export { default as ScoringRulesContent } from './ui/ScoringRulesContent';
