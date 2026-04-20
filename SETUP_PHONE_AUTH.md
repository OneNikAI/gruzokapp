# Запуск проекта и настройка Firebase под вход "телефон + пароль"

## Что уже изменено в коде
- убрана demo-схема с anonymous auth для входа/регистрации
- вход и регистрация работают через Firebase Email/Password
- пользователь вводит номер телефона и пароль
- внутри Firebase используется технический email вида `79991234567@gruzok.ru`
- профиль пользователя хранится в `users/{auth.uid}`
- `currentUserId` теперь стабилен и совпадает с `auth.uid`

## Что включить в Firebase
### 1. Authentication
В Firebase Console открой **Authentication -> Sign-in method** и включи:
- **Email/Password**

Phone provider для этой версии **не нужен**.

### 2. Firestore Database
Создай или открой Firestore.

Если у тебя обычная Firestore-база, в `firebase-applet-config.json` должно быть:
```json
"firestoreDatabaseId": "(default)"
```

Если ты используешь нестандартную database id, оставь как есть.

### 3. Firestore Rules
Залей правила из файла `firestore.rules`.

### 4. Firestore Indexes
Создай индексы из файла `firestore.indexes.json`.

## Как запустить локально
```bash
npm install
npm run dev
```

Приложение откроется на:
```bash
http://localhost:3000
```

## Как проверить
1. Зарегистрируй нового пользователя по номеру и паролю.
2. Убедись, что в Authentication появился новый user с email вида `7999...@gruzok.ru`.
3. Убедись, что в Firestore появился документ `users/{auth.uid}`.
4. Создай заказ.
5. Проверь список заказов.
6. Проверь чат и уведомления.

## Важные замечания
### Нормализация телефона
Внутри кода номер хранится в цифрах:
- `+7 (999) 123-45-67` -> `79991234567`
- `8 (999) 123-45-67` -> `79991234567`

### Технический email
Пользователь его не видит. Он нужен только для Firebase Auth:
- `79991234567@gruzok.ru`

### Пароль
Firebase требует минимум 6 символов.

## Что желательно сделать следующим этапом
- вынести Firebase config в `.env`
- убрать оставшиеся mock-данные из карточек исполнителей и статистики
- добавить PWA
- затем завернуть в Capacitor для Android/iOS
