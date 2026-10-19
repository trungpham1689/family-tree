import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFLINE_CACHE_VERSION } from './offline-cache';

describe('phiên bản bộ nhớ đệm', () => {
  it('VERSION của service worker khớp OFFLINE_CACHE_VERSION (đổi một nơi phải đổi nơi kia)', () => {
    const sw = readFileSync(join(import.meta.dirname, '..', '..', 'public', 'sw.js'), 'utf8');
    expect(/const VERSION = '([^']+)'/.exec(sw)?.[1]).toBe(OFFLINE_CACHE_VERSION);
  });
});
