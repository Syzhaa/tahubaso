import { supabase } from '@/lib/supabase';
import { Menu } from '@/types';
import MenuClient from './MenuClient';

// Fungsi ini sekarang mengambil data dari Supabase
async function getMenus(tokoId: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('tokoId', tokoId)
    .eq('isAvailable', true);

  if (error) {
    console.error('Error fetching menus:', error);
    return [];
  }
  
  // Transform and filter the data to ensure it matches our Menu type
  const validMenus: Menu[] = (data || [])
    .filter(menu => menu.id !== undefined && menu.id !== null)
    .map(menu => ({
      ...menu,
      id: menu.id as string // Type assertion since we've filtered out undefined/null
    }));
  
  return validMenus;
}

// PERBAIKAN UNTUK NEXT.JS 15: params sekarang Promise
export default async function MenuPage({ 
  params 
}: { 
  params: Promise<{ tokoId: string }> 
}) {
  // KUNCI: await params dulu sebelum destructuring
  const resolvedParams = await params;
  const { tokoId } = resolvedParams;
  
  const menus = await getMenus(tokoId);
  
  if (!menus.length) {
    return (
      <div className="text-center p-10 font-bold text-xl">
        Toko tidak ditemukan atau belum ada menu.
      </div>
    );
  }
  
  return <MenuClient menus={menus} tokoId={tokoId} />;
}