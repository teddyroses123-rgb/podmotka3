import { createClient } from '@supabase/supabase-js';
import { SiteContent } from '../types/content';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not found');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// КРИТИЧЕСКАЯ ФУНКЦИЯ: Проверка является ли контент дефолтным
const isDefaultContent = (content: SiteContent): boolean => {
  try {
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
    
    // Если хотя бы 2 из 3 признаков совпадают - это дефолт
    const defaultIndicators = [hasDefaultHeroTitle, hasDefaultCanPrice, hasDefaultAnalogPrice].filter(Boolean).length;
    return defaultIndicators >= 2;
  } catch (error) {
    console.error('❌ Ошибка проверки дефолтного контента:', error);
    return true; // При ошибке считаем что это дефолт - безопаснее
  }
};

export const saveContentToDatabase = async (content: SiteContent): Promise<boolean> => {
  try {
    // КРИТИЧЕСКАЯ ПРОВЕРКА #1: Supabase настроен?
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured - missing environment variables');
      return false;
    }

    // КРИТИЧЕСКАЯ ПРОВЕРКА #2: НЕ СОХРАНЯЕМ ДЕФОЛТНЫЙ КОНТЕНТ!
    if (isDefaultContent(content)) {
      console.log('🚫🚫🚫 БЛОКИРОВКА В SUPABASE: ДЕФОЛТНЫЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ!');
      console.log('🚫🚫🚫 ЗАЩИТА СРАБОТАЛА НА УРОВНЕ БД!');
      return false;
    }

    // КРИТИЧЕСКАЯ ПРОВЕРКА #3: Контент не пустой?
    if (!content || !content.blocks || content.blocks.length === 0) {
      console.log('🚫🚫🚫 БЛОКИРОВКА: ПУСТОЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ В БД!');
      return false;
    }

    console.log('🔄 СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЬСКОГО КОНТЕНТА В БД (ПОЛНАЯ ПЕРЕЗАПИСЬ)...');
    
    // КРИТИЧНО: Полная перезапись записи с id='main'
    // Сначала удаляем старую запись, затем создаем новую
    const { error: deleteError } = await supabase
      .from('site_content')
      .delete()
      .eq('id', 'main');
    
    if (deleteError) {
      console.log('⚠️ Предупреждение при удалении старой записи:', deleteError.message);
      // Продолжаем выполнение, так как записи может не быть
    } else {
      console.log('🗑️ Старая запись удалена');
    }
    
    // Создаем новую запись
    const { data, error } = await supabase
      .from('site_content')
      .insert({
        id: 'main',
        content: content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    

    if (error) {
      console.error('❌ ОШИБКА СОЗДАНИЯ НОВОЙ ЗАПИСИ В БД:', error);
      return false;
    }

    console.log('✅✅✅ ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ УСПЕШНО СОХРАНЕН В БД (ПОЛНАЯ ПЕРЕЗАПИСЬ)!', data);
    return true;
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ В БД:', error);
    return false;
  }
};

export const loadContentFromDatabase = async (): Promise<SiteContent | null> => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured - missing environment variables');
      return null;
    }

    console.log('🔄 ЗАГРУЗКА ИЗ БД...');
    
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.error('❌ ОШИБКА ЗАГРУЗКИ ИЗ БД:', error);
      return null;
    }

    if (data && data.content) {
      console.log('✅ КОНТЕНТ ЗАГРУЖЕН ИЗ БД');
      
      // КРИТИЧЕСКАЯ ПРОВЕРКА: Если из БД пришел дефолт - НЕ ВОЗВРАЩАЕМ!
      if (isDefaultContent(data.content as SiteContent)) {
        console.log('🚫🚫🚫 ИЗ БД ЗАГРУЖЕН ДЕФОЛТ - ЭТО ОШИБКА!');
        console.log('🚫🚫🚫 ВОЗВРАЩАЕМ NULL ЧТОБЫ НЕ ПЕРЕЗАПИСАТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ!');
        return null;
      }
      
      console.log('✅✅✅ ЗАГРУЖЕН ПОЛЬЗОВАТЕЛЬСКИЙ КОНТЕНТ ИЗ БД');
      return data.content as SiteContent;
    }

    console.log('⚠️ НЕТ ДАННЫХ В БД');
    return null;
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ ИЗ БД:', error);
    return null;
  }
};