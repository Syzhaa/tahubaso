'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types';
import StrukPrint from './StrukPrint';
import { IconPrinter, IconAlertCircle } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterType, setFilterType] = useState<'day' | 'month'>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const strukRef = useRef<HTMLDivElement>(null);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const router = useRouter();

  const handleReactPrint = useReactToPrint({
    contentRef: strukRef,
    documentTitle: `struk-pesanan-${orderToPrint?.id}`,
    onAfterPrint: () => setOrderToPrint(null),
  });

  useEffect(() => {
    if (orderToPrint && strukRef.current) {
      handleReactPrint();
    }
  }, [orderToPrint, handleReactPrint]);

  const fetchHistory = useCallback(async (date: string, type: 'day' | 'month') => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('status', 'selesai')
        .order('created_at', { ascending: false });

      if (type === 'day') {
        query = query
          .gte('created_at', `${date}T00:00:00.000Z`)
          .lte('created_at', `${date}T23:59:59.999Z`);
      } else {
        const start = new Date(date);
        const firstDay = new Date(start.getFullYear(), start.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0];
        query = query
          .gte('created_at', `${firstDay}T00:00:00.000Z`)
          .lte('created_at', `${lastDay}T23:59:59.999Z`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching history:', error);
        setOrders([]);
      } else {
        setOrders(data as Order[]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setOrders([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        fetchHistory(filterDate, filterType);
      }
    };
    checkUser();
  }, [router, filterDate, filterType, fetchHistory]);

  const validateOrderData = (order: Order): boolean => {
    if (!order || !order.id || !order.total || !order.created_at || !order.items) {
      return false;
    }
    for (const item of order.items) {
      if (!item.name || !item.price || !item.qty) {
        return false;
      }
    }
    return true;
  };

  const setFilterToToday = () => {
    setFilterDate(today);
    setFilterType('day');
    fetchHistory(today, 'day');
  };

  const setFilterToThisMonth = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    setFilterDate(firstDay);
    setFilterType('month');
    fetchHistory(firstDay, 'month');
  };

  const filteredOrders = orders.filter((order) => {
    const idStr = order.id ? String(order.id) : '';
    const paymentMethodStr = order.paymentMethod || '';
    return (
      idStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paymentMethodStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py- lg:ml-48 pt-20 lg:ml-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari ID pesanan atau metode bayar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
            </div>
            <div>
              <label
                htmlFor="filterDate"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Tanggal
              </label>
              <input
                type="date"
                id="filterDate"
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setFilterType('day');
                  fetchHistory(e.target.value, 'day');
                }}
                className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm w-full sm:w-40"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={setFilterToToday}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  filterType === 'day'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={setFilterToThisMonth}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  filterType === 'month'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 text-sm mt-2">Memuat data...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">
              Tidak ada transaksi pada {filterType === 'day' ? 'tanggal ini' : 'bulan ini'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => {
              const isValidOrder = validateOrderData(order);
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      #{order.id}
                      {!isValidOrder && (
                        <IconAlertCircle
                          size={16}
                          className="inline ml-2 text-red-500"
                          title="Data tidak lengkap"
                        />
                      )}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Total: Rp {order.total ? order.total.toLocaleString('id-ID') : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    Waktu:{' '}
                    {order.created_at
                      ? new Date(order.created_at).toLocaleTimeString('id-ID')
                      : 'N/A'}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {order.paymentMethod?.toUpperCase() || 'N/A'}
                    </span>
                  </div>
                  <button
                    onClick={() => setOrderToPrint(order)}
                    className={`flex w-full items-center justify-center py-1.5 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                      isValidOrder
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!isValidOrder}
                    title={isValidOrder ? 'Cetak Struk' : 'Data tidak lengkap, tidak dapat mencetak'}
                  >
                    <IconPrinter size={16} className="mr-1" /> Cetak Struk
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'none' }}>
          <StrukPrint ref={strukRef} order={orderToPrint} />
        </div>
      </main>
    </div>
  );
}