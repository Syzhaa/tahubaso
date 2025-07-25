// components/admin/ExpenseForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Expense } from '@/types';

interface ExpenseFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Partial<Expense>) => void;
    expenseToEdit: Expense | null;
    isSubmitting: boolean;
}

export default function ExpenseForm({ isOpen, onClose, onSave, expenseToEdit, isSubmitting }: ExpenseFormProps) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState(0);
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today

    useEffect(() => {
        if (expenseToEdit) {
            setTitle(expenseToEdit.title);
            setAmount(expenseToEdit.amount);
            setNote(expenseToEdit.note || '');
            setDate(expenseToEdit.date);
        } else {
            setTitle('');
            setAmount(0);
            setNote('');
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [expenseToEdit, isOpen]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const expenseData: Partial<Expense> = {
            title,
            amount,
            note,
            date,
            tokoId: 'tahubaso',
            ...(expenseToEdit && { id: expenseToEdit.id }),
        };
        onSave(expenseData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6">{expenseToEdit ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-gray-700 mb-2">Nama Pengeluaran</label>
                        <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Beli bahan baku" className="w-full px-3 py-2 border rounded-lg" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="amount" className="block text-gray-700 mb-2">Jumlah (Rp)</label>
                        <input type="number" id="amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" required />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="date" className="block text-gray-700 mb-2">Tanggal</label>
                        <input type="date" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" required />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="note" className="block text-gray-700 mb-2">Keterangan (Opsional)</label>
                        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full px-3 py-2 border rounded-lg"></textarea>
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