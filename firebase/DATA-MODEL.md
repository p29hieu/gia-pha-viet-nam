# Mô hình dữ liệu Firestore

```
clans/{clanId}
  name          tên dòng họ
  ownerUid      người tạo, luôn giữ quyền chủ
  createdAt

clans/{clanId}/memberships/{uid}      ai được vào dòng họ này
  uid           BẰNG ĐÚNG id document — xem ghi chú bên dưới
  role          owner | admin | commenter | viewer
  displayName, email, photoURL
  memberId      vị trí của người này trong gia phả (trỏ tới members/{id});
                để trống với người đóng góp không có mặt trong cây
  joinedAt

clans/{clanId}/joinRequests/{uid}     hàng chờ duyệt
  displayName, email, photoURL, requestedAt

clans/{clanId}/members/{memberId}     mỗi người một document
  fullName, gender, birthDate, deathDate, birthOrder,
  address, occupation, fatherId, motherId, photoUrl,
  createdAt, updatedAt, createdBy

clans/{clanId}/marriages/{marriageId}
  husbandId, wifeId, status, startDate, endDate, order

clans/{clanId}/notes/{noteId}
  memberId, authorUid, authorName, content, createdAt

users/{uid}
  defaultClanId, displayName, email
```

## Vì sao membership phải lặp lại uid của chính nó

Một người có thể ở nhiều dòng họ, nên sau khi đăng nhập phải hỏi "bạn muốn mở
cây nào". Câu hỏi đó không trả lời được từ phía `clans`: luật cấm liệt kê
(`allow list: if false`), vì cho liệt kê là lộ danh sách mọi dòng họ trên hệ
thống cho bất kỳ ai đăng nhập.

Nên phải hỏi ngược từ phía membership, bằng collection group query lọc theo
`uid`. Firestore không lọc được theo id document trong truy vấn loại này, nên
id phải được chép thành một trường. Luật bảo mật cũng dựa vào chính trường đó
(`resource.data.uid == request.auth.uid`) — đây là mẫu quyền sở hữu mà Firebase
khuyến nghị cho collection group.

Vì luật đọc tin vào trường `uid`, luật ghi phải ép nó bằng đúng id document
(`request.resource.data.uid == uid`), nếu không ai đó ghi một giá trị bịa là
luật đọc tin theo.

Truy vấn này cần một **chỉ mục collection group** cho `memberships.uid` —
khai báo ở `firebase/firestore.indexes.json`, và trên bản thật là một
"single field exemption" bật Collection group scope. Thiếu chỉ mục thì truy vấn
báo lỗi chứ không trả về rỗng.

## Bốn mức quyền

| Mức | Xem & tìm | Ghi chú | Sửa người & quan hệ | Mời & duyệt |
|---|---|---|---|---|
| viewer | ✓ | | | |
| commenter | ✓ | ✓ | | |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |

`owner` là người lập cây, không phải mức cấp được. Khác `admin` đúng hai điểm,
cả hai đều để tránh khoá chết dòng họ: không ai hạ được quyền chủ, và không ai
đụng được vào bản ghi thành viên của chính chủ.

Giá trị cũ `editor` còn sót trong dữ liệu được quy về `admin` khi đọc
(`normaliseRole` trong `src/domain/perm.ts`); luật cũng vẫn chấp nhận nó.

## Vì sao mỗi người một document, không gộp cả cây vào một document

Gộp cả cây vào một document thì mỗi lần mở chỉ tốn 1 lượt đọc — rẻ hơn nhiều.
Nhưng hai người cùng sửa sẽ ghi đè lên nhau: ai lưu sau xoá mất thay đổi của
người trước, mà không ai biết. Với 2-3 người cùng vun gia phả thì đó là rủi ro
thật, nên tách mỗi người một document để hai người sửa hai nhánh khác nhau
không đụng nhau.

## Chi phí trên gói Spark (miễn phí)

Hạn mức: 50.000 lượt đọc, 20.000 lượt ghi mỗi ngày.

Gia phả 500 người, mỗi lần mở app tốn 500 lượt đọc. Ba người, mỗi người mở 10
lần một ngày là 15.000 lượt — còn cách xa hạn mức. Nếu sau này lên vài nghìn
người và nhiều người dùng, hãy bật bộ nhớ đệm ngoại tuyến của Firestore
(`persistentLocalCache`) để chỉ tải phần thay đổi.
