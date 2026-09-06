#!/bin/bash
# Скрипт для настройки и запуска Telegram-бота

echo "🤖 Настройка Telegram-бота для ДЕЛО"
echo ""

# Проверка токена
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN не установлен"
    echo ""
    echo "Создайте бота через @BotFather и установите токен:"
    echo "export TELEGRAM_BOT_TOKEN='ваш_токен'"
    echo ""
    exit 1
fi

echo "✅ Токен найден: ${TELEGRAM_BOT_TOKEN:0:10}..."

# Проверка зависимостей
echo ""
echo "📦 Проверка зависимостей..."
python -c "import requests" 2>/dev/null || pip install requests

# Запуск бота
echo ""
echo "🚀 Запуск бота в режиме polling..."
echo "Нажмите Ctrl+C для остановки"
echo ""

cd "$(dirname "$0")"
python telegram_bot.py
