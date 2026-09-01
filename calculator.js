// ===== LOAN CALCULATOR WITH MONTHLY BASIS =====

function calculateLoan() {
    let loanAmount = parseFloat(document.getElementById("loanAmount").value);
    let monthlyInterestRate = parseFloat(document.getElementById("interestRate").value); // Monthly rate
    let loanMonths = parseInt(document.getElementById("loanMonths").value);

    if (isNaN(loanAmount) || isNaN(monthlyInterestRate) || isNaN(loanMonths) || loanAmount <= 0 || loanMonths <= 0) {
        alert("Please enter valid loan details.");
        return;
    }

    // Convert monthly rate to decimal (e.g., 2% becomes 0.02)
    let monthlyRate = monthlyInterestRate / 100;
    let monthlyPayment = 0;
    let totalInterest = 0;
    let totalPayment = 0;

    if (monthlyRate === 0) {
        // If no interest, simple division
        monthlyPayment = loanAmount / loanMonths;
        totalPayment = loanAmount;
        totalInterest = 0;
    } else {
        // Using the amortization formula for monthly payments
        // PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
        // where P = principal, r = monthly rate, n = number of months
        
        let numerator = monthlyRate * Math.pow(1 + monthlyRate, loanMonths);
        let denominator = Math.pow(1 + monthlyRate, loanMonths) - 1;
        monthlyPayment = loanAmount * (numerator / denominator);
        
        totalPayment = monthlyPayment * loanMonths;
        totalInterest = totalPayment - loanAmount;
    }

    // Update the display
    document.getElementById("monthlyPayment").innerText = 
        "MWK " + monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    document.getElementById("totalInterest").innerText = 
        "MWK " + totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    document.getElementById("totalPayment").innerText = 
        "MWK " + totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===== AUTHENTICATION =====
function openAuth(tab) {
    document.getElementById('authModal').classList.add('active');
    switchAuthTab(tab);
}

function closeAuth() {
    document.getElementById('authModal').classList.remove('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Login functionality would connect to a backend server');
    closeAuth();
});

document.getElementById('registerForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Registration successful! You can now login.');
    closeAuth();
});

// ===== LOAN FORMS =====
function openForm(type) {
    if (type === 'personal') {
        document.getElementById('personalLoanForm').classList.add('active');
    } else if (type === 'business') {
        document.getElementById('businessLoanForm').classList.add('active');
    }
}

function closeForm(type) {
    if (type === 'personal') {
        document.getElementById('personalLoanForm').classList.remove('active');
        document.getElementById('personalForm').reset();
        document.getElementById('personalSuccess').classList.remove('active');
    } else if (type === 'business') {
        document.getElementById('businessLoanForm').classList.remove('active');
        document.getElementById('businessForm').reset();
        document.getElementById('businessSuccess').classList.remove('active');
    }
}

document.getElementById('personalForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    document.getElementById('personalSuccess').classList.add('active');
    setTimeout(() => closeForm('personal'), 3000);
});

document.getElementById('businessForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    document.getElementById('businessSuccess').classList.add('active');
    setTimeout(() => closeForm('business'), 3000);
});

// ===== LIVE CHAT =====
function toggleChat() {
    document.getElementById('chatBox').classList.toggle('active');
}

function sendChatMessage() {
    let input = document.getElementById('chatInput');
    let message = input.value.trim();
    
    if (!message) return;

    let chatMessages = document.getElementById('chatMessages');
    
    let userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = message;
    chatMessages.appendChild(userMsg);

    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
        let botMsg = document.createElement('div');
        botMsg.className = 'chat-message bot';
        botMsg.textContent = 'Thanks for your message! Our team will respond shortly.';
        chatMessages.appendChild(botMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);
}

// ===== STATISTICS ANIMATION =====
function animateStats() {
    const stats = [
        { id: 'stat1', end: 2450, prefix: '' },
        { id: 'stat2', end: 5.2, prefix: 'MWK ', suffix: 'B' },
        { id: 'stat3', end: 98, prefix: '', suffix: '%' },
        { id: 'stat4', end: 24, prefix: '', suffix: '/7' }
    ];

    stats.forEach(stat => {
        let current = 0;
        let element = document.getElementById(stat.id);
        let increment = stat.end / 50;

        let timer = setInterval(() => {
            current += increment;
            if (current >= stat.end) {
                current = stat.end;
                clearInterval(timer);
            }
            element.textContent = stat.prefix + (Number.isInteger(stat.end) ? Math.floor(current) : current.toFixed(1)) + (stat.suffix || '');
        }, 30);
    });
}

window.addEventListener('load', animateStats);
