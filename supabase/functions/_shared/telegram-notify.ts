/**
 * Unified Telegram Admin Notification Service for KUPI.
 *
 * Architecture:
 *   User Action → Event → notifyAdmin() → Telegram Bot → Admin
 *
 * Every important system event routes through this module.
 * Notifications are non-blocking — a Telegram failure never breaks the main flow.
 */

const ADMIN_CHAT_KEY = "ADMIN_TELEGRAM_ID";

function getBotToken(): string | undefined {
  return Deno.env.get("TELEGRAM_BOT_TOKEN") || Deno.env.get("BOT_TOKEN");
}

function getAdminId(): string | undefined {
  return Deno.env.get(ADMIN_CHAT_KEY);
}

/**
 * Send a message to the admin's Telegram chat.
 * Always fire-and-forget: errors are logged but never thrown.
 */
export async function notifyAdmin(text: string): Promise<void> {
  const botToken = getBotToken();
  const adminId = getAdminId();
  if (!botToken || !adminId) return;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[notifyAdmin] Telegram API ${resp.status}: ${body}`);
    }
  } catch (err) {
    console.error("[notifyAdmin] Failed to send:", err);
  }
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("ru-RU");
}

// ─── ORDER EVENTS ────────────────────────────────────────────────────────────

export interface OrderEventData {
  orderId: string;
  totalAmount: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  items: Array<{ name: string; quantity: number }>;
}

/** New order placed by customer */
export async function notifyNewOrder(data: OrderEventData): Promise<void> {
  const shortId = data.orderId.slice(0, 8).toUpperCase();
  const itemsList = data.items.map((it) => `  • ${it.name} × ${it.quantity}`).join("\n");

  await notifyAdmin(
    `🔔 <b>НОВЫЙ ЗАКАЗ</b>\n\n` +
    `📦 Заказ #${shortId}\n` +
    `👤 Клиент: ${data.customerName}\n` +
    `📱 Телефон: ${data.customerPhone}\n` +
    `💰 Сумма: ${formatPrice(data.totalAmount)} сум\n` +
    `💳 Оплата: ${data.paymentMethod}\n` +
    `📦 Товары:\n${itemsList}\n\n` +
    `📍 Адрес: ${data.customerCity}, ${data.customerAddress}`
  );
}

/** Order status changed */
export async function notifyOrderStatusChanged(
  orderId: string,
  newStatus: string,
  changedBy: string
): Promise<void> {
  const shortId = orderId.slice(0, 8).toUpperCase();

  const STATUS_LABELS: Record<string, string> = {
    new: "Новый",
    processing: "В обработке",
    assembling: "В сборке",
    assembled: "Собран",
    shipping: "В доставке",
    delivered: "Доставлен",
    cancelled: "Отменён",
    return_requested: "Запрос возврата",
    returned: "Возвращён",
    paid: "Оплачен",
    shipped: "Отправлен",
  };

  const STATUS_EMOJI: Record<string, string> = {
    new: "🆕",
    processing: "⚙️",
    assembling: "📦",
    assembled: "✅",
    shipping: "🚚",
    delivered: "✅",
    cancelled: "❌",
    return_requested: "🔄",
    returned: "↩️",
    paid: "💳",
    shipped: "🚚",
  };

  const emoji = STATUS_EMOJI[newStatus] || "📦";
  const label = STATUS_LABELS[newStatus] || newStatus;

  await notifyAdmin(
    `${emoji} <b>СТАТУС ЗАКАЗА ИЗМЕНЁН</b>\n\n` +
    `📦 Заказ #${shortId}\n` +
    `📊 Статус: <b>${label}</b>\n` +
    `👤 Изменил: ${changedBy}`
  );
}

// ─── PAYMENT EVENTS ──────────────────────────────────────────────────────────

/** Payment received successfully */
export async function notifyPaymentSuccess(
  orderId: string,
  amount: number,
  method: string
): Promise<void> {
  const shortId = orderId.slice(0, 8).toUpperCase();
  await notifyAdmin(
    `💰 <b>ПОЛУЧЕНА ОПЛАТА</b>\n\n` +
    `📦 Заказ #${shortId}\n` +
    `💰 Сумма: ${formatPrice(amount)} сум\n` +
    `💳 Метод: ${method}`
  );
}

/** Payment failed */
export async function notifyPaymentFailed(
  orderId: string,
  amount: number,
  method: string,
  error?: string
): Promise<void> {
  const shortId = orderId.slice(0, 8).toUpperCase();
  await notifyAdmin(
    `⚠️ <b>ОШИБКА ОПЛАТЫ</b>\n\n` +
    `📦 Заказ #${shortId}\n` +
    `💰 Сумма: ${formatPrice(amount)} сум\n` +
    `💳 Метод: ${method}` +
    (error ? `\n❌ Причина: ${error}` : "")
  );
}

// ─── CUSTOMER MESSAGE EVENTS ─────────────────────────────────────────────────

/** Customer sent a message (support / chat) */
export async function notifyCustomerMessage(
  userId: number,
  userName: string,
  message: string,
  orderId?: string
): Promise<void> {
  const shortId = orderId ? orderId.slice(0, 8).toUpperCase() : null;
  const header = shortId
    ? `💬 <b>СООБЩЕНИЕ ОТ КЛИЕНТА</b> (заказ #${shortId})`
    : `💬 <b>СООБЩЕНИЕ ОТ КЛИЕНТА</b>`;

  const body = message.length > 500 ? message.slice(0, 500) + "…" : message;

  await notifyAdmin(
    `${header}\n\n` +
    `👤 Клиент: ${userName}\n` +
    `🆔 ID: ${userId}\n` +
    `─────────────────\n` +
    `${body}`
  );
}

// ─── PRODUCT EVENTS ──────────────────────────────────────────────────────────

/** New product added */
export async function notifyProductAdded(
  productId: string,
  productName: string,
  price: number
): Promise<void> {
  await notifyAdmin(
    `🛍 <b>НОВЫЙ ТОВАР</b>\n\n` +
    `📦 ${productName}\n` +
    `💰 Цена: ${formatPrice(price)} сум`
  );
}

/** Product went out of stock */
export async function notifyProductOutOfStock(
  productId: string,
  productName: string
): Promise<void> {
  await notifyAdmin(
    `🚫 <b>ТОВАР ЗАКОНЧИЛСЯ</b>\n\n` +
    `📦 ${productName}`
  );
}

/** Product back in stock */
export async function notifyProductBackInStock(
  productId: string,
  productName: string
): Promise<void> {
  await notifyAdmin(
    `✅ <b>ТОВАР СНОВА В НАЛИЧИИ</b>\n\n` +
    `📦 ${productName}`
  );
}

/** Product price changed */
export async function notifyProductPriceChanged(
  productId: string,
  productName: string,
  oldPrice: number,
  newPrice: number
): Promise<void> {
  const direction = newPrice < oldPrice ? "📉 СНИЖЕНИЕ" : "📈 ПОВЫШЕНИЕ";
  await notifyAdmin(
    `${direction} ЦЕНЫ\n\n` +
    `📦 ${productName}\n` +
    `💰 Было: ${formatPrice(oldPrice)} сум\n` +
    `💰 Стало: ${formatPrice(newPrice)} сум`
  );
}

// ─── USER BEHAVIOR EVENTS ────────────────────────────────────────────────────

/** Product received many favorites (trending) */
export async function notifyProductTrending(
  productName: string,
  favoriteCount: number
): Promise<void> {
  await notifyAdmin(
    `🔥 <b>ТОВАР НАБИРАЕТ ПОПУЛЯРНОСТЬ</b>\n\n` +
    `📦 ${productName}\n` +
    `❤️ В избранном: ${favoriteCount} чел.`
  );
}

/** Product received many views */
export async function notifyProductHighViews(
  productName: string,
  viewCount: number
): Promise<void> {
  await notifyAdmin(
    `👁 <b>ТОВАР МНОГО СМОТРЯТ</b>\n\n` +
    `📦 ${productName}\n` +
    `👀 Просмотров: ${viewCount}`
  );
}
