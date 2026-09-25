# Ngày Xinh iOS

Bản iPhone native dùng **SwiftUI + WKWebView** và giữ nguyên backend Supabase/web hiện tại.

## Chức năng native

- Khóa ứng dụng bằng **Face ID / mật mã iPhone**.
- Tự khóa khi app chuyển nền.
- Nhắc viết nhật ký mỗi ngày bằng **Local Notifications**.
- Người dùng tự chọn giờ nhắc.
- Dùng cùng tài khoản, nhật ký, ảnh và video với bản web.
- Không cần API/backend mới ngoài Supabase hiện tại.

## Mở trong Xcode

Yêu cầu macOS, Xcode và XcodeGen.

```bash
brew install xcodegen
cd ios-native
xcodegen generate
open NgayXinh.xcodeproj
```

Trong Xcode:

1. Chọn target **NgayXinh**.
2. Signing & Capabilities → chọn Apple Developer Team.
3. Bundle Identifier mặc định: `vn.hiep4294.ngayxinh`.
4. Chạy trên iPhone thật để thử Face ID và thông báo.

## TestFlight / App Store

Để phát hành cần Apple Developer Program. Sau khi chọn Team và Bundle ID hợp lệ:

1. Product → Archive.
2. Distribute App → App Store Connect.
3. Upload.
4. Vào App Store Connect → TestFlight để mời người thử.

GitHub Actions `iOS Native Build` kiểm tra tự động project bằng iOS Simulator và không cần certificate.
