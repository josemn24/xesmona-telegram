// Phase 0 spike: remove once the Mini App tests (M1–M6) are done.
import { signInitData } from '@xesmona/telegram-auth/testing';
import { describe, expect, it } from 'vitest';
import { spikeRoutes } from './spike-routes';

const TOKEN = '123456:TEST-token_for-unit-tests';
const app = spikeRoutes([{ id: 'games', token: TOKEN }]);
const user = { id: 42, first_name: 'Ada' };

const whoami = (authorization?: string, query = '') =>
  app.request(`/whoami${query}`, {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

describe('POST /api/spike/whoami', () => {
  it('returns the verified initData', async () => {
    const initData = signInitData(
      { user, startParam: 'abc', chatType: 'group', chatInstance: '777' },
      TOKEN,
    );
    const res = await whoami(`tma ${initData}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      bot: 'games',
      user,
      startParam: 'abc',
      chatType: 'group',
      chatInstance: '777',
    });
  });

  it('rejects initData signed with another token', async () => {
    const res = await whoami(`tma ${signInitData({ user }, '999:other')}`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: 'invalid_hash' });
  });

  it('rejects a missing header and unknown bots', async () => {
    expect((await whoami()).status).toBe(401);
    const initData = signInitData({ user }, TOKEN);
    expect((await whoami(`tma ${initData}`, '?bot=nope')).status).toBe(404);
  });
});
