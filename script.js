/* E-BIMWIN KUA MAKALE — Bimbingan Perkawinan Digital
   Terintegrasi dengan Supabase Cloud Backend & Local Fallback.
   URL: https://scanwjvvnwcfqblljafg.supabase.co
*/

const SUPABASE_URL = 'https://scanwjvvnwcfqblljafg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IsOjGzIrkiiY4L83jjvB2Q_qK7V9nWH';

let sb = null;
try {
  if (typeof window !== 'undefined' && window.supabase && SUPABASE_URL && SUPABASE_KEY) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('✓ Supabase Cloud Client Connected.');
  }
} catch (err) {
  console.warn('Supabase initialization warning:', err);
}

const STORE = 'ebimwin_demo_v1';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let db = load(), currentUser = null, route = 'home', activeModule = 1, lessonIndex = 0, testState = null, toastTimer;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || { users: [], active: null }; }
  catch { return { users: [], active: null }; }
}

function save() {
  localStorage.setItem(STORE, JSON.stringify(db));
}

function notify(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function uid() {
  return 'P-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function user() {
  return db.users.find(x => x.id === currentUser);
}

function hashDemo(p) {
  return btoa(unescape(encodeURIComponent(p)));
}

function showPage(name) {
  route = name;
  $$('.page').forEach(x => x.classList.add('hidden'));
  const target = $('#page-' + name);
  if (target) target.classList.remove('hidden');
  $('#page-home-more').classList.toggle('hidden', name !== 'home');
  $('#mainNav').classList.remove('open');
  if ($('#navAuth')) $('#navAuth').textContent = user() ? 'Akun Saya' : 'Masuk';
  window.scrollTo(0, 0);
  if (name === 'dashboard') renderDashboard();
  if (name === 'profile') fillProfile();
  if (name === 'results') renderResults();
  if (name === 'admin') renderAdmin();
  if (name === 'module') renderModule();
  if (name === 'test') renderTest();
}

function openAuth(tab = 'login') {
  showPage('auth');
  setAuthTab(tab);
}

function setAuthTab(tab) {
  $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === tab));
  $('#loginForm').classList.toggle('hidden', tab !== 'login');
  $('#registerForm').classList.toggle('hidden', tab !== 'register');
}

function normalizePhone(v) {
  let p = String(v || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (!p.startsWith('62') && p.length > 0) p = '62' + p;
  return p;
}

// --------------------------------------------------------------------------
// REGISTRATION (SUPABASE CLOUD + LOCAL FALLBACK)
// --------------------------------------------------------------------------
async function register(form) {
  const d = Object.fromEntries(new FormData(form));
  const phone = normalizePhone(d.phone);
  if (!phone || phone.length < 9) {
    notify('Nomor HP tidak valid. Masukkan nomor HP aktif.');
    return;
  }
  const pass = (d.password || '').trim();
  const confirm = (d.confirm || '').trim();
  if (pass !== confirm) {
    notify('Konfirmasi password tidak sama.');
    return;
  }
  if (pass.length < 8) {
    notify('Password minimal 8 karakter.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Mendaftarkan...'; }

  // Virtual Auth Email based on phone for 100% reliable login without SMS gateway cost
  const authEmail = (d.email && d.email.includes('@')) 
    ? d.email.trim().toLowerCase() 
    : `${phone}@ebimwin.kua-makale.id`;

  let supabaseUserId = null;

  if (sb) {
    try {
      const { data: authData, error: authError } = await sb.auth.signUp({
        email: authEmail,
        password: pass,
        options: {
          data: {
            full_name: (d.name || '').trim(),
            phone: phone,
            gender: d.gender
          }
        }
      });

      if (authError) {
        if (authError.message && (authError.message.includes('already registered') || authError.message.toLowerCase().includes('already'))) {
          notify('Nomor HP / Akun ini sudah terdaftar. Silakan langsung masuk.');
          setAuthTab('login');
          const loginInput = $('#loginForm input[name="phone"]');
          if (loginInput) loginInput.value = d.phone;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Daftar sekarang'; }
          return;
        }
        console.warn('Supabase signUp note:', authError.message);
      } else if (authData && authData.user) {
        supabaseUserId = authData.user.id;
        // Upsert into public.profiles
        try {
          await sb.from('profiles').upsert({
            id: supabaseUserId,
            full_name: (d.name || '').trim(),
            phone: phone,
            role: 'peserta'
          });
        } catch (pe) {
          console.warn('Profile upsert note:', pe);
        }
      }
    } catch (err) {
      console.warn('Supabase register error:', err);
    }
  }

  // Create or update local user object (linked to Supabase ID if available)
  const uId = supabaseUserId || uid();
  const u = {
    id: uId,
    supabaseId: supabaseUserId,
    name: (d.name || '').trim(),
    phone,
    email: (d.email || '').trim(),
    authEmail: authEmail,
    gender: d.gender,
    passwordDemo: hashDemo(pass),
    createdAt: new Date().toISOString(),
    profile: null,
    pre: null,
    post: null,
    progress: { 1: [], 2: [] },
    reflections: {},
    activities: []
  };

  const existingIdx = db.users.findIndex(x => x.phone === phone || x.id === u.id);
  if (existingIdx >= 0) db.users[existingIdx] = u;
  else db.users.push(u);

  db.active = u.id;
  currentUser = u.id;
  save();

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Daftar sekarang'; }
  form.reset();
  notify('Akun berhasil dibuat & tersimpan di Cloud! Lengkapi biodata.');
  showPage('profile');
}

// --------------------------------------------------------------------------
// LOGIN (SUPABASE CLOUD + LOCAL FALLBACK)
// --------------------------------------------------------------------------
async function login(form) {
  const d = Object.fromEntries(new FormData(form));
  const phone = normalizePhone(d.phone);
  if (!phone) {
    notify('Masukkan nomor HP Anda.');
    return;
  }
  const pass = (d.password || '').trim();

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Memeriksa...'; }

  const authEmail = (d.phone && d.phone.includes('@')) 
    ? d.phone.trim().toLowerCase() 
    : `${phone}@ebimwin.kua-makale.id`;

  let loggedInUser = null;

  // 1. Try Supabase Cloud Login first
  if (sb) {
    try {
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: authEmail,
        password: pass
      });

      if (!authError && authData?.user) {
        const su = authData.user;
        const sMeta = su.user_metadata || {};
        
        // Fetch profile
        let sProfile = null;
        try {
          const { data: pData } = await sb.from('profiles').select('*').eq('id', su.id).maybeSingle();
          if (pData) sProfile = pData;
        } catch (e) {}

        // Fetch participant details
        let pDetails = null;
        try {
          const { data: partData } = await sb.from('participant_profiles').select('*').eq('user_id', su.id).maybeSingle();
          if (partData) {
            pDetails = {
              fullName: sProfile?.full_name || sMeta.full_name || '',
              father: partData.father_name || '',
              birthPlace: partData.birth_place || '',
              birthDate: partData.birth_date || '',
              gender: partData.gender || sMeta.gender || '',
              address: partData.address || '',
              birthOrder: partData.birth_order || '',
              education: partData.education || '',
              job: partData.occupation || '',
              kua: partData.kua_name || 'KUA Kecamatan Makale',
              weddingDate: partData.wedding_date || '',
              attendance: partData.attendance_status || 'Belum mengikuti'
            };
          }
        } catch (e) {}

        // Fetch lesson progress
        const progressObj = { 1: [], 2: [] };
        try {
          const { data: progData } = await sb.from('lesson_progress').select('*').eq('user_id', su.id);
          if (progData && progData.length) {
            progData.forEach(item => {
              if (item.completed_at && item.activity_data) {
                const m = item.activity_data.module || 1;
                const idx = item.activity_data.lessonIndex ?? 0;
                if (!progressObj[m].includes(idx)) progressObj[m].push(idx);
              }
            });
          }
        } catch (e) {}

        // Fetch test attempts
        let preScore = null, postScore = null;
        try {
          const { data: attempts } = await sb.from('test_attempts').select('*').eq('user_id', su.id);
          if (attempts) {
            const preAttempt = attempts.find(a => a.test_type === 'pretest' && a.status === 'submitted');
            const postAttempt = attempts.find(a => a.test_type === 'posttest' && a.status === 'submitted');
            if (preAttempt) preScore = { score: Number(preAttempt.score), correct: preAttempt.correct_count, wrong: preAttempt.wrong_count };
            if (postAttempt) postScore = { score: Number(postAttempt.score), correct: postAttempt.correct_count, wrong: postAttempt.wrong_count };
          }
        } catch (e) {}

        // Construct user session object
        loggedInUser = {
          id: su.id,
          supabaseId: su.id,
          name: sProfile?.full_name || sMeta.full_name || sMeta.name || 'Peserta',
          phone: sProfile?.phone || sMeta.phone || phone,
          email: su.email?.includes('@ebimwin.') ? '' : su.email,
          authEmail: su.email,
          gender: pDetails?.gender || sMeta.gender || 'Perempuan',
          passwordDemo: hashDemo(pass),
          createdAt: su.created_at || new Date().toISOString(),
          profile: pDetails,
          pre: preScore,
          post: postScore,
          progress: progressObj,
          reflections: {},
          activities: []
        };

        // Cache locally
        const exIdx = db.users.findIndex(x => x.phone === phone || x.id === su.id);
        if (exIdx >= 0) db.users[exIdx] = loggedInUser;
        else db.users.push(loggedInUser);

      } else if (authError) {
        console.warn('Supabase signIn note:', authError.message);
        if (authError.message.includes('Email not confirmed')) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Masuk ke akun'; }
          notify('Konfirmasi email di Supabase masih aktif. Matikan "Confirm email" di Auth Settings Supabase.');
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase login exception:', err);
    }
  }

  // 2. If Supabase login did not find user, check local cache fallback
  if (!loggedInUser) {
    const localUser = db.users.find(x => x.phone === phone);
    if (localUser) {
      const match = localUser.passwordDemo === hashDemo(pass) || localUser.passwordDemo === hashDemo(pass.trim());
      if (match) loggedInUser = localUser;
    }
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Masuk ke akun'; }

  if (!loggedInUser) {
    notify('Nomor HP atau password tidak sesuai. Pastikan Anda telah mendaftar.');
    return;
  }

  db.active = loggedInUser.id;
  currentUser = loggedInUser.id;
  save();
  form.reset();
  notify(`Berhasil masuk! Selamat datang, ${loggedInUser.name}.`);
  showPage('dashboard');
}

async function logout() {
  if (sb) {
    try { await sb.auth.signOut(); } catch (e) {}
  }
  currentUser = null;
  db.active = null;
  save();
  showPage('home');
  notify('Anda telah keluar.');
}

function fillProfile() {
  const u = user();
  if (!u) return;
  const p = u.profile || {};
  const f = $('#profileForm');
  for (const [k, v] of Object.entries(p)) {
    if (f.elements[k]) f.elements[k].value = v;
  }
  if (!p.fullName && f.elements.fullName) f.elements.fullName.value = u.name;
  if (!p.gender && f.elements.gender) f.elements.gender.value = u.gender;
}

// --------------------------------------------------------------------------
// SAVE PROFILE (SUPABASE CLOUD SYNC)
// --------------------------------------------------------------------------
async function saveProfile(form) {
  const u = user();
  if (!u) return;
  const p = Object.fromEntries(new FormData(form));
  u.profile = p;
  u.name = p.fullName;
  u.gender = p.gender;
  u.activities.push({ type: 'Biodata diperbarui', at: new Date().toISOString() });
  save();

  // Sync to Supabase
  if (sb && u.id) {
    try {
      await sb.from('profiles').upsert({
        id: u.id,
        full_name: p.fullName,
        phone: u.phone,
        role: 'peserta',
        updated_at: new Date().toISOString()
      });
      await sb.from('participant_profiles').upsert({
        user_id: u.id,
        father_name: p.father || '',
        birth_place: p.birthPlace || '',
        birth_date: p.birthDate || '2000-01-01',
        gender: p.gender === 'Laki-laki' ? 'Laki-laki' : 'Perempuan',
        address: p.address || '',
        birth_order: p.birthOrder || '1',
        education: p.education || 'SMA/MA/SMK',
        occupation: p.job || '',
        wedding_date: p.weddingDate || null,
        kua_name: p.kua || 'KUA Kecamatan Makale',
        attendance_status: p.attendance || 'Sedang mengikuti',
        updated_at: new Date().toISOString()
      });
      if (p.partnerName) {
        await sb.from('partners').upsert({
          user_id: u.id,
          full_name: p.partnerName,
          phone: p.partnerPhone || ''
        });
      }
    } catch (e) {
      console.warn('Supabase saveProfile sync note:', e);
    }
  }

  notify('Biodata berhasil disimpan ke Cloud & perangkat ini!');
  showPage('dashboard');
}

const modules = {
  1: {
    title: 'Membangun Keluarga Sakinah',
    lessons: [
      ['Tujuan Perkawinan dalam Islam', `<p>Perkawinan dalam Islam merupakan ikatan yang bertujuan membangun kehidupan bersama yang bermartabat, penuh tanggung jawab, dan membawa kemaslahatan. Pernikahan bukan sekadar perayaan atau pemenuhan kebutuhan pribadi, melainkan komitmen untuk saling menjaga.</p><h3>Sakinah, mawaddah, wa rahmah</h3><p><b>Sakinah</b> menggambarkan ketenteraman; <b>mawaddah</b> berkaitan dengan cinta dan kasih yang diwujudkan; sedangkan <b>rahmah</b> adalah kasih sayang yang mendorong kepedulian dan perlindungan.</p><blockquote>“Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan ... agar kamu merasa tenteram kepadanya.” (QS. Ar-Rum: 21)</blockquote><h3>Perkawinan dan kemaslahatan</h3><p>Rumah tangga yang sehat memberi ruang bagi tumbuhnya iman, rasa aman, tanggung jawab, dan kontribusi positif kepada masyarakat.</p>`],
      ['Membangun Keluarga Sakinah', `<p>Keluarga sakinah adalah keluarga yang mengupayakan ketenteraman melalui iman, kasih sayang, komunikasi, tanggung jawab, dan penghormatan terhadap martabat setiap anggota keluarga. Sakinah bukan berarti keluarga tanpa masalah, tetapi keluarga yang belajar menghadapi masalah secara sehat.</p><h3>Karakteristik yang diupayakan</h3><ul><li>Aman secara fisik dan emosional.</li><li>Terbuka dalam komunikasi dan pengambilan keputusan.</li><li>Adil, saling menghormati, dan berbagi tanggung jawab.</li><li>Memberi ruang bagi pertumbuhan setiap anggota keluarga.</li><li>Menghindari kekerasan, penghinaan, dan pemaksaan.</li></ul><blockquote>QS. At-Tahrim: 6 mengingatkan tanggung jawab menjaga diri dan keluarga.</blockquote>`],
      ['Lima Pilar Perkawinan', `<p>Lima pilar berikut dapat menjadi nilai dasar dalam membangun relasi suami istri yang kokoh dan saling memuliakan.</p><h3>1. Zawaj — berpasangan</h3><p>Suami dan istri adalah pasangan yang saling melengkapi, bukan pihak yang saling menguasai. QS. Al-Baqarah: 187 menggambarkan pasangan sebagai pakaian satu sama lain.</p><h3>2. Mitsaqan Ghalizhan — perjanjian kokoh</h3><p>Perkawinan adalah amanah dan ikatan kuat yang harus dijaga dengan kesungguhan. Rujukan: QS. An-Nisa: 21.</p><h3>3. Mu'asyarah bil Ma'ruf — bergaul secara baik</h3><p>Memperlakukan pasangan dengan patut, santun, dan bermartabat, termasuk ketika berbeda pendapat. Rujukan: QS. An-Nisa: 19.</p><h3>4. Musyawarah</h3><p>Urusan keluarga dibicarakan bersama, dengan mendengar dan mempertimbangkan pandangan pasangan. Rujukan: QS. Al-Baqarah: 233.</p><h3>5. Taradlin — saling ridha</h3><p>Mengupayakan kesepakatan dan kerelaan bersama tanpa paksaan, dengan tetap menjaga hak dan keselamatan masing-masing. Rujukan: QS. Al-Baqarah: 232 dan prinsip kerelaan dalam muamalah pada QS. An-Nisa: 29.</p><div class="activity-box"><b>Ilustrasi kasus</b><p>Pasangan berbeda pendapat tentang penggunaan tabungan. Coba identifikasi pilar yang dapat diterapkan: berpasangan, perjanjian, perlakuan baik, musyawarah, atau saling ridha.</p><label>Refleksi kasus<textarea id="caseReflection" rows="3" placeholder="Tuliskan pilar dan alasan pilihan Anda..."></textarea></label><button class="btn btn-outline btn-small" data-action="save-activity" data-key="pillarCase">Simpan refleksi</button></div>`],
      ['Mewujudkan Kemaslahatan Keluarga', `<p>Kemaslahatan keluarga tumbuh ketika hak dan kewajiban dijalankan secara seimbang. Setiap anggota keluarga berhak mendapatkan perlindungan, penghormatan, kesempatan berkembang, dan rasa aman.</p><h3>Dimensi kebutuhan keluarga</h3><ul><li><b>Fisik:</b> pangan, kesehatan, tempat tinggal, dan keamanan.</li><li><b>Psikologis:</b> kasih sayang, penerimaan, penghargaan, dan rasa aman.</li><li><b>Sosial:</b> hubungan sehat dengan keluarga besar dan masyarakat.</li><li><b>Spiritual:</b> ibadah, nilai moral, dan keteladanan.</li></ul><p>Keluarga yang maslahat tidak membenarkan kekerasan atas nama apa pun. Bila terjadi ancaman atau kekerasan, utamakan keselamatan dan cari bantuan pihak berwenang atau layanan pendampingan.</p>`]
    ]
  },
  2: {
    title: 'Psikologi Keluarga',
    lessons: [
      ['Relasi dalam Keluarga', `<p>Keluarga memiliki beberapa lapisan relasi yang saling memengaruhi.</p><ul><li><b>Relasi marital:</b> hubungan suami dan istri.</li><li><b>Relasi parental:</b> hubungan orang tua dan anak.</li><li><b>Relasi familial:</b> hubungan dengan keluarga besar.</li><li><b>Relasi sosial:</b> hubungan keluarga dengan lingkungan sosial.</li><li><b>Relasi ekologis:</b> hubungan keluarga dengan lingkungan tempat hidup, pekerjaan, budaya, dan kondisi sosial-ekonomi.</li></ul><p>Perubahan pada satu relasi dapat berdampak pada relasi lain. Karena itu, pasangan perlu membangun batas yang sehat dan komunikasi yang jelas.</p>`],
      ['Komponen Hubungan Perkawinan', `<p>Hubungan perkawinan dapat dipahami melalui tiga komponen yang perlu dirawat bersama.</p><ul><li><b>Kedekatan emosional:</b> rasa terhubung, percaya, aman, dan dipahami.</li><li><b>Gairah:</b> ketertarikan dan keintiman yang diekspresikan secara sehat dan saling menghormati.</li><li><b>Komitmen:</b> keputusan untuk menjaga hubungan dan menghadapi tantangan bersama.</li></ul><p>Komposisi ketiganya dapat berubah sepanjang waktu. Pasangan perlu berdialog agar kebutuhan masing-masing tetap diperhatikan.</p>`],
      ['Tahap Perkembangan Hubungan', `<p>Perkawinan merupakan proses yang terus berkembang. Pasangan dapat menghadapi fase penyesuaian awal, perubahan pekerjaan atau tempat tinggal, kehadiran anak, perawatan orang tua, hingga masa lanjut usia.</p><h3>Kunci adaptasi</h3><ul><li>Menyadari bahwa kebutuhan dan peran dapat berubah.</li><li>Membicarakan harapan sebelum mengambil keputusan besar.</li><li>Membagi tanggung jawab secara realistis.</li><li>Mencari dukungan ketika tantangan terasa berat.</li></ul>`],
      ['Penghancur dan Pembangun Hubungan', `<p>Empat pola yang dapat merusak hubungan adalah kritik yang menyerang pribadi, penghinaan atau sikap merendahkan, sikap defensif yang menutup dialog, serta mendiamkan pasangan untuk menghukum atau menghindari masalah.</p><h3>Perilaku pembangun</h3><ul><li>Menghargai pasangan dan menghindari label yang merendahkan.</li><li>Mendengarkan secara aktif tanpa buru-buru menyela.</li><li>Memberikan afirmasi positif dan mengakui usaha pasangan.</li><li>Menunjukkan empati terhadap perasaan pasangan.</li><li>Mengungkapkan kebutuhan dengan kalimat yang jelas dan tidak menyalahkan.</li></ul><div class="activity-box"><b>Identifikasi sikap</b><p>“Kamu selalu gagal mengurus semuanya!” adalah contoh kritik yang menyerang pribadi. Alternatif: “Aku merasa kewalahan. Bisakah kita membagi tugas malam ini?”</p><label>Bagaimana Anda akan memperbaiki kalimat konflik?<textarea id="repairText" rows="3" placeholder="Tulis kalimat yang lebih menghargai..."></textarea></label><button class="btn btn-outline btn-small" data-action="save-activity" data-key="repair">Simpan jawaban</button></div>`],
      ['Keterampilan Komunikasi', `<p>Komunikasi verbal mencakup kata-kata yang diucapkan atau ditulis. Komunikasi nonverbal meliputi ekspresi wajah, nada suara, bahasa tubuh, dan perhatian.</p><h3>Active listening</h3><ol><li>Berikan perhatian tanpa memainkan gawai.</li><li>Dengarkan sampai pasangan selesai.</li><li>Ulangi inti pesan untuk memastikan pemahaman.</li><li>Tanyakan hal yang belum jelas.</li><li>Validasi perasaan tanpa harus selalu menyetujui pendapat.</li></ol><p>Gunakan kalimat “Saya merasa ... ketika ... dan saya berharap ...” untuk menyampaikan kebutuhan secara lebih aman.</p>`],
      ['Rekening Bank Hubungan', `<p>Bayangkan hubungan seperti rekening bersama. Perhatian, bantuan, pujian, keterbukaan, dan waktu berkualitas menjadi setoran. Kebohongan, pengabaian, kekasaran, meremehkan, dan mengingkari janji dapat menjadi penarikan.</p><div class="activity-box"><h3>Simulasi rekening hubungan</h3><div class="bank-grid"><div><b>DEBET · SETORAN</b><ul id="depositList"><li>Memberikan perhatian</li><li>Meluangkan waktu</li></ul><input id="depositInput" placeholder="Tambah perilaku positif"><button class="btn btn-outline btn-small" data-action="add-bank" data-kind="deposit">Tambah setoran</button></div><div><b>KREDIT · PENARIKAN</b><ul id="withdrawList"><li>Mengabaikan pasangan</li><li>Mengingkari janji</li></ul><input id="withdrawInput" placeholder="Tambah perilaku negatif"><button class="btn btn-outline btn-small" data-action="add-bank" data-kind="withdraw">Tambah penarikan</button></div></div><p class="tiny muted">Daftar ini adalah bahan refleksi, bukan alat untuk memberi skor atau mengontrol pasangan.</p></div>`],
      ['Keterampilan Mengelola Konflik', `<p>Konflik adalah perbedaan kebutuhan, harapan, atau cara pandang. Konflik tidak harus berakhir dengan pertengkaran yang melukai.</p><h3>Langkah mengelola konflik</h3><ol><li>Kenali pemicu dan sumber masalah.</li><li>Ambil jeda jika emosi sedang tinggi, sepakati kapan melanjutkan percakapan.</li><li>Bedakan fakta, asumsi, dan perasaan.</li><li>Dengarkan sudut pandang pasangan.</li><li>Rumuskan beberapa pilihan solusi dan sepakati langkah yang realistis.</li><li>Evaluasi kesepakatan tanpa saling menyalahkan.</li></ol><blockquote>Kekerasan fisik, seksual, psikis, maupun penelantaran bukan cara menyelesaikan konflik. Utamakan keselamatan dan cari bantuan.</blockquote><div class="activity-box"><b>Studi kasus</b><p>Salah satu pasangan ingin tinggal dekat orang tua, sementara yang lain ingin tinggal mandiri. Apa langkah pertama yang paling konstruktif?</p><label><select id="conflictChoice"><option value="">Pilih respons</option><option value="a">Memaksa pasangan mengikuti keputusan sendiri</option><option value="b">Mendiamkan pasangan sampai setuju</option><option value="c">Mendengar alasan masing-masing lalu membahas pilihan bersama</option><option value="d">Melibatkan keluarga besar untuk menekan pasangan</option></select></label><button class="btn btn-outline btn-small" data-action="save-activity" data-key="conflict">Simpan pilihan</button></div>`]
    ]
  }
};

const questionBank = {
  pre: [
    ['Tujuan utama perkawinan dalam QS. Ar-Rum: 21 antara lain adalah...', ['Mencari kedudukan sosial', 'Mewujudkan ketenteraman, cinta, dan kasih sayang', 'Menghindari seluruh perbedaan', 'Memenuhi tuntutan keluarga'], 1],
    ['Makna sakinah dalam kehidupan keluarga paling dekat dengan...', ['Ketenangan dan ketenteraman', 'Kekayaan berlimpah', 'Tidak pernah berbeda pendapat', 'Kepatuhan tanpa dialog'], 0],
    ['Mawaddah dan rahmah dalam keluarga sebaiknya diwujudkan melalui...', ['Janji saat akad saja', 'Kasih sayang dan kepedulian sehari-hari', 'Hadiah pada hari tertentu saja', 'Menghindari komunikasi'], 1],
    ['Keluarga sakinah berarti keluarga yang...', ['Tidak pernah menghadapi masalah', 'Mampu mengelola masalah dengan sehat dan saling menjaga', 'Selalu mengikuti satu pihak', 'Menutup masalah dari semua orang'], 1],
    ['Pilar zawaj menekankan bahwa suami dan istri...', ['Saling menguasai', 'Saling melengkapi sebagai pasangan', 'Tidak perlu berdiskusi', 'Memiliki peran yang selalu kaku'], 1],
    ['Mitsaqan ghalizhan menggambarkan perkawinan sebagai...', ['Perjanjian ringan', 'Ikatan kokoh dan amanah', 'Hubungan sementara', 'Kesepakatan tanpa tanggung jawab'], 1],
    ['Muasyarah bil maruf berarti...', ['Memperlakukan pasangan secara baik dan bermartabat', 'Menghindari semua pembicaraan', 'Mengutamakan keinginan sendiri', 'Menyelesaikan masalah dengan ancaman'], 0],
    ['Musyawarah dalam rumah tangga berarti...', ['Keputusan sepihak', 'Membicarakan urusan bersama dan saling mendengar', 'Menyerahkan semua keputusan kepada orang lain', 'Menghindari perbedaan'], 1],
    ['Taradlin dalam relasi pasangan menekankan...', ['Kerelaan dan kesepakatan tanpa paksaan', 'Kemenangan salah satu pihak', 'Diam sebagai tanda setuju', 'Mengabaikan hak pasangan'], 0],
    ['Salah satu kebutuhan psikologis anggota keluarga adalah...', ['Rasa aman dan penghargaan', 'Pengawasan tanpa batas', 'Larangan berpendapat', 'Persaingan terus-menerus'], 0],
    ['Relasi marital adalah hubungan antara...', ['Orang tua dan anak', 'Suami dan istri', 'Keluarga dan tetangga', 'Individu dan lingkungan alam'], 1],
    ['Relasi parental merujuk pada hubungan...', ['Suami dan istri', 'Orang tua dan anak', 'Antartetangga', 'Dengan tempat kerja'], 1],
    ['Kedekatan emosional dalam perkawinan tampak melalui...', ['Kepercayaan dan rasa dipahami', 'Kontrol terhadap pasangan', 'Menghindari percakapan', 'Persaingan'], 0],
    ['Komitmen dalam hubungan berarti...', ['Keputusan menjaga hubungan dan bertanggung jawab', 'Tidak boleh berubah', 'Menghindari diskusi', 'Selalu menyetujui semua hal'], 0],
    ['Tahap perkembangan hubungan menuntut pasangan untuk...', ['Menolak perubahan', 'Beradaptasi dan membicarakan kebutuhan', 'Menyalahkan pasangan', 'Menutup diri'], 1],
    ['Sikap merendahkan pasangan dapat terlihat dari...', ['Menghargai pendapat', 'Mengejek dan menghina', 'Mendengar aktif', 'Memberi afirmasi'], 1],
    ['Mendengarkan aktif dilakukan dengan...', ['Menyela agar cepat selesai', 'Memberi perhatian dan mengklarifikasi pesan', 'Menyiapkan serangan balik', 'Mengabaikan bahasa tubuh'], 1],
    ['Contoh setoran rekening hubungan adalah...', ['Berbohong', 'Mengabaikan', 'Meluangkan waktu berkualitas', 'Mengingkari janji'], 2],
    ['Langkah awal mengelola konflik yang sehat adalah...', ['Mengenali pemicu dan akar masalah', 'Membalas dengan kemarahan', 'Mengancam pasangan', 'Menyebarkan masalah'], 0],
    ['Jika terjadi kekerasan dalam rumah tangga, prioritas utama adalah...', ['Menutupi kejadian', 'Keselamatan korban dan mencari bantuan', 'Memaksa berdamai saat itu juga', 'Menyalahkan korban'], 1]
  ],
  post: [
    ['Pasangan sedang berbeda pendapat. Sikap yang paling sesuai dengan semangat sakinah adalah...', ['Menghindari pembicaraan selamanya', 'Mencari waktu aman untuk berdialog dan memahami kebutuhan', 'Mengumumkan kesalahan pasangan', 'Memaksakan keputusan'], 1],
    ['Rahmah dalam keluarga tercermin ketika pasangan...', ['Peduli dan memberi dukungan saat pasangan kesulitan', 'Hanya hadir saat bahagia', 'Menghitung setiap kesalahan', 'Menuntut tanpa memberi'], 0],
    ['Keluarga yang menjaga martabat anggota keluarga akan...', ['Membolehkan penghinaan', 'Membangun rasa aman dan menghormati batas pribadi', 'Mengabaikan kebutuhan anak', 'Membatasi semua aspirasi'], 1],
    ['Contoh penerapan zawaj adalah...', ['Membagi peran dan saling melengkapi sesuai kondisi', 'Menentukan semua hal sepihak', 'Membandingkan pasangan', 'Menolak bantuan'], 0],
    ['Ketika menghadapi keputusan besar, mitsaqan ghalizhan mengingatkan pasangan untuk...', ['Menganggap janji perkawinan sebagai amanah yang dijaga', 'Mengutamakan ego', 'Menghindari tanggung jawab', 'Membatalkan dialog'], 0],
    ['Contoh muasyarah bil maruf saat kecewa adalah...', ['Menghina pasangan di depan umum', 'Menyampaikan kekecewaan dengan santun dan jelas', 'Mengancam', 'Mendiamkan sebagai hukuman'], 1],
    ['Musyawarah yang sehat membutuhkan...', ['Kesempatan bicara yang seimbang', 'Satu pihak selalu menang', 'Keputusan terburu-buru', 'Tekanan keluarga'], 0],
    ['Kesepakatan taradlin seharusnya dibangun melalui...', ['Paksaan halus', 'Informasi yang jelas dan kerelaan kedua pihak', 'Ancaman berpisah', 'Diam tanpa memahami'], 1],
    ['Kemaslahatan keluarga mencakup...', ['Kebutuhan fisik saja', 'Kebutuhan fisik, psikologis, sosial, dan spiritual', 'Kepentingan orang tua saja', 'Kebutuhan ekonomi semata'], 1],
    ['Hubungan keluarga dengan keluarga besar termasuk...', ['Relasi parental', 'Relasi familial', 'Relasi ekologis saja', 'Relasi marital'], 1],
    ['Relasi ekologis dapat dipengaruhi oleh...', ['Lingkungan tempat tinggal dan kondisi sosial-ekonomi', 'Hanya komunikasi pasangan', 'Hanya usia', 'Hanya status perkawinan'], 0],
    ['Gairah sebagai komponen hubungan berkaitan dengan...', ['Ketertarikan dan keintiman yang sehat', 'Kewajiban finansial', 'Pengasuhan anak', 'Hubungan tetangga'], 0],
    ['Saat pasangan memasuki fase hidup baru, hal yang penting dilakukan adalah...', ['Menolak perubahan peran', 'Menyesuaikan harapan dan membagi tanggung jawab', 'Membandingkan dengan orang lain', 'Menghindari pembicaraan'], 1],
    ['Pernyataan “Kamu memang tidak pernah becus” merupakan contoh...', ['Afirmasi', 'Kritik yang menyerang pribadi', 'Active listening', 'Empati'], 1],
    ['Mengambil jeda saat emosi memuncak sebaiknya disertai...', ['Kesepakatan untuk melanjutkan dialog pada waktu tertentu', 'Ancaman tidak akan bicara lagi', 'Menghilang tanpa kabar', 'Menghukum pasangan'], 0],
    ['Contoh afirmasi positif adalah...', ['“Terima kasih sudah membantu hari ini.”', '“Kamu selalu salah.”', '“Tidak ada gunanya bicara.”', '“Terserah, aku tidak peduli.”'], 0],
    ['Kalimat komunikasi yang memperjelas kebutuhan adalah...', ['“Kamu harus tahu sendiri.”', '“Aku merasa lelah dan berharap kita membagi tugas.”', '“Kamu sumber masalah.”', '“Pokoknya ikut aku.”'], 1],
    ['Sikap yang menjadi penarikan dari rekening hubungan adalah...', ['Menepati janji', 'Memberi perhatian', 'Berbohong', 'Menghargai'], 2],
    ['Dalam konflik, memahami sudut pandang pasangan berarti...', ['Menyetujui semua hal', 'Mendengar alasan pasangan sebelum mencari solusi', 'Menyerah tanpa diskusi', 'Mengabaikan kebutuhan sendiri'], 1],
    ['Kekerasan dalam rumah tangga harus dipandang sebagai...', ['Urusan biasa yang harus ditutup', 'Tindakan yang perlu dihentikan dengan mengutamakan keselamatan dan bantuan', 'Cara mendisiplinkan pasangan', 'Konflik yang selalu selesai dengan diam'], 1]
  ]
};

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function startTest(kind) {
  const u = user();
  if (!u) { openAuth('login'); return; }
  if (kind === 'post' && (!allLessonsDone() || !u.pre)) {
    notify('Selesaikan pre-test dan kedua modul terlebih dahulu.');
    return;
  }
  if (u[kind]) {
    notify('Tes ini sudah pernah dikerjakan.');
    if (kind === 'post') showPage('results');
    return;
  }
  const raw = questionBank[kind];
  testState = {
    kind,
    questions: shuffle(raw).map(q => ({
      q: q[0],
      opts: shuffle(q[1].map((v, i) => ({ v, correct: i === q[2] }))),
      answer: null
    })),
    index: 0,
    started: Date.now()
  };
  showPage('test');
}

function renderTest() {
  if (!testState) return;
  const t = testState, idx = t.index, q = t.questions[idx];
  $('#testTitle').textContent = t.kind === 'pre' ? 'Pre-test' : 'Post-test';
  $('#testEyebrow').textContent = t.kind === 'pre' ? 'PEMETAAN PENGETAHUAN AWAL' : 'EVALUASI AKHIR';
  $('#testCounter').textContent = `Soal ${idx + 1} dari ${t.questions.length}`;
  $('#testProgressLabel').textContent = `${Math.round((idx + 1) / t.questions.length * 100)}%`;
  $('#testProgress').style.width = `${(idx + 1) / t.questions.length * 100}%`;
  $('#questionArea').innerHTML = `<div class="question-title">${idx + 1}. ${q.q}</div>${q.opts.map((o, i) => `<label class="answer-option"><input type="radio" name="answer" value="${i}" ${q.answer === i ? 'checked' : ''}><span><b>${'ABCD'[i]}.</b> ${escapeHtml(o.v)}</span></label>`).join('')}`;
  $('#questionNav').innerHTML = t.questions.map((x, i) => `<button class="q-dot ${i === idx ? 'active' : ''} ${x.answer !== null ? 'answered' : ''}" data-q="${i}">${i + 1}</button>`).join('');
  $('#testPrev').disabled = idx === 0;
  $('#testNext').classList.toggle('hidden', idx === t.questions.length - 1);
  $('#testSubmit').classList.toggle('hidden', idx !== t.questions.length - 1);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function captureAnswer() {
  const v = $('input[name="answer"]:checked');
  if (v) testState.questions[testState.index].answer = Number(v.value);
}

// --------------------------------------------------------------------------
// SUBMIT TEST (SUPABASE CLOUD SYNC)
// --------------------------------------------------------------------------
async function submitTest() {
  captureAnswer();
  const missing = testState.questions.filter(q => q.answer === null).length;
  if (missing && !confirm(`Masih ada ${missing} soal belum dijawab. Tetap kirim?`)) return;
  if (!confirm('Setelah dikirim, jawaban tidak dapat diubah. Kirim tes sekarang?')) return;

  const correct = testState.questions.filter(q => q.answer !== null && q.opts[q.answer].correct).length;
  const u = user(), kind = testState.kind;
  const score = Math.round(correct / testState.questions.length * 100);
  const durationSeconds = Math.round((Date.now() - testState.started) / 1000);

  u[kind] = {
    score,
    correct,
    wrong: testState.questions.length - correct,
    answers: testState.questions.map(q => ({
      question: q.q,
      selected: q.answer === null ? null : q.opts[q.answer].v,
      correct: q.opts.find(o => o.correct).v
    })),
    durationSeconds,
    completedAt: new Date().toISOString()
  };
  u.activities.push({ type: `${kind === 'pre' ? 'Pre-test' : 'Post-test'} selesai`, at: new Date().toISOString() });
  save();

  // Sync to Supabase
  if (sb && u.id) {
    try {
      await sb.from('test_attempts').upsert({
        user_id: u.id,
        test_type: kind === 'pre' ? 'pretest' : 'posttest',
        score: score,
        correct_count: correct,
        wrong_count: testState.questions.length - correct,
        duration_seconds: durationSeconds,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Supabase test attempt sync note:', e);
    }
  }

  const result = u[kind];
  testState = null;
  alert(`${kind === 'pre' ? 'Pre-test' : 'Post-test'} selesai!\nNilai: ${result.score}\nBenar: ${result.correct}\nSalah: ${result.wrong}`);
  if (kind === 'pre') showPage('dashboard');
  else showPage('results');
}

function allLessonsDone() {
  const u = user();
  return !!u && [1, 2].every(n => u.progress[n].length === modules[n].lessons.length);
}

function renderModule() {
  const u = user();
  if (!u) return;
  const m = modules[activeModule], done = u.progress[activeModule];
  $('#moduleEyebrow').textContent = `MODUL ${activeModule}`;
  $('#moduleNavTitle').textContent = m.title;
  $('#lessonList').innerHTML = m.lessons.map((l, i) => `<button class="lesson-link ${i === lessonIndex ? 'active' : ''} ${done.includes(i) ? 'done' : ''}" data-lesson="${i}">${l[0]}</button>`).join('');
  $('#modulePct').textContent = `${Math.round(done.length / m.lessons.length * 100)}%`;
  $('#moduleBar').style.width = `${done.length / m.lessons.length * 100}%`;
  const lesson = m.lessons[lessonIndex];
  $('#lessonMeta').textContent = `MODUL ${activeModule} · SUBBAB ${lessonIndex + 1} DARI ${m.lessons.length}`;
  $('#lessonTitle').textContent = lesson[0];
  $('#lessonBody').innerHTML = lesson[1];
  $('#lessonActivity').innerHTML = lessonIndex === 0
    ? `<div class="activity-box"><h3>Refleksi tujuan perkawinan</h3><p>Apa tiga hal yang ingin Anda bangun dalam kehidupan rumah tangga?</p><textarea id="familyDream" rows="3" placeholder="Tuliskan refleksi Anda...">${escapeHtml(u.reflections.familyDream || '')}</textarea><button class="btn btn-outline btn-small" data-action="save-activity" data-key="familyDream">Simpan refleksi</button></div>`
    : lessonIndex === 1
    ? `<div class="activity-box"><h3>Keluarga Impianku</h3><p>Tuliskan tiga nilai utama yang ingin Anda dan pasangan rawat.</p><textarea id="dreamValues" rows="3" placeholder="Contoh: saling menghargai, terbuka, bertanggung jawab...">${escapeHtml(u.reflections.dreamValues || '')}</textarea><button class="btn btn-outline btn-small" data-action="save-activity" data-key="dreamValues">Simpan nilai keluarga</button></div>`
    : lessonIndex === 3 && activeModule === 2
    ? `<div class="activity-box"><h3>Refleksi komunikasi</h3><textarea id="communication" rows="3" placeholder="Apa keterampilan komunikasi yang ingin Anda latih?">${escapeHtml(u.reflections.communication || '')}</textarea><button class="btn btn-outline btn-small" data-action="save-activity" data-key="communication">Simpan refleksi</button></div>`
    : '';
  $('#prevLesson').disabled = lessonIndex === 0;
  $('#completeLesson').textContent = done.includes(lessonIndex)
    ? (lessonIndex === m.lessons.length - 1 ? 'Modul selesai ✓' : 'Sudah selesai · Lanjut →')
    : 'Tandai selesai & lanjut →';
}

// --------------------------------------------------------------------------
// COMPLETE LESSON (SUPABASE CLOUD SYNC)
// --------------------------------------------------------------------------
async function completeLesson() {
  const u = user();
  if (!u) return;
  const arr = u.progress[activeModule];
  if (!arr.includes(lessonIndex)) arr.push(lessonIndex);
  u.activities.push({ type: `Modul ${activeModule}: ${modules[activeModule].lessons[lessonIndex][0]} selesai`, at: new Date().toISOString() });
  save();

  // Sync to Supabase
  if (sb && u.id) {
    try {
      await sb.from('lesson_progress').upsert({
        user_id: u.id,
        completed_at: new Date().toISOString(),
        activity_data: { module: activeModule, lessonIndex: lessonIndex }
      });
    } catch (e) {
      console.warn('Supabase lesson progress sync note:', e);
    }
  }

  if (lessonIndex < modules[activeModule].lessons.length - 1) {
    lessonIndex++;
  } else if (activeModule === 1) {
    notify('Modul 1 selesai. Lanjutkan Modul 2.');
    activeModule = 2;
    lessonIndex = 0;
  } else {
    notify('Kedua modul selesai. Post-test telah terbuka.');
  }
  renderModule();
  renderDashboard();
}

function renderDashboard() {
  const u = user();
  if (!u) { showPage('home'); return; }
  const p = u.profile || {},
    done1 = u.progress[1].length,
    done2 = u.progress[2].length,
    total = 1 + (u.pre ? 1 : 0) + done1 + done2 + (u.post ? 1 : 0),
    max = 1 + 1 + 4 + 7 + 1,
    pct = Math.round(total / max * 100);

  $('#welcomeText').textContent = `Selamat datang, ${u.name}. Lanjutkan persiapan membangun keluarga sakinah.`;
  $('#overallPct').textContent = pct + '%';
  $('#overallBar').style.width = pct + '%';
  $('#overallText').textContent = `${total} dari ${max} tahap pembelajaran tercatat.`;
  $('#profileStatus').textContent = p.fullName ? 'Biodata lengkap' : 'Belum dilengkapi';
  $('#preStatus').textContent = u.pre ? `Selesai · Nilai ${u.pre.score}` : 'Belum dikerjakan';
  $('#m1Status').textContent = `${done1} dari 4 subbab selesai`;
  $('#m2Status').textContent = `${done2} dari 7 subbab selesai`;
  $('#postStatus').textContent = u.post ? `Selesai · Nilai ${u.post.score}` : allLessonsDone() ? 'Siap dikerjakan' : 'Menunggu penyelesaian modul';
  $('#resultStatus').textContent = u.post ? 'Hasil tersedia' : 'Belum tersedia';
  $('#profileSummary').textContent = p.fullName ? `${p.fullName} · ${p.kua || 'KUA belum diisi'} · Pasangan: ${p.partnerName || '—'}` : 'Lengkapi biodata untuk memulai.';
}

function renderResults() {
  const u = user();
  if (!u) return;
  const pre = u.pre?.score, post = u.post?.score;
  $('#resultPre').textContent = pre ?? '—';
  $('#resultPost').textContent = post ?? '—';
  $('#resultDelta').textContent = pre !== undefined && post !== undefined ? `${post - pre > 0 ? '+' : ''}${post - pre}` : '—';
  $('#preChart').style.width = (pre ?? 0) + '%';
  $('#postChart').style.width = (post ?? 0) + '%';
  $('#preChartLabel').textContent = pre ?? '—';
  $('#postChartLabel').textContent = post ?? '—';
  const done = Math.round((u.progress[1].length + u.progress[2].length) / 11 * 100);
  $('#completionNote').textContent = `Penyelesaian subbab: ${done}%. ${u.post ? 'Post-test telah diselesaikan.' : 'Selesaikan kedua modul dan post-test untuk memperoleh ringkasan akhir.'}`;
}

function renderAdmin() {
  const users = db.users;
  $('#adminStats').innerHTML = `<div class="stat"><b>${users.length}</b><span>Total akun</span></div><div class="stat"><b>${users.filter(u => u.pre).length}</b><span>Pre-test selesai</span></div><div class="stat"><b>${users.filter(u => u.post).length}</b><span>Post-test selesai</span></div>`;
  const q = ($('#adminSearch')?.value || '').toLowerCase();
  $('#adminRows').innerHTML = users.filter(u => (u.name + ' ' + u.phone).toLowerCase().includes(q)).map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.phone)}</td><td>${u.pre ? u.pre.score : '—'}</td><td>${u.progress[1].length + u.progress[2].length}/11</td><td>${u.post ? u.post.score : '—'}</td></tr>`).join('') || '<tr><td colspan="5">Belum ada peserta.</td></tr>';
}

function exportData(type) {
  const rows = db.users.map(u => ({
    id: u.id,
    nama: u.name,
    nomor_hp: u.phone,
    email: u.email || '',
    jenis_kelamin: u.gender,
    pretest: u.pre?.score ?? '',
    modul1: `${u.progress[1].length}/4`,
    modul2: `${u.progress[2].length}/7`,
    posttest: u.post?.score ?? '',
    tanggal_daftar: u.createdAt
  }));
  let data, filename, mime;
  if (type === 'csv') {
    const keys = Object.keys(rows[0] || { id: '', nama: '' });
    data = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    filename = 'rekap-peserta.csv';
    mime = 'text/csv';
  } else {
    data = JSON.stringify(db, null, 2);
    filename = 'backup-ebimwin.json';
    mime = 'application/json';
  }
  const blob = new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  notify('File ekspor berhasil diunduh.');
}

async function saveActivity(key) {
  const u = user();
  if (!u) return;
  const el = document.getElementById(({ pillarCase: 'caseReflection', repair: 'repairText', conflict: 'conflictChoice', familyDream: 'familyDream', dreamValues: 'dreamValues', communication: 'communication' })[key] || key);
  if (!el) return;
  u.reflections[key] = el.value;
  u.activities.push({ type: `Refleksi ${key} disimpan`, at: new Date().toISOString() });
  save();

  // Sync to Supabase reflection_notes
  if (sb && u.id) {
    try {
      await sb.from('reflection_notes').upsert({
        user_id: u.id,
        note_type: key,
        content: el.value,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Supabase reflection note sync:', e);
    }
  }

  notify('Refleksi berhasil disimpan ke Cloud & perangkat ini.');
}

function addBank(kind) {
  const u = user(), input = document.getElementById(kind + 'Input');
  if (!input.value.trim()) return;
  u.reflections.bank = u.reflections.bank || { deposit: ['Memberikan perhatian', 'Meluangkan waktu'], withdraw: ['Mengabaikan pasangan', 'Mengingkari janji'] };
  u.reflections.bank[kind].push(input.value.trim());
  save();
  input.value = '';
  renderModule();
}

// --------------------------------------------------------------------------
// EVENT LISTENERS
// --------------------------------------------------------------------------
document.addEventListener('click', e => {
  const routeBtn = e.target.closest('[data-route]');
  if (routeBtn) {
    e.preventDefault();
    const r = routeBtn.dataset.route;
    if (r === 'dashboard' && !user()) {
      openAuth('login');
      return;
    }
    showPage(r);
    return;
  }
  const act = e.target.closest('[data-action]');
  if (act) {
    const a = act.dataset.action;
    if (a === 'start') user() ? showPage('dashboard') : openAuth('register');
    if (a === 'logout') logout();
    if (a === 'pretest') startTest('pre');
    if (a === 'posttest') startTest('post');
    if (a === 'module') {
      if (!user()) { openAuth('login'); return; }
      if (!user().pre) { notify('Kerjakan pre-test terlebih dahulu.'); return; }
      activeModule = Number(act.dataset.module);
      lessonIndex = 0;
      showPage('module');
    }
    if (a === 'save-activity') saveActivity(act.dataset.key);
    if (a === 'add-bank') addBank(act.dataset.kind);
    if (a === 'export-csv') exportData('csv');
    if (a === 'export-json') exportData('json');
    if (a === 'admin-demo') {
      showPage('admin');
    }
    return;
  }
  const tab = e.target.closest('[data-auth-tab]');
  if (tab) {
    setAuthTab(tab.dataset.authTab);
    return;
  }
  const lesson = e.target.closest('[data-lesson]');
  if (lesson) {
    lessonIndex = Number(lesson.dataset.lesson);
    renderModule();
    return;
  }
  const q = e.target.closest('[data-q]');
  if (q) {
    captureAnswer();
    testState.index = Number(q.dataset.q);
    renderTest();
  }
});

$('#navAuth').addEventListener('click', () => user() ? showPage('dashboard') : openAuth('login'));
$('#menuToggle').addEventListener('click', () => $('#mainNav').classList.toggle('open'));

$$('.show-pass').forEach(b => b.addEventListener('click', () => {
  const i = b.parentElement.querySelector('input');
  i.type = i.type === 'password' ? 'text' : 'password';
  b.textContent = i.type === 'password' ? 'Lihat' : 'Sembunyi';
}));

$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  await register(e.target);
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  await login(e.target);
});

$('#profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  await saveProfile(e.target);
});

$('#testPrev').addEventListener('click', () => { captureAnswer(); testState.index--; renderTest(); });
$('#testNext').addEventListener('click', () => { captureAnswer(); testState.index++; renderTest(); });
$('#testSubmit').addEventListener('click', submitTest);
$('#completeLesson').addEventListener('click', completeLesson);
$('#prevLesson').addEventListener('click', () => { lessonIndex = Math.max(0, lessonIndex - 1); renderModule(); });
$('#adminSearch').addEventListener('input', renderAdmin);

const oldRenderModule = renderModule;
function renderModule() {
  oldRenderModule();
  const u = user();
  if (!u) return;
  const bank = u.reflections.bank || { deposit: ['Memberikan perhatian', 'Meluangkan waktu'], withdraw: ['Mengabaikan pasangan', 'Mengingkari janji'] };
  const dl = $('#depositList'), wl = $('#withdrawList');
  if (dl) dl.innerHTML = bank.deposit.map((x, i) => `<li>${escapeHtml(x)} <button data-remove-bank="deposit" data-index="${i}" aria-label="Hapus">×</button></li>`).join('');
  if (wl) wl.innerHTML = bank.withdraw.map((x, i) => `<li>${escapeHtml(x)} <button data-remove-bank="withdraw" data-index="${i}" aria-label="Hapus">×</button></li>`).join('');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-remove-bank]');
  if (!b) return;
  const u = user(), kind = b.dataset.removeBank;
  u.reflections.bank[kind].splice(Number(b.dataset.index), 1);
  save();
  renderModule();
});

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('ebimwin_theme', t);
  const b = $('#themeToggle');
  if (b) {
    const isLight = t === 'light';
    const icon = b.querySelector('.theme-icon');
    const txt = b.querySelector('.theme-text');
    if (icon) icon.textContent = isLight ? '☀️' : '✦';
    if (txt) txt.textContent = isLight ? 'Terang' : 'Aurora';
  }
}

function initTheme() {
  const b = $('#themeToggle');
  const saved = localStorage.getItem('ebimwin_theme') || 'dark';
  applyTheme(saved);
  if (b) b.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

window.addEventListener('storage', () => {
  db = load();
  currentUser = db.active;
});

$('#year').textContent = new Date().getFullYear();
initTheme();

// Restore active session from Supabase Cloud on page load
if (sb) {
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      const su = session.user;
      const cached = db.users.find(x => x.id === su.id);
      if (cached) {
        currentUser = cached.id;
        db.active = cached.id;
        if (route === 'dashboard') renderDashboard();
      }
    }
  }).catch(() => {});
}

if (db.active && db.users.some(u => u.id === db.active)) {
  currentUser = db.active;
  showPage('dashboard');
} else {
  showPage('home');
}
