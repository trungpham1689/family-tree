import type { ReactNode } from 'react';
import { todayInVietnam } from '../calendar/month-grid';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { fieldLabel, fieldsOf, fieldText, type TextFieldKey } from './profile-fields';
import { ageAtDeath, anniversaryText, currentAge, deathAgeLabel, describeDate } from './person-display';
import { storedBirth, storedDeath } from './person-form';

/** Các trường chữ của một khối hiện ở trang hồ sơ (bỏ trường ẩn, như tên huý và tiểu sử, vốn có chỗ riêng). */
const profileFields = (group: 'names' | 'life') => fieldsOf(group).filter((field) => !('profile' in field) || field.profile !== 'hidden');

/** Giá trị một trường chữ ở trang hồ sơ: điện thoại và email là liên kết. */
const profileValue = (person: Person, key: TextFieldKey): ReactNode => {
  const value = fieldText(person, key);
  if (!value) return null;
  if (key === 'phone') return <a href={`tel:${value.replace(/\s/g, '')}`} className="text-son underline">{value}</a>;
  if (key === 'email') return <a href={`mailto:${value}`} className="text-son underline">{value}</a>;
  return value;
};

/** Hồ sơ một Người: chỉ hiện những mục có thông tin. Dùng cho trang có vai trò và trang công khai. */
export const ProfileInfo = ({ person, graph }: { person: Person; graph: FamilyGraph<Person> }) => {
  const today = todayInVietnam();
  const age = ageAtDeath(person);
  const alive = currentAge(person, today.year);
  const anniversary = person.is_deceased ? anniversaryText({ day: person.anniversary_day, month: person.anniversary_month }, today) : null;
  const worshipKeeper = person.worship_keeper_id ? graph.person(person.worship_keeper_id)?.full_name ?? null : null;
  const row = (key: TextFieldKey): [string, ReactNode] => [fieldLabel(key, 'profile'), profileValue(person, key)];
  const rows: [string, ReactNode][] = [
    ...profileFields('names').map((field) => row(field.key)),
    ['Giới tính', person.gender === 'nam' ? 'Nam' : person.gender === 'nu' ? 'Nữ' : null],
    ['Ngày sinh', describeDate(storedBirth(person))],
    ['Tuổi', alive !== null ? `${alive} tuổi` : null],
    ...profileFields('life').map((field) => row(field.key)),
  ];
  const deathRows: [string, ReactNode][] = person.is_deceased
    ? [
        ['Ngày mất', describeDate(storedDeath(person)) ?? 'Chưa rõ'],
        [age !== null ? deathAgeLabel(age) : 'Hưởng thọ', age !== null ? `${age} tuổi` : null],
        ['Ngày giỗ', anniversary],
        [
          fieldLabel('burialPlace', 'profile'),
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
                  📍 Mở bản đồ
                </a>
              )}
            </span>
          ),
        ],
        row('worshipPlace'),
        ['Người phụ trách cúng giỗ', worshipKeeper],
      ]
    : [];
  const visible = [...rows, ...deathRows].filter(([, value]) => value);

  return (
    <>
      {visible.length > 0 && (
        <dl className="mt-6 grid grid-cols-1 gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface p-4 min-[360px]:grid-cols-[6rem_minmax(0,1fr)] min-[360px]:gap-y-3 sm:grid-cols-[max-content_1fr] sm:gap-x-6 sm:p-5">
          {visible.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="break-words font-medium">{value}</dd>
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
