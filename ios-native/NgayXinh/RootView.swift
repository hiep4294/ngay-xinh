import SwiftUI

struct RootView: View {
    @EnvironmentObject private var lockController: AppLockController
    @AppStorage("faceIDEnabled") private var faceIDEnabled = false
    @State private var showingSettings = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            WebJournalView()
                .ignoresSafeArea(.container, edges: .bottom)
                .blur(radius: isLocked ? 12 : 0)
                .allowsHitTesting(!isLocked)

            if isLocked {
                lockOverlay
                    .transition(.opacity)
            } else {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color(red: 0.39, green: 0.27, blue: 0.62))
                        .frame(width: 44, height: 44)
                        .background(.ultraThinMaterial, in: Circle())
                        .shadow(radius: 6, y: 2)
                }
                .padding(.top, 10)
                .padding(.trailing, 12)
                .accessibilityLabel("Cài đặt Ngày Xinh")
            }
        }
        .background(Color(red: 247/255, green: 245/255, blue: 251/255))
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(lockController)
        }
        .animation(.easeInOut(duration: 0.18), value: isLocked)
    }

    private var isLocked: Bool {
        faceIDEnabled && !lockController.isUnlocked
    }

    private var lockOverlay: some View {
        ZStack {
            Color(red: 247/255, green: 245/255, blue: 251/255)
                .opacity(0.92)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                Image(systemName: "faceid")
                    .font(.system(size: 58))
                    .foregroundStyle(Color(red: 0.45, green: 0.33, blue: 0.78))

                Text("Ngày Xinh đang khóa")
                    .font(.title2.bold())

                Text("Dùng Face ID hoặc mật mã iPhone để mở nhật ký.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button {
                    Task { await lockController.unlock() }
                } label: {
                    Label("Mở bằng Face ID", systemImage: "lock.open.fill")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.45, green: 0.33, blue: 0.78))

                if !lockController.lastError.isEmpty {
                    Text(lockController.lastError)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                }
            }
            .padding(28)
        }
    }
}
