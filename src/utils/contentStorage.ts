import { SiteContent } from '../types/content';
import { defaultContent } from '../data/defaultContent';
import { saveContentToDatabase, loadContentFromDatabase } from './supabase';

// Debounce функция для отложенного сохранения
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 1000; // 1 секунда задержки

const STORAGE_KEY = 'siteContent';

// Функция для проверки является ли контент дефолтным
const isDefaultContent = (content: SiteContent): boolean => {
  try {
    // Проверяем по ключевым характеристикам дефолтного контента
    const hasDefaultHeroTitle = content.blocks.some(block => 
      block.id === 'hero' && 
      block.title === 'ПІДМОТКА СПІДОМЕТРА — У ВАШИХ РУКАХ'
    );
    
    const hasDefaultModulesCount = content.blocks.filter(block => 
      ['can-module', 'analog-module', 'ops-module'].includes(block.id)
    ).length === 3;
    
    const hasDefaultPrices = content.blocks.some(block => 
      block.id === 'can-module' && block.price === '2500'
    );
    
    return hasDefaultHeroTitle && hasDefaultModulesCount && hasDefaultPrices;
  } catch (error) {
    console.error('❌ Ошибка проверки дефолтного контента:', error);
    return false;
  }
};

export const saveContent = async (content: SiteContent, immediate: boolean = false): Promise<void> => {
  try {
    // КРИТИЧЕСКАЯ ПРОВЕРКА: НЕ СОХРАНЯЕМ ДЕФОЛТНЫЙ КОНТЕНТ!
    if (isDefaultContent(content)) {
      console.log('🚫 БЛОКИРОВКА: Попытка сохранить дефолтный контент!');
      console.log('🚫 ДЕФОЛТНЫЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ В БД!');
      return;
    }
    
    console.log('🌐 СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО КОНТЕНТА В БД...');
    
    // Сохранение только пользовательского контента
    if (immediate) {
      console.log('⚡ НЕМЕДЛЕННОЕ сохранение пользовательского контента...');
      const dbSaved = await saveContentToDatabase(content);
      if (dbSaved) {
        console.log('✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ СОХРАНЕН В БД');
        window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: true } }));
      } else {
        console.log('❌ ОШИБКА сохранения пользовательского контента');
        window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false } }));
      }
    } else {
      // Отложенное сохранение пользовательского контента
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      saveTimeout = setTimeout(async () => {
        console.log('⏰ ОТЛОЖЕННОЕ сохранение пользовательского контента...');
        const dbSaved = await saveContentToDatabase(content);
        if (dbSaved) {
          console.log('✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ СОХРАНЕН В БД (отложенно)');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: true } }));
        } else {
          console.log('❌ ОШИБКА отложенного сохранения');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false } }));
        }
      }, SAVE_DELAY);
    }
    
  } catch (error) {
    console.error('❌ Error in saveContent:', error);
    // При критической ошибке - только уведомление
    console.log('🚫 КРИТИЧЕСКАЯ ОШИБКА: НЕ СОХРАНЯЕМ НИЧЕГО');
    window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false, error: error.message } }));
  }
};

export const loadContent = async (): Promise<SiteContent> => {
  try {
    console.log('🌐 ЗАГРУЗКА ТОЛЬКО ИЗ ГЛОБАЛЬНОЙ БД...');
    
    // ТОЛЬКО из глобальной БД - никаких дефолтов!
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      console.log('✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ ЗАГРУЖЕН ИЗ БД');
      const fixedContent = fixBlockOrder(dbContent);
      // НЕ СОХРАНЯЕМ в localStorage - только БД!
      console.log('🚫 localStorage отключен - только БД');
      return fixedContent;
    }
    
    console.log('⚠️ БД ПУСТА - ВОЗВРАЩАЕМ ДЕФОЛТ БЕЗ СОХРАНЕНИЯ');
    
    // БД пуста - возвращаем дефолт только для отображения, НЕ СОХРАНЯЕМ!
    console.log('🆘 БД ПУСТА: дефолт только для отображения');
    return fixBlockOrder(defaultContent);
    
  } catch (error) {
    console.error('❌ ОШИБКА БД:', error);
    
    // При ошибке БД - дефолт только для отображения
    console.log('🆘 ОШИБКА БД: дефолт только для отображения');
    return fixBlockOrder(defaultContent);
  }
};

// Функция для исправления порядка блоков
const fixBlockOrder = (content: SiteContent): SiteContent => {
  console.log('🔧 Fixing block order');
  console.log('Current blocks:', content.blocks.map(b => ({ id: b.id, title: b.title, order: b.order, type: b.type })));
  
  const reorderedBlocks = content.blocks.map(block => {
    // Системные блоки с фиксированным порядком
    if (block.id === 'hero') return { ...block, order: 1 };
    if (block.id === 'features') return { ...block, order: 2 };
    if (block.id === 'modules') return { ...block, order: 3 };
    if (block.id === 'can-module') return { ...block, order: 4 };
    if (block.id === 'analog-module') return { ...block, order: 5 }; 
    if (block.id === 'ops-module') return { ...block, order: 6 };
    
    // Специальная проверка для блока АБС по названию
    if (block.title && (block.title.includes('АБС') || block.title.includes('абс'))) {
      console.log(`🎯 Found ABS block: "${block.title}" - setting order = 7`);
      return { ...block, order: 7, type: 'custom' };
    }
    
    // Пользовательские блоки - между OPS (6) и видео (50)
    if (block.type === 'custom') {
      const customBlocks = content.blocks.filter(b => b.type === 'custom');
      const customIndex = customBlocks.findIndex(b => b.id === block.id);
      const newOrder = 7 + customIndex;
      console.log(`📦 Custom block "${block.title}" (${block.id}): ${block.order} -> ${newOrder}`);
      return { ...block, order: newOrder };
    }
    
    // Видео и контакты в конце
    if (block.id === 'videos') return { ...block, order: 50 };
    if (block.id === 'contacts') return { ...block, order: 51 };
    
    // Остальные блоки сохраняют свой порядок
    return block;
  });
  
  console.log('✅ New block order:', reorderedBlocks.map(b => ({ id: b.id, title: b.title, order: b.order, type: b.type })));
  
  return {
    ...content,
    blocks: reorderedBlocks
  };
};

export const loadContentSync = (): SiteContent => {
  // СИНХРОННАЯ ЗАГРУЗКА ОТКЛЮЧЕНА - только дефолт для отображения
  console.log('🚫 localStorage отключен - только дефолт для отображения');
  return fixBlockOrder(defaultContent);
};

export const resetContent = (): SiteContent => {
  console.log('🚫 RESET ПОЛНОСТЬЮ ЗАБЛОКИРОВАН!');
  console.log('🚫 ВОЗВРАТ К ДЕФОЛТУ НЕВОЗМОЖЕН!');
  // Возвращаем дефолт только для отображения, НЕ СОХРАНЯЕМ!
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

// Функция для принудительной синхронизации с базой данных
export const forceSyncWithDatabase = async (): Promise<boolean> => {
  try {
    console.log('🚫 ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ОТКЛЮЧЕНА');
    console.log('🚫 НЕ МОЖЕМ ПЕРЕЗАПИСАТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ');
    return false;
  } catch (error) {
    console.error('🚫 Force sync заблокирован:', error);
    return false;
  }
};

// Функция для загрузки из базы данных с перезаписью localStorage
export const loadFromDatabaseAndOverwrite = async (): Promise<SiteContent> => {
  try {
    console.log('🔄 Загрузка только из БД...');
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      const fixedContent = fixBlockOrder(dbContent);
      console.log('✅ Пользовательский контент загружен из БД');
      return fixedContent;
    } else {
      console.log('⚠️ БД пуста - дефолт только для отображения');
      return fixBlockOrder(defaultContent);
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки из БД:', error);
    return fixBlockOrder(defaultContent);
  }
};