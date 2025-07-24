// app/menu/[tokoId]/MenuClient.tsx
'use client';

import { useState } from 'react';
import { Menu, CartItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function MenuClient({ menus, tokoId }: { menus: Menu[], tokoId: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const addToCart = (menu: Menu) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.menuId === menu.id!);
      if (existingItem) {
        return prevCart.map(item =>
          item.menuId === menu.id! ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { menuId: menu.id!, name: menu.name, price: menu.price, qty: 1 }];
    });
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'orders'), {
        tokoId: tokoId,
        items: cart,
        total: total,
        status: 'baru',
        paymentMethod: null,
        createdAt: serverTimestamp(),
      });
      setCart([]);
      setOrderSuccess(true);
    } catch (error) {
      console.error("Error sending order: ", error);
      alert('Gagal mengirim pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
      return (
          <div className="text-center p-10 bg-green-100 rounded-lg max-w-md mx-auto my-10">
              <h2 className="text-2xl font-bold text-green-700">✅ Pesanan Berhasil Dikirim!</h2>
              <p className="mt-2">Silakan tunggu pesanan Anda disiapkan oleh penjual.</p>
          </div>
      )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Daftar Menu</h1>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-2/3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus.map((menu) => (
              <div key={menu.id} className="border rounded-lg overflow-hidden shadow-lg">
                <img src={menu.imageUrl || 'https://via.placeholder.com/300'} alt={menu.name} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h3 className="font-bold text-lg">{menu.name}</h3>
                  <p className="text-gray-600">Rp {menu.price.toLocaleString('id-ID')}</p>
                  <button onClick={() => addToCart(menu)} className="mt-2 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                    + Tambah
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full md:w-1/3">
          <div className="border rounded-lg p-4 shadow-lg sticky top-4">
            <h2 className="text-xl font-bold mb-4">🛒 Pesanan Anda</h2>
            {cart.length === 0 ? (<p>Keranjang masih kosong.</p>) : (
              <>
                {cart.map(item => (
                  <div key={item.menuId} className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.qty} x Rp {item.price.toLocaleString('id-ID')}</p>
                    </div>
                    <p>Rp {(item.qty * item.price).toLocaleString('id-ID')}</p>
                  </div>
                ))}
                <hr className="my-4" />
                <div className="flex justify-between font-bold text-lg">
                  <p>Total</p>
                  <p>Rp {total.toLocaleString('id-ID')}</p>
                </div>
                <button onClick={handleSendOrder} disabled={isSubmitting} className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400">
                  {isSubmitting ? 'Mengirim...' : 'Kirim Pesanan ke Dapur'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}