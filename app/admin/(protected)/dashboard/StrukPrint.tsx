// app/admin/dashboard/StrukPrint.tsx
'use client';

import { Order } from '@/types';
import React from 'react';

// Props yang diterima komponen ini adalah data pesanan
interface StrukPrintProps {
  order: Order | null;
}

// Komponen ini akan di-forward ref-nya agar bisa diakses dari parent
const StrukPrint = React.forwardRef<HTMLDivElement, StrukPrintProps>(({ order }, ref) => {
  if (!order) {
    return null;
  }

  return (
    // 'ref' ditempatkan di sini
    <div ref={ref} className="struk-container">
      <div className="struk-header">
        <h2 className="font-bold text-lg">Tahu Baso Khas Semarang</h2>
        <p>Jl. Contoh No. 123, Kota Anda</p>
        <p>----------------------------------</p>
      </div>
      <div className="struk-body">
        <p>No. Pesanan: #{order.id}</p>
        <p>Tanggal: {new Date(order.created_at).toLocaleString('id-ID')}</p>
        <p>Metode Bayar: {order.paymentMethod || 'N/A'}</p>
        <p>----------------------------------</p>
        <table>
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
        <div className="struk-total">
          <p className="font-bold">TOTAL</p>
          <p className="font-bold">Rp {order.total.toLocaleString('id-ID')}</p>
        </div>
      </div>
      <div className="struk-footer">
        <p>Terima kasih atas kunjungan Anda!</p>
      </div>
    </div>
  );
});

// Memberikan display name untuk debugging
StrukPrint.displayName = 'StrukPrint';

export default StrukPrint;