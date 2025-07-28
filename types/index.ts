// types/index.ts

export interface Menu {
  id: string; // ✅ Harus string, tidak boleh opsional
  tokoId: string;
  name: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
}


export interface CartItem {
  menuId: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id?: string;
  tokoId: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'QRIS' | null;
  status: 'baru' | 'diproses' | 'selesai';
  createdAt: string; // ✅ cukup pakai string
}


export interface Expense {
  id?: string;
  tokoId: string;
  title: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  
}