"""Одноразовая миграция: колонка created_at для tasks в существующих БД."""
import sqlite3
from datetime import datetime, timedelta

DB = "marketplace_v3.db"
NOW = datetime.utcnow().isoformat()

conn = sqlite3.connect(DB)
c = conn.cursor()

cols = [row[1] for row in c.execute("PRAGMA table_info(tasks)")]
if "created_at" not in cols:
    c.execute("ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT NULL")
    # Раскладываем по id: старые заказы получают более ранние даты
    ids = [row[0] for row in c.execute("SELECT id FROM tasks ORDER BY id")]
    for i, tid in enumerate(ids):
        ts = (datetime.utcnow() - timedelta(days=len(ids) - i)).isoformat()
        c.execute("UPDATE tasks SET created_at = ? WHERE id = ?", (ts, tid))
    conn.commit()
    print(f"Миграция выполнена: добавлена колонка created_at, обновлено {len(ids)} заказов")
else:
    print("Колонка created_at уже существует")
conn.close()
