#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/release-macos.yml",
);
const workflow = readFileSync(workflowPath, "utf8");

validateReleaseWorkflow(workflow);
console.log("macOS release workflow policy is valid.");

export function validateReleaseWorkflow(workflowSource) {
  const signedBuild = readStep(workflowSource, "Build signed DMG");
  const adHocBuild = readStep(workflowSource, "Build ad-hoc signed DMG");
  const verification = readStep(workflowSource, "Verify packaged application");

  assertExactLine(
    signedBuild,
    "if: steps.version.outputs.should_release == 'true' && env.CAN_SIGN_MACOS == 'true'",
    "The Developer ID condition must exactly match the release policy.",
  );
  assertExactLine(
    signedBuild,
    "run: npm run desktop:package:mac -- --arm64 --publish never --config.mac.notarize=true",
    "The Developer ID build command must exactly match the release policy.",
  );
  assertExcludes(
    signedBuild,
    "--config.mac.identity=-",
    "The Developer ID identity must not be overridden with an ad-hoc identity.",
  );
  assertExactLine(
    adHocBuild,
    "if: steps.version.outputs.should_release == 'true' && env.CAN_SIGN_MACOS != 'true'",
    "The ad-hoc condition must exactly match the release policy.",
  );
  assertExactLine(
    adHocBuild,
    "run: npm run desktop:package:mac -- --arm64 --publish never --config.mac.identity=- --config.mac.notarize=false",
    "The ad-hoc build command must exactly match the release policy.",
  );
  for (const credential of [
    "APPLE_ID:",
    "APPLE_APP_SPECIFIC_PASSWORD:",
    "APPLE_TEAM_ID:",
    "CSC_LINK:",
    "CSC_KEY_PASSWORD:",
  ]) {
    assertExcludes(
      adHocBuild,
      credential,
      "The ad-hoc build must not depend on Apple credentials.",
    );
  }
  for (const step of [signedBuild, adHocBuild, verification]) {
    assertExcludes(
      step,
      "continue-on-error:",
      "Signing and verification steps must not continue after failure.",
    );
  }
  assertExactLine(
    verification,
    "if: steps.version.outputs.should_release == 'true'",
    "The packaged verification condition must exactly match the release policy.",
  );
  validateFailFastMode(verification);
  assertExactLine(
    verification,
    'hdiutil attach -readonly -nobrowse -mountpoint "${discweave_mount_dir}" "${discweave_dmg_path}" >/dev/null',
    "The DMG mount verification command must exactly match the release policy.",
  );
  assertExactLine(
    verification,
    'codesign --verify --deep --strict --verbose=2 "${discweave_app_path}"',
    "The code-signature verification command must exactly match the release policy.",
  );
  assertIncludes(
    verification,
    "Signature=adhoc",
    "The free release path must require an ad-hoc signature.",
  );
  assertIncludes(
    verification,
    "spctl --assess --type execute",
    "The Developer ID path must pass a Gatekeeper assessment.",
  );
  assertIncludes(
    verification,
    "xcrun stapler validate",
    "The Developer ID path must validate its stapled notarization ticket.",
  );

  validateVerificationBranches(verification);

  assertBefore(
    workflowSource,
    "Verify packaged application",
    "Create checksums",
  );
  assertBefore(
    workflowSource,
    "Verify packaged application",
    "Upload workflow artifacts",
  );
  assertBefore(
    workflowSource,
    "Verify packaged application",
    "Publish GitHub release",
  );
}

function readStep(workflowSource, name) {
  const marker = `      - name: ${name}`;
  const start = workflowSource.indexOf(marker);

  if (start === -1) {
    throw new Error(`Missing required workflow step: ${name}`);
  }

  const nextStep = workflowSource.indexOf(
    "\n      - name:",
    start + marker.length,
  );
  return workflowSource.slice(start, nextStep === -1 ? undefined : nextStep);
}

function assertIncludes(section, expected, message) {
  if (!section.includes(expected)) {
    throw new Error(message);
  }
}

function assertExactLine(section, expected, message) {
  if (!section.split("\n").some((line) => line.trim() === expected)) {
    throw new Error(message);
  }
}

function assertExcludes(section, forbidden, message) {
  if (section.includes(forbidden)) {
    throw new Error(message);
  }
}

function validateFailFastMode(verification) {
  const failFastCommand = "set -euo pipefail";
  const failFastIndex = verification
    .split("\n")
    .findIndex((line) => line.trim() === failFastCommand);
  const mountIndex = verification.indexOf("hdiutil attach -readonly -nobrowse");
  const codeSignIndex = verification.indexOf(
    "codesign --verify --deep --strict",
  );

  if (
    failFastIndex === -1 ||
    mountIndex === -1 ||
    codeSignIndex === -1 ||
    verification.indexOf(failFastCommand) >= mountIndex ||
    verification.indexOf(failFastCommand) >= codeSignIndex
  ) {
    throw new Error(
      "Packaged application verification must enable fail-fast mode before verification commands.",
    );
  }

  const disablesFailFast = verification
    .split("\n")
    .some((line) =>
      /^(set \+e|set \+u|set \+o (errexit|nounset|pipefail))$/.test(
        line.trim(),
      ),
    );

  if (disablesFailFast) {
    throw new Error(
      "Packaged application verification must not disable fail-fast mode.",
    );
  }
}

function validateVerificationBranches(verification) {
  const developerBranchMarker =
    '          if [[ "${CAN_SIGN_MACOS}" == "true" ]]; then';
  const adHocBranchMarker =
    '          elif ! grep -Fq "Signature=adhoc" <<< "${signature_details}"; then';
  const developerBranchStart = verification.indexOf(developerBranchMarker);
  const adHocBranchStart = verification.indexOf(adHocBranchMarker);

  if (
    developerBranchStart === -1 ||
    adHocBranchStart === -1 ||
    developerBranchStart >= adHocBranchStart
  ) {
    throw new Error(
      "The ad-hoc verification branch must follow the Developer ID branch.",
    );
  }

  const commonVerification = verification.slice(0, developerBranchStart);
  const developerVerification = verification.slice(
    developerBranchStart,
    adHocBranchStart,
  );
  const adHocVerification = verification.slice(adHocBranchStart);

  assertIncludes(
    commonVerification,
    "codesign --verify --deep --strict",
    "Strict code-signature verification must run before signing-mode checks.",
  );
  assertExactLine(
    developerVerification,
    'if grep -Fq "Signature=adhoc" <<< "${signature_details}"; then',
    "The Developer ID signature rejection must exactly match the release policy.",
  );
  assertExactLine(
    developerVerification,
    'spctl --assess --type execute --verbose=4 "${discweave_app_path}"',
    "The Gatekeeper verification command must exactly match the release policy.",
  );
  assertExactLine(
    developerVerification,
    'xcrun stapler validate "${discweave_app_path}"',
    "The stapler verification command must exactly match the release policy.",
  );
  assertExactLine(
    developerVerification,
    "exit 1",
    "The Developer ID signature rejection must exit with failure.",
  );
  assertExactLine(
    adHocVerification,
    "exit 1",
    "The ad-hoc signature rejection must exit with failure.",
  );
  assertExcludes(
    adHocVerification,
    "spctl --assess --type execute",
    "The Gatekeeper branch must be the Developer ID branch.",
  );
  assertExcludes(
    adHocVerification,
    "xcrun stapler validate",
    "Stapler validation must be in the Developer ID branch.",
  );
}

function assertBefore(workflowSource, firstStep, secondStep) {
  const firstIndex = workflowSource.indexOf(`      - name: ${firstStep}`);
  const secondIndex = workflowSource.indexOf(`      - name: ${secondStep}`);

  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    throw new Error(`${firstStep} must run before ${secondStep}.`);
  }
}
