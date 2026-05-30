import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PORTS = [1420, 1421];

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
