import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateReleaseWorkflow } from "./validate-release-workflow.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/release-macos.yml"),
  "utf8",
);

test("accepts the repository macOS release workflow", () => {
  assert.doesNotThrow(() => validateReleaseWorkflow(workflow));
});

test("rejects a Developer ID build with the ad-hoc branch condition", () => {
  const mutated = replaceInStep(
    workflow,
    "Build signed DMG",
    "env.CAN_SIGN_MACOS == 'true'",
    "env.CAN_SIGN_MACOS != 'true'",
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /Developer ID condition/,
  );
});

test("rejects an ad-hoc build with the Developer ID branch condition", () => {
  const mutated = replaceInStep(
    workflow,
    "Build ad-hoc signed DMG",
    "env.CAN_SIGN_MACOS != 'true'",
    "env.CAN_SIGN_MACOS == 'true'",
  );

  assert.throws(() => validateReleaseWorkflow(mutated), /ad-hoc condition/);
});

test("rejects broadened signing branch conditions", () => {
  for (const [stepName, condition] of [
    [
      "Build signed DMG",
      "if: steps.version.outputs.should_release == 'true' && env.CAN_SIGN_MACOS == 'true'",
    ],
    [
      "Build ad-hoc signed DMG",
      "if: steps.version.outputs.should_release == 'true' && env.CAN_SIGN_MACOS != 'true'",
    ],
  ]) {
    const mutated = replaceInStep(
      workflow,
      stepName,
      condition,
      `${condition} || github.event_name == 'push'`,
    );

    assert.throws(
      () => validateReleaseWorkflow(mutated),
      /condition must exactly match/,
    );
  }
});

test("rejects an ad-hoc identity override in the Developer ID build", () => {
  const mutated = replaceInStep(
    workflow,
    "Build signed DMG",
    "--config.mac.notarize=true",
    "--config.mac.notarize=true --config.mac.identity=-",
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /Developer ID (identity|build command)/,
  );
});

test("rejects Apple credentials in the ad-hoc build", () => {
  const mutated = replaceInStep(
    workflow,
    "Build ad-hoc signed DMG",
    '          CSC_IDENTITY_AUTO_DISCOVERY: "false"',
    '          CSC_IDENTITY_AUTO_DISCOVERY: "false"\n          APPLE_ID: ${{ secrets.APPLE_ID }}',
  );

  assert.throws(() => validateReleaseWorkflow(mutated), /Apple credentials/);
});

test("rejects verification configured to continue after failure", () => {
  const mutated = replaceInStep(
    workflow,
    "Verify packaged application",
    "        if: steps.version.outputs.should_release == 'true'",
    "        if: steps.version.outputs.should_release == 'true'\n        continue-on-error: true",
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /continue after failure/,
  );
});

test("rejects verification without fail-fast shell mode", () => {
  for (const replacement of ["", "          set +e"]) {
    const mutated = replaceInStep(
      workflow,
      "Verify packaged application",
      "          set -euo pipefail",
      replacement,
    );

    assert.throws(() => validateReleaseWorkflow(mutated), /fail-fast mode/);
  }
});

test("rejects fail-fast mode disabled before signature verification", () => {
  const mutated = replaceInStep(
    workflow,
    "Verify packaged application",
    '          codesign --verify --deep --strict --verbose=2 "${discweave_app_path}"',
    '          set +o errexit\n          codesign --verify --deep --strict --verbose=2 "${discweave_app_path}"',
  );

  assert.throws(() => validateReleaseWorkflow(mutated), /fail-fast mode/);
});

test("rejects Gatekeeper checks outside the Developer ID branch", () => {
  const gatekeeperCommand =
    '            spctl --assess --type execute --verbose=4 "${discweave_app_path}"';
  let mutated = replaceInStep(
    workflow,
    "Verify packaged application",
    `${gatekeeperCommand}\n`,
    "",
  );
  mutated = replaceInStep(
    mutated,
    "Verify packaged application",
    '          elif ! grep -Fq "Signature=adhoc" <<< "${signature_details}"; then',
    `          elif ! grep -Fq "Signature=adhoc" <<< "\${signature_details}"; then\n${gatekeeperCommand}`,
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /Gatekeeper (branch|verification command)/,
  );
});

test("rejects a free branch that does not require an ad-hoc signature", () => {
  const mutated = replaceInStep(
    workflow,
    "Verify packaged application",
    '          elif ! grep -Fq "Signature=adhoc" <<< "${signature_details}"; then',
    '          elif ! grep -Fq "Authority=Developer ID" <<< "${signature_details}"; then',
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /ad-hoc verification branch/,
  );
});

test("rejects an inverted Developer ID signature check", () => {
  const mutated = replaceInStep(
    workflow,
    "Verify packaged application",
    '            if grep -Fq "Signature=adhoc" <<< "${signature_details}"; then',
    '            if ! grep -Fq "Signature=adhoc" <<< "${signature_details}"; then',
  );

  assert.throws(
    () => validateReleaseWorkflow(mutated),
    /Developer ID signature rejection/,
  );
});

test("rejects suppressed verification command failures", () => {
  for (const command of [
    '          codesign --verify --deep --strict --verbose=2 "${discweave_app_path}"',
    '            spctl --assess --type execute --verbose=4 "${discweave_app_path}"',
    '            xcrun stapler validate "${discweave_app_path}"',
  ]) {
    const mutated = replaceInStep(
      workflow,
      "Verify packaged application",
      command,
      `${command} || true`,
    );

    assert.throws(
      () => validateReleaseWorkflow(mutated),
      /verification command must exactly match/,
    );
  }
});

test("rejects signature failures without an explicit exit", () => {
  for (const failureMessage of [
    '              echo "The Developer ID build unexpectedly has an ad-hoc signature." >&2',
    '            echo "The free macOS build is not ad-hoc signed." >&2',
  ]) {
    const mutated = replaceInStep(
      workflow,
      "Verify packaged application",
      `${failureMessage}\n${failureMessage.startsWith("              ") ? "              " : "            "}exit 1`,
      failureMessage,
    );

    assert.throws(
      () => validateReleaseWorkflow(mutated),
      /signature rejection must exit/,
    );
  }
});

function replaceInStep(source, stepName, search, replacement) {
  const marker = `      - name: ${stepName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing test fixture step: ${stepName}`);

  const nextStep = source.indexOf("\n      - name:", start + marker.length);
  const end = nextStep === -1 ? source.length : nextStep;
  const step = source.slice(start, end);
  assert.ok(step.includes(search), `Missing test fixture text: ${search}`);

  return `${source.slice(0, start)}${step.replace(search, replacement)}${source.slice(end)}`;
}
