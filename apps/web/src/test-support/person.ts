import { BLANK_PERSON } from '../data/blank-person';
import type { Person } from '../data/trees';

/** Người với mọi trường trống, ghi đè vài trường — chỉ dùng trong test. */
export const blankPerson = (fields: Partial<Person> & { id: string; full_name: string }): Person => ({ ...BLANK_PERSON, ...fields });
