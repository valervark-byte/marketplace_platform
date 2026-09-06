import React, { useState } from 'react';
import { CITIES } from '../lib/constants';
import { inputCls } from '../lib/styles';

// Значение-маркер для пункта «Другой город» — включает ручной ввод.
const MANUAL = '__manual__';

// Выбор города из списка + возможность ввести свой вручную.
// value — итоговое строковое значение города; onChange(city) отдаёт готовую строку.
export const CitySelect = ({ value, onChange, placeholder = 'Выберите город' }) => {
    const [showManual, setShowManual] = useState(false);
    const inList = value && CITIES.includes(value);

    const handleSelect = (e) => {
        const v = e.target.value;
        if (v === MANUAL) {
            setShowManual(true);
            onChange(''); // переходим в ручной режим с пустым полем
        } else {
            setShowManual(false);
            onChange(v);
        }
    };

    // Показываем поле ввода, если явно выбрано "Другой город" или город не из списка
    const isManual = showManual || (!!value && !inList);

    return (
        <div className="flex flex-col gap-2">
            <select
                value={isManual ? MANUAL : (value || '')}
                onChange={handleSelect}
                className={inputCls}
            >
                <option value="">{placeholder}</option>
                {CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                ))}
                <option value={MANUAL}>✏️ Другой город (ввести вручную)</option>
            </select>

            {isManual && (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Введите название города"
                    autoFocus
                    className={inputCls}
                />
            )}
        </div>
    );
};

export default CitySelect;
