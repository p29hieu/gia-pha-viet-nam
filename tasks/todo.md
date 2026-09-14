# Gia Phả Việt Nam — tiến độ

## Đã xong

- [x] **GĐ 0 — Khởi tạo**: Vite + React + TypeScript, vitest, prettier, cấu trúc thư mục
- [x] **GĐ 1 — Engine danh xưng (TDD)**: `graph.ts`, `kinship/`, gia phả mẫu 5 đời, 57 test
- [x] **GĐ 2 — Backend**: `apps-script/Code.gs` đầy đủ action, `setupSpreadsheet()`, hướng dẫn triển khai
- [x] **GĐ 3 — Tầng dữ liệu**: `api/client.ts` có chế độ demo, `useFamilyData`
- [x] **GĐ 4 — Giao diện nền**: design tokens "giấy dó – mực nho", đăng nhập, chọn vị trí
- [x] **GĐ 5 — Thẻ người & chi tiết**: thông tin · quan hệ · có họ qua ai · chú thích
- [x] **GĐ 6 — Cây gia phả & tìm kiếm**: bố cục cây, thu gọn nhánh, zoom, tìm không dấu
- [x] **GĐ 7 — Kiểm thử**: 82 test xanh, kiểm tra thủ công trên Chrome ở desktop và 375px

## Còn lại

- [ ] Cấp quyền OAuth cho Apps Script rồi chạy `setupSpreadsheet()` *(cần anh Hiếu bấm Allow)*
- [ ] Deploy Web App, lấy URL `/exec`, đặt vào `.env.local` và repository secret `VITE_API_URL`
- [ ] Bật GitHub Pages cho repo
- [ ] Nhập dữ liệu gia phả thật
- [ ] Anh Hiếu soát lại bảng danh xưng theo thói quen của dòng họ

## Tương lai (đã bàn, chưa làm)

- [ ] Đăng nhập bằng Google
- [ ] Ảnh đại diện (cột `photoUrl` đã có sẵn trong Sheet và trong kiểu dữ liệu)
- [ ] Mỗi người tự tạo gia phả riêng, mời người khác, phân quyền xem / bình luận / sửa

## Ghi chép khi làm

**Lỗi đã phát hiện và sửa trong lúc test trên Chrome**: vợ hai của bố bị gọi là "mẹ",
không phân biệt được với mẹ ruột. Nguyên nhân: nhánh suy ra danh xưng từ vợ/chồng của
người có huyết thống ánh xạ thẳng `bố → mẹ`. Đã tách riêng trường hợp bố mẹ kế
(`mẹ kế` / `bố dượng`) và con riêng (`con riêng của chồng/vợ`), kèm 4 test mới.

**Quyết định kiến trúc**: tải toàn bộ gia phả về client một lần thay vì gọi API theo từng
thao tác, vì Apps Script mất 1–3 giây mỗi lần gọi. Gia phả vài nghìn người vẫn rất nhẹ.

**Quyết định về bố cục cây**: mỗi người có đúng một nút gốc (treo dưới cha, hoặc mẹ nếu
không rõ cha) để không ai bị vẽ hai lần kèm cả nhánh con. Vợ/chồng vẫn hiện cạnh nhau;
ai đã có nhánh riêng ở chỗ khác thì thẻ được đánh dấu ↗.
