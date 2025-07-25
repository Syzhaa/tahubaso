'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ReportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [filterType, setFilterType] = useState<'day' | 'month' | 'year'>('day');
  const router = useRouter();

  const fetchReportData = useCallback(async (start: string, end: string, type: 'day' | 'month' | 'year') => {
    setLoading(true);

    // Fetch sales data
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total, created_at')
      .eq('status', 'selesai')
      .gte('created_at', new Date(start).toISOString())
      .lte('created_at', new Date(`${end}T23:59:59.999Z`).toISOString());

    if (salesError) console.error('Error fetching sales:', salesError);

    // Fetch expenses data
    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('amount, date')
      .gte('date', start)
      .lte('date', end);

    if (expensesError) console.error('Error fetching expenses:', expensesError);

    // Process data for totals
    const sales = salesData?.reduce((sum, current) => sum + current.total, 0) || 0;
    const expenses = expensesData?.reduce((sum, current) => sum + current.amount, 0) || 0;
    setTotalSales(sales);
    setTotalExpenses(expenses);

    // Process data for chart
    let labels: string[] = [];
    let salesByPeriod: number[] = [];
    let expensesByPeriod: number[] = [];

    if (type === 'day') {
      labels = ['Penjualan', 'Pengeluaran'];
      salesByPeriod = [sales];
      expensesByPeriod = [expenses];
    } else if (type === 'month') {
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      labels = [];
      salesByPeriod = [];
      expensesByPeriod = [];

      for (
        let d = new Date(startDateObj);
        d <= endDateObj;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split('T')[0];
        labels.push(dateStr);
        const dailySales =
          salesData
            ?.filter((s) => s.created_at.split('T')[0] === dateStr)
            .reduce((sum, current) => sum + current.total, 0) || 0;
        const dailyExpenses =
          expensesData
            ?.filter((e) => e.date === dateStr)
            .reduce((sum, current) => sum + current.amount, 0) || 0;
        salesByPeriod.push(dailySales);
        expensesByPeriod.push(dailyExpenses);
      }
    } else if (type === 'year') {
      const startYear = new Date(start).getFullYear();
      labels = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
      ];
      salesByPeriod = Array(12).fill(0);
      expensesByPeriod = Array(12).fill(0);

      salesData?.forEach((sale) => {
        const month = new Date(sale.created_at).getMonth();
        if (new Date(sale.created_at).getFullYear() === startYear) {
          salesByPeriod[month] += sale.total;
        }
      });

      expensesData?.forEach((expense) => {
        const month = new Date(expense.date).getMonth();
        if (new Date(expense.date).getFullYear() === startYear) {
          expensesByPeriod[month] += expense.amount;
        }
      });
    }

    setChartData({
      labels,
      datasets: [
        {
          label: 'Penjualan',
          data: salesByPeriod,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          tension: 0.4,
        },
        {
          label: 'Pengeluaran',
          data: expensesByPeriod,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          tension: 0.4,
        },
      ],
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setUser(session.user);
        fetchReportData(startDate, endDate, filterType);
      }
    };
    checkUser();
  }, [router, fetchReportData, startDate, endDate, filterType]);

  const handleFilter = () => {
    fetchReportData(startDate, endDate, filterType);
  };

  const setFilterToToday = () => {
    setStartDate(today);
    setEndDate(today);
    setFilterType('day');
    fetchReportData(today, today, 'day');
  };

  const setFilterToThisMonth = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
    setFilterType('month');
    fetchReportData(firstDay, lastDay, 'month');
  };

  const setFilterToThisYear = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), 11, 31)
      .toISOString()
      .split('T')[0];
    setStartDate(firstDay);
    setEndDate(lastDay);
    setFilterType('year');
    fetchReportData(firstDay, lastDay, 'year');
  };

  const netProfit = totalSales - totalExpenses;

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div>
              <label
                htmlFor="startDate"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Dari Tanggal
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm w-full"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Sampai Tanggal
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm w-full"
              />
            </div>
          </div>
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm"
          >
            Terapkan Filter
          </button>
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
            <button
              onClick={setFilterToThisYear}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterType === 'year'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              Tahun Ini
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 text-sm mt-2">Memuat data laporan...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center hover:shadow-md transition-all duration-200">
              <h3 className="text-sm font-semibold text-gray-800">Total Omset</h3>
              <p className="text-2xl font-bold text-green-600 mt-2">
                Rp {totalSales.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 text-center hover:shadow-md transition-all duration-200">
              <h3 className="text-sm font-semibold text-gray-800">Total Pengeluaran</h3>
              <p className="text-2xl font-bold text-red-600 mt-2">
                Rp {totalExpenses.toLocaleString('id-ID')}
              </p>
            </div>
            <div
              className={`bg-white rounded-lg shadow-sm p-6 text-center hover:shadow-md transition-all duration-200 ${
                netProfit >= 0 ? 'border-l-4 border-blue-400' : 'border-l-4 border-orange-400'
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-800">Keuntungan Bersih</h3>
              <p
                className={`text-2xl font-bold mt-2 ${
                  netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}
              >
                Rp {netProfit.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Grafik Keuangan
            </h3>
            <div className="relative h-64 sm:h-80">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { font: { size: 12 } },
                    },
                    title: {
                      display: true,
                      text:
                        filterType === 'day'
                          ? 'Keuangan Hari Ini'
                          : filterType === 'month'
                          ? 'Keuangan Bulanan'
                          : 'Keuangan Tahunan',
                      font: { size: 14 },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) =>
                          `Rp ${value.toLocaleString('id-ID')}`,
                        font: { size: 10 },
                      },
                    },
                    x: {
                      ticks: { font: { size: 10 } },
                    },
                  },
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}