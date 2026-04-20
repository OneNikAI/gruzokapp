import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { chatService, Chat, Message, Timestamp, checkUserExists, createUserProfile, collection, addDoc, serverTimestamp, db, handleFirestoreError, OperationType, authService, orderService, onSnapshot, doc, getDoc, getDocs, updateDoc, query, where, orderBy, limit } from './firebase';
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
  rating: number;
  text: string;
  date: string;
  avatar?: string;
}

interface User {
  id: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar: string;
  rating: number;
  skills?: string[];
  experience?: string;
  bio?: string;
  portfolio?: PortfolioItem[];
  reviews?: Review[];
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
  time?: string;
  date?: string;
  workersCount?: number;
  paymentMethod?: string;
  distance?: number; // Distance in km
  lat?: number;
  lng?: number;
  statusHistory?: StatusHistoryEntry[];
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
    save: "Сохранить",
    cancel: "Отмена",
    name: "Имя",
    phone: "Телефон",
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
    save: "Save",
    cancel: "Cancel",
    name: "Name",
    phone: "Phone",
    aboutText: "GruzOK is a modern platform for quickly finding loaders and handymen. We help customers and performers find each other.",
    faq: [
      { q: "How to order a service?", a: "Click on the 'Create Order' button on the main page and select the desired category." },
      { q: "How to become a performer?", a: "Register in the application and select the role 'I am a performer'." }
    ]
  }
};

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
const MOCK_USER_CUSTOMER: User = {
  id: 'u1',
  name: 'Александр',
  role: 'customer',
  avatar: 'https://picsum.photos/seed/alex/100',
  rating: 4.9,
  reviews: [
    { id: 'r1', author: 'Сергей', rating: 5, text: 'Отличный заказчик, всё четко и вовремя.', date: '20.03.2026', avatar: 'https://picsum.photos/seed/serg/100' },
    { id: 'r2', author: 'Дмитрий', rating: 4, text: 'Всё хорошо, но пришлось немного подождать на месте.', date: '15.03.2026', avatar: 'https://picsum.photos/seed/dmit/100' },
  ]
};

const MOCK_USER_WORKER: User = {
  id: 'u2',
  name: 'Иван',
  role: 'worker',
  avatar: 'https://picsum.photos/seed/ivan/100',
  rating: 4.8,
  skills: ['Грузоперевозки', 'Сборка мебели', 'Такелажные работы'],
  experience: 'Более 5 лет опыта в сфере переездов и сборки мебели. Есть свой инструмент и грузовой автомобиль.',
  portfolio: [
    { type: 'image', url: 'https://picsum.photos/seed/port1/600/400' },
    { type: 'image', url: 'https://picsum.photos/seed/port2/600/400' },
    { type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', thumbnail: 'https://picsum.photos/seed/vid1/600/400' },
  ],
  reviews: [
    { id: 'r3', author: 'Анна', rating: 5, text: 'Иван — настоящий профессионал! Перевезли всё быстро и аккуратно.', date: '22.03.2026', avatar: 'https://picsum.photos/seed/anna/100' },
    { id: 'r4', author: 'Михаил', rating: 5, text: 'Очень доволен работой. Рекомендую!', date: '18.03.2026', avatar: 'https://picsum.photos/seed/mikh/100' },
  ]
};

const MOCK_USER_DISPATCHER: User = {
  id: 'u4',
  name: 'Алексей',
  role: 'dispatcher',
  avatar: 'https://picsum.photos/seed/dispatcher/100',
  rating: 5.0
};

const INITIAL_ORDERS: Order[] = [
  {
    id: 'o1',
    title: 'Перевезти диван и 2 кресла',
    description: 'Нужно перевезти мебель из квартиры на 3 этаже (есть лифт) в загородный дом. Помощь с погрузкой обязательна.',
    budget: 2000,
    negotiatedBudget: 2500,
    commission: 500,
    address: 'ул. Ленина, 45',
    category: 'Переезд',
    customerId: 'u1',
    status: 'open',
    time: '18:00',
    date: '24.03.2026',
    workersCount: 2,
    paymentMethod: 'Наличные',
    distance: 3.2,
    lat: 55.7558,
    lng: 37.6173,
    assignedWorkers: [
      { id: 'w1', name: 'Алексей', avatar: 'https://picsum.photos/seed/w1/200', status: 'on-way' },
      { id: 'w2', name: 'Михаил', avatar: 'https://picsum.photos/seed/w2/200', status: 'assigned' }
    ]
  },
  {
    id: 'o2',
    title: 'Разгрузить фуру со стройматериалами',
    description: 'Требуется 2 человека на 3 часа работы. Разгрузка ГКЛ и мешков со смесью.',
    budget: 2400,
    negotiatedBudget: 3000,
    commission: 600,
    address: 'пр. Мира, 12',
    category: 'Грузчики',
    customerId: 'u3',
    status: 'in-progress',
    time: '10:00',
    date: '25.03.2026',
    workersCount: 2,
    paymentMethod: 'Карта',
    distance: 1.5,
    lat: 55.7833,
    lng: 37.6333,
    assignedWorkers: [
      { id: 'w3', name: 'Сергей', avatar: 'https://picsum.photos/seed/w3/200', status: 'at-work' },
      { id: 'w4', name: 'Дмитрий', avatar: 'https://picsum.photos/seed/w4/200', status: 'at-work' }
    ],
    statusHistory: [
      { status: 'open', timestamp: '2026-03-25T08:00:00Z', changedBy: 'dispatcher' },
      { status: 'in-progress', timestamp: '2026-03-25T10:00:00Z', changedBy: 'dispatcher' },
      { status: 'at-work', timestamp: '2026-03-25T10:15:00Z', changedBy: 'worker', workerName: 'Сергей' },
      { status: 'at-work', timestamp: '2026-03-25T10:20:00Z', changedBy: 'worker', workerName: 'Дмитрий' }
    ]
  },
  {
    id: 'o3',
    title: 'Сборка шкафа ПАКС',
    description: 'Нужно собрать 3 секции шкафа ПАКС. Инструмент есть.',
    budget: 4500, // This is initial budget from customer
    address: 'ул. Гагарина, 10',
    category: 'Сборка',
    customerId: 'u1',
    status: 'pending_negotiation',
    time: '14:00',
    date: '26.03.2026',
    workersCount: 1,
    paymentMethod: 'Наличные',
    distance: 8.4,
    lat: 55.7000,
    lng: 37.5000,
    candidates: ['u2', 'u5'],
    statusHistory: [
      { status: 'pending_negotiation', timestamp: '2026-03-26T12:00:00Z', changedBy: 'customer' }
    ]
  },
  {
    id: 'o4',
    title: 'Помощь на даче',
    description: 'Нужно вскопать грядки и перенести дрова.',
    budget: 1200,
    negotiatedBudget: 1500,
    commission: 300,
    address: 'СНТ Рассвет',
    category: 'Разное',
    customerId: 'u3',
    workerId: 'u2',
    status: 'completed',
    time: '09:00',
    date: '20.03.2026',
    workersCount: 1,
    paymentMethod: 'Наличные',
    distance: 25.0,
    lat: 55.9000,
    lng: 37.8000,
    statusHistory: [
      { status: 'open', timestamp: '2026-03-20T08:00:00Z', changedBy: 'dispatcher' },
      { status: 'in-progress', timestamp: '2026-03-20T09:00:00Z', changedBy: 'dispatcher' },
      { status: 'at-work', timestamp: '2026-03-20T09:10:00Z', changedBy: 'worker', workerName: 'Иван' },
      { status: 'finished', timestamp: '2026-03-20T12:00:00Z', changedBy: 'worker', workerName: 'Иван' },
      { status: 'completed', timestamp: '2026-03-20T12:15:00Z', changedBy: 'dispatcher' }
    ]
  },
  {
    id: 'o5',
    title: 'Сборка кухонного гарнитура',
    description: 'Нужна сборка кухни IKEA 3 метра. Все инструменты есть.',
    budget: 4000,
    negotiatedBudget: 5000,
    commission: 1000,
    address: 'ул. Гагарина, 10',
    category: 'Сборка',
    customerId: 'u1',
    workerId: 'u2',
    status: 'completed',
    time: '12:00',
    date: '18.03.2026',
    workersCount: 1,
    paymentMethod: 'СБП',
    lat: 55.7000,
    lng: 37.5000
  }
];

const MOCK_WORKER_PROFILES: Record<string, WorkerProfileData> = {
  'u2': {
    id: 'u2',
    name: 'Иван Петров',
    avatar: 'https://picsum.photos/seed/worker1/200',
    rating: 4.9,
    reviewsCount: 124,
    bio: 'Опытный грузчик и сборщик мебели. Работаю аккуратно, есть свой инструмент. Пунктуальность гарантирую.',
    portfolio: [
      'https://picsum.photos/seed/p1/300/200',
      'https://picsum.photos/seed/p2/300/200',
      'https://picsum.photos/seed/p3/300/200'
    ],
    reviews: [
      { id: 'r1', author: 'Алексей', rating: 5, text: 'Отличный мастер! Собрал шкаф очень быстро.', date: '20.03.2026' },
      { id: 'r2', author: 'Мария', rating: 4, text: 'Приехал вовремя, помог с переездом. Рекомендую.', date: '15.03.2026' }
    ],
    responseTime: '15 мин',
    isOnline: true,
    availability: 'Свободен до 20:00'
  },
  'u4': {
    id: 'u4',
    name: 'Сергей Волков',
    avatar: 'https://picsum.photos/seed/worker2/200',
    rating: 4.7,
    reviewsCount: 89,
    bio: 'Занимаюсь переездами более 5 лет. Крепкий, выносливый. Есть напарник при необходимости.',
    portfolio: [
      'https://picsum.photos/seed/p4/300/200',
      'https://picsum.photos/seed/p5/300/200'
    ],
    reviews: [
      { id: 'r3', author: 'Дмитрий', rating: 5, text: 'Все супер, перевезли пианино без царапин.', date: '10.03.2026' }
    ],
    responseTime: '30 мин',
    isOnline: false,
    availability: 'Занят до завтра',
    skills: ['Грузчик', 'Сборка мебели', 'Такелажные работы'],
    experience: 'Более 5 лет в сфере грузоперевозок. Работал в крупных мувинговых компаниях.'
  },
  'u5': {
    id: 'u5',
    name: 'Андрей Соколов',
    avatar: 'https://picsum.photos/seed/worker3/200',
    rating: 4.5,
    reviewsCount: 56,
    bio: 'Разнорабочий. Помогу на даче, разгружу фуру, вынесу мусор. Работаю на совесть.',
    portfolio: [
      'https://picsum.photos/seed/p6/300/200'
    ],
    reviews: [
      { id: 'r4', author: 'Елена', rating: 4, text: 'Хороший парень, помог вскопать огород.', date: '05.03.2026' }
    ],
    responseTime: '1 час',
    isOnline: true,
    availability: 'Свободен сейчас',
    skills: ['Разнорабочий', 'Демонтаж', 'Уборка мусора'],
    experience: 'Опыт работы на стройках и складах. Готов к тяжелому физическому труду.'
  },
  'support': {
    id: 'support',
    name: 'Диспетчер (Поддержка)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4',
    rating: 5.0,
    reviewsCount: 999,
    bio: 'Официальная служба поддержки ГрузОК. Мы работаем 24/7, чтобы помочь вам с любыми вопросами.',
    portfolio: [],
    reviews: [],
    responseTime: '1 мин',
    isOnline: true,
    availability: 'На связи'
  }
};
const MOCK_CHATS = [
  { id: 'support', name: 'Служба поддержки', lastMsg: 'Здравствуйте! Чем мы можем вам помочь?', time: 'Сейчас', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4' },
  { id: 'ch1', name: 'Дмитрий (Грузчик)', lastMsg: 'Буду через 15 минут', time: '12:45', avatar: 'https://picsum.photos/seed/dima/100' },
  { id: 'ch2', name: 'Сергей (Сборка)', lastMsg: 'Инструменты взял', time: 'Вчера', avatar: 'https://picsum.photos/seed/serg/100' },
];

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  type: 'order' | 'payment' | 'system' | 'chat';
  orderId?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'Новый заказ',
    message: 'Появился новый заказ в категории "Переезд" рядом с вами.',
    time: '5 мин. назад',
    isRead: false,
    type: 'order',
    orderId: '1'
  },
  {
    id: 'n2',
    title: 'Оплата получена',
    message: 'Ваш баланс пополнен на 1500 ₽ за заказ #o1.',
    time: '2 ч. назад',
    isRead: true,
    type: 'payment',
    orderId: '2'
  },
  {
    id: 'n3',
    title: 'Сообщение',
    message: 'Заказчик Иван Петров отправил вам сообщение.',
    time: '1 дн. назад',
    isRead: true,
    type: 'chat',
    orderId: '3'
  }
];

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

// Sub-components
interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  role?: UserRole;
  setRole?: (role: UserRole) => void;
}

const Header = ({ title, showBack = false, onBack, role, setRole }: HeaderProps) => (
  <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10 transition-colors">
    <div className="flex items-center gap-3">
      {showBack && (
        <button onClick={onBack} className="p-1 -ml-2 text-slate-900">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
    </div>
    <div className="flex items-center gap-3">
      {!showBack && setRole && role && (
        <button 
          onClick={() => setRole(role === 'customer' ? 'worker' : 'customer')}
          className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"
        >
          {role === 'customer' ? 'Я Исполнитель' : 'Я Заказчик'}
        </button>
      )}
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
}

const OrderCard: React.FC<OrderCardProps> = ({ order, workers = [], onClick, onWorkerClick, onQuickApply, hideStatus, role }) => {
  const displayWorkers = workers.length > 0 ? workers : Object.values(MOCK_WORKER_PROFILES);
  const workersMap = displayWorkers.reduce((acc, w) => {
    acc[w.id] = w;
    return acc;
  }, {} as Record<string, any>);

  const statusColors: Record<Order['status'], string> = {
    'pending_negotiation': 'bg-amber-50 text-amber-600',
    'open': 'bg-emerald-50 text-emerald-600',
    'in-progress': 'bg-blue-50 text-blue-600',
    'completed': 'bg-slate-100 text-slate-600'
  };

  const statusLabels: Record<Order['status'], string> = {
    'pending_negotiation': 'На согласовании',
    'open': 'Открыт',
    'in-progress': 'В работе',
    'completed': 'Завершен'
  };

  return (
    <motion.div 
      layoutId={order.id}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      onClick={() => onClick(order)}
      whileHover={{ 
        scale: 1.02, 
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
      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-4 cursor-pointer transition-all relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-2 gap-4">
        <div className="flex flex-wrap gap-2 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {order.category}
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
              <span>{order.distance} км</span>
            </div>
          )}
        </div>

        {role === 'worker' && order.status === 'open' && onQuickApply && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onQuickApply(order.id);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
          >
            Откликнуться
          </button>
        )}
      </div>
    </motion.div>
  );
};


// Phone Mask Helper
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 2) return `+7`;
  if (phoneNumberLength < 5) return `+7 (${phoneNumber.slice(1, 4)}`;
  if (phoneNumberLength < 8) return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}`;
  return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 9)}-${phoneNumber.slice(9, 11)}`;
};

const PhoneInput = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    if (formattedValue.length <= 18) {
      onChange(formattedValue);
    }
  };

  return (
    <input 
      type="tel" 
      value={value}
      onChange={handleChange}
      placeholder="+7 (999) 999-99-99" 
      className={className || "w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors"} 
    />
  );
};

// SMS Verification Component
const SMSVerification = ({ onVerify, onBack, phone }: { onVerify: () => void, onBack: () => void, phone: string }) => {
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // For demo purposes, we'll show the code in the UI
    const fetchCode = async () => {
      try {
        const sentCode = await authService.sendVerificationCode(phone);
        setDemoCode(sentCode);
      } catch (err) {
        console.error("Error sending initial verification code:", err);
        setError('Ошибка при отправке кода подтверждения');
      }
    };
    fetchCode();
  }, [phone]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    if (value && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    const inputCode = code.join('');
    const isValid = await authService.verifyCode(phone, inputCode);
    
    if (isValid) {
      onVerify();
    } else {
      setError('Неверный код подтверждения');
      setIsVerifying(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col"
    >
      <button onClick={onBack} className="mb-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
        <ArrowLeft size={20} />
      </button>

      <h2 className="text-3xl font-black mb-2 tracking-tight">Подтверждение</h2>
      <p className="text-slate-500 mb-8">Мы отправили СМС с кодом на номер <span className="text-slate-900 font-bold">{phone}</span></p>

      {demoCode && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 flex items-center gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12" />
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm">
            <Bell size={24} className="animate-bounce" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-blue-100 uppercase tracking-[0.2em] mb-1">Код подтверждения</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-white tracking-widest">{demoCode}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(demoCode);
                  alert('Код скопирован!');
                }}
                className="p-1.5 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors"
                title="Копировать код"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex justify-between gap-4 mb-6">
        {code.map((digit, i) => (
          <input
            key={i}
            ref={el => inputs.current[i] = el}
            type="number"
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-16 h-20 text-center text-3xl font-black bg-slate-50 border-2 ${error ? 'border-red-200' : 'border-slate-100'} rounded-2xl focus:border-blue-600 focus:bg-blue-50 outline-none transition-all`}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm font-bold mb-6 text-center">{error}</p>
      )}

      <button 
        onClick={handleVerify}
        disabled={code.some(d => !d) || isVerifying}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isVerifying && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        Подтвердить
      </button>

      <button 
        onClick={async () => {
          try {
            const newCode = await authService.sendVerificationCode(phone);
            setDemoCode(newCode);
            setCode(['', '', '', '']);
            setError(null);
            // Show a small success feedback if needed
          } catch (err: any) {
            setError('Ошибка при отправке кода. Попробуйте позже.');
          }
        }}
        className="mt-6 text-blue-600 font-bold text-sm active:scale-95 transition-transform"
      >
        Отправить код еще раз
      </button>
    </motion.div>
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
      className="absolute inset-0 bg-white z-50 flex flex-col p-8"
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
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleStartRegistration = async () => {
    setIsChecking(true);
    setError('');

    try {
      if (password.length < 6) {
        setError('Пароль должен быть не короче 6 символов');
        return;
      }
      if (password !== confirmPassword) {
        setError('Пароли не совпадают');
        return;
      }

      const userExists = await checkUserExists(phone);
      if (userExists) {
        setError('Пользователь с таким номером уже зарегистрирован');
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
      className="absolute inset-0 bg-white z-50 flex flex-col p-8"
    >
      <button onClick={onBack} className="mb-8 w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1 overflow-y-auto">
        <h2 className="text-3xl font-black mb-2 tracking-tight">Регистрация</h2>
        <p className="text-slate-500 mb-8">Создайте аккаунт по номеру телефона и паролю</p>

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
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Минимум 6 символов" 
              className="w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Повторите пароль</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль" 
              className="w-full p-4 bg-slate-50 border border-slate-100 text-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-colors" 
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs font-bold mt-2">{error}</p>
          )}
        </div>
      </div>

      <button 
        onClick={handleStartRegistration}
        disabled={!name || phone.length < 18 || password.length < 6 || confirmPassword.length < 6 || isChecking}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform mt-8 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isChecking ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : 'Зарегистрироваться'}
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
      className="absolute inset-0 bg-white z-[100] flex flex-col p-8"
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
    <div className="flex-1 flex flex-col p-8 items-center justify-center text-center">
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
  onOrderClick: (order: Order) => void;
  onWorkerClick: (workerId: string) => void;
  onCreateClick: (category?: string) => void;
  onShowSupport?: () => void;
}

const CustomerHome = ({ user, orders, workers, onOrderClick, onWorkerClick, onCreateClick, onShowSupport, isLoading }: CustomerHomeProps & { isLoading?: boolean }) => {
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
    <div className="p-6 overflow-y-auto flex-1">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2 text-slate-900">Привет, {user.name}! 👋</h2>
        <p className="text-slate-500">Нужна помощь с грузом или ремонтом?</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { icon: <Briefcase size={24} />, label: 'Грузчики', color: 'bg-orange-50 text-orange-600' },
          { icon: <MapPin size={24} />, label: 'Переезд', color: 'bg-blue-50 text-blue-600' },
          { icon: <PlusCircle size={24} />, label: 'Сборка', color: 'bg-emerald-50 text-emerald-600' },
          { icon: <Search size={24} />, label: 'Разное', color: 'bg-purple-50 text-purple-600' },
        ].map((cat, i) => (
          <button 
            key={i} 
            onClick={() => onCreateClick(cat.label)}
            className={`${cat.color} p-4 rounded-2xl flex flex-col items-center gap-2 font-semibold transition-all active:scale-95 shadow-sm`}
          >
            {cat.icon}
            <span className="text-sm">{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-900">Ваши заказы</h3>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}
        >
          <Sliders size={20} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
        {[
          { id: 'all', label: 'Все' },
          { id: 'open', label: 'Открытые' },
          { id: 'in-progress', label: 'В работе' },
          { id: 'completed', label: 'Завершенные' },
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
              <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Категория</label>
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
                    {cat === 'all' ? 'Все' : cat}
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
          />
        ))
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-3xl">
          <Search className="text-slate-300 mx-auto mb-2" size={32} />
          <p className="text-slate-500 text-sm">Заказов не найдено</p>
        </div>
      )}

      <button 
        onClick={onCreateClick}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
      >
        <PlusCircle size={28} />
      </button>

      <button 
        onClick={() => onShowSupport?.()}
        className="fixed bottom-40 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
        title="Поддержка"
      >
        <MessageSquare size={24} />
      </button>
    </div>
  );
};

interface WorkerHomeProps {
  orders: Order[];
  workers: any[];
  onOrderClick: (order: Order) => void;
  onQuickApply: (orderId: string) => void;
  onWorkerClick: (workerId: string) => void;
  onShowSupport?: () => void;
}

const WorkerHome = ({ orders, workers, onOrderClick, onQuickApply, onWorkerClick, onShowSupport, isLoading }: WorkerHomeProps & { isLoading?: boolean }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('open');
  const [filterDistance, setFilterDistance] = useState<number>(50);
  const [minBudget, setMinBudget] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchCenter, setSearchCenter] = useState<[number, number]>([55.7558, 37.6173]); // Default to Moscow
  const [isLocating, setIsLocating] = useState(false);

  const categories = ['all', 'Грузчики', 'Переезд', 'Сборка', 'Разное'];

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchCenter([position.coords.latitude, position.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        alert('Не удалось получить местоположение');
      }
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
    <div className="p-6 overflow-y-auto flex-1">
      <div className="bg-slate-900 text-white p-6 rounded-3xl mb-6 relative overflow-hidden transition-colors">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Вы на линии</h2>
          <p className="text-slate-400 text-sm mb-4">Рядом {filteredOrders.length} подходящих заказов</p>
          <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Радиус поиска: {filterDistance} км
          </div>
        </div>
        <Briefcase className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-900">Доступные заказы</h3>
        <div className="flex gap-2">
          <button 
            onClick={handleGetCurrentLocation}
            disabled={isLocating}
            className="p-2 bg-white border border-slate-100 rounded-xl text-blue-600 shadow-sm active:scale-95 transition-all disabled:opacity-50"
            title="Мое местоположение"
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
          { id: 'all', label: 'Все' },
          { id: 'open', label: 'Открытые' },
          { id: 'in-progress', label: 'В работе' },
          { id: 'completed', label: 'Завершенные' },
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
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Категория</label>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'all' ? 'Все категории' : cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Мин. бюджет (₽)</label>
                <select 
                  value={minBudget}
                  onChange={(e) => setMinBudget(Number(e.target.value))}
                  className="w-full p-3 bg-white border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Любой</option>
                  <option value={1000}>от 1000</option>
                  <option value={2000}>от 2000</option>
                  <option value={3000}>от 3000</option>
                  <option value={5000}>от 5000</option>
                  <option value={10000}>от 10000</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Макс. расстояние</label>
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
                Выбрать на карте
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
                  <div className="text-xs font-bold text-center">Центр поиска</div>
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
                          {order.category}
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
                        Подробнее
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
                role="worker"
              />
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-slate-300" size={32} />
              </div>
              <p className="text-slate-500 font-medium">Заказов не найдено</p>
              <button 
                onClick={() => {
                  setFilterCategory('all');
                  setFilterDistance(50);
                  setMinBudget(0);
                }}
                className="text-blue-600 text-sm font-bold mt-2"
              >
                Сбросить фильтры
              </button>
            </div>
          )
        )}
      </div>

      <button 
        onClick={() => onShowSupport?.()}
        className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-20"
        title="Поддержка"
      >
        <MessageSquare size={24} />
      </button>
    </div>
  );
};

interface ChatListProps {
  userId: string;
  chats: Chat[];
  onChatClick: (chat: Chat) => void;
}

const ChatList = ({ userId, chats, onChatClick }: ChatListProps) => {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Сообщения</h2>
        <div className="space-y-2">
          {chats.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>Нет активных чатов</p>
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
                <p className="text-sm text-slate-500 line-clamp-1">{chat.lastMessage || 'Начните общение...'}</p>
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
  onBack: () => void;
}

const ChatRoom = ({ userId, chat, onBack }: ChatRoomProps) => {
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
    const recipientId = chat.customerId === userId ? chat.workerId : chat.customerId;
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
      <Header title={chat.otherUserName || 'Чат'} showBack onBack={onBack} />
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
      <div className="p-4 border-t border-slate-100 safe-area-bottom flex gap-2">
        <input 
          type="text" 
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Сообщение..." 
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
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
  onShowHistory?: () => void;
  onShowNotifications?: () => void;
  onShowSettings?: () => void;
  onShowSupport?: () => void;
}

const Profile = ({ user, orders, onLogout, onUpdateUser, onShowHistory, onShowNotifications, onShowSettings, onShowSupport }: ProfileProps) => {
  const [activeSubTab, setActiveSubTab] = useState<'main' | 'portfolio' | 'reviews'>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<PortfolioItem | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'portfolio' | 'avatar') => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateUser) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      
      if (target === 'avatar') {
        onUpdateUser({ ...user, avatar: url });
      } else {
        if (!user.portfolio) return;
        const type = file.type.startsWith('video') ? 'video' : 'image';
        const newItem: PortfolioItem = {
          type,
          url,
          thumbnail: type === 'video' ? 'https://picsum.photos/seed/vid/600/400' : undefined
        };
        onUpdateUser({
          ...user,
          portfolio: [...user.portfolio, newItem]
        });
      }
    };
    reader.readAsDataURL(file);
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
      <div className="pt-6 px-6 border-b border-slate-100">
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
            <span className="font-bold">{user.rating}</span>
            <span className="text-slate-400 text-sm font-normal ml-1">(48 отзывов)</span>
          </div>
        </div>

        <div className="flex gap-8">
          {[
            { id: 'main', label: 'Профиль', icon: <UserIcon size={18} /> },
            ...(user.role === 'worker' ? [{ id: 'portfolio', label: 'Портфолио', icon: <Briefcase size={18} /> }] : []),
            { id: 'reviews', label: 'Отзывы', icon: <Star size={18} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`pb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors relative ${
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
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">О себе</h3>
                  <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 italic">
                    "{user.bio}"
                  </p>
                </div>
              )}

                  {user.role === 'worker' && (
                    <>
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                          <ShieldCheck size={12} className="text-blue-600" /> Навыки и компетенции
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
                            <p className="text-xs text-slate-400 italic">Навыки не указаны</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                          <Briefcase size={12} className="text-blue-600" /> Опыт работы
                        </h3>
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-full -mr-12 -mt-12" />
                          <p className="text-slate-600 text-sm leading-relaxed relative z-10">
                            {user.experience || 'Опыт работы не указан'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Заказы', val: ordersCount.toString() },
                  { label: 'Баланс', val: `${totalBalance} ₽` },
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{stat.label}</p>
                    <p className="font-bold text-slate-900">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">Контактные данные</h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
                    <Phone size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Телефон</p>
                    <p className="font-bold text-slate-900">{user.phone || 'Не указан'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { icon: <History size={20} />, label: 'История заказов', action: onShowHistory },
                  { icon: <Bell size={20} />, label: 'Уведомления', action: onShowNotifications },
                  { icon: <Settings size={20} />, label: 'Настройки', action: onShowSettings },
                  { icon: <MessageSquare size={20} />, label: 'Служба поддержки', action: onShowSupport },
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
                  <span className="font-semibold">Выйти</span>
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
                <h3 className="text-lg font-bold text-slate-900">Мои работы</h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase shadow-lg shadow-blue-200"
                >
                  <Plus size={16} /> Добавить
                </button>
              </div>
              
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
                  className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-300 hover:text-blue-400 transition-colors bg-slate-50"
                >
                  <Camera size={32} className="mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Загрузить</span>
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
              <h3 className="text-lg font-bold text-slate-900">Отзывы ({user.reviews?.length || 0})</h3>
              <div className="space-y-4">
                {user.reviews?.map((review) => (
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
                {(!user.reviews || user.reviews.length === 0) && (
                  <div className="text-center py-12 text-slate-400">
                    <Star size={32} className="mx-auto mb-2 opacity-20" />
                    <p>Отзывов пока нет</p>
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">Редактировать профиль</h3>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Имя</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Телефон</label>
                  <input 
                    type="text" 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                {user.role === 'worker' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Навыки (через запятую)</label>
                      <input 
                        type="text" 
                        value={editForm.skills}
                        onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Грузоперевозки, Сборка мебели..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">О себе (Bio)</label>
                      <textarea 
                        rows={3}
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder="Расскажите немного о себе..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Опыт работы</label>
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
                  <Check size={20} /> Сохранить изменения
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

const WorkerProfile = ({ workerId, workers, orders, onBack, onSelect, onOrderClick }: { 
  workerId: string, 
  workers: any[],
  orders: Order[],
  onBack: () => void, 
  onSelect?: () => void,
  onOrderClick?: (order: Order) => void
}) => {
  const displayWorkers = workers.length > 0 ? workers : Object.values(MOCK_WORKER_PROFILES);
  const profile = displayWorkers.find(w => w.id === workerId) || displayWorkers[0];

  const workerHistory = orders.filter(o => 
    o.workerId === workerId || 
    o.assignedWorkers?.some(aw => aw.id === workerId) ||
    o.candidates?.includes(workerId)
  );

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
              <span className="font-bold">{profile.rating}</span>
            </div>
            <span className="text-white/60 text-sm">• {profile.reviewsCount} отзывов</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
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

          {profile.skills && profile.skills.length > 0 && (
            <div className="mb-6">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Навыки</h4>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill: string, i: number) => (
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

        <div>
          <h3 className="font-bold text-lg mb-4 text-slate-900">Портфолио</h3>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {profile.portfolio.map((item: any, i: number) => {
              const isVideo = typeof item === 'object' ? item.type === 'video' : false;
              const url = typeof item === 'object' ? item.url : item;
              const thumb = typeof item === 'object' ? item.thumbnail || item.url : item;

              return (
                <div key={i} className="relative flex-shrink-0 group">
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
                    <button className="text-white text-xs font-bold px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-lg">
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
            {profile.reviews.map(review => (
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
          </div>
        </div>
      </div>

      {onSelect && (
        <div className="p-6 border-t border-slate-100 safe-area-bottom transition-colors">
          <button 
            onClick={onSelect}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            Выбрать исполнителя
          </button>
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
  onShowSupport: () => void
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

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

      <div className="p-6 border-t border-slate-100">
        <button 
          onClick={onShowSupport}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <MessageSquare size={20} />
          Написать в поддержку
        </button>
      </div>
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const t = TRANSLATIONS[lang];

  const handleSavePersonalData = () => {
    onUpdateUser({ ...user, name: editName, phone: editPhone });
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
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md">
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
                  <input 
                    type="text" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)}
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
                <p className="text-slate-400 text-sm">Версия 1.0.0</p>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {t.aboutText}
              </p>
              <div className="w-full pt-8 border-t border-slate-100">
                <p className="text-xs text-slate-400">© 2026 GruzOK Inc. Все права защищены.</p>
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
              
              <div className="pt-8 text-center space-y-4">
                <p className="text-sm text-slate-400">Не нашли ответ на свой вопрос?</p>
                <button 
                  onClick={onShowSupport}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <MessageSquare size={20} />
                  Написать в поддержку
                </button>
              </div>
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
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
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
            <button 
              onClick={onShowSupport}
              className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600"
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={20} />
                <span className="font-bold">Чат с поддержкой</span>
              </div>
              <ChevronRight size={20} />
            </button>
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
  
  const pendingOrders = orders.filter(o => o.status === 'pending_negotiation');
  const openOrders = orders.filter(o => o.status === 'open');
  const activeOrders = orders.filter(o => o.status === 'in-progress');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const displayWorkers = workers.length > 0 ? workers : Object.values(MOCK_WORKER_PROFILES);
  const workersMap = displayWorkers.reduce((acc, w) => {
    acc[w.id] = w;
    return acc;
  }, {} as Record<string, any>);

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
      <div className="bg-white border-b border-slate-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Панель управления 🎧</h2>
            <p className="text-slate-500 text-sm">Управление логистикой и кадрами</p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
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
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeView === 'orders' ? (
          <div className="space-y-8">
            {pendingOrders.length > 0 && (
              <section>
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" />
                  Требуют согласования
                </h3>
                <div className="grid gap-4">
                  {pendingOrders.map(order => (
                    <OrderCard key={order.id} order={order} onClick={onOrderClick} role="dispatcher" />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Navigation size={18} className="text-blue-500" />
                Активные и открытые
              </h3>
              <div className="grid gap-4">
                {[...openOrders, ...activeOrders].map(order => (
                  <div key={order.id} className="relative group">
                    <OrderCard order={order} workers={workers} onClick={onOrderClick} role="dispatcher" />
                    {order.status === 'open' && order.candidates && order.candidates.length > 0 && (
                      <div className="absolute top-4 right-4 flex -space-x-2">
                        {order.candidates.map(cid => (
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
                      <span>• {worker.reviewsCount} отзывов</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${worker.isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {worker.isOnline ? 'В сети' : 'Оффлайн'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">Средний ответ: {worker.responseTime}</p>
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
            {chats.length > 0 ? (
              chats.map(chat => {
                let otherUserId = '';
                if (user.role === 'dispatcher') {
                  otherUserId = chat.customerId !== user.id ? chat.customerId! : chat.workerId!;
                } else {
                  otherUserId = chat.customerId === user.id ? chat.workerId! : (chat.dispatcherId || chat.customerId!);
                }
                
                const otherUserProfile = MOCK_WORKER_PROFILES[otherUserId];
                const otherUser = otherUserProfile || (otherUserId === MOCK_USER_CUSTOMER.id ? MOCK_USER_CUSTOMER : MOCK_USER_DISPATCHER);
                const otherUserRole = otherUserProfile ? 'worker' : (otherUserId === MOCK_USER_CUSTOMER.id ? 'customer' : 'dispatcher');
                
                return (
                  <div 
                    key={chat.id} 
                    onClick={() => onOpenChat(otherUserId, otherUserRole, chat.orderId !== 'manual' ? chat.orderId : undefined)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-colors"
                  >
                    <img src={otherUser.avatar || 'https://picsum.photos/seed/user/50'} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-slate-900">{otherUser.name || 'Пользователь'}</h4>
                        <span className="text-[10px] text-slate-400">
                          {chat.lastMessageAt ? new Date(chat.lastMessageAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 line-clamp-1">{chat.lastMessage || 'Начать чат...'}</p>
                        {chat.orderId !== 'manual' && (
                          <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                            Заказ #{chat.orderId.slice(-4)}
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

const ReviewModal = ({ isOpen, onClose, onSubmit, targetName }: { isOpen: boolean, onClose: () => void, onSubmit: (rating: number, text: string) => void, targetName: string }) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

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
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Оставить отзыв</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Пожалуйста, оцените работу <span className="font-bold text-slate-900">{targetName}</span>. 
          Ваш отзыв поможет другим пользователям сделать правильный выбор.
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Комментарий</label>
          <textarea 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] resize-none"
            placeholder="Напишите пару слов о впечатлениях..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <button 
          onClick={() => onSubmit(rating, text)}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-all"
        >
          Отправить отзыв
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
  currentUserId: string;
  onBack: () => void;
  onOrderClick: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onUpdateWorkerStatus: (orderId: string, workerId: string, status: AssignedWorker['status']) => void;
  onNegotiate: (orderId: string, negotiatedBudget: number, commission: number) => void;
  onReview: (orderId: string, rating: number, text: string) => void;
  onAssignWorker: (orderId: string, workerIds: string | string[]) => void;
  onUnassignWorker?: (orderId: string, workerId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onReplaceWorker: (orderId: string, oldWorkerId: string, newWorkerId: string) => void;
  onOpenChat: (participantId: string, role: string, orderId?: string) => void;
  onBid: (orderId: string, workerId: string) => void;
  onShowSupport: () => void;
  viewingWorkerId: string | null;
  setViewingWorkerId: (id: string | null) => void;
}

const OrderDetails = ({ 
  order, 
  orders,
  workers,
  role, 
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
  setViewingWorkerId 
}: OrderDetailsProps) => {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [negotiatedBudget, setNegotiatedBudget] = useState(order.budget);
  const [commission, setCommission] = useState(order.commission || Math.round(order.budget * 0.1));
  const [workerLocation, setWorkerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(order.assignedWorkers?.map(w => w.id) || []);

  const displayWorkers = workers.length > 0 ? workers : Object.values(MOCK_WORKER_PROFILES);
  const workersMap = displayWorkers.reduce((acc, w) => {
    acc[w.id] = w;
    return acc;
  }, {} as Record<string, any>);

  const needsReview = order.status === 'completed' && 
    ((role === 'customer' && !order.customerReviewed) || (role === 'worker' && !order.workerReviewed));

  useEffect(() => {
    if (needsReview) {
      setShowReviewModal(true);
    }
  }, [needsReview]);

  const handleReviewSubmit = (rating: number, text: string) => {
    onReview(order.id, rating, text);
    setShowReviewModal(false);
  };

  const targetName = role === 'customer' 
    ? (workersMap[order.workerId || 'u2']?.name || 'Исполнитель')
    : 'Заказчик';

  useEffect(() => {
    if (order.status === 'in-progress' && order.lat && order.lng) {
      // Initialize worker location slightly away from order if not set
      if (!workerLocation) {
        setWorkerLocation({
          lat: order.lat - 0.005,
          lng: order.lng - 0.005
        });
      }

      const interval = setInterval(() => {
        setWorkerLocation(prev => {
          if (!prev) return null;
          // Move 5% closer to the target each step for smoother animation
          const newLat = prev.lat + (order.lat! - prev.lat) * 0.05;
          const newLng = prev.lng + (order.lng! - prev.lng) * 0.05;
          
          // If very close, just stay there
          if (Math.abs(newLat - order.lat!) < 0.00001 && Math.abs(newLng - order.lng!) < 0.00001) {
            return { lat: order.lat!, lng: order.lng! };
          }
          
          return { lat: newLat, lng: newLng };
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [order.status, order.lat, order.lng]);

  const statusLabels = {
    'pending_negotiation': 'На согласовании',
    'open': 'Открыт',
    'in-progress': 'В работе',
    'completed': 'Завершен'
  };

  const statusColors = {
    'pending_negotiation': 'bg-amber-50 text-amber-600',
    'open': 'bg-blue-50 text-blue-600',
    'in-progress': 'bg-amber-50 text-amber-600',
    'completed': 'bg-emerald-50 text-emerald-600'
  };

  const hasExecutor = (order.status !== 'open' && order.status !== 'pending_negotiation') || order.assignedWorkers?.length! > 0;

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
            onBack={() => setViewingWorkerId(null)} 
            onOrderClick={(order) => {
              onOrderClick(order);
              setViewingWorkerId(null);
            }}
            onSelect={role === 'dispatcher' ? () => {
              onAssignWorker(order.id, viewingWorkerId);
              setViewingWorkerId(null);
            } : undefined}
          />
        )}
      </AnimatePresence>
      <Header title="Детали заказа" showBack onBack={onBack} />
      <ReviewModal 
        isOpen={showReviewModal} 
        onClose={() => setShowReviewModal(false)} 
        onSubmit={handleReviewSubmit}
        targetName={targetName}
      />
      <div className="p-6 overflow-y-auto flex-1">
        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
              {order.category}
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
                Всего: {order.negotiatedBudget} ₽
              </span>
            )}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">{order.title}</h2>
        
        {role === 'dispatcher' && order.status === 'pending_negotiation' && (
          <div className="bg-white border-2 border-amber-100 p-6 rounded-3xl mb-8 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sliders size={20} className="text-amber-500" />
              Согласование бюджета
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Итоговый бюджет (от клиента)</label>
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
                <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Комиссия диспетчера</label>
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
                  <span className="text-sm font-medium text-blue-600">Выплата исполнителю:</span>
                  <span className="text-xl font-black text-blue-700">{negotiatedBudget - commission} ₽</span>
                </div>
              </div>

              <button 
                onClick={() => onNegotiate(order.id, negotiatedBudget, commission)}
                className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
              >
                Согласовать и опубликовать
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MapPin size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Адрес</span>
            </div>
            <div className="text-sm font-semibold">{order.address}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Clock size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Дата и Время</span>
            </div>
            <div className="text-sm font-semibold">{order.date ? `${order.date} в ${order.time}` : (order.time || 'Не указано')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Users size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Грузчики</span>
            </div>
            <div className="text-sm font-semibold">{order.workersCount || 1} чел.</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <CreditCard size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Оплата</span>
            </div>
            <div className="text-sm font-semibold">{order.paymentMethod || 'Наличные'}</div>
          </div>
        </div>

        {role === 'dispatcher' && order.status !== 'pending_negotiation' && (
          <div className="mb-8">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Управление исполнителями</h3>
            
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => onOpenChat(order.customerId, 'customer', order.id)}
                className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-slate-900 font-bold hover:bg-slate-50 transition-colors"
              >
                <MessageSquare size={18} className="text-blue-600" />
                Чат с клиентом
              </button>
              {order.workerId && (
                <button 
                  onClick={() => onOpenChat(order.workerId!, 'worker', order.id)}
                  className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-slate-900 font-bold hover:bg-slate-50 transition-colors"
                >
                  <MessageSquare size={18} className="text-emerald-600" />
                  Чат с исполнителем
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
                          {worker.status === 'at-work' ? 'На заказе' : 
                           worker.status === 'on-way' ? 'В пути' : 'Назначен'}
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
                <p className="text-slate-500 text-sm mb-4">Исполнители еще не назначены</p>
                <button 
                  onClick={() => setIsAssigning(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100"
                >
                  Назначить грузчиков
                </button>
              </div>
            )}

            {order.candidates && order.candidates.length > 0 && (
              <div className="mt-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Приняли заказ ({order.candidates.length})</h4>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {order.candidates.map(cid => {
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
                  <h3 className="text-xl font-black text-slate-900">Выбор исполнителей</h3>
                  <p className="text-xs text-slate-500">Выбрано: {selectedWorkers.length} из {order.workersCount || 1}</p>
                </div>
                <button onClick={() => setIsAssigning(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 mb-6">
                {displayWorkers.map(worker => {
                  const isSelected = selectedWorkers.includes(worker.id);
                  return (
                    <button 
                      key={worker.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedWorkers(prev => prev.filter(id => id !== worker.id));
                        } else {
                          setSelectedWorkers(prev => [...prev, worker.id]);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
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
                              {worker.isOnline ? 'В сети' : 'Оффлайн'}
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
                  onAssignWorker(order.id, selectedWorkers);
                  setIsAssigning(false);
                }}
                disabled={selectedWorkers.length === 0}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 active:scale-95 transition-all"
              >
                Подтвердить выбор ({selectedWorkers.length})
              </button>
            </motion.div>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-2xl mb-8">
          <p className="font-semibold mb-2 text-slate-900">Описание</p>
          <p className="text-slate-600 text-sm leading-relaxed">{order.description}</p>
        </div>

        {/* Status History Section */}
        <div className="mb-8">
          <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
            <History size={20} className="text-blue-600" />
            История изменений
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
                        {entry.workerName ? `Исполнитель ${entry.workerName}` : (entry.changedBy === 'customer' ? 'Заказчик' : entry.changedBy === 'dispatcher' ? 'Диспетчер' : 'Система')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(entry.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Изменил статус на: <span className="font-bold text-blue-600">
                        {entry.status === 'on-way' ? 'В пути' : 
                         entry.status === 'at-work' ? 'На месте' : 
                         entry.status === 'finished' ? 'Закончил' : 
                         statusLabels[entry.status as keyof typeof statusLabels] || entry.status}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="pl-8 text-xs text-slate-400 italic">История изменений пуста</div>
            )}
          </div>
        </div>

        {/* Assigned Workers List */}
        {order.assignedWorkers && order.assignedWorkers.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Назначенные грузчики ({order.assignedWorkers.length})
            </h3>
            <div className="space-y-3">
              {order.assignedWorkers.map((worker) => (
                <div key={worker.id} className="flex flex-col p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={worker.avatar} alt={worker.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{worker.name}</p>
                        <p className="text-xs text-slate-500">ID: {worker.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {worker.status === 'assigned' && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Назначен</span>
                      )}
                      {worker.status === 'on-way' && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                          В пути
                        </span>
                      )}
                      {worker.status === 'at-work' && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
                          На месте
                        </span>
                      )}
                      {worker.status === 'finished' && (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <Check size={10} />
                          Закончил
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Worker Status Update Buttons */}
                  {role === 'worker' && worker.id === currentUserId && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                      {worker.status === 'assigned' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'on-way')}
                          className="bg-blue-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          В путь
                        </button>
                      )}
                      {worker.status === 'on-way' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'at-work')}
                          className="bg-amber-500 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          На месте
                        </button>
                      )}
                      {worker.status === 'at-work' && (
                        <button 
                          onClick={() => onUpdateWorkerStatus(order.id, worker.id, 'finished')}
                          className="bg-emerald-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          Закончил
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
              {order.status === 'in-progress' && workerLocation && (
                <Marker position={[workerLocation.lat, workerLocation.lng]} icon={workerIcon}>
                  <Popup>
                    <div className="text-xs font-bold">Исполнитель в пути</div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          ) : (
            <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MapPin size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">Карта недоступна</p>
              </div>
            </div>
          )}
        </div>

        {order.status === 'in-progress' && workerLocation && (
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
                <p className="text-sm font-bold text-blue-900">Исполнитель в пути к вам</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-blue-400 uppercase">Прибытие через</p>
              <p className="text-lg font-black text-blue-700">~8 мин</p>
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
                  {role === 'worker' ? 'Контакт заказчика' : 'Контакт исполнителя'}
                </span>
              </div>
              {role === 'customer' && (
                <button 
                  onClick={() => setViewingWorkerId(order.workerId || String(selectedWorker) || 'u2')}
                  className="text-xs font-bold text-emerald-600 underline underline-offset-2"
                >
                  Профиль
                </button>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div 
                className={role === 'customer' ? "cursor-pointer" : ""}
                onClick={() => {
                  if (role === 'customer') {
                    setViewingWorkerId(order.workerId || String(selectedWorker) || 'u2');
                  }
                }}
              >
                <div className="text-lg font-bold text-emerald-900">
                  {role === 'worker' ? '+7 (999) 123-45-67' : '+7 (900) 555-01-23'}
                </div>
                {role === 'customer' && (
                  <div className="text-sm font-medium text-emerald-700 mt-1 flex items-center gap-1">
                    {workersMap[order.workerId || String(selectedWorker) || 'u2']?.name || 'Иван Петров'}
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
              {role === 'customer' && (
                <img 
                  src={workersMap[order.workerId || String(selectedWorker) || 'u2']?.avatar || 'https://picsum.photos/seed/worker1/200'} 
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm cursor-pointer"
                  onClick={() => setViewingWorkerId(order.workerId || String(selectedWorker) || 'u2')}
                />
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <a href={`tel:${role === 'worker' ? '+79991234567' : '+79005550123'}`} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <Phone size={16} />
                Позвонить
              </a>
              <button 
                onClick={() => onOpenChat(order.id, order.workerId || order.assignedWorkers?.[0]?.id || 'u2')}
                className="flex-1 bg-white text-emerald-600 border border-emerald-200 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} />
                Чат
              </button>
              <button 
                onClick={onShowSupport}
                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Shield size={16} />
                Поддержка
              </button>
            </div>
            
            <p className="text-[10px] text-emerald-600 mt-2 uppercase font-medium">Свяжитесь для уточнения деталей</p>
          </motion.div>
        )}

        {order.statusHistory && order.statusHistory.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <History size={20} className="text-slate-400" />
              История изменений
            </h3>
            <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {order.statusHistory.map((entry, i) => {
                const statusLabels: Record<string, string> = {
                  'pending_negotiation': 'Ожидание согласования',
                  'open': 'Открыт',
                  'in-progress': 'В работе',
                  'completed': 'Завершен'
                };
                const roleLabels: Record<string, string> = {
                  'customer': 'Заказчик',
                  'worker': 'Исполнитель',
                  'dispatcher': 'Диспетчер',
                  'system': 'Система'
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
                        Изменил: <span className="font-bold text-slate-700">{roleLabels[entry.changedBy] || entry.changedBy}</span>
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
                {order.candidates?.includes(currentUserId) ? 'Вы откликнулись' : 'Откликнуться на заказ'}
              </button>
            )}
            {order.status === 'in-progress' && (
              <button 
                onClick={() => onUpdateStatus(order.id, 'completed')}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
              >
                Завершить заказ
              </button>
            )}
            {order.status === 'completed' && (
              <div className="text-center p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold">
                Заказ успешно выполнен!
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
                  <Trash2 size={20} /> Удалить заказ
                </button>
              </div>
            )}
            {order.assignedWorkers && order.assignedWorkers.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-lg mb-4">Назначенные исполнители</h3>
                <div className="space-y-3">
                  {order.assignedWorkers.map(worker => (
                    <div key={worker.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <img src={worker.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <p className="font-bold text-sm">{worker.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">{worker.status}</p>
                        </div>
                      </div>
                      {order.status === 'in-progress' && (
                        <button 
                          onClick={() => onUnassignWorker?.(order.id, worker.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="Отстранить"
                        >
                          <UserMinus size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {order.status === 'open' && (!order.assignedWorkers || order.assignedWorkers.length === 0) && (
              <>
                <h3 className="font-bold text-lg mb-4">Отклики ({order.candidates?.length || 0})</h3>
                {order.candidates && order.candidates.length > 0 ? (
                  order.candidates.map(workerId => {
                    const profile = MOCK_WORKER_PROFILES[workerId];
                    return (
                      <div key={workerId} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl mb-3">
                        <button 
                          onClick={() => setViewingWorkerId(workerId)}
                          className="flex items-center gap-3 text-left"
                        >
                          <img src={profile?.avatar || `https://picsum.photos/seed/${workerId}/50`} className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                            <p className="font-bold">{profile?.name || 'Исполнитель'}</p>
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                              <Star size={12} fill="currentColor" />
                              <span>{profile?.rating || '4.5'} ({profile?.reviews || '0'} отзывов)</span>
                            </div>
                          </div>
                        </button>
                        <button 
                          onClick={() => {
                            onAssignWorker(order.id, workerId);
                          }}
                          className="text-xs font-bold text-blue-600 uppercase tracking-wider"
                        >
                          Выбрать
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Users size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Пока нет откликов</p>
                  </div>
                )}
              </>
            )}
            {order.assignedWorkers && order.assignedWorkers.length > 0 && order.status === 'open' && (
              <div className="text-center p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold">
                Исполнитель выбран! Ожидайте подтверждения.
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
  onCreate: (order: Partial<Order>) => void;
  initialCategory?: string;
}

const OrderHistory = ({ user, orders, onOrderClick, onWorkerClick, onBack, onShowSupport }: { user: User, orders: Order[], onOrderClick: (order: Order) => void, onWorkerClick: (workerId: string) => void, onBack: () => void, onShowSupport: () => void }) => {
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
      <Header title="История заказов" showBack onBack={onBack} />
      
      <div className="bg-white border-b border-slate-100 p-4 space-y-4">
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'all', label: 'Все' },
            { id: 'open', label: 'Открытые' },
            { id: 'in-progress', label: 'В работе' },
            { id: 'completed', label: 'Завершенные' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === filter.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          {/* Date Filter */}
          <div className="flex-1 flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <Clock size={18} className="text-slate-400" />
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none w-full"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-slate-600">
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
              <option value="date">По дате</option>
              <option value="budget">По бюджету</option>
              <option value="status">По статусу</option>
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

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {historyOrders.length > 0 ? (
          historyOrders.map(order => (
            <div key={order.id} className="relative">
              <OrderCard order={order} onClick={onOrderClick} onWorkerClick={onWorkerClick} />
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-slate-400">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">Заказов не найдено</p>
            {(statusFilter !== 'all' || dateFilter) && (
              <button 
                onClick={() => { setStatusFilter('all'); setDateFilter(''); }}
                className="mt-4 text-blue-600 font-bold text-sm"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-100">
        <button 
          onClick={onShowSupport}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <MessageSquare size={20} />
          Написать в поддержку
        </button>
      </div>
    </motion.div>
  );
};

const CreateOrder = ({ onClose, onCreate, initialCategory = 'Грузчики' }: CreateOrderProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    category: initialCategory,
    address: '',
    time: '',
    date: '',
    workersCount: 1,
    paymentMethod: 'Наличные',
    lat: 55.7558,
    lng: 37.6173
  });
  const [error, setError] = useState<string | null>(null);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, lat, lng }));
    // Simple mock reverse geocoding
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data.display_name) {
        setFormData(prev => ({ ...prev, address: data.display_name }));
      }
    } catch (e) {
      setFormData(prev => ({ ...prev, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
    }
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        handleLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const handleSubmit = () => {
    let hasError = false;
    if (!formData.title.trim()) {
      setError('Пожалуйста, введите название заказа');
      hasError = true;
    } else if (formData.title.length < 5) {
      setError('Название слишком короткое (минимум 5 символов)');
      hasError = true;
    }
    
    if (!formData.address.trim()) {
      setError('Пожалуйста, укажите адрес выполнения');
      hasError = true;
    }

    if (formData.budget && Number(formData.budget) <= 0) {
      setError('Бюджет должен быть положительным числом');
      hasError = true;
    }

    if (formData.workersCount < 1) {
      setError('Минимум 1 грузчик');
      hasError = true;
    }
    
    if (hasError) return;
    
    setError(null);
    onCreate({
      title: formData.title,
      description: formData.description,
      budget: Number(formData.budget),
      category: formData.category,
      address: formData.address,
      time: formData.time,
      date: formData.date,
      workersCount: formData.workersCount,
      paymentMethod: formData.paymentMethod,
      status: 'pending_negotiation',
      lat: formData.lat,
      lng: formData.lng
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 bg-white z-40 flex flex-col"
    >
      <Header title="Новый заказ" showBack onBack={onClose} />
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        
        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Что нужно сделать? *</label>
          <input 
            type="text" 
            value={formData.title}
            onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setError(null); }}
            placeholder="Например: Перевезти диван" 
            className={`w-full p-4 bg-slate-50 border ${error && !formData.title ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
          />
          {error && !formData.title && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
              Пожалуйста, введите название заказа
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Категория</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option>Грузчики</option>
              <option>Переезд</option>
              <option>Сборка</option>
              <option>Разное</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Грузчики</label>
            <input 
              type="number" 
              value={formData.workersCount}
              onChange={(e) => setFormData({ ...formData, workersCount: Number(e.target.value) })}
              min="1"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Адрес *</label>
          <div className="relative mb-4">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={formData.address}
              onChange={(e) => { setFormData({ ...formData, address: e.target.value }); setError(null); }}
              placeholder="Улица, дом, квартира" 
              className={`w-full p-4 pl-12 bg-slate-50 border ${error && !formData.address ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl focus:ring-2 focus:ring-blue-500 focus:scale-[1.02] outline-none transition-all`}
            />
            {error && !formData.address && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 bg-red-50 text-red-600 p-3 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                Пожалуйста, укажите адрес выполнения
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
              Кликните на карту для выбора адреса
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Дата</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                placeholder="24.03.2026" 
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Время</label>
            <div className="relative">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder="18:00" 
                className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Описание</label>
          <textarea 
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Опишите детали, этаж, наличие лифта..." 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Оплата (₽)</label>
          <input 
            type="number" 
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            placeholder="2000" 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Способ оплаты</label>
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
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 pb-20">
          <button 
            onClick={handleSubmit}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            Опубликовать заказ
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingScreen = () => (
  <div className="absolute inset-0 bg-white z-[200] flex flex-col items-center justify-center p-8">
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

// Error Boundary Placeholder
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<User | null>(null);
  
  const [role, setRole] = useState<UserRole>('customer');
  const user = currentUserProfile || (role === 'customer' ? MOCK_USER_CUSTOMER : (role === 'worker' ? MOCK_USER_WORKER : MOCK_USER_DISPATCHER));
  const currentUserId = currentUserProfile?.id || firebaseUser?.uid || user.id;
  const [activeTab, setActiveTab] = useState('home');
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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
    setIsLoading(true);
    const unsub = orderService.getOrders((fetchedOrders) => {
      setOrders(fetchedOrders as Order[]);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  // Fetch real workers
  useEffect(() => {
    const unsub = orderService.getWorkers((fetchedWorkers) => {
      setWorkers(fetchedWorkers);
    });
    return unsub;
  }, []);

  // Fetch real chats
  useEffect(() => {
    if (!firebaseUser) {
      setChats([]);
      return;
    }
    const unsub = chatService.getChats(currentUserId, (fetchedChats) => {
      setChats(fetchedChats);
    });
    return unsub;
  }, [firebaseUser, currentUserId]);

  // Fetch real notifications
  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUserId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(newNotifications);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
    return unsub;
  }, [currentUserId]);

  // Keep selectedOrder in sync with orders array
  useEffect(() => {
    if (selectedOrder) {
      const updatedOrder = orders.find(o => o.id === selectedOrder.id);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      }
    }
  }, [orders]);

  // Fetch user profile when firebaseUser changes
  useEffect(() => {
    if (!firebaseUser) {
      setCurrentUserProfile(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        const profile = { id: snapshot.id, ...snapshot.data() } as User;
        setCurrentUserProfile(profile);
        setRole(profile.role);
      }
    });
    return unsub;
  }, [firebaseUser]);


  // Push Notifications Integration
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'https://ais-dev-ujdnun7ulual234fmcddyi-216250874567.europe-west1.run.app/favicon.ico'
      });
    }

    // Save to Firestore for current user
    if (currentUserId) {
      notifyUser(currentUserId, title, body, type);
    }
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

      // 2. Status Change Notifications (for involved parties)
      if (prevOrdersRef.current.length > 0) {
        orders.forEach(order => {
          const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);
          if (prevOrder && prevOrder.status !== order.status) {
            const statusLabels: Record<string, string> = {
              'open': 'Открыт',
              'in-progress': 'В работе',
              'completed': 'Завершен'
            };

            const title = `Заказ #${order.id.slice(-4)}: ${statusLabels[order.status] || order.status}`;
            const body = `Статус заказа "${order.title}" изменился на "${statusLabels[order.status] || order.status}"`;

            // Notify Customer
            if (order.customerId) {
              notifyUser(order.customerId, title, body, 'order');
            }
            // Notify Assigned Workers
            if (order.workerId) {
              notifyUser(order.workerId, title, body, 'order');
            }
            if (order.assignedWorkers) {
              order.assignedWorkers.forEach(w => notifyUser(w.id, title, body, 'order'));
            }
          }
        });
      }
      prevOrdersRef.current = orders;
    }
  }, [orders, role, currentUserId, sendPushNotification, notifyUser]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setFirebaseUser(user);
        setIsLoggedIn(true);
      } else {
        setFirebaseUser(null);
        setIsLoggedIn(false);
      }
    });
    return unsub;
  }, []);

  const handleCreateChat = async (orderId: string, workerId: string) => {
    const chatId = await chatService.getOrCreateChat(orderId, currentUserId, workerId);
    const profile = MOCK_WORKER_PROFILES[workerId];
    setSelectedChat({
      id: chatId,
      orderId,
      customerId: currentUserId,
      workerId,
      otherUserName: profile?.name || 'Грузчик',
      otherUserAvatar: profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${workerId}`
    });
    setActiveTab('chat');
  };

  const handleShowSupport = async () => {
    const uid = currentUserId;
    if (!uid) {
      console.error("User ID not found");
      return;
    }
    
    try {
      const chatId = await chatService.getOrCreateChat('support_order', uid, 'support');
      setSelectedChat({
        id: chatId,
        orderId: 'support_order',
        customerId: uid,
        workerId: 'support',
        otherUserName: 'Диспетчер (Поддержка)',
        otherUserAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4'
      });
      setActiveTab('chat');
    } catch (error) {
      console.error("Error opening support chat:", error);
      // Fallback for UI if Firebase fails (e.g. offline or rules)
      setSelectedChat({
        id: 'temp_support_chat',
        orderId: 'support_order',
        customerId: uid,
        workerId: 'support',
        otherUserName: 'Диспетчер (Поддержка)',
        otherUserAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=support&backgroundColor=b6e3f4'
      });
      setActiveTab('chat');
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
          await auth.signOut();
          setIsLoggedIn(false);
          setFirebaseUser(null);
          setCurrentUserProfile(null);
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
    const newOrderData = {
      title: orderData.title || '',
      description: orderData.description || '',
      budget: orderData.budget || 0,
      address: orderData.address || '',
      category: orderData.category || 'Разное',
      customerId: currentUserId,
      status: 'pending_negotiation' as Order['status'],
      time: orderData.time || '',
      date: orderData.date || '',
      workersCount: orderData.workersCount || 1,
      paymentMethod: orderData.paymentMethod || 'Наличные',
      lat: orderData.lat || 55.7558,
      lng: orderData.lng || 37.6173,
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'orders'), newOrderData);
      const newOrder: Order = {
        id: docRef.id,
        ...newOrderData,
        createdAt: undefined // Will be handled by snapshot
      } as Order;
      
      setOrders([newOrder, ...orders]);
      setIsCreating(null);
      
      // Notify about new order
      if (newOrder.status === 'pending_negotiation') {
        sendPushNotification('Диспетчер: Новый заказ', `Заказ "${newOrder.title}" требует согласования бюджета.`);
      } else {
        // Notify matching workers
        workers.forEach(worker => {
          if (worker.role === 'worker') {
            const matchesSkill = !worker.skills || worker.skills.length === 0 || 
                               worker.skills.some((s: string) => newOrder.category.toLowerCase().includes(s.toLowerCase()) || 
                               newOrder.title.toLowerCase().includes(s.toLowerCase()));
            
            let matchesLocation = true;
            if (newOrder.lat && newOrder.lng && worker.lat && worker.lng) {
              const dist = calculateDistance(newOrder.lat, newOrder.lng, worker.lat, worker.lng);
              matchesLocation = dist <= 20; // Notify workers within 20km
            }

            if (matchesSkill && matchesLocation) {
              notifyUser(worker.uid || worker.id, 'Новый подходящий заказ!', `В категории "${newOrder.category}" появился заказ: "${newOrder.title}"`, 'order');
            }
          }
        });

        if (newOrder.budget >= 5000) {
          sendPushNotification('🔥 Высокооплачиваемый заказ!', `В вашем районе доступен заказ "${newOrder.title}" с бюджетом ${newOrder.budget} ₽!`);
        } else {
          sendPushNotification('Новый заказ', `В вашем районе опубликован новый заказ: "${newOrder.title}"`);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
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
      
      sendPushNotification('Обновление заказа', `Статус заказа "${order.title}" изменен на "${statusLabels[status] || status}"`);
      
      if (status === 'in-progress') {
        setTimeout(() => {
          sendPushNotification('Исполнитель уже близко!', `Ваш исполнитель по заказу "${order.title}" будет на месте через 5 минут.`);
        }, 5000);
      }

      if (status === 'completed') {
        sendPushNotification('Диспетчер: Заказ завершен', `Заказ "${order.title}" был успешно завершен исполнителем.`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleNegotiate = (orderId: string, negotiatedBudget: number, commission: number) => {
    const order = orders.find(o => o.id === orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { 
      ...o, 
      negotiatedBudget, 
      commission, 
      budget: negotiatedBudget - commission,
      status: 'open' 
    } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { 
        ...prev, 
        negotiatedBudget, 
        commission, 
        budget: negotiatedBudget - commission,
        status: 'open' 
      } : null);
    }

    if (order) {
      sendPushNotification('Бюджет согласован', `Диспетчер установил бюджет ${negotiatedBudget} ₽ для заказа "${order.title}"`);
      
      // Dynamic: High-paying order notification after negotiation
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
      // Fetch real profiles for the workers
      const newWorkers: AssignedWorker[] = await Promise.all(ids.map(async id => {
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
        const mockProfile = MOCK_WORKER_PROFILES[id];
        return {
          id,
          name: mockProfile?.name || 'Исполнитель',
          avatar: mockProfile?.avatar || '',
          status: 'assigned'
        };
      }));

      const existingIds = new Set(order.assignedWorkers?.map(w => w.id) || []);
      const workersToAdd = newWorkers.filter(w => !existingIds.has(w.id));
      const updatedWorkers = [...(order.assignedWorkers || []), ...workersToAdd];
      
      await orderService.assignWorkers(orderId, updatedWorkers);

      ids.forEach(id => {
        const profile = MOCK_WORKER_PROFILES[id];
        sendPushNotification('Исполнитель назначен', `На заказ "${order.title}" назначен исполнитель ${profile?.name || 'нового типа'}`);
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

      const updatedWorkers = (order.assignedWorkers || []).map(w => 
        w.id === oldWorkerId ? newWorker : w
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
    let existingChat = chats.find(c => 
      (c.customerId === participantId || c.workerId === participantId || c.dispatcherId === participantId) &&
      (orderId ? c.orderId === orderId : true)
    );

    if (existingChat) {
      setSelectedChat(existingChat);
    } else {
      const chatId = await chatService.getOrCreateChat(
        orderId || 'manual',
        participantRole === 'customer' ? participantId : (user?.role === 'customer' ? user.id : undefined),
        participantRole === 'worker' ? participantId : (user?.role === 'worker' ? user.id : undefined),
        user?.role === 'dispatcher' ? user.id : (participantRole === 'dispatcher' ? participantId : undefined)
      );
      
      // The onSnapshot in App.tsx will pick up the new chat
      // but for immediate UI response we can find it in the updated chats list
      // or just wait for the snapshot.
    }
  };

  const handleUpdateWorkerStatus = async (orderId: string, workerId: string, status: AssignedWorker['status']) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const workerProfile = MOCK_WORKER_PROFILES[workerId];
    const historyEntry: StatusHistoryEntry = {
      status: status,
      timestamp: new Date().toISOString(),
      changedBy: 'worker',
      workerId: workerId,
      workerName: workerProfile?.name || 'Исполнитель'
    };

    try {
      const updatedWorkers = (order.assignedWorkers || []).map(w => 
        w.id === workerId ? { ...w, status } : w
      );
      
      let newOrderStatus = order.status;
      if (status === 'at-work' && order.status === 'open') {
        newOrderStatus = 'in-progress';
      }

      await updateDoc(doc(db, 'orders', orderId), {
        status: newOrderStatus,
        assignedWorkers: updatedWorkers,
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
      if (currentUserId) {
        await updateDoc(doc(db, 'users', currentUserId), {
          name: updatedUser.name,
          phone: updatedUser.phone || '',
          avatar: updatedUser.avatar,
          skills: updatedUser.skills || [],
          experience: updatedUser.experience || '',
          bio: updatedUser.bio || '',
          portfolio: updatedUser.portfolio || []
        });
        setCurrentUserProfile({ ...updatedUser, id: currentUserId });
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
    }
  };

  const handleReview = async (orderId: string, rating: number, text: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        customerReviewed: role === 'customer' ? true : undefined,
        workerReviewed: role === 'worker' ? true : undefined,
        review: { rating, text, createdAt: new Date().toISOString() }
      });
      sendPushNotification('Отзыв отправлен', 'Спасибо за вашу оценку!');
    } catch (error) {
      console.error("Error adding review:", error);
    }
  };

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <div className="mobile-container">
          <AnimatePresence>
            {isRegistering ? (
              <Register 
                onBack={() => setIsRegistering(false)} 
                onRegister={async (newRole, name, phone, password) => {
                  try {
                    await authService.register(phone, name, newRole, password);
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
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
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
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mobile-container overflow-hidden">
      <AnimatePresence>
        {isLoading && <LoadingScreen />}
      </AnimatePresence>

      <Header 
        title={activeTab === 'home' ? (role === 'customer' ? 'ГрузОК' : 'Заказы') : activeTab === 'chat' ? 'Чаты' : 'Профиль'} 
        role={role}
        setRole={setRole}
      />
      
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            {role === 'customer' ? (
              <CustomerHome 
                user={user} 
                orders={orders} 
                workers={workers}
                onOrderClick={setSelectedOrder} 
                onWorkerClick={setViewingWorkerId}
                onCreateClick={(category) => setIsCreating(category || 'Грузчики')} 
                onShowSupport={handleShowSupport}
                isLoading={isLoading}
              />
            ) : role === 'worker' ? (
              <WorkerHome 
                orders={orders} 
                workers={workers}
                onOrderClick={setSelectedOrder} 
                onQuickApply={handleQuickApply}
                onWorkerClick={setViewingWorkerId}
                onShowSupport={handleShowSupport}
                isLoading={isLoading}
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
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <ChatList userId={currentUserId} chats={chats} onChatClick={setSelectedChat} />
          </motion.div>
        )}
        {activeTab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col overflow-hidden">
            <Profile 
              user={user} 
              orders={orders}
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

      {/* Navigation */}
      <nav className="bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center safe-area-bottom">
        {[
          { id: 'home', icon: <Briefcase size={24} />, label: 'Главная' },
          { id: 'chat', icon: <MessageSquare size={24} />, label: 'Чаты' },
          { id: 'profile', icon: <UserIcon size={24} />, label: 'Профиль' },
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
            onShowSupport={handleShowSupport}
            viewingWorkerId={viewingWorkerId}
            setViewingWorkerId={setViewingWorkerId}
          />
        )}
        {isCreating && (
          <CreateOrder 
            initialCategory={isCreating}
            onClose={handleBack} 
            onCreate={handleCreateOrder} 
          />
        )}
        {showOrderHistory && (
          <OrderHistory 
            user={user}
            orders={orders}
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
            onShowSupport={handleShowSupport}
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
            onBack={handleBack} 
          />
        )}
        {showRules && (
          <RulesPage onAccept={() => {
            setShowRules(false);
            setActiveTab('home');
          }} />
        )}
        <AnimatePresence>
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
      </AnimatePresence>
    </div>
  </ErrorBoundary>
);
}
