// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  // Langsung arahkan ke halaman menu toko default Anda
  redirect('/menu/toko-sejahtera-01');
}