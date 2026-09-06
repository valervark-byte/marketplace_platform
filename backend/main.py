from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, Request, BackgroundTasks
from fastapi.responses import Response as FastResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import asyncio
from enum import Enum as PyEnum
from pydantic import BaseModel, EmailStr, field_validator, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, Enum as SqlaEnum
from sqlalchemy import LargeBinary as SqlaLargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import os
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List
from dotenv import load_dotenv

# Загрузка переменных окружения из .env (TELEGRAM_BOT_TOKEN и др.)
load_dotenv()

from file_utils import save_upload_file, delete_file, UPLOAD_DIR, validate_image
from geocoding import geocode_address
import payments

ALGORITHM = "HS256"
DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./marketplace_v3.db")

# JWT-ключ обязателен на проде. Если его нет, но это Postgres или ENV=production —
# падаем на старте, а не подписываем токены предсказуемым дефолтом (подделка JWT).
SECRET_KEY = os.environ.get("SECRET_KEY")
_is_production = (
    os.environ.get("ENV", "").lower() == "production"
    or DB_URL.startswith("postgres")
)
if not SECRET_KEY:
    if _is_production:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set in production."
        )
    SECRET_KEY = "marketplace_super_secret"  # только для локальной разработки
# Render/Heroku отдают postgres:// — SQLAlchemy 2 требует явный драйвер
if DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DB_URL.startswith("postgresql://"):
    DB_URL = DB_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
connect_args = {"check_same_thread": False} if "sqlite" in DB_URL else {}
engine = create_engine(DB_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserRole(str, PyEnum):
    customer = "customer"
    specialist = "specialist"

class TaskStatus(str, PyEnum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"

class TaskCategory(str, PyEnum):
    design = "design"
    development = "development"
    writing = "writing"
    repairs = "repairs"
    cleaning = "cleaning"
    delivery = "delivery"
    photo_video = "photo_video"
    tutoring = "tutoring"
    beauty = "beauty"
    events = "events"
    business = "business"
    other = "other"

class TransactionType(str, PyEnum):
    deposit = "deposit"
    escrow_hold = "escrow_hold"
    escrow_release = "escrow_release"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(SqlaEnum(UserRole), default=UserRole.customer)  # основная роль (для обратной совместимости)
    active_role = Column(SqlaEnum(UserRole), nullable=True)  # текущая активная роль (customer или specialist)
    roles = Column(Text, nullable=True)  # JSON массив доступных ролей: ["customer", "specialist"]
    name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    balance = Column(Integer, default=0)
    city = Column(String, nullable=True)
    city_manual = Column(String, nullable=True)  # город, введённый вручную (если нет в списке)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    phone = Column(String, nullable=True)
    telegram_handle = Column(String, nullable=True)
    whatsapp = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    portfolio = Column(Text, nullable=True)  # JSON string with portfolio items
    skills = Column(Text, nullable=True)  # JSON string with skills array
    specialization = Column(Text, nullable=True)  # JSON массив специализаций для специалиста
    experience_years = Column(Integer, nullable=True)  # лет опыта
    hourly_rate = Column(Integer, nullable=True)  # ставка в час
    education = Column(String, nullable=True)  # образование
    company_name = Column(String, nullable=True)  # название компании (для заказчиков)
    company_description = Column(Text, nullable=True)
    company_logo = Column(String, nullable=True)
    website = Column(String, nullable=True)
    verified = Column(Boolean, default=False)
    last_seen = Column(String, nullable=True)  # ISO-время последней активности
    response_credits = Column(Integer, default=5)  # оплаченные отклики (5 — стартовый бонус)
    is_pro = Column(Boolean, default=False)  # PRO-подписка: безлимит откликов + приоритет
    pro_until = Column(String, nullable=True)
    telegram_chat_id = Column(String, nullable=True)  # ID чата Telegram для уведомлений
    telegram_link_code = Column(String, nullable=True)  # код для привязки аккаунта
    notification_settings = Column(Text, nullable=True)  # JSON настройки уведомлений

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    amount = Column(Integer)
    type = Column(SqlaEnum(TransactionType))
    task_id = Column(Integer, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class PaymentRecord(Base):
    __tablename__ = "payment_records"
    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String, unique=True, index=True)
    user_id = Column(Integer, index=True)
    amount = Column(Integer)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    type = Column(String)       # "new_response", "assigned", "message", "completed", "review"
    title = Column(String)
    text = Column(String)
    task_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Response(Base):
    __tablename__ = "responses"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, index=True)
    specialist_id = Column(Integer)
    text = Column(String)
    proposed_price = Column(Integer, nullable=True)
    estimated_days = Column(Integer, nullable=True)
    portfolio_items = Column(Text, nullable=True)  # JSON: [{title, image_url, description}]
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    budget = Column(Integer, nullable=True)
    category = Column(SqlaEnum(TaskCategory), default=TaskCategory.other, index=True)
    customer_id = Column(Integer)
    executor_id = Column(Integer, nullable=True)
    status = Column(SqlaEnum(TaskStatus), default=TaskStatus.open)
    city = Column(String, nullable=True, index=True)
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    deadline = Column(String, nullable=True)
    is_remote = Column(Boolean, default=False)
    images = Column(Text, nullable=True)  # JSON string with image URLs
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, index=True)
    sender_id = Column(Integer)
    text = Column(String)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, index=True)
    reviewer_id = Column(Integer)
    specialist_id = Column(Integer, index=True)  # тот, КТОМУ поставили оценку (специалист или заказчик)
    rating = Column(Integer)
    comment = Column(String, nullable=True)
    target = Column(String, default="specialist")  # specialist | customer — кому отзыв

class ChatRead(Base):
    """Отметка «докуда пользователь прочитал чат по задаче» — для счётчиков непрочитанного"""
    __tablename__ = "chat_reads"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    task_id = Column(Integer, index=True)
    last_read_message_id = Column(Integer, default=0)

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    token = Column(String, unique=True, index=True)
    expires_at = Column(String)
    used = Column(Boolean, default=False)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class StoredFile(Base):
    """Файлы (аватары, портфолио, фото заказов) хранятся в базе — переживают перезапуск контейнера"""
    __tablename__ = "stored_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    content_type = Column(String, default="image/jpeg")
    data = Column(SqlaLargeBinary)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

# ---- Ветка «Товары»: маркетплейс товаров ----

class ProductCategory(str, PyEnum):
    electronics = "electronics"
    clothing = "clothing"
    home = "home"
    beauty = "beauty"
    kids = "kids"
    sports = "sports"
    auto = "auto"
    hobby = "hobby"
    books = "books"
    other = "other"

class ProductCondition(str, PyEnum):
    new = "new"
    used = "used"

class ProductStatus(str, PyEnum):
    active = "active"
    draft = "draft"
    sold = "sold"
    archived = "archived"

class OrderStatus(str, PyEnum):
    pending = "pending"        # ожидает подтверждения продавца
    confirmed = "confirmed"    # продавец подтвердил
    shipped = "shipped"        # отправлен
    delivered = "delivered"    # доставлен/получен
    cancelled = "cancelled"

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    price = Column(Integer)  # цена в рублях
    category = Column(SqlaEnum(ProductCategory), default=ProductCategory.other, index=True)
    condition = Column(SqlaEnum(ProductCondition), default=ProductCondition.new)
    images = Column(Text, nullable=True)   # JSON массив URL
    specs = Column(Text, nullable=True)    # JSON массив [{key, value}]
    stock = Column(Integer, default=1)     # количество на складе
    city = Column(String, nullable=True, index=True)
    status = Column(SqlaEnum(ProductStatus), default=ProductStatus.active, index=True)
    views = Column(Integer, default=0)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class ProductOrder(Base):
    __tablename__ = "product_orders"
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, index=True)
    seller_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    quantity = Column(Integer, default=1)
    total_price = Column(Integer)
    status = Column(SqlaEnum(OrderStatus), default=OrderStatus.pending, index=True)
    delivery_address = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class ProductFavorite(Base):
    __tablename__ = "product_favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

class ProductReview(Base):
    __tablename__ = "product_reviews"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, index=True)
    author_id = Column(Integer, index=True)
    order_id = Column(Integer, nullable=True)
    rating = Column(Integer)
    comment = Column(Text, nullable=True)
    created_at = Column(String, default=lambda: datetime.utcnow().isoformat())

Base.metadata.create_all(bind=engine)

def _run_column_migrations():
    """Добавляет новые колонки в уже существующие таблицы (create_all их не трогает)"""
    from sqlalchemy import text
    is_pg = "postgresql" in DB_URL
    # PG понимает IF NOT EXISTS — не отравляет транзакцию. SQLite не понимает, но там ловим исключением.
    ck = "IF NOT EXISTS " if is_pg else ""
    migrations = [
        f"ALTER TABLE users ADD COLUMN {ck}last_seen VARCHAR",
        f"ALTER TABLE reviews ADD COLUMN {ck}target VARCHAR DEFAULT 'specialist'",
        f"ALTER TABLE users ADD COLUMN {ck}response_credits INTEGER DEFAULT 5",
        f"ALTER TABLE users ADD COLUMN {ck}is_pro BOOLEAN DEFAULT false",
        f"ALTER TABLE users ADD COLUMN {ck}pro_until VARCHAR",
        f"ALTER TABLE responses ADD COLUMN {ck}portfolio_items TEXT",
        f"ALTER TABLE responses ADD COLUMN {ck}created_at VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}active_role VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}roles TEXT",
        f"ALTER TABLE users ADD COLUMN {ck}city_manual VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}telegram_handle VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}whatsapp VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}specialization TEXT",
        f"ALTER TABLE users ADD COLUMN {ck}experience_years INTEGER",
        f"ALTER TABLE users ADD COLUMN {ck}hourly_rate INTEGER",
        f"ALTER TABLE users ADD COLUMN {ck}education VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}company_name VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}company_description TEXT",
        f"ALTER TABLE users ADD COLUMN {ck}company_logo VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}website VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}latitude REAL",
        f"ALTER TABLE users ADD COLUMN {ck}longitude REAL",
        f"ALTER TABLE users ADD COLUMN {ck}telegram_chat_id VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}telegram_link_code VARCHAR",
        f"ALTER TABLE users ADD COLUMN {ck}notification_settings TEXT",
    ]
    for m in migrations:
        with engine.connect() as conn:  # своя транзакция на каждую миграцию
            try:
                conn.execute(text(m))
                conn.commit()
            except Exception:
                conn.rollback()  # колонка уже существует (SQLite)

    # Бэкфилл: у старых пользователей roles/active_role пустые — заполняем из основной роли
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "UPDATE users SET active_role = role WHERE active_role IS NULL"
            ))
            conn.execute(text(
                "UPDATE users SET roles = '[\"' || role || '\"]' WHERE roles IS NULL"
            ))
            conn.commit()
        except Exception:
            conn.rollback()

_run_column_migrations()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

app = FastAPI(title="ProfiClone API - YouDo Edition")

# CORS: явный whitelist источников вместо "*".
# ALLOWED_ORIGINS — список через запятую; по умолчанию локальный фронт Vite.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:5175"
_frontend_url = os.environ.get("FRONTEND_URL")
_origins_env = os.environ.get("ALLOWED_ORIGINS", _default_origins)
allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
if _frontend_url and _frontend_url not in allowed_origins:
    allowed_origins.append(_frontend_url)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if _is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# --- Онлайн-статусы: обновляем last_seen не чаще раза в минуту ---
_seen_cache: dict[int, datetime] = {}

@app.middleware("http")
async def track_last_seen(request, call_next):
    response = await call_next(request)
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM])
            uid = int(payload.get("sub"))
            now = datetime.utcnow()
            last = _seen_cache.get(uid)
            if last is None or (now - last).total_seconds() > 60:
                db = SessionLocal()
                try:
                    db.query(User).filter(User.id == uid).update({"last_seen": now.isoformat()})
                    db.commit()
                finally:
                    db.close()
                _seen_cache[uid] = now
        except Exception:
            pass
    return response

def user_online(user) -> bool:
    """Онлайн = была активность за последние 2 минуты"""
    if not user.last_seen:
        return False
    try:
        return (datetime.utcnow() - datetime.fromisoformat(user.last_seen)).total_seconds() < 120
    except Exception:
        return False

# --- Простой in-memory rate limiter (без внешних зависимостей) ---
# Скользящее окно по (ключ). Защищает login/register/forgot от брутфорса и спама.
_rate_buckets: dict[str, list[float]] = {}

def rate_limit(request: Request, bucket: str, limit: int, window_sec: int):
    import time as _time
    ip = request.client.host if request.client else "unknown"
    key = f"{bucket}:{ip}"
    now = _time.time()
    hits = [t for t in _rate_buckets.get(key, []) if now - t < window_sec]
    if len(hits) >= limit:
        raise HTTPException(429, "Слишком много запросов, попробуйте позже")
    hits.append(now)
    _rate_buckets[key] = hits

# Mount uploads directory for serving images
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, task_id: int, already_accepted: bool = False):
        if not already_accepted:
            await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = []
        self.active_connections[task_id].append(websocket)

    def disconnect(self, websocket: WebSocket, task_id: int):
        if task_id in self.active_connections:
            try:
                self.active_connections[task_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]

    async def broadcast(self, message: dict, task_id: int):
        if task_id in self.active_connections:
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    pass

manager = ConnectionManager()

def _set_chat_read(db: Session, user_id: int, task_id: int, last_message_id: int):
    """Двигает отметку прочтения чата вперёд (никогда назад)."""
    cr = db.query(ChatRead).filter(ChatRead.user_id == user_id, ChatRead.task_id == task_id).first()
    if cr is None:
        db.add(ChatRead(user_id=user_id, task_id=task_id, last_read_message_id=last_message_id))
    elif last_message_id > (cr.last_read_message_id or 0):
        cr.last_read_message_id = last_message_id
    db.commit()

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен быть не короче 8 символов")
        if v.isdigit() or v.isalpha():
            raise ValueError("Пароль должен содержать и буквы, и цифры")
        return v

class TaskCreate(BaseModel):
    title: str
    description: str
    budget: Optional[int] = None
    category: TaskCategory = TaskCategory.other
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    deadline: Optional[str] = None
    is_remote: bool = False
    images: Optional[str] = None

class TaskOut(TaskCreate):
    id: int
    customer_id: int
    executor_id: Optional[int] = None
    status: str

class MessageCreate(BaseModel):
    text: str

class MessageOut(BaseModel):
    id: int
    task_id: int
    sender_id: int
    text: str
    created_at: str
    sender_name: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    city_manual: Optional[str] = None
    phone: Optional[str] = None
    telegram_handle: Optional[str] = None
    whatsapp: Optional[str] = None
    avatar: Optional[str] = None
    skills: Optional[str] = None  # JSON string
    portfolio: Optional[str] = None  # JSON string
    specialization: Optional[str] = None  # JSON string
    experience_years: Optional[int] = None
    hourly_rate: Optional[int] = None
    education: Optional[str] = None
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_logo: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ResponseCreate(BaseModel):
    text: str
    proposed_price: Optional[int] = None
    estimated_days: Optional[int] = None
    portfolio_items: Optional[str] = None  # JSON: [{title, image_url, description}]

class DepositRequest(BaseModel):
    amount: int

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""

# --- Товары: схемы ---
class ProductCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    price: int = Field(ge=0)
    category: ProductCategory = ProductCategory.other
    condition: ProductCondition = ProductCondition.new
    images: Optional[str] = None    # JSON массив URL
    specs: Optional[str] = None     # JSON массив [{key, value}]
    stock: int = Field(default=1, ge=0)
    city: Optional[str] = None
    status: ProductStatus = ProductStatus.active

class ProductUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    price: Optional[int] = Field(default=None, ge=0)
    category: Optional[ProductCategory] = None
    condition: Optional[ProductCondition] = None
    images: Optional[str] = None
    specs: Optional[str] = None
    stock: Optional[int] = Field(default=None, ge=0)
    city: Optional[str] = None
    status: Optional[ProductStatus] = None

class ProductOrderCreate(BaseModel):
    quantity: int = Field(default=1, ge=1)
    delivery_address: Optional[str] = None
    contact_phone: Optional[str] = None
    comment: Optional[str] = None

class ProductReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""

# --- Роли: helpers ---
def get_user_roles(user) -> list:
    """Список доступных ролей пользователя. Если roles пуст — берём основную роль."""
    if user.roles:
        try:
            parsed = json.loads(user.roles)
            if isinstance(parsed, list) and parsed:
                return parsed
        except Exception:
            pass
    return [user.role.value if hasattr(user.role, "value") else str(user.role)]

def get_active_role(user) -> str:
    """Текущая активная роль. Fallback на основную роль."""
    if user.active_role:
        return user.active_role.value if hasattr(user.active_role, "value") else str(user.active_role)
    return user.role.value if hasattr(user.role, "value") else str(user.role)

# Routes
@app.post("/register/")
def register(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "register", limit=5, window_sec=3600)
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(400, "Email занят")
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        role=user.role,
        active_role=user.role,
        roles=json.dumps([role_value]),
        name=user.name,
    )
    db.add(new_user)
    db.commit()
    return {"message": "Успех", "user_id": new_user.id}

@app.post("/login")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    rate_limit(request, "login", limit=10, window_sec=300)
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Ошибка")
    active = get_active_role(user)
    token = jwt.encode({"sub": str(user.id), "role": active, "exp": datetime.utcnow() + timedelta(days=1)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "role": active, "roles": get_user_roles(user)}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен быть не короче 8 символов")
        if v.isdigit() or v.isalpha():
            raise ValueError("Пароль должен содержать и буквы, и цифры")
        return v

def send_email(to: str, subject: str, body: str):
    """Отправка письма через SMTP из переменных окружения"""
    import smtplib
    from email.mime.text import MIMEText
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    if not host or not user or not password:
        raise HTTPException(503, "Почтовый сервис не настроен. Обратитесь к администратору.")
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", user)
    msg["To"] = to
    port = int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)

def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))

def _send_email_safe(to: str, subject: str, body: str):
    """Best-effort отправка: не роняет запрос, если SMTP не настроен или почта недоступна."""
    if not to or not _smtp_configured():
        return
    try:
        send_email(to, subject, body)
    except Exception as e:
        print(f"email to {to} failed: {e}")

def queue_email(background: Optional[BackgroundTasks], to: Optional[str], subject: str, body: str):
    """Ставит письмо в фоновую задачу, чтобы SMTP не тормозил ответ API."""
    if background is None or not to or not _smtp_configured():
        return
    background.add_task(_send_email_safe, to, subject, body)

@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(request, "forgot", limit=5, window_sec=3600)
    user = db.query(User).filter(User.email == req.email).first()
    # Не раскрываем существование аккаунта — всегда отвечаем успехом.
    # Письмо шлём в фоне через best-effort: если SMTP не настроен/недоступен,
    # запрос НЕ падает с 503 (иначе разница ответов выдаёт, что аккаунт существует).
    if user:
        import secrets as pysecrets
        token = pysecrets.token_urlsafe(32)
        reset = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=(datetime.utcnow() + timedelta(hours=1)).isoformat()
        )
        db.add(reset)
        db.commit()
        frontend_url = os.environ.get("FRONTEND_URL", "https://delo-jhcy.onrender.com")
        link = f"{frontend_url}/reset?token={token}"
        queue_email(
            background,
            req.email,
            "ДЕЛО — сброс пароля",
            f"Здравствуйте!\n\nКто-то (надеемся, вы) запросил сброс пароля на маркетплейсе ДЕЛО.\n"
            f"Ссылка действительна 1 час:\n\n{link}\n\n"
            f"Если вы не запрашивали сброс — просто проигнорируйте это письмо."
        )
    return {"message": "Если аккаунт существует, письмо со ссылкой отправлено"}

@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "reset", limit=10, window_sec=3600)  # защита от перебора токена
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token == req.token).first()
    if not reset or reset.used:
        raise HTTPException(400, "Ссылка недействительна или уже использована")
    if datetime.fromisoformat(reset.expires_at) < datetime.utcnow():
        raise HTTPException(400, "Ссылка истекла, запросите сброс заново")
    user = db.query(User).filter(User.id == reset.user_id).first()
    user.hashed_password = hash_password(req.new_password)
    reset.used = True
    db.commit()
    return {"message": "Пароль обновлён, войдите с новым паролем"}

@app.post("/tasks/")
def create_task(task: TaskCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    if payload.get("role") != "customer":
        raise HTTPException(403, "Только для заказчиков")

    # Auto-geocode if city provided but no coordinates
    latitude = task.latitude
    longitude = task.longitude

    if task.city and not task.is_remote and (latitude is None or longitude is None):
        coords = geocode_address(task.city, task.address)
        if coords:
            latitude, longitude = coords

    new_task = Task(
        title=task.title,
        description=task.description,
        budget=task.budget,
        category=task.category,
        customer_id=int(payload.get("sub")),
        city=task.city,
        address=task.address,
        latitude=latitude,
        longitude=longitude,
        deadline=task.deadline,
        is_remote=task.is_remote,
        images=task.images
    )
    db.add(new_task)
    db.commit()
    return {"message": "Создано", "task_id": new_task.id}

@app.get("/tasks/")
def get_tasks(
    response: FastResponse,
    category: Optional[TaskCategory] = None,
    search: Optional[str] = None,
    city: Optional[str] = None,
    is_remote: Optional[bool] = None,
    status: Optional[TaskStatus] = None,
    sort: str = "new",
    limit: Optional[int] = None,
    offset: int = 0,
    # Новые фильтры
    budget_min: Optional[int] = None,
    budget_max: Optional[int] = None,
    deadline_days: Optional[int] = None,  # задачи с дедлайном в ближайшие N дней
    new_only: Optional[bool] = None,  # задачи за последние 24 часа
    has_responses: Optional[bool] = None,  # задачи с откликами
    lat: Optional[float] = None,  # для радиуса поиска
    lon: Optional[float] = None,
    radius_km: Optional[float] = None,
    db: Session = Depends(get_db)
):
    from sqlalchemy import func, cast, Float as SqlFloat

    query = db.query(Task)
    if category:
        query = query.filter(Task.category == category)
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%") | Task.description.ilike(f"%{search}%"))
    if city:
        query = query.filter(Task.city == city)
    if is_remote is not None:
        query = query.filter(Task.is_remote == is_remote)
    if status is not None:
        query = query.filter(Task.status == status)

    # Фильтр по бюджету
    if budget_min is not None:
        query = query.filter(Task.budget >= budget_min)
    if budget_max is not None:
        query = query.filter(Task.budget <= budget_max)

    # Фильтр по дедлайну (задачи с дедлайном в ближайшие N дней)
    if deadline_days is not None and deadline_days > 0:
        from datetime import datetime, timedelta
        deadline_cutoff = (datetime.utcnow() + timedelta(days=deadline_days)).isoformat()
        query = query.filter(Task.deadline.isnot(None), Task.deadline <= deadline_cutoff)

    # Фильтр "новые" (задачи за последние 24 часа)
    if new_only:
        from datetime import datetime, timedelta
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        query = query.filter(Task.created_at >= cutoff)

    # Фильтр по наличию откликов
    if has_responses is not None:
        from sqlalchemy import exists, and_
        if has_responses:
            query = query.filter(
                exists().where(and_(Response.task_id == Task.id))
            )
        else:
            query = query.filter(
                ~exists().where(and_(Response.task_id == Task.id))
            )

    # Радиус поиска (упрощённая формула Haversine для малых расстояний)
    if lat is not None and lon is not None and radius_km is not None and radius_km > 0:
        # Фильтруем задачи в радиусе radius_km от точки (lat, lon)
        # Упрощённая формула: ~111км на градус широты, cos(lat) корректирует долготу
        import math
        lat_delta = radius_km / 111.0
        lon_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
        query = query.filter(
            Task.latitude.isnot(None),
            Task.longitude.isnot(None),
            Task.latitude.between(lat - lat_delta, lat + lat_delta),
            Task.longitude.between(lon - lon_delta, lon + lon_delta)
        )
        # Для точности можно добавить дистанцию в ORDER BY позже

    # Сортировка на сервере (работает для всех страниц, а не только видимой)
    if sort == "budget_desc":
        query = query.order_by(Task.budget.desc().nullslast(), Task.id.desc())
    elif sort == "budget_asc":
        query = query.order_by(Task.budget.asc().nullsfirst(), Task.id.desc())
    elif sort == "old":
        query = query.order_by(Task.id.asc())  # id монотонен => порядок создания
    else:  # "new" (по умолчанию)
        query = query.order_by(Task.id.desc())

    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    # Пагинация включается только если передан limit (бот и старые клиенты получают всё)
    if limit is not None:
        limit = max(1, min(limit, 100))
        offset = max(0, offset)
        query = query.offset(offset).limit(limit)

    return query.all()

@app.get("/tasks/cities")
def get_task_cities(db: Session = Depends(get_db)):
    """Список уникальных городов из существующих задач — для фильтра ленты.
    Включает города, введённые вручную (которых нет в статичном списке фронта)."""
    rows = db.query(Task.city).filter(Task.city.isnot(None), Task.city != "").distinct().all()
    cities = sorted({r[0].strip() for r in rows if r[0] and r[0].strip()})
    return {"cities": cities}

@app.get("/tasks/{task_id}")
def get_task_detail(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")
    customer = db.query(User).filter(User.id == task.customer_id).first()
    responses_count = db.query(Response).filter(Response.task_id == task_id).count()
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "budget": task.budget,
        "category": task.category,
        "customer_id": task.customer_id,
        "customer_name": customer.name if customer else None,
        "executor_id": task.executor_id,
        "status": task.status,
        "city": task.city,
        "address": task.address,
        "latitude": task.latitude,
        "longitude": task.longitude,
        "deadline": task.deadline,
        "is_remote": task.is_remote,
        "images": task.images,
        "responses_count": responses_count
    }

class TaskImagesDeleteRequest(BaseModel):
    urls_to_delete: List[str]

@app.delete("/tasks/{task_id}/images")
def delete_task_images(task_id: int, req: TaskImagesDeleteRequest, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Удаление фото из заказа (только его автор)"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")
    if task.customer_id != user_id:
        raise HTTPException(403, "Удалять фото может только автор заказа")
    try:
        imgs = json.loads(task.images) if task.images else []
    except Exception:
        imgs = []
    new_imgs = [u for u in imgs if u not in req.urls_to_delete]
    task.images = json.dumps(new_imgs) if new_imgs else None
    db.commit()
    return {"message": "Фото удалено", "images": new_imgs}

@app.get("/users/{user_id}/public")
def get_public_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    # Публичная роль — активная роль пользователя (учитывает мультиролевой режим)
    active = get_active_role(user)
    is_specialist_view = active == "specialist"
    # Отзывы ЧЕЛОВЕКУ: специалисту — про его работу, заказчику — про него как заказчика
    review_target = "specialist" if is_specialist_view else "customer"
    rating = None
    reviews = db.query(Review).filter(Review.specialist_id == user.id, Review.target == review_target).all()
    if reviews:
        rating = round(sum(r.rating for r in reviews) / len(reviews), 1)
    if is_specialist_view:
        completed_tasks = db.query(Task).filter(
            Task.executor_id == user.id,
            Task.status == TaskStatus.completed
        ).count()
    else:
        completed_tasks = db.query(Task).filter(
            Task.customer_id == user.id,
            Task.status == TaskStatus.completed
        ).count()
    return {
        "id": user.id,
        "role": active,
        "name": user.name,
        "bio": user.bio,
        "rating": rating,
        "city": user.city,
        "avatar": user.avatar,
        "portfolio": user.portfolio,
        "skills": user.skills,
        "specialization": user.specialization,
        "experience_years": user.experience_years,
        "hourly_rate": user.hourly_rate,
        "education": user.education,
        "company_name": user.company_name,
        "company_description": user.company_description,
        "website": user.website,
        "telegram_handle": user.telegram_handle,
        "whatsapp": user.whatsapp,
        "verified": user.verified,
        "is_pro": user.is_pro,
        "completed_tasks": completed_tasks,
        "online": user_online(user),
        "last_seen": user.last_seen
    }

@app.get("/users/{user_id}/reviews")
def get_user_reviews(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    review_target = "specialist" if user.role == UserRole.specialist else "customer"
    reviews = db.query(Review).filter(
        Review.specialist_id == user_id, Review.target == review_target
    ).order_by(Review.id.desc()).all()
    result = []
    for r in reviews:
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
        task = db.query(Task).filter(Task.id == r.task_id).first()
        reviewer_role = "Специалист" if (reviewer and reviewer.role == UserRole.specialist) else "Заказчик"
        result.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "reviewer_name": reviewer.name if reviewer and reviewer.name else reviewer_role,
            "reviewer_role": reviewer_role,
            "task_title": task.title if task else None,
            "task_id": r.task_id
        })
    return result

@app.get("/users/me")
def get_profile(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    roles = get_user_roles(user)
    active = get_active_role(user)

    rating = None
    completed_tasks = 0
    if "specialist" in roles:
        reviews = db.query(Review).filter(Review.specialist_id == user.id).all()
        if reviews:
            rating = round(sum(r.rating for r in reviews) / len(reviews), 1)
        completed_tasks = db.query(Task).filter(
            Task.executor_id == user.id,
            Task.status == TaskStatus.completed
        ).count()

    return {
        "id": user.id,
        "email": user.email,
        "role": active,               # активная роль (для обратной совместимости)
        "active_role": active,
        "roles": roles,
        "name": user.name,
        "bio": user.bio,
        "rating": rating,
        "balance": user.balance,
        "city": user.city,
        "city_manual": user.city_manual,
        "phone": user.phone,
        "telegram_handle": user.telegram_handle,
        "whatsapp": user.whatsapp,
        "avatar": user.avatar,
        "portfolio": user.portfolio,
        "skills": user.skills,
        "specialization": user.specialization,
        "experience_years": user.experience_years,
        "hourly_rate": user.hourly_rate,
        "education": user.education,
        "company_name": user.company_name,
        "company_description": user.company_description,
        "company_logo": user.company_logo,
        "website": user.website,
        "verified": user.verified,
        "completed_tasks": completed_tasks,
        "response_credits": user.response_credits,
        "is_pro": user.is_pro,
        "pro_until": user.pro_until
    }

@app.put("/users/me")
def update_profile(profile: ProfileUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if profile.name is not None:
        user.name = profile.name
    if profile.bio is not None:
        user.bio = profile.bio
    if profile.city is not None:
        user.city = profile.city
        # Автоматический геокодинг города пользователя (если координаты не переданы явно)
        if profile.latitude is None or profile.longitude is None:
            coords = geocode_address(profile.city)
            if coords:
                user.latitude, user.longitude = coords
    if profile.city_manual is not None:
        user.city_manual = profile.city_manual
    if profile.phone is not None:
        user.phone = profile.phone
    if profile.telegram_handle is not None:
        user.telegram_handle = profile.telegram_handle
    if profile.whatsapp is not None:
        user.whatsapp = profile.whatsapp
    if profile.avatar is not None:
        user.avatar = profile.avatar
    if profile.skills is not None:
        user.skills = profile.skills
    if profile.portfolio is not None:
        user.portfolio = profile.portfolio
    if profile.specialization is not None:
        user.specialization = profile.specialization
    if profile.experience_years is not None:
        user.experience_years = profile.experience_years
    if profile.hourly_rate is not None:
        user.hourly_rate = profile.hourly_rate
    if profile.education is not None:
        user.education = profile.education
    if profile.company_name is not None:
        user.company_name = profile.company_name
    if profile.company_description is not None:
        user.company_description = profile.company_description
    if profile.company_logo is not None:
        user.company_logo = profile.company_logo
    if profile.website is not None:
        user.website = profile.website
    # Если координаты переданы явно (GPS из браузера), сохраняем как есть
    if profile.latitude is not None:
        user.latitude = profile.latitude
    if profile.longitude is not None:
        user.longitude = profile.longitude
    db.commit()
    return {"message": "Профиль обновлен"}

# ---- Переключение и добавление ролей ----

class RoleSwitch(BaseModel):
    role: UserRole

@app.post("/users/me/switch-role")
def switch_role(payload_body: RoleSwitch, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Переключить активную роль. Роль должна быть уже доступна пользователю."""
    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    target = payload_body.role.value if hasattr(payload_body.role, "value") else str(payload_body.role)
    roles = get_user_roles(user)
    if target not in roles:
        raise HTTPException(400, "Эта роль вам недоступна. Сначала добавьте её.")
    user.active_role = payload_body.role
    db.commit()
    # Новый токен с обновлённой активной ролью
    new_token = jwt.encode(
        {"sub": str(user.id), "role": target, "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    return {"access_token": new_token, "token_type": "bearer", "role": target, "roles": roles}

@app.post("/users/me/add-role")
def add_role(payload_body: RoleSwitch, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Добавить новую роль (стать исполнителем/заказчиком) и сразу переключиться на неё."""
    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    target = payload_body.role.value if hasattr(payload_body.role, "value") else str(payload_body.role)
    roles = get_user_roles(user)
    if target not in roles:
        roles.append(target)
        user.roles = json.dumps(roles)
    user.active_role = payload_body.role
    db.commit()
    new_token = jwt.encode(
        {"sub": str(user.id), "role": target, "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    return {"access_token": new_token, "token_type": "bearer", "role": target, "roles": roles}

# ---- Геокодинг ----

class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float

@app.post("/geocode/reverse")
def reverse_geocode_endpoint(data: ReverseGeocodeRequest):
    """Преобразовать координаты в адрес (для кнопки 'Моё местоположение')"""
    from geocoding import reverse_geocode
    address = reverse_geocode(data.latitude, data.longitude)
    if not address:
        raise HTTPException(404, "Не удалось определить адрес")
    return {"address": address}

# ---- Telegram уведомления ----

@app.post("/telegram/generate-link-code")
def generate_telegram_link_code(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Генерирует уникальный код для привязки Telegram-аккаунта"""
    import secrets
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    # Генерируем 6-значный код
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    user.telegram_link_code = code
    db.commit()

    return {"code": code}

@app.post("/telegram/link")
def link_telegram_account(code: str, chat_id: str, db: Session = Depends(get_db)):
    """Привязывает Telegram chat_id к пользователю по коду (вызывается ботом)"""
    user = db.query(User).filter(User.telegram_link_code == code).first()
    if not user:
        raise HTTPException(404, "Неверный код привязки")

    user.telegram_chat_id = chat_id
    user.telegram_link_code = None  # код одноразовый

    # Настройки уведомлений по умолчанию (всё включено)
    if not user.notification_settings:
        default_settings = {
            "new_response": True,
            "response_accepted": True,
            "new_message": True,
            "task_completed": True,
            "new_review": True,
        }
        user.notification_settings = json.dumps(default_settings)

    db.commit()
    return {"success": True, "user_name": user.name or user.email}

@app.get("/telegram/settings")
def get_notification_settings(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Получить настройки уведомлений"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    settings = json.loads(user.notification_settings) if user.notification_settings else {
        "new_response": True,
        "response_accepted": True,
        "new_message": True,
        "task_completed": True,
        "new_review": True,
    }

    return {
        "telegram_connected": bool(user.telegram_chat_id),
        "settings": settings
    }

class NotificationSettingsUpdate(BaseModel):
    new_response: Optional[bool] = None
    response_accepted: Optional[bool] = None
    new_message: Optional[bool] = None
    task_completed: Optional[bool] = None
    new_review: Optional[bool] = None

@app.put("/telegram/settings")
def update_notification_settings(data: NotificationSettingsUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Обновить настройки уведомлений"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    current = json.loads(user.notification_settings) if user.notification_settings else {}

    if data.new_response is not None:
        current["new_response"] = data.new_response
    if data.response_accepted is not None:
        current["response_accepted"] = data.response_accepted
    if data.new_message is not None:
        current["new_message"] = data.new_message
    if data.task_completed is not None:
        current["task_completed"] = data.task_completed
    if data.new_review is not None:
        current["new_review"] = data.new_review

    user.notification_settings = json.dumps(current)
    db.commit()

    return {"success": True, "settings": current}

@app.delete("/telegram/unlink")
def unlink_telegram(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Отвязать Telegram от аккаунта"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    user.telegram_chat_id = None
    user.telegram_link_code = None
    db.commit()

    return {"success": True}

# ---- Кабинет пользователя: мои заказы и отклики ----

@app.get("/me/tasks")
def my_tasks(status: Optional[TaskStatus] = None, limit: int = 50, offset: int = 0, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Мои заказы — где я заказчик"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    query = db.query(Task).filter(Task.customer_id == user_id)
    if status:
        query = query.filter(Task.status == status)
    total = query.count()
    tasks = query.order_by(Task.id.desc()).offset(offset).limit(limit).all()
    result = []
    for t in tasks:
        executor = db.query(User).filter(User.id == t.executor_id).first() if t.executor_id else None
        result.append({
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "budget": t.budget,
            "category": t.category,
            "city": t.city,
            "is_remote": t.is_remote,
            "created_at": t.created_at or datetime.utcnow().isoformat(),
            "executor_name": executor.name if executor else None,
            "responses_count": db.query(Response).filter(Response.task_id == t.id).count()
        })
    return {"tasks": result, "total": total}

@app.get("/me/responses")
def my_responses(task_status: Optional[TaskStatus] = None, limit: int = 50, offset: int = 0, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Мои отклики — где я специалист"""
    payload = decode_token_or_401(token)
    specialist_id = int(payload.get("sub"))
    query = db.query(Response).filter(Response.specialist_id == specialist_id)
    # Можно фильтровать по статусу заказа
    if task_status:
        query = query.join(Task).filter(Task.status == task_status)
    total = query.count()
    responses = query.order_by(Response.id.desc()).offset(offset).limit(limit).all()
    result = []
    for r in responses:
        task = db.query(Task).filter(Task.id == r.task_id).first()
        customer = db.query(User).filter(User.id == task.customer_id).first() if task else None
        result.append({
            "id": r.id,
            "task_id": r.task_id,
            "task_title": task.title if task else None,
            "text": r.text,
            "proposed_price": r.proposed_price,
            "estimated_days": r.estimated_days,
            "task_status": task.status if task else None,
            "customer_name": customer.name if customer else None,
            "created_at": r.created_at or datetime.utcnow().isoformat()
        })
    return {"responses": result, "total": total}

@app.get("/me/stats")
def my_stats(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Статистика пользователя"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    
    # Заказы как заказчик
    tasks_as_customer = db.query(Task).filter(Task.customer_id == user_id).count()
    completed_as_customer = db.query(Task).filter(Task.customer_id == user_id, Task.status == TaskStatus.completed).count()
    
    # Отклики как специалист
    responses_count = db.query(Response).filter(Response.specialist_id == user_id).count()
    assigned_tasks = db.query(Task).filter(Task.executor_id == user_id, Task.status == TaskStatus.in_progress).count()
    completed_as_specialist = db.query(Task).filter(Task.executor_id == user_id, Task.status == TaskStatus.completed).count()
    
    # Баланс и транзакции
    balance = user.balance
    recent_transactions = db.query(Transaction).filter(Transaction.user_id == user_id).order_by(Transaction.id.desc()).limit(10).all()
    
    return {
        "role": user.role,
        "balance": balance,
        "tasks_as_customer": tasks_as_customer,
        "completed_as_customer": completed_as_customer,
        "responses_count": responses_count,
        "assigned_tasks": assigned_tasks,
        "completed_as_specialist": completed_as_specialist,
        "recent_transactions": [
            {"amount": t.amount, "type": t.type.value, "date": t.created_at} for t in recent_transactions
        ]
    }

DEMO_DEPOSIT_MAX = 100000  # верхняя граница демо-пополнения (₽)

@app.post("/wallet/deposit")
def deposit_funds(req: DepositRequest, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Демо-пополнение без реальной оплаты. На проде это дыра «бесконечные деньги» —
    # начисляем баланс только вне production, иначе заставляем идти через YooKassa.
    if _is_production:
        raise HTTPException(403, "Демо-пополнение недоступно. Используйте оплату через платёжную систему.")
    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    if req.amount <= 0:
        raise HTTPException(400, "Сумма должна быть больше 0")
    if req.amount > DEMO_DEPOSIT_MAX:
        raise HTTPException(400, f"Слишком большая сумма (максимум {DEMO_DEPOSIT_MAX} ₽)")

    user.balance += req.amount
    tx = Transaction(user_id=user.id, amount=req.amount, type=TransactionType.deposit)
    db.add(tx)
    db.commit()
    return {"message": "Баланс пополнен", "new_balance": user.balance}

# ---- Монетизация: пакеты откликов и PRO-подписка ----

MONETIZATION_PACKAGES = {
    "resp_10": {"type": "responses", "title": "10 откликов", "credits": 10, "price": 190},
    "resp_50": {"type": "responses", "title": "50 откликов", "credits": 50, "price": 790},
    "pro_1": {"type": "pro", "title": "PRO на 1 месяц", "days": 30, "price": 590},
    "pro_3": {"type": "pro", "title": "PRO на 3 месяца", "days": 90, "price": 1490},
    "pro_12": {"type": "pro", "title": "PRO на год", "days": 365, "price": 4900},
}

class BuyPackageRequest(BaseModel):
    package_id: str

@app.get("/monetization/packages")
def get_packages():
    return {"packages": [
        {"id": pid, **pkg} for pid, pkg in MONETIZATION_PACKAGES.items()
    ]}

@app.post("/monetization/buy")
def buy_package(req: BuyPackageRequest, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    pkg = MONETIZATION_PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(404, "Пакет не найден")

    payload = decode_token_or_401(token)
    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if "specialist" not in get_user_roles(user):
        raise HTTPException(403, "Пакеты доступны только специалистам")
    if (user.balance or 0) < pkg["price"]:
        raise HTTPException(400, f"Недостаточно средств: нужно {pkg['price']} ₽. Пополните баланс.")

    user.balance -= pkg["price"]
    tx = Transaction(user_id=user.id, amount=-pkg["price"], type=TransactionType.deposit)
    db.add(tx)

    if pkg["type"] == "responses":
        user.response_credits = (user.response_credits or 0) + pkg["credits"]
        msg = f"Пакет «{pkg['title']}» куплен! Откликов: {user.response_credits}"
    else:
        base = datetime.utcnow()
        if user.pro_until and datetime.fromisoformat(user.pro_until) > base:
            base = datetime.fromisoformat(user.pro_until)  # продление с текущей даты окончания
        user.pro_until = (base + timedelta(days=pkg["days"])).isoformat()
        user.is_pro = True
        msg = f"PRO активирован до {user.pro_until[:10]}"

    db.commit()
    return {"message": msg, "balance": user.balance,
            "response_credits": user.response_credits, "is_pro": user.is_pro, "pro_until": user.pro_until}

@app.get("/payments/status")
def payments_status():
    """Check if real payment provider (YooKassa) is configured"""
    return {"configured": payments.is_configured()}

@app.post("/payments/create")
def create_payment(req: DepositRequest, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Create a YooKassa payment and return the confirmation URL to redirect the user."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    if req.amount <= 0:
        raise HTTPException(400, "Сумма должна быть больше 0")

    if not payments.is_configured():
        raise HTTPException(400, "Платёжная система не настроена. Используйте демо-пополнение.")

    result = payments.create_payment(
        amount=req.amount,
        description=f"Пополнение баланса ProfiClone на {req.amount} руб.",
        metadata={"user_id": str(user_id), "amount": str(req.amount)}
    )

    if "error" in result:
        raise HTTPException(502, f"Ошибка создания платежа: {result['error']}")

    return {
        "payment_id": result["payment_id"],
        "confirmation_url": result["confirmation_url"]
    }

@app.post("/payments/confirm")
def confirm_payment(payment_id: str, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Check payment status and credit balance if paid.
    Called by frontend after user returns from YooKassa.
    Idempotent: won't double-credit thanks to transaction record check.
    """
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))

    status_result = payments.get_payment_status(payment_id)
    if "error" in status_result:
        raise HTTPException(502, f"Ошибка проверки платежа: {status_result['error']}")

    if not status_result.get("paid"):
        return {"status": status_result["status"], "credited": False}

    # Verify the payment belongs to this user
    meta_user_id = status_result.get("metadata", {}).get("user_id")
    if meta_user_id != str(user_id):
        raise HTTPException(403, "Платёж не принадлежит этому пользователю")

    # Idempotency: don't double-credit if we already processed this payment
    already = db.query(PaymentRecord).filter(PaymentRecord.payment_id == payment_id).first()
    if already:
        return {"status": "succeeded", "credited": False, "message": "Уже зачислено"}

    amount = status_result["amount"]
    user = db.query(User).filter(User.id == user_id).first()
    user.balance += amount
    tx = Transaction(user_id=user_id, amount=amount, type=TransactionType.deposit)
    db.add(tx)
    db.add(PaymentRecord(payment_id=payment_id, user_id=user_id, amount=amount))
    db.commit()

    return {"status": "succeeded", "credited": True, "new_balance": user.balance}

@app.put("/tasks/{task_id}/assign")
def assign_task(task_id: int, specialist_id: int, background: BackgroundTasks, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    customer_id = int(payload.get("sub"))
    customer = db.query(User).filter(User.id == customer_id).first()
    task = db.query(Task).filter(Task.id == task_id, Task.customer_id == customer_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден или вы не его автор")
    # Только открытый заказ можно назначить — иначе повторный вызов удержит escrow дважды
    if task.status != TaskStatus.open:
        raise HTTPException(400, "Исполнитель уже назначен или заказ закрыт")

    spec = db.query(User).filter(User.id == specialist_id, User.role == UserRole.specialist).first()
    if not spec:
        raise HTTPException(400, "Специалист не найден")

    budget = task.budget or 0
    if customer.balance < budget:
        raise HTTPException(400, "Недостаточно средств для безопасной сделки")

    customer.balance -= budget
    if budget > 0:
        tx = Transaction(user_id=customer.id, amount=-budget, type=TransactionType.escrow_hold, task_id=task.id)
        db.add(tx)

    task.executor_id = specialist_id
    task.status = TaskStatus.in_progress
    db.commit()

    # Notify specialist they were assigned
    db.add(Notification(
        user_id=specialist_id,
        type="assigned",
        title="Вас выбрали исполнителем!",
        text=f"Заказчик назначил вас на задачу \"{task.title}\"",
        task_id=task.id
    ))
    db.commit()
    queue_email(
        background, spec.email, "ДЕЛО — вас выбрали исполнителем",
        f"Здравствуйте!\n\nЗаказчик назначил вас исполнителем задачи «{task.title}».\n\n"
        f"Открыть заказ: {os.environ.get('FRONTEND_URL', 'https://delo-jhcy.onrender.com')}/task/{task.id}"
    )

    # Telegram уведомление специалисту
    if spec.telegram_chat_id:
        try:
            settings = json.loads(spec.notification_settings) if spec.notification_settings else {}
            if settings.get("response_accepted", True):
                from telegram_bot import notify_response_accepted
                notify_response_accepted(
                    spec.telegram_chat_id,
                    task.title,
                    customer.name or customer.email,
                    task.id
                )
        except Exception as e:
            print(f"Ошибка отправки Telegram: {e}")

    return {"message": "Исполнитель назначен"}

@app.put("/tasks/{task_id}/complete")
def complete_task(task_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    customer_id = int(payload.get("sub"))
    task = db.query(Task).filter(Task.id == task_id, Task.customer_id == customer_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден или вы не его автор")
    # Завершить можно только заказ «в работе» — иначе повторный вызов выплатит escrow дважды
    if task.status != TaskStatus.in_progress:
        raise HTTPException(400, "Завершить можно только заказ в работе")

    task.status = TaskStatus.completed

    budget = task.budget or 0
    if task.executor_id and budget > 0:
        spec = db.query(User).filter(User.id == task.executor_id).first()
        if spec:
            spec.balance += budget
            tx = Transaction(user_id=spec.id, amount=budget, type=TransactionType.escrow_release, task_id=task.id)
            db.add(tx)

    # Notify specialist task completed + funds released
    if task.executor_id:
        db.add(Notification(
            user_id=task.executor_id,
            type="completed",
            title="Заказ завершён!",
            text=f"Заказчик завершил задачу \"{task.title}\". Средства зачислены на баланс.",
            task_id=task.id
        ))

        # Telegram уведомление специалисту
        spec = db.query(User).filter(User.id == task.executor_id).first()
        if spec and spec.telegram_chat_id:
            try:
                settings = json.loads(spec.notification_settings) if spec.notification_settings else {}
                if settings.get("task_completed", True):
                    from telegram_bot import notify_task_completed
                    notify_task_completed(spec.telegram_chat_id, task.title, "customer", task.id)
            except Exception as e:
                print(f"Ошибка отправки Telegram: {e}")

    db.commit()
    return {"message": "Заказ завершен"}

@app.post("/tasks/{task_id}/responses")
def create_response(task_id: int, response: ResponseCreate, background: BackgroundTasks, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    if payload.get("role") != "specialist":
        raise HTTPException(403, "Только для специалистов")
    specialist_id = int(payload.get("sub"))
    specialist = db.query(User).filter(User.id == specialist_id).first()

    # Сначала валидируем заказ — иначе можно сжечь платный отклик на несуществующий/закрытый заказ
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")
    if task.status != TaskStatus.open:
        raise HTTPException(400, "Заказ больше не принимает отклики")
    if task.customer_id == specialist_id:
        raise HTTPException(400, "Нельзя откликнуться на свой заказ")
    # Один отклик на заказ — не даём спамить заказчика и списывать несколько кредитов
    if db.query(Response).filter(Response.task_id == task_id, Response.specialist_id == specialist_id).first():
        raise HTTPException(400, "Вы уже откликнулись на этот заказ")

    # Монетизация: PRO — безлимит, иначе списываем 1 отклик
    if not specialist.is_pro:
        if (specialist.response_credits or 0) <= 0:
            raise HTTPException(402, "Отклики закончились. Купите пакет откликов или оформите PRO в профиле")
        specialist.response_credits -= 1

    new_response = Response(
        task_id=task_id,
        specialist_id=specialist_id,
        text=response.text,
        proposed_price=response.proposed_price,
        estimated_days=response.estimated_days,
        portfolio_items=response.portfolio_items
    )
    db.add(new_response)

    # Notify customer about new response
    if task:
        db.add(Notification(
            user_id=task.customer_id,
            type="new_response",
            title="Новый отклик на заказ!",
            text=f"{'PRO ★ ' if specialist.is_pro else ''}{specialist.name or specialist.email} откликнулся на задачу \"{task.title}\"" + (f" — {response.proposed_price} ₽" if response.proposed_price else ""),
            task_id=task_id
        ))
        customer = db.query(User).filter(User.id == task.customer_id).first()
        if customer:
            queue_email(
                background, customer.email, "ДЕЛО — новый отклик на ваш заказ",
                f"Здравствуйте!\n\n{specialist.name or specialist.email} откликнулся на ваш заказ «{task.title}»."
                + (f"\nПредложенная цена: {response.proposed_price} ₽" if response.proposed_price else "")
                + f"\n\nОткрыть отклики: {os.environ.get('FRONTEND_URL', 'https://delo-jhcy.onrender.com')}/task/{task_id}"
            )

            # Telegram уведомление
            if customer.telegram_chat_id:
                try:
                    settings = json.loads(customer.notification_settings) if customer.notification_settings else {}
                    if settings.get("new_response", True):
                        from telegram_bot import notify_new_response
                        notify_new_response(
                            customer.telegram_chat_id,
                            task.title,
                            specialist.name or specialist.email,
                            task_id
                        )
                except Exception as e:
                    print(f"Ошибка отправки Telegram: {e}")
    db.commit()
    if not specialist.is_pro:
        db.commit()  # фиксируем списание отклика
    return {"message": "Отклик отправлен", "credits_left": None if specialist.is_pro else specialist.response_credits}

@app.get("/tasks/{task_id}/responses")
def get_task_responses(
    task_id: int,
    sort_by: Optional[str] = None,  # "price_asc", "price_desc", "rating", "pro"
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    only_pro: bool = False,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_token_or_401(token)
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")

    responses = db.query(Response).filter(Response.task_id == task_id).all()
    result = []
    prices = []

    for r in responses:
        spec = db.query(User).filter(User.id == r.specialist_id).first()
        rating = None
        completed_tasks = 0
        if spec:
            reviews = db.query(Review).filter(Review.specialist_id == spec.id).all()
            if reviews:
                rating = round(sum(rev.rating for rev in reviews) / len(reviews), 1)
            completed_tasks = db.query(Task).filter(
                Task.executor_id == spec.id,
                Task.status == TaskStatus.completed
            ).count()

        # Фильтры
        if only_pro and (not spec or not spec.is_pro):
            continue
        if min_price is not None and (r.proposed_price is None or r.proposed_price < min_price):
            continue
        if max_price is not None and (r.proposed_price is None or r.proposed_price > max_price):
            continue

        portfolio_items = []
        if r.portfolio_items:
            try:
                portfolio_items = json.loads(r.portfolio_items)
            except:
                portfolio_items = []

        if r.proposed_price is not None:
            prices.append(r.proposed_price)

        result.append({
            "id": r.id,
            "text": r.text,
            "specialist_id": r.specialist_id,
            "specialist_name": spec.name if spec else "Аноним",
            "specialist_email": spec.email if spec else "",
            "specialist_rating": rating,
            "specialist_completed_tasks": completed_tasks,
            "specialist_verified": spec.verified if spec else False,
            "specialist_city": spec.city if spec else None,
            "specialist_online": user_online(spec) if spec else False,
            "specialist_pro": spec.is_pro if spec else False,
            "specialist_avatar": spec.avatar if spec else None,
            "proposed_price": r.proposed_price,
            "estimated_days": r.estimated_days,
            "portfolio_items": portfolio_items,
            "created_at": r.created_at or datetime.utcnow().isoformat()
        })

    # Сортировка
    if sort_by == "price_asc":
        result.sort(key=lambda x: x["proposed_price"] if x["proposed_price"] is not None else float('inf'))
    elif sort_by == "price_desc":
        result.sort(key=lambda x: x["proposed_price"] if x["proposed_price"] is not None else float('-inf'), reverse=True)
    elif sort_by == "rating":
        result.sort(key=lambda x: x["specialist_rating"] if x["specialist_rating"] is not None else 0, reverse=True)
    else:
        # По умолчанию: PRO первыми, затем по рейтингу
        result.sort(key=lambda x: (not x["specialist_pro"], -(x["specialist_rating"] or 0)))

    # Средняя цена откликов
    avg_price = round(sum(prices) / len(prices)) if prices else None

    return {
        "responses": result,
        "total": len(result),
        "avg_price": avg_price
    }

@app.post("/tasks/{task_id}/review")
def create_review(task_id: int, review: ReviewCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    role = payload.get("role")

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")

    if task.status != TaskStatus.completed:
        raise HTTPException(400, "Можно оставлять отзывы только на завершенные заказы")

    # Взаимные отзывы: заказчик оценивает исполнителя, исполнитель — заказчика
    if role == "customer" and task.customer_id == user_id:
        if not task.executor_id:
            raise HTTPException(400, "У заказа нет исполнителя")
        reviewee_id, target = task.executor_id, "specialist"
    elif role == "specialist" and task.executor_id == user_id:
        reviewee_id, target = task.customer_id, "customer"
    else:
        raise HTTPException(403, "Отзыв доступен только участникам заказа")

    existing = db.query(Review).filter(Review.task_id == task_id, Review.reviewer_id == user_id).first()
    if existing:
        raise HTTPException(400, "Вы уже оставили отзыв на этот заказ")

    new_review = Review(
        task_id=task_id,
        reviewer_id=user_id,
        specialist_id=reviewee_id,
        rating=review.rating,
        comment=review.comment,
        target=target
    )
    db.add(new_review)
    db.commit()

    # Telegram уведомление получателю отзыва
    reviewee = db.query(User).filter(User.id == reviewee_id).first()
    if reviewee and reviewee.telegram_chat_id:
        try:
            settings = json.loads(reviewee.notification_settings) if reviewee.notification_settings else {}
            if settings.get("new_review", True):
                reviewer = db.query(User).filter(User.id == user_id).first()
                from telegram_bot import notify_new_review
                notify_new_review(
                    reviewee.telegram_chat_id,
                    review.rating,
                    review.comment or "",
                    reviewer.name or reviewer.email if reviewer else "Пользователь"
                )
        except Exception as e:
            print(f"Ошибка отправки Telegram: {e}")

    return {"message": "Отзыв успешно добавлен"}

@app.websocket("/ws/tasks/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: int, db: Session = Depends(get_db), token: Optional[str] = None):
    already_accepted = False
    if not token:
        # Preferred auth: first message {"type": "auth", "token": "..."} — keeps the token out of URLs and logs
        await websocket.accept()
        already_accepted = True
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            data = json.loads(raw)
            token = data.get("token")
        except Exception:
            token = None
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_token_or_401(token)
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = int(payload.get("sub"))
    role = payload.get("role")

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        db.close()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if role == "customer" and task.customer_id != user_id:
        db.close()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if role == "specialist" and task.executor_id != user_id:
        db.close()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db.close()

    await manager.connect(websocket, task_id, already_accepted)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)

@app.get("/tasks/{task_id}/messages")
def get_messages(task_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    role = payload.get("role")

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")

    if role == "customer" and task.customer_id != user_id:
        raise HTTPException(403, "Нет доступа")
    if role == "specialist" and task.executor_id != user_id:
        raise HTTPException(403, "Нет доступа")

    messages = db.query(Message).filter(Message.task_id == task_id).order_by(Message.id).all()
    result = []
    for m in messages:
        sender = db.query(User).filter(User.id == m.sender_id).first()
        result.append({
            "id": m.id,
            "task_id": m.task_id,
            "sender_id": m.sender_id,
            "text": m.text,
            "created_at": m.created_at,
            "sender_name": sender.name or sender.email if sender else "Unknown"
        })
    # Открыл историю => всё до последнего сообщения прочитано
    if messages:
        _set_chat_read(db, user_id, task_id, messages[-1].id)
    return result

@app.post("/tasks/{task_id}/messages")
async def post_message(task_id: int, message: MessageCreate, background: BackgroundTasks, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    role = payload.get("role")

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")

    if role == "customer" and task.customer_id != user_id:
        raise HTTPException(403, "Нет доступа")
    if role == "specialist" and task.executor_id != user_id:
        raise HTTPException(403, "Нет доступа")

    new_message = Message(task_id=task_id, sender_id=user_id, text=message.text)
    db.add(new_message)
    db.commit()

    # Отправитель прочитал свой же чат по определению — сдвигаем его отметку
    _set_chat_read(db, user_id, task_id, new_message.id)

    # Notify the other party about new message
    sender = db.query(User).filter(User.id == user_id).first()
    recipient_id = task.executor_id if role == "customer" else task.customer_id
    if recipient_id:
        db.add(Notification(
            user_id=recipient_id,
            type="message",
            title="Новое сообщение",
            text=f"{sender.name or sender.email}: {message.text[:60]}{'...' if len(message.text) > 60 else ''}",
            task_id=task_id
        ))
        db.commit()
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if recipient:
            queue_email(
                background, recipient.email, "ДЕЛО — новое сообщение по заказу",
                f"Здравствуйте!\n\n{sender.name or sender.email} написал(а) вам по заказу «{task.title}»:\n\n"
                f"{message.text[:300]}\n\n"
                f"Ответить: {os.environ.get('FRONTEND_URL', 'https://delo-jhcy.onrender.com')}/task/{task_id}"
            )

            # Telegram уведомление получателю
            if recipient.telegram_chat_id:
                try:
                    settings = json.loads(recipient.notification_settings) if recipient.notification_settings else {}
                    if settings.get("new_message", True):
                        from telegram_bot import notify_new_message
                        notify_new_message(
                            recipient.telegram_chat_id,
                            task.title,
                            sender.name or sender.email,
                            message.text,
                            task_id
                        )
                except Exception as e:
                    print(f"Ошибка отправки Telegram: {e}")

    sender = db.query(User).filter(User.id == user_id).first()
    message_dict = {
        "id": new_message.id,
        "task_id": task_id,
        "sender_id": user_id,
        "text": message.text,
        "created_at": new_message.created_at,
        "sender_name": sender.name or sender.email if sender else "Unknown"
    }

    await manager.broadcast(message_dict, task_id)
    return message_dict

@app.get("/chats/unread")
def chats_unread(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Счётчики непрочитанных сообщений по каждому чату текущего пользователя."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    # Задачи, где пользователь — участник (заказчик или исполнитель)
    tasks = db.query(Task).filter(
        (Task.customer_id == user_id) | (Task.executor_id == user_id)
    ).all()
    reads = {
        cr.task_id: (cr.last_read_message_id or 0)
        for cr in db.query(ChatRead).filter(ChatRead.user_id == user_id).all()
    }
    by_task = {}
    total = 0
    for t in tasks:
        last_read = reads.get(t.id, 0)
        # Непрочитанные = чужие сообщения новее отметки прочтения
        cnt = db.query(Message).filter(
            Message.task_id == t.id,
            Message.id > last_read,
            Message.sender_id != user_id
        ).count()
        if cnt:
            by_task[t.id] = cnt
            total += cnt
    return {"total": total, "by_task": by_task}

@app.post("/tasks/{task_id}/chat/read")
def mark_chat_read(task_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Помечает чат прочитанным до последнего сообщения (участник заказа)."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    role = payload.get("role")
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Заказ не найден")
    if role == "customer" and task.customer_id != user_id:
        raise HTTPException(403, "Нет доступа")
    if role == "specialist" and task.executor_id != user_id:
        raise HTTPException(403, "Нет доступа")
    last = db.query(Message).filter(Message.task_id == task_id).order_by(Message.id.desc()).first()
    if last:
        _set_chat_read(db, user_id, task_id, last.id)
    return {"message": "OK"}

def public_file_url(request: Request, file_path: str) -> str:
    """Полный URL файла по фактическому адресу бэкенда (работает и локально, и на Render)"""
    return f"{str(request.base_url).rstrip('/')}/{file_path}"

def save_file_to_db(db: Session, file: UploadFile) -> int:
    """Сохраняет изображение в базу и возвращает его id (файлы переживают перезапуск контейнера)"""
    safe_ctype = validate_image(file)  # content-type определяется по содержимому, не по заголовку клиента
    data = file.file.read()
    stored = StoredFile(
        filename=file.filename or "image",
        content_type=safe_ctype,
        data=data
    )
    db.add(stored)
    db.commit()
    return stored.id

@app.get("/files/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db)):
    stored = db.query(StoredFile).filter(StoredFile.id == file_id).first()
    if not stored:
        raise HTTPException(404, "Файл не найден")
    # nosniff + attachment-safe: не даём браузеру интерпретировать файл как HTML/скрипт
    return FastResponse(
        content=stored.data,
        media_type=stored.content_type,
        headers={"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'"}
    )

@app.post("/upload/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Upload user avatar"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))

    user = db.query(User).filter(User.id == user_id).first()
    file_id = save_file_to_db(db, file)
    url = public_file_url(request, f"files/{file_id}")
    user.avatar = url
    db.commit()

    return {"message": "Avatar uploaded", "url": url}

@app.post("/upload/portfolio")
async def upload_portfolio(request: Request, file: UploadFile = File(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Upload portfolio image for specialist"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))

    user = db.query(User).filter(User.id == user_id).first()
    if "specialist" not in get_user_roles(user):
        raise HTTPException(403, "Only specialists can upload portfolio")

    file_id = save_file_to_db(db, file)
    url = public_file_url(request, f"files/{file_id}")

    # Add to portfolio JSON array
    import json as json_lib
    portfolio = json_lib.loads(user.portfolio) if user.portfolio else []
    portfolio.append(url)
    user.portfolio = json_lib.dumps(portfolio)
    db.commit()

    return {"message": "Portfolio image uploaded", "url": url}

@app.post("/upload/task-image")
async def upload_task_image(request: Request, file: UploadFile = File(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Upload task image (returns URL to include in task creation)"""
    payload = decode_token_or_401(token)

    file_id = save_file_to_db(db, file)
    return {"message": "Task image uploaded", "url": public_file_url(request, f"files/{file_id}")}

def decode_token_or_401(token: str):
    """Декодирует JWT; при истёкшем/невалидном токене возвращает 401 вместо 500"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Сессия истекла, войдите снова")

@app.get("/notifications")
def get_notifications(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get all notifications for current user"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    notifications = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.id.desc()).limit(50).all()
    return notifications

@app.get("/notifications/unread-count")
def get_unread_count(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get count of unread notifications"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()
    return {"count": count}

@app.put("/notifications/read-all")
def mark_all_read(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Mark all notifications as read"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "Все уведомления прочитаны"}

@app.put("/notifications/{notification_id}/read")
def mark_read(notification_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Mark single notification as read"""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"message": "OK"}

@app.get("/cities")
def get_cities():
    """Get list of popular cities"""
    return [
        "Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург",
        "Казань", "Нижний Новгород", "Челябинск", "Самара",
        "Омск", "Ростов-на-Дону", "Уфа", "Красноярск",
        "Воронеж", "Пермь", "Волгоград", "Краснодар"
    ]

# ==================== ВЕТКА «ТОВАРЫ» ====================

def _enum_val(v):
    return v.value if hasattr(v, "value") else v

def serialize_product(p: Product, db: Session, include_seller: bool = True) -> dict:
    data = {
        "id": p.id,
        "seller_id": p.seller_id,
        "title": p.title,
        "description": p.description,
        "price": p.price,
        "category": _enum_val(p.category),
        "condition": _enum_val(p.condition),
        "images": p.images,
        "specs": p.specs,
        "stock": p.stock,
        "city": p.city,
        "status": _enum_val(p.status),
        "views": p.views,
        "created_at": p.created_at,
    }
    if include_seller:
        seller = db.query(User).filter(User.id == p.seller_id).first()
        data["seller_name"] = (seller.name if seller and seller.name else "Продавец") if seller else "Продавец"
        data["seller_avatar"] = seller.avatar if seller else None
        # Рейтинг продавца по отзывам о его товарах
        prod_ids = [row[0] for row in db.query(Product.id).filter(Product.seller_id == p.seller_id).all()]
        if prod_ids:
            revs = db.query(ProductReview).filter(ProductReview.product_id.in_(prod_ids)).all()
            data["seller_rating"] = round(sum(r.rating for r in revs) / len(revs), 1) if revs else None
            data["seller_reviews_count"] = len(revs)
        else:
            data["seller_rating"] = None
            data["seller_reviews_count"] = 0
    return data

@app.get("/products")
def list_products(
    category: Optional[ProductCategory] = None,
    city: Optional[str] = None,
    condition: Optional[ProductCondition] = None,
    search: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    sort: str = "new",  # new | price_asc | price_desc | popular
    seller_id: Optional[int] = None,
    limit: int = 24,
    offset: int = 0,
    response: FastResponse = None,
    db: Session = Depends(get_db),
):
    """Каталог товаров с фильтрами. По умолчанию только активные."""
    query = db.query(Product).filter(Product.status == ProductStatus.active)
    if seller_id is not None:
        # Для витрины конкретного продавца показываем только активные (управление — отдельный эндпоинт)
        query = query.filter(Product.seller_id == seller_id)
    if category:
        query = query.filter(Product.category == category)
    if city:
        query = query.filter(Product.city == city)
    if condition:
        query = query.filter(Product.condition == condition)
    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)
    if search:
        like = f"%{search}%"
        query = query.filter((Product.title.ilike(like)) | (Product.description.ilike(like)))

    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "popular":
        query = query.order_by(Product.views.desc())
    else:
        query = query.order_by(Product.id.desc())

    total = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    limit = max(1, min(limit, 60))
    offset = max(0, offset)
    products = query.offset(offset).limit(limit).all()
    return [serialize_product(p, db) for p in products]

@app.get("/products/cities")
def product_cities(db: Session = Depends(get_db)):
    """Города из активных товаров — для фильтра каталога."""
    rows = db.query(Product.city).filter(
        Product.city.isnot(None), Product.city != "", Product.status == ProductStatus.active
    ).distinct().all()
    cities = sorted({r[0].strip() for r in rows if r[0] and r[0].strip()})
    return {"cities": cities}

@app.get("/products/mine")
def my_products(status: Optional[ProductStatus] = None, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Мои товары (для продавца) — все статусы или конкретный."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    query = db.query(Product).filter(Product.seller_id == user_id)
    if status:
        query = query.filter(Product.status == status)
    products = query.order_by(Product.id.desc()).all()
    return [serialize_product(p, db, include_seller=False) for p in products]

@app.get("/products/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    # Счётчик просмотров (грубо: +1 за каждый заход в карточку)
    p.views = (p.views or 0) + 1
    db.commit()
    return serialize_product(p, db)

@app.post("/products")
def create_product(product: ProductCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Создать товар. Доступно любому авторизованному пользователю (продавцом может быть каждый)."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = Product(
        seller_id=user_id,
        title=product.title,
        description=product.description,
        price=product.price,
        category=product.category,
        condition=product.condition,
        images=product.images,
        specs=product.specs,
        stock=product.stock,
        city=product.city,
        status=product.status,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize_product(p, db, include_seller=False)

@app.put("/products/{product_id}")
def update_product(product_id: int, upd: ProductUpdate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    if p.seller_id != user_id:
        raise HTTPException(403, "Это не ваш товар")
    for field in ("title", "description", "price", "category", "condition", "images", "specs", "stock", "city", "status"):
        val = getattr(upd, field)
        if val is not None:
            setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return serialize_product(p, db, include_seller=False)

@app.delete("/products/{product_id}")
def delete_product(product_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    if p.seller_id != user_id:
        raise HTTPException(403, "Это не ваш товар")
    db.delete(p)
    db.commit()
    return {"message": "Товар удалён"}

# ---- Избранное ----

@app.get("/products/favorites/mine")
def my_favorites(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    fav_ids = [f.product_id for f in db.query(ProductFavorite).filter(ProductFavorite.user_id == user_id).all()]
    if not fav_ids:
        return []
    products = db.query(Product).filter(Product.id.in_(fav_ids)).all()
    return [serialize_product(p, db) for p in products]

@app.post("/products/{product_id}/favorite")
def toggle_favorite(product_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Переключить избранное. Возвращает текущее состояние."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    existing = db.query(ProductFavorite).filter(
        ProductFavorite.user_id == user_id, ProductFavorite.product_id == product_id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False}
    db.add(ProductFavorite(user_id=user_id, product_id=product_id))
    db.commit()
    return {"favorited": True}

# ---- Заказы товаров ----

@app.post("/products/{product_id}/order")
def create_product_order(product_id: int, order: ProductOrderCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    if p.status != ProductStatus.active:
        raise HTTPException(400, "Товар недоступен для заказа")
    if p.seller_id == user_id:
        raise HTTPException(400, "Нельзя купить собственный товар")
    if order.quantity > (p.stock or 0):
        raise HTTPException(400, f"Недостаточно на складе. Доступно: {p.stock}")

    total = p.price * order.quantity
    po = ProductOrder(
        buyer_id=user_id,
        seller_id=p.seller_id,
        product_id=p.id,
        quantity=order.quantity,
        total_price=total,
        status=OrderStatus.pending,
        delivery_address=order.delivery_address,
        contact_phone=order.contact_phone,
        comment=order.comment,
    )
    db.add(po)
    # Уменьшаем остаток; если закончился — помечаем sold
    p.stock = (p.stock or 0) - order.quantity
    if p.stock <= 0:
        p.status = ProductStatus.sold
    db.commit()
    db.refresh(po)

    # Уведомление продавцу
    db.add(Notification(
        user_id=p.seller_id,
        type="product_order",
        title="Новый заказ товара",
        text=f"Заказ на «{p.title}» × {order.quantity}",
    ))
    db.commit()
    return {"id": po.id, "message": "Заказ оформлен", "total_price": total}

def _serialize_product_order(po: ProductOrder, db: Session, side: str) -> dict:
    product = db.query(Product).filter(Product.id == po.product_id).first()
    counter_id = po.seller_id if side == "buyer" else po.buyer_id
    counter = db.query(User).filter(User.id == counter_id).first()
    return {
        "id": po.id,
        "product_id": po.product_id,
        "product_title": product.title if product else "Товар удалён",
        "product_image": (json.loads(product.images)[0] if product and product.images and json.loads(product.images) else None),
        "quantity": po.quantity,
        "total_price": po.total_price,
        "status": _enum_val(po.status),
        "delivery_address": po.delivery_address,
        "contact_phone": po.contact_phone,
        "comment": po.comment,
        "created_at": po.created_at,
        "counterparty_name": (counter.name if counter and counter.name else "Пользователь") if counter else "Пользователь",
        "counterparty_id": counter_id,
    }

@app.get("/product-orders/purchases")
def my_purchases(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Мои покупки (я — покупатель)."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    orders = db.query(ProductOrder).filter(ProductOrder.buyer_id == user_id).order_by(ProductOrder.id.desc()).all()
    return [_serialize_product_order(o, db, "buyer") for o in orders]

@app.get("/product-orders/sales")
def my_sales(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Мои продажи (я — продавец)."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    orders = db.query(ProductOrder).filter(ProductOrder.seller_id == user_id).order_by(ProductOrder.id.desc()).all()
    return [_serialize_product_order(o, db, "seller") for o in orders]

@app.put("/product-orders/{order_id}/status")
def update_order_status(order_id: int, new_status: OrderStatus, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Смена статуса заказа. Продавец: confirmed/shipped/cancelled. Покупатель: delivered/cancelled."""
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    po = db.query(ProductOrder).filter(ProductOrder.id == order_id).first()
    if not po:
        raise HTTPException(404, "Заказ не найден")

    seller_allowed = {OrderStatus.confirmed, OrderStatus.shipped, OrderStatus.cancelled}
    buyer_allowed = {OrderStatus.delivered, OrderStatus.cancelled}
    if user_id == po.seller_id and new_status in seller_allowed:
        pass
    elif user_id == po.buyer_id and new_status in buyer_allowed:
        pass
    else:
        raise HTTPException(403, "Недопустимая смена статуса")

    # Если заказ отменён — возвращаем товар на склад
    if new_status == OrderStatus.cancelled and po.status != OrderStatus.cancelled:
        product = db.query(Product).filter(Product.id == po.product_id).first()
        if product:
            product.stock = (product.stock or 0) + po.quantity
            if product.status == ProductStatus.sold and product.stock > 0:
                product.status = ProductStatus.active

    po.status = new_status
    db.commit()

    # Уведомление второй стороне
    notify_id = po.buyer_id if user_id == po.seller_id else po.seller_id
    status_labels = {
        "confirmed": "подтверждён", "shipped": "отправлен",
        "delivered": "получен", "cancelled": "отменён",
    }
    db.add(Notification(
        user_id=notify_id,
        type="product_order_status",
        title="Статус заказа изменён",
        text=f"Заказ #{po.id}: {status_labels.get(_enum_val(new_status), _enum_val(new_status))}",
    ))
    db.commit()
    return {"message": "Статус обновлён", "status": _enum_val(new_status)}

# ---- Отзывы о товарах ----

@app.get("/products/{product_id}/reviews")
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    reviews = db.query(ProductReview).filter(
        ProductReview.product_id == product_id
    ).order_by(ProductReview.id.desc()).all()
    result = []
    for r in reviews:
        author = db.query(User).filter(User.id == r.author_id).first()
        result.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "author_name": (author.name if author and author.name else "Покупатель") if author else "Покупатель",
            "author_id": r.author_id,
            "created_at": r.created_at,
        })
    return result

@app.post("/products/{product_id}/reviews")
def create_product_review(product_id: int, review: ProductReviewCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token_or_401(token)
    user_id = int(payload.get("sub"))
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(404, "Товар не найден")
    if p.seller_id == user_id:
        raise HTTPException(400, "Нельзя оставить отзыв на свой товар")
    # Отзыв можно оставить только по доставленному заказу
    order = db.query(ProductOrder).filter(
        ProductOrder.product_id == product_id,
        ProductOrder.buyer_id == user_id,
        ProductOrder.status == OrderStatus.delivered,
    ).first()
    if not order:
        raise HTTPException(403, "Отзыв доступен только после получения заказа")
    existing = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.author_id == user_id,
    ).first()
    if existing:
        raise HTTPException(400, "Вы уже оставили отзыв на этот товар")
    pr = ProductReview(
        product_id=product_id,
        author_id=user_id,
        order_id=order.id,
        rating=review.rating,
        comment=review.comment,
    )
    db.add(pr)
    db.commit()
    return {"message": "Отзыв добавлен"}
