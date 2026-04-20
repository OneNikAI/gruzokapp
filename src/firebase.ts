import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, query, where, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp, Timestamp, getDoc, setDoc, getDocs, getDocFromServer, deleteDoc, limit } from 'firebase/firestore';
export { Timestamp, collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, query, where, orderBy, onSnapshot, limit, getDoc, getDocs };
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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

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
  }
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
  getOrders: (callback: (orders: any[]) => void) => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(orders);
    });
  },

  updateOrderStatus: async (orderId: string, status: string, historyEntry: any) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, {
        status,
        statusHistory: historyEntry // In real app, use arrayUnion
      });
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
          await updateDoc(orderRef, {
            candidates: [...candidates, workerId]
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  assignWorkers: async (orderId: string, workers: any[]) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, {
        assignedWorkers: workers,
        status: 'open' // Or whatever status it should move to
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
        await updateDoc(orderRef, {
          assignedWorkers: assignedWorkers.filter((w: any) => w.id !== workerId)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  negotiateBudget: async (orderId: string, budget: number) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, {
        negotiatedBudget: budget,
        status: 'open'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  },

  addReview: async (orderId: string, review: any) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
      await updateDoc(orderRef, {
        review
      });
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
    await setDoc(doc(db, 'users', uid), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export interface Chat {
  id: string;
  orderId: string;
  customerId?: string;
  workerId?: string;
  dispatcherId?: string;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  unreadCount?: { [userId: string]: number };
  // UI helper fields
  otherUserName?: string;
  otherUserAvatar?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
  readAt?: Timestamp;
}

export const chatService = {
  getChats: (userId: string, callback: (chats: Chat[]) => void) => {
    const q1 = query(
      collection(db, 'chats'),
      where('customerId', '==', userId),
      orderBy('lastMessageAt', 'desc')
    );
    const q2 = query(
      collection(db, 'chats'),
      where('workerId', '==', userId),
      orderBy('lastMessageAt', 'desc')
    );
    const q3 = query(
      collection(db, 'chats'),
      where('dispatcherId', '==', userId),
      orderBy('lastMessageAt', 'desc')
    );

    const chats: { [id: string]: Chat } = {};
    
    const handleSnapshot = (snapshot: any) => {
      snapshot.docs.forEach((doc: any) => {
        chats[doc.id] = { id: doc.id, ...doc.data() } as Chat;
      });
      callback(Object.values(chats).sort((a, b) => (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0)));
    };

    const unsub1 = onSnapshot(q1, handleSnapshot);
    const unsub2 = onSnapshot(q2, handleSnapshot);
    const unsub3 = onSnapshot(q3, handleSnapshot);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  },

  getMessages: (chatId: string, callback: (messages: Message[]) => void) => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      callback(messages);
    });
  },

  sendMessage: async (chatId: string, senderId: string, text: string, recipientId: string) => {
    const messageData = {
      senderId,
      text,
      createdAt: serverTimestamp(),
    };
    
    await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
    
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    const unreadCount = chatSnap.exists() ? (chatSnap.data().unreadCount || {}) : {};
    unreadCount[recipientId] = (unreadCount[recipientId] || 0) + 1;

    await updateDoc(chatRef, {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      unreadCount
    });
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

    // Mark individual messages as read if they are not from the current user
    for (const msg of messages) {
      if (msg.senderId !== userId && !msg.readAt) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
          readAt: serverTimestamp()
        });
      }
    }
  },

  getOrCreateChat: async (orderId: string, customerId?: string, workerId?: string, dispatcherId?: string) => {
    const chatId = `${orderId}_${customerId || 'none'}_${workerId || 'none'}_${dispatcherId || 'none'}`;
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      let otherUserName = 'Чат';
      let otherUserAvatar = '';

      // Try to find the "other" person to get their name/avatar
      const otherId = customerId || workerId || dispatcherId;
      if (otherId) {
        const userSnap = await getDoc(doc(db, 'users', otherId));
        if (userSnap.exists()) {
          otherUserName = userSnap.data().name;
          otherUserAvatar = userSnap.data().avatar;
        }
      }

      await setDoc(chatRef, {
        orderId,
        customerId: customerId || null,
        workerId: workerId || null,
        dispatcherId: dispatcherId || null,
        otherUserName,
        otherUserAvatar,
        lastMessageAt: serverTimestamp(),
        unreadCount: {}
      });
    }
    return chatId;
  }
};

export const authService = {
  register: async (phone: string, password: string, name: string, role: string) => {
    try {
      const normalizedPhone = normalizePhone(phone);
      const email = phoneToEmail(normalizedPhone);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await updateProfile(userCredential.user, { displayName: name });

      const userData = {
        uid,
        name,
        phone: normalizedPhone,
        role,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        rating: 5.0,
        createdAt: serverTimestamp(),
      };

      await createUserProfile(uid, userData);
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
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        throw new Error('Неверный номер телефона или пароль');
      }
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    await signOut(auth);
  },

  sendVerificationCode: async (_phone?: string) => {
    throw new Error('SMS verification is disabled in this build');
  },

  verifyCode: async (_phone?: string, _inputCode?: string) => false
};
