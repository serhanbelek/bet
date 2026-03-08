'use strict';

/* ── DB ── */

const db = {
  get(key) {
    try {
      const item = localStorage.getItem(key);
      return item === null ? null : JSON.parse(item);
    } catch (e) {
      return null;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('localStorage set error:', e);
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

/* ── AUTH ── */

let currentUser = null;

function initAuth() {
  currentUser = db.get('current_user');
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;

  if (!username || !password) {
    showAuthError('login-error', 'Kullanıcı adı ve şifre gereklidir.');
    return;
  }

  const users = db.get('users') || [];
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    showAuthError('login-error', 'Kullanıcı adı veya şifre hatalı.');
    return;
  }

  currentUser = Object.assign({}, user);
  db.set('current_user', currentUser);
  showApp();
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  document.getElementById('register-error').hidden = true;

  if (!username || !email || !password || !password2) {
    showAuthError('register-error', 'Tüm alanları doldurunuz.');
    return;
  }
  if (username.length < 3) {
    showAuthError('register-error', 'Kullanıcı adı en az 3 karakter olmalıdır.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError('register-error', 'Geçerli bir e-posta adresi giriniz.');
    return;
  }
  if (password.length < 6) {
    showAuthError('register-error', 'Şifre en az 6 karakter olmalıdır.');
    return;
  }
  if (password !== password2) {
    showAuthError('register-error', 'Şifreler eşleşmiyor.');
    return;
  }

  const users = db.get('users') || [];
  if (users.find(u => u.username === username)) {
    showAuthError('register-error', 'Bu kullanıcı adı zaten kullanılıyor.');
    return;
  }
  if (users.find(u => u.email === email)) {
    showAuthError('register-error', 'Bu e-posta adresi zaten kullanılıyor.');
    return;
  }

  const newUser = {
    id: generateId(),
    username,
    email,
    password,
    role: 'member',
    favoriteCoupons: [],
    likedCoupons: [],
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  db.set('users', users);
  currentUser = Object.assign({}, newUser);
  db.set('current_user', currentUser);
  showApp();
  showToast('Hoş geldiniz, ' + sanitizeHTML(username) + '! 🎉', 'success');
}

function handleLogout() {
  currentUser = null;
  db.remove('current_user');
  currentModalCouponId = null;
  pendingConfirmAction = null;
  showAuthScreen();
  showToast('Çıkış yapıldı.', 'info');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fa-regular fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fa-regular fa-eye';
  }
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  const tabEl = document.querySelector('.auth-tab[data-tab="' + tab + '"]');
  if (tabEl) tabEl.classList.add('active');
  const formId = tab === 'login' ? 'login-form' : 'register-form';
  const formEl = document.getElementById(formId);
  if (formEl) formEl.classList.add('active');
  document.getElementById('login-error').hidden = true;
  document.getElementById('register-error').hidden = true;
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function showAuthScreen() {
  document.getElementById('auth-screen').hidden = false;
  document.getElementById('app').hidden = true;
  document.querySelectorAll('.modal-overlay').forEach(m => { m.hidden = true; });
  document.body.style.overflow = '';
}

function showApp() {
  document.getElementById('auth-screen').hidden = true;
  document.getElementById('app').hidden = false;
  document.getElementById('nav-username').textContent = currentUser.username;
  document.getElementById('nav-avatar').textContent = currentUser.username[0].toUpperCase();

  const bnavAdmin = document.getElementById('bnav-admin');
  if (bnavAdmin) bnavAdmin.hidden = currentUser.role !== 'admin';

  injectDesktopNavLinks();
  loadPreferences();
  updateNotifBadge();
  showView('feed');
}

function injectDesktopNavLinks() {
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  if (!navLinks.querySelector('[data-view="profile"]')) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="#" class="nav-link" data-view="profile" onclick="showView(\'profile\'); return false;"><i class="fa-solid fa-user"></i> Profil</a>';
    navLinks.appendChild(li);
  }

  const existingAdmin = navLinks.querySelector('[data-view="admin"]');
  if (currentUser.role === 'admin' && !existingAdmin) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="#" class="nav-link" data-view="admin" onclick="showView(\'admin\'); return false;"><i class="fa-solid fa-shield-halved"></i> Admin</a>';
    navLinks.appendChild(li);
  } else if (currentUser.role !== 'admin' && existingAdmin) {
    existingAdmin.closest('li').remove();
  }
}

function loadPreferences() {
  const savedFilter = db.get('pref_filter');
  const savedSort   = db.get('pref_sort');
  if (savedFilter) {
    state.filter = savedFilter;
    updateFilterButtons(savedFilter);
  }
  if (savedSort) {
    state.sort = savedSort;
    const sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = savedSort;
  }
}

/* ── STATE ── */

const state = {
  filter: 'all',
  sort: 'newest',
  search: '',
  page: 1,
  pageSize: 5,
  view: 'feed'
};

/* ── BOOT ── */

const SAMPLE_COUPONS = [
  {
    id: 'c1',
    title: 'Süper Lig Kombine',
    date: '2025-03-10',
    description: "Bu hafta Süper Lig'den güçlü kombinasyon",
    visibility: 'public',
    tags: ['kombinasyon', 'futbol'],
    status: 'won',
    totalOdds: 12.45,
    likes: ['uye1'],
    comments: [{ id: 'cm1', user: 'uye1', text: 'Harika kupon!', date: '2025-03-09' }],
    matches: [
      { home: 'Galatasaray', away: 'Fenerbahçe', league: 'Süper Lig', pick: '1', odds: 2.10 },
      { home: 'Beşiktaş', away: 'Trabzonspor', league: 'Süper Lig', pick: 'X', odds: 3.20 },
      { home: 'Başakşehir', away: 'Kasımpaşa', league: 'Süper Lig', pick: '2', odds: 1.85 }
    ],
    createdAt: '2025-03-08T10:00:00Z',
    author: 'admin'
  },
  {
    id: 'c2',
    title: 'Avrupa Ligleri Kombine',
    date: '2025-03-12',
    description: "İspanya, İngiltere ve İtalya'dan seçmeler",
    visibility: 'public',
    tags: ['futbol', 'kombinasyon'],
    status: 'lost',
    totalOdds: 8.75,
    likes: [],
    comments: [],
    matches: [
      { home: 'Real Madrid', away: 'Barcelona', league: 'La Liga', pick: '1', odds: 2.50 },
      { home: 'Arsenal', away: 'Chelsea', league: 'Premier Lig', pick: 'X', odds: 3.50 }
    ],
    createdAt: '2025-03-10T14:00:00Z',
    author: 'admin'
  },
  {
    id: 'c3',
    title: 'Haftasonu Büyük Kombine',
    date: '2025-06-15',
    description: 'Haftasonunun en iyi maçları bir arada!',
    visibility: 'public',
    tags: ['kombinasyon'],
    status: 'open',
    totalOdds: 15.20,
    likes: [],
    comments: [],
    matches: [
      { home: 'Fenerbahçe', away: 'Trabzonspor', league: 'Süper Lig', pick: '1', odds: 1.90 },
      { home: 'PSG', away: 'Marseille', league: 'Ligue 1', pick: '1', odds: 1.70 },
      { home: 'Bayern Münih', away: 'Dortmund', league: 'Bundesliga', pick: '1', odds: 1.85 },
      { home: 'Juventus', away: 'Milan', league: 'Serie A', pick: 'X', odds: 2.55 }
    ],
    createdAt: '2025-05-20T09:00:00Z',
    author: 'admin'
  },
  {
    id: 'c4',
    title: 'VIP Özel Kombine',
    date: '2025-06-16',
    description: 'Sadece VIP üyelere özel, analiz edilmiş kombine kupon.',
    visibility: 'vip',
    tags: ['kombinasyon', 'iddaa'],
    status: 'open',
    totalOdds: 22.40,
    likes: [],
    comments: [],
    matches: [
      { home: 'Atletico Madrid', away: 'Sevilla', league: 'La Liga', pick: '1', odds: 1.95 },
      { home: 'Liverpool', away: 'Man City', league: 'Premier Lig', pick: 'X', odds: 3.20 },
      { home: 'Inter', away: 'Napoli', league: 'Serie A', pick: '2', odds: 3.60 }
    ],
    createdAt: '2025-05-21T11:00:00Z',
    author: 'admin'
  },
  {
    id: 'c5',
    title: 'Uzun Vadeli Tahminler',
    date: '2025-03-15',
    description: 'Sezon sonu şampiyonluk tahminleri kombinasyonu',
    visibility: 'public',
    tags: ['iddaa', 'futbol'],
    status: 'won',
    totalOdds: 6.30,
    likes: ['uye1'],
    comments: [
      { id: 'cm2', user: 'uye1', text: 'Bu da tuttu, süper!', date: '2025-03-14' }
    ],
    matches: [
      { home: 'Galatasaray', away: '–', league: 'Süper Lig Şampiyonluk', pick: 'Şampiyon', odds: 2.10 },
      { home: 'Manchester City', away: '–', league: 'Premier Lig', pick: 'Top 3', odds: 1.70 },
      { home: 'Real Madrid', away: '–', league: 'La Liga', pick: 'Şampiyon', odds: 1.77 }
    ],
    createdAt: '2025-03-01T08:00:00Z',
    author: 'admin'
  }
];

function initDB() {
  if (!db.get('schema_version')) {
    db.set('schema_version', 2);
  }
}

function migrateSchema() {
  const version = db.get('schema_version') || 1;
  if (version < 2) {
    const users = db.get('users') || [];
    users.forEach(u => {
      if (!Array.isArray(u.favoriteCoupons)) u.favoriteCoupons = [];
      if (!Array.isArray(u.likedCoupons)) u.likedCoupons = [];
    });
    db.set('users', users);
    db.set('schema_version', 2);
  }
}

function seedDemoData() {
  const users = db.get('users');
  if (!users || users.length === 0) {
    db.set('users', [
      {
        id: 'u_admin',
        username: 'admin',
        email: 'admin@kuponpro.com',
        password: 'admin123',
        role: 'admin',
        favoriteCoupons: [],
        likedCoupons: [],
        createdAt: '2025-01-01T00:00:00Z'
      },
      {
        id: 'u_uye1',
        username: 'uye1',
        email: 'uye1@kuponpro.com',
        password: 'uye123',
        role: 'member',
        favoriteCoupons: ['c1'],
        likedCoupons: ['c1', 'c5'],
        createdAt: '2025-01-15T00:00:00Z'
      }
    ]);
  }

  if (!db.get('coupons') || (db.get('coupons') || []).length === 0) {
    db.set('coupons', SAMPLE_COUPONS);
  }

  if (!db.get('notifications')) {
    db.set('notifications', []);
  }
}

function loadTheme() {
  const saved = db.get('theme');
  const isLight = saved === 'light';
  document.body.classList.toggle('light', isLight);
  updateThemeIcon(isLight);
}

document.addEventListener('DOMContentLoaded', function () {
  initDB();
  migrateSchema();
  seedDemoData();
  loadTheme();
  initAuth();

  if (currentUser) {
    showApp();
  } else {
    showAuthScreen();
  }

  /* Username availability debounce on register form */
  const regUsernameInput = document.getElementById('reg-username');
  if (regUsernameInput) {
    const hint = document.createElement('small');
    hint.id = 'reg-username-hint';
    hint.className = 'form-hint';
    regUsernameInput.closest('.form-group').appendChild(hint);

    let usernameTimer = null;
    regUsernameInput.addEventListener('input', function () {
      const val = this.value.trim();
      hint.textContent = '';
      clearTimeout(usernameTimer);
      if (val.length < 3) return;
      usernameTimer = setTimeout(function () {
        const users = db.get('users') || [];
        const taken = users.some(u => u.username === val);
        hint.textContent = taken ? '❌ Bu kullanıcı adı alınmış.' : '✅ Kullanıcı adı uygun.';
        hint.style.color = taken ? '#ef4444' : '#22c55e';
      }, 500);
    });
  }

  /* Comment textarea char counter */
  const commentTextarea = document.getElementById('comment-text');
  const commentCharCount = document.getElementById('comment-char-count');
  if (commentTextarea && commentCharCount) {
    commentTextarea.addEventListener('input', function () {
      commentCharCount.textContent = this.value.length + '/500';
    });
  }

  /* Close notification panel on outside click */
  document.addEventListener('click', function (e) {
    const panel = document.getElementById('notification-panel');
    const btn   = document.getElementById('notif-btn');
    if (panel && !panel.hidden && btn && !btn.contains(e.target) && !panel.contains(e.target)) {
      panel.hidden = true;
    }
  });

  /* Close modals on overlay click */
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal(this.id);
    });
  });

  /* Ripple on button clicks */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button, .btn');
    if (btn) ripple(e, btn);
  });
});

/* ── NAV ── */

function showView(viewName) {
  if (viewName === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Bu alana erişim yetkiniz yok.', 'error');
    return;
  }

  ['feed', 'favorites', 'profile', 'admin'].forEach(function (v) {
    const el = document.getElementById(v + '-view');
    if (el) el.hidden = v !== viewName;
  });

  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  document.querySelectorAll('.bnav-item').forEach(function (item) {
    item.classList.toggle('active', item.dataset.bnav === viewName);
  });

  state.view = viewName;

  if (viewName === 'feed') {
    state.page = 1;
    renderFeed();
    updateFeedStats();
    updateLastWinner();
  } else if (viewName === 'favorites') {
    renderFavorites();
  } else if (viewName === 'profile') {
    renderProfile();
  } else if (viewName === 'admin') {
    renderAdminStats();
    renderAdminCouponList();
    const acMatches = document.getElementById('ac-matches');
    if (acMatches && acMatches.children.length === 0) addMatchRow('ac-matches');
  }
}

function setBottomNav(btn) {
  document.querySelectorAll('.bnav-item').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  db.set('theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon) icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function updateFilterButtons(filterValue) {
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.filter === filterValue);
  });
}

/* ── FEED ── */

let _searchTimer = null;

function renderFeed() {
  const feedEl     = document.getElementById('feed');
  const emptyEl    = document.getElementById('feed-empty');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const skeletonEl = document.getElementById('skeleton-container');
  const searchCountEl = document.getElementById('search-count');
  if (!feedEl) return;

  skeletonEl.hidden = false;
  feedEl.hidden = true;
  emptyEl.hidden = true;
  if (loadMoreBtn) loadMoreBtn.hidden = true;

  setTimeout(function () {
    skeletonEl.hidden = true;
    feedEl.hidden = false;

    const coupons = db.get('coupons') || [];
    let filtered = filterCoupons(coupons);

    if (state.search) {
      searchCountEl.hidden = false;
      searchCountEl.textContent = filtered.length + ' kupon bulundu';
    } else {
      searchCountEl.hidden = true;
    }

    filtered = sortCoupons(filtered);

    const total = filtered.length;
    const paged = filtered.slice(0, state.page * state.pageSize);

    if (paged.length === 0) {
      feedEl.innerHTML = '';
      emptyEl.hidden = false;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    feedEl.innerHTML = paged.map(buildCouponCard).join('');
    if (loadMoreBtn) loadMoreBtn.hidden = paged.length >= total;
  }, 300);
}

function filterCoupons(coupons) {
  return coupons.filter(function (c) {
    if (state.filter !== 'all') {
      if (state.filter === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const tStr = d.toISOString().split('T')[0];
        if (c.date !== tStr) return false;
      } else {
        if (c.status !== state.filter) return false;
      }
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      const inTitle  = (c.title || '').toLowerCase().includes(q);
      const inDesc   = (c.description || '').toLowerCase().includes(q);
      const inTags   = (c.tags || []).join(' ').toLowerCase().includes(q);
      const inTeams  = (c.matches || []).map(function (m) {
        return (m.home + ' ' + m.away + ' ' + (m.league || '')).toLowerCase();
      }).join(' ').includes(q);
      if (!inTitle && !inDesc && !inTags && !inTeams) return false;
    }

    return true;
  });
}

function sortCoupons(coupons) {
  const arr = coupons.slice();
  switch (state.sort) {
    case 'newest':
      arr.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      break;
    case 'highest-odds':
      arr.sort(function (a, b) { return (b.totalOdds || 0) - (a.totalOdds || 0); });
      break;
    case 'most-liked':
      arr.sort(function (a, b) { return (b.likes || []).length - (a.likes || []).length; });
      break;
    case 'most-commented':
      arr.sort(function (a, b) { return (b.comments || []).length - (a.comments || []).length; });
      break;
    default:
      arr.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }
  return arr;
}

function buildCouponCard(coupon) {
  const isRestricted   = coupon.visibility === 'vip' || coupon.visibility === 'members';
  const canViewContent = !isRestricted ||
    (currentUser && (currentUser.role === 'admin' || currentUser.role === 'vip'));

  const isLiked     = currentUser && (coupon.likes || []).includes(currentUser.username);
  const isFavorited = currentUser && (currentUser.favoriteCoupons || []).includes(coupon.id);

  const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
  const STATUS_CLASS = { won: 'status-won', lost: 'status-lost', open: 'status-open' };
  const statusLabel = STATUS_LABEL[coupon.status] || coupon.status;
  const statusCls   = STATUS_CLASS[coupon.status] || '';

  const tags = (coupon.tags || []).map(function (t) {
    return '<span class="tag-badge">' + sanitizeHTML(t) + '</span>';
  }).join('');

  const matchesToShow = (coupon.matches || []).slice(0, 3);
  const matchRows = matchesToShow.map(function (m) {
    return (
      '<div class="match-row">' +
        '<span class="match-teams">' + sanitizeHTML(m.home) + ' <span class="vs">vs</span> ' + sanitizeHTML(m.away) + '</span>' +
        '<span class="match-league">' + sanitizeHTML(m.league || '') + '</span>' +
        '<span class="match-pick">' + sanitizeHTML(m.pick) + '</span>' +
        '<span class="match-odds">' + parseFloat(m.odds).toFixed(2) + '</span>' +
      '</div>'
    );
  }).join('');

  const extraCount = (coupon.matches || []).length - 3;
  const extraMatchesHtml = extraCount > 0
    ? '<div class="extra-matches">+' + extraCount + ' maç daha</div>'
    : '';

  const titleText = state.search
    ? highlightText(sanitizeHTML(coupon.title || ''), state.search)
    : sanitizeHTML(coupon.title || '');

  const vipOverlay = (isRestricted && !canViewContent)
    ? '<div class="vip-overlay" onclick="showToast(\'VIP üyelik gerekiyor\', \'error\')">' +
        '<i class="fa-solid fa-lock"></i><span>VIP</span>' +
      '</div>'
    : '';

  const vipBadge = isRestricted
    ? '<span class="vip-badge"><i class="fa-solid fa-crown"></i> VIP</span>'
    : '';

  const winBar = coupon.status === 'won'
    ? '<div class="win-bar"></div>'
    : '';

  const descHtml = coupon.description
    ? '<p class="card-description">' + sanitizeHTML(coupon.description) + '</p>'
    : '';

  return (
    '<article class="coupon-card" data-id="' + coupon.id + '" data-status="' + (coupon.status || 'open') + '">' +
      '<div class="card-header">' +
        '<div class="card-title-row">' +
          '<h3 class="card-title">' + titleText + '</h3>' +
          '<div class="card-badges">' + tags + vipBadge +
            '<span class="status-badge ' + statusCls + '">' + statusLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<span class="card-date"><i class="fa-regular fa-calendar"></i> ' + formatDate(coupon.date) + '</span>' +
      '</div>' +
      descHtml +
      '<div class="card-matches' + (!canViewContent ? ' blurred' : '') + '">' +
        matchRows + extraMatchesHtml +
      '</div>' +
      '<div class="card-footer">' +
        '<div class="card-odds">' +
          '<i class="fa-solid fa-chart-line"></i> Toplam Oran: <strong>' + parseFloat(coupon.totalOdds || 0).toFixed(2) + '</strong>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="action-btn like-btn' + (isLiked ? ' liked' : '') + '" data-like="' + coupon.id + '" ' +
            'onclick="toggleLikeById(\'' + coupon.id + '\')" title="Beğen" aria-label="Beğen">' +
            '<i class="' + (isLiked ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i>' +
            '<span class="like-count">' + (coupon.likes || []).length + '</span>' +
          '</button>' +
          '<button class="action-btn fav-btn' + (isFavorited ? ' favorited' : '') + '" data-fav="' + coupon.id + '" ' +
            'onclick="toggleFavoriteById(\'' + coupon.id + '\')" title="Favoriye Ekle" aria-label="Favoriye Ekle">' +
            '<i class="' + (isFavorited ? 'fa-solid' : 'fa-regular') + ' fa-bookmark"></i>' +
          '</button>' +
          '<button class="action-btn" onclick="openDetailModal(\'' + coupon.id + '\')" title="Yorumlar" aria-label="Yorumlar">' +
            '<i class="fa-regular fa-comment"></i>' +
            '<span>' + (coupon.comments || []).length + '</span>' +
          '</button>' +
          '<button class="action-btn detail-btn" onclick="openDetailModal(\'' + coupon.id + '\')" title="Detay">' +
            '<i class="fa-solid fa-arrow-up-right-from-square"></i> Detay' +
          '</button>' +
        '</div>' +
      '</div>' +
      vipOverlay +
      winBar +
    '</article>'
  );
}

function handleSearch(value) {
  state.search = value;
  state.page = 1;
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.hidden = !value;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(renderFeed, 300);
}

function clearSearch() {
  state.search = '';
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) clearBtn.hidden = true;
  state.page = 1;
  renderFeed();
}

function handleSort(value) {
  state.sort = value;
  state.page = 1;
  db.set('pref_sort', value);
  renderFeed();
}

function handleFilter(filter, btn) {
  state.filter = filter;
  state.page = 1;
  db.set('pref_filter', filter);
  updateFilterButtons(filter);
  renderFeed();
}

function loadMoreCoupons() {
  state.page++;
  const coupons = db.get('coupons') || [];
  let filtered  = filterCoupons(coupons);
  filtered = sortCoupons(filtered);

  const paged   = filtered.slice(0, state.page * state.pageSize);
  const feedEl  = document.getElementById('feed');
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (!feedEl) return;

  const existingIds = new Set(
    Array.from(feedEl.querySelectorAll('.coupon-card')).map(function (el) { return el.dataset.id; })
  );
  const newCoupons = paged.filter(function (c) { return !existingIds.has(c.id); });
  feedEl.insertAdjacentHTML('beforeend', newCoupons.map(buildCouponCard).join(''));
  if (loadMoreBtn) loadMoreBtn.hidden = paged.length >= filtered.length;
}

function updateFeedStats() {
  const coupons  = db.get('coupons') || [];
  const total    = coupons.length;
  const won      = coupons.filter(function (c) { return c.status === 'won'; }).length;
  const lost     = coupons.filter(function (c) { return c.status === 'lost'; }).length;
  const settled  = won + lost;
  const winRate  = settled > 0 ? Math.round((won / settled) * 100) : 0;
  const avgOdds  = total > 0
    ? (coupons.reduce(function (a, c) { return a + (parseFloat(c.totalOdds) || 0); }, 0) / total).toFixed(2)
    : '0.00';

  const elTotal   = document.getElementById('stat-total');
  const elWinrate = document.getElementById('stat-winrate');
  const elOdds    = document.getElementById('stat-odds');
  const elRoi     = document.getElementById('stat-roi');

  if (elTotal)   elTotal.textContent   = total;
  if (elWinrate) elWinrate.textContent = '%' + winRate;
  if (elOdds)    elOdds.textContent    = avgOdds;
  if (elRoi)     elRoi.textContent     = '%' + winRate;
}

function updateLastWinner() {
  const el = document.getElementById('last-winner-content');
  if (!el) return;
  const coupons = db.get('coupons') || [];
  const wonList = coupons
    .filter(function (c) { return c.status === 'won'; })
    .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  if (wonList.length === 0) {
    el.innerHTML = '<span class="winner-placeholder">Henüz kazanan kupon yok</span>';
    return;
  }
  const last = wonList[0];
  el.innerHTML =
    '<strong>' + sanitizeHTML(last.title) + '</strong>' +
    '<span class="winner-odds"> · Oran: ' + parseFloat(last.totalOdds).toFixed(2) + '</span>' +
    '<span class="winner-date"> · ' + formatDate(last.date) + '</span>';
}

/* ── FAVORITES ── */

function renderFavorites() {
  const feedEl  = document.getElementById('favorites-feed');
  const emptyEl = document.getElementById('favorites-empty');
  if (!feedEl || !currentUser) return;

  const favIds   = currentUser.favoriteCoupons || [];
  const coupons  = db.get('coupons') || [];
  const favList  = coupons.filter(function (c) { return favIds.includes(c.id); });

  if (favList.length === 0) {
    feedEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  feedEl.innerHTML = favList.map(buildCouponCard).join('');
}

function toggleFavoriteById(couponId) {
  if (!currentUser) return;

  const favs = currentUser.favoriteCoupons || [];
  const idx  = favs.indexOf(couponId);
  let isFavorited;

  if (idx > -1) {
    favs.splice(idx, 1);
    isFavorited = false;
  } else {
    favs.push(couponId);
    isFavorited = true;
  }

  currentUser.favoriteCoupons = favs;
  db.set('current_user', currentUser);

  const users   = db.get('users') || [];
  const userIdx = users.findIndex(function (u) { return u.username === currentUser.username; });
  if (userIdx > -1) {
    users[userIdx].favoriteCoupons = favs;
    db.set('users', users);
  }

  updateFavUI(couponId, isFavorited);

  if (currentModalCouponId === couponId) {
    const favBtn = document.getElementById('detail-fav-btn');
    if (favBtn) {
      favBtn.classList.toggle('favorited', isFavorited);
      favBtn.innerHTML =
        '<i class="' + (isFavorited ? 'fa-solid' : 'fa-regular') + ' fa-bookmark"></i> ' +
        (isFavorited ? 'Favoriden Çıkar' : 'Favoriye Ekle');
    }
  }

  showToast(isFavorited ? 'Favorilere eklendi ⭐' : 'Favorilerden çıkarıldı', 'info');
}

function updateFavUI(couponId, isFavorited) {
  document.querySelectorAll('[data-fav="' + couponId + '"]').forEach(function (btn) {
    btn.classList.toggle('favorited', isFavorited);
    const icon = btn.querySelector('i');
    if (icon) icon.className = isFavorited ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
  });
}

/* ── LIKES ── */

function toggleLikeById(couponId) {
  if (!currentUser) return;

  const coupons = db.get('coupons') || [];
  const idx     = coupons.findIndex(function (c) { return c.id === couponId; });
  if (idx === -1) return;

  const coupon   = coupons[idx];
  coupon.likes   = coupon.likes || [];
  const likedIdx = coupon.likes.indexOf(currentUser.username);
  let isLiked;

  if (likedIdx > -1) {
    coupon.likes.splice(likedIdx, 1);
    currentUser.likedCoupons = (currentUser.likedCoupons || []).filter(function (id) { return id !== couponId; });
    isLiked = false;
  } else {
    coupon.likes.push(currentUser.username);
    if (!currentUser.likedCoupons) currentUser.likedCoupons = [];
    currentUser.likedCoupons.push(couponId);
    isLiked = true;
  }

  coupons[idx] = coupon;
  db.set('coupons', coupons);
  db.set('current_user', currentUser);

  const users   = db.get('users') || [];
  const userIdx = users.findIndex(function (u) { return u.username === currentUser.username; });
  if (userIdx > -1) {
    users[userIdx].likedCoupons = currentUser.likedCoupons;
    db.set('users', users);
  }

  updateLikeUI(couponId, coupon.likes.length, isLiked);
}

function updateLikeUI(couponId, count, isLiked) {
  document.querySelectorAll('[data-like="' + couponId + '"]').forEach(function (btn) {
    btn.classList.toggle('liked', isLiked);
    const icon = btn.querySelector('i');
    if (icon) icon.className = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const countEl = btn.querySelector('.like-count');
    if (countEl) countEl.textContent = count;
  });

  if (currentModalCouponId === couponId) {
    const likeBtn   = document.getElementById('detail-like-btn');
    const likeCount = document.getElementById('detail-like-count');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLiked);
      const icon = likeBtn.querySelector('i');
      if (icon) icon.className = isLiked ? 'fa-solid fa-thumbs-up' : 'fa-regular fa-thumbs-up';
    }
    if (likeCount) likeCount.textContent = count;
  }
}

/* ── MODAL ── */

let currentModalCouponId = null;
let pendingConfirmAction  = null;

function openDetailModal(couponId) {
  const coupons = db.get('coupons') || [];
  const coupon  = coupons.find(function (c) { return c.id === couponId; });
  if (!coupon) return;

  currentModalCouponId = couponId;

  const isRestricted   = coupon.visibility === 'vip' || coupon.visibility === 'members';
  const canViewContent = !isRestricted ||
    (currentUser && (currentUser.role === 'admin' || currentUser.role === 'vip'));

  const modal    = document.getElementById('detail-modal');
  const titleEl  = document.getElementById('detail-modal-title');
  const metaEl   = document.getElementById('detail-meta');
  const descEl   = document.getElementById('detail-description');
  const matchesEl = document.getElementById('detail-matches');
  const likeBtn  = document.getElementById('detail-like-btn');
  const likeCount = document.getElementById('detail-like-count');
  const favBtn   = document.getElementById('detail-fav-btn');
  const commentAvatar = document.getElementById('comment-avatar');

  if (!modal) return;

  /* Title */
  titleEl.textContent = coupon.title;

  /* Meta */
  const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
  const STATUS_CLASS = { won: 'status-won', lost: 'status-lost', open: 'status-open' };
  const tagsHtml = (coupon.tags || []).map(function (t) {
    return '<span class="tag-badge">' + sanitizeHTML(t) + '</span>';
  }).join('');

  metaEl.innerHTML =
    '<div class="meta-row">' +
      '<span><i class="fa-regular fa-calendar"></i> ' + formatDate(coupon.date) + '</span>' +
      '<span class="status-badge ' + (STATUS_CLASS[coupon.status] || '') + '">' +
        (STATUS_LABEL[coupon.status] || coupon.status) +
      '</span>' +
      '<span><i class="fa-solid fa-chart-line"></i> Oran: <strong>' +
        parseFloat(coupon.totalOdds || 0).toFixed(2) +
      '</strong></span>' +
    '</div>' +
    '<div class="meta-tags">' + tagsHtml + '</div>' +
    '<div class="meta-author"><i class="fa-solid fa-user"></i> ' + sanitizeHTML(coupon.author || 'admin') + '</div>';

  /* Description */
  if (coupon.description) {
    descEl.hidden = false;
    descEl.textContent = coupon.description;
  } else {
    descEl.hidden = true;
  }

  /* Matches table */
  if (!canViewContent) {
    matchesEl.innerHTML =
      '<tr><td colspan="5" class="vip-blur-row">' +
        '<i class="fa-solid fa-lock"></i> VIP İçerik – Erişim Kısıtlı' +
      '</td></tr>';
  } else {
    const resultIcon = coupon.status === 'won' ? '✅' : coupon.status === 'lost' ? '❌' : '–';
    matchesEl.innerHTML = (coupon.matches || []).map(function (m) {
      return (
        '<tr>' +
          '<td>' + sanitizeHTML(m.home) + '<br><small class="league-name">' + sanitizeHTML(m.league || '') + '</small></td>' +
          '<td>' + sanitizeHTML(m.away) + '</td>' +
          '<td><span class="pick-badge">' + sanitizeHTML(m.pick) + '</span></td>' +
          '<td>' + parseFloat(m.odds).toFixed(2) + '</td>' +
          '<td>' + resultIcon + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  /* Like button */
  const isLiked = currentUser && (coupon.likes || []).includes(currentUser.username);
  if (likeBtn) {
    likeBtn.classList.toggle('liked', isLiked);
    const icon = likeBtn.querySelector('i');
    if (icon) icon.className = isLiked ? 'fa-solid fa-thumbs-up' : 'fa-regular fa-thumbs-up';
  }
  if (likeCount) likeCount.textContent = (coupon.likes || []).length;

  /* Favorite button */
  const isFavorited = currentUser && (currentUser.favoriteCoupons || []).includes(couponId);
  if (favBtn) {
    favBtn.classList.toggle('favorited', isFavorited);
    favBtn.innerHTML =
      '<i class="' + (isFavorited ? 'fa-solid' : 'fa-regular') + ' fa-bookmark"></i> ' +
      (isFavorited ? 'Favoriden Çıkar' : 'Favoriye Ekle');
  }

  /* Comment avatar */
  if (commentAvatar && currentUser) {
    commentAvatar.textContent = currentUser.username[0].toUpperCase();
  }

  /* Reset comment form */
  const commentForm = document.getElementById('comment-form');
  if (commentForm) commentForm.reset();
  const charCountEl = document.getElementById('comment-char-count');
  if (charCountEl) charCountEl.textContent = '0/500';

  renderComments(coupon);

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.hidden = true;
  if (modalId === 'detail-modal') {
    currentModalCouponId = null;
    document.body.style.overflow = '';
  }
  if (modalId === 'edit-modal' || modalId === 'confirm-modal') {
    document.body.style.overflow = '';
  }
}

function toggleLike() {
  if (currentModalCouponId) toggleLikeById(currentModalCouponId);
}

function toggleFavorite() {
  if (currentModalCouponId) toggleFavoriteById(currentModalCouponId);
}

function shareCoupon() {
  if (!currentModalCouponId) return;
  const url = window.location.origin + window.location.pathname + '?coupon=' + currentModalCouponId;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () {
      showToast('Bağlantı panoya kopyalandı! 🔗', 'success');
    }).catch(function () {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
  showToast('Bağlantı kopyalandı!', 'success');
}

function openConfirmModal(message, action) {
  const modal  = document.getElementById('confirm-modal');
  const msgEl  = document.getElementById('confirm-modal-message');
  if (msgEl) msgEl.textContent = message;
  pendingConfirmAction = action;
  if (modal) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function confirmAction() {
  if (typeof pendingConfirmAction === 'function') {
    pendingConfirmAction();
  }
  pendingConfirmAction = null;
  closeModal('confirm-modal');
}

/* ── COMMENTS ── */

function renderComments(coupon) {
  const listEl  = document.getElementById('comments-list');
  const emptyEl = document.getElementById('comments-empty');
  const countEl = document.getElementById('detail-comment-count');
  if (!listEl) return;

  const comments = coupon.comments || [];
  if (countEl) countEl.textContent = comments.length;

  if (comments.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const isAdmin = currentUser && currentUser.role === 'admin';

  listEl.innerHTML = comments.map(function (cm) {
    const deleteBtn = isAdmin
      ? '<button class="icon-btn delete-comment-btn" onclick="deleteComment(\'' + coupon.id + '\',\'' + cm.id + '\')" title="Yorumu sil" aria-label="Yorumu sil"><i class="fa-solid fa-trash"></i></button>'
      : '';
    return (
      '<div class="comment-item" data-comment-id="' + cm.id + '">' +
        '<div class="comment-header">' +
          '<div class="comment-meta">' +
            '<span class="comment-avatar-sm">' + sanitizeHTML((cm.user || 'U')[0].toUpperCase()) + '</span>' +
            '<strong class="comment-author">' + sanitizeHTML(cm.user) + '</strong>' +
            '<span class="comment-date">' + formatDate(cm.date) + '</span>' +
          '</div>' +
          deleteBtn +
        '</div>' +
        '<p class="comment-text">' + sanitizeHTML(cm.text) + '</p>' +
      '</div>'
    );
  }).join('');
}

function handleAddComment(e) {
  e.preventDefault();
  if (!currentUser || !currentModalCouponId) return;

  const textarea = document.getElementById('comment-text');
  const text = textarea ? textarea.value.trim() : '';
  if (!text) {
    showToast('Yorum boş olamaz.', 'error');
    return;
  }

  const coupons = db.get('coupons') || [];
  const idx = coupons.findIndex(function (c) { return c.id === currentModalCouponId; });
  if (idx === -1) return;

  const comment = {
    id: generateId(),
    user: currentUser.username,
    text: text,
    date: new Date().toISOString().split('T')[0]
  };

  coupons[idx].comments = coupons[idx].comments || [];
  coupons[idx].comments.push(comment);
  db.set('coupons', coupons);

  renderComments(coupons[idx]);

  if (textarea) textarea.value = '';
  const charCountEl = document.getElementById('comment-char-count');
  if (charCountEl) charCountEl.textContent = '0/500';

  /* Update comment count badge on any visible card */
  document.querySelectorAll('.coupon-card[data-id="' + currentModalCouponId + '"]').forEach(function (card) {
    const spans = card.querySelectorAll('.action-btn span');
    spans.forEach(function (sp) {
      const btn = sp.closest('.action-btn');
      if (btn && btn.querySelector('.fa-comment')) sp.textContent = coupons[idx].comments.length;
    });
  });

  showToast('Yorumunuz eklendi!', 'success');
}

function deleteComment(couponId, commentId) {
  if (!currentUser || currentUser.role !== 'admin') return;

  openConfirmModal('Bu yorumu silmek istediğinizden emin misiniz?', function () {
    const coupons = db.get('coupons') || [];
    const idx = coupons.findIndex(function (c) { return c.id === couponId; });
    if (idx === -1) return;

    coupons[idx].comments = (coupons[idx].comments || []).filter(function (cm) {
      return cm.id !== commentId;
    });
    db.set('coupons', coupons);
    renderComments(coupons[idx]);

    document.querySelectorAll('.coupon-card[data-id="' + couponId + '"]').forEach(function (card) {
      card.querySelectorAll('.action-btn').forEach(function (btn) {
        if (btn.querySelector('.fa-comment')) {
          const sp = btn.querySelector('span');
          if (sp) sp.textContent = coupons[idx].comments.length;
        }
      });
    });

    showToast('Yorum silindi.', 'info');
  });
}

/* ── PROFILE ── */

function renderProfile() {
  if (!currentUser) return;

  const coupons = db.get('coupons') || [];

  const likedCount   = (currentUser.likedCoupons || []).length;
  const favCount     = (currentUser.favoriteCoupons || []).length;
  const commentCount = coupons.reduce(function (acc, c) {
    return acc + (c.comments || []).filter(function (cm) { return cm.user === currentUser.username; }).length;
  }, 0);

  const avatarEl   = document.getElementById('profile-avatar-lg');
  const usernameEl = document.getElementById('profile-username-display');
  const roleEl     = document.getElementById('profile-role-badge');
  const pLikes     = document.getElementById('pstat-likes');
  const pComments  = document.getElementById('pstat-comments');
  const pCoupons   = document.getElementById('pstat-coupons');

  if (avatarEl)   avatarEl.textContent   = currentUser.username[0].toUpperCase();
  if (usernameEl) usernameEl.textContent = currentUser.username;
  if (roleEl) {
    const ROLE_MAP = { admin: 'Yönetici', vip: 'VIP Üye', member: 'Üye' };
    roleEl.textContent = ROLE_MAP[currentUser.role] || 'Üye';
    roleEl.className = 'role-badge role-' + currentUser.role;
  }
  if (pLikes)    pLikes.textContent    = likedCount;
  if (pComments) pComments.textContent = commentCount;
  if (pCoupons)  pCoupons.textContent  = favCount;

  renderActivityGraph();
}

function switchProfileTab(tab, btn) {
  document.querySelectorAll('.profile-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.profile-tab-content').forEach(function (c) {
    c.classList.remove('active');
    c.hidden = true;
  });
  if (btn) btn.classList.add('active');
  const content = document.getElementById('ptab-' + tab);
  if (content) {
    content.classList.add('active');
    content.hidden = false;
  }
  if (tab === 'liked')    renderLikedCoupons();
  if (tab === 'activity') renderActivityGraph();
}

function renderActivityGraph() {
  const barsEl   = document.getElementById('activity-bars');
  const labelsEl = document.getElementById('activity-labels');
  if (!barsEl || !labelsEl || !currentUser) return;

  const coupons = db.get('coupons') || [];
  const days = [];
  for (var i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const activity = days.map(function (day) {
    var count = 0;
    coupons.forEach(function (c) {
      (c.comments || []).forEach(function (cm) {
        if (cm.user === currentUser.username && cm.date === day) count++;
      });
    });
    return { day: day, count: count };
  });

  const maxCount    = Math.max.apply(null, activity.map(function (a) { return a.count; }).concat([1]));
  const spacing     = 54;
  const barWidth    = 32;
  const maxBarH     = 76;
  const baseY       = 100;
  const startX      = 44;
  const DAYS_TR     = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  barsEl.innerHTML   = '';
  labelsEl.innerHTML = '';

  activity.forEach(function (a, i) {
    const cx      = startX + i * spacing + barWidth / 2;
    const barH    = Math.max(4, Math.round((a.count / maxCount) * maxBarH));
    const barY    = baseY - barH;

    /* Bar */
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', startX + i * spacing);
    rect.setAttribute('y', barY);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barH);
    rect.setAttribute('rx', '5');
    rect.setAttribute('class', 'activity-bar');
    barsEl.appendChild(rect);

    /* Count label above bar */
    if (a.count > 0) {
      const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valText.setAttribute('x', cx);
      valText.setAttribute('y', barY - 4);
      valText.setAttribute('text-anchor', 'middle');
      valText.setAttribute('class', 'bar-value-label');
      valText.textContent = a.count;
      barsEl.appendChild(valText);
    }

    /* Day label */
    const dayDate  = new Date(a.day + 'T00:00:00');
    const dayLabel = DAYS_TR[dayDate.getDay()];
    const dateStr  = dayDate.getDate() + '/' + (dayDate.getMonth() + 1);

    const t1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t1.setAttribute('x', cx);
    t1.setAttribute('y', baseY + 14);
    t1.setAttribute('text-anchor', 'middle');
    t1.setAttribute('class', 'axis-label');
    t1.textContent = dayLabel;
    labelsEl.appendChild(t1);

    const t2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t2.setAttribute('x', cx);
    t2.setAttribute('y', baseY + 26);
    t2.setAttribute('text-anchor', 'middle');
    t2.setAttribute('class', 'axis-label-sm');
    t2.textContent = dateStr;
    labelsEl.appendChild(t2);
  });
}

function renderLikedCoupons() {
  const listEl  = document.getElementById('liked-coupons-list');
  const emptyEl = document.getElementById('liked-empty');
  if (!listEl || !currentUser) return;

  const likedIds = currentUser.likedCoupons || [];
  const coupons  = db.get('coupons') || [];
  const liked    = coupons.filter(function (c) { return likedIds.includes(c.id); });

  if (liked.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
  const STATUS_CLASS = { won: 'status-won', lost: 'status-lost', open: 'status-open' };

  listEl.innerHTML = liked.map(function (c) {
    return (
      '<li class="liked-coupon-item" onclick="openDetailModal(\'' + c.id + '\')">' +
        '<div class="liked-coupon-title">' + sanitizeHTML(c.title) + '</div>' +
        '<div class="liked-coupon-meta">' +
          '<span class="status-badge ' + (STATUS_CLASS[c.status] || '') + '">' +
            (STATUS_LABEL[c.status] || c.status) +
          '</span>' +
          '<span>' + formatDate(c.date) + '</span>' +
          '<span>Oran: ' + parseFloat(c.totalOdds || 0).toFixed(2) + '</span>' +
        '</div>' +
      '</li>'
    );
  }).join('');
}

function handleChangePassword(e) {
  e.preventDefault();
  const current  = document.getElementById('cp-current').value;
  const newPw    = document.getElementById('cp-new').value;
  const confirm  = document.getElementById('cp-confirm').value;
  const errEl    = document.getElementById('cp-error');
  const succEl   = document.getElementById('cp-success');

  errEl.hidden  = true;
  succEl.hidden = true;

  if (!current || !newPw || !confirm) {
    errEl.textContent = 'Tüm alanları doldurunuz.';
    errEl.hidden = false;
    return;
  }
  if (current !== currentUser.password) {
    errEl.textContent = 'Mevcut şifre hatalı.';
    errEl.hidden = false;
    return;
  }
  if (newPw.length < 6) {
    errEl.textContent = 'Yeni şifre en az 6 karakter olmalıdır.';
    errEl.hidden = false;
    return;
  }
  if (newPw !== confirm) {
    errEl.textContent = 'Yeni şifreler eşleşmiyor.';
    errEl.hidden = false;
    return;
  }

  currentUser.password = newPw;
  db.set('current_user', currentUser);

  const users   = db.get('users') || [];
  const userIdx = users.findIndex(function (u) { return u.username === currentUser.username; });
  if (userIdx > -1) {
    users[userIdx].password = newPw;
    db.set('users', users);
  }

  succEl.textContent = 'Şifreniz başarıyla güncellendi!';
  succEl.hidden = false;
  document.getElementById('change-password-form').reset();
  showToast('Şifre güncellendi! ✅', 'success');
}

/* ── NOTIFICATIONS ── */

function addNotification(type, message) {
  const notifs = db.get('notifications') || [];
  notifs.unshift({ id: generateId(), type: type, message: message, read: false, createdAt: new Date().toISOString() });
  if (notifs.length > 20) notifs.length = 20;
  db.set('notifications', notifs);
  updateNotifBadge();
}

function updateNotifBadge() {
  const notifs  = db.get('notifications') || [];
  const unread  = notifs.filter(function (n) { return !n.read; }).length;
  const badge   = document.getElementById('notif-badge');
  if (badge) {
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : unread;
  }
}

function toggleNotificationPanel() {
  const panel = document.getElementById('notification-panel');
  if (!panel) return;
  if (panel.hidden) {
    panel.hidden = false;
    renderNotifications();
    markAllNotifsRead();
  } else {
    panel.hidden = true;
  }
}

function renderNotifications() {
  const listEl  = document.getElementById('notif-list');
  const emptyEl = document.getElementById('notif-empty');
  if (!listEl) return;

  const notifs = (db.get('notifications') || []).slice(0, 10);
  if (notifs.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const ICON_MAP = {
    new_coupon: 'fa-ticket',
    coupon_won: 'fa-trophy',
    coupon_lost: 'fa-circle-xmark'
  };

  listEl.innerHTML = notifs.map(function (n) {
    const iconClass = ICON_MAP[n.type] || 'fa-bell';
    return (
      '<li class="notif-item' + (n.read ? '' : ' unread') + '">' +
        '<div class="notif-icon notif-' + sanitizeHTML(n.type) + '">' +
          '<i class="fa-solid ' + iconClass + '"></i>' +
        '</div>' +
        '<div class="notif-body">' +
          '<p class="notif-message">' + sanitizeHTML(n.message) + '</p>' +
          '<span class="notif-time">' + formatNotifTime(n.createdAt) + '</span>' +
        '</div>' +
      '</li>'
    );
  }).join('');
}

function markAllNotifsRead() {
  const notifs = db.get('notifications') || [];
  notifs.forEach(function (n) { n.read = true; });
  db.set('notifications', notifs);
  updateNotifBadge();
}

function clearAllNotifications() {
  db.set('notifications', []);
  renderNotifications();
  updateNotifBadge();
  const panel = document.getElementById('notification-panel');
  if (panel) panel.hidden = true;
  showToast('Tüm bildirimler temizlendi.', 'info');
}

function formatNotifTime(dateStr) {
  return formatRelativeTime(dateStr);
}

/* ── ADMIN ── */

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.admin-tab-content').forEach(function (c) {
    c.classList.remove('active');
    c.hidden = true;
  });
  if (btn) btn.classList.add('active');
  const content = document.getElementById('atab-' + tab);
  if (content) {
    content.classList.add('active');
    content.hidden = false;
  }
  if (tab === 'manage-coupons') renderAdminCouponList();
  if (tab === 'stats')          renderAdminStats();
  if (tab === 'add-coupon') {
    const acMatches = document.getElementById('ac-matches');
    if (acMatches && acMatches.children.length === 0) addMatchRow('ac-matches');
  }
}

function addMatchRow(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'match-input-row';
  row.innerHTML =
    '<input type="text"   class="form-input match-home"   placeholder="Ev Sahibi" required />' +
    '<input type="text"   class="form-input match-away"   placeholder="Deplasman" required />' +
    '<input type="text"   class="form-input match-league" placeholder="Lig" />' +
    '<input type="text"   class="form-input match-pick"   placeholder="Tahmin (1/X/2)" required />' +
    '<input type="number" class="form-input match-odds"   placeholder="Oran" step="0.01" min="1.01" required />' +
    '<button type="button" class="btn btn-sm btn-danger remove-match-btn" onclick="removeMatchRow(this)" aria-label="Maçı Sil">' +
      '<i class="fa-solid fa-trash"></i>' +
    '</button>';

  container.appendChild(row);
}

function removeMatchRow(btn) {
  const row = btn.closest('.match-input-row');
  if (row) row.remove();
}

function collectMatchRows(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const rows   = container.querySelectorAll('.match-input-row');
  const result = [];

  for (var i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const home   = (row.querySelector('.match-home')   || {}).value || '';
    const away   = (row.querySelector('.match-away')   || {}).value || '';
    const league = (row.querySelector('.match-league') || {}).value || '';
    const pick   = (row.querySelector('.match-pick')   || {}).value || '';
    const odds   = parseFloat((row.querySelector('.match-odds') || {}).value || '0');

    if (!home.trim() || !away.trim() || !pick.trim() || isNaN(odds) || odds < 1.01) {
      return null; /* validation failed */
    }
    result.push({ home: home.trim(), away: away.trim(), league: league.trim(), pick: pick.trim(), odds: odds });
  }
  return result.length > 0 ? result : null;
}

function showFormError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function handleAddCoupon(e) {
  e.preventDefault();
  const errEl = document.getElementById('add-coupon-error');
  if (errEl) errEl.hidden = true;

  const title       = (document.getElementById('ac-title')       || {}).value || '';
  const date        = (document.getElementById('ac-date')        || {}).value || '';
  const description = (document.getElementById('ac-description') || {}).value || '';
  const visibility  = (document.getElementById('ac-visibility')  || {}).value || 'public';
  const tagsSelect  = document.getElementById('ac-tags');
  const tags        = tagsSelect ? Array.from(tagsSelect.selectedOptions).map(function (o) { return o.value; }) : [];

  if (!title.trim()) {
    showFormError('add-coupon-error', 'Kupon başlığı gereklidir.');
    return;
  }
  if (!date) {
    showFormError('add-coupon-error', 'Tarih seçiniz.');
    return;
  }

  const matchContainer = document.getElementById('ac-matches');
  if (!matchContainer || matchContainer.querySelectorAll('.match-input-row').length === 0) {
    showFormError('add-coupon-error', 'En az bir maç ekleyiniz.');
    return;
  }

  const matches = collectMatchRows('ac-matches');
  if (!matches) {
    showFormError('add-coupon-error', 'Tüm maç alanlarını eksiksiz doldurunuz (oran ≥ 1.01).');
    return;
  }

  const totalOdds = parseFloat(matches.reduce(function (acc, m) { return acc * m.odds; }, 1).toFixed(2));

  const coupon = {
    id: generateId(),
    title: title.trim(),
    date: date,
    description: description.trim(),
    visibility: visibility,
    tags: tags,
    status: 'open',
    totalOdds: totalOdds,
    likes: [],
    comments: [],
    matches: matches,
    createdAt: new Date().toISOString(),
    author: currentUser.username
  };

  const coupons = db.get('coupons') || [];
  coupons.unshift(coupon);
  db.set('coupons', coupons);

  addNotification('new_coupon', 'Yeni kupon eklendi: "' + coupon.title + '"');

  if (state.view === 'feed') {
    state.page = 1;
    renderFeed();
    updateFeedStats();
    updateLastWinner();
  }

  renderAdminCouponList();
  renderAdminStats();
  resetAddCouponForm();
  showToast('Kupon başarıyla eklendi! 🎉', 'success');
}

function resetAddCouponForm() {
  const form = document.getElementById('add-coupon-form');
  if (form) form.reset();
  const matchContainer = document.getElementById('ac-matches');
  if (matchContainer) {
    matchContainer.innerHTML = '';
    addMatchRow('ac-matches');
  }
  const errEl = document.getElementById('add-coupon-error');
  if (errEl) errEl.hidden = true;
}

function renderAdminCouponList() {
  const listEl  = document.getElementById('admin-coupon-list');
  const emptyEl = document.getElementById('admin-coupon-empty');
  if (!listEl) return;

  const coupons = db.get('coupons') || [];

  if (coupons.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
  const STATUS_CLASS = { won: 'status-won', lost: 'status-lost', open: 'status-open' };

  listEl.innerHTML = coupons.map(function (c) {
    return (
      '<div class="admin-coupon-row" data-id="' + c.id + '">' +
        '<div class="admin-coupon-info">' +
          '<span class="admin-coupon-title">' + sanitizeHTML(c.title) + '</span>' +
          '<span class="admin-coupon-meta">' + formatDate(c.date) +
            ' · ' + (c.matches || []).length + ' maç · Oran: ' + parseFloat(c.totalOdds || 0).toFixed(2) +
          '</span>' +
        '</div>' +
        '<div class="admin-coupon-controls">' +
          '<span class="status-badge ' + (STATUS_CLASS[c.status] || '') + '">' + (STATUS_LABEL[c.status] || c.status) + '</span>' +
          '<button class="btn btn-xs btn-success" onclick="changeStatus(\'' + c.id + '\',\'won\')" title="Kazandı olarak işaretle">' +
            '<i class="fa-solid fa-check"></i> Kazandı' +
          '</button>' +
          '<button class="btn btn-xs btn-danger" onclick="changeStatus(\'' + c.id + '\',\'lost\')" title="Kaybetti olarak işaretle">' +
            '<i class="fa-solid fa-xmark"></i> Kaybetti' +
          '</button>' +
          '<button class="btn btn-xs btn-outline" onclick="changeStatus(\'' + c.id + '\',\'open\')" title="Açık olarak işaretle">' +
            '<i class="fa-solid fa-hourglass-half"></i> Açık' +
          '</button>' +
          '<button class="btn btn-xs btn-outline" onclick="openEditModal(\'' + c.id + '\')" title="Düzenle">' +
            '<i class="fa-solid fa-pen-to-square"></i>' +
          '</button>' +
          '<button class="btn btn-xs btn-danger" onclick="deleteCoupon(\'' + c.id + '\')" title="Sil">' +
            '<i class="fa-solid fa-trash"></i>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

function changeStatus(couponId, newStatus) {
  const coupons = db.get('coupons') || [];
  const idx = coupons.findIndex(function (c) { return c.id === couponId; });
  if (idx === -1) return;

  const oldStatus = coupons[idx].status;
  coupons[idx].status = newStatus;
  db.set('coupons', coupons);

  if (newStatus === 'won' && oldStatus !== 'won') {
    addNotification('coupon_won', '"' + coupons[idx].title + '" kuponu kazandı! 🏆');
  } else if (newStatus === 'lost' && oldStatus !== 'lost') {
    addNotification('coupon_lost', '"' + coupons[idx].title + '" kuponu kaybetti.');
  }

  renderAdminCouponList();
  renderAdminStats();

  if (state.view === 'feed') {
    renderFeed();
    updateFeedStats();
    updateLastWinner();
  }

  const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
  showToast('Durum güncellendi: ' + (STATUS_LABEL[newStatus] || newStatus), 'success');
}

function deleteCoupon(couponId) {
  openConfirmModal('Bu kuponu silmek istediğinizden emin misiniz?', function () {
    var coupons = db.get('coupons') || [];
    coupons = coupons.filter(function (c) { return c.id !== couponId; });
    db.set('coupons', coupons);

    renderAdminCouponList();
    renderAdminStats();

    if (state.view === 'feed') {
      state.page = 1;
      renderFeed();
      updateFeedStats();
      updateLastWinner();
    }

    showToast('Kupon silindi.', 'info');
  });
}

function openEditModal(couponId) {
  const coupons = db.get('coupons') || [];
  const coupon  = coupons.find(function (c) { return c.id === couponId; });
  if (!coupon) return;

  document.getElementById('edit-coupon-id').value  = coupon.id;
  document.getElementById('edit-title').value       = coupon.title || '';
  document.getElementById('edit-date').value        = coupon.date || '';
  document.getElementById('edit-description').value = coupon.description || '';
  document.getElementById('edit-status').value      = coupon.status || 'open';

  const visEl = document.getElementById('edit-visibility');
  if (visEl) visEl.value = coupon.visibility || 'public';

  /* Tags multi-select */
  const tagsEl = document.getElementById('edit-tags');
  if (tagsEl) {
    const tagArr = coupon.tags || [];
    Array.from(tagsEl.options).forEach(function (opt) {
      opt.selected = tagArr.includes(opt.value);
    });
  }

  /* Populate match rows */
  const matchContainer = document.getElementById('edit-matches');
  if (matchContainer) {
    matchContainer.innerHTML = '';
    (coupon.matches || []).forEach(function (m) {
      addMatchRow('edit-matches');
      const rows = matchContainer.querySelectorAll('.match-input-row');
      const row  = rows[rows.length - 1];
      row.querySelector('.match-home').value   = m.home   || '';
      row.querySelector('.match-away').value   = m.away   || '';
      row.querySelector('.match-league').value = m.league || '';
      row.querySelector('.match-pick').value   = m.pick   || '';
      row.querySelector('.match-odds').value   = m.odds   || '';
    });
    if (matchContainer.children.length === 0) addMatchRow('edit-matches');
  }

  const errEl = document.getElementById('edit-coupon-error');
  if (errEl) errEl.hidden = true;

  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function handleEditCoupon(e) {
  e.preventDefault();
  const errEl = document.getElementById('edit-coupon-error');
  if (errEl) errEl.hidden = true;

  const couponId    = document.getElementById('edit-coupon-id').value;
  const title       = (document.getElementById('edit-title')       || {}).value || '';
  const date        = (document.getElementById('edit-date')        || {}).value || '';
  const description = (document.getElementById('edit-description') || {}).value || '';
  const visibility  = (document.getElementById('edit-visibility')  || {}).value || 'public';
  const status      = (document.getElementById('edit-status')      || {}).value || 'open';
  const tagsEl      = document.getElementById('edit-tags');
  const tags        = tagsEl ? Array.from(tagsEl.selectedOptions).map(function (o) { return o.value; }) : [];

  if (!title.trim()) {
    showFormError('edit-coupon-error', 'Kupon başlığı gereklidir.');
    return;
  }
  if (!date) {
    showFormError('edit-coupon-error', 'Tarih seçiniz.');
    return;
  }

  const matchContainer = document.getElementById('edit-matches');
  if (!matchContainer || matchContainer.querySelectorAll('.match-input-row').length === 0) {
    showFormError('edit-coupon-error', 'En az bir maç ekleyiniz.');
    return;
  }

  const matches = collectMatchRows('edit-matches');
  if (!matches) {
    showFormError('edit-coupon-error', 'Tüm maç alanlarını eksiksiz doldurunuz (oran ≥ 1.01).');
    return;
  }

  const totalOdds = parseFloat(matches.reduce(function (acc, m) { return acc * m.odds; }, 1).toFixed(2));

  const coupons = db.get('coupons') || [];
  const idx = coupons.findIndex(function (c) { return c.id === couponId; });
  if (idx === -1) { showFormError('edit-coupon-error', 'Kupon bulunamadı.'); return; }

  const oldStatus = coupons[idx].status;

  coupons[idx] = Object.assign(coupons[idx], {
    title: title.trim(),
    date: date,
    description: description.trim(),
    visibility: visibility,
    tags: tags,
    status: status,
    totalOdds: totalOdds,
    matches: matches
  });

  db.set('coupons', coupons);

  if (status === 'won' && oldStatus !== 'won') {
    addNotification('coupon_won', '"' + title.trim() + '" kuponu kazandı! 🏆');
  } else if (status === 'lost' && oldStatus !== 'lost') {
    addNotification('coupon_lost', '"' + title.trim() + '" kuponu kaybetti.');
  }

  closeModal('edit-modal');
  renderAdminCouponList();
  renderAdminStats();

  if (state.view === 'feed') {
    state.page = 1;
    renderFeed();
    updateFeedStats();
    updateLastWinner();
  }

  showToast('Kupon güncellendi! ✅', 'success');
}

function renderAdminStats() {
  const coupons = db.get('coupons') || [];
  const users   = db.get('users')   || [];

  const total    = coupons.length;
  const won      = coupons.filter(function (c) { return c.status === 'won'; }).length;
  const lost     = coupons.filter(function (c) { return c.status === 'lost'; }).length;
  const open     = coupons.filter(function (c) { return c.status === 'open'; }).length;
  const totalComments = coupons.reduce(function (acc, c) { return acc + (c.comments || []).length; }, 0);

  const set = function (id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set('astats-total',    total);
  set('astats-won',      won);
  set('astats-lost',     lost);
  set('astats-open',     open);
  set('astats-users',    users.length);
  set('astats-comments', totalComments);
}

function downloadCSV() {
  const coupons = db.get('coupons') || [];
  const rows = [['Başlık', 'Tarih', 'Durum', 'Toplam Oran', 'Beğeni', 'Yorum']];

  coupons.forEach(function (c) {
    const STATUS_LABEL = { won: 'Kazandı', lost: 'Kaybetti', open: 'Açık' };
    rows.push([
      csvEscape(c.title || ''),
      c.date || '',
      STATUS_LABEL[c.status] || c.status,
      parseFloat(c.totalOdds || 0).toFixed(2),
      (c.likes || []).length,
      (c.comments || []).length
    ]);
  });

  const csvContent = rows.map(function (r) { return r.join(','); }).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const today = new Date().toISOString().split('T')[0];

  const a = document.createElement('a');
  a.href = url;
  a.download = 'kuponpro-istatistik-' + today + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV indirildi!', 'success');
}

function csvEscape(str) {
  const s = String(str).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? '"' + s + '"' : s;
}

/* ── UTILS ── */

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;

  const ICON_MAP = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const iconClass = ICON_MAP[type] || 'fa-circle-info';

  toast.innerHTML =
    '<i class="fa-solid ' + iconClass + '"></i>' +
    '<span>' + sanitizeHTML(message) + '</span>' +
    '<button class="toast-close" aria-label="Kapat" onclick="this.closest(\'.toast\').remove()">' +
      '<i class="fa-solid fa-xmark"></i>' +
    '</button>';

  container.appendChild(toast);
  requestAnimationFrame(function () { toast.classList.add('toast-visible'); });

  setTimeout(function () {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  }, 3000);
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return dateStr;
  return d.getDate() + ' ' + MONTHS_TR[d.getMonth()] + ' ' + d.getFullYear();
}

function sanitizeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function ripple(e, target) {
  const btn = target || e.currentTarget;
  if (!btn) return;

  const existing = btn.querySelector('.ripple-el');
  if (existing) existing.remove();

  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x    = (e.clientX || rect.left + rect.width  / 2) - rect.left - size / 2;
  const y    = (e.clientY || rect.top  + rect.height / 2) - rect.top  - size / 2;

  const circle = document.createElement('span');
  circle.className = 'ripple-el';
  circle.style.cssText =
    'position:absolute;border-radius:50%;pointer-events:none;transform:scale(0);' +
    'background:rgba(255,255,255,0.25);animation:ripple-anim 0.55s linear;' +
    'width:' + size + 'px;height:' + size + 'px;left:' + x + 'px;top:' + y + 'px;';

  btn.style.overflow = 'hidden';
  btn.style.position = btn.style.position || 'relative';
  btn.appendChild(circle);
  setTimeout(function () { if (circle.parentNode) circle.parentNode.removeChild(circle); }, 600);
}

function highlightText(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
}

function debounce(fn, delay) {
  var timer = null;
  return function () {
    var args = arguments;
    var ctx  = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
  };
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now   = Date.now();
  const then  = new Date(dateStr).getTime();
  const diff  = now - then;

  if (isNaN(diff) || diff < 0) return formatDate(dateStr);

  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (mins < 1)   return 'Az önce';
  if (mins < 60)  return mins + ' dakika önce';
  if (hours < 24) return hours + ' saat önce';
  if (days < 7)   return days + ' gün önce';
  if (weeks < 4)  return weeks + ' hafta önce';
  return formatDate(dateStr);
}
