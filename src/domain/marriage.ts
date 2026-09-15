import type { Marriage, Member } from './types';

/**
 * Quy tac lien ket vo chong.
 *
 * Hai nguoi cung lam cha me cua mot dua con thi mac nhien la mot cap, nen khi
 * biet du ca cha lan me la noi luon - nguoi dung khong phai lam them thao tac.
 * Lien ket nay xoa duoc sau, vi khong phai cap cha me nao cung con la vo chong.
 */

/** Tim lien ket giua hai nguoi, khong quan tam ai dung vai chong hay vo. */
export function findMarriage(
  marriages: Marriage[],
  a: string,
  b: string,
): Marriage | undefined {
  return marriages.find(
    (m) => (m.husbandId === a && m.wifeId === b) || (m.husbandId === b && m.wifeId === a),
  );
}

/** Moi lien ket vo chong ma mot nguoi dang co. */
export function marriagesOf(marriages: Marriage[], id: string): Marriage[] {
  return marriages.filter((m) => m.husbandId === id || m.wifeId === id);
}

/** Nguoi ban doi trong mot lien ket cu the. */
export function spouseIn(marriage: Marriage, id: string): string {
  return marriage.husbandId === id ? marriage.wifeId : marriage.husbandId;
}

/** Xep hai nguoi vao dung vai chong va vo theo gioi tinh. */
export function orderCouple(
  a: Pick<Member, 'id' | 'gender'>,
  b: Pick<Member, 'id' | 'gender'>,
): { husbandId: string; wifeId: string } {
  if (a.gender === 'F' && b.gender === 'M') return { husbandId: b.id, wifeId: a.id };
  return { husbandId: a.id, wifeId: b.id };
}

/**
 * Dua con nay da biet du ca cha lan me ma hai nguoi chua noi voi nhau thi
 * tra ve cap can noi. Nguoc lai tra null.
 */
export function pendingParentLink(
  members: Member[],
  marriages: Marriage[],
  childId: string,
): { a: Member; b: Member } | null {
  const child = members.find((m) => m.id === childId);
  if (!child?.fatherId || !child.motherId) return null;

  const father = members.find((m) => m.id === child.fatherId);
  const mother = members.find((m) => m.id === child.motherId);
  if (!father || !mother) return null;
  if (findMarriage(marriages, father.id, mother.id)) return null;

  return { a: father, b: mother };
}
