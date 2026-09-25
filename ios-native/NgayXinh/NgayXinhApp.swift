import SwiftUI

@main
struct NgayXinhApp: App {
    @StateObject private var lockController = AppLockController()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("faceIDEnabled") private var faceIDEnabled = false

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(lockController)
                .onAppear {
                    guard faceIDEnabled else {
                        lockController.disableLock()
                        return
                    }
                    lockController.lock()
                    Task { await lockController.unlock() }
                }
                .onChange(of: scenePhase) { phase in
                    switch phase {
                    case .background, .inactive:
                        if faceIDEnabled {
                            lockController.lock()
                        }
                    case .active:
                        if faceIDEnabled && !lockController.isUnlocked {
                            Task { await lockController.unlock() }
                        }
                    @unknown default:
                        break
                    }
                }
        }
    }
}
