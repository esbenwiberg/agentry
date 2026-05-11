import consistencyDimension from "./dimensions/consistency.js";
import contextDimension from "./dimensions/context.js";
import feedbackDimension from "./dimensions/feedback.js";
import safetyDimension from "./dimensions/safety.js";
import agentGuidancePresent from "./probes/agent-guidance-present.js";
import agentGuidanceSubstance from "./probes/agent-guidance-substance.js";
import changelogStrategyDeclared from "./probes/changelog-strategy-declared.js";
import docsContributingPresent from "./probes/docs-contributing-present.js";
import docsReadmePresent from "./probes/docs-readme-present.js";
import editorconfigPresent from "./probes/editorconfig-present.js";
import formatConfigured from "./probes/format-configured.js";
import hooksPrecommitPresent from "./probes/hooks-precommit-present.js";
import lintConfigured from "./probes/lint-configured.js";
import safetyDangerousScriptFlags from "./probes/safety-dangerous-script-flags.js";
import secretsDotenvGitignored from "./probes/secrets-dotenv-gitignored.js";
import testsRunnerConfigured from "./probes/tests-runner-configured.js";
import typesConfigured from "./probes/types-configured.js";

export const meta = {
  name: "@esbenwiberg/corpus-default",
  version: "0.0.0",
};

export const probes = [
  agentGuidancePresent,
  agentGuidanceSubstance,
  changelogStrategyDeclared,
  docsContributingPresent,
  docsReadmePresent,
  editorconfigPresent,
  formatConfigured,
  hooksPrecommitPresent,
  lintConfigured,
  safetyDangerousScriptFlags,
  secretsDotenvGitignored,
  testsRunnerConfigured,
  typesConfigured,
];

export const dimensions = [
  contextDimension,
  consistencyDimension,
  feedbackDimension,
  safetyDimension,
];
