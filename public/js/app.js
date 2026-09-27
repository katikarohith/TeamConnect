/* Shared browser helpers: JWT API access, current user, notifications, and Socket.IO. */
window.App = (() => {
  let authPromise;
  let socket;
  let user;

  const getToken = () => localStorage.getItem('teamconnect_token');
  const clearSession = () => localStorage.removeItem('teamconnect_token');
  const initials = (name = '?') => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  const avatar = (person, className = 'avatar') => person?.profileImage
    ? `<img class="${className}" src="${escapeHtml(person.profileImage)}" alt="${escapeHtml(person.name || 'Profile')}">`
    : `<span class="${className} avatar-fallback">${initials(person?.name)}</span>`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);

  async function api(url, options = {}) {
    const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({ message: 'The server returned an unexpected response.' }));
    if (!response.ok) {
      if (response.status === 401 && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/register')) {
        clearSession();
        location.href = '/login';
      }
      const error = new Error(data.message || 'Request failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function requireAuth() {
    if (!getToken()) { location.href = '/login'; throw new Error('Please sign in.'); }
    if (!authPromise) authPromise = api('/api/auth/me').then((data) => { user = data.user; return user; }).catch((error) => { authPromise = null; throw error; });
    return authPromise;
  }

  function showToast(message, variant = 'primary') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${variant} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(toast);
    const instance = new bootstrap.Toast(toast, { delay: 4200 });
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
    instance.show();
  }

  function renderNotifications(notifications) {
    const menu = document.getElementById('notificationMenu');
    const badge = document.getElementById('notificationBadge');
    if (!menu || !badge) return;
    const unread = notifications.filter((notice) => !notice.read).length;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.toggle('d-none', unread === 0);
    menu.innerHTML = `<div class="p-3 border-bottom d-flex justify-content-between align-items-center"><strong>Notifications</strong>${unread ? '<button id="readAllNotifications" class="btn btn-link btn-sm p-0">Mark all read</button>' : ''}</div>` + (notifications.length ? notifications.slice(0, 8).map((notice) => `<a class="notification-item ${notice.read ? '' : 'unread'}" href="${escapeHtml(notice.link || '#')}" data-notification-id="${notice._id}"><span>${notice.actor ? escapeHtml(notice.actor.name) : 'TeamConnect'}</span><p>${escapeHtml(notice.text)}</p><small>${new Date(notice.createdAt).toLocaleString()}</small></a>`).join('') : '<div class="p-4 text-center text-secondary small">You’re all caught up.</div>');
    menu.querySelector('#readAllNotifications')?.addEventListener('click', async () => { await api('/api/notifications/read-all', { method: 'PATCH' }); loadNotifications(); });
    menu.querySelectorAll('[data-notification-id]').forEach((item) => item.addEventListener('click', () => api(`/api/notifications/${item.dataset.notificationId}/read`, { method: 'PATCH' }).catch(() => {})));
  }

  async function loadNotifications() {
    try { renderNotifications((await api('/api/notifications')).notifications); } catch (error) { /* Navigation stays usable if notifications fail. */ }
  }

  function connectSocket() {
    if (socket || !window.io || !getToken()) return socket;
    socket = window.io({ auth: { token: getToken() } });
    socket.on('connect_error', (error) => console.warn('Live updates unavailable:', error.message));
    socket.on('notification', (notification) => { showToast(notification.text, 'primary'); loadNotifications(); });
    socket.on('privateMessage', (message) => showToast(`${message.sender.name} sent you a private message.`, 'primary'));
    return socket;
  }

  function setupNavigation() {
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar && user) {
      if (user.profileImage) navAvatar.src = user.profileImage;
      else navAvatar.replaceWith(Object.assign(document.createElement('span'), { id: 'navAvatar', className: 'avatar avatar-fallback', textContent: initials(user.name) }));
    }
    document.getElementById('logoutButton')?.addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch (error) { /* JWT logout is client-side. */ } clearSession(); location.href = '/login'; });
    document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === location.pathname));
    loadNotifications();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const authPage = ['login', 'register'].includes(document.body.dataset.page);
    if (authPage) {
      if (getToken()) { try { await requireAuth(); location.href = '/dashboard'; } catch (error) { clearSession(); } }
      return;
    }
    try { await requireAuth(); setupNavigation(); connectSocket(); } catch (error) { /* api handles expired-session redirects. */ }
  });

  return { api, requireAuth, getToken, clearSession, connectSocket, get socket() { return socket; }, get user() { return user; }, avatar, initials, escapeHtml, showToast, loadNotifications };
})();
