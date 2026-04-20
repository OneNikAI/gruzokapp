# Gruzok: запуск с авторизацией телефон + пароль

## Что изменено
- Вход и регистрация переведены на Firebase Email/Password.
- Для Firebase создаётся технический email из телефона: `7XXXXXXXXXX@gruzok.ru`.
- Профиль пользователя хранится в `users/{auth.uid}`.
- Убрана критичная demo-схема с anonymous uid при логине.

## Что включить в Firebase
1. Authentication -> Sign-in method -> **Email/Password** -> Enable
2. Firestore Database
3. При необходимости Storage

## Как запускать
```bash
npm install
npm run dev
```

## Как входить
- Телефон вводится в формате UI `+7 (...) ...`
- В Firebase он автоматически нормализуется до вида `7XXXXXXXXXX`
- Вход идёт по паре: `телефон + пароль`

## Важно
Если `firestoreDatabaseId` у тебя обычный, укажи в `firebase-applet-config.json`:
```json
"firestoreDatabaseId": "(default)"
```
