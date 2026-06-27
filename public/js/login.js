document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const errorBox = document.getElementById('errorBox');
  const errorMessage = document.getElementById('errorMessage');

  // Check if already logged in, redirect to dashboard if token exists
  const token = localStorage.getItem('crm_token');
  if (token) {
    window.location.href = '/dashboard.html';
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset error box
    errorBox.classList.add('hidden');
    
    // Set loading state
    const originalBtnText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = `<span>Authorizing...</span> <i class="fas fa-spinner fa-spin"></i>`;

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Save token to localStorage
        localStorage.setItem('crm_token', result.token);
        
        // Redirect to dashboard
        window.location.href = '/dashboard.html';
      } else {
        // Show error message
        errorMessage.textContent = result.error || 'Authentication failed.';
        errorBox.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error during login:', error);
      errorMessage.textContent = 'Network error. Please make sure the server is online.';
      errorBox.classList.remove('hidden');
    } finally {
      // Reset button state
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalBtnText;
    }
  });
});
