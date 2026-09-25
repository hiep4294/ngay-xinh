import Foundation
import UserNotifications

@MainActor
final class ReminderManager {
    static let shared = ReminderManager()

    private let center = UNUserNotificationCenter.current()
    private let identifier = "ngay-xinh-daily-journal"

    private init() {}

    func enableDailyReminder(hour: Int, minute: Int) async -> Bool {
        let settings = await center.notificationSettings()

        var authorized = settings.authorizationStatus == .authorized ||
            settings.authorizationStatus == .provisional

        if settings.authorizationStatus == .notDetermined {
            do {
                authorized = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            } catch {
                return false
            }
        }

        guard authorized else { return false }

        center.removePendingNotificationRequests(withIdentifiers: [identifier])

        let content = UNMutableNotificationContent()
        content.title = "Ngày Xinh"
        content.body = "Dành một phút để lưu lại hôm nay nhé."
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
            return true
        } catch {
            return false
        }
    }

    func disableDailyReminder() {
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
    }
}
