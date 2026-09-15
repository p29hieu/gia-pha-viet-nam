# Giai đoạn 2 — Nhiều cây gia phả, mời người đóng góp, so quan hệ

## Bối cảnh

Giai đoạn 1 phục vụ đúng một dòng họ với 2–3 người dùng, tất cả đều là người nhà và
đều được chủ họ duyệt tay. Anh Hiếu nay muốn ba việc:

1. **Mời người đóng góp** — có thể là người trong cây, có thể là người ngoài. Ba mức:
   xem / bình luận / sửa.
2. **Một người nhiều cây gia phả** — chọn cây sau khi đăng nhập, id cây nằm trong URL.
3. **Xem quan hệ giữa hai người bất kỳ** trong cây, không chỉ giữa tôi và một người.

Thứ tự anh Hiếu chốt: **nhiều cây → mời → so quan hệ**. Lý do: lời mời gắn với từng
cây, nên mô hình nhiều cây phải xong trước thì việc mời mới có chỗ neo.

Tin tốt: Firestore **đã** lưu theo `clans/{clanId}/...` ngay từ đầu, luật bảo mật cũng
đã nhận `clanId` làm tham số (`isMember(clanId)`, `myRole(clanId)`…). Thứ duy nhất chốt
cứng một cây là hằng số `CLAN_ID = 'main'` ở [src/api/firebase.ts:38](../src/api/firebase.ts).
Cây hiện tại của anh giữ nguyên id `main`, **không phải chuyển dữ liệu**.

Việc mời là phần rủi ro nhất: luật Firestore là **lớp bảo vệ duy nhất** (cấu hình client
vốn công khai), mà lời mời thì cấp quyền đọc toàn bộ gia phả. Nên giai đoạn này có thêm
một hạng mục chưa từng có: **chỗ kiểm thử luật bảo mật**.

---

## Việc 1 — Nhiều cây gia phả, id trong URL

### Định tuyến
Dùng **hash** (`#/c/main`), không dùng đường dẫn thật. Lý do: GitHub Pages là host tĩnh,
đường dẫn thật cần mẹo `404.html` để không lỗi khi tải thẳng một URL con; hash thì không
bao giờ chạm tới máy chủ. Không thêm thư viện router — viết một hook `useHashRoute` nhỏ.

| URL | Màn hình |
|---|---|
| `#/` | Chọn cây (hoặc vào thẳng nếu chỉ có một cây) |
| `#/c/{clanId}` | Cây gia phả đó |
| `#/c/{clanId}/moi/{code}` | Nhận lời mời bằng link |

Nhớ cây vừa dùng trong `localStorage` để mở app lần sau vào thẳng — giữ nguyên trải
nghiệm hiện tại của anh Hiếu, không bắt chọn lại mỗi lần.

### "Tôi đang ở những cây nào?"
Luật hiện tại cấm liệt kê `clans` (`allow list: if false`), nên phải hỏi ngược từ phía
thành viên. Dùng **collection group query** trên `memberships`:

- Ghi thêm trường `uid` vào mỗi document membership (nay chỉ có ở kiểu TypeScript,
  chưa ghi xuống Firestore) — cần **vá lại các membership đang có** của cây `main`.
- Luật mới, đúng mẫu quyền sở hữu mà Firebase khuyến nghị cho collection group:
  ```
  match /{path=**}/memberships/{mid} {
    allow read: if request.auth != null && resource.data.uid == request.auth.uid;
  }
  ```
- Truy vấn `collectionGroup('memberships').where('uid','==',uid)`, kèm **chỉ mục
  collection group** cho `uid` (thêm `firestore.indexes.json`).

Bỏ được luôn chỗ chữa cháy trong `readAccess`: hiện nó **nuốt lỗi permission-denied** và
coi đó là câu trả lời "chưa phải thành viên" (`src/api/firestoreClient.ts`, hàm `readAccess`).

### Luồng code
`clanId` đi từ URL → `useSession` → singleton trong `client.ts` (đặt cạnh `account`
sẵn có) → các hàm dựng đường dẫn trong `firestoreClient.ts` nhận `clanId` làm tham số.
Tầng trên (`App.tsx`, các component) **không cần biết** `clanId` — hôm nay nó cũng chưa
bao giờ ra khỏi tầng api, giữ nguyên như vậy.

### Trạng thái màn hình mới
Thêm `no-clan-selected` (đã đăng nhập, chưa chọn cây) → màn **Chọn cây**: danh sách cây
của tôi + nút "Tạo cây mới". Trạng thái `no-clan` hiện tại đổi nghĩa thành "id trong URL
không tồn tại".

### File chạm vào
`src/api/firebase.ts` (bỏ hằng số), `src/api/firestoreClient.ts` (7 hàm đường dẫn +
`readAccess` + hàm liệt kê cây mới), `src/api/client.ts`, `src/api/importBackup.ts`,
`src/hooks/useSession.ts`, `src/App.tsx`, `firebase/firestore.rules`;
thêm `src/hooks/useHashRoute.ts`, `src/components/auth/ClanPicker.tsx`.

---

## Việc 2 — Mời người đóng góp, ba mức quyền

### Mức quyền
`owner | editor | commenter | viewer` — thêm `commenter` vào giữa.

| Mức | Đọc cây | Ghi chú | Sửa người & quan hệ | Duyệt người vào |
|---|---|---|---|---|
| viewer | ✓ | | | |
| commenter | ✓ | ✓ | | |
| editor | ✓ | ✓ | ✓ | |
| owner | ✓ | ✓ | ✓ | ✓ |

`useSession` đang trả `{ canEdit, isOwner }`; đổi thành `{ role, canComment, canEdit, isOwner }`.
Chỗ duy nhất tách ra giữa "bình luận" và "sửa" là biểu mẫu ghi chú trong
`src/components/person/PersonDetail.tsx` — nay gác theo `canComment`.
Luật thêm `canComment(clanId)`, dùng cho `notes` create.

### Mời theo email
`clans/{clanId}/invites/{email viết thường}` —
`{ email:'nguoi.duoc.moi@example.com', role:'commenter', memberId:'m_00000000',
invitedBy:'uid_ABC123', createdAt:'2026-09-15T12:00:00.000Z' }`.

- Chủ họ tạo / sửa / xoá.
- Người được mời đọc được đúng lời mời của mình: `request.auth.token.email.lower() == inviteId`.
- Nhận lời mời = tự tạo document membership, luật chỉ cho phép khi có lời mời khớp
  email **đã xác thực** và `role` đúng bằng role ghi trong lời mời:
  ```
  allow create: if signedIn()
    && request.auth.uid == uid
    && request.auth.token.email_verified == true
    && emailInviteRole(clanId) == request.resource.data.role;
  ```
  Người khác mở cùng đường link vẫn phải xin duyệt như cũ.

### Mời bằng link có mã
`clans/{clanId}/inviteLinks/{code}` —
`{ role:'viewer', memberId:'', createdAt:'2026-09-15T12:00:00.000Z',
expiresAt:'2026-09-22T12:00:00.000Z', maxUses:5, uses:0 }`.
Mã 16 ký tự sinh bằng `crypto.getRandomValues`.

- `allow get: if signedIn()` nhưng `allow list: if false` — phải biết mã mới dựng được
  đường dẫn. Đây là mẫu "capability URL": **bí mật nằm ở chính cái link**.
- Hết hạn kiểm ngay trong luật: `request.time < resource.data.expiresAt`.
- Đếm lượt dùng: cho phép cập nhật **chỉ mỗi trường `uses`** và chỉ được tăng đúng 1,
  chặn khi đã đủ `maxUses`. Client nhận lời mời trong một transaction.
- Chủ họ thu hồi bằng cách xoá document.

**Nói rõ điểm yếu để anh cân nhắc khi gửi:** ai cầm link cũng vào được đúng mức quyền đó.
Đó là bản chất của cách mời này, không phải lỗi. Vì vậy màn tạo link mặc định đặt hạn
7 ngày, và mặc định mức "chỉ xem".

### Màn "Người đóng góp"
Mở rộng `JoinRequestsPanel` hiện tại thành một sheet đầy đủ cho chủ họ:
- Người đang có quyền: đổi mức, gỡ quyền, gắn với một người trong cây.
- Yêu cầu đang chờ duyệt (như cũ, thêm mức "Bình luận").
- Lời mời đang treo: theo email và theo link, kèm nút thu hồi.
- Hai thẻ tạo mới: **Mời theo email** · **Tạo link mời**.

Lời mời mang sẵn `memberId` thì người nhận vào thẳng cây, bỏ qua bước "Bạn là ai trong
dòng họ?" — đúng ý "người đóng góp có thể là một thành viên trong cây".

### Kiểm thử luật bảo mật (hạng mục mới)
Thêm `firebase.json` + Firestore emulator + `@firebase/rules-unit-testing`, viết test cho
các tình huống: người lạ không đọc được gì; người có lời mời email nhận đúng mức quyền đã
ghi chứ không tự nâng lên `owner`; email chưa xác thực bị chặn; link hết hạn bị chặn; link
quá số lượt bị chặn; `commenter` ghi chú được nhưng không sửa được người; chủ họ không tự
hạ quyền mình. Chạy được cả ở máy lẫn CI.

---

## Việc 3 — So quan hệ giữa hai người

Phần lõi **đã xong sẵn**: `resolveKinship(graph, aId, bId)` trong `src/domain/kinship/`
vốn nhận hai id bất kỳ, không hề gắn với "tôi". Đây gần như thuần giao diện.

- Tách khối hiển thị danh xưng trong `PersonDetail` ra thành `KinshipView` dùng chung,
  để hai chỗ không trôi lệch nhau.
- Màn **So quan hệ**: hai ô chọn người (dùng lại `MemberPicker`), mặc định người thứ nhất
  là tôi; kết quả hiện "A gọi B là gì · B gọi A là gì · có họ thông qua ai".
- Vào từ: nút trên thanh trên, và nút "So với người khác" trong thẻ chi tiết (điền sẵn
  người đang mở).
- Đưa cặp đang so vào URL (`#/c/{clanId}/so/{aId}/{bId}`) để gửi được cho người khác xem.

---

## Cách nghiệm thu

1. `npx vitest run` — toàn bộ test cũ vẫn xanh, cộng test mới cho `useHashRoute`, các
   hàm suy ra quyền, và bộ test luật chạy trên emulator.
2. `npm run build` — bundle vẫn trong ngân sách.
3. Thử trên **dữ liệu demo** ở cổng 5174 trước, cả khổ iPhone 375 lẫn desktop
   (bài học đã ghi ở `tasks/lessons.md`: chỉ test demo đã từng giấu lỗi bố cục).
4. Thử thật trên cây `main`: tạo cây thứ hai, chuyển qua lại bằng URL, tự mời chính mình
   sang tài khoản khác ở cả hai mức xem và bình luận, kiểm tra người ở mức xem **không**
   thấy nút sửa và **không** ghi chú được.
5. Mỗi việc xong là commit và deploy riêng để anh Hiếu dùng thử ngay, không chờ cả ba.

## Rủi ro đã lường trước

- **Vá trường `uid` cho membership đang có**: phải làm trước khi bật màn chọn cây, nếu
  không truy vấn sẽ trả về rỗng và anh Hiếu tưởng mất cây. Làm bằng một hàm chạy tay,
  đọc kỹ trước khi ghi, và **không đụng vào dữ liệu thật ngoài đúng trường này**.
- **Luật Firestore sai = lộ toàn bộ gia phả.** Không dán luật mới lên production trước
  khi bộ test emulator xanh.
- **Đổi `CLAN_ID` thành tham số chạm vào mọi hàm ghi.** Làm một lượt, dựa vào TypeScript
  bắt lỗi thiếu tham số, không sửa nửa vời.
