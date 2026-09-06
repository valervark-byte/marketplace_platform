export const CATEGORIES = [
    { value: 'design', label: '🎨 Дизайн' },
    { value: 'development', label: '⚡ Разработка' },
    { value: 'writing', label: '✍️ Тексты' },
    { value: 'repairs', label: '🔧 Ремонт' },
    { value: 'cleaning', label: '🧹 Уборка' },
    { value: 'delivery', label: '🚚 Доставка' },
    { value: 'photo_video', label: '📸 Фото/Видео' },
    { value: 'tutoring', label: '📚 Репетиторство' },
    { value: 'beauty', label: '💅 Красота' },
    { value: 'events', label: '🎉 Мероприятия' },
    { value: 'business', label: '💼 Бизнес' },
    { value: 'other', label: '📦 Другое' },
];

export const CITIES = [
    'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург',
    'Казань', 'Нижний Новгород', 'Челябинск', 'Самара',
    'Омск', 'Ростов-на-Дону', 'Уфа', 'Красноярск',
    'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
];

export const getCategoryLabel = (cat) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    return found ? found.label : cat;
};

// --- Товары ---
export const PRODUCT_CATEGORIES = [
    { value: 'electronics', label: '📱 Электроника' },
    { value: 'clothing', label: '👕 Одежда' },
    { value: 'home', label: '🏠 Для дома' },
    { value: 'beauty', label: '💄 Красота' },
    { value: 'kids', label: '🧸 Детям' },
    { value: 'sports', label: '⚽ Спорт' },
    { value: 'auto', label: '🚗 Авто' },
    { value: 'hobby', label: '🎨 Хобби' },
    { value: 'books', label: '📚 Книги' },
    { value: 'other', label: '📦 Другое' },
];

export const PRODUCT_CONDITIONS = [
    { value: 'new', label: 'Новый' },
    { value: 'used', label: 'Б/У' },
];

export const PRODUCT_STATUS_LABELS = {
    active: 'Активен',
    draft: 'Черновик',
    sold: 'Продан',
    archived: 'В архиве',
};

export const ORDER_STATUS_LABELS = {
    pending: 'Ожидает подтверждения',
    confirmed: 'Подтверждён',
    shipped: 'Отправлен',
    delivered: 'Получен',
    cancelled: 'Отменён',
};

export const getProductCategoryLabel = (cat) => {
    const found = PRODUCT_CATEGORIES.find((c) => c.value === cat);
    return found ? found.label : cat;
};
