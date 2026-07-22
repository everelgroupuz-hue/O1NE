import { chromium } from 'playwright';
import { createHmac } from 'crypto';

const BOT_TOKEN = '8983741088:AAEizO9xEyonk6bbaXekTHCDZu2m_IxYPoY';
const authDate = Math.floor(Date.now() / 1000);
const userObj = { id: 5720497431, first_name: 'Aziz', language_code: 'ru' };
const dataCheckArr = [`auth_date=${authDate}`, `user=${JSON.stringify(userObj)}`];
dataCheckArr.sort();
const hmac = createHmac('sha256', BOT_TOKEN).update(dataCheckArr.join('\n')).digest('hex');
const initData = `auth_date=${authDate}&user=${encodeURIComponent(JSON.stringify(userObj))}&hash=${hmac}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[Auth]') || t.includes('orders') || t.includes('Orders') || t.includes('ERROR') || t.includes('error')) {
    console.log('  CONSOLE:', t.substring(0, 300));
  }
});

await page.route('**/telegram-web-app.js', (route) => route.abort());
await page.addInitScript(`
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
};`);

console.log('=== OPEN APP ===');
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000);

// Check store
const store = await page.evaluate(() => {
  const raw = localStorage.getItem('app-storage');
  return raw ? JSON.parse(raw).state : null;
});
console.log('Store telegramUserId:', store?.telegramUserId);

// Select Russian
const ruBtn = page.locator('text=Русский').first();
if (await ruBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  await ruBtn.click();
  await page.waitForTimeout(2000);
}

console.log('\n=== ORDERS PAGE ===');
await page.goto('http://localhost:5173/orders', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(8000);

const pageText = await page.textContent('body');
console.log('Page text:', pageText?.substring(0, 300));

const imgCount = await page.locator('img').count();
console.log('Images found:', imgCount);

// Check if "no orders" message is shown
const hasNoOrders = pageText?.includes('нет заказов') || pageText?.includes('пусто');
console.log('Shows no orders:', hasNoOrders);

await page.screenshot({ path: '/home/duck/Документы/for Work/ONE/test-orders-debug.png', fullPage: true });

await browser.close();
