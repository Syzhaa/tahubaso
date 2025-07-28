'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

// Define placeholder types for Menu, CartItem, and Order
interface Menu {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
}

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  qty: number;
}

interface Order {
  id: number;
  status: 'baru' | 'diproses' | 'selesai';
  items: CartItem[];
  total: number;
  paymentMethod?: 'cash' | 'QRIS';
  created_at: string;
  updated_at?: string;
}

export default function MenuClient({ menus, tokoId }: { menus: Menu[], tokoId: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'menu' | 'payment' | 'qris' | 'success' | 'tracking'>('menu');
  const [showCart, setShowCart] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1); // Track current page
  const menusPerPage = 5; // Limit to 5 menus per page

  // Real-time order tracking
  useEffect(() => {
    if (!currentOrder) return;

    console.log('Setting up real-time tracking for order:', currentOrder.id);

    const channel = supabase.channel(`order-tracking-${currentOrder.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders',
          filter: `id=eq.${currentOrder.id}`
        },
        (payload) => {
          console.log('Order status updated!', payload);
          const updatedOrder = payload.new as Order;
          setCurrentOrder(updatedOrder);
          
          // Show notification for status updates
          if ('Notification' in window && Notification.permission === 'granted') {
            let message = '';
            switch (updatedOrder.status) {
              case 'diproses':
                message = 'Pesanan Anda sedang diproses!';
                break;
              case 'selesai':
                message = 'Pesanan Anda sudah siap!';
                break;
            }
            if (message) {
              new Notification(`Pesanan #${updatedOrder.id}`, {
                body: message,
                icon: '/icon-192x192.png'
              });
            }
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrder]); // Added currentOrder to dependency array

  // --- Cart Management ---
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

  const removeFromCart = (menuId: string) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.menuId === menuId);
      if (existingItem && existingItem.qty > 1) {
        return prevCart.map(item =>
          item.menuId === menuId ? { ...item, qty: item.qty - 1 } : item
        );
      }
      return prevCart.filter(item => item.menuId !== menuId);
    });
  };

  const total = useMemo(() =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  
  const totalItems = useMemo(() =>
    cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  // --- Order Submission ---
  const submitOrder = async (paymentMethod: 'cash' | 'QRIS') => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const orderData = {
        tokoId: tokoId,
        items: cart,
        total: total,
        status: 'baru' as const,
        paymentMethod: paymentMethod,
      };

      console.log('Submitting order:', orderData);

      const { data, error } = await supabase.from('orders').insert([orderData]).select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      // Set current order for tracking
      if (data && data[0]) {
        console.log('Order created successfully:', data[0]);
        setCurrentOrder(data[0] as Order);
      }
      
      setStep('success');
    } catch (error: unknown) {
      console.error("Failed to submit order:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Gagal mengirim pesanan: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const resetOrder = () => {
    setCart([]);
    setCurrentOrder(null);
    setStep('menu');
    setShowCart(false);
  }

  const startTracking = () => {
    setStep('tracking');
  }

  // --- Pagination Logic ---
  const totalPages = Math.ceil(menus.length / menusPerPage);
  const paginatedMenus = useMemo(() => {
    const startIndex = (currentPage - 1) * menusPerPage;
    return menus.slice(startIndex, startIndex + menusPerPage);
  }, [menus, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // --- Render Methods for Different Steps ---

  const renderTracking = () => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="text-center p-8 bg-white rounded-2xl max-w-md mx-auto shadow-2xl w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Pesanan #{currentOrder?.id}
          </h2>
          <div className="flex justify-center mb-4">
            <div className={`w-4 h-4 rounded-full ${currentOrder?.status === 'baru' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
            <div className="w-8 h-1 bg-gray-300 mt-1.5 mx-1"></div>
            <div className={`w-4 h-4 rounded-full ${currentOrder?.status === 'diproses' ? 'bg-blue-500 animate-pulse' : currentOrder?.status === 'selesai' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className="w-8 h-1 bg-gray-300 mt-1.5 mx-1"></div>
            <div className={`w-4 h-4 rounded-full ${currentOrder?.status === 'selesai' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          </div>
        </div>

        <div className="mb-6">
          {currentOrder?.status === 'baru' && (
            <div className="text-yellow-600">
              <div className="animate-spin mx-auto h-8 w-8 border-4 border-yellow-500 border-t-transparent rounded-full mb-3"></div>
              <p className="font-semibold">Menunggu Konfirmasi</p>
              <p className="text-sm text-gray-500">Pesanan Anda akan segera diproses</p>
            </div>
          )}
          
          {currentOrder?.status === 'diproses' && (
            <div className="text-blue-600">
              <div className="animate-bounce mx-auto h-8 w-8 mb-3">👨‍🍳</div>
              <p className="font-semibold">Sedang Diproses</p>
              <p className="text-sm text-gray-500">Chef sedang menyiapkan pesanan Anda</p>
            </div>
          )}
          
          {currentOrder?.status === 'selesai' && (
            <div className="text-green-600">
              <div className="mx-auto h-8 w-8 mb-3">✅</div>
              <p className="font-semibold">Pesanan Siap!</p>
              <p className="text-sm text-gray-500">Silakan ambil pesanan Anda</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Detail Pesanan:</h3>
          <div className="text-left text-sm space-y-1">
            {currentOrder?.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span>{item.qty}x {item.name}</span>
                <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
              </div>
            ))}
            <div className="border-t pt-2 font-semibold flex justify-between">
              <span>Total:</span>
              <span>Rp {currentOrder?.total.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setStep('menu')} 
            className="flex-1 bg-gray-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
          >
            Kembali ke Menu
          </button>
          <button 
            onClick={resetOrder} 
            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Pesanan Baru
          </button>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="text-center p-8 bg-white rounded-2xl max-w-md mx-auto shadow-2xl transform transition-all scale-100 opacity-100">
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
           <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-800">Pesanan Berhasil!</h2>
        <p className="mt-3 text-gray-600 mb-6">
          Terima kasih! Pesanan #{currentOrder?.id} sedang disiapkan oleh penjual.
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={startTracking} 
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg text-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform transform hover:scale-105"
          >
            📍 Lacak Pesanan
          </button>
          <button 
            onClick={resetOrder} 
            className="w-full bg-gray-500 text-white py-3 px-6 rounded-lg text-lg font-semibold hover:bg-gray-600 transition-colors"
          >
            Buat Pesanan Baru
          </button>
        </div>
      </div>
    </div>
  );

  const renderQRIS = () => {
    const qrisImageUrl = 'https://csczaropdidefplsylwt.supabase.co/storage/v1/object/public/menu-images//qr.jpg';
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="relative text-center p-6 md:p-8 bg-white rounded-2xl max-w-sm mx-auto shadow-2xl w-full">
           <button 
            onClick={() => setStep('payment')} 
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Bayar dengan QRIS</h2>
          <p className="text-sm text-gray-500 mb-4">Pindai kode QR untuk membayar.</p>
          <div className="p-2 bg-gray-100 rounded-lg inline-block">
             <Image
              src={qrisImageUrl}
              alt="QRIS Code"
              width={250}
              height={250}
              className="mx-auto rounded-md"
              onError={(e) => { e.currentTarget.src = 'https://placehold.co/250x250/e2e8f0/e2e8f0?text=QR'; }}
            />
          </div>
          <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 text-blue-800">
            <span className="text-sm">Total Pembayaran</span>
            <strong className="block text-2xl font-bold">Rp {total.toLocaleString('id-ID')}</strong>
          </div>
          <button 
            onClick={() => submitOrder('QRIS')} 
            disabled={isSubmitting} 
            className="mt-6 w-full bg-green-500 text-white py-3 rounded-lg font-semibold text-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {isSubmitting ? 'Mengirim...' : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    );
  };

  const renderPayment = () => (
     <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-50">
        <div className="relative bg-white rounded-2xl max-w-md mx-auto shadow-2xl w-full p-6 md:p-8">
           <button 
            onClick={() => setStep('menu')} 
            className="absolute top-4 left-4 text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Menu
          </button>
          <h2 className="text-center text-2xl font-bold text-gray-800 mb-2">Metode Pembayaran</h2>
          <p className="text-center text-sm text-gray-500 mb-6">
            Total Pesanan Anda: <strong className="text-gray-800 font-bold">Rp {total.toLocaleString('id-ID')}</strong>
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => submitOrder('cash')} 
              disabled={isSubmitting} 
              className="w-full flex items-center justify-center gap-3 bg-blue-500 text-white py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 transition-all transform hover:scale-105"
            >
              <span className="text-2xl">💰</span> Bayar di Kasir
            </button>
            <button 
              onClick={() => setStep('qris')} 
              disabled={isSubmitting} 
              className="w-full flex items-center justify-center gap-3 bg-purple-500 text-white py-4 rounded-xl text-lg font-semibold hover:bg-purple-600 disabled:bg-gray-400 transition-all transform hover:scale-105"
            >
               <span className="text-2xl">📱</span> Bayar dengan QRIS
            </button>
          </div>
        </div>
      </div>
  );

  const renderMenuAndCart = () => (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">Selamat Datang!</h1>
            <p className="mt-2 text-lg text-gray-500">Pilih menu favorit Anda di bawah ini.</p>
            
            {/* Real-time indicator */}
            <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Real-time Menu Active</span>
            </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Menu Items */}
          <div className="w-full lg:w-3/5 xl:w-2/3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedMenus.map((menu) => (
                <div key={menu.id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
                  {menu.imageUrl && (
                    <div className="relative w-full h-48 overflow-hidden">
                        <Image
                          src={menu.imageUrl}
                          alt={menu.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { e.currentTarget.src = `https://placehold.co/400x300/e0e0e0/777?text=${menu.name.replace(/\s/g,'+')}`; }}
                        />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-grow">
                    <h3 className="font-bold text-lg text-gray-800 mb-1">{menu.name}</h3>
                    {menu.description && (
                      <p className="text-gray-500 text-sm mb-3 flex-grow">{menu.description}</p>
                    )}
                    <div className="mt-auto flex justify-between items-center pt-3">
                      <span className="text-indigo-600 font-bold text-lg">
                        Rp {menu.price.toLocaleString('id-ID')}
                      </span>
                      <button
                        onClick={() => addToCart(menu)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-transform transform hover:scale-105"
                      >
                        + Tambah
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-all duration-200 text-sm font-medium"
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-all duration-200 text-sm font-medium"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>

          {/* Shopping Cart - Desktop */}
          <div className="w-full lg:w-2/5 xl:w-1/3 hidden lg:block">
            <div className="border bg-white border-gray-200 rounded-xl shadow-lg sticky top-6">
              {renderCartContent()}
            </div>
          </div>
        </div>
        
        {/* Floating Cart Button & Modal - Mobile */}
        {cart.length > 0 && (
             <div className="lg:hidden fixed bottom-4 right-4 z-40">
                <button onClick={() => setShowCart(true)} className="bg-blue-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{totalItems}</span>
                </button>
            </div>
        )}

        {showCart && (
            <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowCart(false)}>
                <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    {renderCartContent()}
                </div>
            </div>
        )}

        {/* Order Tracking Button - if there's a current order */}
        {currentOrder && step === 'menu' && (
            <div className="fixed bottom-4 left-4 z-40">
                <button 
                    onClick={() => setStep('tracking')} 
                    className="bg-green-600 text-white rounded-full shadow-lg p-4 flex items-center justify-center hover:bg-green-700 transition-colors"
                >
                    <span className="text-2xl">📍</span>
                </button>
            </div>
        )}
      </div>
    </div>
  );
  
  const renderCartContent = () => (
    <>
      <div className="p-5 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Pesanan Anda
        </h2>
      </div>
      
      {cart.length === 0 ? (
        <div className="text-center py-16 px-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            <p className="text-gray-500 mt-4">Keranjang Anda masih kosong.</p>
            <p className="text-sm text-gray-400">Silakan tambahkan menu.</p>
        </div>
      ) : (
        <>
          <div className="p-2 sm:p-4 max-h-[40vh] overflow-y-auto">
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.menuId} className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-500">
                      Rp {item.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-100 rounded-full">
                    <button
                      onClick={() => removeFromCart(item.menuId)}
                      className="text-red-500 w-8 h-8 rounded-full text-lg font-bold hover:bg-red-100 transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-medium text-gray-800">{item.qty}</span>
                    <button
                      onClick={() => addToCart({ id: item.menuId, name: item.name, price: item.price } as Menu)}
                      className="text-green-500 w-8 h-8 rounded-full text-lg font-bold hover:bg-green-100 transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <p className="w-24 text-right font-semibold text-gray-700">
                    Rp {(item.price * item.qty).toLocaleString('id-ID')}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-5 border-t border-gray-200">
            <div className="flex justify-between items-center font-bold text-lg mb-4">
              <p className="text-gray-600">Total</p>
              <p className="text-indigo-600">Rp {total.toLocaleString('id-ID')}</p>
            </div>
            
            <button
              onClick={() => { setStep('payment'); setShowCart(false); }}
              className="w-full bg-green-500 text-white py-3.5 rounded-lg hover:bg-green-600 transition-all font-semibold text-lg flex items-center justify-center gap-2 transform hover:scale-105"
            >
              Lanjut ke Pembayaran <span className="text-xl">🚀</span>
            </button>
          </div>
        </>
      )}
    </>
  );

  // --- Main Render Logic ---
  switch (step) {
    case 'success':
      return renderSuccess();
    case 'qris':
      return renderQRIS();
    case 'payment':
      return renderPayment();
    case 'tracking':
      return renderTracking();
    case 'menu':
    default:
      return renderMenuAndCart();
  }
}