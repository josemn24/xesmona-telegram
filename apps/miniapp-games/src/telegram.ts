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
 * Fuera de Telegram (navegador en desarrollo) simulamos el entorno para poder
 * iterar en la UI. El initData simulado NO está firmado: el backend lo rechazará,
 * que es justo lo que debe pasar. Para tests E2E usa signInitData() de
 * @xesmona/telegram-auth/testing.
 */
function mockEnvForDev() {
  const user = { id: 1, first_name: 'Dev', username: 'dev', language_code: 'es' };
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
  console.info('[miniapp] Entorno de Telegram simulado (solo desarrollo)');
}

export async function initTelegram() {
  // isTMA('complete') comprueba el entorno real (no solo los parámetros guardados en
  // sessionStorage, que sobreviven a una recarga tras simular el entorno).
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
  // En juegos, evitamos que un gesto vertical cierre la Mini App por accidente.
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
    if (swipeBehavior.disableVertical.isAvailable()) swipeBehavior.disableVertical();
  }

  miniApp.ready();
}
