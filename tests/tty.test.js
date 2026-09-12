const assert = require("node:assert/strict");
const test = require("node:test");
const { getTtyForPid } = require("../hooks/tty.js");

test("normalizes a short ps tty to the /dev/ path Terminal.app reports", () => {
  const result = getTtyForPid(123, () => "ttys003\n");
  assert.equal(result, "/dev/ttys003");
});

test("passes through a tty that's already in /dev/ form", () => {
  const result = getTtyForPid(123, () => "/dev/ttys003\n");
  assert.equal(result, "/dev/ttys003");
});

test("returns empty string for ps's no-tty marker", () => {
  const result = getTtyForPid(123, () => "??\n");
  assert.equal(result, "");
});

test("returns empty string when the shell-out throws (process gone)", () => {
  const result = getTtyForPid(123, () => { throw new Error("no such process"); });
  assert.equal(result, "");
});

test("returns empty string without shelling out for a non-positive pid", () => {
  let called = false;
  const result = getTtyForPid(0, () => { called = true; return "ttys003"; });
  assert.equal(result, "");
  assert.equal(called, false);
});

test("returns empty string without shelling out for a non-integer pid", () => {
  let called = false;
  const result = getTtyForPid(1.5, () => { called = true; return "ttys003"; });
  assert.equal(result, "");
  assert.equal(called, false);
});

test("resolves the real tty of the current test process (integration, no stub)", () => {
  const result = getTtyForPid(process.pid);
  assert.ok(result === "" || result.startsWith("/dev/"), `unexpected value: ${result}`);
});
