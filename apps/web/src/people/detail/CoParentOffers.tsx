import { useLinkCoParent } from '../../data/tree-queries';
import type { Person } from '../../data/trees';
import { coParentOffers, coParentWord, type CoParentOffer } from '../../family/co-parent';
import type { FamilyGraph } from '../../family/family-graph';
import { spouseLabel } from '../../family/labels';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/fields';

const names = (people: readonly Person[]) => people.map((person) => person.full_name).join(', ');

/**
 * Gợi ý ghi cha/mẹ CÒN LẠI cho con chỉ mới có một cha/mẹ, để cả hai cùng thấy con trên trang của mình:
 * con của chính người này (chọn trong vợ/chồng), và con của vợ/chồng người này (người này có thể là cha/mẹ còn lại).
 * Chỉ hiện khi có gì để ghi; ghi sai thì sửa ở trang của con.
 */
export const CoParentOffers = ({ treeId, graph, person }: { treeId: string; graph: FamilyGraph<Person>; person: Person }) => {
  const link = useLinkCoParent(treeId);
  const offers = coParentOffers(graph, person.id);
  if (offers.length === 0) return null;
  const spouses = graph.spousesOf(person.id);

  const own = (offer: CoParentOffer<Person>) => {
    const word = coParentWord(person.gender);
    if (spouses.length === 1) {
      const spouse = spouses[0]!.person;
      return (
        <>
          <p>
            {offer.children.length} con chưa ghi {word.toLowerCase()}: {names(offer.children)}.
          </p>
          <Button variant="secondary" disabled={link.isPending} onClick={() => link.mutate({ parentId: person.id, coParentId: spouse.id, childIds: offer.children.map((child) => child.id) })}>
            Ghi {spouse.full_name} là {word.toLowerCase()} của {offer.children.length > 1 ? `${offer.children.length} con này` : 'con này'}
          </Button>
        </>
      );
    }
    return (
      <>
        <p>
          {offer.children.length} con chưa ghi {word.toLowerCase()}. Chọn {word.toLowerCase()} cho từng con:
        </p>
        <ul className="mt-2 space-y-2">
          {offer.children.map((child) => (
            <li key={child.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{child.full_name}</span>
              <Select
                aria-label={`${word} của ${child.full_name}`}
                className="min-h-11"
                value=""
                disabled={link.isPending}
                onChange={(event) => event.target.value && link.mutate({ parentId: person.id, coParentId: event.target.value, childIds: [child.id] })}
              >
                <option value="">Chọn {word.toLowerCase()}…</option>
                {spouses.map(({ person: spouse, order }) => (
                  <option key={spouse.id} value={spouse.id}>
                    {spouseLabel(spouse.gender, order)}: {spouse.full_name}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      </>
    );
  };

  const fromSpouse = (offer: CoParentOffer<Person>) => {
    const word = coParentWord(offer.parent.gender);
    return (
      <>
        <p>
          {offer.parent.full_name} có {offer.children.length} con chưa ghi {word.toLowerCase()}: {names(offer.children)}.
        </p>
        <Button variant="secondary" disabled={link.isPending} onClick={() => link.mutate({ parentId: offer.parent.id, coParentId: person.id, childIds: offer.children.map((child) => child.id) })}>
          Ghi {person.full_name} là {word.toLowerCase()} của {offer.children.length > 1 ? 'các con này' : 'con này'}
        </Button>
      </>
    );
  };

  return (
    <>
      {offers.map((offer) => (
        <li key={`${offer.owner}-${offer.parent.id}`} className="space-y-2 bg-kim-soft px-5 py-3">
          {offer.owner === 'self' ? own(offer) : fromSpouse(offer)}
        </li>
      ))}
      {link.isError && <li className="px-5 py-3 text-sm text-danger">{link.error.message}</li>}
    </>
  );
};
