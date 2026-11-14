import { describe, expect, it } from 'vitest';
import { InitDataError, validateInitData } from './init-data';
import { signInitData } from './testing';

const TOKEN = '123456:TEST-token_for-unit-tests';
const user = { id: 42, first_name: 'Ada', username: 'ada', language_code: 'en' };
const now = new Date('2026-11-14T12:00:00Z');

function expectCode(fn: () => unknown, code: InitDataError['code']) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(InitDataError);
    expect((error as InitDataError).code).toBe(code);
    return;
  }
  throw new Error('Expected InitDataError');
}

describe('validateInitData', () => {
  it('accepts correctly signed initData', () => {
    const initData = signInitData(
      { user, authDate: now, startParam: 'game_abc', chatType: 'group', chatInstance: '777' },
      TOKEN,
    );
    const result = validateInitData(initData, TOKEN, { now });
    expect(result.user).toEqual(user);
    expect(result.startParam).toBe('game_abc');
    expect(result.chatType).toBe('group');
    expect(result.authDate).toEqual(now);
  });

  it('rejects tampered initData', () => {
    const initData = signInitData({ user, authDate: now }, TOKEN);
    const tampered = initData.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":43'));
    expect(tampered).not.toBe(initData);
    expectCode(() => validateInitData(tampered, TOKEN, { now }), 'invalid_hash');
  });

  it('rejects initData signed by another bot', () => {
    const initData = signInitData({ user, authDate: now }, '999:OTHER-token');
    expectCode(() => validateInitData(initData, TOKEN, { now }), 'invalid_hash');
  });

  it('rejects expired initData', () => {
    const initData = signInitData(
      { user, authDate: new Date(now.getTime() - 2 * 3600_000) },
      TOKEN,
    );
    expectCode(() => validateInitData(initData, TOKEN, { now }), 'expired');
  });

  it('rejects initData without hash', () => {
    expectCode(() => validateInitData('auth_date=1&user=%7B%7D', TOKEN, { now }), 'missing_hash');
  });
});
