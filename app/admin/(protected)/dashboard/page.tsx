'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define the order item type
interface OrderItem {
  id?: string | number;
  name: string;
  price: number;
  qty: number;
  category?: string;
  description?: string;
}

// Define the database row type for orders
interface OrderRow {
  id: string | number;
  tokoId: string;
  status: string;
  total: number;
  items: OrderItem[];
  created_at: string;
  payment_method: string;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  table_number?: number;
  [key: string]: unknown; // For any additional fields
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

      if (error) {
        addDebugLog(`❌ Gagal mengambil pesanan: ${error.message}`);
        throw error;
      } else {
        addDebugLog(`✅ Berhasil mengambil ${data?.length || 0} pesanan`);
        
        // Enhanced data mapping with proper type safety
        const mappedData: Order[] = (data || []).map(item => ({
          ...item,
          id: String(item.id || Date.now()), // Ensure ID is always a non-empty string
          createdAt: item.created_at || new Date().toISOString(),
          paymentMethod: item.payment_method || 'CASH',
          // Ensure items is properly structured
          items: Array.isArray(item.items) ? item.items.map((orderItem: unknown): OrderItem => {
            // Type guard for order item
            if (typeof orderItem === 'object' && orderItem !== null) {
              const item = orderItem as Record<string, unknown>;
              return {
                id: item.id as string | number | undefined,
                name: typeof item.name === 'string' ? item.name : 'Unknown Item',
                price: typeof item.price === 'number' ? item.price : 0,
                qty: typeof item.qty === 'number' ? item.qty : 0,
                category: typeof item.category === 'string' ? item.category : undefined,
                description: typeof item.description === 'string' ? item.description : undefined,
              };
            }
            // Fallback for invalid items
            return {
              name: 'Unknown Item',
              price: 0,
              qty: 0,
            };
          }) : [],
          // Ensure total is a number
          total: typeof item.total === 'number' ? item.total : 0,
          // Ensure status is valid
          status: ['baru', 'diproses', 'selesai'].includes(item.status) ? item.status : 'baru'
        }));
        
        setOrders(mappedData);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addDebugLog(`❌ Exception di fetchInitialOrders: ${errorMessage}`);
      // Don't throw here to prevent app crash
    }
  }, [tokoId]);

  useEffect(() => {
    const checkUserAndFetchOrders = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          addDebugLog(`❌ Error getting session: ${sessionError.message}`);
          router.push('/admin/login');
          return;
        }
        
        if (!session) {
          addDebugLog('🔐 No session found, redirecting to login');
          router.push('/admin/login');
          return;
        }
        
        await fetchInitialOrders();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        addDebugLog(`❌ Error di checkUserAndFetchOrders: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchOrders();

    // Setup realtime subscription
    addDebugLog('🔌 Menyiapkan langganan real-time...');
    setRealtimeStatus('connecting');
    
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
        (payload: RealtimePostgresChangesPayload<OrderRow>) => {
          addDebugLog(`📡 Real-time event: ${payload.eventType}`);
          
          // Refetch orders after any change
          fetchInitialOrders();

          // Show notification for new orders
          if (payload.eventType === 'INSERT' && payload.new) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Pesanan Baru!', { 
                body: `Pesanan #${String(payload.new.id).substring(0, 8)}...`,
                icon: '/favicon.ico' // Add icon if available
              });
            }
          }
        }
      )
      .subscribe((status) => {
        addDebugLog(`🔌 Realtime status: ${status}`);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      addDebugLog('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [router, fetchInitialOrders, tokoId]);

  const handleUpdateStatus = async (orderId: string, newStatus: 'diproses' | 'selesai') => {
    if (processingOrders.has(orderId)) {
      addDebugLog(`⏳ Pesanan #${orderId} sudah dalam proses`);
      return;
    }

    try {
      setProcessingOrders((prev) => new Set(prev).add(orderId));
      addDebugLog(`🔄 Mengupdate pesanan #${orderId} ke ${newStatus}`);

      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        addDebugLog(`❌ Gagal update pesanan #${orderId}: ${error.message}`);
        alert(`Gagal mengupdate status: ${error.message}`);
      } else {
        addDebugLog(`✅ Permintaan update #${orderId} berhasil`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      addDebugLog(`❌ Exception update pesanan #${orderId}: ${errorMessage}`);
      alert(`Terjadi kesalahan saat mengupdate pesanan: ${errorMessage}`);
    } finally {
      // Remove from processing set after a delay to prevent rapid clicking
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
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  const statusInfo = {
    connected: { icon: '🟢', text: 'Terhubung', color: 'text-green-600' },
    connecting: { icon: '🟡', text: 'Menyambungkan...', color: 'text-yellow-600' },
    error: { icon: '🔴', text: 'Error', color: 'text-red-600' },
    disconnected: { icon: '⚫', text: 'Terputus', color: 'text-gray-600' },
  }[realtimeStatus];

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
              // Ensure order.id is always a string
              const orderId = order.id || String(Date.now());
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
                      Pesanan #{orderId.toString().substring(0, 8)}...
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
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  <ul className="mb-3 space-y-1">
                    {(order.items || []).map((item, index) => (
                      <li key={index} className="text-sm flex justify-between">
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
                        Total: Rp {(order.total || 0).toLocaleString('id-ID')}
                      </p>
                      {order.paymentMethod && (
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            order.paymentMethod === 'QRIS' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {order.paymentMethod === 'QRIS' ? '📱' : '💰'}
                          <span>{order.paymentMethod}</span>
                        </div>
                      )}
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