import { createClient } from '@supabase/supabase-js';
import { SiteContent } from '../types/content';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables not found');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export const saveContentToDatabase = async (content: SiteContent): Promise<boolean> => {
  try {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured - missing environment variables');
      return false;
    }

    console.log('🔄 ПОПЫТКА СОХРАНЕНИЯ В БД (ПОЛНАЯ ПЕРЕЗАПИСЬ)...');
    
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

    console.log('✅ КОНТЕНТ УСПЕШНО СОХРАНЕН В БАЗУ ДАННЫХ (ПОЛНАЯ ПЕРЕЗАПИСЬ)!', data);
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
      console.log('✅ КОНТЕНТ УСПЕШНО ЗАГРУЖЕН ИЗ БД');
      return data.content as SiteContent;
    }

    console.log('⚠️ НЕТ ДАННЫХ В БД');
    return null;
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ ИЗ БД:', error);
    return null;
  }
};