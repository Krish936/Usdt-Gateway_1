// API Configuration
const API_URL = 'http://localhost:5001/api';
const API_KEY = 'YourSecretAPIKeyHere'; // Keep this secure in production

// Platform state
let platformInfo = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadPlatformInfo();
    setupEventListeners();
});

// Load platform information
async function loadPlatformInfo() {
    try {
        const response = await fetch(`${API_URL}/info`);
        const data = await response.json();
        
        if (data.success) {
            platformInfo = data.data;
            document.getElementById('walletAddress').value = platformInfo.receivingAddress;
            updateRateDisplay();
        }
    } catch (error) {
        console.error('Error loading platform info:', error);
    }
}

// Update rate display
function updateRateDisplay() {
    if (platformInfo) {
        // Update rate displays
        document.querySelector('.rate-value').textContent = `₹${platformInfo.rate} / USDT`;
        
        // Show available slots
        const infoBox = document.querySelector('.info-box');
        infoBox.innerHTML = `
            <span>Min: ${platformInfo.minDeposit} USDT</span>
            <span>Max: ${platformInfo.maxDeposit} USDT</span>
            <span>Today's Deposits: ${platformInfo.todayDeposits}/${platformInfo.dailyLimit}</span>
        `;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Calculate INR amount on input
    document.getElementById('amount').addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value);
        if (amount && platformInfo) {
            const inrAmount = amount * platformInfo.rate;
            document.getElementById('inrAmount').textContent = `₹${inrAmount.toFixed(2)}`;
        } else {
            document.getElementById('inrAmount').textContent = '₹0';
        }
    });
    
    // Form submission
    document.getElementById('depositForm').addEventListener('submit', handleDepositSubmit);
    
    // Close modal
    document.querySelector('.close').addEventListener('click', closeModal);
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('statusModal');
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Handle deposit submission
async function handleDepositSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    const depositData = {
        txHash: document.getElementById('txHash').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        userAddress: document.getElementById('userAddress').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        bankDetails: {
            accountHolderName: document.getElementById('accountHolderName').value.trim(),
            accountNumber: document.getElementById('accountNumber').value.trim(),
            ifscCode: document.getElementById('ifscCode').value.trim(),
            bankName: document.getElementById('bankName').value.trim()
        }
    };
    
    try {
        const response = await fetch(`${API_URL}/deposit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(depositData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showModal('✅ Deposit Submitted!', `
                <p><strong>Transaction ID:</strong> ${result.data.transactionId}</p>
                <p><strong>Status:</strong> ${result.data.status}</p>
                <p><strong>You'll receive:</strong> ₹${result.data.amountInINR.toFixed(2)}</p>
                <p><strong>Message:</strong> ${result.data.verificationMessage}</p>
                <p class="mt-3">Your INR will be transferred within 24 hours after verification.</p>
            `);
            
            // Save to local storage for tracking
            saveToLocalStorage(depositData.txHash, result.data);
            
            // Reset form
            document.getElementById('depositForm').reset();
            document.getElementById('inrAmount').textContent = '₹0';
        } else {
            showModal('❌ Error', `
                <p>${result.message}</p>
            `);
        }
    } catch (error) {
        console.error('Error:', error);
        showModal('❌ Error', `
            <p>Something went wrong. Please try again.</p>
            <p class="text-sm text-gray-600">Error: ${error.message}</p>
        `);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Deposit Request';
    }
}

// Copy wallet address
function copyAddress() {
    const addressInput = document.getElementById('walletAddress');
    addressInput.select();
    addressInput.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(addressInput.value).then(() => {
        // Show copied feedback
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        // Fallback
        document.execCommand('copy');
    });
}

// Show modal
function showModal(title, content) {
    const modal = document.getElementById('statusModal');
    const modalContent = document.getElementById('modalContent');
    
    modalContent.innerHTML = `
        <h2>${title}</h2>
        <div class="mt-4">${content}</div>
    `;
    
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    document.getElementById('statusModal').style.display = 'none';
}

// Save transaction to local storage
function saveToLocalStorage(txHash, data) {
    let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    transactions.push({
        txHash,
        ...data,
        timestamp: Date.now()
    });
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Check transaction status (can be called manually)
async function checkTransactionStatus(txHash) {
    try {
        const response = await fetch(`${API_URL}/transaction/${txHash}`);
        const result = await response.json();
        
        if (result.success) {
            showModal('📊 Transaction Status', `
                <p><strong>Transaction:</strong> ${result.data.txHash}</p>
                <p><strong>Amount:</strong> ${result.data.amount} USDT</p>
                <p><strong>INR Value:</strong> ₹${result.data.amountInINR.toFixed(2)}</p>
                <p><strong>Status:</strong> ${result.data.status}</p>
                <p><strong>Submitted:</strong> ${new Date(result.data.createdAt).toLocaleString()}</p>
                ${result.data.completedAt ? `<p><strong>Completed:</strong> ${new Date(result.data.completedAt).toLocaleString()}</p>` : ''}
            `);
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}