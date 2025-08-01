'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, PaymentMethod, CartItem, OrderStatus } from '@/types'; 
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// FIX 1: Hapus impor yang tidak terpakai ini
// import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define the database row type for orders
interface OrderRow {
  id: string | number;
  tokoId: string;
  status: OrderStatus; 
  total: number;
  items: CartItem[]; 
  created_at: string;
  paymentMethod: PaymentMethod | null; // Tipe dari DB bisa null
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  table_number?: number;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [processingOrders, setProcessingOrders] = useState<Set<string>>(new Set());
  const router = useRouter();
  const tokoId = 'tahubaso';

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
  };

  const fetchInitialOrders = useCallback(async () => {
    try {
      addDebugLog('🔄 Mengambil pesanan awal...');
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tokoId', tokoId)
        .in('status', ['baru', 'diproses'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      addDebugLog(`✅ Berhasil mengambil ${data?.length || 0} pesanan`);

      const mappedData: Order[] = (data || []).map((item: OrderRow) => ({
        ...item,
        id: String(item.id),
        createdAt: item.created_at,
        paymentMethod: item.paymentMethod, // Biarkan bisa null sesuai tipe Order
        items: Array.isArray(item.items) ? item.items.map((cartItem: unknown): CartItem => {
          const itemData = cartItem as Record<string, unknown>;
          return {
            menuId: String(itemData.menuId || ''),
            name: String(itemData.name || 'Unknown Item'),
            price: Number(itemData.price || 0),
            qty: Number(itemData.qty || 0),
          };
        }) : [],
        total: item.total,
        status: item.status, 
      }));

      setOrders(mappedData);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addDebugLog(`❌ Exception di fetchInitialOrders: ${errorMessage}`);
    }
  }, [tokoId]);

  useEffect(() => {
    const checkUserAndFetchOrders = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push('/admin/login');
          return;
        }
        
        await fetchInitialOrders();
      } catch (err: unknown) {
        addDebugLog(`❌ Error di checkUserAndFetchOrders: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchOrders();
    
    const channel = supabase.channel('realtime-orders-admin');

    channel
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders', 
          filter: `tokoId=eq.${tokoId}` 
        },
        () => {
          fetchInitialOrders();
        }
      )
      .subscribe((status) => {
        addDebugLog(`🔌 Realtime status: ${status}`);
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) setRealtimeStatus('error');
        else if (status === 'CLOSED') setRealtimeStatus('disconnected');
      });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      addDebugLog('🔌 Membersihkan langganan realtime');
      supabase.removeChannel(channel);
    };
  }, [router, fetchInitialOrders, tokoId]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (processingOrders.has(orderId)) return;

    setProcessingOrders((prev) => new Set(prev).add(orderId));
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

    } catch (err: unknown) {
      alert(`Gagal mengupdate status: ${(err as Error).message}`);
    } finally {
      setTimeout(() => {
        setProcessingOrders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }, 1000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  const statusInfo = {
    connected: { icon: '🟢', text: 'Terhubung', color: 'text-green-600' },
    connecting: { icon: '🟡', text: 'Menyambungkan...', color: 'text-yellow-600' },
    error: { icon: '🔴', text: 'Error', color: 'text-red-600' },
    disconnected: { icon: '⚫', text: 'Terputus', color: 'text-gray-600' },
  }[realtimeStatus];

  const paymentDetails: Record<PaymentMethod | 'default', { icon: string; style: string; }> = {
      CASH: { icon: '💰', style: 'bg-green-100 text-green-800' },
      QRIS: { icon: '📱', style: 'bg-purple-100 text-purple-800' },
      GOJEK: { icon: '🛵', style: 'bg-blue-100 text-blue-800' },
      GRAB: { icon: '🚗', style: 'bg-emerald-100 text-emerald-800' },
      SHOPEEFOOD: { icon: '🛍️', style: 'bg-orange-100 text-orange-800' },
      default: { icon: '💳', style: 'bg-gray-100 text-gray-800' }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusInfo.icon}</span>
            <span className={`text-sm font-medium ${statusInfo.color}`}>
              Real-time: {statusInfo.text}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/menu"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm"
            >
              Kelola Menu
            </Link>
            <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-md flex items-center gap-2 text-sm font-medium shadow-sm">
              <span className="font-semibold">{orders.length}</span> Pesanan Aktif
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-lg shadow-sm">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <p className="text-gray-500 text-sm">Belum ada pesanan aktif.</p>
            </div>
          ) : (
            orders.map((order) => {
              const orderId = order.id;
              const isProcessing = processingOrders.has(orderId);
              return (
                <div
                  key={orderId}
                  className={`p-4 rounded-lg shadow-sm bg-white border-l-4 ${
                    order.status === 'baru' ? 'border-yellow-400' : 'border-blue-400'
                  } transition-all duration-200 ${isProcessing ? 'opacity-75 animate-pulse' : ''}`}
                >
                   <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      Pesanan #{orderId.substring(0, 8)}...
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                        order.status === 'baru' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-3">
                    {new Date(order.createdAt).toLocaleString('id-ID', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>

                  <ul className="mb-3 space-y-1">
                    {(order.items || []).map((item, index) => (
                      <li key={`${orderId}-${item.menuId}-${index}`} className="text-sm flex justify-between">
                        <span>
                          {item.qty || 0}x {item.name || 'Unknown Item'}
                        </span>
                        <span className="text-gray-600">
                          Rp {((item.price || 0) * (item.qty || 0)).toLocaleString('id-ID')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-200 pt-2 mb-4">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-800 text-sm">
                        Total: Rp {order.total.toLocaleString('id-ID')}
                      </p>
                      
                      {(() => {
                        // FIX 2: Beri fallback 'CASH' jika order.paymentMethod null
                        const detail = paymentDetails[order.paymentMethod || 'CASH'] || paymentDetails.default;
                        return (
                          <div
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${detail.style}`}
                          >
                            <span>{detail.icon}</span>
                            <span>{order.paymentMethod || 'CASH'}</span>
                          </div>
                        );
                      })()}

                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {order.status === 'baru' && (
                      <button
                        onClick={() => handleUpdateStatus(orderId, 'diproses')}
                        disabled={isProcessing}
                        className="py-2 px-4 rounded-md w-full transition-all duration-200 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm shadow-sm"
                      >
                        {isProcessing ? 'Memproses...' : 'Proses Pesanan'}
                      </button>
                    )}
                    {order.status === 'diproses' && (
                      <button
                        onClick={() => handleUpdateStatus(orderId, 'selesai')}
                        disabled={isProcessing}
                        className="py-2 px-4 rounded-md w-full transition-all duration-200 text-white font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm shadow-sm"
                      >
                        {isProcessing ? 'Menunggu...' : '✅ Selesaikan Pesanan'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}