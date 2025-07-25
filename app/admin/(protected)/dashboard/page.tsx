'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { useReactToPrint } from 'react-to-print';
import StrukPrint from './StrukPrint';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [processingOrders, setProcessingOrders] = useState<Set<number>>(new Set());
  const router = useRouter();
  const tokoId = 'tahubaso';

  // Ref and state for printing
  const strukRef = useRef<HTMLDivElement>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);

  // Print configuration
  const handleReactPrint = useReactToPrint({
    contentRef: strukRef,
    documentTitle: `struk-pesanan-${orderToPrint?.id}`,
    onAfterPrint: () => {
      setOrderToPrint(null);
      addDebugLog(`✅ Selesai mencetak struk untuk pesanan #${orderToPrint?.id}`);
    },
  });

  // Trigger print when orderToPrint is set
  useEffect(() => {
    if (orderToPrint && strukRef.current) {
      handleReactPrint();
    }
  }, [orderToPrint, handleReactPrint]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLogs((prev) => [...prev.slice(-9), logMessage]);
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
      } else {
        addDebugLog(`✅ Berhasil mengambil ${data?.length || 0} pesanan`);
        setOrders(data as Order[]);
      }
    } catch (err: any) {
      addDebugLog(`❌ Exception di fetchInitialOrders: ${err.message}`);
    }
  }, [tokoId]);

  useEffect(() => {
    const checkUserAndFetchOrders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/admin/login');
          return;
        }
        setUser(session.user);
        await fetchInitialOrders();
      } catch (err: any) {
        addDebugLog(`❌ Eror di checkUserAndFetchOrders: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    checkUserAndFetchOrders();

    addDebugLog('🔌 Menyiapkan langganan real-time...');
    const channel = supabase.channel('realtime-orders-admin');

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tokoId=eq.${tokoId}` }, (payload) => {
        addDebugLog(`📡 Real-time event: ${payload.eventType}`);
        fetchInitialOrders();

        const orderId = payload.eventType === 'UPDATE' ? payload.new.id : payload.old?.id;
        if (orderId) {
          setProcessingOrders((prev) => {
            const newSet = new Set(prev);
            newSet.delete(orderId);
            return newSet;
          });
        }

        if (payload.eventType === 'INSERT') {
          const newOrder = payload.new as Order;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Pesanan Baru!', { body: `Pesanan #${newOrder.id}` });
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error');
        else setRealtimeStatus('disconnected');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, fetchInitialOrders, tokoId]);

  const handleUpdateStatus = async (orderId: number, newStatus: 'diproses' | 'selesai') => {
    if (processingOrders.has(orderId)) return;

    try {
      setProcessingOrders((prev) => new Set([...prev, orderId]));
      addDebugLog(`🔄 Mengupdate pesanan #${orderId} ke ${newStatus}`);

      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);

      if (error) {
        addDebugLog(`❌ Gagal update pesanan #${orderId}: ${error.message}`);
        alert(`Gagal mengupdate status: ${error.message}`);
      } else {
        addDebugLog(`✅ Permintaan update #${orderId} berhasil`);
      }
    } catch (err: any) {
      addDebugLog(`❌ Exception update pesanan #${orderId}: ${err.message}`);
    } finally {
      setProcessingOrders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handlePrintStruk = (order: Order) => {
    addDebugLog(`🖨️ Menyiapkan struk untuk pesanan #${order.id}`);
    setOrderToPrint(order);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  const statusInfo = {
    connected: { icon: '🟢', text: 'Terhubung', color: 'text-green-600' },
    connecting: { icon: '🟡', text: 'Menyambungkan...', color: 'text-yellow-600' },
    error: { icon: '🔴', text: 'Eror', color: 'text-red-600' },
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
              <p className="text-gray-500 text-sm">Belum ada pesanan aktif.</p>
            </div>
          ) : (
            orders.map((order) => {
              const isProcessing = processingOrders.has(order.id!);
              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-lg shadow-sm bg-white border-l-4 ${
                    order.status === 'baru'
                      ? 'border-yellow-400'
                      : 'border-blue-400'
                  } transition-all duration-200 ${isProcessing ? 'opacity-75 animate-pulse' : ''}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      Pesanan #{order.id}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                        order.status === 'baru'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    {new Date(order.created_at).toLocaleString('id-ID')}
                  </p>

                  <ul className="mb-3 space-y-1">
                    {order.items.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm flex justify-between"
                      >
                        <span>
                          {item.qty}x {item.name}
                        </span>
                        <span className="text-gray-600">
                          Rp {(item.price * item.qty).toLocaleString('id-ID')}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-gray-200 pt-2 mb-4">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-800 text-sm">
                        Total: Rp {order.total.toLocaleString('id-ID')}
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
                        onClick={() => handleUpdateStatus(order.id!, 'diproses')}
                        disabled={isProcessing}
                        className="py-2 px-4 rounded-md w-full transition-all duration-200 text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm shadow-sm"
                      >
                        {isProcessing ? 'Memproses...' : 'Proses Pesanan'}
                      </button>
                    )}
                    {order.status === 'diproses' && (
                      <>
                        <button
                          onClick={() => handlePrintStruk(order)}
                          className="py-2 px-4 rounded-md w-full transition-all duration-200 text-white font-medium bg-purple-600 hover:bg-purple-700 text-sm shadow-sm"
                        >
                          🖨️ Cetak Struk
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(order.id!, 'selesai')}
                          disabled={isProcessing}
                          className="py-2 px-4 rounded-md w-full transition-all duration-200 text-white font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm shadow-sm"
                        >
                          {isProcessing ? 'Menunggu...' : '✅ Selesaikan Pesanan'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Hidden print component */}
      <div style={{ display: 'none' }}>
        <StrukPrint ref={strukRef} order={orderToPrint} />
      </div>

      <style jsx global>{`
        .struk-container {
          width: 280px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          padding: 10px;
          color: #000;
        }
        .struk-header,
        .struk-footer {
          text-align: center;
          margin-bottom: 10px;
        }
        .struk-body table {
          width: 100%;
        }
        .struk-body table td {
          padding: 1px 0;
        }
        .struk-total {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          font-size: 14px;
        }
        .struk-container p {
          margin: 2px 0;
        }
      `}</style>
    </div>
  );
}