import { chromium } from 'playwright';
import { createHmac } from 'crypto';

const BOT_TOKEN = '8983741088:AAEizO9xEyonk6bbaXekTHCDZu2m_IxYPoY';
const authDate = Math.floor(Date.now() / 1000);
const userObj = { id: 123456789, first_name: 'TestQA', language_code: 'ru' };
const dataCheckArr = [`auth_date=${authDate}`, `user=${JSON.stringify(userObj)}`];
dataCheckArr.sort();
const hmac = createHmac('sha256', BOT_TOKEN).update(dataCheckArr.join('\n')).digest('hex');
const initData = `auth_date=${authDate}&user=${encodeURIComponent(JSON.stringify(userObj))}&hash=${hmac}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[TG]') || t.includes('[Boot]') || t.includes('[Auth]')) {
    console.log('  LOG:', t.substring(0, 250));
  }
});
page.on('pageerror', (err) => console.log('  ERR:', err.message.substring(0, 200)));

// BLOCK the real Telegram SDK from loading — it overwrites our mock
await page.route('**/telegram-web-app.js', (route) => {
  route.abort();
  console.log('  BLOCKED: telegram-web-app.js');
});

// Set up mock Telegram SDK BEFORE page loads
const tgScript = `
window.Telegram = {
  WebApp: {
    initData: ${JSON.stringify(initData)},
    initDataUnsafe: { user: ${JSON.stringify(userObj)}, start_param: '' },
    version: '7.10', platform: 'android', colorScheme: 'light', themeParams: {},
    isExpanded: true, viewportHeight: 844, viewportStableHeight: 844,
    headerColor: '#ffffff', backgroundColor: '#ffffff',
    expand: function() {}, close: function() {}, ready: function() {},
    sendData: function(d) {},
    BackButton: { isVisible: false, onClick: function(){}, offClick: function(){}, show: function(){}, hide: function(){} },
    MainButton: { text: '', color: '', textColor: '', isVisible: false, isActive: false, isProgressVisible: false, setText: function(){}, onClick: function(){}, offClick: function(){}, show: function(){}, hide: function(){}, enable: function(){}, disable: function(){}, showProgress: function(){}, hideProgress: function(){}, setParams: function(){} },
    HapticFeedback: { impactOccurred: function(){}, notificationOccurred: function(){}, selectionChanged: function(){} },
    openTelegramLink: function(url) {},
  },
};
`;
await page.addInitScript(tgScript);

console.log('=== STEP 1: Open app ===');
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000);

// Verify mock survived
const tgCheck = await page.evaluate(() => ({
  hasWebApp: !!window.Telegram?.WebApp,
  userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
  initDataLen: window.Telegram?.WebApp?.initData?.length,
}));
console.log('Telegram SDK:', JSON.stringify(tgCheck));

let store = await page.evaluate(() => {
  const raw = localStorage.getItem('app-storage');
  return raw ? JSON.parse(raw).state : null;
});
console.log('Store:', JSON.stringify({ tgUserId: store?.telegramUserId, lang: store?.language }));

// Select Russian
const ruBtn = page.locator('text=Русский').first();
if (await ruBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  await ruBtn.click();
  await page.waitForTimeout(2000);
}

// Wait for store to populate
for (let i = 0; i < 5; i++) {
  store = await page.evaluate(() => {
    const raw = localStorage.getItem('app-storage');
    return raw ? JSON.parse(raw).state : null;
  });
  if (store?.telegramUserId) {
    console.log(`✅ Store populated: telegramUserId=${store.telegramUserId}`);
    break;
  }
  await page.waitForTimeout(2000);
}

console.log('Final store:', JSON.stringify({ tgUserId: store?.telegramUserId, lang: store?.language }));
await page.screenshot({ path: '/home/duck/Документы/for Work/ONE/test-1-home.png' });

console.log('\n=== STEP 2: Profile ===');
await page.goto('http://localhost:5173/profile', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

const profileText = await page.textContent('body');
console.log('Profile:', profileText?.substring(0, 200));
await page.screenshot({ path: '/home/duck/Документы/for Work/ONE/test-3-profile.png' });

console.log('\n=== STEP 3: Catalog ===');
await page.goto('http://localhost:5173/catalog', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: '/home/duck/Документы/for Work/ONE/test-2-catalog.png' });

console.log('\n=== RESULT ===');
if (store?.telegramUserId) {
  console.log('✅ Telegram user identified:', store.telegramUserId);
} else {
  console.log('❌ Telegram user NOT identified');
}

await browser.close();
