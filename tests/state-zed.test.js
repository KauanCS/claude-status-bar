const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const lifecyclePath = path.resolve(__dirname, "../hooks/lifecycle.js");
const updatePath = path.resolve(__dirname, "../hooks/update.js");

// This test suite may itself be running inside Zed (its own agent panel sets
// ZED_ENVIRONMENT), so a bare {...process.env} spread would leak that into the "no Zed"
// cases below. Always start from an explicit, controlled value for this one variable.
const runHook = (home, scriptPath, event, payload, zedEnvironment) => {
  const wrapper = [
    `const cp = require("node:child_process");`,
    `cp.execSync = () => "";`,
    `cp.spawn = () => ({ unref() {} });`,
    `require(${JSON.stringify(scriptPath)});`,
  ].join("\n");
  const env = { ...process.env, HOME: home };
  delete env.ZED_ENVIRONMENT;
  if (zedEnvironment !== undefined) env.ZED_ENVIRONMENT = zedEnvironment;
  return execFileSync(process.execPath, ["-e", wrapper, "placeholder", event], {
    input: JSON.stringify(payload),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
};

const readState = (home, sessionId) =>
  JSON.parse(fs.readFileSync(path.join(home, ".claude", "statusbar", "state.d", `${sessionId}.json`), "utf8"));

test("lifecycle.js start captures ZED_ENVIRONMENT when set", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-statusbar-zed-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  runHook(home, lifecyclePath, "start", { session_id: "sess1", cwd: home }, "worktree-shell");
  const state = readState(home, "sess1");
  assert.equal(state.zed_environment, "worktree-shell");
});

test("lifecycle.js start writes an empty zed_environment when unset", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-statusbar-zed-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  runHook(home, lifecyclePath, "start", { session_id: "sess2", cwd: home });
  const state = readState(home, "sess2");
  assert.equal(state.zed_environment, "");
});

test("update.js carries over the previous zed_environment when the event omits it", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "claude-statusbar-zed-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const stateDir = path.join(home, ".claude", "statusbar", "state.d");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, "sess3.json"), JSON.stringify({ zed_environment: "worktree-shell" }));
  runHook(home, updatePath, "prompt", { session_id: "sess3", cwd: home });
  const state = readState(home, "sess3");
  assert.equal(state.zed_environment, "worktree-shell");
});
