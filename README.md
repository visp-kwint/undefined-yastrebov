# DataAnalyst AI — Frontend

Фронтенд для AI-ассистента анализа экономических датасетов. Построен на Next.js 14 + TypeScript + Tailwind CSS.

## Быстрый старт

```bash
npm install
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

## Структура

```
app/
  page.tsx          — главная страница (sidebar + chat + upload + preview)
  layout.tsx        — корневой layout
  globals.css       — глобальные стили + markdown
  api/mock/         — mock API routes (работают без бэкенда)
components/
  sidebar.tsx       — боковая панель (чаты + файлы)
  auth-modal.tsx    — модалка входа/регистрации
  chat-interface.tsx — интерфейс чата
  message-bubble.tsx — сообщение с markdown
  welcome-screen.tsx — стартовый экран
  file-uploader.tsx  — загрузка файлов
  data-preview.tsx   — табличный превью данных
hooks/
  use-auth.ts       — авторизация
  use-chat.ts       — сессии и сообщения
  use-files.ts      — файлы и превью
lib/
  api.ts            — единый API-клиент (mock ↔ real)
  types.ts          — TypeScript интерфейсы
  utils.ts          — утилиты
```

## Переключение на реальный бэкенд

В `lib/api.ts` измени две строки:

```ts
const MOCK_MODE = false;
const BASE_URL = "http://localhost:5000/api"; // твой бэкенд
```

И убери rewrite в `next.config.mjs`:

```js
const nextConfig = {
  reactStrictMode: true,
  // rewrites убран
};
```

## Функционал

- 📁 Загрузка .xlsx / .csv (drag & drop)
- 💬 Чат с AI по данным файла
- 📊 Предпросмотр данных в таблице
- 🔐 JWT-авторизация (регистрация / вход / выход / удаление аккаунта)
- 📝 История сессий с группировкой по датам
- 📋 Markdown-рендеринг ответов AI (таблицы, списки, код)
- 📱 Адаптивный дизайн (мобильная sidebar)

## Дизайн

Тёмная тема в стиле DocMind: `#1a1a1a` фон, `#2d2d2d` карточки, `#e0e0e0` текст.
