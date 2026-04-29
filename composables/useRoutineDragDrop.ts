import type { Ref } from 'vue';
import type { WeeklyRoutine, RoutineItem, CabinetProductItem } from '~/types/routine';

export function useRoutineDragDrop(
  routine: Ref<WeeklyRoutine | null>,
  expandedDayIdx: Ref<number>,
  daysOfWeek: string[],
  saveMessage: Ref<string | null>,
  saveSuccess: Ref<boolean>,
  getItemsForTimeslot: (dayOfWeek: number, timeOfDay: 'morning' | 'evening') => RoutineItem[]
) {
  let draggedProduct: CabinetProductItem | RoutineItem | null = null;
  let draggedFromInventory = false;

  const onInventoryDragStart = (evt: DragEvent, product: CabinetProductItem) => {
    draggedProduct = product;
    draggedFromInventory = true;
    if (evt.dataTransfer) {
      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('product', JSON.stringify(product));
    }
  };

  const onProductDragStart = (evt: DragEvent, item: RoutineItem, _dayIdx: number, _timeOfDay: 'morning' | 'evening') => {
    if (item.is_locked) {
      evt.preventDefault();
      return;
    }
    draggedProduct = item;
    draggedFromInventory = false;
    if (evt.dataTransfer) {
      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('product', JSON.stringify(item));
    }
  };

  const onProductDrop = (evt: DragEvent, dayIdx: number, timeOfDay: 'morning' | 'evening') => {
    evt.preventDefault();
    if (!draggedProduct || !routine.value) return;

    const productName = draggedFromInventory
      ? (draggedProduct as CabinetProductItem).product_name
      : (draggedProduct as RoutineItem).product_name;

    const targetSlotHasDuplicate = routine.value.items.some(
      item =>
        item.product_name === productName &&
        item.day_of_week === dayIdx &&
        item.time_of_day === timeOfDay
    );

    if (targetSlotHasDuplicate) {
      draggedProduct = null;
      draggedFromInventory = false;
      return;
    }

    if (draggedFromInventory) {
      const newItem: RoutineItem = {
        product_name: (draggedProduct as CabinetProductItem).product_name,
        product_category: (draggedProduct as CabinetProductItem).product_category,
        day_of_week: dayIdx,
        time_of_day: timeOfDay,
        sequence_order: getItemsForTimeslot(dayIdx, timeOfDay).length,
        is_recommendation: false,
      };
      routine.value.items.push(newItem);
    } else {
      const draggedRoutineItem = draggedProduct as RoutineItem;

      if (draggedRoutineItem.is_locked) {
        saveSuccess.value = false;
        saveMessage.value = '此項目已鎖定，無法拖拽移動';
        draggedProduct = null;
        draggedFromInventory = false;
        return;
      }

      const sourceItemIndex = routine.value.items.findIndex(
        item =>
          item.product_name === draggedRoutineItem.product_name &&
          item.day_of_week === draggedRoutineItem.day_of_week &&
          item.time_of_day === draggedRoutineItem.time_of_day
      );

      if (sourceItemIndex >= 0) {
        const sourceItem = routine.value.items[sourceItemIndex];
        if (!sourceItem) return;

        if (sourceItem.day_of_week === dayIdx && sourceItem.time_of_day === timeOfDay) {
          draggedProduct = null;
          draggedFromInventory = false;
          return;
        }

        routine.value.items.splice(sourceItemIndex, 1);

        const oldTimeSlot = getItemsForTimeslot(sourceItem.day_of_week, sourceItem.time_of_day);
        oldTimeSlot.forEach((item, idx) => { item.sequence_order = idx; });

        const movedItem: RoutineItem = {
          ...sourceItem,
          product_name: sourceItem.product_name || '',
          day_of_week: dayIdx,
          time_of_day: timeOfDay,
          sequence_order: getItemsForTimeslot(dayIdx, timeOfDay).length,
        };
        routine.value.items.push(movedItem);

        const targetTimeSlot = getItemsForTimeslot(dayIdx, timeOfDay);
        targetTimeSlot.forEach((item, idx) => { item.sequence_order = idx; });
      }
    }

    draggedProduct = null;
    draggedFromInventory = false;
  };

  const quickAdd = (product: CabinetProductItem, timeOfDay: 'morning' | 'evening') => {
    if (!routine.value) return;

    const dayIdx = expandedDayIdx.value;
    const dayName = daysOfWeek[dayIdx];
    const slotLabel = timeOfDay === 'morning' ? '早晨' : '晚間';

    const alreadyExists = routine.value.items.some(
      item =>
        item.product_name === product.product_name &&
        item.day_of_week === dayIdx &&
        item.time_of_day === timeOfDay
    );

    if (alreadyExists) {
      saveSuccess.value = false;
      saveMessage.value = `${product.product_name} 已在週${dayName}${slotLabel}中`;
      setTimeout(() => { saveMessage.value = null; }, 2000);
      return;
    }

    const newItem: RoutineItem = {
      product_name: product.product_name,
      product_category: product.product_category,
      day_of_week: dayIdx,
      time_of_day: timeOfDay,
      sequence_order: getItemsForTimeslot(dayIdx, timeOfDay).length,
      is_recommendation: false,
    };

    routine.value.items.push(newItem);
    saveSuccess.value = true;
    saveMessage.value = `✓ 已加入週${dayName}${slotLabel}`;
    setTimeout(() => { saveMessage.value = null; }, 2000);
  };

  return { onInventoryDragStart, onProductDragStart, onProductDrop, quickAdd };
}
