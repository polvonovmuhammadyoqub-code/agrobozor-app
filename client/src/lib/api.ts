import {
  User,
  Product,
  Order,
  Dispute,
  Review,
  PriceRecommendation,
  AdminStats,
  InvoiceData,
  Transaction,
  WithdrawalRequest,
  ProductAnalytics, Conversation, ChatMessage, MessagePage,
} from '../types';

const envApiUrl = (import.meta as any).env?.VITE_API_URL || '';
const API_BASE = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}/api` : '/api';

export function getToken(): string | null {
  return localStorage.getItem('agro_token');
}

export function setToken(token: string) {
  localStorage.setItem('agro_token', token);
}

export function removeToken() {
  localStorage.removeItem('agro_token');
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    const isNetwork = err?.message === 'Failed to fetch' || err?.name === 'TypeError';
    throw new Error(
      isNetwork
        ? "Server bilan aloqa uzildi yoki backend server faol emas (Failed to fetch). Tarmoqni yoki server holatini tekshiring."
        : (err?.message || 'Serverga ulanishda xatolik yuz berdi')
    );
  }

  const data = await response.json().catch(() => {
    throw new ApiError('Serverdan yaroqsiz javob olindi', response.status);
  });

  if (!response.ok) {
    throw new ApiError(data.error || 'Serverda xatolik yuz berdi', response.status);
  }

  return data as T;
}

export const api = {
  payments: { options: () => request<{ mode: string; methods: string[]; message: string }>('/payments/options') },

  // Auth
  auth: {
    login: (phone: string, password?: string, _otp?: string) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      }),
    sendVerificationCode: (email: string) =>
      request<{ success: boolean; message: string; dev_code?: string }>('/auth/send-verification-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    verifyCode: (email: string, code: string) =>
      request<{ success: boolean; verified: boolean }>('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }),
    register: (body: any) =>
      request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    me: () => request<User>('/auth/me'),
  },

  // Products
  products: {
    getAll: (params?: Record<string, any>) => {
      const query = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            query.append(k, String(v));
          }
        });
      }
      return request<Product[]>(`/products?${query.toString()}`);
    },
    getById: (id: string) => request<Product>(`/products/${id}`),
    trackView: (id: string) => request<{ success: boolean }>(`/products/${id}/view`, { method: 'POST' }),
    analytics: (id: string) => request<ProductAnalytics>(`/products/${id}/analytics`),
    getMine: () => request<Product[]>('/products/mine/list'),
    getLast: () => request<Product | null>('/products/farmer/last'),
    create: (body: Partial<Product>) =>
      request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<Product> & { expected_quantity_kg?: number }) =>
      request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/products/${id}`, {
        method: 'DELETE',
      }),
    getPriceRecommendation: (category: string, region?: string, title?: string, unit?: string) => {
      const query = new URLSearchParams({ category });
      if (region) query.append('region', region);
      if (title) query.append('title', title);
      if (unit) query.append('unit',unit);
      return request<PriceRecommendation>(`/price-recommendation?${query.toString()}`);
    },
  },

  // Orders
  orders: {
    getAll: () => request<Order[]>('/orders'),
    getById: (id: string) => request<Order>(`/orders/${id}`),
    create: (body: {
      product_id: string;
      quantity_kg: number;
      payment_method: string;
      delivery_address: string;
      delivery_schedule?: string;
      delivery_district?: string;
    }) =>
      request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    checkout: (body: {
      items: Array<{ product_id: string; quantity_kg: number }>;
      delivery_address: string;
      delivery_schedule?: string;
      delivery_district?: string;
      payment_method: string;
    }) =>
      request<{
        orders: Order[];
        total_orders_count: number;
        grand_total: number;
      }>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    pay: (id: string, payment_method?: string) =>
      request<{ order: Order; pending_invoice?: boolean; pending_direct?: boolean; pending_payment?: boolean; checkout_url?: string; is_demo?: boolean; message?: string; reference?: string }>(`/orders/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method }),
      }),
    confirmDirectPayment: (id: string, amount: number) => request<{message:string}>(`/orders/${id}/confirm-direct-payment`, {method:'POST',body:JSON.stringify({received:true,received_amount:amount})}),
    cancel: (id: string) => request<{ message: string }>(`/orders/${id}/cancel`, { method: 'POST' }),
    reject: (id: string) => request<{ message: string }>(`/orders/${id}/reject`, { method: 'POST' }),
    updateStatus: (id: string, status: string, pin?: string) =>
      request<Order>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, pin }),
      }),
    complete: (id: string) =>
      request<{ message: string; order: Order }>(`/orders/${id}/complete`, {
        method: 'POST',
      }),
    getInvoice: (id: string) => request<InvoiceData>(`/orders/${id}/invoice`),
  },

  messages: {
    unread: () => request<{ count: number }>('/messages/unread-count'),
    list: () => request<Conversation[]>('/messages/conversations'),
    open: (product_id: string) => request<Conversation>('/messages/conversations', { method: 'POST', body: JSON.stringify({ product_id }) }),
    history: (id: string, before?: string) => request<MessagePage>(`/messages/conversations/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`),
    send: (id: string, body: string, client_id: string) => request<ChatMessage>(`/messages/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body, client_id }) }),
  },

  // Disputes
  disputes: {
    getAll: () => request<Dispute[]>('/disputes'),
    create: (body: { order_id: string; reason: string; evidence_image_url?: string }) =>
      request<Dispute>('/disputes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    resolve: (id: string, body: { resolution: string; admin_comment?: string }) =>
      request<{ message: string }>(`/disputes/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Reviews
  reviews: {
    create: (body: { order_id: string; target_user_id: string; rating: number; comment?: string }) =>
      request<Review>('/reviews', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // Admin
  admin: {
    getStats: () => request<AdminStats>('/admin/stats'),
    getFarmers: () => request<User[]>('/admin/farmers'),
    getCouriers: () => request<User[]>('/admin/couriers'),
    getB2bOrders: () => request<Order[]>('/admin/b2b-orders'),
    confirmPayment: (orderId: string) =>
      request<{ message: string }>(`/admin/orders/${orderId}/confirm-payment`, {
        method: 'POST',
      }),
    getWithdrawals: () => request<WithdrawalRequest[]>('/admin/withdrawals'),
    approveWithdrawal: (id: string, comment?: string) =>
      request<{ message: string; withdrawal: WithdrawalRequest }>(`/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      }),
    rejectWithdrawal: (id: string, reason?: string) =>
      request<{ message: string; withdrawal: WithdrawalRequest }>(`/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    updateKyc: (userId: string, status: string) =>
      request<{ message: string; user: User }>(`/admin/kyc/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    getTransactions: () => request<Transaction[]>('/admin/transactions'),
    deliverOverride: (orderId: string, reason: string) =>
      request<{ message: string }>(`/admin/orders/${orderId}/deliver-override`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    resetPin: (orderId: string, reason?: string) =>
      request<{ message: string }>(`/admin/orders/${orderId}/reset-pin`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  // Users & Wallet
  users: {
    upgradePremium: () => request<{ message: string; user: User }>('/users/upgrade-premium', { method: 'POST' }),
    getWalletHistory: () =>
      request<{
        wallet_available: number;
        wallet_escrow: number;
        is_premium: boolean;
        transactions: Transaction[];
      }>('/users/wallet-history'),
    withdraw: (amount: number, card_or_account?: string) =>
      request<{ message: string; wallet_available: number; withdrawal?: WithdrawalRequest }>('/users/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, card_or_account }),
      }),
    getWithdrawals: () => request<WithdrawalRequest[]>('/users/withdrawals'),
  },

  // Uploads (Supabase Storage)
  uploads: {
    sign: (bucket: 'product-images' | 'private-docs', content_type: string, size_bytes?:number) =>
      request<{ signed_url: string; public_url: string | null; path: string; token?: string }>('/uploads/sign', {
        method: 'POST',
        body: JSON.stringify({ bucket, content_type, size_bytes }),
      }),
  },
};
