import { useId, useMemo, useState } from 'react';
import type { Person } from '../data/trees';
import type { Placement } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import { searchPersons } from './tree-search';

type Props = {
  persons: readonly Person[];
  placement: (personId: string) => Placement;
  onPick: (personId: string) => void;
};

/** Ô tìm Người theo tên (gõ có hoặc không dấu), chọn kết quả để Cây nhảy tới. */
export const PersonSearch = ({ persons, placement, onPick }: Props) => {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchPersons(persons, query), [persons, query]);

  const pick = (personId: string) => {
    onPick(personId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block font-medium">
        Tìm người
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-list`}
        autoComplete="off"
        placeholder="Gõ tên, có dấu hay không đều được"
        className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) {
            event.preventDefault();
            pick(results[0].id);
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      />
      {open && query.trim() !== '' && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-surface shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-ink-muted">Không thấy ai tên như vậy.</li>
          ) : (
            results.map((person) => {
              const { generation } = placement(person.id);
              const lifespan = lifespanText(person);
              return (
                <li key={person.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-paper"
                    onClick={() => pick(person.id)}
                  >
                    <span className="font-semibold">{person.full_name}</span>
                    <span className="text-sm text-ink-muted">
                      {[generation === null ? 'Chưa nối vào cây' : `Đời ${generation}`, lifespan].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
