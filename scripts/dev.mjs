import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const PORTS = [1420, 1421];
const lockPath = path.join(os.tmpdir(), "terax-ai-dev.lock");

function getListeningPids(port) {
  if (process.platform === "win32") return [];

  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" },
    );

    return [...new Set(output.split(/\s+/).filter(Boolean))];
  } catch {
    return [];
  }
}

function getProcessCommand(pid) {
  if (process.platform === "win32") return "";

  try {
    return execFileSync("ps", ["-p", pid, "-o", "args="], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function clearLock() {
  try {
    const current = Number.parseInt(readFileSync(lockPath, "utf8"), 10);
    if (current === process.pid) {
      rmSync(lockPath, { force: true });
    }
  } catch {
    // Ignore missing or malformed lock files during cleanup.
  }
}

function acquireLock() {
  if (existsSync(lockPath)) {
    try {
      const existingPid = Number.parseInt(readFileSync(lockPath, "utf8"), 10);
      if (isPidAlive(existingPid)) {
        console.log(
          `Terax dev is already running in ${path.basename(process.cwd())} (pid ${existingPid}).`,
        );
        process.exit(0);
      }
    } catch {
      // Fall through and replace a malformed or stale lock.
    }

    rmSync(lockPath, { force: true });
  }

  writeFileSync(lockPath, `${process.pid}\n`, "utf8");
}

function shouldStop(pid) {
  const command = getProcessCommand(pid);
  if (!command) return false;

  return (
    command.includes("terax-ai") ||
    /\b(vite|tauri)\b/.test(command) ||
    command.includes("bun run dev:web")
  );
}

function stopStaleDevServers() {
  for (const port of PORTS) {
    for (const pid of getListeningPids(port)) {
      if (!shouldStop(pid)) continue;

      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        continue;
      }
    }
  }
}

acquireLock();
process.on("exit", clearLock);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

stopStaleDevServers();

const tauriBin =
  process.platform === "win32"
    ? path.resolve("node_modules/.bin/tauri.cmd")
    : path.resolve("node_modules/.bin/tauri");

if (!existsSync(tauriBin)) {
  console.error("Could not find the Tauri CLI in node_modules/.bin.");
  process.exit(1);
}

const child = spawn(tauriBin, ["dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
