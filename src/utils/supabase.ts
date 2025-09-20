import { createClient } from '@supabase/supabase-js';
import { SiteContent } from '../types/content';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not found');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Проверка является ли контент полностью дефолтным (без пользовательских изменений)
const isCompletelyDefaultContent = (content: SiteContent): boolean => {
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
    
    const hasDefaultOpsPrice = content.blocks.some(block => 
      block.id === 'ops-module' && block.price === '3200'
    );
    
    const hasOnlyDefaultBlocks = content.blocks.filter(block => 
      block.type === 'custom'
    ).length === 0; // Нет пользовательских блоков
    
    // СТРОГАЯ проверка - ВСЕ 5 признаков должны совпадать для блокировки
    return hasDefaultHeroTitle && 
           hasDefaultCanPrice && 
           hasDefaultAnalogPrice && 
           hasDefaultOpsPrice && 
           hasOnlyDefaultBlocks;
  } catch (error) {
    console.error('❌ Ошибка проверки дефолтного контента:', error);
    return false; // При ошибке НЕ блокируем - пусть сохраняется
  }
};

// ОРИГИНАЛЬНАЯ ФУНКЦИЯ + ТОЛЬКО ЗАЩИТА ОТ ДЕФОЛТА
export const saveContentToDatabase = async (content: SiteContent): Promise<boolean> => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured - missing environment variables');
      return false;
    }

    // ЕДИНСТВЕННАЯ ДОБАВЛЕННАЯ ПРОВЕРКА: НЕ СОХРАНЯЕМ ДЕФОЛТНЫЙ КОНТЕНТ!
    if (isCompletelyDefaultContent(content)) {
      console.log('🚫 БЛОКИРОВКА В SUPABASE: ПОЛНОСТЬЮ ДЕФОЛТНЫЙ КОНТЕНТ НЕ СОХРАНЯЕТСЯ!');
      return false;
    }

    console.log('🔄 СОХРАНЕНИЕ КОНТЕНТА В БД...');
    
    // ОРИГИНАЛЬНАЯ ЛОГИКА: DELETE + INSERT для полной перезаписи
    const { error: deleteError } = await supabase
      .from('site_content')
      .delete()
      .eq('id', 'main');
    
    if (deleteError) {
      console.log('⚠️ Предупреждение при удалении старой записи:', deleteError.message);
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

    console.log('✅ КОНТЕНТ УСПЕШНО СОХРАНЕН В БД!', data);
    return true;
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ В БД:', error);
    return false;
  }
};

// ОРИГИНАЛЬНАЯ ФУНКЦИЯ ЗАГРУЗКИ - БЕЗ ИЗМЕНЕНИЙ
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
      return data.content as SiteContent;
    }

    console.log('⚠️ НЕТ ДАННЫХ В БД');
    return null;
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ ИЗ БД:', error);
    return null;
  }
};