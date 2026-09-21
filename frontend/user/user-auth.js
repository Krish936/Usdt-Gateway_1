const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : 'https://usdt-gateway-1-5.onrender.com/api';
    
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
});

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Logging in...';
    hideError();

    try {
        const res = await fetch(`${API_URL}/user/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem('userToken', data.data.token);
            localStorage.setItem('userData', JSON.stringify(data.data.user));
            window.location.href = 'user-dashboard.html';
        } else {
            showError(data.message || 'Login failed');
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    } catch (err) {
        showError('Cannot connect to server. Make sure backend is running.');
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');

    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (password !== confirm) {
        showError('Passwords do not match');
        return;
    }

    if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }

    const userData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Creating account...';
    hideError();

    try {
        const res = await fetch(`${API_URL}/user/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await res.json();

        if (data.success) {
            localStorage.setItem('userToken', data.data.token);
            localStorage.setItem('userData', JSON.stringify(data.data.user));
            window.location.href = 'user-dashboard.html';
        } else {
            showError(data.message || 'Registration failed');
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    } catch (err) {
        showError('Cannot connect to server. Make sure backend is running.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

function showError(msg) {
    const el = document.getElementById('errorMessage');
    if (!el) return;
    el.textContent = '⚠️ ' + msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
}

function hideError() {
    const el = document.getElementById('errorMessage');
    if (el) el.classList.remove('show');
}