import Cocoa

// Correlates a Claude Code session's tty with Terminal.app's frontmost tab, in both directions:
// read (is this session's tab focused right now?) and write (bring this exact tab to the front).
// The first Apple Event either method sends triggers macOS's one-time Automation permission
// prompt ("Claude Status Bar wants to control Terminal") — expected, and what issue #19 called
// "a one-time Automation grant, deferred to the opt-in build."
final class TerminalFocusTracker {
    private let terminalBundleID = "com.apple.Terminal"

    // Compiled once: frontmostTerminalTTY() runs on every poll tick while any session is
    // pending (~2.5 Hz), so this avoids recompiling the script on each call.
    private lazy var frontmostTTYScript = NSAppleScript(source: """
        tell application "Terminal"
            if (count of windows) is 0 then return ""
            get tty of selected tab of front window
        end tell
    """)

    private var terminalRunning: Bool {
        !NSRunningApplication.runningApplications(withBundleIdentifier: terminalBundleID).isEmpty
    }

    func frontmostTerminalTTY() -> String? {
        guard terminalRunning, let script = frontmostTTYScript else { return nil }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        guard error == nil else { return nil }
        let tty = result.stringValue ?? ""
        return tty.isEmpty ? nil : tty
    }

    // Built fresh per call (unlike the read script above): this only runs on a row click, so
    // recompile cost is irrelevant, and the tty needs to be interpolated into the source anyway.
    func focusTab(tty: String) -> Bool {
        guard terminalRunning else { return false }
        let escaped = tty.replacingOccurrences(of: "\\", with: "\\\\")
                          .replacingOccurrences(of: "\"", with: "\\\"")
        let source = """
            tell application "Terminal"
                repeat with w in windows
                    repeat with t in tabs of w
                        if tty of t is "\(escaped)" then
                            set selected tab of w to t
                            set index of w to 1
                            activate
                            return true
                        end if
                    end repeat
                end repeat
            end tell
            return false
        """
        guard let script = NSAppleScript(source: source) else { return false }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        guard error == nil else { return false }
        return result.booleanValue
    }
}
