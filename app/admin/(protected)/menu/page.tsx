'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Menu } from '@/types';
import { useRouter } from 'next/navigation';
import MenuForm from '@/components/admin/MenuForm';
import { User } from '@supabase/supabase-js';
import Image from 'next/image';

// Define extended menu type with category
interface MenuWithCategory extends Menu {
  category?: string;
}

export default function ManageMenuPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<MenuWithCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuWithCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const router = useRouter();
  const tokoId = 'tahubaso';

  const fetchMenus = useCallback(async () => {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('tokoId', tokoId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching menus:', error.message);
    } else {
      setMenus(data as MenuWithCategory[]);
    }
  }, [tokoId]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setUser(session.user);
        await fetchMenus();
      }
      setLoading(false);
    };
    checkUser();
  }, [router, fetchMenus]);

  const handleOpenModal = (menu: MenuWithCategory | null) => {
    setEditingMenu(menu);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMenu(null);
  };

  const handleSaveMenu = async (menuData: Partial<MenuWithCategory>, imageFile?: File) => {
    setIsSubmitting(true);
    try {
      const finalData = { ...menuData };

      if (imageFile) {
        const filePath = `${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath);

        finalData.imageUrl = urlData.publicUrl;
      }

      if (editingMenu) {
        const { error } = await supabase
          .from('menus')
          .update(finalData)
          .eq('id', editingMenu.id!);
        if (error) throw error;
      } else {
        if (!finalData.imageUrl) {
          finalData.imageUrl = 'https://via.placeholder.com/150';
        }
        const { error } = await supabase.from('menus').insert(finalData);
        if (error) throw error;
      }

      await fetchMenus();
      handleCloseModal();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('--- DETAIL ERROR SUPABASE ---', error);
      alert(`Gagal menyimpan menu. Pesan: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMenu = async (menu: MenuWithCategory) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus menu "${menu.name}"?`)) {
      try {
        const { error: dbError } = await supabase
          .from('menus')
          .delete()
          .eq('id', menu.id!);
        if (dbError) throw dbError;

        if (menu.imageUrl && !menu.imageUrl.includes('placeholder.com')) {
          const imagePath = menu.imageUrl.split('/menu-images/')[1];
          if (imagePath) {
            const { error: storageError } = await supabase.storage
              .from('menu-images')
              .remove([imagePath]);
            if (storageError) console.error('Gagal hapus gambar lama:', storageError.message);
          }
        }

        await fetchMenus();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error deleting menu:', error);
        alert(`Gagal menghapus menu. Pesan: ${errorMessage}`);
      }
    }
  };

  const filteredMenus = menus.filter((menu) =>
    menu.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredMenus.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMenus = filteredMenus.slice(startIndex, endIndex);

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
      <MenuForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveMenu}
        menuToEdit={editingMenu}
        isSubmitting={isSubmitting}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to first page on search
                }}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
            </div>
            <button
              onClick={() => handleOpenModal(null)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm"
            >
              + Tambah Menu
            </button>
          </div>
        </div>

        {filteredMenus.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">Belum ada menu atau tidak ditemukan.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedMenus.map((menu) => (
                <div
                  key={menu.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-200"
                >
                  <div className="relative w-full h-40 mb-3">
                    <Image
                      src={menu.imageUrl || 'https://via.placeholder.com/150'}
                      alt={menu.name}
                      fill
                      className="object-cover rounded-md"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">
                    {menu.name}
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Rp {menu.price.toLocaleString('id-ID')}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        menu.isAvailable
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {menu.isAvailable ? 'Tersedia' : 'Habis'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {menu.category || 'Tanpa Kategori'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(menu)}
                      className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 hover:text-blue-700 transition-all duration-200 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteMenu(menu)}
                      className="flex-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 hover:text-red-700 transition-all duration-200 text-xs font-medium"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    currentPage === totalPages
                      ? 'bg-gray-200 cursor-not-allowed text-gray-600'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}