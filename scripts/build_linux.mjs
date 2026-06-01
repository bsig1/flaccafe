#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const scratchRoot = path.join(root, ".tmp-linux-package");
const generatedConfigPath = path.join(scratchRoot, "tauri.linux.generated.conf.json");

const rawArgs = process.argv.slice(2);
const dryRun = pullFlag("--dry-run");
const skipSidecar = pullFlag("--skip-sidecar");
const skipAudit = pullFlag("--skip-audit");
const noClean = pullFlag("--no-clean");
const targetArg = rawArgs.find((arg) => !arg.startsWith("-")) ?? "all";
const validTargets = new Set(["all", "deb", "appimage"]);

if (!validTargets.has(targetArg)) {
  fail(`Unknown Linux package target "${targetArg}". Use all, deb, or appimage.`);
}

const bundleTargets = targetArg === "all" ? ["deb", "appimage"] : [targetArg];

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

async function main() {
  if (process.platform !== "linux" && !dryRun) {
    fail("Linux packages must be built on Linux. Run this from Linux/WSL/CI, or pass --dry-run to verify the generated package config on another OS.");
  }

  fs.mkdirSync(scratchRoot, { recursive: true });
  const linuxConfig = writeLinuxTauriConfig(bundleTargets);
  auditGeneratedConfig(linuxConfig);

  if (dryRun) {
    printDryRunPlan();
    return;
  }

  if (!skipSidecar) {
    buildLinuxBackendSidecar(!noClean);
  }

  run(commandForNpm(), [
    "run",
    "tauri",
    "--",
    "build",
    "--bundles",
    bundleTargets.join(","),
    "--config",
    generatedConfigPath,
    "--ci",
  ]);

  const artifacts = collectArtifacts(bundleTargets);
  if (artifacts.length === 0) {
    fail("Tauri build completed without producing a Linux package artifact.");
  }

  if (!skipAudit) {
    auditArtifacts(artifacts);
  }

  console.log("Linux package artifacts:");
  for (const artifact of artifacts) {
    console.log(`- ${path.relative(root, artifact)}`);
  }
}

function pullFlag(flag) {
  const index = rawArgs.indexOf(flag);
  if (index === -1) {
    return false;
  }
  rawArgs.splice(index, 1);
  return true;
}

function writeLinuxTauriConfig(targets) {
  const config = {
    $schema: "https://schema.tauri.app/config/2",
    bundle: {
      targets,
      icon: [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
      ],
      resources: ["../dist-backend/flaccafe-backend"],
    },
  };
  fs.writeFileSync(generatedConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

function auditGeneratedConfig(config) {
  const text = JSON.stringify(config, null, 2);
  const forbidden = [
    /\.exe\b/i,
    /\.dll\b/i,
    /\.msi\b/i,
    /\.wix/i,
    /\bwix\b/i,
    /\bwindows\b/i,
    /icon\.ico/i,
    /cd-rip/i,
    /cygwin/i,
    /fpcalc\.exe/i,
    /THIRD_PARTY_NOTICES\.md/i,
  ];
  const match = forbidden.find((pattern) => pattern.test(text));
  if (match) {
    fail(`Generated Linux Tauri config contains a Windows-only package detail: ${match}`);
  }
}

function printDryRunPlan() {
  console.log(`Generated ${path.relative(root, generatedConfigPath)} for: ${bundleTargets.join(", ")}`);
  console.log("Dry run only; no sidecar or Tauri package was built.");
  if (process.platform !== "linux") {
    console.log("Real .deb/AppImage output still requires a Linux host.");
  }
}

function buildLinuxBackendSidecar(clean) {
  const python = pythonExecutable();
  const distRoot = path.join(root, "dist-backend");
  const sidecarDir = path.join(distRoot, "flaccafe-backend");
  const sidecarBin = path.join(sidecarDir, "flaccafe-backend");
  const buildRoot = path.join(root, "build-backend-linux");

  if (clean) {
    fs.rmSync(sidecarDir, { recursive: true, force: true });
    fs.rmSync(buildRoot, { recursive: true, force: true });
  }

  const hiddenImports = [
    "timeit",
    "aifc",
    "audioop",
    "cProfile",
    "bdb",
    "cmd",
    "code",
    "codeop",
    "colorsys",
    "ctypes.util",
    "configparser",
    "doctest",
    "filecmp",
    "fileinput",
    "pdb",
    "profile",
    "pstats",
    "pickletools",
    "sndhdr",
    "sunau",
    "unittest",
    "unittest.mock",
    "wave",
    "backend.app.clap_analysis",
    "backend.app.clap_expert",
    "backend.app.clap_worker",
    "backend.app.config",
    "backend.app.database",
    "backend.app.ml_runtime",
    "backend.app.startup_profile",
  ];
  const excludedModules = [
    "fastapi",
    "starlette",
    "uvicorn",
    "httpx",
    "torch",
    "transformers",
    "librosa",
    "soundfile",
    "scipy",
    "sklearn",
    "numba",
    "llvmlite",
    "numpy",
    "pandas",
    "matplotlib",
  ];

  const pyinstallerArgs = [
    "-m",
    "PyInstaller",
    ...(clean ? ["--clean"] : []),
    "--noconfirm",
    "--name",
    "flaccafe-backend",
    "--onedir",
    "--distpath",
    "dist-backend",
    "--workpath",
    "build-backend-linux",
    "--specpath",
    "build-backend-linux",
    ...hiddenImports.flatMap((moduleName) => ["--hidden-import", moduleName]),
    "--add-data",
    `${path.join("backend", "app", "schema.sql")}:backend/app`,
    ...excludedModules.flatMap((moduleName) => ["--exclude-module", moduleName]),
    path.join("backend", "desktop_backend.py"),
  ];

  run(python, pyinstallerArgs);

  if (!fs.existsSync(sidecarBin)) {
    fail(`PyInstaller completed without producing ${path.relative(root, sidecarBin)}.`);
  }
  auditPathListing(listFiles(sidecarDir), "Linux backend sidecar");
}

function pythonExecutable() {
  const venvPython = path.join(root, ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (result.status === 0) {
      return candidate;
    }
  }
  fail("Could not find Python. Create .venv/bin/python or install python3 before packaging Linux.");
}

function commandForNpm() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: {
      ...process.env,
      CI: "true",
      VITE_FLAC_CAFE_PACKAGE_TARGET: "linux",
    },
    stdio: "inherit",
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`${command} failed with exit code ${result.status}.`);
  }
}

function collectArtifacts(targets) {
  const bundleRoot = path.join(root, "src-tauri", "target", "release", "bundle");
  const artifacts = [];
  if (targets.includes("deb")) {
    artifacts.push(...latestArtifacts(path.join(bundleRoot, "deb"), /\.deb$/i));
  }
  if (targets.includes("appimage")) {
    artifacts.push(...latestArtifacts(path.join(bundleRoot, "appimage"), /\.AppImage$/i));
  }
  return artifacts;
}

function latestArtifacts(directory, pattern) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter((entry) => pattern.test(entry))
    .map((entry) => path.join(directory, entry))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .slice(0, 1);
}

function auditArtifacts(artifacts) {
  for (const artifact of artifacts) {
    if (/\.deb$/i.test(artifact)) {
      auditDeb(artifact);
    } else if (/\.AppImage$/i.test(artifact)) {
      auditAppImage(artifact);
    } else {
      auditPathListing([artifact], path.basename(artifact));
    }
  }
}

function auditDeb(artifact) {
  const listing = capture("dpkg-deb", ["--contents", artifact]);
  auditPathListing(listing.split(/\r?\n/), path.basename(artifact));
}

function auditAppImage(artifact) {
  const auditRoot = fs.mkdtempSync(path.join(os.tmpdir(), "flaccafe-appimage-audit-"));
  try {
    fs.chmodSync(artifact, 0o755);
    const result = spawnSync(artifact, ["--appimage-extract"], {
      cwd: auditRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error) {
      fail(result.error.message);
    }
    if (result.status !== 0) {
      fail(`Could not extract ${path.basename(artifact)} for audit: ${result.stderr || result.stdout}`);
    }
    auditPathListing(listFiles(path.join(auditRoot, "squashfs-root")), path.basename(artifact));
  } finally {
    fs.rmSync(auditRoot, { recursive: true, force: true });
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    fail(`${command} is required for package audit: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} failed while auditing package contents: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function listFiles(directory) {
  const paths = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else {
      paths.push(current);
    }
  }
  return paths;
}

function auditPathListing(entries, label) {
  const forbidden = [
    /\.exe\b/i,
    /\.dll\b/i,
    /\.msi\b/i,
    /\.wix/i,
    /\bwix\b/i,
    /icon\.ico/i,
    /tools\/cd-rip/i,
    /tools\\cd-rip/i,
    /cygwin/i,
    /fpcalc\.exe/i,
    /cdda2wav/i,
    /cdrecord/i,
    /readcd/i,
    /mkisofs/i,
    /isoinfo/i,
    /isodump/i,
    /isovfy/i,
    /scgcheck/i,
    /devdump/i,
    /rscsi/i,
    /mount\.exe/i,
    /sh\.exe/i,
    /THIRD_PARTY_NOTICES\.md/i,
  ];
  for (const entry of entries) {
    const normalized = String(entry).replaceAll("\\", "/");
    const match = forbidden.find((pattern) => pattern.test(normalized));
    if (match) {
      fail(`${label} contains a Windows-only package detail: ${normalized}`);
    }
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
