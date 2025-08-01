'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { PaymentMethod } from '@/types';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement, // Diperlukan untuk Doughnut Chart
  Title,
  Tooltip,
  Legend,
  ChartData,
} from 'chart.js';

// Registrasi semua elemen chart yang akan digunakan
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

// Opsi pembayaran untuk filter, termasuk 'semua'
const paymentFilterOptions: (PaymentMethod | 'all')[] = ['all', 'CASH', 'QRIS', 'GOJEK', 'GRAB', 'SHOPEEFOOD'];

// Palet warna untuk Doughnut Chart
const DOUGHNUT_CHART_COLORS = [
  '#10B981', // green-500 (CASH)
  '#8B5CF6', // violet-500 (QRIS)
  '#3B82F6', // blue-500 (GOJEK)
  '#22C55E', // green-600 (GRAB)
  '#F97316', // orange-500 (SHOPEEFOOD)
];

export default function ReportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State untuk ringkasan total
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // State untuk data grafik (bisa line atau doughnut)
  const [chartData, setChartData] = useState<ChartData<'line' | 'doughnut'>>({
    labels: [],
    datasets: [],
  });
  
  // State untuk filter
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('day');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | 'all'>('all');

  const router = useRouter();

  // Helper function untuk menentukan apakah rentang tanggal adalah 1 hari
  const isSingleDay = (start: string, end: string) => {
    return start === end;
  };

  const fetchReportData = useCallback(async (start: string, end: string, type: 'day' | 'month' | 'year', payment: PaymentMethod | 'all') => {
    setLoading(true);

    if (!start || !end || new Date(start) > new Date(end)) {
      alert('Tanggal mulai tidak boleh setelah tanggal akhir atau kosong');
      setLoading(false);
      return;
    }

    try {
      // Tentukan apakah menggunakan chart lingkaran atau garis
      const useDoughnutChart = isSingleDay(start, end);

      // === Query Penjualan Dinamis ===
      let salesQuery = supabase
        .from('orders')
        .select('total, created_at, paymentMethod')
        .eq('status', 'selesai')
        .gte('created_at', `${start}T00:00:00.000Z`)
        .lte('created_at', `${end}T23:59:59.999Z`);

      // Untuk chart lingkaran (1 hari), tidak filter payment method karena ingin lihat semua
      // Untuk chart garis (multi hari), filter sesuai pilihan
      if (!useDoughnutChart && payment !== 'all') {
        salesQuery = salesQuery.eq('paymentMethod', payment);
      }
      
      const { data: salesData, error: salesError } = await salesQuery;
      
      // === Query Pengeluaran ===
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('amount, date')
        .gte('date', start)
        .lte('date', end);

      if (salesError) {
        console.error('Sales query error:', salesError);
        throw new Error(`Error fetching sales data: ${salesError.message}`);
      }

      if (expensesError) {
        console.error('Expenses query error:', expensesError);
        throw new Error(`Error fetching expenses data: ${expensesError.message}`);
      }

      // === Hitung total untuk ringkasan ===
      // Untuk ringkasan total, selalu sesuai filter payment method yang dipilih
      let filteredSalesData = salesData || [];
      if (payment !== 'all') {
        filteredSalesData = (salesData || []).filter(order => order.paymentMethod === payment);
      }

      const totalSalesValue = filteredSalesData.reduce((sum, order) => sum + order.total, 0);
      const totalExpensesValue = (expensesData || []).reduce((sum, expense) => sum + expense.amount, 0);
      setTotalSales(totalSalesValue);
      setTotalExpenses(totalExpensesValue);

      // === Proses data untuk Grafik ===
      if (useDoughnutChart) {
        // Proses untuk Doughnut Chart (1 hari) - tampilkan semua metode pembayaran
        const salesByPayment: Record<PaymentMethod, number> = {
          CASH: 0,
          QRIS: 0,
          GOJEK: 0,
          GRAB: 0,
          SHOPEEFOOD: 0
        };
        
        (salesData || []).forEach(order => {
          if(order.paymentMethod && order.paymentMethod in salesByPayment) {
              salesByPayment[order.paymentMethod as PaymentMethod] += order.total;
          }
        });
        
        // Filter out payment methods with 0 sales
        const filteredPaymentMethods = Object.entries(salesByPayment)
          .filter(([, amount]) => amount > 0)
          .reduce((acc, [method, amount]) => {
            acc[method as PaymentMethod] = amount;
            return acc;
          }, {} as Record<PaymentMethod, number>);
        
        const labels = Object.keys(filteredPaymentMethods);
        const data = Object.values(filteredPaymentMethods);
        
        setChartData({
          labels,
          datasets: [{
            label: 'Total Penjualan per Metode',
            data,
            backgroundColor: DOUGHNUT_CHART_COLORS.slice(0, labels.length),
            borderColor: '#ffffff',
            borderWidth: 2,
          }],
        });

      } else {
        // Proses untuk Line Chart (Multi hari) - gunakan data yang sudah difilter
        const labels: string[] = [];
        const salesByPeriod: number[] = [];
        const expensesByPeriod: number[] = [];

        if (type === 'month' || (type === 'day' && !isSingleDay(start, end))) {
          // Proses per hari dalam rentang
          const dateMap: { [key: string]: { sales: number; expenses: number } } = {};
          
          // Inisialisasi semua tanggal dalam rentang
          const startDateObj = new Date(start);
          const endDateObj = new Date(end);
          
          for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              dateMap[dateStr] = { sales: 0, expenses: 0 };
          }
          
          // Isi data penjualan (menggunakan data yang sudah difilter berdasarkan payment method)
          filteredSalesData.forEach(s => { 
            const dateStr = s.created_at.split('T')[0]; 
            if(dateMap[dateStr]) dateMap[dateStr].sales += s.total; 
          });
          
          // Isi data pengeluaran
          (expensesData || []).forEach(e => { 
            if(dateMap[e.date]) dateMap[e.date].expenses += e.amount; 
          });

          Object.keys(dateMap).sort().forEach(date => {
              const dateObj = new Date(date);
              // Format sesuai rentang waktu
              const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysDiff <= 31) {
                // Jika kurang dari sebulan, tampilkan tanggal
                labels.push(dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
              } else {
                // Jika lebih dari sebulan, tampilkan bulan-tahun
                labels.push(dateObj.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));
              }
              
              salesByPeriod.push(dateMap[date].sales);
              expensesByPeriod.push(dateMap[date].expenses);
          });

        } else if (type === 'year') {
          // Proses per bulan dalam tahun - lebih sederhana dan reliable
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
          
          // Selalu tampilkan 12 bulan
          labels.push(...monthNames);
          const monthlySales = new Array(12).fill(0);
          const monthlyExpenses = new Array(12).fill(0);
          
          // Tahun yang akan dianalisis (ambil dari start date)
          const targetYear = new Date(start).getFullYear();
          
          // Proses data penjualan
          filteredSalesData.forEach(sale => {
            try {
              const saleDate = new Date(sale.created_at);
              if (saleDate.getFullYear() === targetYear) {
                const monthIndex = saleDate.getMonth(); // 0-11
                monthlySales[monthIndex] += sale.total;
              }
            } catch (err) {
              console.warn('Error parsing sale date:', sale.created_at, err);
            }
          });
          
          // Proses data pengeluaran
          (expensesData || []).forEach(expense => {
            try {
              const expenseDate = new Date(expense.date);
              if (expenseDate.getFullYear() === targetYear) {
                const monthIndex = expenseDate.getMonth(); // 0-11
                monthlyExpenses[monthIndex] += expense.amount;
              }
            } catch (err) {
              console.warn('Error parsing expense date:', expense.date, err);
            }
          });
          
          salesByPeriod.push(...monthlySales);
          expensesByPeriod.push(...monthlyExpenses);
        }

        setChartData({
          labels,
          datasets: [
            { 
              label: payment === 'all' ? 'Penjualan (Semua Metode)' : `Penjualan (${payment})`, 
              data: salesByPeriod, 
              borderColor: 'rgb(34, 197, 94)', 
              backgroundColor: 'rgba(34, 197, 94, 0.2)', 
              tension: 0.3, 
              fill: true 
            },
            { 
              label: 'Pengeluaran', 
              data: expensesByPeriod, 
              borderColor: 'rgb(239, 68, 68)', 
              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
              tension: 0.3, 
              fill: true 
            },
          ],
        });
      }
      
    } catch (error) {
      console.error('Error in fetchReportData:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data';
      alert(`Gagal memuat data laporan: ${errorMessage}\n\nSilakan coba lagi atau periksa koneksi internet Anda.`);
      
      // Reset data to prevent stale state
      setTotalSales(0);
      setTotalExpenses(0);
      setChartData({ labels: [], datasets: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect untuk memuat data awal dan saat filter berubah
  useEffect(() => {
    const checkAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setUser(session.user);
        fetchReportData(startDate, endDate, filterType, selectedPayment);
      }
    };
    checkAndFetch();
  }, [startDate, endDate, filterType, selectedPayment, fetchReportData, router]);

  const handleApplyFilter = () => {
    fetchReportData(startDate, endDate, filterType, selectedPayment);
  };
  
  const setPresetFilter = (type: 'day' | 'month' | 'year') => {
    const now = new Date();
    let newStart = today;
    let newEnd = today;

    if (type === 'month') {
      newStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      newEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (type === 'year') {
      newStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      newEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setFilterType(type);
  };

  const netProfit = totalSales - totalExpenses;
  const useDoughnutChart = isSingleDay(startDate, endDate);

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 font-sans">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Laporan Keuangan</h1>
      
      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="startDate" className="block text-xs font-medium text-gray-700 mb-1">Dari Tanggal</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label htmlFor="endDate" className="block text-xs font-medium text-gray-700 mb-1">Sampai Tanggal</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label htmlFor="paymentFilter" className="block text-xs font-medium text-gray-700 mb-1">
                Metode Bayar {useDoughnutChart && <span className="text-xs text-gray-500">(untuk ringkasan)</span>}
              </label>
              <select id="paymentFilter" value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value as PaymentMethod | 'all')} className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                {paymentFilterOptions.map(opt => (
                  <option key={opt} value={opt}>{opt === 'all' ? 'Semua Metode' : opt}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2 xl:col-span-1">
              <button onClick={handleApplyFilter} className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shadow-sm">
                Terapkan
              </button>
            </div>
        </div>
        
        {/* Info tentang chart yang akan ditampilkan */}
        {useDoughnutChart && (
          <div className="mt-3 p-2 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-700">
              💡 Chart lingkaran menampilkan semua metode pembayaran untuk 1 hari. Filter metode pembayaran hanya berlaku untuk ringkasan total.
            </p>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => setPresetFilter('day')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterType === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Hari Ini</button>
          <button onClick={() => setPresetFilter('month')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterType === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Bulan Ini</button>
          <button onClick={() => setPresetFilter('year')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filterType === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Tahun Ini</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <h3 className="text-sm font-semibold text-gray-800">
            Total Omset {selectedPayment !== 'all' && <span className="text-xs text-gray-600">({selectedPayment})</span>}
          </h3>
          <p className="text-2xl font-bold text-green-600 mt-2">Rp {totalSales.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <h3 className="text-sm font-semibold text-gray-800">Total Pengeluaran</h3>
          <p className="text-2xl font-bold text-red-600 mt-2">Rp {totalExpenses.toLocaleString('id-ID')}</p>
        </div>
        <div className={`bg-white rounded-lg shadow-sm p-6 text-center border-l-4 ${netProfit >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
          <h3 className="text-sm font-semibold text-gray-800">Keuntungan Bersih</h3>
          <p className={`text-2xl font-bold mt-2 ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Rp {netProfit.toLocaleString('id-ID')}</p>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Grafik Keuangan 
            {useDoughnutChart ? ' - Proporsi Metode Pembayaran' : ` - Tren ${filterType === 'year' ? 'Bulanan' : 'Harian'}`}
          </h3>
          {loading ? (
             <div className="flex items-center justify-center h-80"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div></div>
          ) : (
            <div className="relative h-80">
              {chartData.labels && chartData.labels.length > 0 ? (
                useDoughnutChart ? (
                  <Doughnut
                    data={chartData as ChartData<'doughnut'>}
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { 
                        legend: { position: 'top' }, 
                        title: { 
                          display: true, 
                          text: `Proporsi Penjualan per Metode Pembayaran (${startDate === endDate ? new Date(startDate).toLocaleDateString('id-ID') : `${startDate} - ${endDate}`})` 
                        } 
                      } 
                    }}
                  />
                ) : (
                  <Line
                    data={chartData as ChartData<'line'>}
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { 
                        legend: { position: 'top' }, 
                        title: { 
                          display: true, 
                          text: `Tren Keuangan ${filterType === 'year' ? 'Bulanan' : 'Harian'} (${startDate} - ${endDate})` 
                        } 
                      }, 
                      scales: { 
                        y: { 
                          beginAtZero: true, 
                          ticks: { 
                            callback: (value) => `Rp ${Number(value).toLocaleString('id-ID')}` 
                          } 
                        } 
                      } 
                    }}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">Tidak ada data untuk ditampilkan</p>
                    <p className="text-sm text-gray-400">Coba ubah filter tanggal atau metode pembayaran</p>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

    </div>
  );
}