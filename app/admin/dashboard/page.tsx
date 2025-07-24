// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Order } from '@/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
    const [user, loading] = useAuthState(auth);
    const [orders, setOrders] = useState<Order[]>([]);
    const router = useRouter();

    // Ganti dengan ID Toko Anda setelah login. Untuk sekarang, kita hardcode.
    const tokoId = "toko-sejahtera-01"; 

    useEffect(() => {
        if (loading) return;
        if (!user) router.push('/admin/login');
    }, [user, loading, router]);

    useEffect(() => {
        if (!tokoId) return;
        const q = query(collection(db, "orders"), where("tokoId", "==", tokoId), where("status", "in", ["baru", "diproses"]));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const newOrders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
            newOrders.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());
            setOrders(newOrders);
        });
        return () => unsubscribe();
    }, [tokoId]);

    const handleUpdateStatus = async (orderId: string, newStatus: 'diproses' | 'selesai', paymentMethod?: 'cash' | 'QRIS') => {
        const orderRef = doc(db, 'orders', orderId);
        const updateData: any = { status: newStatus };
        if (newStatus === 'selesai' && paymentMethod) {
            updateData.paymentMethod = paymentMethod;
        }
        await updateDoc(orderRef, updateData);
    };

    const handleLogout = () => {
      auth.signOut();
      router.push('/admin/login');
    }

    if (loading || !user) return <p className="text-center p-10">Loading...</p>

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Dashboard Pesanan</h1>
              <button onClick={handleLogout} className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600">Logout</button>
            </div>

            <div className="mb-8 flex flex-wrap gap-4">
                <Link href="/admin/menu" className="bg-gray-700 text-white py-2 px-4 rounded-lg">Kelola Menu</Link>
                <Link href="/admin/pengeluaran" className="bg-gray-700 text-white py-2 px-4 rounded-lg">Catat Pengeluaran</Link>
                <Link href="/admin/laporan" className="bg-gray-700 text-white py-2 px-4 rounded-lg">Lihat Laporan</Link>
             </div>

            <h2 className="text-2xl font-bold mb-4">Pesanan Aktif</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.length === 0 && <p className="col-span-full">Belum ada pesanan masuk.</p>}
                {orders.map(order => (
                    <div key={order.id} className={`p-4 rounded-lg shadow-md ${order.status === 'baru' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                        <h3 className="font-bold">Pesanan #{order.id?.substring(0, 5)}</h3>
                        <p className="text-sm text-gray-500 mb-2">Status: <span className="font-semibold uppercase">{order.status}</span></p>
                        <ul className="mb-2 list-disc list-inside">
                            {order.items.map(item => (<li key={item.menuId}>{item.qty}x {item.name}</li>))}
                        </ul>
                        <p className="font-bold text-lg">Total: Rp {order.total.toLocaleString('id-ID')}</p>

                        <div className="mt-4 flex flex-col gap-2">
                            {order.status === 'baru' && (
                                <button onClick={() => handleUpdateStatus(order.id!, 'diproses')} className="bg-blue-500 text-white py-1 px-3 rounded">Proses Pesanan</button>
                            )}
                            {order.status === 'diproses' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleUpdateStatus(order.id!, 'selesai', 'cash')} className="flex-1 bg-green-500 text-white py-1 px-3 rounded">Selesai (Cash)</button>
                                    <button onClick={() => handleUpdateStatus(order.id!, 'selesai', 'QRIS')} className="flex-1 bg-purple-500 text-white py-1 px-3 rounded">Selesai (QRIS)</button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}