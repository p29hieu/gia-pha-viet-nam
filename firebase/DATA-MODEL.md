# Mô hình dữ liệu Firestore

```
clans/{clanId}
  name          tên dòng họ
  ownerUid      người tạo, luôn giữ quyền chủ
  createdAt

clans/{clanId}/memberships/{uid}      ai được vào dòng họ này
  role          owner | editor | viewer
  displayName, email, photoURL
  memberId      vị trí của người này trong gia phả (trỏ tới members/{id})
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
