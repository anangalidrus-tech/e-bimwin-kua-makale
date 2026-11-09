# E-BIMWIN KUA MAKALE

Proyek ini berisi prototipe frontend yang dapat dibuka langsung dan starter backend Supabase.

## Isi proyek
- `index.html` — halaman dan struktur aplikasi.
- `style.css` — tampilan responsif, mobile-first.
- `script.js` — alur demo: daftar, login lokal, biodata, 20 soal pre-test, dua modul, aktivitas refleksi, post-test, hasil, dashboard admin demo, ekspor CSV/JSON.
- `supabase/schema.sql` — rancangan tabel dan kebijakan RLS awal.
- `docs/PRODUCTION-CHECKLIST.md` — langkah integrasi produksi.

## Jalankan prototipe
1. Ekstrak ZIP.
2. Buka `index.html` di browser, atau jalankan server statis lokal.
3. Daftar akun demo menggunakan nomor HP dan password.
4. Lengkapi biodata, kerjakan pre-test, selesaikan seluruh subbab, lalu post-test.
5. Data demo tersimpan di `localStorage` browser yang sama.

**Peringatan:** mode demo bukan sistem produksi. Password demo hanya di-obfuscate, bukan di-hash secara aman. Jangan masukkan data pribadi peserta sebenarnya. Data tidak tersinkron lintas perangkat dan dapat hilang jika data browser dihapus. Dashboard admin pada prototipe tidak memiliki autentikasi/otorisasi aman.

## Supabase produksi
Lihat `docs/PRODUCTION-CHECKLIST.md` dan `supabase/schema.sql`. Frontend statis tidak boleh menyimpan service-role key. Gunakan Supabase Auth, RLS, Storage, dan Edge Functions untuk operasi sensitif.

## Materi
Materi dalam prototipe disusun dari outline kebutuhan yang diberikan. Dua PDF Modul 1 dan Modul 2 belum tersedia di berkas percakapan/Library saat proyek dibuat. Karena itu, konten harus diverifikasi dan diselaraskan dengan PDF/modul resmi sebelum digunakan sebagai bahan resmi KUA.

## Batasan yang belum diimplementasikan
- Supabase project credentials dan live backend integration.
- OTP/SMS recovery dan password reset.
- Server-side grading dan anti-tampering.
- Admin role management dan facilitator assignment UI.
- Upload materi, PDF certificates, PDF/XLSX reports, database backup/restore.
- Audit logging server-side, consent versioning, retention and deletion workflow.
- Final content review by KUA/facilitator.
