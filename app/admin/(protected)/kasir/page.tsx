'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, Menu, CartItem } from '@/types';
import { useRouter } from 'next/navigation';

// Define extended menu type with category
interface MenuWithCategory extends Menu {
  id: string; // Ensure id is required
  category?: string;
}

export default function KasirPage() {
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<MenuWithCategory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'QRIS'>('cash');
  const router = useRouter();
  const tokoId = 'tahubaso';

  // Calculate cart totals
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const cartTotalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  // Filter menus and limit to 5
  const filteredMenus = useMemo(() => {
    return menus
      .filter((menu) => {
        const matchesSearch = menu.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesCategory =
          selectedCategory === 'all' || menu.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .slice(0, 5);
  }, [menus, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = ['all', ...new Set(menus.map((menu) => menu.category).filter(Boolean))];
    return cats as string[];
  }, [menus]);

  // Fetch menus
  const fetchMenus = async () => {
    try {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('tokoId', tokoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMenus(data as MenuWithCategory[]);
    } catch (err: unknown) {
      console.error('Error fetching menus:', (err as Error).message);
    }
  };

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/admin/login');
          return;
        }
        await fetchMenus();
      } catch (err: unknown) {
        console.error('Error in checkUserAndFetchData:', (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchData();
  }, [router, tokoId]);

  // Cart functions
  const addToCart = (menu: MenuWithCategory) => {
    if (!menu.id) return; // Guard clause to ensure menu has an id
    
    setCart((prev) => {
      const existingItem = prev.find((item) => item.menuId === menu.id);
      if (existingItem) {
        return prev.map((item) =>
          item.menuId === menu.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          menuId: menu.id,
          name: menu.name,
          price: menu.price,
          qty: 1,
        },
      ];
    });
  };

  const removeFromCart = (menuId: string) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.menuId === menuId);
      if (existingItem && existingItem.qty > 1) {
        return prev.map((item) =>
          item.menuId === menuId ? { ...item, qty: item.qty - 1 } : item
        );
      }
      return prev.filter((item) => item.menuId !== menuId);
    });
  };

  const clearCart = () => setCart([]);

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      alert('Keranjang kosong, tambahkan menu terlebih dahulu');
      return;
    }

    try {
      const newOrder = {
        tokoId,
        items: cart,
        total: cartTotal,
        status: 'baru',
        paymentMethod,
      };

      const { data, error } = await supabase
        .from('orders')
        .insert(newOrder)
        .select();
        
      if (error) throw error;

      alert(`Pesanan baru #${(data[0] as Order).id} berhasil dibuat!`);
      setCart([]);
      setPaymentMethod('cash');

    } catch (err: unknown) {
      console.error('Error creating order:', (err as Error).message);
      alert('Gagal membuat pesanan baru');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Search & Filter */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Cari menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-white">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-600 shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {category === 'all' ? 'Semua' : category}
                </button>
              ))}
            </div>
          </div>

          {/* Menu List */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Daftar Menu</h2>
            {filteredMenus.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Tidak ada menu yang ditemukan
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredMenus.map((menu) => {
                  const cartItem = cart.find((item) => item.menuId === menu.id);
                  const qtyInCart = cartItem?.qty || 0;
                  return (
                    <li
                      key={menu.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-blue-50 transition-all duration-200"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800 text-sm">{menu.name}</h3>
                        <p className="text-xs text-gray-600">Rp {menu.price.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {qtyInCart === 0 ? (
                          <button
                            onClick={() => addToCart(menu)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-xs font-medium"
                          >
                            Tambah
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => removeFromCart(menu.id)}
                              className="w-8 h-8 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-all duration-200 flex items-center justify-center text-sm"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium text-sm">{qtyInCart}</span>
                            <button
                              onClick={() => addToCart(menu)}
                              className="w-8 h-8 bg-green-100 text-green-600 rounded-md hover:bg-green-200 transition-all duration-200 flex items-center justify-center text-sm"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <aside className="lg:w-80 bg-white rounded-lg shadow-sm p-4 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Keranjang</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-600 hover:text-red-700 text-xs font-medium transition-all duration-200"
              >
                Kosongkan
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-300 text-4xl mb-3">🛒</div>
              <p className="text-gray-600 font-medium text-sm">Keranjang kosong</p>
              <p className="text-gray-400 text-xs mt-1">Tambahkan menu untuk memulai</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div
                    key={item.menuId}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-md hover:bg-blue-50 transition-all duration-200"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 text-sm">{item.name}</h4>
                      <p className="text-xs text-gray-600">Rp {item.price.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeFromCart(item.menuId)}
                        className="w-8 h-8 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-all duration-200 text-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.qty}</span>
                      <button
                        onClick={() => {
                          const menu = menus.find((m) => m.id === item.menuId);
                          if (menu) addToCart(menu);
                        }}
                        className="w-8 h-8 bg-green-100 text-green-600 rounded-md hover:bg-green-200 transition-all duration-200 text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment Method */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Metode Pembayaran</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${
                      paymentMethod === 'cash'
                        ? 'bg-blue-100 text-blue-600 shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    💰 Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('QRIS')}
                    className={`py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${
                      paymentMethod === 'QRIS'
                        ? 'bg-blue-100 text-blue-600 shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    📱 QRIS
                  </button>
                </div>
              </div>

              {/* Cart Summary */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Total Item</span>
                  <span>{cartTotalItems} item</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-800">
                  <span>Total</span>
                  <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <button
                onClick={handleCreateOrder}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-all duration-200 font-semibold text-sm mt-4"
              >
                Buat Pesanan
              </button>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}