'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Expense } from '@/types';
import { useRouter } from 'next/navigation';
import ExpenseForm from '@/components/admin/ExpenseForm';
import { User } from '@supabase/supabase-js';

export default function ManageExpensesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1); // Track current page
  const [totalExpenses, setTotalExpenses] = useState(0); // Track total expenses count
  const expensesPerPage = 5; // Limit to 5 expenses per page
  const router = useRouter();
  const tokoId = 'tahubaso';

  const fetchExpenses = useCallback(async () => {
    // Fetch total count for pagination
    let countQuery = supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('tokoId', tokoId);

    if (dateRange.start) {
      countQuery = countQuery.gte('date', dateRange.start);
    }
    if (dateRange.end) {
      countQuery = countQuery.lte('date', dateRange.end);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error fetching expenses count:', countError);
      return;
    }

    setTotalExpenses(count || 0);

    // Fetch paginated expenses
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('tokoId', tokoId)
      .order('date', { ascending: false })
      .range((currentPage - 1) * expensesPerPage, currentPage * expensesPerPage - 1);

    if (dateRange.start) {
      query = query.gte('date', dateRange.start);
    }
    if (dateRange.end) {
      query = query.lte('date', dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      setExpenses(data as Expense[]);
    }
  }, [tokoId, dateRange, currentPage]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setUser(session.user);
        await fetchExpenses();
      }
      setLoading(false);
    };
    checkUser();
  }, [router, fetchExpenses]);

  const handleOpenModal = (expense: Expense | null) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleSaveExpense = async (expenseData: Partial<Expense>) => {
    setIsSubmitting(true);
    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert(expenseData);
        if (error) throw error;
      }
      await fetchExpenses();
      handleCloseModal();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Gagal menyimpan pengeluaran: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Yakin ingin menghapus pengeluaran ini?')) {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);
      if (error) alert(`Gagal menghapus: ${error.message}`);
      else {
        // Adjust page if necessary after deletion
        if (expenses.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
        await fetchExpenses();
      }
    }
  };

  const filteredExpenses = expenses.filter((expense) =>
    expense.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination controls
  const totalPages = Math.ceil(totalExpenses / expensesPerPage);

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

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <ExpenseForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveExpense}
        expenseToEdit={editingExpense}
        isSubmitting={isSubmitting}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenModal(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm"
            >
              + Tambah Pengeluaran
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
            <div className="relative flex-1 w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari pengeluaran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">
              Belum ada pengeluaran atau tidak ditemukan.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      {expense.title}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {new Date(expense.date).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Rp {expense.amount.toLocaleString('id-ID')}
                  </p>
                  {/* Removed the description line that was causing the error */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(expense)}
                      className="flex-1 py-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 hover:text-blue-700 px-6 transition-all duration-200 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(expense.id!)}
                      className="flex-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 hover:text-red-700 transition-all duration-200 text-sm font-medium"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
          </>
        )}
      </main>
    </div>
  );
}