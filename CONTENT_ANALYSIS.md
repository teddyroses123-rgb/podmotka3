# Анализ источников контента сайта

## Возможные источники версии сайта

### 1. **Supabase База данных (ПРИОРИТЕТ)**
- **Файл**: `src/utils/supabase.ts` - функция `loadContentFromDatabase()`
- **Логика**: Всегда загружается ПЕРВЫМ из таблицы `site_content` с `id='main'`
- **Код**:
```typescript
const { data, error } = await supabase
  .from('site_content')
  .select('content')
  .eq('id', 'main')
  .maybeSingle();
```

### 2. **localStorage (БЕКАП)**
- **Файл**: `src/utils/contentStorage.ts` - функция `loadContent()`
- **Логика**: Используется только если БД пуста или недоступна
- **Ключ**: `'siteContent'`

### 3. **Дефолтный контент (ПОСЛЕДНИЙ РЕЗЕРВ)**
- **Файл**: `src/data/defaultContent.ts`
- **Логика**: Используется только в критических случаях

## Текущая логика загрузки (из contentStorage.ts):

```typescript
export const loadContent = async (): Promise<SiteContent> => {
  try {
    console.log('🌐 ЗАГРУЗКА ИЗ ГЛОБАЛЬНОЙ БД (приоритет)...');
    
    // ПРИОРИТЕТ: Всегда загружаем из глобальной БД
    const dbContent = await loadContentFromDatabase();
    if (dbContent) {
      console.log('✅ КОНТЕНТ ЗАГРУЖЕН ИЗ ГЛОБАЛЬНОЙ БД');
      const fixedContent = fixBlockOrder(dbContent);
      // Обновляем бекап в localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedContent));
      console.log('💾 Бекап обновлен в localStorage');
      return fixedContent;
    }
    
    // Если БД пуста - проверяем localStorage
    const backupContent = localStorage.getItem(STORAGE_KEY);
    if (backupContent) {
      console.log('💾 ИСПОЛЬЗУЕМ БЕКАП ИЗ localStorage (БД пуста)');
      const content = JSON.parse(backupContent);
      const fixedContent = fixBlockOrder(content);
      
      // Сохраняем бекап в БД только если это не дефолтный контент
      if (!isDefaultContent(fixedContent)) {
        console.log('🔄 Восстанавливаем пользовательский контент в БД из бекапа...');
        await saveContentToDatabase(fixedContent);
      }
      
      return fixedContent;
    }
    
    // ТОЛЬКО В КРАЙНЕМ СЛУЧАЕ возвращаем дефолтный контент БЕЗ СОХРАНЕНИЯ В БД
    console.log('🆘 КРАЙНИЙ СЛУЧАЙ: возвращаем дефолтный контент БЕЗ СОХРАНЕНИЯ В БД');
    return fixBlockOrder(defaultContent);
    
  } catch (error) {
    // ... обработка ошибок
  }
};
```

## Вывод: Откуда подтянулась версия

**НАИБОЛЕЕ ВЕРОЯТНО** - из **Supabase базы данных**, потому что:

1. ✅ **БД имеет наивысший приоритет** - загружается первой
2. ✅ **Контент сохраняется в БД** при каждом изменении
3. ✅ **БД персистентна** между сессиями и диалогами
4. ✅ **localStorage обновляется** из БД при каждой загрузке

## Как проверить источник:

1. **Откройте DevTools → Console**
2. **Перезагрузите страницу**
3. **Найдите логи**:
   - `🌐 ЗАГРУЗКА ИЗ ГЛОБАЛЬНОЙ БД (приоритет)...`
   - `✅ КОНТЕНТ ЗАГРУЖЕН ИЗ ГЛОБАЛЬНОЙ БД` ← **Если видите это - источник БД**
   - `💾 ИСПОЛЬЗУЕМ БЕКАП ИЗ localStorage` ← **Если видите это - источник localStorage**

## Миграции БД:

Последняя миграция `20250919221357_heavy_dream.sql` **ОЧИЩАЛА** БД:
```sql
-- Очищаем таблицу с контентом сайта
DELETE FROM site_content WHERE id = 'main';
```

**НО** если после этой миграции был сохранен контент - он остался в БД и загружается при каждом запуске.