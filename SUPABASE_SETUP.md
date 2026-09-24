# Cấu hình Supabase cho Ngày Xinh

## 1. Tạo project

Tạo một Supabase project và ghi lại:

- Project URL
- Publishable key (hoặc anon public key)

Không đưa `service_role` hoặc secret key vào GitHub Pages.

## 2. Áp schema

Mở SQL Editor của project và chạy toàn bộ file:

`supabase/schema.sql`

Schema tạo:

- `public.entries`
- Row Level Security theo `auth.uid()`
- bucket private `journal-media`
- policy Storage chỉ cho phép người dùng truy cập thư mục của chính UID
- Realtime cho bảng `entries`

## 3. Cấu hình Auth

Authentication → URL Configuration:

- Site URL: `https://hiep4294.github.io/ngay-xinh/`
- Redirect URLs: thêm `https://hiep4294.github.io/ngay-xinh/**`

Email/password là phương thức đăng nhập chính.

Nếu bật Confirm email, người dùng phải xác nhận email trước lần đăng nhập đầu tiên.

## 4. Kết nối frontend

Sửa `config.js`:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_PUBLIC_KEY';
```

Khi hai giá trị hợp lệ, `app.js` tự chuyển sang cloud mode.

Để mở lại dữ liệu cục bộ cũ:

`https://hiep4294.github.io/ngay-xinh/?mode=local`

Có thể xuất backup JSON ở local mode rồi import vào tài khoản cloud.

## 5. Kiểm tra bắt buộc

1. Tạo User A và User B.
2. User A tạo nhật ký + ảnh.
3. User B không được đọc/sửa/xóa dữ liệu User A.
4. User A đăng nhập trên thiết bị thứ hai và thấy cùng dữ liệu.
5. Xóa một nhật ký có media, kiểm tra row bị xóa và object được dọn.
6. Thử quên mật khẩu.
7. Thử backup JSON và restore.
