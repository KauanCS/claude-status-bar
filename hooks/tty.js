const cp = require("child_process");

// ps -o tty= prints the short form ("ttys003") or "??" when the process has no controlling
// tty (e.g. an editor-embedded shell). Terminal.app's AppleScript `tty` property returns the
// full device path ("/dev/ttys003"), so normalize to that form here for a direct string
// compare on the Swift side.
function getTtyForPid(pid, exec = (cmd) => cp.execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString()) {
  if (!Number.isInteger(pid) || pid <= 0) return "";
  let out;
  try {
    out = exec(`ps -o tty= -p ${pid}`);
  } catch {
    return "";
  }
  const tty = out.trim();
  if (!tty || tty === "??") return "";
  return tty.startsWith("/dev/") ? tty : `/dev/${tty}`;
}

module.exports = { getTtyForPid };
