#!/usr/bin/env node

import { runCli } from "../src/index.js";

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agent-rake: ${message}`);
  process.exitCode = 1;
});
