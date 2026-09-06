# Telegram-уведомления для ДЕЛО

## Что реализовано

### Backend (main.py)
- ✅ Добавлены поля в модель User:
  - `telegram_chat_id` — ID чата для отправки уведомлений
  - `telegram_link_code` — код для привязки аккаунта
  - `notification_settings` — JSON с настройками (какие уведомления отправлять)

- ✅ Миграции для новых полей (автоматически применяются при запуске)

- ✅ Эндпоинты:
  - `POST /telegram/generate-link-code` — генерирует 6-значный код для привязки
  - `POST /telegram/link?code=&chat_id=` — привязывает Telegram к аккаунту (вызывается ботом)
  - `GET /telegram/settings` — получить настройки уведомлений
  - `PUT /telegram/settings` — обновить настройки уведомлений
  - `DELETE /telegram/unlink` — отвязать Telegram

- ✅ Интеграция уведомлений в основные эндпоинты:
  - **Новый отклик** (`POST /tasks/{task_id}/responses`) → уведомление заказчику
  - **Отклик принят** (`PUT /tasks/{task_id}/assign`) → уведомление специалисту
  - **Заказ завершён** (`PUT /tasks/{task_id}/complete`) → уведомление специалисту
  - **Новое сообщение** (`POST /tasks/{task_id}/messages`) → уведомление получателю
  - **Новый отзыв** (`POST /tasks/{task_id}/reviews`) → уведомление получателю отзыва

### Backend (telegram_bot.py)
- ✅ Функции для отправки уведомлений через Telegram Bot API
- ✅ Обработчики команд бота:
  - `/start` — приветствие и инструкция
  - `/link <код>` — привязка аккаунта
  - `/help` — справка
- ✅ Режим polling для разработки (`python telegram_bot.py`)

### Frontend
- ✅ Компонент `TelegramSettings.jsx` — настройки Telegram в профиле
  - Генерация кода привязки
  - Отображение статуса подключения
  - Переключатели для каждого типа уведомлений
  - Отключение Telegram
- ✅ Интеграция в `ProfilePage.jsx` (секция под формой профиля)

---

## Настройка Telegram-бота

### 1. Создать бота через @BotFather

1. Открыть Telegram → найти **@BotFather**
2. Отправить команду `/newbot`
3. Указать имя бота (например, "ДЕЛО Уведомления")
4. Указать username бота (например, `delo_notify_bot`)
5. Скопировать **токен** (выглядит как `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Добавить токен в переменные окружения

**Локально (для разработки):**
```bash
export TELEGRAM_BOT_TOKEN="ваш_токен_от_BotFather"
export BACKEND_URL="http://localhost:8000"
```

**На production (Render.com):**
1. Зайти в настройки сервиса backend
2. Environment → Add Environment Variable
3. Добавить:
   - `TELEGRAM_BOT_TOKEN` = токен от BotFather
   - `BACKEND_URL` = https://ваш-backend.onrender.com

### 3. Запустить бота

**Вариант A: Polling (для разработки)**
```bash
cd backend
python telegram_bot.py
```

**Вариант B: Webhook (для production)**

Создать отдельный микросервис на Render.com или запустить в том же контейнере:

```python
# webhook_server.py
from fastapi import FastAPI, Request
from telegram_bot import handle_telegram_update
import os

app = FastAPI()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

@app.post(f"/webhook/{TELEGRAM_BOT_TOKEN}")
async def telegram_webhook(request: Request):
    update = await request.json()
    handle_telegram_update(update)
    return {"ok": True}

# Установить webhook:
# curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.onrender.com/webhook/<TOKEN>"
```

### 4. Обновить ссылку на бота в UI

В файле `frontend/src/components/TelegramSettings.jsx` (строка ~60):
```jsx
<a href="https://t.me/YOUR_BOT_USERNAME" target="_blank" rel="noopener">@YOUR_BOT_USERNAME</a>
```
Заменить `YOUR_BOT_USERNAME` на реальный username вашего бота.

---

## Как пользоваться (инструкция для пользователя)

1. **Зайти в профиль** на сайте ДЕЛО
2. **Прокрутить вниз** до секции "Telegram-уведомления"
3. **Нажать "Подключить Telegram"** — появится 6-значный код
4. **Открыть бота** в Telegram (по ссылке или через поиск)
5. **Отправить команду** `/link <код>` (например, `/link 123456`)
6. **Готово!** Бот пришлёт подтверждение, уведомления начнут приходить

### Настройка уведомлений
После подключения в профиле появятся переключатели:
- ✅ Новые отклики на мои заказы
- ✅ Мой отклик принят
- ✅ Новые сообщения в чате
- ✅ Заказ завершён
- ✅ Новые отзывы

Можно отключить любые типы уведомлений.

---

## Примеры уведомлений

### 1. Новый отклик
```
🔔 Новый отклик на ваш заказ!

📝 Заказ: Разработка сайта
👤 Специалист: Иван Иванов

🔗 Посмотреть: http://localhost:8000/#/task/123
```

### 2. Отклик принят
```
✅ Ваш отклик принят!

📝 Заказ: Разработка сайта
👤 Заказчик: Мария Петрова

Теперь заказ в работе. Перейдите в чат для обсуждения деталей.

🔗 Открыть чат: http://localhost:8000/#/feed
```

### 3. Новое сообщение
```
💬 Новое сообщение в чате

📝 Заказ: Разработка сайта
👤 От: Мария Петрова

Привет! Когда сможете начать работу?

🔗 Ответить: http://localhost:8000/#/feed
```

### 4. Заказ завершён
```
🎉 Заказ завершён!

📝 Заказ: Разработка сайта
✅ Заказчик подтвердил завершение работу

Спасибо за работу!

🔗 Посмотреть: http://localhost:8000/#/task/123
```

### 5. Новый отзыв
```
⭐ Новый отзыв о вас!

⭐⭐⭐⭐⭐ (5/5)
👤 От: Мария Петрова

Отличная работа, всё сделано качественно и в срок!

🔗 Посмотреть профиль: http://localhost:8000/#/profile
```

---

## Тестирование

### 1. Проверить привязку
```bash
# Сгенерировать код (нужен токен пользователя)
curl -X POST http://localhost:8000/telegram/generate-link-code \
  -H "Authorization: Bearer <токен>"

# Привязать (вызывается ботом)
curl -X POST "http://localhost:8000/telegram/link?code=123456&chat_id=987654321"

# Проверить статус
curl http://localhost:8000/telegram/settings \
  -H "Authorization: Bearer <токен>"
```

### 2. Отправить тестовое уведомление
```python
from telegram_bot import send_telegram_message

send_telegram_message(
    chat_id="987654321",
    text="🔔 <b>Тестовое уведомление</b>\n\nЕсли вы это видите — всё работает!"
)
```

### 3. Проверить все типы уведомлений
1. Создать заказ → откликнуться → проверить уведомление заказчику
2. Принять отклик → проверить уведомление специалисту
3. Отправить сообщение → проверить уведомление получателю
4. Завершить заказ → проверить уведомление специалисту
5. Оставить отзыв → проверить уведомление получателю

---

## Структура файлов

```
backend/
├── main.py                # Основной API + эндпоинты /telegram/*
├── telegram_bot.py        # Логика бота + функции отправки уведомлений
└── geocoding.py          # (уже существует)

frontend/
└── src/
    ├── components/
    │   └── TelegramSettings.jsx   # UI настроек Telegram
    └── pages/
        └── ProfilePage.jsx        # Интеграция TelegramSettings
```

---

## FAQ

**Q: Почему уведомления не приходят?**
A: Проверьте:
1. Бот запущен (`python telegram_bot.py` или webhook настроен)
2. `TELEGRAM_BOT_TOKEN` задан в переменных окружения
3. Аккаунт привязан (в профиле статус "Подключено")
4. Настройки уведомлений включены (переключатели в профиле)

**Q: Можно ли протестировать без создания бота?**
A: Да, но уведомления отправляться не будут. Все остальные функции (API, UI) работают.

**Q: Как отключить уведомления?**
A: В профиле → "Отключить" или выключить нужные типы переключателями.

**Q: Код привязки истёк?**
A: Нажмите "Подключить Telegram" ещё раз — сгенерируется новый код.

---

## Production Deployment

### Render.com (рекомендуется)

**Вариант 1: Один сервис (backend + webhook)**
1. Добавить `telegram_bot.py` в репозиторий
2. Установить webhook в `main.py`:
   ```python
   @app.post(f"/telegram/webhook/{os.getenv('TELEGRAM_BOT_TOKEN')}")
   async def telegram_webhook(request: Request):
       update = await request.json()
       from telegram_bot import handle_telegram_update
       handle_telegram_update(update)
       return {"ok": True}
   ```
3. После деплоя выполнить:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-backend.onrender.com/telegram/webhook/<TOKEN>"
   ```

**Вариант 2: Отдельный сервис для бота**
1. Создать новый сервис на Render.com
2. Command: `python telegram_bot.py`
3. Добавить переменные `TELEGRAM_BOT_TOKEN` и `BACKEND_URL`

---

## Готово! 🎉

Теперь пользователи будут получать мгновенные уведомления в Telegram о всех важных событиях на платформе.
