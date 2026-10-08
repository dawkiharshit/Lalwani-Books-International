export interface ProductColors {
  from: string;
  to: string;
  accent: string;
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  author?: string | null;
  /** The author record (Categories & Authors) the name above comes from. */
  author_id?: number | null;
  /** The publisher record (Publishers) the book's publisher name comes from. */
  publisher_id?: number | null;
  price: number;
  compare_at_price: number | null;
  rating_avg: number;
  rating_count: number;
  is_bestseller: boolean;
  image: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_category_pick: boolean;
  in_stock: boolean;
  /** Stock code — shown on the product page and when packing an order. */
  sku: string | null;
  size_ml: number | null;
  colors: ProductColors;
  category: { name: string; slug: string } | null;
}

export interface GalleryImage {
  id: number;
  url: string;
  alt: string | null;
}

export interface ProductDetail extends ProductCard {
  sku: string;
  /** Printed on the GST invoice. */
  hsn_code?: string | null;
  description: string;
  stock: number;
  /** Sent to the courier; null falls back to the store default. */
  weight_grams?: number | null;
  low_stock_threshold?: number | null;
  notes: { top: string | null; heart: string | null; base: string | null };
  book?: BookDetails;
  gallery?: GalleryImage[];
  /** Raw YouTube link — used to populate the admin form. */
  video_url?: string | null;
  /** Resolved video for the storefront: a YouTube link or an uploaded file. */
  video?: { type: "youtube" | "file"; url: string } | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  author?: string | null;
  description: string | null;
  products_count: number;
}

export interface CartItem {
  id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  product: ProductCard;
}

export interface Cart {
  token: string;
  items: CartItem[];
  items_count: number;
  subtotal: number;
}

export interface Review {
  id: number;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_admin: boolean;
  email_verified?: boolean;
  avatar?: string | null;
  /** False for accounts created through Google — there is no password to change. */
  has_password?: boolean;
  /** Account creation date, YYYY-MM-DD. */
  member_since?: string | null;
}

/** A saved shipping address from the customer's address book. */
export interface SavedAddress {
  id: number;
  /** Optional nickname — "Home", "Work". */
  label: string | null;
  name: string;
  phone: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: number;
  items_count: number;
  placed_at: string;
}

export interface OrderItemDetail {
  id: number;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
  product: ProductCard | null;
}

export interface OrderDetail {
  id: number;
  order_number: string;
  email: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  placed_at: string;
  shipping_address: {
    name: string;
    phone: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes: string | null;
  /** Set once a courier is booked; null before that. */
  shipment?: {
    awb_code: string;
    courier_name: string | null;
    tracking_url: string | null;
    shipped_at: string | null;
  } | null;
  delivered_at?: string | null;
  /** Delivered + inside the window + no open return. */
  returnable?: boolean;
  return_window_days?: number;
  /** Working days for a completed online refund to reach the card. */
  refund_days?: number;
  /** The latest return/replacement on this order, if any. */
  return?: OrderReturn | null;
  items: OrderItemDetail[];
}

export interface OrderReturn {
  id: number;
  order_number: string;
  type: "refund" | "replacement";
  reason: string;
  note: string | null;
  items: { name: string; quantity: number; product_id: number | null }[];
  photos: string[];
  status: "requested" | "approved" | "rejected" | "completed";
  admin_note: string | null;
  return_awb: string | null;
  tracking_url: string | null;
  refund_amount: number | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page?: number; total: number };
}

/** Bibliographic details shown on the book page. */
export interface BookDetails {
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  pages: number | null;
  language: string | null;
  binding: string | null;
  published_year: number | null;
}
