export const CATEGORIES = [
    { value: 'design', label: '🎨 Дизайн' },
    { value: 'development', label: '💻 Разработка' },
    { value: 'writing', label: '✍️ Тексты' },
    { value: 'repairs', label: '🔧 Ремонт' },
    { value: 'cleaning', label: '🧹 Уборка' },
    { value: 'delivery', label: '🚚 Доставка' },
    { value: 'photo_video', label: '📷 Фото/Видео' },
    { value: 'tutoring', label: '📚 Репетиторство' },
    { value: 'beauty', label: '💄 Красота' },
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
