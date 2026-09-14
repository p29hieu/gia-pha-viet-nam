# Triển khai backend (Google Apps Script)

## Tài nguyên đã tạo

| Thứ | Giá trị |
|---|---|
| Spreadsheet | **Gia Phả Việt Nam — Dữ liệu** |
| Spreadsheet ID | `1vFy-OO7yBNGAEo3d_KUQ44pIkBpGPmbR1R4pG7MwRj8` |
| Link Sheet | https://docs.google.com/spreadsheets/d/1vFy-OO7yBNGAEo3d_KUQ44pIkBpGPmbR1R4pG7MwRj8/edit |
| Apps Script | **Gia Phả Việt Nam — API** (bound vào Sheet trên) |
| Script ID | `1RkBRLbB679cFcv9C45K6cvtcvVmyByZSAAawqKLRztd4z7XFM0ftINH2` |
| Link Script | https://script.google.com/u/0/home/projects/1RkBRLbB679cFcv9C45K6cvtcvVmyByZSAAawqKLRztd4z7XFM0ftINH2/edit |

Nội dung `Code.gs` trên Google chính là bản sao của `apps-script/Code.gs` trong repo này.
Khi sửa code, sửa ở repo trước rồi dán lại lên Apps Script để hai bên không lệch nhau.

## Các bước còn lại

1. **Chạy `setupSpreadsheet()`** trong Apps Script editor.
   Lần chạy đầu Google sẽ hỏi cấp quyền cho script (Review permissions → chọn tài khoản →
   Advanced → Go to "Gia Phả Việt Nam — API" (unsafe) → Allow).
   Script chỉ xin quyền trên chính spreadsheet này.
   Kết quả: tạo đủ 6 sheet + header, và sinh **mã quản trị đầu tiên** dạng `GP-XXXX-XXXX`.

2. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy URL kết thúc bằng `/exec`.

3. Dán URL đó vào `.env.local` của frontend:
   ```
   VITE_API_URL=https://script.google.com/macros/s/..../exec
   ```

4. Cấp mã cho người trong họ: chạy `generateAccessCode('Tên người', 'editor')` trong editor,
   hoặc thêm dòng trực tiếp vào sheet `AccessCodes`.

## Vai trò

| role | quyền |
|---|---|
| `admin` | xem + sửa + quản lý mã |
| `editor` | xem + thêm/sửa thành viên + ghi chú |
| `viewer` | chỉ xem |
