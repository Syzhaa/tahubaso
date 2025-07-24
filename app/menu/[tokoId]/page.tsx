// app/menu/[tokoId]/page.tsx
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Menu } from '@/types';
import MenuClient from './MenuClient';

async function getMenus(tokoId: string): Promise<Menu[]> {
  const menusCol = collection(db, 'menus');
  const q = query(menusCol, where('tokoId', '==', tokoId), where('isAvailable', '==', true));
  const menuSnapshot = await getDocs(q);
  const menuList = menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Menu[];
  return menuList;
}

export default async function MenuPage({ params }: { params: { tokoId: string } }) {
  const menus = await getMenus(params.tokoId);

  if (!menus.length) {
    return <div className="text-center p-10 font-bold text-xl">Toko tidak ditemukan atau belum ada menu.</div>;
  }
  // Kita akan membuat komponen MenuClient selanjutnya
  return <MenuClient menus={menus} tokoId={params.tokoId} />;
}