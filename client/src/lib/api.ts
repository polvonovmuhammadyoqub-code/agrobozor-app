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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Serverda xatolik yuz berdi');
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    login: (phone: string, password?: string, otp?: string) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password, otp }),
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
    create: (body: Partial<Product>) =>
      request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<Product>) =>
      request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/products/${id}`, {
        method: 'DELETE',
      }),
    getPriceRecommendation: (category: string, region?: string) => {
      const query = new URLSearchParams({ category });
      if (region) query.append('region', region);
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
    }) =>
      request<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateStatus: (id: string, status: string) =>
      request<Order>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    complete: (id: string) =>
      request<{ message: string; order: Order }>(`/orders/${id}/complete`, {
        method: 'POST',
      }),
    getInvoice: (id: string) => request<InvoiceData>(`/orders/${id}/invoice`),
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
    updateKyc: (userId: string, status: string) =>
      request<{ message: string; user: User }>(`/admin/kyc/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    getTransactions: () => request<Transaction[]>('/admin/transactions'),
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
      request<{ message: string; wallet_available: number }>('/users/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, card_or_account }),
      }),
  },
};
