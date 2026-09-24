# 🌷 Ngày Xinh

Lịch nhật ký tiếng Việt dành cho điện thoại và máy tính.

- Mỗi người có thể tạo tài khoản cục bộ riêng bằng tên đăng nhập + mật khẩu.
- Nhật ký, ảnh và video được tách riêng theo từng tài khoản trên cùng trình duyệt/thiết bị.
- Mật khẩu được băm bằng PBKDF2-SHA-256 kèm salt, không lưu dạng văn bản thuần.
- Tạo tài khoản đầu tiên sẽ sao chép dữ liệu của phiên bản cũ vào tài khoản đó.
- Chọn ngày, viết/sửa/xóa nhật ký.
- 5 tâm trạng và màu tùy chọn cho từng ngày.
- Chụp ảnh, quay video bằng trình chọn camera của điện thoại; thêm ảnh/video từ thư viện. Máy tính sẽ mở trình chọn tệp. Hành vi camera phụ thuộc trình duyệt và điện thoại.
- Lưu ảnh/video thật trong IndexedDB, xem lại sau khi tải trang.
- Sao lưu và khôi phục JSON gồm cả ảnh/video; xác nhận trước khi ghi đè ngày trùng.
- Dùng ngoại tuyến sau lần mở trực tuyến đầu tiên. Có thể thêm trang vào màn hình chính bằng menu trình duyệt.

## Dùng thử

https://hiep4294.github.io/ngay-xinh/

Chọn ngày → chọn tâm trạng/màu → viết ghi chú hoặc thêm ảnh/video → **Lưu kỷ niệm**.

## Quyền riêng tư và giới hạn

Tài khoản hiện là tài khoản cục bộ của trình duyệt; chưa có máy chủ tài khoản và chưa đồng bộ tự động giữa thiết bị. GitHub chỉ phục vụ mã nguồn ứng dụng; ảnh, video và nội dung nhật ký không được đẩy lên GitHub. Dữ liệu lưu tại trình duyệt/thiết bị đang dùng, không mã hóa bằng mật khẩu. Không dùng máy chung để lưu nội dung riêng tư. Xóa dữ liệu trang hoặc mất thiết bị có thể làm mất nhật ký: hãy tải bản sao lưu thường xuyên, giữ tệp riêng tư và thử khôi phục.

Tệp ảnh/video giới hạn 100 MB mỗi tệp. Tổng dung lượng phụ thuộc bộ nhớ trình duyệt. Sao lưu nhiều video cần RAM và dung lượng trống tương ứng. Font Google được tải khi có mạng, có font hệ thống dự phòng.

## Chạy cục bộ

Không cần bước build hay thư viện JavaScript. Phục vụ thư mục qua HTTP (ví dụ `npx http-server . -p 4173`), sau đó mở `http://localhost:4173`. Tránh mở bằng `file://`. Camera trên điện thoại nên thử trực tiếp qua trang HTTPS GitHub Pages.

## Triển khai

GitHub Pages: Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## Kiểm tra trên điện thoại

Mở bằng Safari trên iPhone hoặc Chrome trên Android. Thử chụp ảnh, quay video ngắn, lưu nhật ký, tải lại trang; xuất bản sao lưu và khôi phục trên trình duyệt khác. Việc chọn camera và định dạng video cần xác minh trên thiết bị thật.


## Tài khoản

GitHub Pages là web tĩnh nên cơ chế hiện tại phù hợp để nhiều người dùng chung một thiết bị mà không lẫn dữ liệu. Nếu cần cùng một tài khoản đăng nhập trên nhiều điện thoại/máy tính và tự đồng bộ, cần bổ sung backend Authentication + Database + Storage (ví dụ Supabase hoặc Firebase).
