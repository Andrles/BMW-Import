import Cocoa
import Darwin

let fm = FileManager.default
let identifier = "local.bmwimport.desktop"
struct Failure: Error { let message: String }
func checkedPath(_ url: URL) -> Bool { url.standardizedFileURL.path == url.resolvingSymlinksInPath().standardizedFileURL.path }
func version(_ app: URL) -> String? {
    guard checkedPath(app), app.pathExtension == "app", fm.isExecutableFile(atPath: app.appendingPathComponent("Contents/MacOS/BMWImport").path),
          let data = try? Data(contentsOf: app.appendingPathComponent("Contents/Info.plist")),
          let p = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
          p["CFBundleIdentifier"] as? String == identifier,
          p["CFBundleExecutable"] as? String == "BMWImport",
          let v = p["CFBundleShortVersionString"] as? String,
          v.range(of: "^[0-9]+(\\.[0-9]+){1,3}$", options: .regularExpression) != nil else { return nil }
    return v
}
func under(_ child: URL, _ root: URL) -> Bool { root.path == "/" || child.path.hasPrefix(root.path + "/") }
func running(_ root: URL) -> [NSRunningApplication] {
    NSRunningApplication.runningApplications(withBundleIdentifier: identifier).filter {
        guard let url = $0.bundleURL else { return false }
        return under(url, root) && version(url) != nil && !$0.isTerminated
    }
}
func closeApplications(_ root: URL) throws {
    let apps = running(root)
    for app in apps {
        if !app.terminate() { throw Failure(message: "Не удалось закрыть BMW Import. Закройте приложение и повторите установку.") }
    }
    let deadline = Date().addingTimeInterval(15)
    while !running(root).isEmpty && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.1)) }
    guard running(root).isEmpty else { throw Failure(message: "BMW Import не завершился. Установка остановлена; принудительное завершение не выполнялось.") }
    // The app normally terminates its own Node process. Refuse replacement if a server remains.
    let process = Process(); process.executableURL = URL(fileURLWithPath: "/bin/ps")
    process.arguments = ["-axo", "comm="]; let pipe = Pipe(); process.standardOutput = pipe
    try process.run(); let data = pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
    guard process.terminationStatus == 0 else { throw Failure(message: "Не удалось проверить завершение сервера BMW Import.") }
    for line in String(decoding: data, as: UTF8.self).split(separator: "\n") {
        let path = String(line).trimmingCharacters(in: .whitespaces)
        let suffix = "/Contents/Resources/node"
        if path.hasSuffix(suffix) {
            let app = URL(fileURLWithPath: String(path.dropLast(suffix.count)))
            if under(app, root), version(app) != nil { throw Failure(message: "Сервер BMW Import ещё работает. Повторите установку после его завершения.") }
        }
    }
}
func userHome(_ root: URL) -> (URL, uid_t, gid_t)? {
    // Only the logged-in user's copies: never traverse other user accounts or project folders.
    let attrs = try? fm.attributesOfItem(atPath: "/dev/console")
    let uid = (attrs?[.ownerAccountID] as? NSNumber)?.uint32Value ?? getuid()
    guard uid >= 500, let entry = getpwuid(uid), let dir = entry.pointee.pw_dir else { return nil }
    let home = root.appendingPathComponent(String(cString: dir).trimmingCharacters(in: CharacterSet(charactersIn: "/")))
    guard checkedPath(home), fm.fileExists(atPath: home.path) else { return nil }
    return (home, uid, entry.pointee.pw_gid)
}
func cleanup(_ root: URL, _ current: String) throws {
    let target = root.appendingPathComponent("Applications/BMW Import.app")
    guard version(target) == current else { throw Failure(message: "Новая версия не подтверждена. Старые копии не перемещены.") }
    guard let (home, uid, gid) = userHome(root) else { print("Нет активного пользователя: очистка дополнительных копий пропущена."); return }
    let trash = home.appendingPathComponent(".Trash", isDirectory: true)
    guard checkedPath(trash) else { throw Failure(message: "Корзина является ссылкой. Очистка отменена.") }
    if !fm.fileExists(atPath: trash.path) {
        try fm.createDirectory(at: trash, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700, .ownerAccountID: uid, .groupOwnerAccountID: gid])
    }
    let owner = (try fm.attributesOfItem(atPath: trash.path)[.ownerAccountID] as? NSNumber)?.uint32Value
    guard owner == uid else { throw Failure(message: "Владелец Корзины не совпадает с пользователем. Очистка отменена.") }
    let folders = [root.appendingPathComponent("Applications"), home.appendingPathComponent("Applications"), home.appendingPathComponent("Desktop"), home.appendingPathComponent("Downloads")]
    let live = Set(running(root).compactMap { $0.bundleURL?.standardizedFileURL.path })
    for folder in folders where checkedPath(folder) {
        guard let entries = try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) else { continue }
        for app in entries where app.standardizedFileURL != target.standardizedFileURL {
            guard let old = version(app), old.compare(current, options: .numeric) == .orderedAscending, !live.contains(app.standardizedFileURL.path) else { continue }
            let destination = trash.appendingPathComponent("BMW Import " + old + " " + UUID().uuidString + ".app")
            do { try fm.moveItem(at: app, to: destination); print("В Корзину: \(app.path)") }
            catch { print("Не удалось переместить \(app.path): \(error.localizedDescription)") }
        }
    }
}
do {
    guard CommandLine.arguments.count == 4 else { throw Failure(message: "Invalid installer arguments") }
    let phase = CommandLine.arguments[1], root = URL(fileURLWithPath: CommandLine.arguments[2]).standardizedFileURL, current = CommandLine.arguments[3]
    guard checkedPath(root), current.range(of: "^[0-9]+(\\.[0-9]+){1,3}$", options: .regularExpression) != nil else { throw Failure(message: "Invalid installation target") }
    if phase == "pre" {
        let target = root.appendingPathComponent("Applications/BMW Import.app")
        if fm.fileExists(atPath: target.path) {
            guard let old = version(target) else { throw Failure(message: "Существующий BMW Import не удалось идентифицировать. Замена отменена.") }
            guard old.compare(current, options: .numeric) != .orderedDescending else { throw Failure(message: "Уже установлена более новая версия BMW Import.") }
        }
        try closeApplications(root)
    } else if phase == "post" { try cleanup(root, current) }
    else { throw Failure(message: "Unknown phase") }
} catch {
    fputs(((error as? Failure)?.message ?? error.localizedDescription) + "\n", stderr); exit(1)
}
