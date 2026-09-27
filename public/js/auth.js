document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm') || document.getElementById('registerForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById('authError');
    errorBox.classList.add('d-none');
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      const endpoint = form.id === 'loginForm' ? '/api/auth/login' : '/api/auth/register';
      const response = await App.api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('teamconnect_token', response.token);
      location.href = '/dashboard';
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('d-none');
    } finally { submit.disabled = false; }
  });
});
