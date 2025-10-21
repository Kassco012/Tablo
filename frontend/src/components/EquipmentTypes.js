export const EQUIPMENT_TYPES = {
    drill: { value: 'drill', label: 'Буровой станок' },
    dozer: { value: 'dozer', label: 'Бульдозер' },
    shovel: { value: 'shovel', label: 'Экскаватор' },
    grader: { value: 'grader', label: 'Грейдер' },
    truck: { value: 'truck', label: 'Самосвал' },
    loader: { value: 'loader', label: 'Погрузчик' },
    watertruck: { value: 'watertruck', label: 'Водовоз' }, 
    auxequipment: { value: 'auxequipment', label: 'Вспомогательное оборудование' }
};

// ✅ РАСШИРЕННЫЙ маппинг: английские коды → внутренние коды
const TYPE_MAP = {
    // Английские коды из MSSQL
    'Drill': 'drill',
    'Dozer': 'dozer',
    'Shovel': 'shovel',
    'Grader': 'grader',
    'Truck': 'truck',
    'Loader': 'loader',
    'WaterTruck': 'watertruck',
    'AuxEquipment': 'auxequipment',
    'AuxE': 'auxequipment',

    // ✅ НОВОЕ: Русские названия из БД → внутренние коды
    'Буровой станок': 'drill',
    'Бульдозер': 'dozer',
    'Экскаватор': 'shovel',
    'Грейдер': 'grader',
    'Самосвал': 'truck',
    'Погрузчик': 'loader',
    'Водовоз': 'watertruck',
    'Поливочная машина': 'watertruck',
    'Вспомогательное оборудование': 'auxequipment',
    'Техника': 'auxequipment',

    // ✅ НОВОЕ: Обработка "Неизвестный тип"
    'Неизвестный тип': null,
    'неизвестный тип': null,
    'Unknown': null,
    'unknown': null
};

// ✅ УЛУЧШЕННАЯ функция получения текста типа
export const getEquipmentTypeText = (type) => {
    // Если тип пустой или null
    if (!type) return '❓ Тип не указан';

    // Нормализуем: убираем пробелы и приводим к нижнему регистру
    const normalizedType = type.toString().trim();

    // Проверяем маппинг (с учетом регистра)
    const mappedType = TYPE_MAP[normalizedType] || TYPE_MAP[normalizedType.toLowerCase()];

    // Если нашли маппинг
    if (mappedType) {
        const equipmentType = EQUIPMENT_TYPES[mappedType];
        return equipmentType ? equipmentType.label : '❓ Тип не указан';
    }

    // Если маппинг вернул null (Неизвестный тип)
    if (mappedType === null) {
        return '❓ Тип не указан';
    }

    // Пробуем найти напрямую в EQUIPMENT_TYPES
    const directMatch = EQUIPMENT_TYPES[normalizedType.toLowerCase()];
    if (directMatch) {
        return directMatch.label;
    }

    // Если ничего не нашли - показываем как есть, но с предупреждением
    console.warn(`⚠️ Неизвестный тип техники: "${type}"`);
    return ` ${type}`;
};

// ✅ Получение иконки (опционально)
export const getEquipmentTypeIcon = (type) => {
    if (!type) return '';

    const normalizedType = type.toString().trim();
    const mappedType = TYPE_MAP[normalizedType] || TYPE_MAP[normalizedType.toLowerCase()];

    const icons = {
        'drill': '',
        'dozer': '',
        'shovel': '',
        'grader': '',
        'truck': '',
        'loader': '',
        'watertruck': '',
        'auxequipment': ''
    };

    return icons[mappedType] || '';
};

// ✅ Получение опций для селектов
export const getEquipmentTypeOptions = () => {
    return Object.values(EQUIPMENT_TYPES).map(t => ({
        value: t.value,
        label: t.label,
        icon: getEquipmentTypeIcon(t.value)
    }));
};

// ✅ НОВАЯ функция: Получить внутренний код по любому входному значению
export const normalizeEquipmentType = (type) => {
    if (!type) return null;

    const normalizedType = type.toString().trim();
    const mappedType = TYPE_MAP[normalizedType] || TYPE_MAP[normalizedType.toLowerCase()];

    return mappedType || normalizedType.toLowerCase();
};