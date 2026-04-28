import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection, doc, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, serverTimestamp, Timestamp,
  getDoc, setDoc, getDocs, deleteDoc, limit
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export {
  Timestamp, collection, addDoc, serverTimestamp, doc, updateDoc,
  setDoc, deleteDoc, query, where, orderBy, onSnapshot, limit, getDoc, getDocs
};

import firebaseConfig from '../firebase-applet-config.json';

export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  return digits;
};

export const phoneToEmail = (phone: string) => {
  const normalized = normalizePhone(phone);
  return `${normalized}@gruzok.ru`;
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const uploadAvatar = async (uid: string, file: File): Promise<string> => {
  const storageRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const checkUserExists = async (phone: string) => {
  const path = 'users';
  try {
    const normalizedPhone = normalizePhone(phone);
    const q = query(collection(db, path), where('phone', '==', normalizedPhone));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return false;
  }
};

export const orderService = {
  getOrders: (callback: (orders: any[]) => void, onError?: (error: unknown) => void) => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(orders);
    }, (error) => {
      console.error('Error listening to orders:', error);
      onError?.(error);
    });
  },

  updateOrderStatus: async (orderId: string, status: string, historyEntry: any) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, { status, statusHistory: historyEntry });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  applyToOrder: async (orderId: string, workerId: string) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const candidates = orderSnap.data().candidates || [];
        if (!candidates.includes(workerId)) {
          await updateDoc(orderRef, { candidates: [...candidates, workerId] });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  assignWorkers: async (orderId: string, workers: any[]) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      const orderSnap = await getDoc(orderRef);
      const prevHistory = orderSnap.exists() ? (orderSnap.data().statusHistory || []) : [];
      const orderData = orderSnap.exists() ? orderSnap.data() : {};
      const maxWorkers = Math.max(1, orderData.workersCount || 1);
      const uniqueWorkers = workers.filter((worker, index, list) =>
        worker?.id && list.findIndex(item => item?.id === worker.id) === index
      ).slice(0, maxWorkers);
      const assignedIds = new Set(uniqueWorkers.map(worker => worker.id));
      const nextCandidates = (orderData.candidates || []).filter((id: string) => !assignedIds.has(id));

      const historyEntry = {
        status: uniqueWorkers.length > 0 ? 'in-progress' : 'open',
        timestamp: new Date().toISOString(),
        changedBy: 'dispatcher',
      };

      await updateDoc(orderRef, {
        assignedWorkers: uniqueWorkers,
        workerId: uniqueWorkers[0]?.id || null,
        status: uniqueWorkers.length > 0 ? 'in-progress' : 'open',
        candidates: nextCandidates,
        statusHistory: [...prevHistory, historyEntry],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  unassignWorker: async (orderId: string, workerId: string) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const assignedWorkers = orderSnap.data().assignedWorkers || [];
        const nextWorkers = assignedWorkers.filter((w: any) => w.id !== workerId);
        const prevHistory = orderSnap.data().statusHistory || [];

        await updateDoc(orderRef, {
          assignedWorkers: nextWorkers,
          workerId: nextWorkers[0]?.id || null,
          status: nextWorkers.length > 0 ? 'in-progress' : 'open',
          statusHistory: [
            ...prevHistory,
            {
              status: nextWorkers.length > 0 ? 'in-progress' : 'open',
              timestamp: new Date().toISOString(),
              changedBy: 'dispatcher',
            }
          ]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  negotiateBudget: async (orderId: string, budget: number) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, { negotiatedBudget: budget, status: 'open' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  addReview: async (orderId: string, review: any) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, { review });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  deleteOrder: async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  },

  placeBid: async (orderId: string, workerId: string, amount: number) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const bids = orderSnap.data().bids || [];
        await updateDoc(orderRef, {
          bids: [...bids, { workerId, amount, timestamp: new Date().toISOString() }]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  getWorkers: (callback: (workers: any[]) => void) => {
    const q = query(collection(db, 'users'), where('role', '==', 'worker'));
    return onSnapshot(q, (snapshot) => {
      const workers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(workers);
    });
  }
};

export const createUserProfile = async (uid: string, data: any) => {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export interface Chat {
  id: string;
  orderId: string;
  chatType?: 'direct' | 'order' | 'support';
  participantRole?: 'customer' | 'worker' | 'dispatcher' | 'support';
  participants?: string[];
  customerId?: string;
  workerId?: string;
  dispatcherId?: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCount?: { [userId: string]: number };
  otherUserName?: string;
  otherUserAvatar?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  readAt?: Timestamp;
  isRead?: boolean;
}

export const chatService = {
  getChats: (userId: string, callback: (chats: Chat[]) => void) => {
    // const q1 = query(collection(db, 'chats'), where('customerId', '==', userId), orderBy('lastMessageAt', 'desc'));
    // const q2 = query(collection(db, 'chats'), where('workerId', '==', userId), orderBy('lastMessageAt', 'desc'));
    // const q3 = query(collection(db, 'chats'), where('dispatcherId', '==', userId), orderBy('lastMessageAt', 'desc'));
    const q1 = query(collection(db, 'chats'), where('customerId', '==', userId));
    const q2 = query(collection(db, 'chats'), where('workerId', '==', userId));
    const q3 = query(collection(db, 'chats'), where('dispatcherId', '==', userId));

    const chats: { [id: string]: Chat } = {};

    const handleSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((doc: any) => {
        chats[doc.id] = { id: doc.id, ...doc.data() } as Chat;
      });
      callback(Object.values(chats).sort((a, b) =>
        (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0)
      ));
    };

    const unsub1 = onSnapshot(q1, handleSnapshot);
    const unsub2 = onSnapshot(q2, handleSnapshot);
    const unsub3 = onSnapshot(q3, handleSnapshot);

    return () => { unsub1(); unsub2(); unsub3(); };
  },

  getMessages: (chatId: string, callback: (messages: Message[]) => void) => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      callback(messages);
    });
  },

  sendMessage: async (chatId: string, senderId: string, text: string, recipientId: string) => {
    try {
      const trimmedText = text.trim();
      if (!trimmedText) return;

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId,
        text: trimmedText,
        createdAt: serverTimestamp(),
        isRead: false,
      });

      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const unreadCount = chatSnap.exists() ? (chatSnap.data().unreadCount || {}) : {};
      unreadCount[recipientId] = (unreadCount[recipientId] || 0) + 1;

      await updateDoc(chatRef, {
        lastMessage: trimmedText,
        lastMessageAt: serverTimestamp(),
        unreadCount,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  markAsRead: async (chatId: string, userId: string, messages: Message[]) => {
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return;

    const unreadCount = chatSnap.data().unreadCount || {};
    if (unreadCount[userId] > 0) {
      unreadCount[userId] = 0;
      await updateDoc(chatRef, { unreadCount });
    }

    for (const msg of messages) {
      if (msg.senderId !== userId && !msg.readAt) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
          readAt: serverTimestamp()
        });
      }
    }
  },

  getOrCreateChat: async (
    orderId: string,
    currentUserId: string,
    otherUserId: string,
    options?: {
      customerId?: string;
      workerId?: string;
      dispatcherId?: string;
    }
  ) => {
    try {
      const hasExplicitRoles = !!options;
      const customerId = hasExplicitRoles ? options?.customerId : currentUserId;
      const workerId = hasExplicitRoles ? options?.workerId : (otherUserId === 'support' ? 'support' : otherUserId);
      const dispatcherId = hasExplicitRoles ? options?.dispatcherId : undefined;

      const participantIds = [currentUserId, otherUserId, customerId, workerId, dispatcherId]
        .filter((id): id is string => !!id);
      const participants = Array.from(new Set(participantIds)).sort();

      const isSupportChat = otherUserId === 'support' || workerId === 'support' || dispatcherId === 'support';
      const isRealOrderId = !!orderId && !['manual', 'direct', 'support_order'].includes(orderId);
      const isDispatcherOrderChat = !!dispatcherId && isRealOrderId && !isSupportChat;
      const participantRole =
        isSupportChat ? 'support' :
        customerId === otherUserId ? 'customer' :
        workerId === otherUserId ? 'worker' :
        dispatcherId === otherUserId ? 'dispatcher' :
        undefined;
      const chatType = isSupportChat ? 'support' : isDispatcherOrderChat ? 'order' : 'direct';
      const chatKey = isDispatcherOrderChat
        ? `order_${orderId}_${dispatcherId}_${participantRole || 'user'}_${otherUserId}`
        : `${chatType}_${participants.join('_')}`;
      const chatRef = doc(db, 'chats', chatKey);

      try {
        const chatSnap = await getDoc(chatRef);
        if (chatSnap.exists()) return chatSnap.id;
      } catch (error: any) {
        const isPermissionDenied = error?.code === 'permission-denied' || String(error?.message || error).includes('permission-denied');
        if (!isPermissionDenied) throw error;
        // Firestore may deny reading a deterministic chat id before it exists.
        // Creation below is still allowed because request.resource.data contains the participants.
        console.warn('Chat pre-read was denied, continuing with create:', chatKey);
      }

      const chatData: any = {
        orderId: isDispatcherOrderChat ? orderId : 'direct',
        chatType,
        participants,
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        unreadCount: {},
      };

      if (participantRole) chatData.participantRole = participantRole;
      if (customerId) chatData.customerId = customerId;
      if (workerId) chatData.workerId = workerId;
      if (dispatcherId) chatData.dispatcherId = dispatcherId;

      await setDoc(chatRef, chatData);
      return chatRef.id;
    } catch (error) {
      console.error('Error creating/getting chat:', error);
      throw error;
    }
  },
};

export const authService = {
  register: async (phone: string, password: string, name: string, role: string) => {
    try {
      const normalizedPhone = normalizePhone(phone);
      const email = phoneToEmail(normalizedPhone);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, { displayName: name });

      await createUserProfile(uid, {
        uid,
        name,
        phone: normalizedPhone,
        role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        rating: 0,
      });

      return userCredential.user;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Пользователь с таким номером уже зарегистрирован');
      }
      if (error.code === 'auth/weak-password') {
        throw new Error('Пароль слишком простой. Минимум 6 символов.');
      }
      console.error('Registration error:', error);
      throw error;
    }
  },

  login: async (phone: string, password: string) => {
    try {
      const normalizedPhone = normalizePhone(phone);
      const email = phoneToEmail(normalizedPhone);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      if (
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-login-credentials'
      ) {
        throw new Error('Неверный номер телефона или пароль');
      }
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    await signOut(auth);
  }
};
