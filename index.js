#!/usr/bin/env node

const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const FILE_PATH = path.resolve(process.env.FILE_PATH || ".runtime");

const KOMARI_ENDPOINT = process.env.KOMARI_ENDPOINT || "";
const KOMARI_TOKEN = process.env.KOMARI_TOKEN || "";

const DISABLE_WEB_SSH =
  String(process.env.DISABLE_WEB_SSH || "true").toLowerCase() === "true";

const MONTH_ROTATE = process.env.MONTH_ROTATE || "1";

const USE_SUDO =
  String(process.env.USE_SUDO || "false").toLowerCase() === "true";

const logPath = path.join(FILE_PATH, "runtime.log");
const lockPath = path.join(FILE_PATH, "installed.lock");

if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH, { recursive: true });
}

function log(message) {
  const text = `[${new Date().toISOString()}] ${message}\n`;
  process.stdout.write(text);
  fs.appendFileSync(logPath, text);
}

function maskToken(text) {
  if (!KOMARI_TOKEN) return text;
  return text.replaceAll(KOMARI_TOKEN, "***");
}

function buildInstallCommand() {
  if (!KOMARI_ENDPOINT) {
    throw new Error("Missing required environment variable: KOMARI_ENDPOINT");
  }

  if (!KOMARI_TOKEN) {
    throw new Error("Missing required environment variable: KOMARI_TOKEN");
  }

  const args = [
    "-e",
    `"${KOMARI_ENDPOINT}"`,
    "-t",
    `"${KOMARI_TOKEN}"`
  ];

  if (DISABLE_WEB_SSH) {
    args.push("--disable-web-ssh");
  }

  if (MONTH_ROTATE) {
    args.push("--month-rotate", `"${MONTH_ROTATE}"`);
  }

  const runner = USE_SUDO ? "sudo bash" : "bash";

  return `wget -qO- https://raw.githubusercontent.com/komari-monitor/komari-agent/refs/heads/main/install.sh | ${runner} -s -- ${args.join(" ")}`;
}

function runCommand(command) {
  return new Promise((resolve) => {
    log(`Running command: ${maskToken(command)}`);

    const child = exec(command, {
      shell: "/bin/bash",
      maxBuffer: 1024 * 1024 * 20
    });

    child.stdout.on("data", (data) => {
      process.stdout.write(data);
      fs.appendFileSync(logPath, maskToken(String(data)));
    });

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
      fs.appendFileSync(logPath, maskToken(String(data)));
    });

    child.on("close", (code) => {
      log(`Command exited with code ${code}`);
      resolve(code);
    });
  });
}

let installing = false;

async function installKomariAgent(force = false) {
  if (installing) {
    log("Install task already running, skip.");
    return;
  }

  if (!force && fs.existsSync(lockPath)) {
    log("Install lock exists, skip installation.");
    return;
  }

  installing = true;

  try {
    const command = buildInstallCommand();
    const code = await runCommand(command);

    if (code === 0) {
      fs.writeFileSync(lockPath, new Date().toISOString());
      log("Runtime initialization finished successfully.");
    } else {
      log(`Runtime initialization failed, exit code: ${code}`);
    }
  } catch (err) {
    log(`Initialization failed: ${err.message}`);
  }

  installing = false;
}

app.get("/", async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, "index.html");
    const html = await fs.promises.readFile(htmlPath, "utf8");
    res.type("html").send(html);
  } catch (err) {
    res.send("OK");
  }
});

app.get("/status", (req, res) => {
  let installedAt = "";

  if (fs.existsSync(lockPath)) {
    installedAt = fs.readFileSync(lockPath, "utf8").trim();
  }

  res.json({
    status: "running",
    endpoint_set: Boolean(KOMARI_ENDPOINT),
    token_set: Boolean(KOMARI_TOKEN),
    disable_web_ssh: DISABLE_WEB_SSH,
    month_rotate: MONTH_ROTATE,
    use_sudo: USE_SUDO,
    installed: fs.existsSync(lockPath),
    installed_at: installedAt,
    installing,
    port: PORT,
    file_path: FILE_PATH
  });
});

app.get("/log", (req, res) => {
  if (!fs.existsSync(logPath)) {
    res.type("text/plain").send("No log yet.");
    return;
  }

  res.type("text/plain").send(fs.readFileSync(logPath, "utf8"));
});

app.get("/reinstall", (req, res) => {
  res.type("text/plain").send("Reinstall started. Check /log.");
  installKomariAgent(true);
});

app.get("/reset", (req, res) => {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
  }

  res.type("text/plain").send("Install lock removed. Restart container or open /reinstall.");
});

app.listen(PORT, () => {
  log(`server is running on port:${PORT}`);
  installKomariAgent(false);
});