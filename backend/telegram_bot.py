import os
import requests
import json
from typing import Optional
from dotenv import load_dotenv

# Загрузка переменных из .env файла
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def send_telegram_message(chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
    """Отправить сообщение в Telegram"""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode
    }

    try:
        response = requests.post(url, json=payload, timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"Ошибка отправки Telegram: {e}")
        return False

def notify_new_response(user_chat_id: str, task_title: str, specialist_name: str, task_id: int):
    """Уведомление заказчика о новом отклике"""
    text = f"""
🔔 <b>Новый отклик на ваш заказ!</b>

📝 Заказ: <b>{task_title}</b>
👤 Специалист: <b>{specialist_name}</b>

🔗 Посмотреть: {BACKEND_URL}/#/task/{task_id}
"""
    send_telegram_message(user_chat_id, text.strip())

def notify_response_accepted(user_chat_id: str, task_title: str, customer_name: str, task_id: int):
    """Уведомление специалисту о принятии отклика"""
    text = f"""
✅ <b>Ваш отклик принят!</b>

📝 Заказ: <b>{task_title}</b>
👤 Заказчик: <b>{customer_name}</b>

Теперь заказ в работе. Перейдите в чат для обсуждения деталей.

🔗 Открыть чат: {BACKEND_URL}/#/feed
"""
    send_telegram_message(user_chat_id, text.strip())

def notify_new_message(user_chat_id: str, task_title: str, sender_name: str, message: str, task_id: int):
    """Уведомление о новом сообщении в чате"""
    preview = message[:100] + "..." if len(message) > 100 else message
    text = f"""
💬 <b>Новое сообщение в чате</b>

📝 Заказ: <b>{task_title}</b>
👤 От: <b>{sender_name}</b>

<i>{preview}</i>

🔗 Ответить: {BACKEND_URL}/#/feed
"""
    send_telegram_message(user_chat_id, text.strip())

def notify_task_completed(user_chat_id: str, task_title: str, by_role: str, task_id: int):
    """Уведомление о завершении заказа"""
    who = "Специалист завершил" if by_role == "specialist" else "Заказчик подтвердил завершение"
    text = f"""
🎉 <b>Заказ завершён!</b>

📝 Заказ: <b>{task_title}</b>
✅ {who} работу

{"⭐ Оставьте отзыв о работе специалиста" if by_role == "specialist" else "Спасибо за работу!"}

🔗 Посмотреть: {BACKEND_URL}/#/task/{task_id}
"""
    send_telegram_message(user_chat_id, text.strip())

def notify_new_review(user_chat_id: str, rating: int, comment: str, reviewer_name: str):
    """Уведомление о новом отзыве"""
    stars = "⭐" * rating
    text = f"""
⭐ <b>Новый отзыв о вас!</b>

{stars} ({rating}/5)
👤 От: <b>{reviewer_name}</b>

<i>{comment}</i>

🔗 Посмотреть профиль: {BACKEND_URL}/#/profile
"""
    send_telegram_message(user_chat_id, text.strip())

# ---- Telegram Bot Handler (для webhook или polling) ----

def handle_telegram_update(update: dict):
    """Обработка входящих сообщений от Telegram"""
    message = update.get("message")
    if not message:
        return

    chat_id = str(message["chat"]["id"])
    text = message.get("text", "")

    if text.startswith("/start"):
        handle_start(chat_id)
    elif text.startswith("/link"):
        parts = text.split()
        if len(parts) == 2:
            code = parts[1]
            handle_link(chat_id, code)
        else:
            send_telegram_message(chat_id, "Использование: /link <код>\n\nКод можно получить в настройках профиля на сайте.")
    elif text.startswith("/help"):
        handle_help(chat_id)
    else:
        send_telegram_message(chat_id, "Неизвестная команда. Используйте /help для списка команд.")

def handle_start(chat_id: str):
    """Команда /start"""
    text = """
👋 <b>Добро пожаловать в ДЕЛО!</b>

Этот бот отправляет уведомления о:
• Новых откликах на ваши заказы
• Принятии ваших откликов
• Сообщениях в чате
• Завершении заказов
• Новых отзывах

<b>Как подключить:</b>
1. Зайдите в профиль на сайте
2. Нажмите "Подключить Telegram"
3. Получите код привязки
4. Отправьте боту команду:
   /link <код>

Нужна помощь? /help
"""
    send_telegram_message(chat_id, text.strip())

def handle_link(chat_id: str, code: str):
    """Привязка аккаунта по коду"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/telegram/link",
            params={"code": code, "chat_id": chat_id},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            user_name = data.get("user_name", "")
            send_telegram_message(
                chat_id,
                f"✅ <b>Аккаунт успешно привязан!</b>\n\nПривет, {user_name}! Теперь вы будете получать уведомления от ДЕЛО."
            )
        else:
            send_telegram_message(chat_id, "❌ Неверный код. Получите новый код в профиле на сайте.")
    except Exception as e:
        print(f"Ошибка привязки: {e}")
        send_telegram_message(chat_id, "❌ Ошибка подключения к серверу. Попробуйте позже.")

def handle_help(chat_id: str):
    """Команда /help"""
    text = """
<b>Доступные команды:</b>

/start — приветствие и инструкция
/link <код> — привязать аккаунт
/help — список команд

<b>Настройки уведомлений:</b>
Зайдите в профиль на сайте, чтобы настроить, какие уведомления получать.

<b>Вопросы?</b>
Напишите в поддержку: support@example.com
"""
    send_telegram_message(chat_id, text.strip())

# ---- Polling mode (для разработки) ----

def run_polling():
    """Запустить бота в режиме polling (для разработки)"""
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN не задан")
        return

    offset = 0
    print("Telegram бот запущен в режиме polling...")

    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
            response = requests.get(url, params={"offset": offset, "timeout": 30}, timeout=35)
            data = response.json()

            if data.get("ok"):
                for update in data.get("result", []):
                    handle_telegram_update(update)
                    offset = update["update_id"] + 1
        except KeyboardInterrupt:
            print("\nБот остановлен")
            break
        except Exception as e:
            print(f"Ошибка polling: {e}")
            import time
            time.sleep(5)

if __name__ == "__main__":
    run_polling()
