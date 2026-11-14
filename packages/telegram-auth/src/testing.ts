import { computeInitDataHash, type TelegramUser } from './init-data';

export interface SignInitDataInput {
  user: TelegramUser;
  authDate?: Date;
  startParam?: string;
  chatType?: string;
  chatInstance?: string;
  queryId?: string;
}

/**
 * Genera un initData firmado como lo haría Telegram. Solo para tests y desarrollo
 * local (Playwright, Mini App fuera de Telegram). Nunca en producción.
 */
export function signInitData(input: SignInitDataInput, botToken: string): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor((input.authDate ?? new Date()).getTime() / 1000)));
  params.set('user', JSON.stringify(input.user));
  if (input.startParam) params.set('start_param', input.startParam);
  if (input.chatType) params.set('chat_type', input.chatType);
  if (input.chatInstance) params.set('chat_instance', input.chatInstance);
  if (input.queryId) params.set('query_id', input.queryId);
  params.set('hash', computeInitDataHash(params, botToken));
  return params.toString();
}
