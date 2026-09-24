import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?
    var timer: Timer?
    var attempts = 0
    let base = URL(string: "http://127.0.0.1:18765")!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "О BMW Import", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Завершить BMW Import", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem)
        let edit = NSMenu(title: "Правка"); editItem.submenu = edit
        for (title, selector, key) in [("Отменить", "undo:", "z"), ("Вырезать", "cut:", "x"), ("Копировать", "copy:", "c"), ("Вставить", "paste:", "v"), ("Выбрать всё", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        let fileItem = NSMenuItem(); menu.addItem(fileItem)
        let file = NSMenu(title: "Файл"); fileItem.submenu = file
        let printItem = file.addItem(withTitle: "Печать / PDF…", action: #selector(printPage), keyEquivalent: "p"); printItem.target = self
        NSApp.mainMenu = menu
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "printQuote")
        config.userContentController.addUserScript(WKUserScript(source: "window.print = function(){window.webkit.messageHandlers.printQuote.postMessage('print');};", injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "BMW Import"
        window.minSize = NSSize(width: 760, height: 600)
        window.contentView = web
        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<body style='background:#0d1729;color:white;font:24px -apple-system;padding:60px'>BMW IMPORT<br><small>Запуск приложения…</small></body>", baseURL: nil)
        do {
            let resources = Bundle.main.resourceURL!
            let data = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("BMW Import", isDirectory: true)
            if !FileManager.default.fileExists(atPath: data.path) {
                try FileManager.default.copyItem(at: resources.appendingPathComponent("initialData"), to: data)
            }
            let process = Process()
            process.executableURL = resources.appendingPathComponent("node")
            process.arguments = [resources.appendingPathComponent("app/server.mjs").path]
            var env = ProcessInfo.processInfo.environment
            env["BMW_PORT"] = "18765"; env["BMW_DATA_DIR"] = data.path
            process.environment = env
            let log = data.appendingPathComponent("desktop.log")
            FileManager.default.createFile(atPath: log.path, contents: nil)
            let handle = try FileHandle(forWritingTo: log)
            process.standardOutput = handle; process.standardError = handle
            try process.run(); server = process
            timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.checkReady() }
        } catch { fail(error.localizedDescription) }
    }
    func checkReady() {
        attempts += 1
        guard let server = server, server.isRunning else { fail("Сервер не запустился. Возможно, порт 18765 занят. Подробности: ~/Library/Application Support/BMW Import/desktop.log"); return }
        if attempts > 80 { fail("Превышено время запуска приложения."); return }
        URLSession.shared.dataTask(with: base.appendingPathComponent("api/health")) { [weak self] data, _, _ in
            guard let data = data, let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], obj["app"] as? String == "bmw-import" else { return }
            DispatchQueue.main.async {
                guard let self = self, self.timer != nil else { return }
                self.timer?.invalidate(); self.timer = nil
                self.web.load(URLRequest(url: self.base))
            }
        }.resume()
    }
    func fail(_ message: String) {
        timer?.invalidate(); timer = nil
        let alert = NSAlert(); alert.messageText = "Не удалось запустить BMW Import"; alert.informativeText = message
        alert.runModal(); NSApp.terminate(nil)
    }
    @objc func printPage() {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.isHorizontallyCentered = true
        let operation = web.printOperation(with: info)
        operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.frameInfo.isMainFrame && message.frameInfo.request.url?.host == "127.0.0.1" { printPage() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "about" || (url.host == "127.0.0.1" && url.port == 18765) { decisionHandler(.allow) }
        else { if ["https", "http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }; decisionHandler(.cancel) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { timer?.invalidate(); if server?.isRunning == true { server?.terminate(); server?.waitUntilExit() } }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
