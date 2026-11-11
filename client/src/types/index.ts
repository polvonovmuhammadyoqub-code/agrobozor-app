export type Role = 'FARMER' | 'BUYER_B2C' | 'BUYER_B2B' | 'COURIER' | 'ADMIN';
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Category = 'MEVALAR' | 'SABZAVOTLAR' | 'POLIZ' | 'SUT_GOSHT' | 'DON';
export type PaymentMethod = 'CLICK' | 'PAYME' | 'UZCARD' | 'HUMO' | 'INVOICE_B2B';
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CANCELLED'
  | 'PAID_IN_ESCROW'
  | 'CONFIRMED_BY_FARMER'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED';

export type DisputeStatus =
  | 'OPEN'
  | 'RESOLVED_REFUND_FULL'
  | 'RESOLVED_REFUND_PARTIAL'
  | 'RESOLVED_FARMER_WIN';

export interface User {
  id: string;
  phone: string;
  email?: string;
  full_name: string;
  role: Role;
  region: string;
  tin_or_passport: string;
  farm_or_company_name?: string | null;
  kyc_status: KycStatus;
  is_premium: boolean;
  wallet_available: number;
  wallet_escrow: number;
  rating: number;
  created_at?: string;
}

export interface Product {
  id: string;
  farmer_id: string;
  title: string;
  category: Category;
  price_per_kg: number;
  available_quantity_kg: number;
  min_order_kg: number;
  harvest_date: string;
  image_url: string;
  region: string;
  is_active: boolean;
  created_at: string;
  _count?: { views: number; orders: number };
  reviews?: Review[];
  farmer?: {
    id: string;
    full_name: string;
    farm_or_company_name?: string | null;
    region: string;
    rating: number;
    kyc_status: KycStatus;
    is_premium: boolean;
    phone: string;
  };
}

export interface Order {
  id: string;
  buyer_id: string;
  farmer_id: string;
  courier_id?: string | null;
  product_id: string;
  product_title?: string | null;
  unit_price_per_kg?: number | null;
  quantity_kg: number;
  product_total_amount: number;
  delivery_fee: number;
  total_paid: number;
  platform_commission: number;
  farmer_payout: number;
  courier_payout: number;
  platform_logistics_margin: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  delivery_address: string;
  delivery_schedule?: string | null;
  created_at: string;
  product: Product;
  buyer: {
    id: string;
    full_name: string;
    phone: string;
    region: string;
    farm_or_company_name?: string | null;
    tin_or_passport: string;
  };
  farmer: {
    id: string;
    full_name: string;
    phone: string;
    region: string;
    farm_or_company_name?: string | null;
    tin_or_passport: string;
    rating: number;
    is_premium: boolean;
  };
  courier?: {
    id: string;
    full_name: string;
    phone: string;
    rating: number;
  } | null;
  dispute?: Dispute | null;
  reviews?: Review[];
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  reason: string;
  evidence_image_url?: string | null;
  status: DisputeStatus;
  refund_amount?: number | null;
  admin_comment?: string | null;
  created_at: string;
  order?: Order;
  buyer?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  target_user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
  };
}

export interface Transaction {
  id: string;
  order_id?: string | null;
  user_id: string;
  amount: number;
  type: string;
  created_at: string;
  order?: {
    id: string;
    status: string;
    product?: { title: string };
  };
  user?: {
    id: string;
    full_name: string;
    role: string;
    phone: string;
  };
}

export interface PriceRecommendation {
  recommended_price: number | null;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  sample_count: number;
  source: 'matched_product' | 'insufficient_data';
  context: string;
}

export interface AdminStats {
  totalGmv: number;
  platformNetRevenue: number;
  aov: number;
  farmersCount: number;
  buyersCount: number;
  couriersCount: number;
  pendingKycCount: number;
  openDisputesCount: number;
  activeProductsCount: number;
  totalOrdersCount: number;
  pendingWithdrawalsCount?: number;
  pendingB2bPaymentsCount?: number;
  statusCounts: Record<string, number>;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  admin_comment?: string | null;
  created_at: string;
  processed_at?: string | null;
  user?: {
    id: string;
    full_name: string;
    phone: string;
    role: string;
    wallet_available: number;
  };
}

export interface InvoiceData {
  invoice_number: string;
  created_at: string;
  payment_method: string;
  status: string;
  seller: {
    name: string;
    tin: string;
    address: string;
    phone: string;
  };
  buyer: {
    name: string;
    tin: string;
    address: string;
    phone: string;
  };
  items: Array<{
    name: string;
    category: string;
    quantity_kg: number;
    price_per_kg: number;
    total_price: number;
  }>;
  delivery_fee: number;
  platform_service_fee: number;
  grand_total: number;
  delivery_schedule: string;
  stamp: string;
}

export interface ProductAnalytics {
  unique_views: number;
  order_count: number;
  sold_kg: number;
  earned: number;
  viewers: Array<{ id: string; last_viewed_at: string; viewer: { id: string; full_name: string; region: string } }>;
}
export interface ChatMessage {
  id: string;
  client_id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
export interface Conversation {
  id: string;
  buyer_id: string;
  seller_id: string;
  updated_at: string;
  product: { id: string; title: string; image_url: string; is_active: boolean };
  buyer: { id: string; full_name: string; region: string; role: Role };
  seller: { id: string; full_name: string; region: string; role: Role };
  messages?: ChatMessage[];
  _count?: { messages: number };
}
export interface MessagePage {
  conversation: Conversation;
  messages: ChatMessage[];
  next_cursor: string | null;
}
