export default function AdminLoading() {
  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-surface-900">Yönetim Paneli</h1>
        <p className="max-w-[78ch] text-sm leading-6 text-surface-500">
          Kullanıcı, mezun veri tabanı, onay ve denetim kayıtlarını tek ekrandan izle.
          Kritik işlemler yalnızca admin yöneticilerine açıktır.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="card space-y-3">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-8 w-16 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
