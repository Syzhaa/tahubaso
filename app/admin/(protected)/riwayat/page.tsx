'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from '@/types';
import StrukPrint from './StrukPrint';
import { IconPrinter, IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [filterType, setFilterType] = useState<'day' | 'month' | 'range'>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [dateRange, setDateRange] = useState({
    start: today,
    end: today
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
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
      // Give time for DOM to update before printing
      const printTimer = setTimeout(() => {
        handleReactPrint();
      }, 300);

      return () => clearTimeout(printTimer);
    }
  }, [orderToPrint, handleReactPrint]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('status', 'selesai')
        .order('created_at', { ascending: false });

      // Apply date filters based on filter type
      if (filterType === 'day') {
        const startOfDay = `${selectedDate}T00:00:00.000Z`;
        const endOfDay = `${selectedDate}T23:59:59.999Z`;
        query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
      } else if (filterType === 'month') {
        const [year, month] = selectedMonth.split('-');
        const startOfMonth = `${year}-${month}-01T00:00:00.000Z`;
        const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
        const endOfMonthStr = `${year}-${month}-${endOfMonth.getDate().toString().padStart(2, '0')}T23:59:59.999Z`;
        query = query.gte('created_at', startOfMonth).lte('created_at', endOfMonthStr);
      } else if (filterType === 'range') {
        const startOfRange = `${dateRange.start}T00:00:00.000Z`;
        const endOfRange = `${dateRange.end}T23:59:59.999Z`;
        query = query.gte('created_at', startOfRange).lte('created_at', endOfRange);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching history:', error.message);
        setOrders([]);
      } else {
        console.log('Fetched orders:', data?.length || 0);
        // Transform snake_case to camelCase if needed
        const transformedData = data?.map((order: Record<string, unknown>) => ({
          ...order,
          createdAt: (order.created_at as string) || (order.createdAt as string),
          paymentMethod: (order.payment_method as string) || (order.paymentMethod as string)
        })) || [];
        setOrders(transformedData as Order[]);
      }
    } catch (err: unknown) {
      console.error('Unexpected error:', (err as Error).message);
      setOrders([]);
    }
    setLoading(false);
  }, [filterType, selectedDate, selectedMonth, dateRange]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        fetchHistory();
      }
    };
    checkUser();
  }, [router, fetchHistory]);

  const validateOrderData = (order: Order): boolean => {
    if (!order || !order.id || !order.total || !order.createdAt || !order.items) {
      return false;
    }
    for (const item of order.items) {
      if (!item.name || !item.price || !item.qty) {
        return false;
      }
    }
    return true;
  };

  const handleFilterChange = (newFilterType: 'day' | 'month' | 'range') => {
    setFilterType(newFilterType);
    setCurrentPage(1);
    
    // Set default values based on filter type
    if (newFilterType === 'day') {
      setSelectedDate(today);
    } else if (newFilterType === 'month') {
      setSelectedMonth(new Date().toISOString().slice(0, 7));
    } else if (newFilterType === 'range') {
      setDateRange({ start: today, end: today });
    }
  };

  const handlePrintStruk = (order: Order) => {
    if (!validateOrderData(order)) {
      alert('Data pesanan tidak lengkap, tidak dapat mencetak struk.');
      return;
    }
    setOrderToPrint(order);
  };

  const filteredOrders = orders.filter((order) => {
    const idStr = order.id ? String(order.id) : '';
    const paymentMethodStr = order.paymentMethod || '';
    return (
      idStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      paymentMethodStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

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

  const getFilterLabel = () => {
    if (filterType === 'day') {
      return `Tanggal: ${new Date(selectedDate).toLocaleDateString('id-ID')}`;
    } else if (filterType === 'month') {
      const [year, month] = selectedMonth.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('id-ID', { 
        month: 'long', 
        year: 'numeric' 
      });
      return `Bulan: ${monthName}`;
    } else {
      return `Periode: ${new Date(dateRange.start).toLocaleDateString('id-ID')} - ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <IconCalendar size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Filter Riwayat Transaksi</h2>
          </div>

          {/* Filter Type Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => handleFilterChange('day')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterType === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => handleFilterChange('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterType === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => handleFilterChange('range')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterType === 'range'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              Periode
            </button>
          </div>

          {/* Filter Inputs */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {filterType === 'day' && (
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Tanggal
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            )}

            {filterType === 'month' && (
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Bulan
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            )}

            {filterType === 'range' && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => {
                      setDateRange(prev => ({ ...prev, start: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => {
                      setDateRange(prev => ({ ...prev, end: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="flex flex-col flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cari Transaksi
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari ID pesanan atau metode bayar..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  🔍
                </span>
              </div>
            </div>
          </div>

          {/* Current Filter Display */}
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Filter Aktif:</strong> {getFilterLabel()}
              {filteredOrders.length > 0 && (
                <span className="ml-2">• {filteredOrders.length} transaksi ditemukan</span>
              )}
            </p>
          </div>
        </div>

        {/* Results Section */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 text-sm mt-2">Memuat data...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">
              Tidak ada transaksi ditemukan untuk filter yang dipilih.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedOrders.map((order) => {
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
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString('id-ID', {
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
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleTimeString('id-ID')
                        : 'N/A'}
                    </p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {order.paymentMethod?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePrintStruk(order)}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </>
        )}

        {/* Hidden Print Component */}
        <div style={{ display: 'none' }}>
          <StrukPrint ref={strukRef} order={orderToPrint} />
        </div>
      </main>
    </div>
  );
}