import { SiteContent } from '../types/content';
import { defaultContent } from '../data/defaultContent';
import { saveContentToDatabase, loadContentFromDatabase } from './supabase';

// Debounce функция для отложенного сохранения
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 1000; // 1 секунда задержки

// КРИТИЧЕСКАЯ ФУНКЦИЯ: Проверка является ли контент дефолтным
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
      console.log('🚫🚫🚫 ОБНАРУЖЕН ДЕФОЛТНЫЙ КОНТЕНТ! БЛОКИРОВКА СОХРАНЕНИЯ!');
      console.log('🚫 Признаков дефолта:', defaultIndicators, 'из 5');
    }
    
    return isDefault;
  } catch (error) {
    console.error('❌ Ошибка проверки дефолтного контента:', error);
    // При ошибке считаем что это дефолт - безопаснее
    return true;
  }
};

// ОСНОВНАЯ ФУНКЦИЯ СОХРАНЕНИЯ - С ЖЕЛЕЗНОЙ ЗАЩИТОЙ
export const saveContent = async (content: SiteContent, immediate: boolean = false): Promise<void> => {
  try {
    console.log('🔒 ПРОВЕРКА КОНТЕНТА ПЕРЕД СОХРАНЕНИЕМ...');
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА #1: НЕ СОХРАНЯЕМ ДЕФОЛТНЫЙ КОНТЕНТ!
    if (isDefaultContent(content)) {
      console.log('🚫🚫🚫 БЛОКИРОВКА: ДЕФОЛТНЫЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ!');
      console.log('🚫🚫🚫 ЗАЩИТА СРАБОТАЛА - ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ В БЕЗОПАСНОСТИ!');
      return;
    }
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА #2: Проверяем что контент не пустой
    if (!content || !content.blocks || content.blocks.length === 0) {
      console.log('🚫🚫🚫 БЛОКИРОВКА: ПУСТОЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ!');
      return;
    }
    
    console.log('✅ КОНТЕНТ ПРОШЕЛ ПРОВЕРКУ - ЭТО ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ');
    console.log('💾 СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО КОНТЕНТА В БД...');
    
    if (immediate) {
      console.log('⚡ НЕМЕДЛЕННОЕ сохранение пользовательского контента...');
      const dbSaved = await saveContentToDatabase(content);
      if (dbSaved) {
        console.log('✅✅✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ СОХРАНЕН В БД');
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
          console.log('✅✅✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ СОХРАНЕН В БД (отложенно)');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: true } }));
        } else {
          console.log('❌ ОШИБКА отложенного сохранения');
          window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false } }));
        }
      }, SAVE_DELAY);
    }
    
  } catch (error) {
    console.error('❌ Error in saveContent:', error);
    console.log('🚫 КРИТИЧЕСКАЯ ОШИБКА: НЕ СОХРАНЯЕМ НИЧЕГО');
    window.dispatchEvent(new CustomEvent('contentSaved', { detail: { success: false, error: error.message } }));
  }
};

// ФУНКЦИЯ ЗАГРУЗКИ - ТОЛЬКО ИЗ БД, НИКАКИХ ДЕФОЛТОВ В БД!
export const loadContent = async (): Promise<SiteContent> => {
  try {
    console.log('🔍 ЗАГРУЗКА ТОЛЬКО ИЗ БД - БЕЗ ДЕФОЛТОВ!');
    
    // ЗАГРУЖАЕМ ТОЛЬКО ИЗ БД
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      console.log('✅✅✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ ЗАГРУЖЕН ИЗ БД');
      
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Если из БД пришел дефолт - НЕ ИСПОЛЬЗУЕМ!
      if (isDefaultContent(dbContent)) {
        console.log('🚫🚫🚫 ИЗ БД ПРИШЕЛ ДЕФОЛТ - ЭТО ОШИБКА!');
        console.log('🚫 ИСПОЛЬЗУЕМ ДЕФОЛТ ТОЛЬКО ДЛЯ ОТОБРАЖЕНИЯ');
        return fixBlockOrder(defaultContent);
      }
      
      const fixedContent = fixBlockOrder(dbContent);
      return fixedContent;
    }
    
    console.log('⚠️ БД ПУСТА - ДЕФОЛТ ТОЛЬКО ДЛЯ ОТОБРАЖЕНИЯ (НЕ СОХРАНЯЕМ!)');
    return fixBlockOrder(defaultContent);
    
  } catch (error) {
    console.error('❌ ОШИБКА БД:', error);
    console.log('🆘 ОШИБКА БД: дефолт только для отображения');
    return fixBlockOrder(defaultContent);
  }
};

// Функция для исправления порядка блоков
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

// СИНХРОННАЯ ЗАГРУЗКА - ТОЛЬКО ДЕФОЛТ ДЛЯ ОТОБРАЖЕНИЯ
export const loadContentSync = (): SiteContent => {
  console.log('📱 СИНХРОННАЯ ЗАГРУЗКА: только дефолт для отображения');
  return fixBlockOrder(defaultContent);
};

// RESET ПОЛНОСТЬЮ ЗАБЛОКИРОВАН!
export const resetContent = (): SiteContent => {
  console.log('🚫🚫🚫 RESET ПОЛНОСТЬЮ ЗАБЛОКИРОВАН!');
  console.log('🚫🚫🚫 ВОЗВРАТ К ДЕФОЛТУ НЕВОЗМОЖЕН!');
  console.log('🚫🚫🚫 ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ ЗАЩИЩЕНЫ!');
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

// ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ЗАБЛОКИРОВАНА!
export const forceSyncWithDatabase = async (): Promise<boolean> => {
  console.log('🚫🚫🚫 ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ЗАБЛОКИРОВАНА!');
  console.log('🚫🚫🚫 НЕ МОЖЕМ ПЕРЕЗАПИСАТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ!');
  console.log('🚫🚫🚫 ЗАЩИТА ОТ ОТКАТА АКТИВНА!');
  return false;
};

// ЗАГРУЗКА ИЗ БД С ПЕРЕЗАПИСЬЮ - ТОЛЬКО ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ
export const loadFromDatabaseAndOverwrite = async (): Promise<SiteContent> => {
  try {
    console.log('🔄 Загрузка только пользовательского контента из БД...');
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Если из БД пришел дефолт - НЕ ИСПОЛЬЗУЕМ!
      if (isDefaultContent(dbContent)) {
        console.log('🚫🚫🚫 ИЗ БД ПРИШЕЛ ДЕФОЛТ - БЛОКИРУЕМ!');
        return fixBlockOrder(defaultContent);
      }
      
      const fixedContent = fixBlockOrder(dbContent);
      console.log('✅✅✅ Пользовательский контент загружен из БД');
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