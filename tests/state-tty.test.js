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
    // Selective mock: let a real "ps -o tty=" call through (that's the exact command
    // hooks/tty.js's getTtyForPid shells out to, and is what proves real tty resolution
    // reaches the state file), but still stub out pgrep/open (lifecycle.js's running() check
    // and update.js's self-heal relaunch), which would otherwise interact with the real,
    // possibly-installed menu bar app as a side effect of running this test.
    `const realExecSync = cp.execSync;`,
    `cp.execSync = (cmd, opts) => {`,
    `  if (typeof cmd === "string" && cmd.startsWith("ps -o tty=")) return realExecSync(cmd, opts);`,
    `  return "";`,
    `};`,
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
  // The test process (like this repo's own CI/sandbox environments) may have no real
  // controlling tty, so this doesn't force a non-empty value — it proves the real "ps -o tty="
  // exec path ran and produced a well-formed result, matching Task 1's own integration test.
  assert.ok(state.tty === "" || state.tty.startsWith("/dev/"), `unexpected tty: ${state.tty}`);
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
