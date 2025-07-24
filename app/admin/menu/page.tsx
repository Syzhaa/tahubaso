// app/admin/menu/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Menu } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MenuForm from '@/components/admin/MenuForm'; // Import komponen form

export default function ManageMenuPage() {
    const [user, loading] = useAuthState(auth);
    const [menus, setMenus] = useState<Menu[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
    const router = useRouter();
    const tokoId = "tahubaso";

    // Cek status login
    useEffect(() => {
        if (loading) return;
        if (!user) router.push('/admin/login');
    }, [user, loading, router]);

    // Ambil data menu secara real-time
    useEffect(() => {
        if (!tokoId) return;
        const q = query(collection(db, "menus"), where("tokoId", "==", tokoId));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const menusData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[];
            setMenus(menusData);
        });
        return () => unsubscribe();
    }, [tokoId]);

    const handleOpenModal = (menu: Menu | null) => {
        setEditingMenu(menu);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingMenu(null);
    };

    const handleSaveMenu = async (menuData: Omit<Menu, 'id'>, imageFile?: File) => {
        let imageUrl = menuData.imageUrl;

        // 1. Jika ada file gambar baru, upload dulu
        if (imageFile) {
            const imageRef = ref(storage, `menus/${tokoId}/${Date.now()}_${imageFile.name}`);
            await uploadBytes(imageRef, imageFile);
            imageUrl = await getDownloadURL(imageRef);
        }

        const finalMenuData = { ...menuData, imageUrl };

        // 2. Simpan data ke Firestore
        if (editingMenu) {
            // Update menu yang ada
            const menuDoc = doc(db, 'menus', editingMenu.id!);
            await updateDoc(menuDoc, finalMenuData);
        } else {
            // Tambah menu baru
            await addDoc(collection(db, 'menus'), finalMenuData);
        }
    };

    const handleDeleteMenu = async (menuId: string) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus menu ini?")) {
            try {
                await deleteDoc(doc(db, 'menus', menuId));
            } catch (error) {
                console.error("Error deleting menu:", error);
                alert("Gagal menghapus menu.");
            }
        }
    };

    if (loading || !user) {
        return <p className="text-center p-10">Loading...</p>;
    }

    return (
        <>
            <MenuForm 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSave={handleSaveMenu} 
                menuToEdit={editingMenu}
            />
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Kelola Menu</h1>
                    <Link href="/admin/dashboard" className="text-blue-500 hover:underline">
                        &larr; Kembali ke Dashboard
                    </Link>
                </div>

                <div className="mb-6">
                    <button onClick={() => handleOpenModal(null)} className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600">
                        + Tambah Menu Baru
                    </button>
                </div>

                <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                    <table className="min-w-full table-auto">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left">Nama Menu</th>
                                <th className="px-6 py-3 text-left">Harga</th>
                                <th className="px-6 py-3 text-left">Status</th>
                                <th className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {menus.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-4">Belum ada menu.</td>
                                </tr>
                            )}
                            {menus.map((menu) => (
                                <tr key={menu.id} className="border-b">
                                    <td className="px-6 py-4">{menu.name}</td>
                                    <td className="px-6 py-4">Rp {menu.price.toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${menu.isAvailable ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                            {menu.isAvailable ? 'Tersedia' : 'Habis'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleOpenModal(menu)} className="text-blue-600 hover:text-blue-800 mr-4 font-medium">Edit</button>
                                        <button onClick={() => handleDeleteMenu(menu.id!)} className="text-red-600 hover:text-red-800 font-medium">Hapus</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}