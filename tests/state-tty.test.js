const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const lifecyclePath = path.resolve(__dirname, "../hooks/lifecycle.js");
const updatePath = path.resolve(__dirname, "../hooks/update.js");

const runHook = (home, scriptPath, event, payload) => {
  const wrapper = [
    `const cp = require("node:child_process");`,
    `cp.execSync = () => {};`,
    `cp.spawn = () => ({ unref() {} });`,
    `require(${JSON.stringify(scriptPath)});`,
  ].join("\n");
  return execFileSync(process.execPath, ["-e", wrapper, "placeholder", event], {
    input: JSON.stringify(payload),
    env: { ...process.env, HOME: home },
    stdio: ["pipe", "pipe", "pipe"],
  });
};

const readState = (home, sessionId) =>
  JSON.parse(fs.readFileSync(path.join(home, ".claude", "statusbar", "state.d", `${sessionId}.json`), "utf8"));

test("lifecycle.js start writes a tty field", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-statusbar-tty-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  runHook(home, lifecyclePath, "start", { session_id: "sess1", cwd: home });
  const state = readState(home, "sess1");
  assert.equal(typeof state.tty, "string");
});

test("update.js carries over the previous tty when the event omits it", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-statusbar-tty-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const stateDir = path.join(home, ".claude", "statusbar", "state.d");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "sess2.json"), JSON.stringify({ tty: "/dev/ttys999" }));
  runHook(home, updatePath, "prompt", { session_id: "sess2", cwd: home });
  const state = readState(home, "sess2");
  assert.equal(state.tty, "/dev/ttys999");
});
