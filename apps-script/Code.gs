/**
 * GIA PHA VIET NAM - Backend Google Apps Script
 *
 * Cach dung:
 *   1. Chay setupSpreadsheet()  -> tao du cac sheet + header + 1 ma quan tri
 *   2. Deploy > New deployment > Web app
 *        Execute as        : Me
 *        Who has access    : Anyone
 *   3. Copy URL /exec dan vao VITE_API_URL cua frontend
 *
 * Ghi chu ve CORS: Apps Script khong tra loi preflight OPTIONS.
 * Frontend phai POST voi Content-Type: text/plain de tro thanh "simple request".
 */

var SHEET_HEADERS = {
  Members: [
    'id', 'fullName', 'gender', 'birthDate', 'deathDate', 'birthOrder',
    'address', 'occupation', 'fatherId', 'motherId', 'photoUrl',
    'createdAt', 'updatedAt', 'createdBy',
  ],
  Marriages: ['id', 'husbandId', 'wifeId', 'status', 'startDate', 'endDate', 'order'],
  AccessCodes: ['code', 'memberId', 'role', 'label', 'active', 'createdAt', 'lastLoginAt'],
  Notes: ['id', 'memberId', 'authorCode', 'authorName', 'content', 'createdAt'],
  Config: ['key', 'value'],
  AuditLog: ['timestamp', 'code', 'action', 'targetId', 'detail'],
};

var TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var MAX_LOGIN_FAILS = 8;
var LOGIN_BLOCK_SEC = 900;
var CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// ---------------------------------------------------------------- entry points

function doGet(e) {
  var cb = e && e.parameter ? e.parameter.callback : null;
  var body = { ok: true, service: 'gia-pha-viet-nam', time: new Date().toISOString() };
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(body) + ')').setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return jsonOut_(body);
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var action = req.action;
    if (!action) return fail_('Thieu truong "action"');

    if (action === 'login') return handleLogin_(req);

    var auth = requireAuth_(req.token);
    if (!auth.ok) return fail_(auth.error, 401);

    switch (action) {
      case 'bootstrap':      return handleBootstrap_(auth);
      case 'setMyPosition':  return handleSetMyPosition_(auth, req);
      case 'addMember':      return handleAddMember_(auth, req);
      case 'updateMember':   return handleUpdateMember_(auth, req);
      case 'addNote':        return handleAddNote_(auth, req);
      case 'deleteMember':   return handleDeleteMember_(auth, req);
      case 'deleteNote':     return handleDeleteNote_(auth, req);
      default:               return fail_('Khong ro action: ' + action);
    }
  } catch (err) {
    return fail_('Loi may chu: ' + err.message, 500);
  }
}

// ---------------------------------------------------------------- actions

function handleLogin_(req) {
  var code = String(req.code || '').trim().toUpperCase();
  if (!code) return fail_('Vui long nhap ma so');
  if (isLoginBlocked_(code)) return fail_('Ban da nhap sai qua nhieu lan. Vui long thu lai sau 15 phut.', 429);

  var row = findCodeRow_(code);
  if (!row || String(row.data.active).toUpperCase() === 'FALSE') {
    recordLoginFail_(code);
    return fail_('Ma so khong dung hoac da bi khoa', 401);
  }

  clearLoginFails_(code);
  touchSheetCell_('AccessCodes', row.rowIndex, 'lastLoginAt', new Date().toISOString());
  audit_(code, 'login', '', '');

  return jsonOut_({
    ok: true,
    token: makeToken_(code),
    role: row.data.role || 'editor',
    label: row.data.label || '',
    memberId: row.data.memberId || '',
  });
}

function handleBootstrap_(auth) {
  return jsonOut_({
    ok: true,
    me: { code: auth.code, role: auth.role, memberId: auth.memberId, label: auth.label },
    members: readSheet_('Members'),
    marriages: readSheet_('Marriages'),
    // KHONG tra ve authorCode: dang nhap chi bang ma so, lo ma la lo ca gia pha.
    notes: readSheet_('Notes').map(function (n) {
      return {
        id: n.id,
        memberId: n.memberId,
        authorName: n.authorName,
        content: n.content,
        createdAt: n.createdAt,
        mine: n.authorCode === auth.code,
      };
    }),
    config: readSheet_('Config'),
  });
}

function handleSetMyPosition_(auth, req) {
  var memberId = String(req.memberId || '').trim();
  if (!memberId) return fail_('Thieu memberId');
  if (!findMemberRow_(memberId)) return fail_('Khong tim thay thanh vien nay');

  var row = findCodeRow_(auth.code);
  touchSheetCell_('AccessCodes', row.rowIndex, 'memberId', memberId);
  audit_(auth.code, 'setMyPosition', memberId, '');
  return jsonOut_({ ok: true, memberId: memberId });
}

function handleAddMember_(auth, req) {
  if (!canEdit_(auth)) return fail_('Ban khong co quyen them thanh vien', 403);
  var p = req.member || {};
  if (!String(p.fullName || '').trim()) return fail_('Ho ten khong duoc de trong');
  if (p.gender !== 'M' && p.gender !== 'F') return fail_('Gioi tinh phai la M hoac F');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var now = new Date().toISOString();
    var id = newId_('m_');
    appendRow_('Members', {
      id: id,
      fullName: String(p.fullName).trim(),
      gender: p.gender,
      birthDate: p.birthDate || '',
      deathDate: p.deathDate || '',
      birthOrder: p.birthOrder || '',
      address: p.address || '',
      occupation: p.occupation || '',
      fatherId: p.fatherId || '',
      motherId: p.motherId || '',
      photoUrl: p.photoUrl || '',
      createdAt: now,
      updatedAt: now,
      createdBy: auth.code,
    });

    if (p.spouseId) addMarriage_(id, p.gender, p.spouseId);
    audit_(auth.code, 'addMember', id, p.fullName);
    return jsonOut_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}

function handleUpdateMember_(auth, req) {
  if (!canEdit_(auth)) return fail_('Ban khong co quyen sua thanh vien', 403);
  var id = String(req.id || '').trim();
  var patch = req.patch || {};
  var row = findMemberRow_(id);
  if (!row) return fail_('Khong tim thay thanh vien');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var editable = ['fullName','gender','birthDate','deathDate','birthOrder','address','occupation','fatherId','motherId','photoUrl'];
    editable.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        touchSheetCell_('Members', row.rowIndex, field, patch[field]);
      }
    });
    touchSheetCell_('Members', row.rowIndex, 'updatedAt', new Date().toISOString());
    audit_(auth.code, 'updateMember', id, JSON.stringify(patch).substring(0, 400));
    return jsonOut_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function handleAddNote_(auth, req) {
  if (!canEdit_(auth)) return fail_('Ban khong co quyen ghi chu', 403);
  var memberId = String(req.memberId || '').trim();
  var content = String(req.content || '').trim();
  if (!memberId || !content) return fail_('Thieu memberId hoac noi dung');
  if (!findMemberRow_(memberId)) return fail_('Khong tim thay thanh vien');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var note = {
      id: newId_('n_'),
      memberId: memberId,
      authorCode: auth.code,
      authorName: auth.label || '',
      content: content.substring(0, 4000),
      createdAt: new Date().toISOString(),
    };
    appendRow_('Notes', note);
    audit_(auth.code, 'addNote', memberId, '');
    return jsonOut_({ ok: true, note: note });
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteMember_(auth, req) {
  if (!canEdit_(auth)) return fail_('Ban khong co quyen xoa thanh vien', 403);
  var id = String(req.id || '').trim();
  var row = findMemberRow_(id);
  if (!row) return fail_('Khong tim thay thanh vien');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Khong cho xoa nguoi dang co con noi vao, neu khong ca nhanh ben duoi se mo coi.
    var children = readSheet_('Members').filter(function (m) {
      return m.fatherId === id || m.motherId === id;
    });
    if (children.length > 0) {
      var names = children.slice(0, 5).map(function (c) { return c.fullName; }).join(', ');
      return fail_(
        'Khong the xoa ' + row.data.fullName + ' vi con ' + children.length +
        ' nguoi dang nhan lam cha/me: ' + names +
        (children.length > 5 ? '...' : '') +
        '. Hay xoa hoac chuyen nhung nguoi do sang cha/me khac truoc.',
      );
    }

    deleteRowsWhere_('Notes', function (n) { return n.memberId === id; });
    deleteRowsWhere_('Marriages', function (w) {
      return w.husbandId === id || w.wifeId === id;
    });
    clearMemberLinks_(id);
    sheet_('Members').deleteRow(row.rowIndex);

    audit_(auth.code, 'deleteMember', id, row.data.fullName);
    return jsonOut_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteNote_(auth, req) {
  var id = String(req.id || '').trim();
  var row = findRowBy_('Notes', 'id', id);
  if (!row) return fail_('Khong tim thay ghi chu');
  if (row.data.authorCode !== auth.code && auth.role !== 'admin') {
    return fail_('Chi nguoi viet hoac quan tri moi xoa duoc ghi chu nay', 403);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    sheet_('Notes').deleteRow(row.rowIndex);
    audit_(auth.code, 'deleteNote', row.data.memberId, '');
    return jsonOut_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- auth

function getSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('HMAC_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('HMAC_SECRET', s);
  }
  return s;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, getSecret_()),
  );
}

function makeToken_(code) {
  var payload = Utilities.base64EncodeWebSafe(
    JSON.stringify({ code: code, exp: Date.now() + TOKEN_TTL_MS }),
  );
  return payload + '.' + sign_(payload);
}

function requireAuth_(token) {
  if (!token) return { ok: false, error: 'Chua dang nhap' };
  var parts = String(token).split('.');
  if (parts.length !== 2) return { ok: false, error: 'Token khong hop le' };
  if (sign_(parts[0]) !== parts[1]) return { ok: false, error: 'Token khong hop le' };

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    return { ok: false, error: 'Token khong hop le' };
  }
  if (!payload.exp || Date.now() > payload.exp) return { ok: false, error: 'Phien dang nhap da het han' };

  var row = findCodeRow_(payload.code);
  if (!row || String(row.data.active).toUpperCase() === 'FALSE') {
    return { ok: false, error: 'Ma so da bi khoa' };
  }
  return {
    ok: true,
    code: payload.code,
    role: row.data.role || 'editor',
    memberId: row.data.memberId || '',
    label: row.data.label || '',
  };
}

function canEdit_(auth) {
  return auth.role === 'admin' || auth.role === 'editor';
}

// ---------------------------------------------------------------- rate limit

function isLoginBlocked_(code) {
  var n = CacheService.getScriptCache().get('fail_' + code);
  return n !== null && Number(n) >= MAX_LOGIN_FAILS;
}

function recordLoginFail_(code) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('fail_' + code) || 0) + 1;
  cache.put('fail_' + code, String(n), LOGIN_BLOCK_SEC);
}

function clearLoginFails_(code) {
  CacheService.getScriptCache().remove('fail_' + code);
}

// ---------------------------------------------------------------- sheet helpers

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Thieu sheet "' + name + '". Hay chay setupSpreadsheet() truoc.');
  return sh;
}

function readSheet_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = normalizeCell_(values[r][c]);
    rows.push(obj);
  }
  return rows;
}

function normalizeCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function appendRow_(name, obj) {
  var sh = sheet_(name);
  var headers = SHEET_HEADERS[name];
  sh.appendRow(headers.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
}

function touchSheetCell_(name, rowIndex, field, value) {
  var col = SHEET_HEADERS[name].indexOf(field) + 1;
  if (col > 0) sheet_(name).getRange(rowIndex, col).setValue(value);
}

function findRowBy_(name, field, value) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var col = headers.indexOf(field);
  if (col < 0) return null;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col]).trim() === String(value).trim()) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = normalizeCell_(values[r][c]);
      return { rowIndex: r + 1, data: obj };
    }
  }
  return null;
}

function findCodeRow_(code) { return findRowBy_('AccessCodes', 'code', code); }
function findMemberRow_(id) { return findRowBy_('Members', 'id', id); }

function addMarriage_(newMemberId, gender, spouseId) {
  appendRow_('Marriages', {
    id: newId_('w_'),
    husbandId: gender === 'M' ? newMemberId : spouseId,
    wifeId: gender === 'M' ? spouseId : newMemberId,
    status: 'married',
    startDate: '',
    endDate: '',
    order: 1,
  });
}

/** Xoa tu duoi len tren de chi so dong khong bi truot. */
function deleteRowsWhere_(name, predicate) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0];
  var targets = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = normalizeCell_(values[r][c]);
    if (predicate(obj)) targets.push(r + 1);
  }
  targets.sort(function (a, b) { return b - a; });
  targets.forEach(function (rowIndex) { sh.deleteRow(rowIndex); });
  return targets.length;
}

/** Go lien ket vi tri cua nguoi vua bi xoa khoi cac ma dang nhap. */
function clearMemberLinks_(id) {
  var sh = sheet_('AccessCodes');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  var col = SHEET_HEADERS.AccessCodes.indexOf('memberId') + 1;
  if (col <= 0) return;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][col - 1]).trim() === id) sh.getRange(r + 1, col).setValue('');
  }
}

function audit_(code, action, targetId, detail) {
  try {
    appendRow_('AuditLog', {
      timestamp: new Date().toISOString(),
      code: code, action: action, targetId: targetId, detail: detail,
    });
  } catch (err) {
    // khong de audit lam hong nghiep vu chinh
  }
}

// ---------------------------------------------------------------- utils

function newId_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').substring(0, 8);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function fail_(message, status) {
  return jsonOut_({ ok: false, error: message, status: status || 400 });
}

// ---------------------------------------------------------------- setup (chay tay)

/** Chay 1 lan de tao du sheet, header va ma quan tri dau tien. */
function setupSpreadsheet() {
  var ss = ss_();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SHEET_HEADERS[name];
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#f1ece1');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  });

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tinh1');
  if (def && def.getLastRow() === 0) ss.deleteSheet(def);

  if (readSheet_('Config').length === 0) {
    appendRow_('Config', { key: 'clanName', value: 'Gia pha dong ho' });
    appendRow_('Config', { key: 'rootMemberId', value: '' });
  }

  var code = '';
  if (readSheet_('AccessCodes').length === 0) {
    code = generateAccessCode('Quan tri', 'admin');
  }

  getSecret_();

  // KHONG dung SpreadsheetApp.getUi().alert() o day: hop thoai do can giao dien
  // bang tinh de hien, chay tu trinh soan thao Apps Script thi no treo vo han.
  // Ghi ra Execution log thi doc duoc o ca hai noi.
  var summary =
    'Da khoi tao xong!\n' +
    (code ? 'Ma quan tri: ' + code + '\n' : '') +
    'Buoc tiep theo: Deploy > New deployment > Web app ' +
    '(Execute as: Me, Who has access: Anyone)';
  Logger.log(summary);
  return summary;
}

/** Tao them mot ma dang nhap moi cho nguoi trong ho. */
function generateAccessCode(label, role) {
  var code = newAccessCode_();
  appendRow_('AccessCodes', {
    code: code,
    memberId: '',
    role: role || 'editor',
    label: label || '',
    active: 'TRUE',
    createdAt: new Date().toISOString(),
    lastLoginAt: '',
  });
  Logger.log('Ma moi: ' + code);
  return code;
}

function newAccessCode_() {
  var raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  var out = '';
  for (var i = 0; i < raw.length && out.length < 8; i++) {
    if (CODE_ALPHABET.indexOf(raw.charAt(i)) >= 0) out += raw.charAt(i);
  }
  while (out.length < 8) out += CODE_ALPHABET.charAt(0);
  return 'GP-' + out.substring(0, 4) + '-' + out.substring(4, 8);
}
