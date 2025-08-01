/**
 * @file types/index.ts
 * @description File pusat untuk semua definisi tipe dan interface aplikasi.
 * @version 1.0.0
 * @date 2025-07-31
 */

// =================================================================
// TIPE DASAR YANG BISA DIPAKAI ULANG (REUSABLE TYPES)
// =================================================================

/**
 * Mendefinisikan metode pembayaran yang diterima.
 * Menggunakan uppercase agar konsisten di seluruh aplikasi.
 */
export type PaymentMethod = 'CASH' | 'QRIS' | 'GOJEK' | 'GRAB' | 'SHOPEEFOOD';

/**
 * Mendefinisikan status dari sebuah pesanan.
 */
export type OrderStatus = 'baru' | 'diproses' | 'selesai' | 'dibatalkan';


// =================================================================
// INTERFACE UNTUK SETIAP ENTITAS DATA
// =================================================================

/**
 * Interface untuk data Menu Makanan/Minuman.
 */
export interface Menu {
  id: string;
  tokoId: string;
  name: string;
  price: number;
  imageUrl?: string; // Opsional jika beberapa menu tidak punya gambar
  category?: string; // Sangat berguna untuk filter
  description?: string; // Deskripsi singkat menu
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface untuk item di dalam keranjang belanja.
 */
export interface CartItem {
  menuId: string;
  name: string;
  price: number;
  qty: number;
}

/**
 * Interface utama untuk data Pesanan (Order).
 */
export interface Order {
  id: string; // Wajib ada untuk pesanan yang sudah tersimpan
  tokoId: string;
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod | null; // Menggunakan tipe yang sudah didefinisikan
  status: OrderStatus;
  createdAt: string;

  // Properti opsional yang umum untuk detail pesanan
  customer_name?: string;
  notes?: string;
  table_number?: number;
}

/**
 * Interface untuk data Pengeluaran (Expense).
 */
export interface Expense {
  id: string; // Wajib ada untuk data yang sudah tersimpan
  tokoId: string;
  title: string;
  amount: number;
  note?: string; // Catatan bisa jadi opsional
  category?: string; // Berguna untuk rekap (e.g., 'Bahan Baku', 'Gaji')
  date: string; // Format: 'YYYY-MM-DD'
  createdAt?: string;
}


// =================================================================
// TIPE PAYLOAD UNTUK MEMBUAT DATA BARU
// =================================================================

/**
 * Tipe data untuk membuat pesanan baru (id, createdAt, dll. belum ada).
 */
export type NewOrderPayload = Omit<Order, 'id' | 'createdAt' | 'status'> & {
  status?: OrderStatus;
};

/**
 * Tipe data untuk membuat pengeluaran baru.
 */
export type NewExpensePayload = Omit<Expense, 'id' | 'createdAt'>;