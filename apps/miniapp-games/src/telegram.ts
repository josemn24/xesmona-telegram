import {
  init,
  initData,
  isTMA,
  miniApp,
  mockTelegramEnv,
  swipeBehavior,
  themeParams,
} from '@tma.js/sdk-react';

/**
 * Outside Telegram (browser in development) we mock the environment so we can
 * iterate on the UI. The mocked initData is NOT signed: the backend will reject it,
 * which is exactly what should happen. For E2E tests use signInitData() from
 * @xesmona/telegram-auth/testing.
 */
function mockEnvForDev() {
  const user = { id: 1, first_name: 'Dev', username: 'dev', language_code: 'en' };
  const tgWebAppData = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
    start_param: 'dev',
    chat_type: 'group',
    chat_instance: '0',
    signature: 'dev',
    hash: 'dev',
  });
  mockTelegramEnv({
    launchParams: {
      tgWebAppData,
      tgWebAppVersion: '9.1',
      tgWebAppPlatform: 'tdesktop',
      tgWebAppThemeParams: {
        bg_color: '#17212b',
        secondary_bg_color: '#232e3c',
        text_color: '#f5f5f5',
        hint_color: '#708499',
        link_color: '#6ab3f3',
        button_color: '#5288c1',
        button_text_color: '#ffffff',
      },
    },
  });
  console.info('[miniapp] Mocked Telegram environment (development only)');
}

export async function initTelegram() {
  // isTMA('complete') checks the real environment (not just the parameters stored in
  // sessionStorage, which survive a reload after mocking the environment).
  if (import.meta.env.DEV && !(await isTMA('complete'))) mockEnvForDev();

  init();
  initData.restore();

  if (miniApp.mount.isAvailable()) {
    miniApp.mount();
    miniApp.bindCssVars();
  }
  if (themeParams.mount.isAvailable()) {
    themeParams.mount();
    themeParams.bindCssVars();
  }
  // In games, prevent a vertical swipe from closing the Mini App by accident.
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
    if (swipeBehavior.disableVertical.isAvailable()) swipeBehavior.disableVertical();
  }

  miniApp.ready();
}
