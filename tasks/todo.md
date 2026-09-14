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

- [x] **Sửa / xoá thành viên**, xoá ghi chú, có chặn an toàn và xác nhận trước khi xoá
- [x] **Viết lại giao diện theo hướng mobile-first** cho Safari trên iPhone
- [x] **Toast thay cho màn hình chờ toàn trang** sau mỗi thao tác ghi
- [x] **Cập nhật lạc quan**: giao diện đổi ngay, gửi lên ngầm, hỏng thì hoàn nguyên
- [x] Nút làm mới + tự làm mới khi quay lại app (cho trường hợp 2-3 người cùng sửa)

- [x] Cấp quyền OAuth, chạy `setupSpreadsheet()` — đã tạo đủ 6 sheet và mã quản trị
- [x] Deploy Web App, gắn URL vào `.env.local` và repository secret `VITE_API_URL`
- [x] Bật GitHub Pages
- [x] Test luồng thật với Google Sheet: đăng nhập, tạo người đầu tiên, xoá

## Chuyển sang Firebase

- [x] Tạo project, bật đăng nhập Google, dựng Firestore tại Singapore
- [x] Security rules: chưa được duyệt thì không đọc được gì
- [x] Tầng dữ liệu Firestore + cổng chung để đổi nền tảng chỉ sửa một file
- [x] Màn đăng nhập Google, lập dòng họ, xin vào họ, chủ họ duyệt
- [ ] Anh Hiếu đăng nhập lần đầu để lập dòng họ
- [ ] Chuyển 17 người từ Google Sheet sang Firestore
- [ ] Đặt biến môi trường Firebase cho GitHub Actions rồi deploy
- [ ] Chạy song song một thời gian rồi mới gỡ Apps Script

## Còn lại

- [ ] Đổi tên dòng họ trong sheet `Config` (đang là `Gia pha dong ho`, chưa có dấu)
- [ ] Nhập dữ liệu gia phả thật
- [ ] Cấp mã cho người trong họ: chạy `generateAccessCode('Tên', 'editor')` trong Apps Script
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

**Lỗi anh Hiếu báo khi dùng thật**: mỗi lần lưu thành viên, cả màn hình bị thay bằng
"Đang mở gia phả…". Nguyên nhân: sau khi ghi, hook tải lại dữ liệu và đặt `status` về
`loading`, mà App coi `loading` là "đang mở lần đầu" nên xoá sạch màn hình — với Apps Script
mất 2-4 giây mỗi lần ghi thì cái chớp đó rất khó chịu. Đã tách `refreshing` (tải lại ngầm)
ra khỏi `loading` (mở lần đầu): dữ liệu cũ giữ nguyên trên màn hình, chỉ có một vạch mảnh
chạy dưới thanh trên, và kết quả báo bằng toast ở góc. Kiểm chứng bằng MutationObserver:
chạy đủ thêm/sửa/xoá mà màn hình chờ không xuất hiện lần nào.

**Ngõ cụt bắt được khi test với Sheet thật**: gia phả mới tinh có 0 người, nên màn "Bạn là
ai trong dòng họ?" trống trơn và không có cách nào thêm người đầu tiên. Đã thêm biểu mẫu
tạo chính mình ngay tại màn đó khi gia phả còn trống.

**Lỗi treo khi chạy `setupSpreadsheet()`**: hàm kết thúc bằng `SpreadsheetApp.getUi().alert()`,
mà hộp thoại đó cần giao diện bảng tính để hiện; chạy từ trình soạn thảo Apps Script thì nó
chờ vô hạn. Đã đổi sang `Logger.log` — đọc được ở cả hai nơi.

**Quyết định kiến trúc**: tải toàn bộ gia phả về client một lần thay vì gọi API theo từng
thao tác, vì Apps Script mất 1–3 giây mỗi lần gọi. Gia phả vài nghìn người vẫn rất nhẹ.

**Lỗ hổng bảo mật tự rà ra khi làm phần xoá**: `bootstrap` trả nguyên cột `authorCode`
của mọi ghi chú, nghĩa là bất kỳ ai đăng nhập cũng đọc được mã số của người khác. Với cơ
chế đăng nhập chỉ bằng mã số thì đó là lộ toàn bộ gia phả. Đã lọc bỏ `authorCode` ở máy
chủ và thay bằng cờ `mine`. Chưa ai kịp dùng bản cũ nên không cần đổi mã.

**Lỗi bố cục bắt được khi test trên khổ iPhone**: thanh trên và ô tìm kiếm tràn khỏi màn
hình, vì cột grid của `.shell` để `1fr` nên co giãn theo bề rộng `max-content` của cây gia
phả bên trong. Đổi sang `minmax(0, 1fr)` và thêm `min-width: 0` cho các khung con.

**Lỗi cuộn bắt được khi thêm tính năng tự tìm "Tôi"**: dùng `offsetLeft` để tính vị trí
cuộn là sai, vì cây có `transform: scale` và nhiều tầng `position: relative` nên
`offsetParent` không phải khung cuộn. Đổi sang đo bằng `getBoundingClientRect`.

**Quyết định về bố cục cây**: mỗi người có đúng một nút gốc (treo dưới cha, hoặc mẹ nếu
không rõ cha) để không ai bị vẽ hai lần kèm cả nhánh con. Vợ/chồng vẫn hiện cạnh nhau;
ai đã có nhánh riêng ở chỗ khác thì thẻ được đánh dấu ↗.
