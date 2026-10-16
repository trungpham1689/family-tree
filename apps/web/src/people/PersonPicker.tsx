import { useMemo, useState } from 'react';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { searchPersons } from '../tree/tree-search';
import { TextField } from '../ui/fields';
import { lifespanText } from './person-display';
import { personLabel } from './person-label';

type Props = {
  graph: FamilyGraph<Person>;
  label: string;
  onPick: (personId: string) => void;
  exclude?: ReadonlySet<string>;
};

/** Ô tìm và chọn một Người trong gia phả (gõ có hoặc không dấu). */
export const PersonPicker = ({ graph, label, onPick, exclude }: Props) => {
  const [query, setQuery] = useState('');
  const candidates = useMemo(
    () => (exclude ? graph.persons.filter((person) => !exclude.has(person.id)) : graph.persons),
    [graph, exclude],
  );
  const results = useMemo(() => searchPersons(candidates, query, 8), [candidates, query]);

  return (
    <div>
      <TextField
        label={label}
        placeholder="Gõ tên, có dấu hay không đều được"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== '' && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {results.length === 0 && <li className="px-4 py-3 text-ink-muted">Không thấy ai tên như vậy.</li>}
          {results.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-paper"
                onClick={() => {
                  onPick(person.id);
                  setQuery('');
                }}
              >
                <span className="font-semibold">{personLabel(graph, person.id)}</span>
                {lifespanText(person) && <span className="text-sm text-ink-muted">{lifespanText(person)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
