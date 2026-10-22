#!/usr/bin/env node
/**
 * Same command as `seedCommsProcessState.js`.
 * Kept so the #1034 ops line still seeds the tour_recap process ledger
 * and the legacy `comms_tour_recap_state` mirror together.
 */
"use strict";

require("./seedCommsProcessState");
