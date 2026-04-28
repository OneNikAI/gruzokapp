import React, { Component, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Briefcase, 
  MessageSquare, 
  User as UserIcon, 
  PlusCircle, 
  MapPin, 
  Clock, 
  Calendar,
  ChevronRight, 
  Star, 
  ShieldCheck, 
  ArrowLeft, 
  Send, 
  LogOut, 
  Settings, 
  Bell, 
  History, 
  CreditCard,
  Search,
  Plus,
  Camera,
  Play,
  Edit2,
  X,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Users,
  Phone,
  Filter,
  Sliders,
  Navigation,
  Shield,
  Moon,
  Globe,
  Map as MapIcon,
  List,
  Trash2,
  AlertTriangle,
  Info,
  UserMinus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { chatService, Chat, Message, Timestamp, collection, addDoc, serverTimestamp, db, handleFirestoreError, OperationType, authService, orderService, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc, query, where, orderBy, limit, normalizePhone } from './firebase';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Fix for Leaflet default icon issue in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const workerIcon = L.divIcon({
  className: 'custom-worker-icon',
  html: `<div style="background-color: #3b82f6; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5h-7v6h2"/><path d="M13 9h4"/><path d="M13 6h1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

// Types
type UserRole = 'customer' | 'worker' | 'dispatcher';

interface PortfolioItem {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

interface Review {
  id: string;
  author: string;
  authorId?: string;
  rating: number;
  text: string;
  date: string;
  avatar?: string;
  orderId?: string;
  targetId?: string;
  targetRole?: UserRole;
}

interface User {
  id: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar: string;
  rating: number;
  lat?: number;
  lng?: number;
  lastLocationAt?: any;
  skills?: string[];
  experience?: string;
  bio?: string;
  portfolio?: PortfolioItem[];
  reviews?: Review[];
  reviewsCount?: number;
  completedJobs?: number;
  responseTime?: string;
}

interface AssignedWorker {
  id: string;
  name: string;
  avatar: string;
  status: 'assigned' | 'on-way' | 'at-work' | 'finished';
}

interface Order {
  id: string;
  title: string;
  description: string;
  budget: number; // For workers: negotiatedBudget - commission
  negotiatedBudget?: number; // Agreed with customer
  commission?: number; // Dispatcher's cut
  address: string;
  category: string;
  customerId: string;
  workerId?: string;
  assignedWorkers?: AssignedWorker[];
  candidates?: string[]; // IDs of workers who accepted/applied
  status: 'pending_negotiation' | 'open' | 'in-progress' | 'completed';
  customerReviewed?: boolean;
  workerReviewed?: boolean;
  reviews?: Review[];
  time?: string;
  date?: string;
  workersCount?: number;
  paymentMethod?: string;
  distance?: number; // Distance in km
  lat?: number;
  lng?: number;
  statusHistory?: StatusHistoryEntry[];
  workerLiveLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
    workerId?: string;
  };
}

interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  changedBy: string; // 'customer' | 'worker' | 'dispatcher' | 'system'
  workerId?: string; // If it's a worker status change
  workerName?: string;
}

interface WorkerProfileData {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  bio: string;
  portfolio: (string | PortfolioItem)[];
  skills?: string[];
  experience?: string;
  reviews: {
    id: string;
    author: string;
    rating: number;
    text: string;
    date: string;
  }[];
  responseTime?: string;
  isOnline?: boolean;
  availability?: string;
}

interface Bid {
  id: string;
  workerId: string;
  orderId: string;
  price: number;
  message: string;
}

const TRANSLATIONS = {
  ru: {
    settings: "Настройки",
    account: "Аккаунт",
    personalData: "Личные данные",
    personalDataDesc: "Имя, телефон, фото",
    app: "Приложение",
    notifications: "Уведомления",
    language: "Язык",
    support: "Поддержка",
    helpFaq: "Помощь и FAQ",
    contactUs: "Связаться с нами",
    aboutApp: "О приложении",
    supportChat: "Чат с поддержкой",
    writeSupport: "Написать в поддержку",
    noFaqAnswer: "Не нашли ответ на свой вопрос?",
    version: "Версия",
    copyright: "Все права защищены.",
    save: "Сохранить",
    cancel: "Отмена",
    name: "Имя",
    phone: "Телефон",
    login: "Вход",
    chats: "Чаты",
    profile: "Профиль",
    home: "Главная",
    orders: "Заказы",
    hello: "Привет",
    needHelp: "Нужна помощь с грузом или ремонтом?",
    yourOrders: "Ваши заказы",
    availableOrders: "Доступные заказы",
    noOrders: "Заказов не найдено",
    all: "Все",
    open: "Открытые",
    inProgress: "В работе",
    completed: "Завершенные",
    category: "Категория",
    allCategories: "Все категории",
    loaders: "Грузчики",
    moving: "Переезд",
    assembly: "Сборка",
    other: "Разное",
    supportTitle: "Поддержка",
    messages: "Сообщения",
    noChats: "Нет активных чатов",
    startChat: "Начните общение...",
    chat: "Чат",
    messagePlaceholder: "Сообщение...",
    aboutMe: "О себе",
    skills: "Навыки",
    noSkills: "Навыки не указаны",
    experience: "Опыт работы",
    noExperience: "Опыт работы не указан",
    contactData: "Контактные данные",
    notSpecified: "Не указан",
    orderHistory: "История заказов",
    logout: "Выйти",
    myWorks: "Мои работы",
    upload: "Загрузить",
    uploading: "Загрузка",
    add: "Добавить",
    reviews: "Отзывы",
    noReviews: "Отзывов пока нет",
    editProfile: "Редактировать профиль",
    saveChanges: "Сохранить изменения",
    newOrder: "Новый заказ",
    whatToDo: "Что нужно сделать? *",
    titleExample: "Например: Перевезти диван",
    address: "Адрес *",
    addressPlaceholder: "Улица, дом, квартира",
    searchingAddress: "Ищем адрес...",
    mapHint: "Кликните на карту для выбора адреса",
    date: "Дата",
    time: "Время",
    description: "Описание",
    descriptionPlaceholder: "Опишите детали, этаж, наличие лифта...",
    payment: "Оплата (₽)",
    paymentMethod: "Способ оплаты",
    cash: "Наличные",
    card: "Карта",
    sbp: "СБП",
    publishOrder: "Опубликовать заказ",
    publishing: "Публикуем...",
    resetFilters: "Сбросить фильтры",
    writeTitleError: "Пожалуйста, введите название заказа",
    shortTitleError: "Название слишком короткое (минимум 5 символов)",
    addressError: "Пожалуйста, укажите адрес выполнения",
    budgetError: "Бюджет должен быть положительным числом",
    workersError: "Минимум 1 грузчик",
    createOrderError: "Не удалось создать заказ. Проверьте интернет и авторизацию, затем попробуйте еще раз.",
    orderDetails: "Детали заказа",
    statusOpen: "Открыт",
    statusPending: "На согласовании",
    statusInProgress: "В работе",
    statusCompleted: "Завершен",
    workerAssigned: "Назначен",
    onWay: "В пути",
    atWork: "На месте",
    finished: "Закончил",
    aboutText: "ГрузОК — это современная платформа для быстрого поиска грузчиков и разнорабочих. Мы помогаем заказчикам и исполнителям находить друг друга.",
    faq: [
      { q: "Как заказать услугу?", a: "Нажмите на кнопку 'Создать заказ' на главной странице и выберите нужную категорию." },
      { q: "Как стать исполнителем?", a: "Зарегистрируйтесь в приложении и выберите роль 'Я исполнитель'." }
    ]
  },
  en: {
    settings: "Settings",
    account: "Account",
    personalData: "Personal Data",
    personalDataDesc: "Name, phone, photo",
    app: "Application",
    notifications: "Notifications",
    language: "Language",
    support: "Support",
    helpFaq: "Help & FAQ",
    contactUs: "Contact Us",
    aboutApp: "About App",
    supportChat: "Support Chat",
    writeSupport: "Contact Support",
    noFaqAnswer: "Did not find an answer?",
    version: "Version",
    copyright: "All rights reserved.",
    save: "Save",
    cancel: "Cancel",
    name: "Name",
    phone: "Phone",
    login: "Login",
    chats: "Chats",
    profile: "Profile",
    home: "Home",
    orders: "Orders",
    hello: "Hi",
    needHelp: "Need help with moving or heavy work?",
    yourOrders: "Your orders",
    availableOrders: "Available orders",
    noOrders: "No orders found",
    all: "All",
    open: "Open",
    inProgress: "In progress",
    completed: "Completed",
    category: "Category",
    allCategories: "All categories",
    loaders: "Loaders",
    moving: "Moving",
    assembly: "Assembly",
    other: "Other",
    supportTitle: "Support",
    messages: "Messages",
    noChats: "No active chats",
    startChat: "Start chatting...",
    chat: "Chat",
    messagePlaceholder: "Message...",
    aboutMe: "About me",
    skills: "Skills",
    noSkills: "No skills specified",
    experience: "Work experience",
    noExperience: "No work experience specified",
    contactData: "Contact details",
    notSpecified: "Not specified",
    orderHistory: "Order history",
    logout: "Log out",
    myWorks: "My work",
    upload: "Upload",
    uploading: "Uploading",
    add: "Add",
    reviews: "Reviews",
    noReviews: "No reviews yet",
    editProfile: "Edit profile",
    saveChanges: "Save changes",
    newOrder: "New order",
    whatToDo: "What needs to be done? *",
    titleExample: "For example: Move a sofa",
    address: "Address *",
    addressPlaceholder: "Street, building, apartment",
    searchingAddress: "Searching address...",
    mapHint: "Tap the map to choose an address",
    date: "Date",
    time: "Time",
    description: "Description",
    descriptionPlaceholder: "Describe details, floor, elevator availability...",
    payment: "Payment (₽)",
    paymentMethod: "Payment method",
    cash: "Cash",
    card: "Card",
    sbp: "SBP",
    publishOrder: "Publish order",
    publishing: "Publishing...",
    resetFilters: "Reset filters",
    writeTitleError: "Please enter an order title",
    shortTitleError: "Title is too short (minimum 5 characters)",
    addressError: "Please enter the job address",
    budgetError: "Budget must be a positive number",
    workersError: "Minimum 1 loader",
    createOrderError: "Could not create the order. Check internet and authorization, then try again.",
    orderDetails: "Order details",
    statusOpen: "Open",
    statusPending: "Pending approval",
    statusInProgress: "In progress",
    statusCompleted: "Completed",
    workerAssigned: "Assigned",
    onWay: "On the way",
    atWork: "On site",
    finished: "Finished",
    aboutText: "GruzOK is a modern platform for quickly finding loaders and handymen. We help customers and performers find each other.",
    faq: [
      { q: "How to order a service?", a: "Click on the 'Create Order' button on the main page and select the desired category." },
      { q: "How to become a performer?", a: "Register in the application and select the role 'I am a performer'." }
    ]
  }
};

type AppLang = keyof typeof TRANSLATIONS;
type AppText = typeof TRANSLATIONS.ru;

const getCategoryLabel = (category: string, t: AppText) => ({
  'Грузчики': t.loaders,
  'Переезд': t.moving,
  'Сборка': t.assembly,
  'Разное': t.other,
  all: t.all,
}[category] || category);

const getStatusLabel = (status: string, t: AppText) => ({
  pending_negotiation: t.statusPending,
  open: t.statusOpen,
  'in-progress': t.statusInProgress,
  completed: t.statusCompleted,
}[status] || status);

const getPaymentMethodLabel = (method: string, t: AppText) => ({
  'Наличные': t.cash,
  'Карта': t.card,
  'СБП': t.sbp,
}[method] || method);

// Logo Component
const Logo = ({ className = "", size = 40, onlyArrow = false, textClassName = "text-2xl" }: { className?: string, size?: number, onlyArrow?: boolean, textClassName?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path 
        d="M6 13L10 17L20 7" 
        stroke="#C1FF00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
    {!onlyArrow && (
      <span 
        className={`font-black tracking-tight text-slate-900 ${textClassName}`}
      >
        ГрузОК
      </span>
    )}
  </div>
);

// Mock Data

const SUPPORT_PROFILE = {
  id: 'support',
  name: 'Диспетчер (Поддержка)',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4',
  rating: 0,
  reviewsCount: 0,
  bio: 'Официальная служба поддержки ГрузОК. Мы работаем 24/7.',
  portfolio: [],
  reviews: [],
  responseTime: '1 мин',
  isOnline: true,
  availability: 'На связи'
};

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'order' | 'payment' | 'system' | 'chat';
  orderId?: string;
}

// Utility Functions
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 999;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getReviewsCount = (profile: any) => {
  if (!profile) return 0;
  if (typeof profile.reviewsCount === 'number') return profile.reviewsCount;
  if (Array.isArray(profile.reviews)) return profile.reviews.length;
  if (typeof profile.reviews === 'number') return profile.reviews;
  return 0;
};

const NOTIFICATION_CHANNEL_ID = 'gruzok-default';

const setupDeviceNotifications = async () => {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await (LocalNotifications as any).createChannel?.({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'GruzOK',
      description: 'Order, chat, and support notifications',
      importance: 4,
      visibility: 1,
    });

    const permissions = await LocalNotifications.checkPermissions();
    if (permissions.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (error) {
    if ('Notification' in window && window.Notification.permission === 'default') {
      await window.Notification.requestPermission();
    }
  }
};

const showDeviceNotification = async (title: string, body: string) => {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const permissions = await LocalNotifications.checkPermissions();
    const displayPermission = permissions.display === 'granted'
      ? permissions.display
      : (await LocalNotifications.requestPermissions()).display;

    if (displayPermission === 'granted') {
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483647),
          title,
          body,
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 250) },
        }]
      });
      return;
    }
  } catch (error) {
    console.warn('Capacitor local notification failed, falling back to browser API:', error);
  }

  if ('Notification' in window && window.Notification.permission === 'granted') {
    new window.Notification(title, {
      body,
      icon: 'https://ais-dev-ujdnun7ulual234fmcddyi-216250874567.europe-west1.run.app/favicon.ico'
    });
  }
};

const registerPushNotifications = async (userId: string) => {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permissions = await PushNotifications.checkPermissions();
    const receivePermission = permissions.receive === 'granted'
      ? permissions.receive
      : (await PushNotifications.requestPermissions()).receive;

    if (receivePermission !== 'granted') {
      await setDoc(doc(db, 'users', userId), {
        pushEnabled: false,
        pushPermission: receivePermission,
        pushPermissionUpdatedAt: serverTimestamp(),
      }, { merge: true });
      return () => {};
    }

    const registrationHandle = await PushNotifications.addListener('registration', async (token) => {
      try {
        await setDoc(doc(db, 'users', userId), {
          fcmToken: token.value,
          pushEnabled: true,
          pushPermission: 'granted',
          fcmTokenUpdatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error('Error saving FCM token:', error);
      }
    });

    const registrationErrorHandle = await PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    const receivedHandle = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      if (notification.title || notification.body) {
        void showDeviceNotification(notification.title || 'GruzOK', notification.body || '');
      }
    });

    const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      console.info('Push notification action:', event);
    });

    await PushNotifications.register();

    return () => {
      registrationHandle.remove();
      registrationErrorHandle.remove();
      receivedHandle.remove();
      actionHandle.remove();
    };
  } catch (error) {
    console.warn('Push notifications are not available in this environment:', error);
    return () => {};
  }
};

// Sub-components
interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

const Header = ({ title, showBack = false, onBack }: HeaderProps) => (
  <div className="page-gutters safe-area-top py-4 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10 transition-colors">
    <div className="flex items-center gap-3">
      {showBack && (
        <button onClick={onBack} className="p-1 -ml-2 text-slate-900">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
    </div>
  </div>
);

interface OrderCardProps {
  order: Order;
  workers?: any[];
  onClick: (order: Order) => void;
  onWorkerClick?: (workerId: string) => void;
  onQuickApply?: (orderId: string) => void;
  hideStatus?: boolean;
  role?: UserRole;
  currentUserId?: string;
  lang?: AppLang;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, workers = [], onClick, onWorkerClick, onQuickApply, hideStatus, role, currentUserId, lang = 'ru' }) => {
  const t = TRANSLATIONS[lang];
  const displayWorkers = workers.filter(w => w.role === 'worker');
  const workersMap = displayWorkers.reduce((acc, w) => {
    const normalizedWorker = { ...w, phone: w.phone || w.phoneNumber || w.contactPhone || '' };
    acc[w.id] = normalizedWorker;
    if (w.uid) acc[w.uid] = normalizedWorker;
    return acc;
  }, {} as Record<string, any>);

  const statusColors: Record<Order['status'], string> = {
    'pending_negotiation': 'bg-amber-50 text-amber-600',
    'open': 'bg-emerald-50 text-emerald-600',
    'in-progress': 'bg-blue-50 text-blue-600',
    'completed': 'bg-slate-100 text-slate-600'
  };

  const statusLabels: Record<Order['status'], string> = {
    'pending_negotiation': t.statusPending,
    'open': t.statusOpen,
    'in-progress': t.statusInProgress,
    'completed': t.statusCompleted
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      onClick={() => onClick(order)}
      whileHover={{  
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        zIndex: 10
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 17,
        opacity: { duration: 0.3 }
      }}
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-4 cursor-pointer transition-all relative"
    >
      <div className="flex justify-between items-start mb-2 gap-4">
        <div className="flex flex-wrap gap-2 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {getCategoryLabel(order.category, t)}
          </span>
          {!hideStatus && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
          )}
        </div>
        <span className="font-bold text-lg text-slate-900 whitespace-nowrap shrink-0">
          {order.status === 'pending_negotiation' ? `~${order.budget}` : order.budget} ₽
        </span>
      </div>
      <h3 className="font-semibold text-slate-900 mb-2 leading-tight">{order.title}</h3>
      
      {order.assignedWorkers && order.assignedWorkers.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {order.assignedWorkers.map(worker => (
            <div 
              key={worker.id}
              className={`flex items-center gap-2 py-1 px-2 bg-slate-50 rounded-lg border border-slate-100 ${onWorkerClick ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
              onClick={(e) => {
                if (onWorkerClick) {
                  e.stopPropagation();
                  onWorkerClick(worker.id);
                }
              }}
            >
              <img src={worker.avatar} className="w-4 h-4 rounded-full object-cover" />
              <span className="text-[10px] font-bold text-slate-700">{worker.name}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${
                worker.status === 'finished' ? 'bg-emerald-500' :
                worker.status === 'at-work' ? 'bg-amber-500' :
                worker.status === 'on-way' ? 'bg-blue-500' : 'bg-slate-300'
              }`} />
            </div>
          ))}
        </div>
      ) : order.workerId ? (
        <div 
          className={`flex items-center gap-2 mb-3 py-1.5 px-3 bg-slate-50 rounded-xl w-fit ${onWorkerClick ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
          onClick={(e) => {
            if (onWorkerClick) {
              e.stopPropagation();
              onWorkerClick(order.workerId!);
            }
          }}
        >
          <img 
            src={workersMap[order.workerId]?.avatar || 'https://picsum.photos/seed/worker1/200'} 
            className="w-5 h-5 rounded-full"
          />
          <span className="text-xs font-medium text-slate-600">
            {workersMap[order.workerId]?.name || 'Иван Петров'}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-slate-500 text-sm">
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            <span className="truncate max-w-[120px]">{order.address}</span>
          </div>
          {order.distance !== undefined && (
            <div className="flex items-center gap-1">
              <Navigation size={14} />
              <span>{order.distance} {lang === 'en' ? 'km' : 'км'}</span>
            </div>
          )}
        </div>

        {role === 'worker' && order.status === 'open' && onQuickApply && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (!order.candidates?.includes(currentUserId || '')) {
                onQuickApply(order.id);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all ${
              order.candidates?.includes(currentUserId || '')
                ? 'bg-slate-100 text-slate-400 cursor-default'
                : 'bg-blue-600 text-white'
            }`}
          >
            {order.candidates?.includes(currentUserId || '') ? (lang === 'en' ? 'Applied' : 'Откликнулся') : (lang === 'en' ? 'Apply' : 'Откликнуться')}
          </button>
        )}
      </div>
    </motion.div>
  );
};

interface OnboardingProps {
  onLogin: () => void;
}

// Phone Mask Helper
const formatPhoneNumber = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  const nationalNumber = (digits.startsWith('7') ? digits.slice(1) : digits).slice(0, 10);
  if (!nationalNumber) return '';
  if (nationalNumber.length <= 3) return `+7 (${nationalNumber}`;
  if (nationalNumber.length <= 6) return `+7 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3)}`;
  if (nationalNumber.length <= 8) return `+7 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;
  return `+7 (${nationalNumber.slice(0, 3)}) ${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6, 8)}-${nationalNumber.slice(8)}`;
};

const PhoneInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatPhoneNumber(e.target.value));
  };

  return (
    <input 
      type="tel" 
      value={formatPhoneNumber(value)}
      onChange={handleChange}
      placeholder="+7 (999) 999-99-99" 
      className={className || "w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors"} 
    />
  );
};

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

const formatTimeInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const isoDateToDisplay = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

const displayDateToIso = (value: string) => {
  const parts = value.split('.');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return '';
  return `${year}-${month}-${day}`;
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const resizeImageFile = (file: File, maxSize = 1280, quality = 0.82) => new Promise<File>((resolve) => {
  if (!file.type.startsWith('image/')) {
    resolve(file);
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(file);
        return;
      }
      resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(file);
  };

  image.src = objectUrl;
});

const PasswordField = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-4 pr-12 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none transition-colors"
      />
      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 active:scale-95 transition-transform"
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

const DateField = ({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    if (pickerRef.current?.showPicker) {
      pickerRef.current.showPicker();
      return;
    }
    pickerRef.current?.click();
  };

  return (
    <div className="relative">
      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="text"
        readOnly
        value={value}
        onClick={openPicker}
        onFocus={openPicker}
        placeholder={placeholder}
        className={`w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none transition-colors cursor-pointer ${className}`}
      />
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        value={displayDateToIso(value)}
        onChange={(e) => onChange(isoDateToDisplay(e.target.value))}
        className="absolute pointer-events-none opacity-0 w-0 h-0"
      />
    </div>
  );
};

const TimeField = ({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    if (pickerRef.current?.showPicker) {
      pickerRef.current.showPicker();
      return;
    }
    pickerRef.current?.click();
  };

  return (
    <div className="relative">
      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="text"
        readOnly
        value={value}
        onClick={openPicker}
        onFocus={openPicker}
        placeholder={placeholder}
        className={`w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none transition-colors cursor-pointer ${className}`}
      />
      <input
        ref={pickerRef}
        type="time"
        tabIndex={-1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute pointer-events-none opacity-0 w-0 h-0"
      />
    </div>
  );
};

const Login = ({ onBack, onLogin }: { onBack: () => void, onLogin: (phone: string, password: string) => void }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-white z-50 flex flex-col screen-shell"
    >
      <button onClick={onBack} className="mb-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1">
        <h2 className="text-3xl font-black mb-2 tracking-tight">Вход</h2>
        <p className="text-slate-500 mb-8">Введите номер телефона и пароль</p>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Телефон</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Пароль</label>
            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder="Минимум 6 символов"
            />
          </div>
        </div>
      </div>

      <button 
        onClick={() => onLogin(phone, password)}
        disabled={phone.length < 18 || password.length < 6}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform mt-8 disabled:opacity-50"
      >
        Войти
      </button>
    </motion.div>
  );
};

const Register = ({ onBack, onRegister }: { onBack: () => void, onRegister: (role: UserRole, name: string, phone: string, password: string) => void }) => {
  const [role, setRole] = useState<UserRole>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleStartRegistration = async () => {
    setIsChecking(true);
    setError('');
    
    try {
      if (password.length < 6) {
        setError('Пароль должен быть не короче 6 символов');
      } else if (password !== passwordConfirm) {
        setError('Пароли не совпадают');
      } else {
        onRegister(role, name, phone, password);
      }
    } catch (err) {
      setError('Ошибка при проверке данных. Попробуйте позже.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-white z-50 flex flex-col screen-shell"
    >
      <button onClick={onBack} className="mb-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1 overflow-y-auto">
        <h2 className="text-3xl font-black mb-2 tracking-tight">Регистрация</h2>
        <p className="text-slate-500 mb-8">Выберите роль и создайте пароль</p>

        <div className="space-y-4">
          <button 
            onClick={() => setRole('customer')}
            className={`w-full p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${role === 'customer' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === 'customer' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <UserIcon size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Я заказчик</p>
              <p className="text-xs text-slate-500">Ищу помощь с работой</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('worker')}
            className={`w-full p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${role === 'worker' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === 'worker' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Briefcase size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Я исполнитель</p>
              <p className="text-xs text-slate-500">Хочу зарабатывать</p>
            </div>
          </button>

          <button 
            onClick={() => setRole('dispatcher')}
            className={`w-full p-6 rounded-3xl border-2 flex items-center gap-4 transition-all ${role === 'dispatcher' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role === 'dispatcher' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Navigation size={24} />
            </div>
            <div className="text-left">
              <p className="font-bold">Я диспетчер</p>
              <p className="text-xs text-slate-500">Управляю заказами</p>
            </div>
          </button>
        </div>

        <div className="mt-12 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Ваше имя</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Иван Иванов" 
              className="w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Телефон</label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Пароль</label>
            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder="Минимум 6 символов"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Повторите пароль</label>
            <PasswordField
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              placeholder="Повторите пароль"
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs font-bold mt-2">{error}</p>
          )}
        </div>
      </div>

      <button 
        onClick={handleStartRegistration}
        disabled={!name || phone.length < 18 || password.length < 6 || passwordConfirm.length < 6 || isChecking}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform mt-8 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isChecking ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : 'Создать аккаунт'}
      </button>
    </motion.div>
  );
};

const RulesPage = ({ onAccept }: { onAccept: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="absolute inset-0 bg-white z-[100] flex flex-col screen-shell"
    >
      <div className="flex-1 overflow-y-auto">
        <h2 className="text-3xl font-black mb-8 tracking-tight">Правила</h2>
        
        <div className="space-y-6">
          {[
            "Форма одежды — опрятная",
            "Нецензурная лексика запрещена",
            "Спорные вопросы решаются с администратором",
            "Данные правила обязательны к исполнению",
            "Нарушение правил ведет к блокировке",
            "Удаление за перебивания заказчика",
            "Администрация вправе изменять правила",
            "Продолжая использование, вы соглашаетесь",
            "Спасибо, что дочитали до конца!"
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} />
              </div>
              <p className="text-slate-700 font-medium leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-8 safe-area-bottom">
        <button 
          onClick={onAccept}
          className="w-full bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-200 active:scale-95 transition-all"
        >
          Принять
        </button>
      </div>
    </motion.div>
  );
};

const Onboarding = ({ onLogin, onRegister }: { onLogin: (phone: string, password: string) => void, onRegister: () => void }) => {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="flex-1 flex flex-col screen-shell items-center justify-center text-center">
      <AnimatePresence>
        {showLogin && (
          <Login onBack={() => setShowLogin(false)} onLogin={onLogin} />
        )}
      </AnimatePresence>
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-8"
      >
        <Logo size={64} className="flex-col gap-4" textClassName="text-4xl" />
      </motion.div>
      <p className="text-slate-500 mb-12 leading-relaxed">
        Сервис поиска грузчиков и разнорабочих за 15 минут. Помогаем с переездами и тяжелой работой.
      </p>
      <div className="w-full space-y-4">
        <button 
          onClick={() => setShowLogin(true)}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          Войти по номеру
        </button>
        <button 
          onClick={onRegister}
          className="w-full bg-white border-2 border-slate-100 text-slate-900 py-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform"
        >
          Создать аккаунт
        </button>
      </div>
    </div>
  );
};

interface CustomerHomeProps {
  user: User;
  orders: Order[];
  workers: any[];
  lang: AppLang;
  onOrderClick: (order: Order) => void;
  onWorkerClick: (workerId: string) => void;
  onCreateClick: (category?: string) => void;
  onShowSupport?: () => void;
}

const CustomerHome = ({ user, orders, workers, lang, onOrderClick, onWorkerClick, onCreateClick, onShowSupport, isLoading }: CustomerHomeProps & { isLoading?: boolean }) => {
  const t = TRANSLATIONS[lang];
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredOrders = orders.filter(o => {
    const isMine = o.customerId === user.id;
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchCategory = filterCategory === 'all' || o.category === filterCategory;
    return isMine && matchStatus && matchCategory;
  });

  return (
    <div className="page-gutters py-6 overflow-y-auto flex-1">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2 text-slate-900">{t.hello}, {user.name}! 👋</h2>
        <p className="text-slate-500">{t.needHelp}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { icon: <Briefcase size={24} />, label: 'Грузчики', text: t.loaders, color: 'bg-orange-50 text-orange-600' },
          { icon: <MapPin size={24} />, label: 'Переезд', text: t.moving, color: 'bg-blue-50 text-blue-600' },
          { icon: <PlusCircle size={24} />, label: 'Сборка', text: t.assembly, color: 'bg-emerald-50 text-emerald-600' },
          { icon: <Search size={24} />, label: 'Разное', text: t.other, color: 'bg-purple-50 text-purple-600' },
        ].map((cat, i) => (
          <button 
            key={i} 
            onClick={() => onCreateClick(cat.label)}
            className={`${cat.color} p-4 rounded-2xl flex flex-col items-center gap-2 font-semibold transition-all active:scale-95 shadow-sm`}
          >
            {cat.icon}
            <span className="text-sm">{cat.text}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-900">{t.yourOrders}</h3>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
        >
          <Sliders size={20} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
        {[
          { id: 'all', label: t.all },
          { id: 'open', label: t.open },
          { id: 'in-progress', label: t.inProgress },
          { id: 'completed', label: t.completed },
        ].map(status => (
          <button
            key={status.id}
            onClick={() => setFilterStatus(status.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${filterStatus === status.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
          >
            {status.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.category}</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'Грузчики', 'Переезд', 'Сборка', 'Разное'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      filterCategory === cat 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    {getCategoryLabel(cat, t)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filteredOrders.length > 0 ? (
        filteredOrders.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            workers={workers}
            onClick={onOrderClick} 
            onWorkerClick={onWorkerClick}
            role="customer"
            lang={lang}
          />
        ))
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-3xl">
          <Search className="text-slate-300 mx-auto mb-2" size={32} />
          <p className="text-slate-500 text-sm">{t.noOrders}</p>
        </div>
      )}

      <button 
        onClick={() => onCreateClick('Грузчики')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
      >
        <PlusCircle size={28} />
      </button>

      <button 
        onClick={() => onShowSupport?.()}
        className="fixed bottom-40 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
        title={t.supportTitle}
      >
        <MessageSquare size={24} />
      </button>
    </div>
  );
};

interface WorkerHomeProps {
  user?: User;
  orders: Order[];
  workers: any[];
  lang: AppLang;
  onOrderClick: (order: Order) => void;
  onQuickApply: (orderId: string) => void;
  onWorkerClick: (workerId: string) => void;
  onShowSupport?: () => void;
  currentUserId?: string;
}

const WorkerHome = ({ user, orders, workers, lang, onOrderClick, onQuickApply, onWorkerClick, onShowSupport, isLoading, currentUserId }: WorkerHomeProps & { isLoading?: boolean }) => {
  const t = TRANSLATIONS[lang];
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('open');
  const [filterDistance, setFilterDistance] = useState<number>(50);
  const [minBudget, setMinBudget] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchCenter, setSearchCenter] = useState<[number, number]>(
    user?.lat && user?.lng ? [user.lat, user.lng] : [55.7558, 37.6173]
  );
  const [isLocating, setIsLocating] = useState(false);

  const categories = ['all', 'Грузчики', 'Переезд', 'Сборка', 'Разное'];

  useEffect(() => {
    if (user?.lat && user?.lng) {
      setSearchCenter([user.lat, user.lng]);
    }
  }, [user?.lat, user?.lng]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(lang === 'en' ? 'Geolocation is not available on this device' : 'Геолокация недоступна на этом устройстве');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchCenter([position.coords.latitude, position.coords.longitude]);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        const message = error.code === error.PERMISSION_DENIED
          ? (lang === 'en' ? 'Allow location access in phone settings' : 'Разрешите приложению доступ к геолокации в настройках телефона')
          : (lang === 'en' ? 'Could not get location. Check GPS and internet' : 'Не удалось получить местоположение. Проверьте GPS и интернет');
        alert(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setSearchCenter([e.latlng.lat, e.latlng.lng]);
      },
    });
    return null;
  };

  const filteredOrders = orders.filter(order => {
    const matchCategory = filterCategory === 'all' || order.category === filterCategory;
    const matchStatus = filterStatus === 'all' || order.status === filterStatus;
    
    let matchDistance = true;
    if (order.lat && order.lng) {
      const dist = calculateDistance(searchCenter[0], searchCenter[1], order.lat, order.lng);
      matchDistance = dist <= filterDistance;
    } else {
      matchDistance = (order.distance || 0) <= filterDistance;
    }
    
    const matchBudget = order.budget >= minBudget;
    return matchCategory && matchStatus && matchDistance && matchBudget;
  });

  return (
    <div className="page-gutters py-6 overflow-y-auto flex-1">
      <div className="bg-slate-900 text-white p-6 rounded-3xl mb-6 relative overflow-hidden transition-colors">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">{lang === 'en' ? 'You are online' : 'Вы на линии'}</h2>
          <p className="text-slate-400 text-sm mb-4">{lang === 'en' ? `${filteredOrders.length} nearby matching orders` : `Рядом ${filteredOrders.length} подходящих заказов`}</p>
          <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            {lang === 'en' ? `Search radius: ${filterDistance} km` : `Радиус поиска: ${filterDistance} км`}
          </div>
        </div>
        <Briefcase className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-900">{t.availableOrders}</h3>
        <div className="flex gap-2">
          <button 
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
            className="p-2 bg-white border border-slate-100 rounded-xl text-blue-600 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            title={lang === 'en' ? 'My location' : 'Мое местоположение'}
          >
            <Navigation size={20} className={isLocating ? 'animate-spin' : ''} />
          </button>
          <div className="bg-slate-100 p-1 rounded-xl flex transition-colors">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <MapIcon size={18} />
            </button>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
          >
            <Sliders size={20} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
        {[
          { id: 'all', label: t.all },
          { id: 'open', label: t.open },
          { id: 'in-progress', label: t.inProgress },
          { id: 'completed', label: t.completed },
        ].map(status => (
          <button
            key={status.id}
            onClick={() => setFilterStatus(status.id as any)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${filterStatus === status.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
          >
            {status.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.category}</label>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'all' ? t.allCategories : getCategoryLabel(cat, t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{lang === 'en' ? 'Min. budget (₽)' : 'Мин. бюджет (₽)'}</label>
                <select 
                  value={minBudget}
                  onChange={(e) => setMinBudget(Number(e.target.value))}
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>{lang === 'en' ? 'Any' : 'Любой'}</option>
                  <option value={1000}>{lang === 'en' ? 'from 1000' : 'от 1000'}</option>
                  <option value={2000}>{lang === 'en' ? 'from 2000' : 'от 2000'}</option>
                  <option value={3000}>{lang === 'en' ? 'from 3000' : 'от 3000'}</option>
                  <option value={5000}>{lang === 'en' ? 'from 5000' : 'от 5000'}</option>
                  <option value={10000}>{lang === 'en' ? 'from 10000' : 'от 10000'}</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Max. distance' : 'Макс. расстояние'}</label>
                <span className="text-xs font-bold text-blue-600">{filterDistance} км</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={filterDistance}
                onChange={(e) => setFilterDistance(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setViewMode('map')}
                className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-xl text-xs font-bold text-blue-600 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <MapIcon size={14} />
                {lang === 'en' ? 'Choose on map' : 'Выбрать на карте'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[400px] w-full rounded-3xl overflow-hidden border border-slate-100 shadow-sm relative z-0">
            <MapContainer 
              center={searchCenter} 
              zoom={10} 
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapEvents />
              <ChangeView center={searchCenter} />
              <Marker position={searchCenter} icon={L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.2);"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}>
                <Popup>
                  <div className="text-xs font-bold text-center">{lang === 'en' ? 'Search center' : 'Центр поиска'}</div>
                </Popup>
              </Marker>
              <Circle 
                center={searchCenter}
                radius={filterDistance * 1000}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
              />
              {filteredOrders.filter(o => o.lat && o.lng).map(order => (
                <Marker 
                  key={order.id} 
                  position={[order.lat!, order.lng!]}
                  icon={L.divIcon({
                    className: 'custom-order-icon',
                    html: `<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup>
                    <div className="p-2 min-w-[180px] font-sans">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-wider">
                          {getCategoryLabel(order.category, t)}
                        </span>
                        <span className="font-bold text-slate-900">{order.budget} ₽</span>
                      </div>
                      <h4 className="font-bold text-sm mb-1 text-slate-900">{order.title}</h4>
                      <p className="text-[10px] text-slate-500 mb-3 flex items-center gap-1">
                        <MapPin size={10} /> {order.address}
                      </p>
                      <button 
                        onClick={() => onOrderClick(order)}
                        className="w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-800"
                      >
                        {lang === 'en' ? 'Details' : 'Подробнее'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          filteredOrders.length > 0 ? (
            filteredOrders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                workers={workers}
                onClick={onOrderClick} 
                onWorkerClick={onWorkerClick}
                onQuickApply={onQuickApply}
                currentUserId={currentUserId}
                role="worker"
                lang={lang}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-slate-300" size={32} />
              </div>
              <p className="text-slate-500 font-medium">{t.noOrders}</p>
              <button 
                onClick={() => {
                  setFilterCategory('all');
                  setFilterDistance(50);
                  setMinBudget(0);
                }}
                className="text-blue-600 text-sm font-bold mt-2"
              >
                {t.resetFilters}
              </button>
            </div>
          )
        )}
      </div>

      <button 
        onClick={() => onShowSupport?.()}
        className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
        title={t.supportTitle}
      >
        <MessageSquare size={24} />
      </button>
    </div>
  );
};

interface ChatListProps {
  userId: string;
  chats: Chat[];
  lang: AppLang;
  onChatClick: (chat: Chat) => void;
}

const ChatList = ({ userId, chats, lang, onChatClick }: ChatListProps) => {
  const t = TRANSLATIONS[lang];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">{t.messages}</h2>
        <div className="space-y-2">
          {chats.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>{t.noChats}</p>
            </div>
          )}
          {chats.map(chat => (
            <button 
              key={chat.id}
              onClick={() => onChatClick(chat)}
              className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-left relative"
            >
              <img src={chat.otherUserAvatar} className="w-14 h-14 rounded-full object-cover" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{chat.otherUserName}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    {chat.lastMessageAt ? new Date(chat.lastMessageAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-1">{chat.lastMessage || t.startChat}</p>
              </div>
              {chat.unreadCount && chat.unreadCount[userId] > 0 && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {chat.unreadCount[userId]}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ChatRoomProps {
  userId: string;
  chat: Chat;
  lang?: AppLang;
  onBack: () => void;
}

const ChatRoom = ({ userId, chat, lang = 'ru', onBack }: ChatRoomProps) => {
  const t = TRANSLATIONS[lang];
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    return chatService.getMessages(chat.id, (updatedMessages) => {
      setMessages(updatedMessages);
      chatService.markAsRead(chat.id, userId, updatedMessages);
    });
  }, [chat.id, userId]);

  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    
    // Scroll immediately and after a small delay
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, chat.id]); // Added chat.id as dependency

  const handleSend = async () => {
    if (!newMsg.trim()) return;

    const recipientId =
      chat.participants?.find((participant) => participant !== userId) ||
      (chat.workerId === 'support' || chat.dispatcherId === 'support'
        ? 'support'
        : chat.customerId === userId
          ? chat.workerId
          : chat.workerId === userId
            ? chat.customerId
            : chat.dispatcherId === userId
              ? chat.customerId || chat.workerId
              : chat.dispatcherId || chat.customerId || chat.workerId);
    if (!recipientId) return;
    await chatService.sendMessage(chat.id, userId, newMsg, recipientId);
    setNewMsg('');
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-50 flex flex-col"
    >
      <Header title={chat.otherUserName || t.chat} showBack onBack={onBack} />
      <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderId === userId ? 'justify-end' : 'justify-start'}`}>
            <div className="flex flex-col gap-1 max-w-[80%]">
              <div className={`p-4 rounded-2xl text-sm ${m.senderId === userId ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-900 rounded-bl-none'}`}>
                {m.text}
              </div>
              <div className={`flex items-center gap-1 text-[9px] font-bold uppercase ${m.senderId === userId ? 'justify-end text-slate-400' : 'justify-start text-slate-400'}`}>
                {new Date(m.createdAt?.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.senderId === userId && (
                  m.readAt ? <CheckCircle2 size={10} className="text-blue-500" /> : <Check size={10} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-slate-100 flex gap-2">
        <input 
          type="text" 
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t.messagePlaceholder}
          className="flex-1 bg-slate-100 border-none rounded-full px-6 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button 
          onClick={handleSend}
          className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform"
        >
          <Send size={20} />
        </button>
      </div>
    </motion.div>
  );
};

interface ProfileProps {
  user: User;
  orders: Order[];
  lang: AppLang;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
  onShowHistory?: () => void;
  onShowNotifications?: () => void;
  onShowSettings?: () => void;
  onShowSupport?: () => void;
}

const Profile = ({ user, orders, lang, onLogout, onUpdateUser, onShowHistory, onShowNotifications, onShowSettings, onShowSupport }: ProfileProps) => {
  const t = TRANSLATIONS[lang];
  const [activeSubTab, setActiveSubTab] = useState<'main' | 'portfolio' | 'reviews'>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<PortfolioItem | null>(null);
  const [portfolioUploadState, setPortfolioUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [portfolioUploadMessage, setPortfolioUploadMessage] = useState('');
  const userReviews = Array.isArray(user.reviews) ? user.reviews : [];
  const displayedRating = userReviews.length > 0
    ? Math.round((userReviews.reduce((sum, review) => sum + (review.rating || 0), 0) / userReviews.length) * 10) / 10
    : (user.rating || 0);

  const completedOrders = orders.filter(o => {
    const isCompleted = o.status === 'completed';
    const isInvolved = user.role === 'worker' 
      ? (o.workerId === user.id || o.assignedWorkers?.some(w => w.id === user.id))
      : o.customerId === user.id;
    return isCompleted && isInvolved;
  });

  const totalBalance = completedOrders.reduce((sum, o) => sum + (o.budget || 0), 0);
  const ordersCount = completedOrders.length;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    name: user.name,
    phone: user.phone || '',
    skills: user.skills?.join(', ') || '',
    experience: user.experience || '',
    bio: user.bio || ''
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'portfolio' | 'avatar') => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file || !onUpdateUser) return;

    if (target === 'avatar') {
      try {
        const { uploadAvatar } = await import('./firebase');
        const uid = user.id;
        const url = await uploadAvatar(uid, file);
        onUpdateUser({ ...user, avatar: url });
      } catch (err) {
        console.error('Avatar upload error:', err);
      }
    } else {
      setPortfolioUploadState('uploading');
      setPortfolioUploadMessage(t.uploading);
      try {
        const { storage } = await import('./firebase');
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const uploadFile = file.type.startsWith('image/') ? await resizeImageFile(file) : file;
        const storageRef = ref(storage, `portfolio/${user.id}/${Date.now()}_${uploadFile.name}`);
        await uploadBytes(storageRef, uploadFile);
        const url = await getDownloadURL(storageRef);
        const type = uploadFile.type.startsWith('video') ? 'video' : 'image';
        const newItem: PortfolioItem = { type, url };
        const updatedPortfolio = [...(user.portfolio || []), newItem];
        await Promise.resolve(onUpdateUser({ ...user, portfolio: updatedPortfolio }));
        setPortfolioUploadState('idle');
        setPortfolioUploadMessage('');
      } catch (err) {
        console.error('Portfolio upload error:', err);
        if (file.type.startsWith('image/')) {
          try {
            const fallbackFile = await resizeImageFile(file, 900, 0.72);
            const url = await readFileAsDataUrl(fallbackFile);
            const updatedPortfolio = [...(user.portfolio || []), { type: 'image' as const, url }];
            await Promise.resolve(onUpdateUser({ ...user, portfolio: updatedPortfolio }));
            setPortfolioUploadState('idle');
            setPortfolioUploadMessage('');
            return;
          } catch (fallbackError) {
            console.error('Portfolio fallback error:', fallbackError);
          }
        }
        setPortfolioUploadState('error');
        setPortfolioUploadMessage(lang === 'en' ? 'Could not add the file. Try another photo or check Firebase Storage.' : 'Не удалось добавить файл. Попробуйте другое фото или проверьте Firebase Storage.');
      }
    }
  };

  const handleSaveEdit = () => {
    if (!onUpdateUser) return;
    onUpdateUser({
      ...user,
      name: editForm.name,
      phone: editForm.phone,
      skills: editForm.skills.split(',').map(s => s.trim()).filter(s => s !== ''),
      experience: editForm.experience,
      bio: editForm.bio
    });
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={(e) => handleFileChange(e, 'portfolio')}
      />
      <input 
        type="file" 
        ref={avatarInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => handleFileChange(e, 'avatar')}
      />

      {/* Header with Tabs */}
      <div className="safe-area-top pt-6 page-gutters border-b border-slate-100">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4 group">
            <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover" />
            <button 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full border-2 border-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <Camera size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{user.name}</h2>
            <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-blue-600">
              <Edit2 size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1 text-amber-500 mt-1">
            <Star size={16} fill="currentColor" />
            <span className="font-bold">{displayedRating}</span>
            <span className="text-slate-400 text-sm font-normal ml-1">
              ({userReviews.length} {t.reviews.toLowerCase()})
            </span>
          </div>
        </div>

        <div className="-mx-5 overflow-x-auto no-scrollbar">
          <div className="flex gap-8 min-w-max px-5">
          {[
            { id: 'main', label: t.profile, icon: <UserIcon size={18} /> },
            ...(user.role === 'worker' ? [{ id: 'portfolio', label: lang === 'en' ? 'Portfolio' : 'Портфолио', icon: <Briefcase size={18} /> }] : []),
            { id: 'reviews', label: t.reviews, icon: <Star size={18} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`shrink-0 pb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
                activeSubTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeSubTab === tab.id && (
                <motion.div layoutId="subtab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeSubTab === 'main' ? (
            <motion.div 
              key="main"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="p-6 space-y-8"
            >
              {user.bio && (
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">{t.aboutMe}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                    "{user.bio}"
                  </p>
                </div>
              )}

                  {user.role === 'worker' && (
                    <>
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                          <ShieldCheck size={12} className="text-blue-600" /> {lang === 'en' ? 'Skills and competencies' : 'Навыки и компетенции'}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {user.skills?.length ? user.skills.map((skill, i) => (
                            <motion.span 
                              key={i} 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border border-blue-100 flex items-center gap-1.5"
                            >
                              <div className="w-1 h-1 bg-blue-600 rounded-full" />
                              {skill}
                            </motion.span>
                          )) : (
                            <p className="text-xs text-slate-400 italic">{t.noSkills}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                          <Briefcase size={12} className="text-blue-600" /> {t.experience}
                        </h3>
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-full -mr-12 -mt-12" />
                          <p className="text-slate-600 text-sm leading-relaxed relative z-10">
                            {user.experience || t.noExperience}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t.orders, val: ordersCount.toString() },
                  { label: lang === 'en' ? 'Balance' : 'Баланс', val: `${totalBalance} ₽` },
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{stat.label}</p>
                    <p className="font-bold text-slate-900">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">{t.contactData}</h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.phone}</p>
                    <p className="font-bold text-slate-900">{user.phone ? formatPhoneNumber(user.phone) : t.notSpecified}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { icon: <History size={20} />, label: t.orderHistory, action: onShowHistory },
                  { icon: <Bell size={20} />, label: t.notifications, action: onShowNotifications },
                  { icon: <Settings size={20} />, label: t.settings, action: onShowSettings },
                  ...(user.role !== 'dispatcher'
                    ? [{ icon: <MessageSquare size={20} />, label: t.support, action: onShowSupport }]
                    : []),
                ].map((item, i) => (
                  <button 
                    key={i} 
                    onClick={item.action}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-slate-400">{item.icon}</div>
                      <span className="font-semibold">{item.label}</span>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                  </button>
                ))}
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors mt-4"
                >
                  <LogOut size={20} />
                  <span className="font-semibold">{t.logout}</span>
                </button>
              </div>
            </motion.div>
          ) : activeSubTab === 'portfolio' ? (
            <motion.div 
              key="portfolio"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900">{t.myWorks}</h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={portfolioUploadState === 'uploading'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase shadow-lg shadow-blue-200"
                >
                  <Plus size={16} /> {portfolioUploadState === 'uploading' ? t.uploading : t.add}
                </button>
              </div>
              {portfolioUploadMessage && (
                <p className={`mb-4 text-xs font-semibold ${portfolioUploadState === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                  {portfolioUploadMessage}
                </p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {user.portfolio?.map((item, i) => (
                    <motion.div 
                      key={i} 
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedMedia(item)}
                      className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-black cursor-pointer group"
                    >
                      {item.type === 'image' ? (
                        <img src={item.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="relative w-full h-full">
                          <img src={item.thumbnail || item.url} className="w-full h-full object-cover opacity-60" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30">
                              <Play size={24} fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={portfolioUploadState === 'uploading'}
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-400 transition-colors bg-slate-50"
                >
                  <Camera size={32} className="mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t.upload}</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-6"
            >
              <h3 className="text-lg font-bold text-slate-900">{t.reviews} ({userReviews.length})</h3>
              <div className="space-y-4">
                {userReviews.map((review) => (
                  <div key={review.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <img src={review.avatar} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="font-bold text-sm">{review.author}</p>
                          <p className="text-[10px] text-slate-400">{review.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star size={12} fill="currentColor" />
                        <span className="text-xs font-bold">{review.rating}</span>
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">{review.text}</p>
                  </div>
                ))}
                {userReviews.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Star size={32} className="mx-auto mb-2 opacity-20" />
                    <p>{t.noReviews}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md max-h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-48px)] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="shrink-0 p-6 border-b border-slate-100 flex justify-between items-center safe-area-top">
                <h3 className="text-xl font-bold">{t.editProfile}</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 safe-area-bottom">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.name}</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.phone}</label>
                  <PhoneInput
                    value={editForm.phone}
                    onChange={(phone) => setEditForm({ ...editForm, phone })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                {user.role === 'worker' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'Skills (comma separated)' : 'Навыки (через запятую)'}</label>
                      <input 
                        type="text" 
                        value={editForm.skills}
                        onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder={lang === 'en' ? 'Moving, Furniture assembly...' : 'Грузоперевозки, Сборка мебели...'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'en' ? 'About me (Bio)' : 'О себе (Bio)'}</label>
                      <textarea 
                        rows={3}
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder={lang === 'en' ? 'Tell us a little about yourself...' : 'Расскажите немного о себе...'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.experience}</label>
                      <textarea 
                        rows={4}
                        value={editForm.experience}
                        onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                      />
                    </div>
                  </>
                )}
                <button 
                  onClick={handleSaveEdit}
                  className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  <Check size={20} /> {t.saveChanges}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMedia(null)}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
          >
            <button className="absolute top-6 right-6 text-white/60 hover:text-white p-2">
              <X size={32} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-full max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.type === 'image' ? (
                <img src={selectedMedia.url} className="w-full h-full object-contain" />
              ) : (
                <video src={selectedMedia.url} controls autoPlay className="w-full h-full object-contain" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WorkerProfile = ({ workerId, workers, orders, role, onBack, onSelect, onOrderClick }: { 
  workerId: string, 
  workers: any[],
  orders: Order[],
  role: string,
  onBack: () => void, 
  onSelect?: () => void,
  onOrderClick?: (order: Order) => void
}) => {
  const displayWorkers = workers.filter(w => w.role === 'worker');
  const profile = (displayWorkers.find(w => w.id === workerId || w.uid === workerId) || {
    id: workerId,
    name: 'Исполнитель',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=worker',
    rating: 0,
    reviewsCount: 0,
    bio: 'Информация пока не заполнена',
    portfolio: [],
    skills: [],
    reviews: [],
    responseTime: '',
    isOnline: false
  }) as WorkerProfileData & Record<string, any>;
  const profileReviews = Array.isArray(profile.reviews) ? profile.reviews : [];
  const profileRating = profileReviews.length > 0
    ? Math.round((profileReviews.reduce((sum: number, review: Review) => sum + (review.rating || 0), 0) / profileReviews.length) * 10) / 10
    : (profile.rating || 0);
  const profileReviewsCount = profileReviews.length || profile.reviewsCount || 0;
  const profileSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const profilePortfolio = Array.isArray(profile.portfolio) ? profile.portfolio : [];

  const workerHistory = orders.filter(o => 
    o.workerId === workerId || 
    o.assignedWorkers?.some(aw => aw.id === workerId) ||
    o.candidates?.includes(workerId)
  );

  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<{
    type: 'image' | 'video';
    url: string;
  } | null>(null);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-[70] flex flex-col transition-colors"
    >
      <div className="relative h-64">
        <img src={profile.avatar} className="w-full h-full object-cover" />
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white">
          <h2 className="text-2xl font-bold">{profile.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1 text-amber-400">
              <Star size={14} fill="currentColor" />
              <span className="font-bold">{profileRating}</span>
            </div>
            <span className="text-white/60 text-sm">• {profileReviewsCount} отзывов</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto page-gutters py-6 space-y-8">
        <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-colors">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Среднее время ответа</span>
            </div>
            <span className="font-bold text-slate-900">{profile.responseTime || '—'}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <div className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Статус</span>
            </div>
            <span className={`font-bold ${profile.isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
              {profile.isOnline ? 'В сети' : 'Не в сети'}
            </span>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-2 text-slate-900">О себе</h3>
          <p className="text-slate-600 leading-relaxed mb-6">{profile.bio}</p>

          {profileSkills.length > 0 && (
            <div className="mb-6">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Навыки</h4>
              <div className="flex flex-wrap gap-2">
                {profileSkills.map((skill: string, i: number) => (
                  <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.experience && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Опыт работы</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{profile.experience}</p>
            </div>
          )}
        </div>

        {role === 'dispatcher' && (
          <div>
            <h3 className="font-bold text-lg mb-4 text-slate-900">История заказов</h3>
            <div className="space-y-3">
              {workerHistory.length > 0 ? (
                workerHistory.map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => onOrderClick?.(order)}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center cursor-pointer hover:border-blue-200 transition-all"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{order.title}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">{order.date || 'Дата не указана'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                        order.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        order.status === 'in-progress' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {order.status === 'completed' ? 'Завершен' :
                        order.status === 'in-progress' ? 'В работе' : 'Ожидает'}
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-1">{order.budget} ₽</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm italic">История заказов пуста</p>
              )}
            </div>
          </div>
        )}
       

        <div>
          <h3 className="font-bold text-lg mb-4 text-slate-900">Портфолио</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {(profile.portfolio || []).map((item: any, i: number) => {
              const isVideo = typeof item === 'object' ? item.type === 'video' : false;
              const url = typeof item === 'object' ? item.url : item;
              const thumb = typeof item === 'object' ? item.thumbnail || item.url : item;

              return (
                <div
                  key={i}
                  className="relative flex-shrink-0 group cursor-pointer"
                  onClick={() =>
                    setSelectedPortfolioItem({
                      type: isVideo ? 'video' : 'image',
                      url,
                    })
                  }
                >
                  <img
                    src={thumb}
                    className="w-48 h-32 rounded-2xl object-cover border border-slate-100 shadow-sm"
                    referrerPolicy="no-referrer"
                  />

                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                      <div className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-blue-600 shadow-lg">
                        <Play size={20} fill="currentColor" />
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <button
                      type="button"
                      className="text-white text-xs font-bold px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPortfolioItem({
                          type: isVideo ? 'video' : 'image',
                          url,
                        });
                      }}
                    >
                      {isVideo ? 'Смотреть видео' : 'Увеличить'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-4 text-slate-900">Отзывы</h3>
          <div className="space-y-4">
            {profileReviews.map(review => (
              <div key={review.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-900">{review.author}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{review.date}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={10} fill={i < review.rating ? 'currentColor' : 'none'} className={i < review.rating ? '' : 'text-slate-300'} />
                  ))}
                </div>
                <p className="text-sm text-slate-600">{review.text}</p>
              </div>
            ))}
            {profileReviews.length === 0 && (
              <p className="text-slate-400 text-sm italic">Отзывов пока нет</p>
            )}
          </div>
        </div>
      </div>

      {onSelect && (
        <div className="page-gutters py-6 border-t border-slate-100 safe-area-bottom transition-colors">
          <button 
            onClick={onSelect}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            Выбрать исполнителя
          </button>
        </div>
      )}

      {selectedPortfolioItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPortfolioItem(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            onClick={() => setSelectedPortfolioItem(null)}
          >
            ×
          </button>

          {selectedPortfolioItem.type === 'video' ? (
            <video
              src={selectedPortfolioItem.url}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={selectedPortfolioItem.url}
              className="max-w-full max-h-full object-contain rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </motion.div>
  );
};

const ConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Подтвердить", 
  cancelText = "Отмена",
  type = "danger"
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string,
  confirmText?: string,
  cancelText?: string,
  type?: "danger" | "warning" | "info"
}) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl p-8"
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${
          type === 'danger' ? 'bg-red-50 text-red-500' : 
          type === 'warning' ? 'bg-amber-50 text-amber-500' : 
          'bg-blue-50 text-blue-500'
        }`}>
          {type === 'danger' ? <Trash2 size={32} /> : type === 'warning' ? <AlertTriangle size={32} /> : <Info size={32} />}
        </div>
        
        <h3 className="text-xl font-black text-center text-slate-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">{message}</p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
              type === 'danger' ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 
              type === 'warning' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 
              'bg-blue-600 text-white shadow-lg shadow-blue-100'
            }`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all"
          >
            {cancelText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Notifications = ({ notifications, onMarkAsRead, onBack, onOrderClick, onShowSupport }: { 
  notifications: Notification[], 
  onMarkAsRead: (id: string) => void,
  onBack: () => void,
  onOrderClick: (orderId: string) => void,
  onShowSupport?: () => void
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [filterType, setFilterType] = useState<Notification['type'] | 'all'>('all');

  const filteredByType = notifications.filter(n => filterType === 'all' || n.type === filterType);
  const currentNotifications = filteredByType.filter(n => !n.isRead);
  const historyNotifications = filteredByType.filter(n => n.isRead);

  const displayNotifications = activeTab === 'current' ? currentNotifications : historyNotifications;

  const filterOptions: { id: Notification['type'] | 'all', label: string }[] = [
    { id: 'all', label: 'Все' },
    { id: 'order', label: 'Заказы' },
    { id: 'payment', label: 'Платежи' },
    { id: 'chat', label: 'Чаты' },
    { id: 'system', label: 'Системные' },
  ];

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-[80] flex flex-col"
    >
      <Header title="Уведомления" showBack onBack={onBack} />
      
      <div className="p-4 space-y-4 border-b border-slate-100">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'current' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-500'}`}
          >
            Текущие ({notifications.filter(n => !n.isRead).length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-500'}`}
          >
            История ({notifications.filter(n => n.isRead).length})
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {filterOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${
                filterType === opt.id 
                  ? 'bg-slate-900 border-slate-900 text-white' 
                  : 'bg-white border-slate-100 text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto page-gutters py-6 space-y-4">
        {displayNotifications.map(notif => (
          <div 
            key={notif.id} 
            onClick={() => {
              onMarkAsRead(notif.id);
              if (notif.orderId) onOrderClick(notif.orderId);
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${notif.isRead ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100 shadow-sm'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${notif.isRead ? 'bg-transparent' : 'bg-blue-600'}`} />
                <h4 className="font-bold text-slate-900">{notif.title}</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{notif.time}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
          </div>
        ))}
        {displayNotifications.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Bell size={48} className="mb-4 opacity-20" />
            <p>{activeTab === 'current' ? 'У вас пока нет новых уведомлений' : 'История уведомлений пуста'}</p>
          </div>
        )}
      </div>

      {onShowSupport && (
        <div className="page-gutters py-6 border-t border-slate-100">
          <button 
            onClick={onShowSupport}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <MessageSquare size={20} />
            Написать в поддержку
          </button>
        </div>
      )}
    </motion.div>
  );
};

const SettingsPage = ({ onBack, user, onUpdateUser, lang, setLang, onShowSupport }: { 
  onBack: () => void, 
  user: User, 
  onUpdateUser: (u: User) => void,
  lang: 'ru' | 'en',
  setLang: (l: 'ru' | 'en') => void,
  onShowSupport: () => void
}) => {
  const [activeSubPage, setActiveSubPage] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone || '');
    useEffect(() => {
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
  }, [user]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadAvatar } = await import('./firebase');
      const url = await uploadAvatar(user.id, file);
      onUpdateUser({ ...user, avatar: url });
    } catch (err) {
      console.error('Avatar upload error:', err);
    }
  };

  const t = TRANSLATIONS[lang];

  const handleSavePersonalData = () => {
    onUpdateUser({
      ...user,
      name: editName.trim(),
      phone: editPhone
    });
    setActiveSubPage(null);
  };

  const renderSubPage = () => {
    switch (activeSubPage) {
      case 'personal':
        return (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 bg-white z-[90] flex flex-col">
            <Header title={t.personalData} showBack onBack={() => setActiveSubPage(null)} />
            <div className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="relative">
                  <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-4 border-slate-50 shadow-lg" referrerPolicy="no-referrer" />
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">{t.name}</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">{t.phone}</label>
                  <PhoneInput
                    value={editPhone} 
                    onChange={setEditPhone}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button 
                onClick={handleSavePersonalData}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 active:scale-95 transition-transform"
              >
                {t.save}
              </button>
            </div>
          </motion.div>
        );
      case 'about':
        return (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 bg-white z-[90] flex flex-col">
            <Header title={t.aboutApp} showBack onBack={() => setActiveSubPage(null)} />
            <div className="p-8 flex flex-col items-center text-center space-y-6">
              <Logo size={80} />
              <div className="space-y-2">
                <p className="text-xl font-black">ГрузОК</p>
                <p className="text-slate-400 text-sm">{t.version} 1.0.0</p>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {t.aboutText}
              </p>
              <div className="w-full pt-8 border-t border-slate-100">
                <p className="text-xs text-slate-400">© 2026 GruzOK Inc. {t.copyright}</p>
              </div>
            </div>
          </motion.div>
        );
      case 'faq':
        return (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="absolute inset-0 bg-white z-[90] flex flex-col">
            <Header title={t.helpFaq} showBack onBack={() => setActiveSubPage(null)} />
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {t.faq.map((item: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="font-bold text-sm mb-2">{item.q}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.a}</p>
                </div>
              ))}
              
              {user.role !== 'dispatcher' && (
                <div className="pt-8 text-center space-y-4">
                  <p className="text-sm text-slate-400">{t.noFaqAnswer}</p>
                  <button 
                    onClick={onShowSupport}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                  >
                    <MessageSquare size={20} />
                    {t.writeSupport}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-[80] flex flex-col"
    >
      <Header title={t.settings} showBack onBack={onBack} />
      <div className="flex-1 overflow-y-auto page-gutters py-6 space-y-8">
        <section>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-wider">{t.account}</h3>
          <div className="space-y-4">
            <button 
              onClick={() => setActiveSubPage('personal')}
              className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"
            >
              <div className="flex items-center gap-3">
                <UserIcon size={20} className="text-slate-400" />
                <div className="text-left">
                  <p className="font-bold text-sm">{t.personalData}</p>
                  <p className="text-xs text-slate-500">{t.personalDataDesc}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-wider">{t.app}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-400" />
                <span className="font-semibold">{t.notifications}</span>
              </div>
              <button 
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <motion.div 
                  animate={{ x: notificationsEnabled ? 26 : 2 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-slate-400" />
                <span className="font-semibold">{t.language}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setLang('ru')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${lang === 'ru' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  RU
                </button>
                <button 
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-wider">{t.support}</h3>
          <div className="space-y-2">
            {user.role !== 'dispatcher' && (
              <button 
                onClick={onShowSupport}
                className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={20} />
                  <span className="font-bold">{t.supportChat}</span>
                </div>
                <ChevronRight size={20} />
              </button>
            )}
            <button 
              onClick={() => setActiveSubPage('faq')}
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100"
            >
              <span className="font-semibold">{t.helpFaq}</span>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
            <a 
              href="mailto:support@gruzok.ru"
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100"
            >
              <span className="font-semibold">{t.contactUs}</span>
              <ChevronRight size={20} className="text-slate-300" />
            </a>
            <button 
              onClick={() => setActiveSubPage('about')}
              className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100"
            >
              <span className="font-semibold">{t.aboutApp}</span>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          </div>
        </section>

        <div className="pt-4 pb-8 text-center">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Версия 1.0.4 (Build 42)</p>
        </div>
      </div>
      <AnimatePresence>
        {renderSubPage()}
      </AnimatePresence>
    </motion.div>
  );
};

const DispatcherAdmin = ({ user, orders, chats, workers, onOrderClick, onWorkerClick, onOpenChat }: { 
  user: User, 
  orders: Order[], 
  chats: Chat[],
  workers: any[],
  onOrderClick: (order: Order) => void,
  onWorkerClick: (workerId: string) => void,
  onOpenChat: (participantId: string, role: string, orderId?: string) => void
}) => {
  const [activeView, setActiveView] = useState<'orders' | 'workers' | 'dashboard' | 'chats'>('orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState<Order['status'] | 'all'>('all');
  
  const pendingOrders = orders.filter(o => o.status === 'pending_negotiation');
  const openOrders = orders.filter(o => o.status === 'open');
  const activeOrders = orders.filter(o => o.status === 'in-progress');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const visiblePendingOrders = orderStatusFilter === 'all' || orderStatusFilter === 'pending_negotiation' ? pendingOrders : [];
  const visibleOpenOrders = orderStatusFilter === 'all' || orderStatusFilter === 'open' ? openOrders : [];
  const visibleActiveOrders = orderStatusFilter === 'all' || orderStatusFilter === 'in-progress' ? activeOrders : [];
  const visibleCompletedOrders = orderStatusFilter === 'all' || orderStatusFilter === 'completed' ? completedOrders : [];
  const visibleOrdersCount = visiblePendingOrders.length + visibleOpenOrders.length + visibleActiveOrders.length + visibleCompletedOrders.length;

  const displayWorkers = workers.filter(w => w.role === 'worker');
  const workersMap = displayWorkers.reduce((acc, w) => {
    const normalizedWorker = { ...w, phone: w.phone || w.phoneNumber || w.contactPhone || '' };
    acc[w.id] = normalizedWorker;
    if (w.uid) acc[w.uid] = normalizedWorker;
    return acc;
  }, {} as Record<string, any>);
  const ordersMap = orders.reduce((acc, order) => {
    acc[order.id] = order;
    return acc;
  }, {} as Record<string, Order>);

  const dispatcherChats = useMemo(() => {
    const chatEntries = chats
      .map((chat) => {
        const storedRole = chat.participantRole;
        const participantId =
          storedRole === 'customer' ? chat.customerId :
          storedRole === 'worker' ? chat.workerId :
          chat.customerId && chat.customerId !== user.id ? chat.customerId :
          chat.workerId && chat.workerId !== user.id ? chat.workerId :
          undefined;

        if (!participantId || participantId === 'support') return null;

        const participantRole =
          storedRole === 'customer' || storedRole === 'worker'
            ? storedRole
            : chat.customerId === participantId
              ? 'customer'
              : 'worker';
        const order = chat.orderId && !['direct', 'manual', 'support_order'].includes(chat.orderId)
          ? ordersMap[chat.orderId]
          : undefined;
        const key = order
          ? `${order.id}_${participantRole}_${participantId}`
          : `direct_${participantRole}_${participantId}`;

        return { chat, participantId, participantRole, order, key };
      })
      .filter(Boolean) as Array<{
        chat: Chat;
        participantId: string;
        participantRole: 'customer' | 'worker';
        order?: Order;
        key: string;
      }>;

    const deduped = new Map<string, typeof chatEntries[number]>();

    chatEntries.forEach((entry) => {
      const existing = deduped.get(entry.key);
      const entryTime = entry.chat.lastMessageAt?.toMillis?.() || 0;
      const existingTime = existing?.chat.lastMessageAt?.toMillis?.() || 0;
      if (!existing || entryTime >= existingTime) {
        deduped.set(entry.key, entry);
      }
    });

    return Array.from(deduped.values()).sort((a, b) =>
      (b.chat.lastMessageAt?.toMillis?.() || 0) - (a.chat.lastMessageAt?.toMillis?.() || 0)
    );
  }, [chats, ordersMap, user.id]);

  // Dashboard Data
  const categoryData = Object.entries(
    orders.reduce((acc, order) => {
      acc[order.category] = (acc[order.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const budgetData = orders
    .filter(o => o.date)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .reduce((acc, order) => {
      const date = order.date!;
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.total += order.budget;
        existing.count += 1;
      } else {
        acc.push({ date, total: order.budget, count: 1 });
      }
      return acc;
    }, [] as { date: string, total: number, count: number }[])
    .map(d => ({ date: d.date, average: Math.round(d.total / d.count) }));

  const workerStats = displayWorkers.map(w => {
    const workerOrders = orders.filter(o => o.workerId === w.id || o.assignedWorkers?.some(aw => aw.id === w.id));
    const completed = workerOrders.filter(o => o.status === 'completed').length;
    const rate = workerOrders.length > 0 ? Math.round((completed / workerOrders.length) * 100) : 0;
    return { name: w.name, rate };
  }).sort((a, b) => b.rate - a.rate).slice(0, 5);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-100 page-gutters py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Панель управления 🎧</h2>
          <p className="text-slate-500 text-sm">Управление логистикой и кадрами</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar mb-6">
          {[
            { id: 'orders', label: 'Заказы' },
            { id: 'workers', label: 'Грузчики' },
            { id: 'dashboard', label: 'Аналитика' },
            { id: 'chats', label: 'Чаты' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${activeView === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeView !== 'dashboard' && activeView !== 'chats' && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Всего заказов', value: orders.length, color: 'text-slate-900' },
              { label: 'В работе', value: activeOrders.length, color: 'text-blue-600' },
              { label: 'Ожидают', value: pendingOrders.length, color: 'text-amber-600' },
              { label: 'Завершено', value: completedOrders.length, color: 'text-emerald-600' },
            ].map((stat, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {activeView === 'orders' && (
          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Все' },
              { id: 'pending_negotiation', label: 'На согласовании' },
              { id: 'open', label: 'Открытые' },
              { id: 'in-progress', label: 'В работе' },
              { id: 'completed', label: 'Завершенные' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setOrderStatusFilter(filter.id as Order['status'] | 'all')}
                className={`px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${
                  orderStatusFilter === filter.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-slate-100 text-slate-500'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeView === 'orders' ? (
          <div className="space-y-8">
            {visiblePendingOrders.length > 0 && (
              <section>
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" />
                  Требуют согласования
                </h3>
                <div className="grid gap-4">
                  {visiblePendingOrders.map(order => (
                    <OrderCard key={order.id} order={order} onClick={onOrderClick} role="dispatcher" />
                  ))}
                </div>
              </section>
            )}

            {(visibleOpenOrders.length > 0 || visibleActiveOrders.length > 0) && (
              <section>
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Navigation size={18} className="text-blue-500" />
                  Активные и открытые
                </h3>
                <div className="grid gap-4">
                  {[...visibleOpenOrders, ...visibleActiveOrders].map(order => (
                  <div key={order.id} className="relative">
                    <OrderCard order={order} workers={workers} onClick={onOrderClick} role="dispatcher" />
                    {order.status === 'open' && order.candidates && order.candidates.length > 0 && (
                      <div className="absolute bottom-8 right-4 flex -space-x-2 pointer-events-none">
                        {order.candidates.filter(cid => !!cid).map(cid => (
                          <img 
                            key={cid} 
                            src={workersMap[cid]?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} 
                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                            title={workersMap[cid]?.name || 'Исполнитель'}
                          />
                        ))}
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center border-2 border-white">
                          +{order.candidates.length}
                        </div>
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              </section>
            )}

            {visibleCompletedOrders.length > 0 && (
              <section>
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  Завершенные
                </h3>
                <div className="grid gap-4">
                  {visibleCompletedOrders.map(order => (
                    <OrderCard key={order.id} order={order} workers={workers} onClick={onOrderClick} role="dispatcher" />
                  ))}
                </div>
              </section>
            )}

            {visibleOrdersCount === 0 && (
              <div className="py-20 text-center text-slate-400">
                <Filter size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">Заказов с таким статусом нет</p>
              </div>
            )}
          </div>
        ) : activeView === 'workers' ? (
          <div className="grid gap-4">
            {displayWorkers.map(worker => (
              <div 
                key={worker.id} 
                onClick={() => onWorkerClick(worker.id)}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={worker.avatar} className="w-12 h-12 rounded-full object-cover" />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${worker.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{worker.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="font-bold">{worker.rating}</span>
                      <span>• {getReviewsCount(worker)} отзывов</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${worker.isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {worker.isOnline ? 'В сети' : 'Оффлайн'}
                  </span>
                  {worker.responseTime && (
                    <p className="text-xs text-slate-400 mt-1">Средний ответ: {worker.responseTime}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : activeView === 'dashboard' ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6">Заказы по категориям</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4 justify-center mt-4">
                {categoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6">Средний бюджет во времени</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={budgetData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6">Топ исполнителей (Выполнение %)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workerStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                    <Tooltip />
                    <Bar dataKey="rate" fill="#10b981" radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {dispatcherChats.length > 0 ? (
              dispatcherChats.map(({ chat, participantId, participantRole, order }) => {
                const profile = workers.find(w => w.id === participantId || w.uid === participantId);
                const roleLabel = participantRole === 'customer' ? 'Клиент' : 'Исполнитель';
                const participantName = chat.otherUserName || profile?.name || roleLabel;
                const participantAvatar = chat.otherUserAvatar || profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participantId}`;
                const title = order?.title || participantName;
                const subtitle = order
                  ? `${roleLabel}: ${participantName}`
                  : `${roleLabel} · прямой чат`;

                return (
                  <div 
                    key={chat.id} 
                    onClick={() => onOpenChat(participantId, participantRole, order?.id)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-colors"
                  >
                    <img src={participantAvatar || 'https://picsum.photos/seed/user/50'} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-slate-900 line-clamp-1">{title}</h4>
                        <span className="text-[10px] text-slate-400">
                          {chat.lastMessageAt ? new Date(chat.lastMessageAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1 mb-1">{subtitle}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 line-clamp-1">{chat.lastMessage || 'Начать чат...'}</p>
                        {order && (
                          <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                            Заказ #{order.id.slice(-4)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <MessageSquare size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400">Нет активных чатов</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ReviewModal = ({ isOpen, onClose, onSubmit, targetName, lang = 'ru' }: { isOpen: boolean, onClose: () => void, onSubmit: (rating: number, text: string) => Promise<boolean | void> | boolean | void, targetName: string, lang?: AppLang }) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const reviewText = {
    title: lang === 'en' ? 'Leave a review' : 'Оставить отзыв',
    intro: lang === 'en' ? 'Please rate' : 'Пожалуйста, оцените работу',
    hint: lang === 'en' ? 'Your review will help other users make the right choice.' : 'Ваш отзыв поможет другим пользователям сделать правильный выбор.',
    comment: lang === 'en' ? 'Comment' : 'Комментарий',
    placeholder: lang === 'en' ? 'Write a few words about your experience...' : 'Напишите пару слов о впечатлениях...',
    submit: lang === 'en' ? 'Submit review' : 'Отправить отзыв',
    submitting: lang === 'en' ? 'Submitting...' : 'Отправляем...',
    error: lang === 'en' ? 'Could not save the review. Please try again.' : 'Не удалось сохранить отзыв. Попробуйте еще раз.',
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{reviewText.title}</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          {reviewText.intro} <span className="font-bold text-slate-900">{targetName}</span>. 
          {reviewText.hint}
        </p>

        <div className="flex justify-center gap-3 mb-10">
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star} 
              onClick={() => setRating(star)}
              className="transition-transform active:scale-90"
            >
              <Star 
                size={42} 
                fill={star <= rating ? "#EAB308" : "none"} 
                className={star <= rating ? "text-yellow-500" : "text-slate-200"} 
              />
            </button>
          ))}
        </div>

        <div className="space-y-2 mb-8">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{reviewText.comment}</label>
          <textarea 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] resize-none"
            placeholder={reviewText.placeholder}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubmitError('');
            }}
          />
        </div>

        {submitError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100">
            {submitError}
          </div>
        )}

        <button
          disabled={rating === 0 || text.trim().length === 0 || isSubmitting}
          onClick={async () => {
            if (rating === 0 || text.trim().length === 0 || isSubmitting) return;
            setIsSubmitting(true);
            setSubmitError('');
            try {
              const result = await onSubmit(rating, text);
              if (result === false) {
                setSubmitError(reviewText.error);
                return;
              }
              setRating(0);
              setText('');
            } catch (error) {
              console.error('Review submit failed:', error);
              setSubmitError(reviewText.error);
            } finally {
              setIsSubmitting(false);
            }
          }}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all ${
            rating === 0 || text.trim().length === 0 || isSubmitting
              ? 'bg-slate-200 text-slate-400 shadow-none'
              : 'bg-blue-600 text-white shadow-blue-200'
          }`}
        >
          {isSubmitting ? reviewText.submitting : reviewText.submit}
        </button>
      </motion.div>
    </motion.div>
  );
};

interface OrderDetailsProps {
  order: Order;
  orders: Order[];
  workers: any[];
  role: UserRole;
  lang: AppLang;
  currentUserId: string;
  onBack: () => void;
  onOrderClick: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onUpdateWorkerStatus: (orderId: string, workerId: string, status: AssignedWorker['status']) => void;
  onNegotiate: (orderId: string, negotiatedBudget: number, commission: number) => void;
  onReview: (orderId: string, rating: number, text: string) => Promise<boolean | void> | boolean | void;
  onAssignWorker: (orderId: string, workerIds: string | string[]) => void;
  onUnassignWorker?: (orderId: string, workerId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onReplaceWorker: (orderId: string, oldWorkerId: string, newWorkerId: string) => void;
  onOpenChat: (participantId: string, role: string, orderId?: string) => void;
  onBid: (orderId: string, workerId: string) => void;
  onShowSupport: () => void;
  viewingWorkerId: string | null;
  setViewingWorkerId: (id: string | null) => void;
  onCompleteOrder?: (orderId: string) => void;
}

const OrderDetails = ({ 
  order, 
  orders,
  workers,
  role, 
  lang,
  currentUserId,
  onBack, 
  onOrderClick,
  onUpdateStatus, 
  onUpdateWorkerStatus,
  onNegotiate, 
  onReview, 
  onAssignWorker,
  onUnassignWorker,
  onDeleteOrder,
  onReplaceWorker,
  onOpenChat,
  onBid,
  onShowSupport,
  viewingWorkerId, 
  setViewingWorkerId,
  onCompleteOrder
}: OrderDetailsProps) => {
  const t = TRANSLATIONS[lang];
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [negotiatedBudget, setNegotiatedBudget] = useState(order.budget);
  const [commission, setCommission] = useState(order.commission || Math.round(order.budget * 0.1));
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(order.assignedWorkers?.map(w => w.id) || []);
  const [customerProfile, setCustomerProfile] = useState<any | null>(null);
  const maxAssignedWorkers = Math.max(1, order.workersCount || 1);
  const assignedWorkersList = order.assignedWorkers || [];
  const assignedWorkerIds = new Set(assignedWorkersList.map(worker => worker.id));
  const assignedSlotsCount = assignedWorkersList.length;
  const hasFreeWorkerSlots = assignedSlotsCount < maxAssignedWorkers;
  const availableCandidateIds = (order.candidates || []).filter(workerId => !!workerId && !assignedWorkerIds.has(workerId));

  const displayWorkers = workers.filter(w => w.role === 'worker');
  const workersMap = displayWorkers.reduce((acc, w) => {
    const normalizedWorker = { ...w, phone: w.phone || w.phoneNumber || w.contactPhone || '' };
    acc[w.id] = normalizedWorker;
    if (w.uid) acc[w.uid] = normalizedWorker;
    return acc;
  }, {} as Record<string, any>);

  const assignedWorkerId =
    order.workerId || order.assignedWorkers?.[0]?.id || String(selectedWorker || '');

  const assignedWorker = workersMap?.[assignedWorkerId];

  useEffect(() => {
    setSelectedWorkers(assignedWorkersList.map(worker => worker.id).slice(0, maxAssignedWorkers));
  }, [order.id, order.assignedWorkers, maxAssignedWorkers]);

  // For worker: contact is the customer. For customer: contact is the assigned worker.
  // Dispatcher has separate chat buttons above; no contact block needed.
  const contactId = role === 'worker' ? order.customerId : assignedWorkerId;
  const contactRole = role === 'worker' ? 'customer' : 'worker';

  const contactName =
    role === 'worker'
      ? (customerProfile?.name || customerProfile?.fullName || (lang === 'en' ? 'Customer' : 'Заказчик'))
      : (assignedWorker?.name || assignedWorker?.fullName || (lang === 'en' ? 'Worker' : 'Исполнитель'));

  const contactPhoneRaw =
    role === 'worker'
      ? (customerProfile?.phone || customerProfile?.phoneNumber || customerProfile?.contactPhone || '')
      : (assignedWorker?.phone || assignedWorker?.phoneNumber || assignedWorker?.contactPhone || '');

  const contactPhoneFormatted = contactPhoneRaw
    ? formatPhoneNumber(contactPhoneRaw)
    : (lang === 'en' ? 'Phone not specified' : 'Телефон не указан');

  const contactPhoneHref = contactPhoneRaw
    ? `+${String(contactPhoneRaw).replace(/\D/g, '')}`
    : '#';

  useEffect(() => {
    if (role !== 'worker' || !order.customerId) {
      setCustomerProfile(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', order.customerId), (snapshot) => {
      if (snapshot.exists()) {
        setCustomerProfile({ id: snapshot.id, ...snapshot.data() });
      } else {
        setCustomerProfile(null);
      }
    });

    return () => unsub();
  }, [role, order.customerId]);

  const needsReview = order.status === 'completed' && 
    ((role === 'customer' && !order.customerReviewed) || 
    (role === 'worker' && !order.workerReviewed));

  useEffect(() => {
    if (needsReview) {
      setShowReviewModal(true);
    }
  }, [order.id, order.status]);

  const handleReviewSubmit = async (rating: number, text: string) => {
    const result = await onReview(order.id, rating, text);
    if (result === false) return false;
    setShowReviewModal(false);
    return true;
  };

  const targetName = role === 'customer' 
    ? (workersMap[assignedWorkerId]?.name || (lang === 'en' ? 'Worker' : 'Исполнитель'))
    : (lang === 'en' ? 'Customer' : 'Заказчик');

  const od = {
    total: lang === 'en' ? 'Total' : 'Всего',
    budgetApproval: lang === 'en' ? 'Budget approval' : 'Согласование бюджета',
    finalBudget: lang === 'en' ? 'Final budget from customer' : 'Итоговый бюджет (от клиента)',
    dispatcherFee: lang === 'en' ? 'Dispatcher fee' : 'Комиссия диспетчера',
    workerPayout: lang === 'en' ? 'Worker payout:' : 'Выплата исполнителю:',
    approveAndPublish: lang === 'en' ? 'Approve and publish' : 'Согласовать и опубликовать',
    dateTime: lang === 'en' ? 'Date and time' : 'Дата и Время',
    notSpecified: lang === 'en' ? 'Not specified' : 'Не указано',
    peopleShort: lang === 'en' ? 'people' : 'чел.',
    manageWorkers: lang === 'en' ? 'Manage workers' : 'Управление исполнителями',
    chatWithCustomer: lang === 'en' ? 'Chat with customer' : 'Чат с клиентом',
    chatWithWorker: lang === 'en' ? 'Chat with worker' : 'Чат с исполнителем',
    noWorkersAssigned: lang === 'en' ? 'No workers assigned yet' : 'Исполнители еще не назначены',
    assignLoaders: lang === 'en' ? 'Assign loaders' : 'Назначить грузчиков',
    acceptedOrder: lang === 'en' ? 'Accepted order' : 'Приняли заказ',
    chooseWorkers: lang === 'en' ? 'Choose workers' : 'Выбор исполнителей',
    selected: lang === 'en' ? 'Selected' : 'Выбрано',
    online: lang === 'en' ? 'Online' : 'В сети',
    offline: lang === 'en' ? 'Offline' : 'Оффлайн',
    confirmSelection: lang === 'en' ? 'Confirm selection' : 'Подтвердить выбор',
    statusHistory: lang === 'en' ? 'Change history' : 'История изменений',
    emptyHistory: lang === 'en' ? 'Change history is empty' : 'История изменений пуста',
    changedStatusTo: lang === 'en' ? 'Changed status to:' : 'Изменил статус на:',
    changedBy: lang === 'en' ? 'Changed by:' : 'Изменил:',
    customer: lang === 'en' ? 'Customer' : 'Заказчик',
    worker: lang === 'en' ? 'Worker' : 'Исполнитель',
    dispatcher: lang === 'en' ? 'Dispatcher' : 'Диспетчер',
    system: lang === 'en' ? 'System' : 'Система',
    assignedLoaders: lang === 'en' ? 'Assigned loaders' : 'Назначенные грузчики',
    phoneNotSpecified: lang === 'en' ? 'Phone not specified' : 'Телефон не указан',
    go: lang === 'en' ? 'Go' : 'В путь',
    arrived: lang === 'en' ? 'On site' : 'На месте',
    finish: lang === 'en' ? 'Finish' : 'Закончил',
    workerOnWay: lang === 'en' ? 'Worker on the way' : 'Исполнитель в пути',
    mapUnavailable: lang === 'en' ? 'Map unavailable' : 'Карта недоступна',
    workerIsComing: lang === 'en' ? 'Worker is coming to you' : 'Исполнитель в пути к вам',
    arrivalIn: lang === 'en' ? 'Arrival in' : 'Прибытие через',
    lessThanMinute: lang === 'en' ? '< 1 min' : '< 1 мин',
    hourShort: lang === 'en' ? 'h' : 'ч',
    minuteShort: lang === 'en' ? 'min' : 'мин',
    workerAtPlaceTitle: lang === 'en' ? 'Worker is on site' : 'Исполнитель на месте',
    workerAtPlaceText: lang === 'en' ? 'The order can now be started' : 'Можно начинать выполнение заказа',
    customerContact: lang === 'en' ? 'Customer contact' : 'Контакт заказчика',
    workerContact: lang === 'en' ? 'Worker contact' : 'Контакт исполнителя',
    profile: lang === 'en' ? 'Profile' : 'Профиль',
    call: lang === 'en' ? 'Call' : 'Позвонить',
    contactHint: lang === 'en' ? 'Contact them to clarify details' : 'Свяжитесь для уточнения деталей',
    apply: lang === 'en' ? 'Apply for order' : 'Откликнуться на заказ',
    applied: lang === 'en' ? 'You applied' : 'Вы откликнулись',
    completeOrder: lang === 'en' ? 'Complete order' : 'Завершить заказ',
    orderCompleted: lang === 'en' ? 'Order completed successfully!' : 'Заказ успешно выполнен!',
    deleteOrder: lang === 'en' ? 'Delete order' : 'Удалить заказ',
    assignedExecutors: lang === 'en' ? 'Assigned workers' : 'Назначенные исполнители',
    remove: lang === 'en' ? 'Remove' : 'Отстранить',
    candidates: lang === 'en' ? 'Applications' : 'Отклики',
    free: lang === 'en' ? 'free' : 'свободно',
    choose: lang === 'en' ? 'Choose' : 'Выбрать',
    noCandidates: lang === 'en' ? 'No available applications yet' : 'Пока нет доступных откликов',
    allSelected: lang === 'en' ? 'All workers selected. Waiting for confirmation.' : 'Все исполнители выбраны! Ожидайте подтверждения.',
  };

  // ВРЕМЕННО ОТКЛЮЧЕНО — превышает квоту Firebase
  // useEffect(() => {
  //   if (role !== 'worker') return;
  //   if (!currentUserId) return;

  //   const currentAssignedWorker = (order.assignedWorkers || []).find(w => w.id === currentUserId);
  //   if (!currentAssignedWorker) return;
  //   if (currentAssignedWorker.status !== 'on-way') return;

  //   if (!navigator.geolocation) return;

  //   let lastUpdate = 0;

  //   const watchId = navigator.geolocation.watchPosition(
  //     async (position) => {
  //       const now = Date.now();
  //       if (now - lastUpdate < 15000) return; // не чаще раз в 15 сек
  //       lastUpdate = now;
  //       try {
  //         await updateDoc(doc(db, 'orders', order.id), {
  //           workerLiveLocation: {
  //             lat: position.coords.latitude,
  //             lng: position.coords.longitude,
  //             updatedAt: new Date().toISOString(),
  //             workerId: currentUserId,
  //           }
  //         });
  //       } catch (error) {
  //         console.error('Error updating live location:', error);
  //       }
  //     },
  //     (error) => {
  //       console.error('Geolocation error:', error);
  //     },
  //     {
  //       enableHighAccuracy: true,
  //       maximumAge: 5000,
  //       timeout: 10000,
  //     }
  //   );

  //   return () => {
  //     navigator.geolocation.clearWatch(watchId);
  //   };
  // }, [role, currentUserId, order.id, order.assignedWorkers]);

  const statusLabels = {
    'pending_negotiation': t.statusPending,
    'open': t.statusOpen,
    'in-progress': t.statusInProgress,
    'completed': t.statusCompleted
  };

  const workerStatusLabels = {
    assigned: t.workerAssigned,
    'on-way': t.onWay,
    'at-work': t.atWork,
    finished: t.finished
  };

  const statusColors = {
    'pending_negotiation': 'bg-amber-50 text-amber-600',
    'open': 'bg-blue-50 text-blue-600',
    'in-progress': 'bg-amber-50 text-amber-600',
    'completed': 'bg-emerald-50 text-emerald-600'
  };

  // Show contact block only for customer and worker roles (not dispatcher — they have their own chat buttons)
  const hasExecutor = role !== 'dispatcher' && (
    (role === 'worker' && !!order.customerId) ||
    (role === 'customer' && !!(order.workerId || order.assignedWorkers?.[0]?.id))
  );

  const hasWorkerOnWay = assignedWorkersList.some(w => w.status === 'on-way');
  const hasWorkerAtWork = assignedWorkersList.some(w => w.status === 'at-work');

  const liveWorkerLocation = order.workerLiveLocation
    ? {
        lat: order.workerLiveLocation.lat,
        lng: order.workerLiveLocation.lng,
      }
    : null;

  const allWorkersFinished =
    assignedWorkersList.length > 0 &&
    assignedWorkersList.every(w => w.status === 'finished');

  const canCompleteOrder =
    role === 'dispatcher' &&
    order.status !== 'completed' &&
    allWorkersFinished;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="absolute inset-0 bg-white z-[60] flex flex-col"
    >
            <AnimatePresence>
        {viewingWorkerId && (
          <WorkerProfile 
            workerId={viewingWorkerId} 
            workers={workers}
            orders={orders}
            role={role}
            onBack={() => setViewingWorkerId(null)} 
            onOrderClick={(order) => {
              onOrderClick(order);
              setViewingWorkerId(null);
            }}
            onSelect={role === 'dispatcher' && (assignedWorkerIds.has(viewingWorkerId) || hasFreeWorkerSlots) ? () => {
              onAssignWorker(order.id, viewingWorkerId);
              setViewingWorkerId(null);
            } : undefined}
          />
        )}
      </AnimatePresence>
      <Header title={t.orderDetails} showBack onBack={onBack} />
      <ReviewModal 
        isOpen={showReviewModal} 
        onClose={() => setShowReviewModal(false)} 
        onSubmit={handleReviewSubmit}
        targetName={targetName}
        lang={lang}
      />
      <div className="page-gutters py-6 overflow-y-auto flex-1">
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
              {getCategoryLabel(order.category, t)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </span>
            {order.status === 'in-progress' && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-lg shadow-blue-200"
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Tracking
              </motion.span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold">{order.budget} ₽</span>
            {order.negotiatedBudget && (
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                {od.total}: {order.negotiatedBudget} ₽
              </span>
            )}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">{order.title}</h2>
        
        {role === 'dispatcher' && order.status === 'pending_negotiation' && (
          <div className="bg-white border-2 border-amber-100 p-6 rounded-3xl mb-8 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sliders size={20} className="text-amber-500" />
              {od.budgetApproval}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{od.finalBudget}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={negotiatedBudget}
                    onChange={(e) => setNegotiatedBudget(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₽</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{od.dispatcherFee}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={commission}
                    onChange={(e) => setCommission(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-lg"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₽</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-600">{od.workerPayout}</span>
                  <span className="text-xl font-black text-blue-700">{negotiatedBudget - commission} ₽</span>
                </div>
              </div>

              <button 
                onClick={() => onNegotiate(order.id, negotiatedBudget, commission)}
                className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
              >
                {od.approveAndPublish}
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MapPin size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.address.replace(' *', '')}</span>
            </div>
            <div className="text-sm font-semibold">{order.address}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{od.dateTime}</span>
            </div>
            <div className="text-sm font-semibold">{order.date ? `${order.date} ${lang === 'en' ? 'at' : 'в'} ${order.time}` : (order.time || od.notSpecified)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Users size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.loaders}</span>
            </div>
            <div className="text-sm font-semibold">{order.workersCount || 1} {od.peopleShort}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CreditCard size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.payment.replace(' (₽)', '')}</span>
            </div>
            <div className="text-sm font-semibold">{getPaymentMethodLabel(order.paymentMethod || 'Наличные', t)}</div>
          </div>
        </div>

        {role === 'dispatcher' && order.status !== 'pending_negotiation' && (
          <div className="mb-8">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{od.manageWorkers}</h3>
            
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => onOpenChat(order.customerId, 'customer', order.id)}
                className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-slate-900 font-bold hover:bg-slate-50 transition-colors"
              >
                <MessageSquare size={18} className="text-blue-600" />
                {od.chatWithCustomer}
              </button>
              {order.workerId && (
                <button 
                  onClick={() => onOpenChat(order.workerId!, 'worker', order.id)}
                  className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-slate-900 font-bold hover:bg-slate-50 transition-colors"
                >
                  <MessageSquare size={18} className="text-emerald-600" />
                  {od.chatWithWorker}
                </button>
              )}
            </div>

            {order.assignedWorkers && order.assignedWorkers.length > 0 ? (
              <div className="space-y-3">
                {order.assignedWorkers.map(worker => (
                  <div key={worker.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={worker.avatar} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{worker.name}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${
                          worker.status === 'at-work' ? 'text-blue-600' : 
                          worker.status === 'on-way' ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                          {worker.status === 'at-work' ? t.atWork : 
                           worker.status === 'on-way' ? t.onWay : t.workerAssigned}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsAssigning(true)}
                      className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                <Users size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm mb-4">{od.noWorkersAssigned}</p>
                <button 
                  onClick={() => setIsAssigning(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100"
                >
                  {od.assignLoaders}
                </button>
              </div>
            )}

            {order.candidates && order.candidates.length > 0 && (
              <div className="mt-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{od.acceptedOrder} ({order.candidates.length})</h4>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {order.candidates.filter(cid => !!cid).map(cid => {
                    const profile = workersMap[cid];
                    return (
                      <div 
                        key={cid} 
                        onClick={() => setViewingWorkerId(cid)}
                        className="flex-shrink-0 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 cursor-pointer hover:border-blue-200 transition-colors"
                      >
                        <img src={profile.avatar} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{profile.name}</p>
                          <div className="flex items-center gap-1 text-[10px] text-amber-500">
                            <Star size={10} fill="currentColor" />
                            <span className="font-bold">{profile.rating}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isAssigning && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{od.chooseWorkers}</h3>
                  <p className="text-xs text-slate-500">{od.selected}: {selectedWorkers.length} {lang === 'en' ? 'of' : 'из'} {maxAssignedWorkers}</p>
                </div>
                <button onClick={() => setIsAssigning(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 mb-6">
                {displayWorkers.map(worker => {
                  const isSelected = selectedWorkers.includes(worker.id);
                  const canSelectMore = selectedWorkers.length < maxAssignedWorkers;
                  const isSelectionDisabled = !isSelected && !canSelectMore;
                  return (
                    <button 
                      key={worker.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedWorkers(prev => prev.filter(id => id !== worker.id));
                        } else if (canSelectMore) {
                          setSelectedWorkers(prev => [...prev, worker.id]);
                        }
                      }}
                      disabled={isSelectionDisabled}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                        isSelected ? 'bg-blue-50 border-blue-200' : isSelectionDisabled ? 'bg-slate-50 border-slate-100 opacity-45' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={worker.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <p className="font-bold text-slate-900">{worker.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="font-bold">{worker.rating}</span>
                            <span className={worker.isOnline ? 'text-emerald-600' : 'text-slate-400'}>
                              {worker.isOnline ? od.online : od.offline}
                            </span>
                            {worker.availability && (
                              <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                {worker.availability}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'
                      }`}>
                        {isSelected && <Check size={14} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => {
                  // Assign all selected workers at once
                  onAssignWorker(order.id, selectedWorkers.slice(0, maxAssignedWorkers));
                  setIsAssigning(false);
                }}
                disabled={selectedWorkers.length === 0}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 active:scale-95 transition-all"
              >
                {od.confirmSelection} ({selectedWorkers.length})
              </button>
            </motion.div>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl mb-8">
          <p className="font-semibold mb-2 text-slate-900">{t.description}</p>
          <p className="text-slate-600 text-sm leading-relaxed">{order.description}</p>
        </div>

        {/* Status History Section */}
        <div className="mb-8">
          <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
            <History size={20} className="text-blue-600" />
            {od.statusHistory}
          </h3>
          <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {order.statusHistory && order.statusHistory.length > 0 ? (
              order.statusHistory.map((entry, index) => (
                <div key={index} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 w-6 h-6 bg-white border-2 border-blue-600 rounded-full flex items-center justify-center z-10">
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-900">
                        {entry.workerName ? `${od.worker} ${entry.workerName}` : (entry.changedBy === 'customer' ? od.customer : entry.changedBy === 'dispatcher' ? od.dispatcher : od.system)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(entry.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {od.changedStatusTo} <span className="font-bold text-blue-600">
                        {entry.status === 'on-way' ? t.onWay : 
                         entry.status === 'at-work' ? t.atWork : 
                         entry.status === 'finished' ? t.finished : 
                         statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="pl-8 text-xs text-slate-400 italic">{od.emptyHistory}</div>
            )}
          </div>
        </div>

        {/* Assigned Workers List */}
        {order.assignedWorkers && order.assignedWorkers.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              {od.assignedLoaders} ({order.assignedWorkers.length})
            </h3>
            <div className="space-y-3">
              {order.assignedWorkers.map((worker) => (
                <div key={worker.id} className="flex flex-col p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={worker.avatar} alt={worker.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{worker.name}</p>
                        <p className="text-xs text-slate-500">
                          {(() => {
                            const rawPhone = workersMap?.[worker.id]?.phone || '';
                            return rawPhone ? formatPhoneNumber(rawPhone) : od.phoneNotSpecified;
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {worker.status === 'assigned' && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{t.workerAssigned}</span>
                      )}
                      {worker.status === 'on-way' && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                          {t.onWay}
                        </span>
                      )}
                      {worker.status === 'at-work' && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                          {t.atWork}
                        </span>
                      )}
                      {worker.status === 'finished' && (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Check size={10} />
                          {t.finished}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Worker Status Update Buttons */}
                  {(role === 'worker' && worker.id === currentUserId || role === 'dispatcher') && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                      {worker.status === 'assigned' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'on-way')}
                          className="bg-blue-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          {od.go}
                        </button>
                      )}
                      {worker.status === 'on-way' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'at-work')}
                          className="bg-amber-500 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          {od.arrived}
                        </button>
                      )}
                      {worker.status === 'at-work' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'finished')}
                          className="bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          {od.finish}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Map */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-100 shadow-sm h-64 relative z-0">
          {order.lat && order.lng ? (
            <MapContainer 
              center={[order.lat, order.lng]} 
              zoom={14} 
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[order.lat, order.lng]}>
                <Popup>
                    <div className="text-xs font-bold">{order.address}</div>
                </Popup>
              </Marker>

              {/* Worker Tracking Marker */}
              {hasWorkerOnWay && liveWorkerLocation && (
                <Marker position={[liveWorkerLocation.lat, liveWorkerLocation.lng]} icon={workerIcon}>
                  <Popup>
                    <div className="text-xs font-bold">{od.workerOnWay}</div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          ) : (
            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">{od.mapUnavailable}</p>
              </div>
            </div>
          )}
        </div>

        {false && hasWorkerOnWay && liveWorkerLocation && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Navigation size={20} className="animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-black text-blue-600 uppercase tracking-tighter">Live Tracking</p>
                <p className="text-sm font-bold text-blue-900">{od.workerIsComing}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-blue-400 uppercase">{od.arrivalIn}</p>
              <p className="text-lg font-black text-blue-700">
                {(() => {
                  if (!order.lat || !order.lng || !liveWorkerLocation?.lat || !liveWorkerLocation?.lng) {
                    return '...';
                  }
                  // Haversine distance в км
                  const R = 6371;
                  const dLat = (order.lat - liveWorkerLocation.lat) * Math.PI / 180;
                  const dLon = (order.lng - liveWorkerLocation.lng) * Math.PI / 180;
                  const a =
                    Math.sin(dLat / 2) ** 2 +
                    Math.cos(liveWorkerLocation.lat * Math.PI / 180) *
                    Math.cos(order.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) ** 2;
                  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  // Средняя скорость по городу 30 км/ч
                  const mins = Math.round((distKm / 30) * 60);
                  if (mins < 1) return od.lessThanMinute;
                  if (mins > 120) return `~${Math.round(mins / 60)} ${od.hourShort}`;
                  return `~${mins} ${od.minuteShort}`;
                })()}
              </p>
            </div>
          </motion.div>
        )}

        {hasWorkerAtWork && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-amber-200">
                <Check size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-amber-600 uppercase tracking-tighter">{od.workerAtPlaceTitle}</p>
                <p className="text-sm font-bold text-amber-900">{od.workerAtPlaceText}</p>
              </div>
            </div>
          </motion.div>
        )}

        {hasExecutor && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <Phone size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {role === 'worker' ? od.customerContact : od.workerContact}
                </span>
              </div>
              {role === 'customer' && (
                <button 
                  onClick={() => {
                    if (role === 'customer') {
                      const wId = order.workerId || order.assignedWorkers?.[0]?.id || String(selectedWorker || '');
                      if (wId) {
                        setViewingWorkerId(wId);
                      }
                    }
                  }}
                  className="text-xs font-bold text-emerald-600 underline underline-offset-2"
                >
                  {od.profile}
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div 
                className={role === 'customer' ? "cursor-pointer" : ""}
                onClick={() => {
                  if (role === 'customer') {
                    const wId = order.workerId || order.assignedWorkers?.[0]?.id || String(selectedWorker || '');
                    if (wId) {
                      setViewingWorkerId(wId);
                    }
                  }
                }}
              >
                <div className="text-lg font-bold text-emerald-900">
                  {contactPhoneFormatted}
                </div>

                {role === 'customer' && (
                  <div
                    className="text-sm font-medium text-emerald-700 mt-1 flex items-center gap-1 cursor-pointer"
                    onClick={() => {
                      if (assignedWorkerId) {
                        setViewingWorkerId(assignedWorkerId);
                      }
                    }}
                  >
                    {contactName}
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
              {role === 'customer' && (
                <img 
                  src={(() => {
                    const wId = order.workerId || order.assignedWorkers?.[0]?.id || String(selectedWorker || '');
                    const worker = workersMap?.[wId];

                    return (
                      worker?.avatar ||
                      worker?.photoURL ||
                      worker?.photoUrl ||
                      worker?.image ||
                      'https://api.dicebear.com/7.x/avataaars/svg?seed=' + wId
                    );
                  })()}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm cursor-pointer"
                  onClick={() => {
                    const wId = order.workerId || order.assignedWorkers?.[0]?.id || String(selectedWorker || '');
                    setViewingWorkerId(wId);
                  }}
                />
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <a
                href={`tel:${contactPhoneHref}`}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                {od.call}
              </a>

              <button
                onClick={() => {
                  if (!contactId) return;
                  onOpenChat(contactId, contactRole, order.id);
                }}
                disabled={!contactId}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border ${
                  contactId
                    ? 'bg-white text-emerald-600 border-emerald-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                <MessageSquare size={16} />
                {t.chat}
              </button>
            </div>

            {role !== 'dispatcher' && (
              <button 
                onClick={onShowSupport}
                className="w-full mt-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Shield size={16} />
                {t.support}
              </button>
            )}

            <p className="text-[10px] text-emerald-600 mt-2 uppercase font-medium">{od.contactHint}</p>
          </motion.div>
        )}

        {role === 'dispatcher' && order.statusHistory && order.statusHistory.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <History size={20} className="text-slate-400" />
              {od.statusHistory}
            </h3>
            <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {order.statusHistory.map((entry, i) => {
                const statusLabels: Record<string, string> = {
                  'pending_negotiation': t.statusPending,
                  'open': t.statusOpen,
                  'in-progress': t.statusInProgress,
                  'completed': t.statusCompleted
                };
                const roleLabels: Record<string, string> = {
                  'customer': od.customer,
                  'worker': od.worker,
                  'dispatcher': od.dispatcher,
                  'system': od.system
                };
                return (
                  <div key={i} className="relative pl-10">
                    <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center z-10">
                      <div className={`w-2 h-2 rounded-full ${
                        entry.status === 'completed' ? 'bg-emerald-500' : 
                        entry.status === 'in-progress' ? 'bg-blue-500' : 
                        'bg-slate-300'
                      }`} />
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm text-slate-900">
                          {statusLabels[entry.status] || entry.status}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {od.changedBy} <span className="font-bold text-slate-700">{roleLabels[entry.changedBy] || entry.changedBy}</span>
                        {entry.workerName && <span className="text-slate-400"> ({entry.workerName})</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {role === 'worker' ? (
          <div className="mt-auto safe-area-bottom space-y-3">
            {order.status === 'open' && (
              <button 
                onClick={() => onBid(order.id, currentUserId)}
                disabled={order.candidates?.includes(currentUserId)}
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform ${
                  order.candidates?.includes(currentUserId) 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white'
                }`}
              >
                {order.candidates?.includes(currentUserId) ? od.applied : od.apply}
              </button>
            )}
            {canCompleteOrder && (
              <button
                onClick={() => onCompleteOrder?.(order.id)}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-sm"
              >
                {od.completeOrder}
              </button>
            )}
            {order.status === 'completed' && (
              <div className="text-center p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold">
                {od.orderCompleted}
              </div>
            )}
          </div>
        ) : role === 'customer' ? (
          <div>
            {order.status === 'open' && (
              <div className="mb-6">
                <button 
                  onClick={() => onDeleteOrder?.(order.id)}
                  className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-bold text-lg border border-red-100 active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Trash2 size={20} /> {od.deleteOrder}
                </button>
              </div>
            )}
            {order.assignedWorkers && order.assignedWorkers.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-lg mb-4">{od.assignedExecutors}</h3>
                <div className="space-y-3">
                  {order.assignedWorkers.map(worker => (
                    <div key={worker.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <img src={worker.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <p className="font-bold text-sm">{worker.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {{
                              assigned: t.workerAssigned,
                              'on-way': t.onWay,
                              'at-work': t.atWork,
                              finished: t.finished,
                            }[worker.status] || t.notSpecified}
                          </p>
                        </div>
                      </div>
                      {order.status !== 'completed' && (
                        <button 
                          onClick={() => onUnassignWorker?.(order.id, worker.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title={od.remove}
                        >
                          <UserMinus size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(order.status === 'open' || order.status === 'in-progress') && hasFreeWorkerSlots && (
              <>
                <h3 className="font-bold text-lg mb-4">
                  {od.candidates} ({availableCandidateIds.length}) · {od.free} {maxAssignedWorkers - assignedSlotsCount}
                </h3>
                {availableCandidateIds.length > 0 ? (
                  availableCandidateIds.map(workerId => {
                    const profile = workers.find(w => w.id === workerId || w.uid === workerId);
                    return (
                      <div key={workerId} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl mb-3">
                        <button 
                          onClick={() => setViewingWorkerId(workerId)}
                          className="flex items-center gap-3 text-left"
                        >
                          <img src={profile?.avatar || `https://picsum.photos/seed/${workerId}/50`} className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                            <p className="font-bold">{profile?.name || od.worker}</p>
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                              <Star size={12} fill="currentColor" />
                              <span>{profile?.rating || '4.5'} ({getReviewsCount(profile)} {t.reviews.toLowerCase()})</span>
                            </div>
                          </div>
                        </button>
                        <button 
                          onClick={() => {
                            onAssignWorker(order.id, workerId);
                          }}
                          className="text-xs font-bold text-blue-600 uppercase tracking-wider"
                        >
                          {od.choose}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                    <p>{od.noCandidates}</p>
                  </div>
                )}
              </>
            )}
            {order.assignedWorkers && order.assignedWorkers.length > 0 && (order.status === 'open' || order.status === 'in-progress') && !hasFreeWorkerSlots && (
              <div className="text-center p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold">
                {od.allSelected}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

interface CreateOrderProps {
  onClose: () => void;
  onCreate: (order: Partial<Order>) => Promise<boolean | string> | boolean | string | void;
  initialCategory?: string;
  lang: AppLang;
}

const OrderHistory = ({ user, orders, lang, onOrderClick, onWorkerClick, onBack, onShowSupport }: { user: User, orders: Order[], lang: AppLang, onOrderClick: (order: Order) => void, onWorkerClick: (workerId: string) => void, onBack: () => void, onShowSupport: () => void }) => {
  const t = TRANSLATIONS[lang];
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in-progress' | 'completed'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'budget' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const historyOrders = orders.filter(o => {
    const isUserOrder = user.role === 'customer' 
      ? o.customerId === user.id 
      : (o.workerId === user.id || o.assignedWorkers?.some(w => w.id === user.id));
    if (!isUserOrder) return false;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'open') {
        if (o.status !== 'open' && o.status !== 'pending_negotiation') return false;
      } else if (o.status !== statusFilter) {
        return false;
      }
    }

    // Date filter
    if (dateFilter && o.date !== dateFilter) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      comparison = dateA - dateB;
    } else if (sortBy === 'budget') {
      comparison = (a.budget || 0) - (b.budget || 0);
    } else if (sortBy === 'status') {
      comparison = a.status.localeCompare(b.status);
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="absolute inset-0 bg-white z-50 flex flex-col"
    >
      <Header title={t.orderHistory} showBack onBack={onBack} />
      
      <div className="bg-white border-b border-slate-100 p-4 space-y-4">
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'all', label: t.all },
            { id: 'open', label: t.open },
            { id: 'in-progress', label: t.inProgress },
            { id: 'completed', label: t.completed }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === filter.id 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          {/* Date Filter */}
          <div className="flex-1 min-w-0 relative">
            <DateField
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="30.04.2026"
              className="text-sm font-bold text-slate-900 pr-10"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none"
            >
              <option value="date">{lang === 'en' ? 'By date' : 'По дате'}</option>
              <option value="budget">{lang === 'en' ? 'By budget' : 'По бюджету'}</option>
              <option value="status">{lang === 'en' ? 'By status' : 'По статусу'}</option>
            </select>
            <button 
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-blue-600"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto page-gutters py-6 space-y-4">
        {historyOrders.length > 0 ? (
          historyOrders.map(order => (
            <div key={order.id} className="relative">
              <OrderCard order={order} onClick={onOrderClick} onWorkerClick={onWorkerClick} lang={lang} />
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-slate-400">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">{t.noOrders}</p>
            {(statusFilter !== 'all' || dateFilter) && (
              <button 
                onClick={() => { setStatusFilter('all'); setDateFilter(''); }}
                className="mt-4 text-blue-600 font-bold text-sm"
              >
                {t.resetFilters}
              </button>
            )}
          </div>
        )}
      </div>

      {user.role !== 'dispatcher' && (
        <div className="page-gutters py-6 border-t border-slate-100">
          <button 
            onClick={onShowSupport}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            <MessageSquare size={20} />
            {t.writeSupport}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const CreateOrder = ({ onClose, onCreate, initialCategory = 'Грузчики', lang }: CreateOrderProps) => {
  const t = TRANSLATIONS[lang];
  const safeInitialCategory = typeof initialCategory === 'string' ? initialCategory : 'Грузчики';
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    category: safeInitialCategory,
    address: '',
    time: '',
    date: '',
    workersCount: 1,
    paymentMethod: 'Наличные',
    lat: 55.7558,
    lng: 37.6173
  });
  const [error, setError] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAddressLabel, setSelectedAddressLabel] = useState('');
  const formScrollRef = useRef<HTMLDivElement>(null);
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const workersFieldRef = useRef<HTMLDivElement>(null);
  const addressFieldRef = useRef<HTMLDivElement>(null);
  const budgetFieldRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const workersInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const scrollToField = (field: 'title' | 'workers' | 'address' | 'budget') => {
    const fieldRefs = {
      title: titleFieldRef,
      workers: workersFieldRef,
      address: addressFieldRef,
      budget: budgetFieldRef,
    };
    const inputRefs = {
      title: titleInputRef,
      workers: workersInputRef,
      address: addressInputRef,
      budget: budgetInputRef,
    };
    const container = formScrollRef.current;
    const target = fieldRefs[field].current;
    if (!container || !target) return;

    const offset = target.offsetTop - 16;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    window.setTimeout(() => inputRefs[field].current?.focus(), 350);
  };

  useEffect(() => {
    const query = formData.address.trim();
    if (!isAddressFocused || query.length < 3 || query === selectedAddressLabel) {
      setAddressSuggestions([]);
      setIsAddressLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsAddressLoading(true);
      try {
        const params = new URLSearchParams({
          format: 'jsonv2',
          addressdetails: '1',
          limit: '5',
          countrycodes: 'ru',
          q: query,
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Address lookup failed');
        const data = await response.json();
        setAddressSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Address lookup error:', err);
          setAddressSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsAddressLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [formData.address, isAddressFocused, selectedAddressLabel]);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    // Simple mock reverse geocoding
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data.display_name) {
        setSelectedAddressLabel(data.display_name);
        setAddressSuggestions([]);
        setFormData(prev => ({ ...prev, address: data.display_name }));
      }
    } catch (e) {
      const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setSelectedAddressLabel(fallbackAddress);
      setAddressSuggestions([]);
      setFormData(prev => ({ ...prev, address: fallbackAddress }));
    }
  };

  const handleAddressSuggestionSelect = (suggestion: { display_name: string; lat: string; lon: string }) => {
    const lat = Number(suggestion.lat);
    const lng = Number(suggestion.lon);
    setSelectedAddressLabel(suggestion.display_name);
    setAddressSuggestions([]);
    setIsAddressFocused(false);
    setError(null);
    setFormData(prev => ({
      ...prev,
      address: suggestion.display_name,
      lat: Number.isFinite(lat) ? lat : prev.lat,
      lng: Number.isFinite(lng) ? lng : prev.lng,
    }));
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        handleLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const isFieldError = error && (
    error === t.writeTitleError ||
    error === t.shortTitleError ||
    error === t.addressError ||
    error === t.budgetError ||
    error === t.workersError
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!formData.title.trim()) {
      setError(t.writeTitleError);
      scrollToField('title');
      return;
    }

    if (formData.title.trim().length < 5) {
      setError(t.shortTitleError);
      scrollToField('title');
      return;
    }

    if (!formData.address.trim()) {
      setError(t.addressError);
      scrollToField('address');
      return;
    }

    if (formData.budget && Number(formData.budget) <= 0) {
      setError(t.budgetError);
      scrollToField('budget');
      return;
    }

    if (formData.workersCount < 1) {
      setError(t.workersError);
      scrollToField('workers');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await Promise.resolve(onCreate({
        title: formData.title.trim(),
        description: formData.description.trim(),
        budget: Number(formData.budget) || 0,
        category: formData.category,
        address: formData.address.trim(),
        time: formData.time,
        date: formData.date,
        workersCount: formData.workersCount,
        paymentMethod: formData.paymentMethod,
        status: 'open',
        lat: formData.lat,
        lng: formData.lng
      }));

      if (typeof result === 'string') {
        setError(result);
      } else if (result === false) {
        setError(t.createOrderError);
      }
    } catch (err) {
      console.error('Create order submit error:', err);
      setError(t.createOrderError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 bg-white z-40 flex flex-col"
    >
      <Header title={t.newOrder} showBack onBack={onClose} />
      <div ref={formScrollRef} className="page-gutters py-6 space-y-6 overflow-y-auto flex-1">
        
        <div ref={titleFieldRef}>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.whatToDo}</label>
          <input 
            ref={titleInputRef}
            type="text" 
            value={formData.title}
            onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setError(null); }}
            placeholder={t.titleExample}
            className={`w-full p-4 bg-slate-50 border ${error && (error === t.writeTitleError || error === t.shortTitleError) ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
          />
          {error && (error === t.writeTitleError || error === t.shortTitleError) && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              {error}
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.category}</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="Грузчики">{t.loaders}</option>
              <option value="Переезд">{t.moving}</option>
              <option value="Сборка">{t.assembly}</option>
              <option value="Разное">{t.other}</option>
            </select>
          </div>
          <div ref={workersFieldRef}>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.loaders}</label>
            <input 
              ref={workersInputRef}
              type="number" 
              value={formData.workersCount}
              onChange={(e) => { setFormData({ ...formData, workersCount: Number(e.target.value) }); setError(null); }}
              min="1"
              className={`w-full p-4 bg-slate-50 border ${error === t.workersError ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
            />
            {error === t.workersError && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                {error}
              </motion.div>
            )}
          </div>
        </div>

        <div ref={addressFieldRef}>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.address}</label>
          <div className="relative mb-4 z-[1200]">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              ref={addressInputRef}
              type="text" 
              value={formData.address}
              onChange={(e) => {
                setSelectedAddressLabel('');
                setFormData({ ...formData, address: e.target.value });
                setError(null);
              }}
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => window.setTimeout(() => setIsAddressFocused(false), 150)}
              placeholder={t.addressPlaceholder}
              className={`w-full p-4 pl-12 bg-slate-50 border ${error === t.addressError ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 focus:scale-[1.02] outline-none transition-all`}
            />
            {isAddressFocused && (isAddressLoading || addressSuggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-[1300]">
                {isAddressLoading && (
                  <div className="px-4 py-3 text-xs font-semibold text-slate-400">
                    {t.searchingAddress}
                  </div>
                )}
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.lat}_${suggestion.lon}_${suggestion.display_name}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleAddressSuggestionSelect(suggestion);
                    }}
                    className="w-full px-4 py-3 text-left border-t border-slate-50 first:border-t-0 hover:bg-blue-50 active:bg-blue-50 transition-colors"
                  >
                    <span className="block text-sm font-semibold text-slate-900 line-clamp-2">
                      {suggestion.display_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {error === t.addressError && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                {error}
              </motion.div>
            )}
          </div>
          
          <div className="h-64 rounded-2xl overflow-hidden border border-slate-100 mb-4 relative z-10">
            <MapContainer 
              center={[formData.lat, formData.lng]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[formData.lat, formData.lng]} />
              <MapEvents />
              <ChangeView center={[formData.lat, formData.lng]} />
            </MapContainer>
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 z-[1000] border border-slate-100 shadow-sm">
              {t.mapHint}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.date}</label>
            <DateField
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
              placeholder="24.03.2026"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.time}</label>
            <TimeField
              value={formData.time}
              onChange={(time) => setFormData({ ...formData, time })}
              placeholder="18:00"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.description}</label>
          <textarea 
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t.descriptionPlaceholder}
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
          />
        </div>

        <div ref={budgetFieldRef}>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.payment}</label>
          <input 
            ref={budgetInputRef}
            type="number" 
            value={formData.budget}
            onChange={(e) => { setFormData({ ...formData, budget: e.target.value }); setError(null); }}
            placeholder="2000" 
            className={`w-full p-4 bg-slate-50 border ${error === t.budgetError ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
          />
          {error === t.budgetError && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              {error}
            </motion.div>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">{t.paymentMethod}</label>
          <div className="flex gap-2">
            {['Наличные', 'Карта', 'СБП'].map(method => (
              <button
                key={method}
                onClick={() => setFormData({ ...formData, paymentMethod: method })}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                  formData.paymentMethod === method 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-slate-50 text-slate-500 border border-slate-100'
                }`}
              >
                {getPaymentMethodLabel(method, t)}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-20">
          {error && !isFieldError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
            >
              <AlertTriangle size={16} />
              {error}
            </motion.div>
          )}
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
          >
            {isSubmitting ? t.publishing : t.publishOrder}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingScreen = () => (
  <div className="absolute inset-0 bg-white z-[200] flex flex-col items-center justify-center screen-shell">
    <Logo size={80} className="mb-8 animate-pulse" />
    <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
      <motion.div 
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="absolute inset-0 bg-blue-600 rounded-full"
      />
    </div>
    <p className="mt-6 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Загрузка данных...</p>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-white p-5 rounded-3xl border border-slate-100 space-y-4 animate-pulse">
    <div className="flex justify-between items-start">
      <div className="w-20 h-5 bg-slate-100 rounded-full" />
      <div className="w-16 h-5 bg-slate-100 rounded-full" />
    </div>
    <div className="w-3/4 h-6 bg-slate-100 rounded-lg" />
    <div className="space-y-2">
      <div className="w-full h-4 bg-slate-100 rounded" />
      <div className="w-2/3 h-4 bg-slate-100 rounded" />
    </div>
    <div className="flex justify-between items-center pt-2">
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-slate-100 rounded-full" />
        <div className="w-24 h-4 bg-slate-100 rounded mt-2" />
      </div>
      <div className="w-20 h-8 bg-slate-100 rounded-xl" />
    </div>
  </div>
);

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;

  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Произошла неизвестная ошибка интерфейса.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] bg-slate-100 p-4">
          <div className="h-full max-w-md mx-auto bg-white rounded-3xl border border-red-100 shadow-xl p-6 flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500 mb-3">
              Ошибка интерфейса
            </p>
            <h1 className="text-2xl font-black text-slate-900 mb-3">
              Приложение не смогло открыться
            </h1>
            <p className="text-slate-600 mb-4 leading-relaxed">
              Ниже текст ошибки, который поможет быстро понять причину.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 break-words">
              {this.state.errorMessage}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-slate-900 text-white py-4 rounded-2xl font-bold"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  
  const [role, setRole] = useState<UserRole>('customer');
  const user = currentUserProfile || { id: firebaseUser?.uid || '', name: '', role, avatar: '', rating: 0 };
  const currentUserId = currentUserProfile?.id || firebaseUser?.uid || user.id;
  const [activeTab, setActiveTab] = useState('home');
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [rawChats, setRawChats] = useState<Chat[]>([]);
  const [chatProfiles, setChatProfiles] = useState<Record<string, any>>({});
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const shownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationsReadyRef = useRef(false);
  const hasRequestedInitialLocationRef = useRef(false);

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };


  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const [isRegistering, setIsRegistering] = useState(false);
  const [viewingWorkerId, setViewingWorkerId] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Fetch real orders
  useEffect(() => {
    if (!isLoggedIn) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 5000); // таймаут 5 сек
    const unsub = orderService.getOrders(
      (fetchedOrders) => {
        clearTimeout(timeout);
        setOrders(fetchedOrders as Order[]);
        setIsLoading(false);
      },
      (error) => {
        clearTimeout(timeout);
        console.error('Orders subscription failed:', error);
        setIsLoading(false);
      }
    );
    return () => { unsub(); clearTimeout(timeout); };
  }, [isLoggedIn]);

  // Fetch real workers
  useEffect(() => {
    if (!isLoggedIn) {
      setWorkers([]);
      return;
    }

    const unsub = orderService.getWorkers((fetchedWorkers) => {
      setWorkers(fetchedWorkers);
    });
    return unsub;
  }, [isLoggedIn]);

  // Fetch real chats
  useEffect(() => {
    if (!firebaseUser) {
      setRawChats([]);
      return;
    }
    const unsub = chatService.getChats(firebaseUser.uid, (fetchedChats) => {
      setRawChats(fetchedChats as Chat[]);
    });
    return unsub;
  }, [firebaseUser]);

  // Fetch real notifications
  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      shownNotificationIdsRef.current.clear();
      notificationsReadyRef.current = false;
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(newNotifications);

      const addedUnread = snapshot.docChanges()
        .filter(change => change.type === 'added')
        .map(change => ({ id: change.doc.id, data: change.doc.data() as Notification }))
        .filter(({ id, data }) => !data.isRead && !shownNotificationIdsRef.current.has(id));

      if (notificationsReadyRef.current) {
        addedUnread.forEach(({ id, data }) => {
          shownNotificationIdsRef.current.add(id);
          void showDeviceNotification(data.title, data.message);
        });
      } else {
        snapshot.docs.forEach(item => shownNotificationIdsRef.current.add(item.id));
        notificationsReadyRef.current = true;
      }
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });
    return unsub;
  }, [currentUserId]);

  // Keep selectedOrder in sync with orders array
  useEffect(() => {
    if (!selectedOrder) return;

    const updatedOrder = orders.find(o => o.id === selectedOrder.id);
    if (!updatedOrder) return;

    if (JSON.stringify(updatedOrder) !== JSON.stringify(selectedOrder)) {
      setSelectedOrder(updatedOrder);
    }
  }, [orders, selectedOrder]);

  // Fetch user profile when firebaseUser changes
  useEffect(() => {
    if (!firebaseUser) {
      setCurrentUserProfile(null);
      return;
    }

    // Query by uid field instead of document ID to handle session changes
    const userRef = doc(db, 'users', firebaseUser.uid);
    let profileResolved = false;
    const missingProfileTimeout = window.setTimeout(() => {
      if (profileResolved) return;
      console.error('User profile was not found for authenticated user:', firebaseUser.uid);
      setCurrentUserProfile(null);
      setIsLoggedIn(false);
      setIsAuthChecking(false);
    }, 8000);

    const unsub = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        profileResolved = true;
        window.clearTimeout(missingProfileTimeout);
        const profile = { id: snapshot.id, ...snapshot.data() } as User;
        setCurrentUserProfile(profile);
        setRole(profile.role);
        setIsLoggedIn(true);
        setIsAuthChecking(false);
      }
    }, (error) => {
      profileResolved = true;
      window.clearTimeout(missingProfileTimeout);
      console.error('Error loading user profile:', error);
      setCurrentUserProfile(null);
      setIsLoggedIn(false);
      setIsAuthChecking(false);
    });
    return () => {
      window.clearTimeout(missingProfileTimeout);
      unsub();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || rawChats.length === 0) return;

    const currentUid = firebaseUser.uid;
    const idsToLoad: string[] = Array.from(
      new Set(
        rawChats
          .map((chat) => {
            if (user?.role === 'dispatcher') {
              if (chat.participantRole === 'customer') return chat.customerId;
              if (chat.participantRole === 'worker') return chat.workerId;
              return chat.customerId || chat.workerId;
            }
            if (chat.customerId === currentUid) return chat.dispatcherId || chat.workerId;
            if (chat.workerId === currentUid) return chat.dispatcherId || chat.customerId;
            if (chat.dispatcherId === currentUid) return chat.customerId || chat.workerId;
            return chat.customerId || chat.workerId || chat.dispatcherId;
          })
          .filter((id): id is string => !!id && id !== 'support')
          .filter((id) => !workers.some((w) => w.id === id || w.uid === id))
          .filter((id) => !chatProfiles[id])
      )
    );

    if (idsToLoad.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const snapshots = await Promise.all(
          idsToLoad.map((id) => getDoc(doc(db, 'users', id)))
        );

        if (cancelled) return;

        const loadedEntries = snapshots
          .map((snap, index) => {
            if (!snap.exists()) return null;
            return [idsToLoad[index], { id: snap.id, ...snap.data() }] as const;
          })
          .filter(Boolean) as Array<readonly [string, any]>;

        if (loadedEntries.length === 0) return;

        setChatProfiles((prev) => {
          const next = { ...prev };
          let changed = false;

          for (const [id, profile] of loadedEntries) {
            if (!next[id]) {
              next[id] = profile;
              changed = true;
            }
          }

          return changed ? next : prev;
        });
      } catch (error) {
        console.error('Error loading chat profiles:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawChats, firebaseUser, workers, user?.role, chatProfiles]);

  const chats = useMemo(() => {
    if (!firebaseUser) return [] as Chat[];

    const currentUid = firebaseUser.uid;

    return rawChats.map((chat) => {
      let otherUserId: string | undefined;

      if (user?.role === 'dispatcher') {
        if (chat.participantRole === 'customer') {
          otherUserId = chat.customerId;
        } else if (chat.participantRole === 'worker') {
          otherUserId = chat.workerId;
        } else {
          otherUserId = chat.customerId || chat.workerId;
        }
      } else if (chat.customerId === currentUid) {
        otherUserId = chat.dispatcherId || chat.workerId;
      } else if (chat.workerId === currentUid) {
        otherUserId = chat.dispatcherId || chat.customerId;
      } else if (chat.dispatcherId === currentUid) {
        otherUserId = chat.customerId || chat.workerId;
      } else {
        otherUserId = chat.customerId || chat.workerId || chat.dispatcherId;
      }

      if (!otherUserId || otherUserId === 'support') {
        return {
          ...chat,
          otherUserName: 'Диспетчер',
          otherUserAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4'
        };
      }

      const workerProfile = workers.find(w => w.id === otherUserId || w.uid === otherUserId);
      const cachedProfile = chatProfiles[otherUserId];
      const profile = workerProfile || cachedProfile;

      let fallbackName = 'Пользователь';
      if (chat.customerId === otherUserId) fallbackName = 'Клиент';
      if (chat.workerId === otherUserId) fallbackName = 'Исполнитель';
      if (chat.dispatcherId === otherUserId) fallbackName = 'Диспетчер';

      return {
        ...chat,
        otherUserName: profile?.name || fallbackName,
        otherUserAvatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`
      };
    });
  }, [rawChats, firebaseUser, workers, chatProfiles, user?.role]);

  useEffect(() => {
    if (!isLoggedIn || !firebaseUser || role === 'dispatcher' || hasRequestedInitialLocationRef.current) return;
    if (!navigator.geolocation) return;

    const storageKey = `gruzok_location_permission_requested_${firebaseUser.uid}`;
    const alreadyRequested = window.localStorage.getItem(storageKey) === '1';
    const hasSavedLocation = Number.isFinite(currentUserProfile?.lat) && Number.isFinite(currentUserProfile?.lng);
    if (alreadyRequested && hasSavedLocation) return;

    hasRequestedInitialLocationRef.current = true;
    window.localStorage.setItem(storageKey, '1');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            lat,
            lng,
            lastLocationAt: serverTimestamp(),
          });
        } catch (error) {
          console.error('Error saving initial location:', error);
        }
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        if (denied) {
          console.info('Location permission was denied by user');
        } else {
          console.warn('Initial location request failed:', error);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [isLoggedIn, firebaseUser, role, currentUserProfile?.lat, currentUserProfile?.lng]);


  // Push Notifications Integration
  useEffect(() => {
    void setupDeviceNotifications();
  }, []);

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    registerPushNotifications(firebaseUser.uid).then((dispose) => {
      if (cancelled) {
        dispose();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [firebaseUser?.uid]);

  const notifyUser = useCallback(async (targetUserId: string, title: string, body: string, type: Notification['type'] = 'system') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        title,
        message: body,
        type,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving notification for user:", targetUserId, error);
    }
  }, []);

  const sendPushNotification = useCallback(async (title: string, body: string, type: Notification['type'] = 'system') => {
    if (currentUserId) {
      notifyUser(currentUserId, title, body, type);
    }
  }, [currentUserId, notifyUser]);

  const notifyOrderParticipants = useCallback(async (
    order: Order,
    title: string,
    body: string,
    options: { includeCurrentUser?: boolean } = {}
  ) => {
    const recipientIds = new Set<string>();
    const includeCurrentUser = options.includeCurrentUser ?? true;

    if (order.customerId) recipientIds.add(order.customerId);
    if (order.workerId) recipientIds.add(order.workerId);
    order.assignedWorkers?.forEach(worker => {
      if (worker.id) recipientIds.add(worker.id);
    });

    if (!includeCurrentUser && currentUserId) {
      recipientIds.delete(currentUserId);
    }

    await Promise.all(
      Array.from(recipientIds).map(userId => notifyUser(userId, title, body, 'order'))
    );
  }, [currentUserId, notifyUser]);

  const lastNotifiedOrderId = useRef<string | null>(null);
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    if (orders.length > 0) {
      // 1. New Order Notifications (for workers)
      if (role === 'worker') {
        const lastOrder = orders[0];
        if (lastOrder.id !== lastNotifiedOrderId.current) {
          lastNotifiedOrderId.current = lastOrder.id;
          const isRecent = lastOrder.createdAt && (Date.now() - (lastOrder.createdAt as any).toMillis() < 30000);
          if (isRecent && lastOrder.status === 'open') {
            sendPushNotification(
              'Новый заказ рядом!', 
              `Появился новый заказ: "${lastOrder.title}" в категории ${lastOrder.category}. Бюджет: ${lastOrder.budget} ₽`,
              'order'
            );
          }
        }
      }
      prevOrdersRef.current = orders;
    }
  }, [orders, role, sendPushNotification]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setIsAuthChecking(true);
      if (user) {
        setFirebaseUser(user);
        // Ставим онлайн
        try {
          await updateDoc(doc(db, 'users', user.uid), { isOnline: true });
        } catch {}
      } else {
        setFirebaseUser(null);
        setCurrentUserProfile(null);
        setIsLoggedIn(false);
        setIsAuthChecking(false);
      }
    });

    // Ставим оффлайн при закрытии вкладки
    const handleOffline = async () => {
      const uid = auth.currentUser?.uid;
      if (uid) {
        try { await updateDoc(doc(db, 'users', uid), { isOnline: false }); } catch {}
      }
    };
    window.addEventListener('beforeunload', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, []);

  const handleCreateChat = async (orderId: string, workerId: string) => {
    const existingChat = chats.find((chat) => {
      if (chat.participants?.includes(currentUserId) && chat.participants?.includes(workerId)) {
        return true;
      }

      return (
        (chat.customerId === currentUserId && chat.workerId === workerId) ||
        (chat.customerId === workerId && chat.workerId === currentUserId)
      );
    });
    const chatId = existingChat?.id || await chatService.getOrCreateChat(orderId, currentUserId, workerId);
    const profile = workers.find(w => w.id === workerId || w.uid === workerId);
    setSelectedChat({
      ...(existingChat || {}),
      id: chatId,
      orderId: existingChat?.orderId || 'direct',
      participants: existingChat?.participants || [currentUserId, workerId].sort(),
      customerId: currentUserId,
      workerId,
      otherUserName: profile?.name || 'Грузчик',
      otherUserAvatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${workerId}`
    });
    setActiveTab('chat');
  };

  const handleShowSupport = async () => {
    const uid = currentUserId;
    if (!uid) return;
    if (role === 'dispatcher') return;

    setShowSettings(false);
    setShowNotifications(false);
    setShowOrderHistory(false);
    setSelectedOrder(null);
    setViewingWorkerId(null);
    setIsCreating(null);
    setShowRules(false);
    
    try {
      const supportChatOptions = role === 'worker'
        ? { workerId: uid, dispatcherId: 'support' }
        : { customerId: uid, dispatcherId: 'support' };
      const chatId = await chatService.getOrCreateChat('support_order', uid, 'support', supportChatOptions);
      setSelectedChat({
        id: chatId,
        orderId: 'direct',
        participants: [uid, 'support'].sort(),
        ...supportChatOptions,
        otherUserName: 'Диспетчер (Поддержка)',
        otherUserAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4'
      });
      setActiveTab('chat');
    } catch (error) {
      console.error("Error opening support chat:", error);
      alert('Не удалось открыть чат поддержки. Проверьте интернет и попробуйте еще раз.');
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Выйти из аккаунта?',
      message: 'Вы уверены, что хотите выйти? Вам придется снова вводить номер телефона для входа.',
      type: 'warning',
      confirmText: 'Выйти',
      onConfirm: async () => {
        try {
          if (firebaseUser) {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { isOnline: false });
          }
          await authService.logout();
          // Сбрасываем всё
          setIsLoggedIn(false);
          setFirebaseUser(null);
          setCurrentUserProfile(null);
          setOrders([]);
          setWorkers([]);
          setRawChats([]);
          setChatProfiles({});
          setNotifications([]);
          setSelectedOrder(null);
          setSelectedChat(null);
          setActiveTab('home');
          setRole('customer');
          setIsCreating(null);
          setViewingWorkerId(null);
          setShowSettings(false);
          setShowNotifications(false);
          setShowOrderHistory(false);
        } catch (error) {
          console.error("Logout error:", error);
        }
      }
    });
  };

  const handleBack = () => {
    if (viewingWorkerId) {
      setViewingWorkerId(null);
    } else if (selectedChat) {
      setSelectedChat(null);
    } else if (selectedOrder) {
      setSelectedOrder(null);
    } else if (isCreating) {
      setIsCreating(null);
    } else if (showOrderHistory) {
      setShowOrderHistory(false);
    } else if (showNotifications) {
      setShowNotifications(false);
    } else if (showSettings) {
      setShowSettings(false);
    } else if (isRegistering) {
      setIsRegistering(false);
    }
  };

  const handleCreateOrder = async (orderData: Partial<Order>) => {
    const customerId = firebaseUser?.uid;
    if (!customerId) {
      console.error('Cannot create order without authenticated Firebase user');
      return 'Не удалось создать заказ: пользователь не авторизован. Выйдите и войдите снова.';
    }

    const safeCategory = typeof orderData.category === 'string' && orderData.category.trim()
      ? orderData.category.trim()
      : 'Разное';

    let newOrderData = {
      title: orderData.title || '',
      description: orderData.description || '',
      budget: orderData.budget || 0,
      address: orderData.address || '',
      category: safeCategory,
      customerId,
      status: 'open' as Order['status'],
      time: orderData.time || '',
      date: orderData.date || '',
      workersCount: orderData.workersCount || 1,
      paymentMethod: orderData.paymentMethod || 'Наличные',
      lat: orderData.lat || 55.7558,
      lng: orderData.lng || 37.6173,
      createdAt: serverTimestamp()
    };

    try {
      let docRef;
      try {
        docRef = await addDoc(collection(db, 'orders'), newOrderData);
      } catch (error: any) {
        const errorText = `${error?.code || ''} ${error?.message || error}`;
        const canRetryAsOpen =
          newOrderData.status === 'pending_negotiation' &&
          errorText.includes('permission-denied');

        if (!canRetryAsOpen) throw error;

        console.warn('Order create with pending_negotiation was rejected, retrying with open status:', error);
        newOrderData = {
          ...newOrderData,
          status: 'open' as Order['status'],
        };
        docRef = await addDoc(collection(db, 'orders'), newOrderData);
      }

      const newOrder: Order = {
        id: docRef.id,
        ...newOrderData,
        createdAt: undefined // Will be handled by snapshot
      } as Order;
      
      setIsCreating(null);
      
      // Notify about new order
      if (newOrder.status === 'pending_negotiation') {
        // Уведомляем только диспетчеров
        workers
          .filter(w => w.role === 'dispatcher')
          .forEach(dispatcher => {
            notifyUser(
              dispatcher.uid || dispatcher.id,
              'Новый заказ на согласование',
              `Заказ "${newOrder.title}" требует согласования бюджета.`,
              'order'
            );
          });
      } else {
        // Уведомляем подходящих исполнителей
        workers.forEach(worker => {
          if (worker.role === 'worker') {
            const matchesSkill = !worker.skills || worker.skills.length === 0 || 
              worker.skills.some((s: string) => 
                newOrder.category.toLowerCase().includes(s.toLowerCase()) || 
                newOrder.title.toLowerCase().includes(s.toLowerCase())
              );
            
            let matchesLocation = true;
            if (newOrder.lat && newOrder.lng && worker.lat && worker.lng) {
              const dist = calculateDistance(newOrder.lat, newOrder.lng, worker.lat, worker.lng);
              matchesLocation = dist <= 20;
            }

            if (matchesSkill && matchesLocation) {
              notifyUser(
                worker.uid || worker.id,
                'Новый подходящий заказ!',
                `В категории "${newOrder.category}" появился заказ: "${newOrder.title}". Бюджет: ${newOrder.budget} ₽`,
                'order'
              );
            }
          }
        });
      }
      return true;
    } catch (error) {
      console.error('Error creating order:', error);
      const errorText = error instanceof Error ? error.message : String(error);
      try {
        handleFirestoreError(error, OperationType.WRITE, 'orders');
      } catch {}
      if (errorText.includes('permission-denied')) {
        return 'Firebase не разрешил создать заказ. Нужно обновить правила Firestore для новой базы или проверить авторизацию.';
      }
      return `Не удалось создать заказ: ${errorText.slice(0, 180)}`;
    }
  };

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const historyEntry: StatusHistoryEntry = {
      status: status,
      timestamp: new Date().toISOString(),
      changedBy: role,
    };

    try {
      await orderService.updateOrderStatus(orderId, status, [...(order.statusHistory || []), historyEntry]);
      
      // Notify about status change
      const statusLabels: Record<string, string> = {
        'open': 'открыт',
        'in-progress': 'в работе',
        'completed': 'завершен'
      };
      
      await notifyOrderParticipants(
        order,
        `Заказ #${order.id.slice(-4)}: ${statusLabels[status] || status}`,
        `Статус заказа "${order.title}" изменен на "${statusLabels[status] || status}"`
      );
      
      if (status === 'in-progress') {
        setTimeout(() => {
          if (order.customerId) {
            notifyUser(
              order.customerId,
              'Исполнитель уже близко!',
              `Ваш исполнитель по заказу "${order.title}" будет на месте через 5 минут.`,
              'order'
            );
          }
        }, 5000);
      }

    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleNegotiate = async (orderId: string, negotiatedBudget: number, commission: number) => {
    const order = orders.find(o => o.id === orderId);
    
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        negotiatedBudget,
        commission,
        budget: negotiatedBudget - commission,
        status: 'open'
      });
      // Локальный стейт обновится через onSnapshot автоматически
    } catch (error) {
      console.error('Error negotiating budget:', error);
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }

    if (order) {
      sendPushNotification('Бюджет согласован', `Диспетчер установил бюджет ${negotiatedBudget} ₽ для заказа "${order.title}"`);
      if (negotiatedBudget >= 5000) {
        sendPushNotification('🔥 Срочный премиум-заказ!', `Согласован бюджет ${negotiatedBudget} ₽ для заказа "${order.title}". Успейте откликнуться!`);
      }
    }
  };

  const handleQuickApply = async (orderId: string) => {
    try {
      await orderService.applyToOrder(orderId, currentUserId);
      sendPushNotification('Отклик отправлен', 'Вы успешно откликнулись на заказ. Ожидайте решения диспетчера.');
    } catch (error) {
      console.error("Error applying to order:", error);
    }
  };
  const handleAssignWorker = async (orderId: string, workerIds: string | string[]) => {
    const ids = Array.isArray(workerIds) ? workerIds : [workerIds];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const maxWorkers = Math.max(1, order.workersCount || 1);
      const existingWorkers = order.assignedWorkers || [];
      const existingIds = new Set(existingWorkers.map(w => w.id));
      const requestedIds = Array.from(new Set(ids.filter(Boolean)));
      const targetIds = Array.isArray(workerIds)
        ? requestedIds.slice(0, maxWorkers)
        : [
            ...existingWorkers.map(w => w.id),
            ...requestedIds.filter(id => !existingIds.has(id)),
          ].slice(0, maxWorkers);

      if (targetIds.length === existingWorkers.length && requestedIds.every(id => existingIds.has(id))) {
        return;
      }

      // Fetch real profiles for the workers
      const selectedWorkerProfiles: AssignedWorker[] = await Promise.all(targetIds.map(async id => {
        const existingWorker = existingWorkers.find(worker => worker.id === id);
        if (existingWorker) return existingWorker;

        const docSnap = await getDoc(doc(db, 'users', id));
        if (docSnap.exists()) {
          const profile = docSnap.data();
          return {
            id,
            name: profile.name,
            avatar: profile.avatar,
            status: 'assigned'
          };
        }
        const realProfile = workers.find(w => w.id === id || w.uid === id);
        return {
          id,
          name: realProfile?.name || 'Исполнитель',
          avatar: realProfile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
          status: 'assigned'
        };
      }));
      
      await orderService.assignWorkers(orderId, selectedWorkerProfiles);

      requestedIds.forEach(id => {
        if (existingIds.has(id)) return;
        const profile = workers.find(w => w.id === id || w.uid === id);
        sendPushNotification('Исполнитель назначен', `На заказ "${order.title}" назначен исполнитель ${profile?.name || 'Исполнитель'}`);
      });
    } catch (error) {
      console.error("Error assigning workers:", error);
    }
  };

  const handleUnassignWorker = (orderId: string, workerId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Отстранить исполнителя?',
      message: 'Вы уверены, что хотите отстранить этого исполнителя от выполнения заказа?',
      type: 'danger',
      confirmText: 'Отстранить',
      onConfirm: async () => {
        try {
          await orderService.unassignWorker(orderId, workerId);
          sendPushNotification('Исполнитель отстранен', `Один из исполнителей был отстранен от заказа.`);
        } catch (error) {
          console.error("Error unassigning worker:", error);
        }
      }
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Удалить заказ?',
      message: 'Это действие нельзя будет отменить. Заказ будет полностью удален из системы.',
      type: 'danger',
      confirmText: 'Удалить',
      onConfirm: async () => {
        try {
          await orderService.deleteOrder(orderId);
          setSelectedOrder(null);
          sendPushNotification('Заказ удален', `Ваш заказ был успешно удален.`);
        } catch (error) {
          console.error("Error deleting order:", error);
        }
      }
    });
  };

  const handleReplaceWorker = async (orderId: string, oldWorkerId: string, newWorkerId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      const docSnap = await getDoc(doc(db, 'users', newWorkerId));
      if (!docSnap.exists()) return;
      const newWorkerProfile = docSnap.data();

      const newWorker: AssignedWorker = {
        id: newWorkerId,
        name: newWorkerProfile.name,
        avatar: newWorkerProfile.avatar,
        status: 'assigned'
      };

      const updatedWorkers = (order.assignedWorkers || []).map((worker) =>
        worker.id === oldWorkerId ? newWorker : worker
      );

      await updateDoc(doc(db, 'orders', orderId), {
        assignedWorkers: updatedWorkers,
        workerId: updatedWorkers[0]?.id 
      });

      sendPushNotification('Исполнитель заменен', `На заказе "${order.title}" исполнитель заменен на ${newWorkerProfile.name}`);
    } catch (error) {
      console.error("Error replacing worker:", error);
    }
  };

  const handleOpenChat = async (participantId: string, participantRole: string, orderId?: string) => {
    if (!currentUserId || !participantId) return;

    const isDispatcher = user?.role === 'dispatcher';
    const isOrderScopedDispatcherChat =
      isDispatcher && !!orderId && !['manual', 'direct', 'support_order'].includes(orderId);

    // Диспетчерские чаты привязаны к заказу, обычные чаты остаются прямыми между людьми.
    const existingChat = chats.find(c => {
      const isCurrentUserParticipant =
        c.participants?.includes(currentUserId) ||
        c.customerId === currentUserId ||
        c.workerId === currentUserId ||
        c.dispatcherId === currentUserId;

      if (!isCurrentUserParticipant) return false;

      if (isDispatcher) {
        if (isOrderScopedDispatcherChat && c.orderId !== orderId) return false;
        if (!isOrderScopedDispatcherChat && c.orderId && !['direct', 'manual'].includes(c.orderId)) return false;

        if (participantRole === 'customer') {
          return c.customerId === participantId && c.dispatcherId === currentUserId;
        }

        if (participantRole === 'worker') {
          return c.workerId === participantId && c.dispatcherId === currentUserId;
        }

        return false;
      }

      if (c.dispatcherId && c.dispatcherId !== 'support') return false;

      if (c.participants?.includes(currentUserId) && c.participants?.includes(participantId)) {
        return true;
      }

      if (participantRole === 'customer') {
        return c.customerId === participantId && c.workerId === currentUserId;
      }

      if (participantRole === 'worker') {
        return c.workerId === participantId && c.customerId === currentUserId;
      }

      return false;
    });

    if (existingChat) {
      let profile: any = participantId === 'support'
        ? SUPPORT_PROFILE
        : workers.find(w => w.id === participantId || w.uid === participantId);

      if (!profile && participantId !== 'support') {
        try {
          const snap = await getDoc(doc(db, 'users', participantId));
          if (snap.exists()) profile = { id: snap.id, ...snap.data() };
        } catch {}
      }

      setSelectedChat({
        ...existingChat,
        otherUserName: existingChat.otherUserName || profile?.name || 'Пользователь',
        otherUserAvatar: existingChat.otherUserAvatar || profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participantId}`
      });

      setSelectedOrder(null);
      setViewingWorkerId(null);
      setActiveTab('chat');
      return;
    }

    try {
      // Определяем роли в чате
      let chatOptions: { customerId?: string; workerId?: string; dispatcherId?: string };

      if (isDispatcher) {
        if (participantRole === 'customer') {
          chatOptions = { customerId: participantId, dispatcherId: currentUserId };
        } else {
          // worker
          chatOptions = {
            workerId: participantId,
            dispatcherId: currentUserId
          };
        }
      } else if (user?.role === 'customer') {
        chatOptions = { customerId: currentUserId, workerId: participantId };
      } else {
        // worker
        chatOptions = { customerId: participantId, workerId: currentUserId };
      }

      const chatId = await chatService.getOrCreateChat(
        orderId || 'manual',
        currentUserId,
        participantId,
        chatOptions
      );

      let profile: any = participantId === 'support'
        ? SUPPORT_PROFILE
        : workers.find(w => w.id === participantId || w.uid === participantId);

      if (!profile && participantId !== 'support') {
        try {
          const snap = await getDoc(doc(db, 'users', participantId));
          if (snap.exists()) profile = { id: snap.id, ...snap.data() };
        } catch {}
      }

      setSelectedChat({
        id: chatId,
        orderId: isOrderScopedDispatcherChat ? orderId! : 'direct',
        participants: [currentUserId, participantId].sort(),
        chatType: isOrderScopedDispatcherChat ? 'order' : 'direct',
        participantRole: isDispatcher && (participantRole === 'customer' || participantRole === 'worker') ? participantRole : undefined,
        ...chatOptions,
        otherUserName: profile?.name || 'Пользователь',
        otherUserAvatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participantId}`
      });

      setSelectedOrder(null);
      setViewingWorkerId(null);
      setActiveTab('chat');
    } catch (error) {
      console.error("Error opening chat:", error);
      alert('Не удалось открыть чат. Проверьте интернет и попробуйте еще раз.');
    }
  };

  const handleUpdateWorkerStatus = async (orderId: string, workerId: string, status: AssignedWorker['status']) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const workerProfile = workers.find(w => w.id === workerId || w.uid === workerId);
    const historyEntry: StatusHistoryEntry = {
      status: status,
      timestamp: new Date().toISOString(),
      changedBy: 'worker',
      workerId: workerId,
      workerName: workerProfile?.name || 'Исполнитель'
    };

    try {
      let newOrderStatus = order.status;

      if (status === 'at-work' && order.status === 'open') {
        newOrderStatus = 'in-progress';
      }

      const nextWorkers = (order.assignedWorkers || []).map(w =>
        w.id === workerId ? { ...w, status } : w
      );

      if (nextWorkers.length > 0 && nextWorkers.every(w => w.status === 'finished')) {
        newOrderStatus = 'completed';
      }

      const updatedLocation =
        status === 'on-way'
          ? order.workerLiveLocation || null
          : null;

      await updateDoc(doc(db, 'orders', orderId), {
        status: newOrderStatus,
        assignedWorkers: nextWorkers,
        workerLiveLocation: updatedLocation,
        statusHistory: [...(order.statusHistory || []), historyEntry]
      });

      const statusLabels: Record<string, string> = {
        'assigned': 'назначен',
        'on-way': 'в пути',
        'at-work': 'на месте',
        'finished': 'завершил работу'
      };

      const workerName = order.assignedWorkers?.find(w => w.id === workerId)?.name || 'Исполнитель';
      sendPushNotification('Статус исполнителя', `${workerName} теперь ${statusLabels[status]}`);
    } catch (error) {
      console.error("Error updating worker status:", error);
    }
  };

  const handleBid = async (orderId: string, workerId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
      await orderService.applyToOrder(orderId, workerId);
      const workerProfile = workers.find(w => w.id === workerId);
      const workerName = workerProfile?.name || 'Исполнитель';
      
      // Notify Customer
      if (order.customerId) {
        notifyUser(
          order.customerId, 
          'Новый отклик!', 
          `Исполнитель ${workerName} откликнулся на ваш заказ "${order.title}"`,
          'order'
        );
      }
      
      // Notify current user (worker)
      sendPushNotification('Отклик отправлен', 'Вы успешно откликнулись на заказ!');
    } catch (error) {
      console.error("Error placing bid:", error);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      if (!currentUserId) {
        console.error("currentUserId not found");
        return;
      }

      const userDocRef = doc(db, 'users', currentUserId);
      const snapshot = await getDoc(userDocRef);

      if (!snapshot.exists()) {
        console.error("User profile document not found");
        return;
      }

      const dataToUpdate = {
        name: updatedUser.name || '',
        phone: normalizePhone(updatedUser.phone || ''),
        avatar: updatedUser.avatar || '',
        skills: updatedUser.skills || [],
        experience: updatedUser.experience || '',
        bio: updatedUser.bio || '',
        portfolio: updatedUser.portfolio || [],
        role: updatedUser.role || 'customer',
        rating: updatedUser.rating || 0,
        completedJobs: updatedUser.completedJobs || 0,
      };

      await updateDoc(userDocRef, dataToUpdate);

      setCurrentUserProfile({
        ...updatedUser,
        ...dataToUpdate,
        id: currentUserId,
      });
    } catch (error) {
      console.error("Error updating user profile:", error);
    }
  };

  const handleReview = async (orderId: string, rating: number, text: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order || !currentUserId) return false;

      const trimmedText = text.trim();
      if (rating < 1 || rating > 5 || !trimmedText) return false;

      const targetUserId =
        role === 'customer'
          ? (order.workerId || order.assignedWorkers?.[0]?.id)
          : order.customerId;

      if (!targetUserId) {
        console.error('Review target user not found');
        return false;
      }

      const authorName = currentUserProfile?.name || user.name || 'Пользователь';
      const authorAvatar = currentUserProfile?.avatar || user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`;
      const reviewId = `${orderId}_${currentUserId}`;
      const createdAt = new Date().toISOString();
      const review: Review = {
        id: reviewId,
        orderId,
        authorId: currentUserId,
        author: authorName,
        avatar: authorAvatar,
        targetId: targetUserId,
        targetRole: role === 'customer' ? 'worker' : 'customer',
        rating,
        text: trimmedText,
        date: new Date().toLocaleDateString('ru-RU'),
      };

      const targetRef = doc(db, 'users', targetUserId);
      const targetSnap = await getDoc(targetRef);
      if (!targetSnap.exists()) {
        console.error('Review target profile not found');
        return false;
      }

      const targetData = targetSnap.data();
      const previousReviews = Array.isArray(targetData.reviews) ? targetData.reviews : [];
      const nextReviews = [
        ...previousReviews.filter((item: Review) => item.id !== reviewId),
        review,
      ];
      const nextRating = Math.round(
        (nextReviews.reduce((sum: number, item: Review) => sum + (item.rating || 0), 0) / nextReviews.length) * 10
      ) / 10;

      await updateDoc(targetRef, {
        reviews: nextReviews,
        rating: nextRating,
        reviewsCount: nextReviews.length,
      });

      const orderReviews = Array.isArray(order.reviews) ? order.reviews : [];
      const nextOrderReviews = [
        ...orderReviews.filter((item) => item.id !== reviewId),
        { ...review, createdAt },
      ];
      const updateData: any = {
        reviews: nextOrderReviews,
        review: { ...review, createdAt },
      };

      if (role === 'customer') updateData.customerReviewed = true;
      if (role === 'worker') updateData.workerReviewed = true;

      await updateDoc(doc(db, 'orders', orderId), updateData);
      sendPushNotification('Отзыв отправлен', 'Спасибо за вашу оценку!');
      return true;
    } catch (error) {
      console.error("Error adding review:", error);
      return false;
    }
  };

  if (isAuthChecking) {
    return (
      <ErrorBoundary>
        <div className="h-[100dvh] overflow-hidden bg-slate-100">
          <div className="h-full max-w-md mx-auto bg-white overflow-hidden relative flex flex-col">
            <LoadingScreen />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <div className="h-[100dvh] overflow-hidden bg-slate-100">
          <div className="h-full max-w-md mx-auto bg-white overflow-hidden relative flex flex-col">
          <AnimatePresence>
            {isRegistering ? (
              <Register 
                onBack={() => setIsRegistering(false)} 
                onRegister={async (newRole, name, phone, password) => {
                  try {
                    await authService.register(phone, password, name, newRole);
                    setIsRegistering(false);
                    if (newRole === 'worker') {
                      setShowRules(true);
                    }
                  } catch (err: any) {
                    console.error("Registration error:", err);
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Ошибка регистрации',
                      message: err.message || 'Произошла ошибка при регистрации. Попробуйте снова.',
                      onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                      type: 'danger',
                      confirmText: 'ОК'
                    });
                  }
                }} 
              />
            ) : (
              <Onboarding 
                onLogin={async (phone, password) => {
                  try {
                    await authService.login(phone, password);
                  } catch (err: any) {
                    console.error("Login error:", err);
                    setConfirmDialog({
                      isOpen: true,
                      title: 'Ошибка входа',
                      message: err.message || 'Произошла ошибка при входе. Попробуйте снова.',
                      onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
                      type: 'danger',
                      confirmText: 'ОК'
                    });
                  }
                }} 
                onRegister={() => setIsRegistering(true)}
              />
            )}
          </AnimatePresence>
          {confirmDialog.isOpen && (
            <div className="absolute inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              >
                <h3 className={`text-xl font-bold mb-2 ${confirmDialog.type === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>
                  {confirmDialog.title}
                </h3>
                <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
                >
                  {confirmDialog.confirmText || 'ОК'}
                </button>
              </motion.div>
            </div>
          )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="h-[100dvh] overflow-hidden bg-slate-100">
        <div className="h-full max-w-md mx-auto bg-white flex flex-col relative overflow-hidden">
          <Header 
            title={activeTab === 'home' ? (role === 'customer' ? 'ГрузОК' : TRANSLATIONS[lang].orders) : activeTab === 'chat' ? TRANSLATIONS[lang].chats : TRANSLATIONS[lang].profile} 
          />
          
          <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-hidden">
                  {role === 'customer' ? (
                    <CustomerHome 
                      user={user} 
                      orders={orders} 
                      workers={workers}
                      lang={lang}
                      onOrderClick={setSelectedOrder} 
                      onWorkerClick={setViewingWorkerId}
                      onCreateClick={(category) => setIsCreating(category || 'Грузчики')} 
                      onShowSupport={handleShowSupport}
                      isLoading={isLoading}
                    />
                  ) : role === 'worker' ? (
                    <WorkerHome 
                      user={user}
                      orders={orders} 
                      workers={workers}
                      lang={lang}
                      onOrderClick={setSelectedOrder} 
                      onQuickApply={handleQuickApply}
                      onWorkerClick={setViewingWorkerId}
                      onShowSupport={handleShowSupport}
                      isLoading={isLoading}
                      currentUserId={currentUserId}
                    />
                  ) : (
                    <DispatcherAdmin 
                      user={user}
                      orders={orders}
                      chats={chats}
                      workers={workers}
                      onOrderClick={setSelectedOrder}
                      onWorkerClick={setViewingWorkerId}
                      onOpenChat={handleOpenChat}
                    />
                  )}
                </motion.div>
              )}
              {activeTab === 'chat' && (
                <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-hidden">
                  <ChatList userId={currentUserId} chats={chats} lang={lang} onChatClick={setSelectedChat} />
                </motion.div>
              )}
              {activeTab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col overflow-hidden">
                  <Profile 
                    user={user} 
                    orders={orders}
                    lang={lang}
                    onLogout={handleLogout} 
                    onUpdateUser={handleUpdateUser}
                    onShowHistory={() => setShowOrderHistory(true)}
                    onShowNotifications={() => setShowNotifications(true)}
                    onShowSettings={() => setShowSettings(true)}
                    onShowSupport={handleShowSupport}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="shrink-0 bg-white border-t border-slate-100 page-gutters pt-4 bottom-tabbar flex justify-between items-center rounded-2xl shadow-lg">
            {[
              { id: 'home', icon: <Briefcase size={24} />, label: TRANSLATIONS[lang].home },
              { id: 'chat', icon: <MessageSquare size={24} />, label: TRANSLATIONS[lang].chats },
              { id: 'profile', icon: <UserIcon size={24} />, label: TRANSLATIONS[lang].profile },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`}
              >
                {tab.icon}
                <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Overlays */}
          <AnimatePresence>
        {selectedOrder && (
          <OrderDetails 
            order={selectedOrder} 
            orders={orders}
            workers={workers}
            role={role} 
            currentUserId={currentUserId}
            onBack={handleBack} 
            onOrderClick={setSelectedOrder}
            onUpdateStatus={handleUpdateStatus}
            onUpdateWorkerStatus={handleUpdateWorkerStatus}
            onNegotiate={handleNegotiate}
            onReview={handleReview}
            onAssignWorker={handleAssignWorker}
            onUnassignWorker={handleUnassignWorker}
            onDeleteOrder={handleDeleteOrder}
            onReplaceWorker={handleReplaceWorker}
            onOpenChat={handleOpenChat}
            onBid={handleBid}
            onCompleteOrder={(id) => handleUpdateStatus(id, 'completed')}
            onShowSupport={handleShowSupport}
            lang={lang}
            viewingWorkerId={viewingWorkerId}
            setViewingWorkerId={setViewingWorkerId}
          />
        )}
        {isCreating && (
          <CreateOrder 
            initialCategory={isCreating}
            lang={lang}
            onClose={handleBack} 
            onCreate={handleCreateOrder} 
          />
        )}
        {showOrderHistory && (
          <OrderHistory 
            user={user}
            orders={orders}
            lang={lang}
            onOrderClick={setSelectedOrder}
            onWorkerClick={setViewingWorkerId}
            onBack={handleBack}
            onShowSupport={handleShowSupport}
          />
        )}
        {showNotifications && (
          <Notifications 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onBack={handleBack} 
            onOrderClick={(orderId) => {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                setSelectedOrder(order);
                setShowNotifications(false);
              }
            }}
            onShowSupport={role !== 'dispatcher' ? handleShowSupport : undefined}
          />
        )}
        {showSettings && (
          <SettingsPage 
            onBack={handleBack} 
            user={user} 
            onUpdateUser={handleUpdateUser} 
            lang={lang}
            setLang={setLang}
            onShowSupport={handleShowSupport}
          />
        )}
        {viewingWorkerId && !selectedOrder && (
          <WorkerProfile 
            workerId={viewingWorkerId} 
            workers={workers}
            orders={orders}
            role={role}
            onBack={handleBack} 
            onOrderClick={(order) => {
              setSelectedOrder(order);
              setViewingWorkerId(null);
            }}
          />
        )}
        {selectedChat && (
          <ChatRoom 
            userId={currentUserId}
            chat={selectedChat} 
            lang={lang}
            onBack={handleBack} 
          />
        )}
        {showRules && (
          <RulesPage 
            onAccept={() => {
              setShowRules(false);
              setActiveTab('home');
            }} 
          />
        )}
        {confirmDialog.isOpen && (
          <ConfirmationDialog 
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            type={confirmDialog.type}
            onConfirm={confirmDialog.onConfirm}
            onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          />
        )}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  );
}
