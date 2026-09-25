import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var lockController: AppLockController

    @AppStorage("faceIDEnabled") private var faceIDEnabled = false
    @AppStorage("reminderEnabled") private var reminderEnabled = false
    @AppStorage("reminderHour") private var reminderHour = 21
    @AppStorage("reminderMinute") private var reminderMinute = 0

    @State private var statusMessage = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Bảo mật") {
                    Toggle(isOn: faceIDBinding) {
                        Label("Khóa bằng Face ID", systemImage: "faceid")
                    }

                    Text("Khi bật, ứng dụng sẽ khóa lại khi rời app và yêu cầu Face ID hoặc mật mã khi quay lại.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Nhắc viết nhật ký") {
                    Toggle(isOn: reminderBinding) {
                        Label("Nhắc mỗi ngày", systemImage: "bell.fill")
                    }

                    DatePicker(
                        "Giờ nhắc",
                        selection: reminderDateBinding,
                        displayedComponents: .hourAndMinute
                    )
                    .disabled(!reminderEnabled)

                    Text("Thông báo được lên lịch trực tiếp trên iPhone, không cần máy chủ chạy nền.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Tài khoản & dữ liệu") {
                    LabeledContent("Đồng bộ", value: "Supabase")
                    LabeledContent("Website", value: "ngay-xinh")
                    Text("Tài khoản, nhật ký, ảnh và video vẫn dùng cùng dữ liệu với bản web.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !statusMessage.isEmpty {
                    Section {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Cài đặt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Xong") { dismiss() }
                }
            }
        }
    }

    private var faceIDBinding: Binding<Bool> {
        Binding(
            get: { faceIDEnabled },
            set: { newValue in
                if !newValue {
                    faceIDEnabled = false
                    lockController.disableLock()
                    statusMessage = "Đã tắt khóa Face ID."
                    return
                }

                Task {
                    let success = await lockController.verifyBiometryBeforeEnabling()
                    await MainActor.run {
                        faceIDEnabled = success
                        statusMessage = success
                            ? "Đã bật khóa Face ID."
                            : "Không bật được Face ID. Hãy kiểm tra Face ID trong Cài đặt iPhone."
                    }
                }
            }
        )
    }

    private var reminderBinding: Binding<Bool> {
        Binding(
            get: { reminderEnabled },
            set: { newValue in
                if !newValue {
                    reminderEnabled = false
                    ReminderManager.shared.disableDailyReminder()
                    statusMessage = "Đã tắt nhắc viết nhật ký."
                    return
                }

                Task {
                    let success = await ReminderManager.shared.enableDailyReminder(
                        hour: reminderHour,
                        minute: reminderMinute
                    )
                    await MainActor.run {
                        reminderEnabled = success
                        statusMessage = success
                            ? "Đã bật nhắc viết nhật ký hằng ngày."
                            : "Không bật được thông báo. Hãy cho phép thông báo trong Cài đặt iPhone."
                    }
                }
            }
        )
    }

    private var reminderDateBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    bySettingHour: reminderHour,
                    minute: reminderMinute,
                    second: 0,
                    of: Date()
                ) ?? Date()
            },
            set: { newDate in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                reminderHour = parts.hour ?? 21
                reminderMinute = parts.minute ?? 0

                guard reminderEnabled else { return }

                Task {
                    let success = await ReminderManager.shared.enableDailyReminder(
                        hour: reminderHour,
                        minute: reminderMinute
                    )
                    await MainActor.run {
                        statusMessage = success
                            ? "Đã cập nhật giờ nhắc."
                            : "Không cập nhật được lịch nhắc."
                    }
                }
            }
        )
    }
}
