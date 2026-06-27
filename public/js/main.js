document.addEventListener('DOMContentLoaded', () => {
  const leadForm = document.getElementById('leadForm');
  const submitBtn = document.getElementById('submitBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Submit Handler
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Set loading state
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Submitting...</span> <i class="fas fa-spinner fa-spin"></i>`;

    // Gather Form Data
    const formData = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      company: document.getElementById('company').value.trim(),
      source: document.getElementById('source').value,
      message: document.getElementById('message').value.trim()
    };

    try {
      // API call to Express backend
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('Success! Your proposal request was submitted.', 'success');
        leadForm.reset();
      } else {
        showToast(result.error || 'Something went wrong. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showToast('Connection failed. Please check if backend is running.', 'error');
    } finally {
      // Restore button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Helper function to render modern Toast notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    toast.innerHTML = `
      <i class="fas ${iconClass}"></i>
      <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    // Trigger animate-in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Remove after 5 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 5000);
  }
});
