export type UserRole = 'customer' | 'worker';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  rating: number;
  avatar: string;
  isVerified: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  address: string;
  status: 'open' | 'in_progress' | 'completed';
  createdAt: number;
  workerId?: string;
}

export interface Bid {
  id: string;
  orderId: string;
  workerId: string;
  workerName: string;
  workerRating: number;
  price: number;
  message: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;
}
