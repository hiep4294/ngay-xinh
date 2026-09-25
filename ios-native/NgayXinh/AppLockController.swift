import Foundation
import LocalAuthentication

@MainActor
final class AppLockController: ObservableObject {
    @Published private(set) var isUnlocked = true
    @Published private(set) var lastError = ""

    func lock() {
        isUnlocked = false
    }

    func disableLock() {
        isUnlocked = true
        lastError = ""
    }

    func unlock() async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Hủy"
        context.localizedFallbackTitle = "Dùng mật mã"

        var error: NSError?
        let policy: LAPolicy = .deviceOwnerAuthentication

        guard context.canEvaluatePolicy(policy, error: &error) else {
            lastError = error?.localizedDescription ?? "Thiết bị chưa thiết lập Face ID hoặc mật mã."
            isUnlocked = false
            return false
        }

        do {
            let success = try await context.evaluatePolicy(
                policy,
                localizedReason: "Xác thực để mở nhật ký Ngày Xinh"
            )
            isUnlocked = success
            lastError = success ? "" : "Không xác thực được."
            return success
        } catch {
            lastError = error.localizedDescription
            isUnlocked = false
            return false
        }
    }

    func verifyBiometryBeforeEnabling() async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Hủy"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            lastError = error?.localizedDescription ?? "Face ID chưa sẵn sàng."
            return false
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Bật Face ID để bảo vệ nhật ký Ngày Xinh"
            )
            if success {
                isUnlocked = true
                lastError = ""
            }
            return success
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }
}
