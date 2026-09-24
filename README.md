# 🌷 Ngày Xinh

Lịch nhật ký tiếng Việt dành cho điện thoại và máy tính.

- Hỗ trợ Supabase Auth bằng email + mật khẩu để một tài khoản dùng trên nhiều thiết bị.
- Nhật ký đồng bộ qua Postgres; ảnh/video lưu trong bucket private Supabase Storage.
- Row Level Security giới hạn mỗi người chỉ truy cập dữ liệu của chính mình.
- Realtime cập nhật thay đổi giữa các thiết bị.
- Bản tài khoản cục bộ cũ vẫn được giữ và có thể mở bằng `?mode=local`.
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

Khi Supabase được cấu hình, GitHub Pages chỉ phục vụ frontend; nội dung nhật ký lưu trong Postgres và media lưu trong bucket private. Frontend chỉ dùng publishable/anon public key; không được đặt service_role hoặc secret key trong repository. RLS và Storage policies là lớp kiểm soát bắt buộc để tách dữ liệu theo tài khoản.

Tệp ảnh/video giới hạn 100 MB mỗi tệp. Tổng dung lượng phụ thuộc bộ nhớ trình duyệt. Sao lưu nhiều video cần RAM và dung lượng trống tương ứng. Font Google được tải khi có mạng, có font hệ thống dự phòng.

## Chạy cục bộ

Không cần bước build hay thư viện JavaScript. Phục vụ thư mục qua HTTP (ví dụ `npx http-server . -p 4173`), sau đó mở `http://localhost:4173`. Tránh mở bằng `file://`. Camera trên điện thoại nên thử trực tiếp qua trang HTTPS GitHub Pages.

## Triển khai

GitHub Pages: Settings → Pages → Deploy from a branch → `main` → `/ (root)`.

## Kiểm tra trên điện thoại

Mở bằng Safari trên iPhone hoặc Chrome trên Android. Thử chụp ảnh, quay video ngắn, lưu nhật ký, tải lại trang; xuất bản sao lưu và khôi phục trên trình duyệt khác. Việc chọn camera và định dạng video cần xác minh trên thiết bị thật.


## Tài khoản và đồng bộ

Cloud mode dùng Supabase Auth + Database + Storage + Realtime. Cấu hình chi tiết xem `SUPABASE_SETUP.md` và schema xem `supabase/schema.sql`.

Nếu `config.js` chưa có thông tin Supabase, ứng dụng tự chạy bản local cũ để không làm gián đoạn dữ liệu đang có.
