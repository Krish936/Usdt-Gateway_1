const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : 'https://usdt-gateway-1-5.onrender.com/api';
const token = localStorage.getItem('userToken');
let user = JSON.parse(localStorage.getItem('userData') || '{}');
let allTransactions = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!token) {
        window.location.href = 'user-login.html';
        return;
    }

    hydrateUser();
    await loadPlatformInfo();
    await loadTransactions();

    const sellForm = document.getElementById('sellForm');
    if (sellForm) sellForm.addEventListener('submit', handleSell);

    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', (e) => {
            const amt = parseFloat(e.target.value) || 0;
            const rate = parseFloat(document.getElementById('rateDisplay')?.textContent) || 105;
            const preview = document.getElementById('inrPreview');
            if (preview) preview.textContent = '₹' + (amt * rate).toFixed(2);
        });
    }

    setInterval(loadTransactions, 30000);
});

function hydrateUser() {
    const name = user.fullName || 'User';

    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('avatar');
    const userAddrEl = document.getElementById('userAddress');

    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    if (userAddrEl) userAddrEl.value = user.walletAddress || '';

    const pFullName = document.getElementById('pFullName');
    const pEmail = document.getElementById('pEmail');
    const pPhone = document.getElementById('pPhone');
    const pWallet = document.getElementById('pWallet');

    if (pFullName) pFullName.value = user.fullName || '';
    if (pEmail) pEmail.value = user.email || '';
    if (pPhone) pPhone.value = user.phone || '';
    if (pWallet) pWallet.value = user.walletAddress || '';

    if (user.bankDetails) {
        const pBankHolder = document.getElementById('pBankHolder');
        const pBankName = document.getElementById('pBankName');
        const pAccountNumber = document.getElementById('pAccountNumber');
        const pIfsc = document.getElementById('pIfsc');

        if (pBankHolder) pBankHolder.value = user.bankDetails.accountHolderName || '';
        if (pBankName) pBankName.value = user.bankDetails.bankName || '';
        if (pAccountNumber) pAccountNumber.value = user.bankDetails.accountNumber || '';
        if (pIfsc) pIfsc.value = user.bankDetails.ifscCode || '';
    }
}

async function loadPlatformInfo() {
    try {
        const res = await fetch(API_URL + '/info');
        const data = await res.json();
        if (data.success) {
            const rateEl = document.getElementById('rateDisplay');
            const receiverEl = document.getElementById('receiverAddr');
            if (rateEl) rateEl.textContent = data.data.rate;
            if (receiverEl) receiverEl.textContent = data.data.receivingAddress;
        }
    } catch (e) {
        console.error('Platform info error:', e);
    }
}

async function loadTransactions() {
    try {
        const res = await fetch(API_URL + '/user/auth/transactions', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
            allTransactions = data.data || [];
            renderOverview();
            renderUSDTTransactions();
            renderINRTransactions();
        }
    } catch (e) {
        console.error('Transactions error:', e);
    }
}

function renderOverview() {
    const totalUSDT = allTransactions.reduce((s, t) => s + (t.amount || 0), 0);
    const totalINR = allTransactions
        .filter(t => t.status === 'completed')
        .reduce((s, t) => s + (t.amountInINR || 0), 0);

    const statUSDT = document.getElementById('statUSDT');
    const statINR = document.getElementById('statINR');
    const statTx = document.getElementById('statTx');
    const statKYC = document.getElementById('statKYC');

    if (statUSDT) statUSDT.textContent = totalUSDT.toFixed(2);
    if (statINR) statINR.textContent = '₹' + totalINR.toFixed(2);
    if (statTx) statTx.textContent = allTransactions.length;
    if (statKYC) statKYC.textContent = user.kycStatus || 'Pending';

    const recent = document.getElementById('recentTx');
    if (recent) renderTxList(recent, allTransactions.slice(0, 5));
}

function renderUSDTTransactions() {
    const container = document.getElementById('usdtTxList');
    if (container) renderTxList(container, allTransactions);
}

function renderINRTransactions() {
    const inrTx = allTransactions.filter(t => t.status === 'completed');
    const container = document.getElementById('inrTxList');
    if (container) renderTxList(container, inrTx, true);
}

function renderTxList(container, list, isINR) {
    if (isINR === undefined) isINR = false;

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>No transactions yet</p></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < list.length; i++) {
        const tx = list[i];
        const amountText = isINR ? '₹' + (tx.amountInINR || 0).toFixed(2) : tx.amount + ' USDT';
        const metaText = '₹' + (tx.amountInINR || 0).toFixed(2) + ' · ' + new Date(tx.createdAt).toLocaleString();
        const hashText = (tx.txHash || '').slice(0, 30) + '...';

        html += '<div class="tx-item">' +
            '<div class="tx-info">' +
            '<div class="amount">' + amountText + '</div>' +
            '<div class="meta">' + metaText + '</div>' +
            '<div class="hash">' + hashText + '</div>' +
            '</div>' +
            '<div class="status-pill status-' + tx.status + '">' + tx.status + '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

async function handleSell(e) {
    e.preventDefault();

    const btn = document.getElementById('sellBtn');
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');

    const userAddressInput = document.getElementById('userAddress').value.trim();
    const txHash = document.getElementById('txHash').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);

    if (!userAddressInput || userAddressInput.indexOf('0x') !== 0 || userAddressInput.length !== 42) {
        alert('Please enter a valid BSC wallet address (starts with 0x, 42 chars)');
        return;
    }

    if (!txHash || txHash.indexOf('0x') !== 0) {
        alert('Please enter a valid transaction hash');
        return;
    }

    if (!amount || amount < 10 || amount > 1000) {
        alert('Amount must be between 10 and 1000 USDT');
        return;
    }

    if (!currentUser.email || !currentUser.phone) {
        alert('Session expired. Please logout and login again.');
        return;
    }

    const bankDetails = {
        accountHolderName: document.getElementById('accountHolderName').value.trim(),
        bankName: document.getElementById('bankName').value.trim(),
        accountNumber: document.getElementById('accountNumber').value.trim(),
        ifscCode: document.getElementById('ifscCode').value.trim()
    };

    if (!bankDetails.accountHolderName || !bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
        alert('Please fill all bank details');
        return;
    }

    const payload = {
        txHash: txHash,
        amount: amount,
        userAddress: userAddressInput,
        email: currentUser.email,
        phone: currentUser.phone,
        bankDetails: bankDetails
    };

    console.log('Sending deposit:', payload);

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Submitting...';
    }

    try {
        const res = await fetch(API_URL + '/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('Response:', data);

        if (data.success) {
            user.walletAddress = userAddressInput;
            user.bankDetails = bankDetails;
            localStorage.setItem('userData', JSON.stringify(user));

            const modalMsg = document.getElementById('modalMessage');
            if (modalMsg) {
                modalMsg.textContent = 'You will receive Rs.' + (data.data.amountInINR || 0).toFixed(2) + ' within 24 hours.';
            }
            const modal = document.getElementById('successModal');
            if (modal) modal.classList.add('show');

            const sellForm = document.getElementById('sellForm');
            if (sellForm) sellForm.reset();

            const preview = document.getElementById('inrPreview');
            if (preview) preview.textContent = 'Rs.0';

            const userAddrEl = document.getElementById('userAddress');
            if (userAddrEl) userAddrEl.value = userAddressInput;

            await loadTransactions();
        } else {
            alert('Error: ' + (data.message || 'Deposit failed'));
        }
    } catch (err) {
        console.error('Deposit error:', err);
        alert('Network error. Please try again.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Submit Deposit';
        }
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const updates = {
        fullName: document.getElementById('pFullName').value.trim(),
        phone: document.getElementById('pPhone').value.trim(),
        email: document.getElementById('pEmail').value.trim(),
        bankDetails: {
            accountHolderName: document.getElementById('pBankHolder').value.trim(),
            bankName: document.getElementById('pBankName').value.trim(),
            accountNumber: document.getElementById('pAccountNumber').value.trim(),
            ifscCode: document.getElementById('pIfsc').value.trim()
        }
    };

    try {
        const res = await fetch(API_URL + '/user/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(updates)
        });

        const data = await res.json();

        if (data.success) {
            user = Object.assign({}, user, updates);
            localStorage.setItem('userData', JSON.stringify(user));
            alert('Profile updated successfully!');
        } else {
            alert('Error: ' + (data.message || 'Failed to update'));
        }
    } catch (err) {
        console.error('Profile error:', err);
        alert('Error updating profile');
    }
}

function showSection(id, el) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    if (el) el.classList.add('active');

    const titles = {
        overview: 'Overview',
        sell: 'Sell USDT',
        'usdt-tx': 'USDT Transactions',
        'inr-tx': 'INR Received',
        profile: 'Profile'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[id] || 'Dashboard';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function closeModal() {
    const modal = document.getElementById('successModal');
    if (modal) modal.classList.remove('show');
}

function logout() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    window.location.href = 'user-login.html';
}