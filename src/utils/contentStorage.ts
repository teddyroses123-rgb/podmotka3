import { SiteContent } from '../types/content';
import { defaultContent } from '../data/defaultContent';
import { saveContentToDatabase, loadContentFromDatabase } from './supabase';

// Debounce функция для отложенного сохранения
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 1000; // 1 секунда задержки

// ЕДИНСТВЕННАЯ ДОБАВЛЕННАЯ ЗАЩИТА: Проверка является ли контент дефолтным
const isDefaultContent = (content: SiteContent): boolean => {
  try {
    // Множественные проверки дефолтного контента
    const hasDefaultHeroTitle = content.blocks.some(block => 
      block.id === 'hero' && 
      block.title === 'ПІДМОТКА СПІДОМЕТРА — У ВАШИХ РУКАХ'
    );
    
    const hasDefaultCanPrice = content.blocks.some(block => 
      block.id === 'can-module' && block.price === '2500'
    );
    
    const hasDefaultAnalogPrice = content.blocks.some(block => 
      block.id === 'analog-module' && block.price === '1800'
    );
    
    const hasDefaultOpsPrice = content.blocks.some(block => 
      block.id === 'ops-module' && block.price === '3200'
    );
    
    const hasDefaultModulesCount = content.blocks.filter(block => 
      ['can-module', 'analog-module', 'ops-module'].includes(block.id)
    ).length === 3;
    
    // Если хотя бы 3 из 5 признаков совпадают - это дефолт
    const defaultIndicators = [
      hasDefaultHeroTitle,
      hasDefaultCanPrice, 
      hasDefaultAnalogPrice,
      hasDefaultOpsPrice,
      hasDefaultModulesCount
    ].filter(Boolean).length;
    
    const isDefault = defaultIndicators >= 3;
    
    if (isDefault) {
      console.log('🚫 ОБНАРУЖЕН ДЕФОЛТНЫЙ КОНТЕНТ! БЛОКИРОВКА СОХРАНЕНИЯ!');
    }
    
    return isDefault;
  } catch (error) {
    console.error('❌ Ошибка проверки дефолтного контента:', error);
    return false; // При ошибке НЕ блокируем - пусть сохраняется
  }
};

// ОРИГИНАЛЬНАЯ ФУНКЦИЯ СОХРАНЕНИЯ + ТОЛЬКО ЗАЩИТА ОТ ДЕФОЛТА
export const saveContent = async (content: SiteContent, immediate: boolean = false): Promise<void> => {
  try {
    // ЕДИНСТВЕННАЯ ДОБАВЛЕННАЯ ПРОВЕРКА: НЕ СОХРАНЯЕМ ДЕФОЛТНЫЙ КОНТЕНТ!
    if (isDefaultContent(content)) {
      console.log('🚫 БЛОКИРОВКА: ДЕФОЛТНЫЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ!');
      return;
    }
    
    // ВСЯ ОСТАЛЬНАЯ ЛОГИКА ОРИГИНАЛЬНАЯ
    if (immediate) {
      console.log('⚡ НЕМЕДЛЕННОЕ сохранение контента...');
      const dbSaved = await saveContentToDatabase(content);
      if (dbSaved) {
        console.log('✅ КОНТЕНТ СОХРАНЕН В БД');
        window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: true } }));
      } else {
        console.log('❌ ОШИБКА сохранения контента');
        window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false } }));
      }
    } else {
      // Отложенное сохранение
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      saveTimeout = setTimeout(async () => {
        console.log('⏰ ОТЛОЖЕННОЕ сохранение контента...');
        const dbSaved = await saveContentToDatabase(content);
        if (dbSaved) {
          console.log('✅ КОНТЕНТ СОХРАНЕН В БД (отложенно)');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: true } }));
        } else {
          console.log('❌ ОШИБКА отложенного сохранения');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false } }));
        }
      }, SAVE_DELAY);
    }
    
  } catch (error) {
    console.error('❌ Error in saveContent:', error);
    window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false, error: error.message } }));
  }
};

// ОРИГИНАЛЬНАЯ ФУНКЦИЯ ЗАГРУЗКИ - БЕЗ ИЗМЕНЕНИЙ
export const loadContent = async (): Promise<SiteContent> => {
  try {
    console.log('🔍 ЗАГРУЗКА ИЗ БД...');
    
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      console.log('✅ КОНТЕНТ ЗАГРУЖЕН ИЗ БД');
      const fixedContent = fixBlockOrder(dbContent);
      return fixedContent;
    }
    
    console.log('⚠️ БД ПУСТА - ИСПОЛЬЗУЕМ ДЕФОЛТ');
    return fixBlockOrder(defaultContent);
    
  } catch (error) {
    console.error('❌ ОШИБКА БД:', error);
    console.log('🆘 ОШИБКА БД: используем дефолт');
    return fixBlockOrder(defaultContent);
  }
};

// Функция для исправления порядка блоков - БЕЗ ИЗМЕНЕНИЙ
const fixBlockOrder = (content: SiteContent): SiteContent => {
  console.log('🔧 Fixing block order');
  
  const reorderedBlocks = content.blocks.map(block => {
    // Системные блоки с фиксированным порядком
    if (block.id === 'hero') return { ...block, order: 1 };
    if (block.id === 'features') return { ...block, order: 2 };
    if (block.id === 'modules') return { ...block, order: 3 };
    if (block.id === 'can-module') return { ...block, order: 4 };
    if (block.id === 'analog-module') return { ...block, order: 5 }; 
    if (block.id === 'ops-module') return { ...block, order: 6 };
    
    // Пользовательские блоки - между OPS (6) и видео (50)
    if (block.type === 'custom') {
      const customBlocks = content.blocks.filter(b => b.type === 'custom');
      const customIndex = customBlocks.findIndex(b => b.id === block.id);
      const newOrder = 7 + customIndex;
      return { ...block, order: newOrder };
    }
    
    // Видео и контакты в конце
    if (block.id === 'videos') return { ...block, order: 50 };
    if (block.id === 'contacts') return { ...block, order: 51 };
    
    return block;
  });
  
  return {
    ...content,
    blocks: reorderedBlocks
  };
};

// ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ - ОРИГИНАЛЬНЫЕ БЕЗ ИЗМЕНЕНИЙ
export const loadContentSync = (): SiteContent => {
  console.log('📱 СИНХРОННАЯ ЗАГРУЗКА: дефолт для отображения');
  return fixBlockOrder(defaultContent);
};

export const resetContent = (): SiteContent => {
  console.log('🔄 RESET к дефолту');
  return fixBlockOrder(defaultContent);
};

export const exportContent = (): string => {
  const content = loadContentSync();
  return JSON.stringify(content, null, 2);
};

export const importContent = (jsonString: string): SiteContent => {
  try {
    const content = JSON.parse(jsonString);
    return content;
  } catch (error) {
    console.error('❌ Error importing content:', error);
    throw new Error('Invalid JSON format');
  }
};

export const forceSyncWithDatabase = async (): Promise<boolean> => {
  try {
    console.log('🔄 Принудительная синхронизация с БД...');
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      console.log('✅ Синхронизация завершена');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    return false;
  }
};

export const loadFromDatabaseAndOverwrite = async (): Promise<SiteContent> => {
  try {
    console.log('🔄 Загрузка из БД с перезаписью...');
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      const fixedContent = fixBlockOrder(dbContent);
      console.log('✅ Контент загружен из БД');
      return fixedContent;
    } else {
      console.log('⚠️ БД пуста - используем дефолт');
      return fixBlockOrder(defaultContent);
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки из БД:', error);
    return fixBlockOrder(defaultContent);
  }
};