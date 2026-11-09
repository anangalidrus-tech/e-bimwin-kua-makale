# Checklist integrasi produksi

## 1. Siapkan Supabase
1. Buat proyek Supabase milik instansi.
2. Aktifkan Phone Auth dan konfigurasi penyedia SMS yang sesuai; atur kebijakan verifikasi nomor.
3. Salin Project URL dan anon/public key ke konfigurasi frontend (anon key boleh publik jika RLS benar).
4. Jangan pernah memasukkan `service_role` key ke HTML/JS atau repositori publik.
5. Jalankan `supabase/schema.sql` melalui SQL Editor setelah review teknis.

## 2. Autentikasi
- Gunakan `supabase.auth.signUp({ phone, password, options })` dan alur verifikasi nomor sesuai pengaturan Auth.
- Gunakan `supabase.auth.signInWithPassword({ phone, password })`.
- Gunakan alur OTP/reset password yang didukung konfigurasi provider.
- Sinkronkan `auth.users.id` dengan `public.profiles.id` melalui trigger server-side yang tervalidasi.
- Jangan pernah menyimpan password sendiri atau mengimplementasikan hashing di browser.

## 3. Keamanan tes
- Jangan mengirim `correct_option` ke browser peserta.
- Buat Edge Function `get-test` untuk mengirim soal dan opsi tanpa kunci jawaban.
- Buat Edge Function `submit-test` untuk memeriksa jawaban, menghitung nilai, menutup attempt, dan menyimpan jawaban secara atomik.
- Cegah pengiriman ulang dan perubahan attempt yang sudah disubmit.
- Validasi bahwa post-test hanya tersedia jika pre-test dan semua lesson selesai.
- Batasi role dan kesempatan retake di server.

## 4. RLS dan hak akses
- Uji peserta A tidak dapat membaca profil, pasangan, refleksi, jawaban, atau attempt peserta B.
- Uji fasilitator hanya dapat melihat peserta dalam `facilitator_assignments`.
- Uji admin KUA hanya pada lingkup instansinya.
- Uji super admin dan perubahan role melalui prosedur server tepercaya.
- Tinjau policy SQL starter: policy adalah titik awal, bukan sertifikasi keamanan.

## 5. Materi dan dokumen
- Unggah PDF ke Supabase Storage bucket privat atau bucket publik hanya untuk materi yang memang boleh diakses umum.
- Simpan metadata file, versi, status aktif, dan urutan materi.
- Masukkan materi berdasarkan PDF resmi yang telah diverifikasi.
- Sertifikat/bukti penyelesaian harus diberi nomor unik dan status dokumen yang jelas; jangan menyebut sertifikat resmi tanpa kewenangan.

## 6. Privasi dan operasi
- Sediakan privacy notice, tujuan pemrosesan, dasar pemrosesan, masa retensi, hak koreksi/penghapusan, kontak pengendali data.
- Batasi akses petugas sesuai kebutuhan tugas dan catat akses/perubahan.
- Buat backup terjadwal dan uji restore berkala.
- Terapkan HTTPS, rate limiting, validasi input, CSP, dan monitoring error.
- Lakukan uji keamanan dan UAT dengan akun terpisah sebelum peluncuran.

## 7. Deploy Cloudflare Pages
- Upload repository/folder statis berisi `index.html`, `style.css`, `script.js`.
- Atur environment variable publik yang memang aman (Supabase URL dan anon key).
- Tambahkan domain resmi instansi, HTTPS, dan kebijakan cache yang sesuai.
