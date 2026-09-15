# Bài học

Ghi lại các lỗi đã mắc và quy tắc tự đặt ra để không lặp lại.

---

## 1. Không bao giờ thao tác trên dữ liệu thật khi thử nghiệm

**Đã xảy ra:** trong lúc kiểm thử chức năng thêm người thân, tôi ghi đè bố của
Đỗ Quang Hiếu bằng một bản ghi thử. Dữ liệu thật của gia đình bị hỏng, phải khôi phục tay.

**Quy tắc:**
- Mọi thử nghiệm chạy ở chế độ demo, cổng 5174. Không bao giờ nhấn nút ghi trên
  tab đang đăng nhập Firestore thật.
- Với bản thật chỉ được đọc: chụp màn hình, đo đạc bằng JS chỉ-đọc, không gọi mutation.
- Firestore gói Spark không có point-in-time recovery. Mất là mất thật.

---

## 2. Kiểm thử cả chế độ demo lẫn chế độ thật khi động vào bố cục

**Đã xảy ra:** `.shell` khai báo `grid-template-rows: auto auto 1fr`, nhưng banner
"dữ liệu mẫu" chỉ tồn tại ở chế độ demo. Tôi chỉ test trên demo — nơi banner luôn hiện
nên lưới tình cờ xếp đúng. Ở bản thật không có banner, nội dung tự xếp vào hàng 2 và
thanh nút Sửa/Xoá bị đẩy ra ngoài màn hình. Anh Hiếu phải báo lỗi.

**Quy tắc:**
- Phần tử render có điều kiện + lưới tự xếp chỗ = bẫy. Luôn đặt `grid-row` tường minh.
- Khi sửa CSS bố cục, kiểm tra ở cả hai chế độ và ít nhất hai khổ màn hình
  (mobile 375, desktop ~1440), đo bằng `getBoundingClientRect` chứ không nhìn bằng mắt.

---

## 3. Đo vị trí phần tử phải chờ animation xong

**Đã xảy ra:** đo `.detail__actions` ngay sau khi mở bottom sheet trên mobile, kết quả
báo nút nằm ngoài màn hình trong khi ảnh chụp cho thấy nó hiện rõ. Sheet còn đang trượt lên.

**Quy tắc:** đo trong `requestAnimationFrame` hoặc chờ đủ lâu; đối chiếu số đo với ảnh chụp,
lệch nhau thì nghi ngờ phép đo trước khi nghi ngờ code.

---

## 4. Danh xưng: nuôi tính huyết thống, đỡ đầu thì không

**Đã xảy ra:** tôi thiết kế cả quan hệ nuôi lẫn đỡ đầu đều chỉ để hiển thị, không đưa vào
engine. Anh Hiếu sửa lại: **quan hệ nuôi có tính huyết thống, quan hệ đỡ đầu thì không.**

**Quy tắc:** cha/mẹ nuôi nằm trong `getParents` để engine đi qua; cha/mẹ đỡ đầu tách riêng,
chỉ gắn thêm dòng `care` khi hiển thị. Việc về phong tục phải hỏi anh Hiếu, đừng tự suy.

---

## 5. Hôn phối: mỗi người chỉ một dây tại một thời điểm

**Đã xảy ra:** thêm bố và mẹ xong thì báo "bố mẹ anh chưa có liên kết vợ chồng".

**Quy tắc:** thêm cặp cha–mẹ thì tự nối hôn phối; thêm vợ/chồng mới thì gỡ dây cũ của
**cả hai phía** trước khi nối. Đọc `stateRef.current.marriages` một lần cho cả hai bên,
đọc hai lần sẽ dính trạng thái cũ.

---

## 6. Cập nhật lạc quan: truyền hàm biến đổi, đừng chụp rồi ghi đè

**Đã xảy ra:** hai thao tác liên tiếp đè nhau — thao tác sau khôi phục lại thứ thao tác
trước vừa xoá. Độ trễ của Firestore che mất lỗi, chạy demo mới lộ ngay.

**Quy tắc:** `apply` nhận hàm biến đổi (`prev => next`), ảnh chụp chỉ dùng để rollback.
Và khi đổi id tạm sang id thật, phải đổi cả id của chính bản ghi, không chỉ các khoá ngoại.

---

## 7. Đừng hỏi khi có thể tự quyết

**Đã xảy ra:** tôi mở hộp thoại hỏi anh Hiếu về chiến lược deploy. Anh từ chối trả lời.

**Quy tắc:** chuyện có phương án mặc định hợp lý thì tự chọn, ghi lại giả định trong
kế hoạch rồi làm tiếp. Chỉ hỏi khi hai cách hiểu dẫn tới hai sản phẩm khác hẳn nhau.
