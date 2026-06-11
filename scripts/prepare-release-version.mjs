#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseSubjectPattern = /^chore\(release\): v\d+\.\d+\.\d+/i;

const options = parseArguments(process.argv.slice(2));
const currentVersions = readCurrentVersions();
const latestTag = findLatestVersionTag();
const commits = readCommitsSince(latestTag).filter(
  (commit) => !releaseSubjectPattern.test(commit.subject),
);
const explicitVersion = options.version;

if (!explicitVersion && commits.length === 0 && !options.allowEmpty) {
  writeOutputs({
    should_release: "false",
    version: currentVersions.app,
    tag: `v${currentVersions.app}`,
    bump: "none",
    previous_tag: latestTag ?? "",
    base_sha: git(["rev-parse", "HEAD"]),
  });
  console.log(
    "No non-release commits were found since the latest version tag.",
  );
  process.exit(0);
}

if (currentVersions.app !== currentVersions.api) {
  throw new Error(
    `Version mismatch: app is ${currentVersions.app}, API is ${currentVersions.api}.`,
  );
}

const baseVersion = maxVersion(
  [currentVersions.app, latestTag?.slice(1)].filter(Boolean),
);
const bump = explicitVersion
  ? "explicit"
  : resolveBump(options.mode, commits, latestTag);
const nextVersion = explicitVersion ?? bumpVersion(baseVersion, bump);
const tag = `v${nextVersion}`;

writeVersions(nextVersion);

writeOutputs({
  should_release: "true",
  version: nextVersion,
  tag,
  bump,
  previous_tag: latestTag ?? "",
  base_sha: git(["rev-parse", "HEAD"]),
});

console.log(
  `Prepared ${tag} (${bump}) from ${latestTag ?? "repository start"}.`,
);

function parseArguments(args) {
  const parsed = {
    allowEmpty: false,
    mode: "auto",
    version: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--mode") {
      parsed.mode = requireValue(args, (index += 1), "--mode");
      continue;
    }

    if (arg === "--version") {
      parsed.version = requireValue(args, (index += 1), "--version");
      validateVersion(parsed.version, "--version");
      continue;
    }

    if (arg === "--allow-empty") {
      parsed.allowEmpty = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["auto", "patch", "minor", "major"].includes(parsed.mode)) {
    throw new Error("--mode must be one of: auto, patch, minor, major.");
  }

  return parsed;
}

function requireValue(args, index, optionName) {
  const value = args[index];

  if (!value || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function readCurrentVersions() {
  const appPackage = readJson("app/package.json");
  const directoryBuildProps = readText("api/Directory.Build.props");
  const apiVersion = directoryBuildProps.match(
    /<Version>([^<]+)<\/Version>/,
  )?.[1];

  if (!apiVersion) {
    throw new Error(
      "api/Directory.Build.props does not contain a <Version> value.",
    );
  }

  validateVersion(appPackage.version, "app/package.json version");
  validateVersion(apiVersion, "api/Directory.Build.props Version");

  return {
    app: appPackage.version,
    api: apiVersion,
  };
}

function findLatestVersionTag() {
  const tags = git([
    "tag",
    "--list",
    "v[0-9]*.[0-9]*.[0-9]*",
    "--sort=-v:refname",
  ]);
  const tag = tags
    .split("\n")
    .map((value) => value.trim())
    .find((value) => /^v\d+\.\d+\.\d+$/.test(value));

  return tag || undefined;
}

function readCommitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const output = git(["log", "--format=%H%x00%s%x00%b%x1e", range]);

  if (!output.trim()) {
    return [];
  }

  return output
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ""] = entry.split("\x00");

      return {
        hash,
        subject,
        body,
      };
    });
}

function resolveBump(mode, commitsToRelease, latestVersionTag) {
  if (mode !== "auto") {
    return mode;
  }

  if (!latestVersionTag) {
    return "patch";
  }

  if (commitsToRelease.some(isMajorChange)) {
    return "major";
  }

  if (commitsToRelease.some(isMinorChange)) {
    return "minor";
  }

  return "patch";
}

function isMajorChange(commit) {
  return (
    /\bBREAKING CHANGE\b/.test(commit.body) ||
    /^[a-z]+(?:\([^)]+\))?!:/.test(commit.subject)
  );
}

function isMinorChange(commit) {
  return (
    /^(feat|feature)(?:\([^)]+\))?:/i.test(commit.subject) ||
    /^(add|implement|introduce)\b/i.test(commit.subject)
  );
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = parseVersion(version);

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function maxVersion(versions) {
  return versions.reduce((maximum, version) =>
    compareVersions(version, maximum) > 0 ? version : maximum,
  );
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }

  return 0;
}

function parseVersion(version) {
  validateVersion(version, "version");
  return version.split(".").map((part) => Number.parseInt(part, 10));
}

function validateVersion(version, label) {
  if (!semverPattern.test(version)) {
    throw new Error(`${label} must be a stable SemVer value like 1.2.3.`);
  }
}

function writeVersions(version) {
  const appPackage = readJson("app/package.json");
  appPackage.version = version;
  writeJson("app/package.json", appPackage);

  const appPackageLock = readJson("app/package-lock.json");
  appPackageLock.version = version;

  if (appPackageLock.packages?.[""]) {
    appPackageLock.packages[""].version = version;
  }

  writeJson("app/package-lock.json", appPackageLock);

  const directoryBuildProps = readText("api/Directory.Build.props").replace(
    /<Version>[^<]+<\/Version>/,
    `<Version>${version}</Version>`,
  );
  writeText("api/Directory.Build.props", directoryBuildProps);
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(path) {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

function writeText(path, value) {
  writeFileSync(resolve(repositoryRoot, path), value, "utf8");
}

function writeOutputs(outputs) {
  for (const [name, value] of Object.entries(outputs)) {
    console.log(`${name}=${value}`);
  }

  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const content = Object.entries(outputs)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
  writeFileSync(process.env.GITHUB_OUTPUT, `${content}\n`, { flag: "a" });
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
