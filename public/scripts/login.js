async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
  
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        errorMessage.textContent = errorData.error || 'Invalid credentials';
        errorMessage.style.display = 'block';
        return;
      }
  
      // Redirect based on role
      const { role } = await response.json();
      if (role === 'admin') {
        window.location.href = '/admin';
      } else if (role === 'instructor') {
        window.location.href = '/instructor';
      } else if (role === 'student') {
        window.location.href = '/student';
      }
    } catch (error) {
      console.error('Login error:', error);
      errorMessage.textContent = 'An error occurred during login. Please try again.';
      errorMessage.style.display = 'block';
    }
  }
  
  document.getElementById('loginForm').addEventListener('submit', handleLogin);