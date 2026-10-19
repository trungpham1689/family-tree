import type { ReactNode } from 'react';
import { todayInVietnam } from '../calendar/month-grid';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { ageAtDeath, anniversaryText, currentAge, deathAgeLabel, describeDate } from './person-display';
import { storedBirth, storedDeath } from './person-form';

/** Hồ sơ một Người: chỉ hiện những mục có thông tin. Dùng cho trang có vai trò và trang công khai. */
export const ProfileInfo = ({ person, graph }: { person: Person; graph: FamilyGraph<Person> }) => {
  const today = todayInVietnam();
  const age = ageAtDeath(person);
  const alive = currentAge(person, today.year);
  const anniversary = person.is_deceased ? anniversaryText({ day: person.anniversary_day, month: person.anniversary_month }, today) : null;
  const worshipKeeper = person.worship_keeper_id ? graph.person(person.worship_keeper_id)?.full_name ?? null : null;
  const rows: [string, ReactNode][] = [
    ['Tên thường gọi', person.common_name],
    ['Tên tự / hiệu', person.courtesy_name],
    ['Giới tính', person.gender === 'nam' ? 'Nam' : person.gender === 'nu' ? 'Nữ' : null],
    ['Ngày sinh', describeDate(storedBirth(person))],
    ['Tuổi', alive !== null ? `${alive} tuổi` : null],
    ['Nơi sinh', person.birth_place],
    ['Quê quán', person.hometown],
    ['Nơi ở', person.residence],
    ['Nghề nghiệp', person.occupation],
    ['Học vấn', person.education],
    ['Chức vụ / danh hiệu', person.title],
    ['Vai vế', person.role_note],
    ['Điện thoại', person.phone && <a key="tel" href={`tel:${person.phone.replace(/\s/g, '')}`} className="text-son underline">{person.phone}</a>],
    ['Email', person.email && <a key="mail" href={`mailto:${person.email}`} className="text-son underline">{person.email}</a>],
  ];
  const deathRows: [string, ReactNode][] = person.is_deceased
    ? [
        ['Ngày mất', describeDate(storedDeath(person)) ?? 'Chưa rõ'],
        [age !== null ? deathAgeLabel(age) : 'Hưởng thọ', age !== null ? `${age} tuổi` : null],
        ['Ngày giỗ', anniversary],
        [
          'Mộ phần',
          (person.burial_place || person.burial_map_url) && (
            <span key="burial" className="flex flex-wrap items-center gap-3">
              {person.burial_place}
              {person.burial_map_url && (
                <a
                  href={person.burial_map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl bg-son px-4 font-semibold text-white"
                >
                  Chỉ đường
                </a>
              )}
            </span>
          ),
        ],
        ['Nơi thờ', person.worship_place],
        ['Người phụ trách cúng giỗ', worshipKeeper],
      ]
    : [];
  const visible = [...rows, ...deathRows].filter(([, value]) => value);

  return (
    <>
      {visible.length > 0 && (
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[max-content_1fr]">
          {visible.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {person.biography && (
        <section className="mt-6">
          <h2 className="font-serif text-xl font-bold">Tiểu sử</h2>
          <p className="mt-2 whitespace-pre-line">{person.biography}</p>
        </section>
      )}
    </>
  );
};
