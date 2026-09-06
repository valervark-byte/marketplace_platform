import React, { useEffect, useRef, useState } from 'react';
import { getCityCoords } from '../lib/cityCoords';

const YANDEX_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';
const MOSCOW_CENTER = [55.7558, 37.6173]; // Москва центр (fallback)

// Экранирование пользовательского ввода перед вставкой в HTML балуна.
// Без него заголовок/описание заказа с <img onerror=...> дают stored XSS.
const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Единый загрузчик скрипта Яндекс.Карт: и TaskMap, и LocationPicker дёргают его,
// без общего промиса в DOM попадали два тега <script>.
let _ymapsPromise = null;
const loadYmaps = () => {
    if (window.ymaps && window.ymaps.ready) {
        return new Promise((resolve) => window.ymaps.ready(resolve));
    }
    if (!_ymapsPromise) {
        _ymapsPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_API_KEY}&lang=ru_RU`;
            script.async = true;
            script.onload = () => window.ymaps.ready(resolve);
            script.onerror = () => { _ymapsPromise = null; reject(new Error('Не удалось загрузить Яндекс.Карты')); };
            document.head.appendChild(script);
        });
    }
    return _ymapsPromise;
};

export const TaskMap = ({ tasks, onTaskClick, selectedTaskId, city }) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markers = useRef([]);
    const clickHandler = useRef(onTaskClick);
    const [mapReady, setMapReady] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // Держим актуальный колбэк без пересоздания карты
    useEffect(() => { clickHandler.current = onTaskClick; }, [onTaskClick]);

    useEffect(() => {
        let unmounted = false;
        loadYmaps()
            .then(() => { if (!unmounted) initMap(); })
            .catch((e) => console.error(e));

        return () => {
            unmounted = true;
            if (mapInstance.current) {
                mapInstance.current.destroy();
                mapInstance.current = null;
            }
        };
    }, []);

    const initMap = () => {
        if (!mapRef.current || mapInstance.current) return;

        // Определяем начальный центр: город из фильтра → геолокация → Москва
        let initialCenter = MOSCOW_CENTER;
        if (city) {
            const coords = getCityCoords(city);
            if (coords) initialCenter = coords;
        }

        mapInstance.current = new window.ymaps.Map(mapRef.current, {
            center: initialCenter,
            zoom: 11,
            controls: ['zoomControl', 'fullscreenControl']
        });

        setMapReady(true);
    };

    // Центрировать карту на геолокацию пользователя
    const centerOnUserLocation = () => {
        if (!mapInstance.current) return;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = [position.coords.latitude, position.coords.longitude];
                    setUserLocation(coords);
                    mapInstance.current.setCenter(coords, 13, { duration: 500 });
                },
                (error) => {
                    console.error('Ошибка геолокации:', error);
                    alert('Не удалось определить вашу геопозицию. Проверьте разрешения браузера.');
                }
            );
        } else {
            alert('Геолокация не поддерживается вашим браузером.');
        }
    };

    useEffect(() => {
        if (!mapReady || !mapInstance.current) return;

        // Clear old markers
        markers.current.forEach(marker => {
            mapInstance.current.geoObjects.remove(marker);
        });
        markers.current = [];

        // Add markers for tasks with location
        const tasksWithLocation = tasks.filter(t =>
            t.latitude && t.longitude && !t.is_remote
        );

        if (tasksWithLocation.length === 0) {
            // No tasks with location, stay centered on Moscow
            return;
        }

        tasksWithLocation.forEach(task => {
            const desc = task.description || '';
            const descShort = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
            const budgetText = (task.budget || task.budget === 0)
                ? `${escapeHtml(task.budget)} ₽`
                : 'Бюджет не указан';
            const placemark = new window.ymaps.Placemark(
                [task.latitude, task.longitude],
                {
                    // Все пользовательские значения экранируются — балун рендерит HTML
                    balloonContentHeader: escapeHtml(task.title),
                    balloonContentBody: `
                        <div style="max-width: 250px;">
                            <p style="margin: 8px 0; color: #059669; font-weight: bold; font-size: 16px;">
                                ${budgetText}
                            </p>
                            <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
                                ${escapeHtml(descShort)}
                            </p>
                            <button
                                data-task-btn="${escapeHtml(task.id)}"
                                style="
                                    background: #2563eb;
                                    color: white;
                                    padding: 8px 16px;
                                    border: none;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-weight: 500;
                                    margin-top: 8px;
                                "
                            >
                                Подробнее
                            </button>
                        </div>
                    `,
                    balloonContentFooter: escapeHtml(task.city)
                },
                {
                    preset: task.id === selectedTaskId
                        ? 'islands#greenDotIcon'
                        : 'islands#blueDotIcon',
                    iconColor: task.status === 'open' ? '#2563eb' : '#6b7280'
                }
            );

            // Кнопку «Подробнее» вешаем через DOM-listener после открытия балуна,
            // без глобального window.openTaskFromMap и без inline onclick
            placemark.events.add('balloonopen', () => {
                setTimeout(() => {
                    const btn = document.querySelector(`[data-task-btn="${task.id}"]`);
                    if (btn && !btn.dataset.bound) {
                        btn.dataset.bound = '1';
                        btn.addEventListener('click', () => {
                            if (clickHandler.current) clickHandler.current(task.id);
                        });
                    }
                }, 0);
            });

            markers.current.push(placemark);
            mapInstance.current.geoObjects.add(placemark);
        });

        // Fit bounds to show all markers
        if (tasksWithLocation.length > 0) {
            const bounds = mapInstance.current.geoObjects.getBounds();
            if (bounds) {
                mapInstance.current.setBounds(bounds, {
                    checkZoomRange: true,
                    zoomMargin: 50
                });
            }
        }

    }, [tasks, mapReady, selectedTaskId]);

    // При смене города центрировать карту
    useEffect(() => {
        if (!mapReady || !mapInstance.current || !city) return;
        const coords = getCityCoords(city);
        if (coords) {
            mapInstance.current.setCenter(coords, 11, { duration: 500 });
        }
    }, [city, mapReady]);

    return (
        <div className="w-full h-full relative">
            <div ref={mapRef} className="w-full h-full overflow-hidden" />
            {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface rounded-xl">
                    <div className="text-center">
                        <div className="text-4xl mb-2 animate-pulse">🗺️</div>
                        <p className="text-muted">Загрузка карты...</p>
                    </div>
                </div>
            )}
            {mapReady && (
                <button
                    onClick={centerOnUserLocation}
                    className="absolute top-4 right-4 z-10 bg-surface border border-border rounded-xl px-4 py-2.5 font-bold text-sm shadow-card hover:border-accent transition flex items-center gap-2"
                    title="Показать мою геопозицию"
                >
                    📍 Моё местоположение
                </button>
            )}
        </div>
    );
};

export const LocationPicker = ({ initialLocation, onLocationSelect, city = 'Москва' }) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const marker = useRef(null);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        let unmounted = false;
        loadYmaps()
            .then(() => { if (!unmounted) initMap(); })
            .catch((e) => console.error(e));

        return () => {
            unmounted = true;
            if (mapInstance.current) {
                mapInstance.current.destroy();
                mapInstance.current = null;
            }
        };
    }, []);

    const initMap = () => {
        if (!mapRef.current || mapInstance.current) return;

        // Центр: переданная локация → координаты города → Москва
        let center = initialLocation;
        if (!center) {
            const cityCoords = getCityCoords(city);
            center = cityCoords || MOSCOW_CENTER;
        }

        mapInstance.current = new window.ymaps.Map(mapRef.current, {
            center,
            zoom: 13,
            controls: ['zoomControl', 'geolocationControl']
        });

        // Click to set location
        mapInstance.current.events.add('click', (e) => {
            const coords = e.get('coords');
            setMarker(coords);
            if (onLocationSelect) {
                onLocationSelect(coords);
            }
        });

        if (initialLocation) {
            setMarker(initialLocation);
        }

        setMapReady(true);
    };

    const setMarker = (coords) => {
        if (marker.current) {
            mapInstance.current.geoObjects.remove(marker.current);
        }

        marker.current = new window.ymaps.Placemark(coords, {
            balloonContent: 'Место выполнения задачи'
        }, {
            preset: 'islands#redDotIcon',
            draggable: true
        });

        marker.current.events.add('dragend', () => {
            const newCoords = marker.current.geometry.getCoordinates();
            if (onLocationSelect) {
                onLocationSelect(newCoords);
            }
        });

        mapInstance.current.geoObjects.add(marker.current);
    };

    return (
        <div className="w-full h-64 relative">
            <div ref={mapRef} className="w-full h-full overflow-hidden rounded-xl" />
            {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface rounded-xl">
                    <p className="text-muted">Загрузка карты...</p>
                </div>
            )}
            <p className="text-xs text-muted mt-1">Кликните на карту, чтобы указать место выполнения</p>
        </div>
    );
};
