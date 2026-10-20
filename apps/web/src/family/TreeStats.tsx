import { useMemo } from 'react';
import { todayInVietnam } from '../calendar/month-grid';
import type { Person } from '../data/trees';
import { Collapsible } from '../ui/Collapsible';
import { computeFunStats } from './fun-stats';
import type { FamilyGraph } from './family-graph';

/** Vài con số tổng quan: tổng người, số đời, nam/nữ, còn sống/đã mất. */
export const TreeStats = ({ graph }: { graph: FamilyGraph<Person> }) => {
  const persons = graph.persons;
  const todayYear = todayInVietnam().year;
  const fun = useMemo(() => computeFunStats(graph.persons, graph.parentLinks, todayYear), [graph, todayYear]);
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

  const funRows: [string, string | null][] = [
    ['Tuổi thọ trung bình', fun.averageLifespan !== null ? `${Math.round(fun.averageLifespan)} tuổi` : null],
    ['Người thọ nhất', fun.longestLived ? `${fun.longestLived.person.full_name} (${fun.longestLived.age} tuổi)` : null],
    ['Người cao tuổi nhất còn sống', fun.oldestLiving ? `${fun.oldestLiving.person.full_name} (${fun.oldestLiving.age} tuổi)` : null],
    ['Số con trung bình', fun.averageChildren !== null ? `${fun.averageChildren.toFixed(1)} con mỗi người có con` : null],
    ['Họ phổ biến', fun.topSurnames.length ? fun.topSurnames.map((item) => `${item.name} (${item.count})`).join(', ') : null],
    ['Tên phổ biến', fun.topGivenNames.length ? fun.topGivenNames.map((item) => `${item.name} (${item.count})`).join(', ') : null],
  ];
  const visibleFun = funRows.filter(([, value]) => value);

  return (
    <div className="space-y-3">
      <dl className={`grid grid-cols-2 gap-3 ${stats.length > 4 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-surface px-4 py-3">
            <dt className="text-sm text-ink-muted">{stat.label}</dt>
            <dd className="font-serif text-2xl font-bold text-son">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {visibleFun.length > 0 && (
        <Collapsible title="Thống kê">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
            {visibleFun.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Collapsible>
      )}
    </div>
  );
};
