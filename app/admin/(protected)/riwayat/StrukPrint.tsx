'use client';

import React from 'react';
import { Order } from '@/types';

interface StrukPrintProps {
  order: Order | null;
}

// Komponen struk untuk print, menerima ref dari parent
const StrukPrint = React.forwardRef<HTMLDivElement, StrukPrintProps>(({ order }, ref) => {
  if (!order) return null;

  return (
    <div ref={ref} className="struk-container p-4 text-sm font-mono bg-white text-black w-[300px]">
      <div className="struk-header text-center mb-2">
        <h2 className="font-bold text-lg">Tahu Baso Khas Semarang</h2>
        <p>Jl. Contoh No. 123, Kota Anda</p>
        <p>----------------------------------</p>
      </div>
      <div className="struk-body mb-2">
        <p>No. Pesanan: <span className="font-bold">#{order.id}</span></p>
        <p>Tanggal: {new Date(order.created_at).toLocaleString('id-ID')}</p>
        <p>Metode Bayar: {order.paymentMethod || 'N/A'}</p>
        <p>----------------------------------</p>
        <table className="w-full mb-2">
          <tbody>
            {order.items.map((item) => (
              <tr key={item.menuId}>
                <td>{item.qty}x</td>
                <td>{item.name}</td>
                <td className="text-right">Rp {(item.price * item.qty).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>----------------------------------</p>
        <div className="struk-total flex justify-between font-bold">
          <span>TOTAL</span>
          <span>Rp {order.total.toLocaleString('id-ID')}</span>
        </div>
      </div>
      <div className="struk-footer text-center mt-4">
        <p>Terima kasih atas kunjungan Anda!</p>
      </div>
    </div>
  );
});

StrukPrint.displayName = 'StrukPrint';

export default StrukPrint;