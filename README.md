# Gia Phả Việt Nam

Ứng dụng web tra cứu gia phả dòng họ, trọng tâm là **danh xưng theo văn hoá miền Bắc**:
chọn một người bất kỳ trong cây, ứng dụng cho biết bạn gọi họ là gì, họ gọi lại bạn là gì,
và hai bên có họ với nhau thông qua ai.

Dữ liệu lưu trên Google Spreadsheet, truy cập qua Google Apps Script. Giao diện là web tĩnh,
xuất bản qua GitHub Pages.

## Tính năng

- Đăng nhập bằng mã số do người quản lý dòng họ cấp
- Tự chọn vị trí của mình trong dòng họ
- Cây gia phả dạng thẻ, thu gọn / mở rộng từng nhánh, phóng to thu nhỏ
- **Tra cứu danh xưng hai chiều** kèm diễn giải "có họ thông qua ai"
- Thêm thành viên (con, vợ/chồng, anh chị em, bố, mẹ)
- **Sửa** thông tin và **xoá** khỏi gia phả, có chặn an toàn
- Ghi chú cho từng người, ai cũng đọc được; tự xoá được ghi chú của mình
- Tìm kiếm theo tên, gõ không dấu vẫn ra

## Thiết kế cho điện thoại trước

Phần lớn người trong họ mở gia phả trên điện thoại, nên giao diện lấy mobile làm gốc
rồi mới mở rộng lên máy tính, và xử lý riêng các đặc thù của Safari trên iOS:

- `100dvh` thay cho `100vh` — thanh công cụ Safari co giãn làm `100vh` nhảy
- `env(safe-area-inset-*)` cho tai thỏ và vạch home
- Mọi ô nhập giữ cỡ chữ 16px, dưới mốc đó Safari tự phóng to trang khi chạm vào
- Vùng chạm tối thiểu 44px, trạng thái hover chỉ bật trên thiết bị thực sự có chuột
- Bảng thông tin trượt lên từ đáy màn hình, thanh nút cố định trong vùng an toàn
- Mở cây là tự cuộn tới thẻ của chính mình, không bắt người dùng đi tìm

## Chạy thử ngay, không cần Google Sheet

```bash
pnpm install
pnpm dev
```

Mở http://localhost:5173 và đăng nhập bằng mã `GP-DEMO-2026`. Ứng dụng chạy bằng gia phả mẫu
5 đời, mọi thay đổi lưu trong `localStorage` của trình duyệt.

## Nối với Google Sheet thật

Xem hướng dẫn từng bước ở [apps-script/DEPLOY.md](apps-script/DEPLOY.md). Tóm tắt:

1. Tạo Google Spreadsheet mới, vào **Extensions → Apps Script**, dán nội dung
   [apps-script/Code.gs](apps-script/Code.gs).
2. Chạy hàm `setupSpreadsheet()` — tự tạo đủ sheet, header và mã quản trị đầu tiên.
3. **Deploy → New deployment → Web app** (Execute as: Me, Who has access: Anyone).
4. Đặt URL `/exec` vào `.env.local`:
   ```
   VITE_API_URL=https://script.google.com/macros/s/..../exec
   ```
   Khi deploy lên GitHub Pages thì đặt cùng giá trị đó vào repository secret `VITE_API_URL`.

## Quy tắc danh xưng

Engine cài đặt chuẩn miền Bắc. Vài điểm đáng chú ý:

| Tình huống | Danh xưng |
|---|---|
| Anh/chị của bố **hoặc** của mẹ | **bác** (dùng cho cả nam lẫn nữ) |
| Em trai của bố / em gái của bố | chú / cô |
| Em trai của mẹ / em gái của mẹ | cậu / dì |
| Con của bác | **anh/chị họ — kể cả khi ít tuổi hơn mình** |
| Con của chú, cô, cậu, dì | **em họ — kể cả khi nhiều tuổi hơn mình** |
| Em trai của ông nội | ông trẻ |
| Vợ của chú / vợ của cậu | thím / mợ |
| Vợ hai của bố | mẹ kế (không phải "mẹ") |
| Bố nuôi / mẹ nuôi | **tính như huyết thống** — anh của bố nuôi vẫn là bác |
| Bố đỡ đầu / mẹ đỡ đầu | **không tính huyết thống** — chỉ hiện kèm bên cạnh |

Anh chị em **họ** xét theo vai vế của bố mẹ chứ không theo tuổi. Khi tuổi đi ngược vai,
ứng dụng vẫn trả đúng vai và hiện một dòng giải thích để người xem không tưởng là lỗi.

Nếu dòng họ nhà bạn có thói quen gọi khác, sửa từ điển tại
[src/domain/kinship/terms.ts](src/domain/kinship/terms.ts).

## Kiến trúc

```
src/domain/          logic thuần, không phụ thuộc giao diện
  graph.ts           dựng đồ thị, tìm tổ tiên chung gần nhất
  kinship/           engine danh xưng  ← phần lõi, được test kỹ nhất
  layout.ts          bố cục cây
src/api/client.ts    gọi Apps Script, có chế độ demo
src/components/      giao diện React
apps-script/Code.gs  backend chạy trên Google
```

Sau khi đăng nhập, **toàn bộ** gia phả được tải về một lần; mọi thao tác tính danh xưng,
dựng cây và tìm kiếm chạy hoàn toàn ở trình duyệt. Apps Script mất 1–3 giây mỗi lần gọi nên
tránh gọi nhiều lần là quyết định hiệu năng quan trọng nhất của dự án.

## Lệnh

```bash
pnpm dev            # máy chủ phát triển
pnpm test           # chạy toàn bộ test
pnpm test:coverage  # kiểm tra độ phủ
pnpm build          # build production
```

## Quan hệ giữa hai người

Ngoài cha mẹ ruột, mỗi người ghi được tối đa một bố nuôi, một mẹ nuôi, một bố đỡ đầu
và một mẹ đỡ đầu. Hai loại này khác nhau ở chỗ:

- **Nuôi** được tính như huyết thống khi lần ra quan hệ: vợ của bố nuôi là mẹ nuôi, con
  của bố nuôi là anh chị em. Riêng quan hệ trực tiếp thì nói rõ "bố nuôi", "con nuôi".
- **Đỡ đầu** không tính huyết thống. Danh xưng giữ nguyên theo họ hàng sẵn có, quan hệ đỡ
  đầu chỉ hiện thêm một dòng bên cạnh. Nếu hai người không có quan hệ nào khác thì nó
  thành câu trả lời chính.

Mỗi người chỉ giữ **một dây hôn phối** tại một thời điểm, theo tục Việt Nam.

Sửa và gỡ quan hệ ngay trong thẻ của từng người. Khi chọn người, ai không hợp lệ vẫn hiện
trong danh sách nhưng bị khoá kèm lý do — chặn đặt con cháu làm cha mẹ (sẽ tạo vòng lặp
trong cây), đặt nữ làm bố, hay cho hai người cùng huyết thống trực hệ làm vợ chồng.

## Xoá an toàn

Xoá một người là thao tác không hoàn tác được, nên hệ thống:

- **Chặn hẳn** khi người đó còn con nối vào — xoá đi thì cả nhánh bên dưới mất gốc mà
  người dùng không nhìn thấy điều đó xảy ra. Thông báo nêu đích danh những người con để
  biết đường xử lý.
- Nói trước hệ quả: gỡ bao nhiêu liên kết vợ/chồng, xoá bao nhiêu ghi chú.
- Kiểm tra hai lần: ở trình duyệt để giải thích cho người dùng, và ở Apps Script để
  không ai lách được bằng cách gọi thẳng API.

## Bảo mật

Đăng nhập chỉ bằng mã số, nên mã được sinh dài và ngẫu nhiên (`GP-7K4M-2XQ9`), có giới hạn
số lần nhập sai, và phiên đăng nhập dùng token ký HMAC hết hạn sau 7 ngày.
**Mã số là thứ duy nhất bảo vệ dữ liệu dòng họ — đừng chia sẻ công khai.**

Máy chủ **không bao giờ trả mã số của người khác về trình duyệt**. Ghi chú gửi về chỉ kèm
tên người viết và một cờ cho biết có phải của chính mình hay không.

Mã nguồn công khai nhưng dữ liệu thì không: toàn bộ gia phả nằm trong Google Sheet riêng của
bạn, không có gì trong repo này.
