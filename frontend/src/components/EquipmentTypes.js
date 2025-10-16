export const EQUIPMENT_TYPES = {
    drill: { value: 'drill', label: 'Буровая установка' },
    dozer: { value: 'dozer', label: 'Бульдозер' },
    shovel: { value: 'shovel', label: 'Экскаватор' },
    grader: { value: 'grader', label: 'Автогрейдер'},
    truck: { value: 'truck', label: 'Самосвал' },
    loader: { value: 'loader', label: 'Погрузчик' },
    watertruck: { value: 'watertruck', label: 'Водовоз' },
    auxequipment: { value: 'auxequipment', label: 'Вспомогательное оборудование' }
};

const TYPE_MAP = {
    'Drill': 'drill',
    'Dozer': 'dozer',
    'Shovel': 'shovel',
    'Grader': 'grader',
    'Truck': 'truck',
    'Loader': 'loader',
    'WaterTruck': 'watertruck',
    'AuxEquipment': 'auxequipment'
};

export const getEquipmentTypeText = (type) => {
    if (!type) return 'Неизвестный тип';
    const mappedType = TYPE_MAP[type] || type;
    const normalizedType = mappedType.toLowerCase().trim();
    const equipmentType = EQUIPMENT_TYPES[normalizedType];

    if (!equipmentType) {
        console.warn(`⚠️ Неизвестный тип: "${type}"`);
        return type;
    }

    return equipmentType.label;
};

export const getEquipmentTypeIcon = (type) => {
    if (!type) return '❓';
    const mappedType = TYPE_MAP[type] || type;
    const normalizedType = mappedType.toLowerCase().trim();
    return EQUIPMENT_TYPES[normalizedType]?.icon || '❓';
};

export const getEquipmentTypeOptions = () => {
    return Object.values(EQUIPMENT_TYPES).map(t => ({ value: t.value, label: t.label, icon: t.icon }));
};