"""
ONE — Telegram Bot.

Команды:
  /start       — Регистрация пользователя + главное меню
  /help        — Справка
  /menu        — Показать главное меню
  /orders      — Мои заказы
  /favorites   — Избранные товары
  /support     — Связаться с поддержкой
  /faq         — Часто задаваемые вопросы
  /about       — О магазине
  /reply       — Ответить пользователю (только ADMIN_ID)
  /broadcast   — Массовая рассылка (только ADMIN_ID)
  /stats       — Статистика (только ADMIN_ID)

Deep links:
  /start product_SLUG — Поделиться товаром
"""

import logging
import time
from datetime import datetime

from telegram import (
    Update,
    WebAppInfo,
    KeyboardButton,
    ReplyKeyboardMarkup,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    BotCommand,
)
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from config import BOT_TOKEN, ADMIN_ID, WEBAPP_URL
import db
from broadcaster import broadcast, BroadcastResult

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

_support_mode: dict[int, float] = {}
SUPPORT_MODE_TTL = 3600

# Track last user who messaged admin for quick reply
_last_user: dict[int, dict] = {}


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(
                "🛍 Открыть магазин",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )],
            [
                KeyboardButton("📦 Мои заказы"),
                KeyboardButton("❤️ Избранное"),
            ],
            [
                KeyboardButton("📞 Поддержка"),
                KeyboardButton("❓ FAQ"),
            ],
            [
                KeyboardButton("ℹ️ О магазине"),
            ],
        ],
        resize_keyboard=True,
    )


def support_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("❌ Завершить диалог", callback_data="support_exit")]]
    )


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🔙 Назад в меню", callback_data="back_to_menu")]]
    )


def format_price(amount: float) -> str:
    return f'{amount:,.0f}'.replace(",", " ")


def get_localized_name(name) -> str:
    if isinstance(name, dict):
        return name.get("ru") or name.get("uz") or str(name)
    return str(name) if name else "Товар"


SUPPORTED_PHOTO_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'}


def get_first_photo(images) -> str | None:
    if not isinstance(images, list):
        return None
    for url in images:
        if not isinstance(url, str):
            continue
        clean_url = url.split('?')[0]
        ext = clean_url.rsplit('.', 1)[-1].lower() if '.' in clean_url.rsplit('/', 1)[-1] else ''
        if ext in SUPPORTED_PHOTO_EXTS:
            return url
    return None


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    db.save_user(
        chat_id=user.id,
        first_name=user.first_name or "",
        username=user.username,
    )

    args = context.args
    if args and args[0].startswith("product_"):
        slug = args[0][8:]
        await _show_shared_product(update, context, slug)
        return

    text = (
        f"Привет, {user.first_name}! 👋\n\n"
        "Добро пожаловать в <b>ONE</b>!\n"
        "Мы — магазин модной одежды и аксессуаров с доставкой по всему Узбекистану.\n\n"
        "─────────────────\n\n"
        "🛍 <b>Что умеет бот:</b>\n"
        "• Открыть каталог и сделать заказ\n"
        "• Отслеживать статус ваших заказов\n"
        "• Общаться со службой поддержки\n"
        "• Получать уведомления о заказах и акциях\n\n"
        "─────────────────\n\n"
        "Выберите действие из меню ниже 👇"
    )

    await update.message.reply_text(
        text, parse_mode="HTML", reply_markup=main_menu_keyboard()
    )
    logger.info("User registered: %d (%s)", user.id, user.username)


async def _show_shared_product(update: Update, context: ContextTypes.DEFAULT_TYPE, slug: str) -> None:
    product = db.get_product_by_slug(slug)
    if not product:
        await update.message.reply_text(
            "❌ Товар не найден или больше не продаётся.",
            reply_markup=main_menu_keyboard(),
        )
        return

    name = get_localized_name(product.get("name"))
    price = format_price(product.get("price", 0))
    description = ""
    if isinstance(product.get("description"), dict):
        description = product["description"].get("ru", "") or product["description"].get("uz", "")
    elif product.get("description"):
        description = str(product["description"])
    stock = product.get("stock", 0)
    stock_text = f"✅ В наличии ({stock} шт.)" if stock > 0 else "❌ Нет в наличии"
    images = product.get("images") or []
    webapp_url = f"{WEBAPP_URL}/product/{slug}"

    caption = (
        f"🛍 <b>{name}</b>\n\n"
        f"💰 <b>{price} сум</b>\n"
        f"📦 {stock_text}\n"
    )
    if description:
        desc_short = description[:300] + ("..." if len(description) > 300 else "")
        caption += f"\n📝 {desc_short}\n"

    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("🛒 Открыть в каталоге", web_app=WebAppInfo(url=webapp_url))]]
    )

    if images:
        try:
            from telegram import InputMediaPhoto
            await context.bot.send_photo(
                chat_id=update.effective_chat.id,
                photo=get_first_photo(images),
                caption=caption,
                parse_mode="HTML",
                reply_markup=keyboard,
            )
        except Exception:
            await update.message.reply_text(caption, parse_mode="HTML", reply_markup=keyboard)
    else:
        await update.message.reply_text(caption, parse_mode="HTML", reply_markup=keyboard)


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "📋 <b>Главное меню</b>\n\nВыберите действие:",
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🛍 <b>ONE — Справка</b>\n\n"
        "📋 <b>Команды:</b>\n"
        "/start — Приветствие и главное меню\n"
        "/menu — Открыть меню\n"
        "/orders — Мои заказы\n"
        "/favorites — Избранные товары\n"
        "/support — Связаться с поддержкой\n"
        "/faq — Часто задаваемые вопросы\n"
        "/about — О магазине\n"
        "/help — Эта справка\n\n"
        "─────────────────\n\n"
        "🛍 <b>Магазин:</b>\n"
        "Нажми «Открыть магазин» внизу экрана\n"
        "для перехода в каталог товаров.\n\n"
        "📦 <b>Заказы:</b>\n"
        "Статус заказов доступен в разделе «Мои заказы».\n\n"
        "🔔 <b>Уведомления:</b>\n"
        "Мы уведомляем о статусе заказов,\n"
        "скидках и акциях.\n\n"
        "💬 Вопросы? Пиши в поддержку!"
    )
    await update.message.reply_text(
        text, parse_mode="HTML", reply_markup=main_menu_keyboard()
    )


async def cmd_orders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    orders = db.get_user_orders(user.id, limit=5)

    if not orders:
        text = (
            "📦 <b>Мои заказы</b>\n\n"
            "У вас пока нет заказов.\n\n"
            "Откройте каталог и сделайте первый заказ! 🛍"
        )
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("🛍 Открыть каталог", web_app=WebAppInfo(url=WEBAPP_URL))]]
        )
        await update.message.reply_text(text, parse_mode="HTML", reply_markup=keyboard)
        return

    STATUS_LABELS = {
        "new": "🆕 Новый",
        "processing": "⚙️ В обработке",
        "assembling": "📦 В сборке",
        "assembled": "✅ Собран",
        "shipping": "🚚 В пути",
        "delivered": "✅ Доставлен",
        "cancelled": "❌ Отменён",
        "return_requested": "🔄 Запрос возврата",
        "returned": "↩️ Возвращён",
        "paid": "💳 Оплачен",
        "shipped": "🚚 Отправлен",
    }

    await update.message.reply_text(
        "📦 <b>Мои заказы</b>\n\nОтправляю информацию о заказах...",
        parse_mode="HTML",
    )

    for order in orders:
        short_id = order["id"][:8].upper()
        status = STATUS_LABELS.get(order["status"], order["status"])
        amount = format_price(order.get("total_amount", 0))
        date_str = order["created_at"][:10]
        items = order.get("items") or []

        first_image = None
        item_names = []
        for item in items[:3]:
            item_names.append(get_localized_name(item.get("name")))
            if not first_image and item.get("image"):
                url = item["image"]
                clean = url.split('?')[0]
                ext = clean.rsplit('.', 1)[-1].lower() if '.' in clean.rsplit('/', 1)[-1] else ''
                if ext in SUPPORTED_PHOTO_EXTS:
                    first_image = url

        items_text = ", ".join(item_names) if item_names else "Нет товаров"
        if len(items) > 3:
            items_text += f" и ещё {len(items) - 3}"

        caption = (
            f"📦 <b>Заказ #{short_id}</b>\n"
            f"Статус: {status}\n"
            f"📅 {date_str}  💰 {amount} сум\n\n"
            f"🛍 {items_text}"
        )

        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("🛒 Открыть магазин", web_app=WebAppInfo(url=WEBAPP_URL))]]
        )

        if first_image:
            try:
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=first_image,
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
                continue
            except Exception:
                pass

        await update.message.reply_text(
            caption, parse_mode="HTML", reply_markup=keyboard
        )


async def cmd_favorites(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    favorites = db.get_user_favorites(user.id)

    if not favorites:
        text = (
            "❤️ <b>Избранное</b>\n\n"
            "У вас пока нет избранных товаров.\n\n"
            "Добавляйте товары в избранное — нажмите на сердечко ❤️"
        )
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("🛍 Открыть каталог", web_app=WebAppInfo(url=WEBAPP_URL))]]
        )
        await update.message.reply_text(text, parse_mode="HTML", reply_markup=keyboard)
        return

    await update.message.reply_text(
        f"❤️ <b>Избранное</b> — {len(favorites)} товаров\n\nОтправляю...",
        parse_mode="HTML",
    )

    for product in favorites[:5]:
        name = get_localized_name(product.get("name"))
        price = format_price(product.get("price", 0))
        slug = product.get("slug", "")
        stock = product.get("stock", 0)
        images = product.get("images") or []
        stock_text = f"✅ В наличии" if stock > 0 else "❌ Нет в наличии"

        notifs = []
        if product.get("notify_price"):
            notifs.append("🔔 Скидка")
        if product.get("notify_stock"):
            notifs.append("🔔 Наличие")
        notif_text = f"\n{'  '.join(notifs)}" if notifs else ""

        caption = (
            f"❤️ <b>{name}</b>\n"
            f"💰 {price} сум\n"
            f"📦 {stock_text}{notif_text}"
        )

        webapp_url = f"{WEBAPP_URL}/product/{slug}" if slug else WEBAPP_URL
        keyboard = InlineKeyboardMarkup(
            [[InlineKeyboardButton("🛒 Открыть товар", web_app=WebAppInfo(url=webapp_url))]]
        )

        if images:
            try:
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=get_first_photo(images),
                    caption=caption,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
                continue
            except Exception:
                pass

        await update.message.reply_text(
            caption, parse_mode="HTML", reply_markup=keyboard
        )


async def cmd_support(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    _support_mode[user.id] = time.time()

    text = (
        "📞 <b>Служба поддержки</b>\n\n"
        "Напишите ваше сообщение, и мы ответим вам в ближайшее время.\n\n"
        "⏰ Время ответа: до 24 часов\n"
        "📌 Для завершения диалога нажмите кнопку ниже"
    )
    await update.message.reply_text(
        text, parse_mode="HTML", reply_markup=support_keyboard()
    )


async def cmd_faq(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "❓ <b>Часто задаваемые вопросы</b>\n\n"

        "─────────────────\n\n"

        "📦 <b>Доставка</b>\n"
        "Доставка осуществляется по всему Узбекистану.\n"
        "Стандартная доставка: 1-3 дня.\n"
        "Экспресс-доставка: в тот же день (по Ташкенту).\n"
        "Бесплатная доставка при заказе от 500 000 сум.\n\n"

        "─────────────────\n\n"

        "💳 <b>Способы оплаты</b>\n"
        "• Наличные при получении\n"
        "• Payme\n"
        "• Click\n"
        "• Uzum Bank\n\n"

        "─────────────────\n\n"

        "↩️ <b>Возврат товара</b>\n"
        "Вы можете вернуть товар в течение 14 дней\n"
        "с момента доставки. Перейдите в «Мои заказы»\n"
        "и нажмите «Запросить возврат».\n\n"

        "─────────────────\n\n"

        "⏰ <b>Сроки доставки</b>\n"
        "• По Ташкенту: 1-2 дня\n"
        "• По регионам: 2-5 дней\n"
        "• Экспресс (Ташкент): в тот же день\n\n"

        "─────────────────\n\n"

        "📞 <b>Контакты</b>\n"
        "Telegram: @one_shop\n"
        "Email: info@one.uz"
    )
    await update.message.reply_text(
        text, parse_mode="HTML", reply_markup=back_to_menu_keyboard()
    )


async def cmd_about(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "ℹ️ <b>ONE</b>\n\n"
        "Мы — магазин модной одежды и аксессуаров,\n"
        "который делает стиль доступным для каждого\n"
        "жителя Узбекистана.\n\n"
        "─────────────────\n\n"
        "🎯 <b>Наша миссия</b>\n"
        "Предлагать качественные товары по доступным ценам,\n"
        "работая напрямую с производителями.\n\n"
        "─────────────────\n\n"
        "🌐 <b>Ссылки:</b>\n"
        "• Сайт: one.uz\n"
        "• Telegram: @one_shop\n"
        "• Email: info@one.uz"
    )
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🛒 Открыть магазин", web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton("🔙 Назад в меню", callback_data="back_to_menu")],
        ]
    )
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=keyboard)


# ─── Admin reply command ────────────────────────────────────────────────────


async def cmd_reply(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or user.id != ADMIN_ID:
        await update.message.reply_text("⛔ У вас нет доступа к этой команде.")
        return

    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "Использование:\n<code>/reply USER_ID Сообщение</code>\n\n"
            "Пример: <code>/reply 123456789 Заказ отправлен!</code>",
            parse_mode="HTML",
        )
        return

    try:
        target_user_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("❌ Неверный USER_ID. Используйте числовой ID.")
        return

    reply_text = " ".join(context.args[1:])

    try:
        await context.bot.send_message(
            chat_id=target_user_id,
            text=f"💬 <b>Ответ от поддержки:</b>\n\n{reply_text}",
            parse_mode="HTML",
        )
        await update.message.reply_text(
            f"✅ Сообщение отправлено пользователю <code>{target_user_id}</code>",
            parse_mode="HTML",
        )
    except Exception as e:
        await update.message.reply_text(
            f"❌ Не удалось отправить: {e}"
        )


# ─── Callback handlers ──────────────────────────────────────────────────────


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    data = query.data

    if data == "back_to_menu":
        await query.edit_message_text(
            "📋 <b>Главное меню</b>\n\nВыберите действие:",
            parse_mode="HTML",
        )

    elif data == "support_exit":
        user = update.effective_user
        if user:
            _support_mode.pop(user.id, None)
        await query.edit_message_text(
            "✅ Диалог с поддержкой завершён.\n\n"
            "Если нужно, напишите /support снова.",
            parse_mode="HTML",
        )


# ─── Message handler ────────────────────────────────────────────────────────


async def handle_any_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return
    user = update.effective_user
    if not user:
        return

    db.save_user(
        chat_id=user.id,
        first_name=user.first_name or "",
        username=user.username,
    )

    text = update.message.text.strip()

    MENU_BUTTONS = {
        "📦 Мои заказы": cmd_orders,
        "❤️ Избранное": cmd_favorites,
        "📞 Поддержка": cmd_support,
        "❓ FAQ": cmd_faq,
        "ℹ️ О магазине": cmd_about,
    }

    if text in MENU_BUTTONS:
        await MENU_BUTTONS[text](update, context)
        return

    support_entered = _support_mode.get(user.id)
    if support_entered and (time.time() - support_entered) < SUPPORT_MODE_TTL:
        display_name = user.first_name
        if user.username:
            display_name += f" (@{user.username})"

        _last_user[ADMIN_ID] = {
            "user_id": user.id,
            "name": display_name,
            "time": time.time(),
        }

        admin_text = (
            "💬 <b>Новое сообщение от пользователя</b>\n\n"
            f"👤 Пользователь: {display_name}\n"
            f"🆔 ID: <code>{user.id}</code>\n"
            f"─────────────────\n"
            f"{update.message.text or '(медиа)'}\n\n"
            f"💡 Ответ: <code>/reply {user.id} Текст ответа</code>"
        )

        try:
            await context.bot.send_message(
                chat_id=ADMIN_ID, text=admin_text, parse_mode="HTML"
            )
        except Exception as e:
            logger.error("Failed to notify admin: %s", e)

        await update.message.reply_text(
            "✅ Сообщение отправлено! Ожидайте ответа.",
            reply_markup=support_keyboard(),
        )
        return

    await update.message.reply_text(
        "Используйте кнопки меню ниже 👇\n"
        "Или команду /menu для открытия меню.",
        reply_markup=main_menu_keyboard(),
    )


# ─── Admin commands ─────────────────────────────────────────────────────────


async def cmd_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or user.id != ADMIN_ID:
        await update.message.reply_text("⛔ У вас нет доступа к этой команде.")
        return

    if not context.args:
        await update.message.reply_text(
            "Использование:\n<code>/broadcast Текст сообщения</code>",
            parse_mode="HTML",
        )
        return

    message_text = " ".join(context.args)
    user_count = db.get_user_count()

    status_msg = await update.message.reply_text(
        f"📤 Начинаю рассылку для <b>{user_count}</b> пользователей...",
        parse_mode="HTML",
    )

    result: BroadcastResult = await broadcast(context.bot, message_text, created_by=str(user.id))

    if result.queued:
        report = (
            f"📋 <b>Рассылка поставлена в очередь</b>\n\n"
            f"📊 Получателей: {result.total}\n"
            f"🆔 Job ID: <code>{result.job_id}</code>\n\n"
            f"Обработка начнётся автоматически."
        )
    else:
        report = (
            f"✅ <b>Рассылка завершена</b>\n\n"
            f"📊 Всего: {result.total}\n"
            f"✓ Доставлено: {result.success}\n"
            f"🚫 Заблокировали: {result.blocked}\n"
            f"⚠️ Ошибки: {result.errors}"
        )
    await status_msg.edit_text(report, parse_mode="HTML")
    logger.info(
        "Broadcast done: total=%d, success=%d, blocked=%d, errors=%d, queued=%s",
        result.total, result.success, result.blocked, result.errors, result.queued,
    )


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user or user.id != ADMIN_ID:
        await update.message.reply_text("⛔ У вас нет доступа к этой команде.")
        return

    user_count = db.get_user_count()
    orders_count = db.get_total_orders_count()
    returns_count = db.get_pending_returns_count()
    unread_msgs = db.get_unread_messages_count()

    text = (
        "📊 <b>Статистика ONE Bot</b>\n\n"
        f"👥 Подписчиков: <b>{user_count}</b>\n"
        f"📦 Всего заказов: <b>{orders_count}</b>\n"
        f"🔄 Ожидают возврата: <b>{returns_count}</b>\n"
        f"💬 Непрочитанных сообщений: <b>{unread_msgs}</b>\n\n"
        f"🕐 Обновлено: {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    await update.message.reply_text(text, parse_mode="HTML")


# ─── Setup ──────────────────────────────────────────────────────────────────


async def post_init(app: Application) -> None:
    commands = [
        BotCommand("start", "Приветствие и главное меню"),
        BotCommand("menu", "Главное меню"),
        BotCommand("orders", "Мои заказы"),
        BotCommand("favorites", "Избранные товары"),
        BotCommand("support", "Связаться с поддержкой"),
        BotCommand("faq", "Часто задаваемые вопросы"),
        BotCommand("about", "О магазине"),
        BotCommand("help", "Справка"),
    ]
    await app.bot.set_my_commands(commands)
    logger.info("Bot commands set.")


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu", cmd_menu))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("orders", cmd_orders))
    app.add_handler(CommandHandler("favorites", cmd_favorites))
    app.add_handler(CommandHandler("support", cmd_support))
    app.add_handler(CommandHandler("faq", cmd_faq))
    app.add_handler(CommandHandler("about", cmd_about))
    app.add_handler(CommandHandler("reply", cmd_reply))
    app.add_handler(CommandHandler("broadcast", cmd_broadcast))
    app.add_handler(CommandHandler("stats", cmd_stats))

    app.add_handler(CallbackQueryHandler(callback_handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_any_message))

    logger.info("Bot started. ADMIN_ID=%d", ADMIN_ID)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
