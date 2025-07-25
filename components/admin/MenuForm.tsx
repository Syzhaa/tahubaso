// components/admin/MenuForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Menu } from '@/types';

interface MenuFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (menu: Partial<Menu>, imageFile?: File) => void;
    menuToEdit: Menu | null;
    isSubmitting: boolean;
}

export default function MenuForm({ isOpen, onClose, onSave, menuToEdit, isSubmitting }: MenuFormProps) {
    const [name, setName] = useState('');
    const [price, setPrice] = useState(0);
    const [isAvailable, setIsAvailable] = useState(true);
    const [imageFile, setImageFile] = useState<File | undefined>(undefined);

    useEffect(() => {
        if (menuToEdit) {
            setName(menuToEdit.name);
            setPrice(menuToEdit.price);
            setIsAvailable(menuToEdit.isAvailable);
        } else {
            setName('');
            setPrice(0);
            setIsAvailable(true);
        }
        setImageFile(undefined);
    }, [menuToEdit, isOpen]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const menuData: Partial<Menu> = {
            name,
            price,
            isAvailable,
            tokoId: 'tahubaso',
            // Jika sedang mengedit, sertakan ID dan imageUrl yang ada
            ...(menuToEdit && { id: menuToEdit.id, imageUrl: menuToEdit.imageUrl }),
        };
        onSave(menuData, imageFile);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6">{menuToEdit ? 'Edit Menu' : 'Tambah Menu Baru'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-gray-700 mb-2">Nama Menu</label>
                        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="price" className="block text-gray-700 mb-2">Harga</label>
                        <input type="number" id="price" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="image" className="block text-gray-700 mb-2">Gambar Menu</label>
                        <input type="file" accept="image/*" id="image" onChange={(e) => e.target.files && setImageFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        {menuToEdit?.imageUrl && !imageFile && <p className="text-xs mt-2">Gambar saat ini: <a href={menuToEdit.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">lihat gambar</a></p>}
                    </div>
                    <div className="mb-6 flex items-center">
                        <input type="checkbox" id="isAvailable" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="isAvailable" className="ml-2 block text-sm text-gray-900">Tersedia untuk dijual</label>
                    </div>
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400">Batal</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300">
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}