# Panduan Otomatisasi Update Website E-BIMWIN ke GitHub Pages

Panduan ini menjelaskan bagaimana alur kerja agar **setiap kali Anda meminta perubahan di Antigravity, website live Anda di internet langsung terupdate secara otomatis**.

---

## 🔄 Bagaimana Alur Kerjanya?

```
[Anda Chat di Antigravity] 
         │
         ▼
[Antigravity Mengubah Kode di Komputer Anda] 
         │
         ▼
[Kirim ke GitHub (Auto-Push)] 
         │
         ▼
[GitHub Actions Menerima Kode Baru] 
         │ (otomatis ~30 detik)
         ▼
[Website Live Terupdate di Internet!] 
(https://<username>.github.io/e-bimwin-kua-makale/)
```

---

## 🛠️ Langkah 1: Hubungkan Pertama Kali (One-Time Setup)

Agar website Anda tayang untuk pertama kalinya:

### Cara A: Melalui Tombol Pintasan (Paling Mudah)
1. Buka folder proyek Anda di File Explorer:  
   `C:\Users\Asus\Downloads\e-bimwin-kua-makale\e-bimwin-kua-makale`
2. Klik ganda (**double-click**) berkas [**`update.bat`**](../update.bat).
3. Layar hitam (CMD) akan otomatis membuat repository GitHub dan mengunggah seluruh berkas tampilan baru.
4. Di akhir layar akan muncul tautan website Anda:  
   `https://<username>.github.io/e-bimwin-kua-makale/`

---

## 🌐 Langkah 2: Mengaktifkan Auto-Deploy di GitHub (Sekali Saja)

1. Buka repository Anda di GitHub lewat browser (`https://github.com/<username>/e-bimwin-kua-makale`).
2. Klik tab **Settings** di menu atas.
3. Di panel sebelah kiri, pilih **Pages**.
4. Pada bagian **Build and deployment**:
   * Ubah dropdown **Source** menjadi **`GitHub Actions`**.
5. Selesai! Mulai saat ini, setiap kali ada file baru di-push ke GitHub, sistem akan otomatis melakukan rilis ke internet.

---

## ⚡ Langkah 3: Cara Kerja Otomatis Lewat Chat Antigravity

Mulai sekarang, ketika Anda ingin mengubah website:

1. **Ketik permintaan Anda di Antigravity seperti biasa**, contohnya:
   > *"Tolong ganti teks sambutan beranda menjadi 'Selamat Datang di Portal Resmi KUA Makale' dan langsung perbarui ke GitHub."*

2. **PENTING — Menyetujui Izin Terminal:**
   * Antigravity akan mengubah kode dan menjalankan skrip sinkronisasi ke GitHub.
   * Di layar chat akan muncul kotak konfirmasi izin eksekusi jaringan:
     👉 Klik tombol **"Allow"** (atau centang *"Always allow"*).
   * Seketika itu juga kode baru Anda akan terkirim ke GitHub dan website live Anda terupdate secara otomatis!

---

## 💡 Alternatif Cepat Tanpa Buka Chat:
Jika sewaktu-waktu Anda mengedit file secara manual di komputer tanpa bantuan Antigravity, cukup klik 2x [**`update.bat`**](../update.bat) kapan pun Anda ingin website live terupdate.
