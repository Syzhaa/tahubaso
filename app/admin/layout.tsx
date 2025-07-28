// app/admin/layout.tsx

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout ini hanya sebagai pembungkus untuk semua rute di bawah /admin.
  // Ia tidak menambahkan UI apa pun.
  return <>{children}</>;
}