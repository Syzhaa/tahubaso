'use client';

import { forwardRef } from 'react';
import Image from 'next/image';

// Jika belum diimpor dari /types, definisikan di sini
interface Order {
  id: number;
  status: 'baru' | 'diproses' | 'selesai';
  items: {
    menuId: string;
    name: string;
    price: number;
    qty: number;
  }[];
  total: number;
  paymentMethod?: 'cash' | 'QRIS';
  createdAt: string; // Format ISO string (dari Supabase)
  updated_at?: string;
}

interface StrukPrintProps {
  order: Order | null;
}

const StrukPrint = forwardRef<HTMLDivElement, StrukPrintProps>(({ order }, ref) => {
  if (!order) return null;

  const renderDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString('id-ID');
  };

  return (
    <div ref={ref} className="struk-container p-4 bg-white text-black font-mono text-sm w-80 mx-auto">
      <div className="struk-header text-center mb-4">
        <Image
          src="/logo.png"
          alt="Logo Tahubaso"
          width={100}
          height={100}
          className="mx-auto mb-2"
        />
        <h1 className="text-lg font-bold">Tahubaso</h1>
        <p>Jl. Contoh No. 123, Kota Contoh</p>
        <p>Telp: 0812-3456-7890</p>
      </div>

      <div className="struk-body">
        <p>No. Pesanan: #{order.id}</p>
        <p>Tanggal: {renderDate(order.createdAt)}</p>
        <p>Metode Bayar: {order.paymentMethod || 'N/A'}</p>
        <p>-----------------------------</p>
        <table className="w-full">
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td className="pr-2">{item.qty}x {item.name}</td>
                <td className="text-right">
                  Rp {(item.price * item.qty).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>-----------------------------</p>
        <p className="font-bold">
          Total: Rp {order.total.toLocaleString('id-ID')}
        </p>
      </div>

      <div className="struk-footer text-center mt-4">
        <p>Terima Kasih atas Kunjungan Anda!</p>
        <p>Powered by Tahubaso</p>
      </div>
    </div>
  );
});

StrukPrint.displayName = 'StrukPrint';

export default StrukPrint;
