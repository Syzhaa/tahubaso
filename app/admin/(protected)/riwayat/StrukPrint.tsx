import React, { forwardRef } from 'react';
import { Order } from '@/types';

interface StrukPrintProps {
  order: Order | null;
}

const StrukPrint = forwardRef<HTMLDivElement, StrukPrintProps>(({ order }, ref) => {
  if (!order) return null;

  return (
    <div ref={ref} className="struk-print p-4 max-w-xs mx-auto text-xs font-mono bg-white">
      <div className="text-center mb-4">
        <h1 className="font-bold text-sm">NAMA TOKO ANDA</h1>
        <p>Alamat Toko Anda</p>
        <p>Telepon: 0xxx-xxxx-xxxx</p>
        <p>----------------------------------</p>
      </div>
      
      <div className="struk-body mb-2">
        <p>No. Pesanan: <span className="font-bold">#{order.id}</span></p>
        <p>Tanggal: {new Date(order.createdAt).toLocaleString('id-ID')}</p>
        <p>Metode Bayar: {order.paymentMethod || 'N/A'}</p>
        <p>----------------------------------</p>
        <table className="w-full mb-2">
          <thead>
            <tr>
              <th className="text-left">Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td className="text-left">{item.name}</td>
                <td className="text-center">{item.qty}</td>
                <td className="text-right">Rp {(item.price * item.qty).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>----------------------------------</p>
        <p className="font-bold">Total: Rp {order.total.toLocaleString('id-ID')}</p>
        <p>----------------------------------</p>
      </div>
      
      <div className="text-center mt-4">
        <p>Terima kasih atas kunjungan Anda!</p>
        <p>Barang yang sudah dibeli tidak dapat dikembalikan</p>
      </div>
    </div>
  );
});

StrukPrint.displayName = 'StrukPrint';

export default StrukPrint;