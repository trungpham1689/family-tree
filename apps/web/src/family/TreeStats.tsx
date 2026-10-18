import type { Person } from '../data/trees';
import type { FamilyGraph } from './family-graph';

/** Vài con số tổng quan: tổng người, số đời, nam/nữ, còn sống/đã mất. */
export const TreeStats = ({ graph }: { graph: FamilyGraph<Person> }) => {
  const persons = graph.persons;
  const total = persons.length;
  const male = persons.filter((p) => p.gender === 'nam').length;
  const female = persons.filter((p) => p.gender === 'nu').length;
  const deceased = persons.filter((p) => p.is_deceased).length;
  const generations = graph.generations();
  const maxGeneration = generations.reduce((max, group) => Math.max(max, group.generation), 0);
  const unconnected = graph.unconnected().length;

  if (total === 0) return null;

  const stats: { label: string; value: string }[] = [
    { label: 'Tổng số Người', value: String(total) },
    { label: 'Số đời', value: maxGeneration > 0 ? String(maxGeneration) : '—' },
    { label: 'Nam · Nữ', value: `${male} · ${female}` },
    { label: 'Còn sống · Đã mất', value: `${total - deceased} · ${deceased}` },
  ];
  if (unconnected > 0) stats.push({ label: 'Chưa nối vào cây', value: String(unconnected) });

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-line bg-surface px-4 py-3">
          <dt className="text-sm text-ink-muted">{stat.label}</dt>
          <dd className="font-serif text-2xl font-bold text-son">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
};
