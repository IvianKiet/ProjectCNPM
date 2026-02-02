// ============================================================================
// CONFIGURATION
// ============================================================================

const API_CONFIG = {
    baseURL: 'http://localhost:8000',
    timeout: 30000,
    retryAttempts: 3
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const PaymentState = {
    selectedMethod: 'qr',
    orderDetails: {
        orderId: null,
        sessionId: null,
        tableNumber: null,
        items: [],
        subtotal: 0,
        vat: 0,
        discount: 0,
        total: 0
    },
    bankInfo: {
        bankCode: null,
        accountNumber: null,
        accountName: null
    },
    qrPayment: {
        qrCodeUrl: null,
        qrCodeData: null,
        paymentId: null,
        pollingTimer: null,
        timerInterval: null,
        isPolling: false,
        startTime: null
    },
    isProcessing: false,
    isLoading: false
};

// ============================================================================
// API SERVICE
// ============================================================================

const ApiService = {
    async get(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(API_CONFIG.timeout)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    },

    async retryRequest(requestFn, retries = API_CONFIG.retryAttempts) {
        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retries - 1) throw error;
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
};

// ============================================================================
// ORDER DATA FETCHING (real API from payment2.js)
// ============================================================================

async function loadOrderData() {
    PaymentState.isLoading = true;

    const loadingEl = document.getElementById('order-loading');
    const containerEl = document.getElementById('order-items-container');
    const errorEl = document.getElementById('order-error');

    loadingEl?.classList.remove('hidden');
    containerEl?.classList.add('hidden');
    errorEl?.classList.add('hidden');

    try {
        const sessionId = localStorage.getItem('current_session_id');

        if (!sessionId) {
            throw new Error('Không có phiên hoạt động. Vui lòng đặt hàng trước.');
        }

        console.log('📥 Loading order for session:', sessionId);

        const sessionData = await ApiService.retryRequest(() =>
            ApiService.get(`${API_CONFIG.baseURL}/api/guest/sessions/${sessionId}/details`)
        );

        console.log('✅ Session data loaded:', sessionData);

        PaymentState.orderDetails = {
            orderId: sessionData.order.order_id,
            sessionId: sessionId,
            tableNumber: sessionData.table_number,
            items: sessionData.order.items,
            subtotal: sessionData.order.subtotal,
            vat: sessionData.order.vat,
            discount: 0,
            total: sessionData.order.total
        };

        if (sessionData.bill) {
            PaymentState.bankInfo = {
                bankCode: sessionData.bill.bank_code || 'VCB',
                accountNumber: sessionData.bill.bank_account_number || '0123456789',
                accountName: sessionData.bill.bank_account_name || 'NHA HANG'
            };
        }

        console.log('✅ Order:', PaymentState.orderDetails);
        console.log('🏦 Bank:', PaymentState.bankInfo);

        renderOrderItems(PaymentState.orderDetails.items);
        updateOrderSummary(PaymentState.orderDetails);
        updateTableDisplay();

        loadingEl?.classList.add('hidden');
        containerEl?.classList.remove('hidden');

    } catch (error) {
        console.error('❌ Failed to load order:', error);

        loadingEl?.classList.add('hidden');
        errorEl?.classList.remove('hidden');

        showNotification(error.message || 'Không thể tải thông tin đơn hàng', 'error');
    } finally {
        PaymentState.isLoading = false;
    }
}

function retryLoadOrder() {
    document.getElementById('order-error')?.classList.add('hidden');
    loadOrderData();
}

function updateTableDisplay() {
    const tableNumber = PaymentState.orderDetails.tableNumber;
    if (tableNumber) {
        const badge = document.getElementById('table-info-badge');
        if (badge) badge.textContent = `Bàn ${tableNumber}`;
    }
}

// ============================================================================
// QR CODE PAYMENT
// ============================================================================

function generateVietQRData() {
    const amount = Math.round(PaymentState.orderDetails.total);
    const orderId = PaymentState.orderDetails.orderId
        ? PaymentState.orderDetails.orderId.substring(0, 8).toUpperCase()
        : 'UNKNOWN';
    const description = `DH ${orderId} Ban${PaymentState.orderDetails.tableNumber || ''}`;

    const bankCode = PaymentState.bankInfo.bankCode;
    const accountNumber = PaymentState.bankInfo.accountNumber;
    const accountName = PaymentState.bankInfo.accountName;

    const qrCodeUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

    console.log('📱 Generated QR URL:', qrCodeUrl);

    return {
        success: true,
        data: {
            paymentId: 'PAY-' + Date.now(),
            qrCodeUrl: qrCodeUrl,
            qrCodeData: `VietQR|${bankCode}|${accountNumber}|${amount}|${description}`,
            bankInfo: {
                bankCode: bankCode,
                accountNumber: accountNumber,
                accountName: accountName
            },
            expiresAt: new Date(Date.now() + 300000).toISOString()
        }
    };
}

function showQRCodeModal(qrData) {
    const oldModal = document.getElementById('qr-payment-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'qr-payment-modal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in';

    // Close modal when clicking backdrop
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeQRModal();
        }
    });

    const expiryTime = qrData.expiresAt ? new Date(qrData.expiresAt) : new Date(Date.now() + 300000);
    const timeRemaining = Math.floor((expiryTime - Date.now()) / 1000);

    modal.innerHTML = `
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 sm:p-8 max-w-md w-full text-center animate-scale-in shadow-2xl">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-xl sm:text-2xl font-black">Quét mã thanh toán</h3>
                <button onclick="closeQRModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full">
                    <span class="material-symbols-outlined text-2xl">close</span>
                </button>
            </div>

            <div class="bg-white p-4 rounded-2xl mb-6 shadow-inner">
                <img src="${qrData.qrCodeUrl}"
                     alt="QR Code Payment"
                     class="w-full max-w-xs mx-auto"
                     onerror="this.src='https://via.placeholder.com/300x300?text=QR+Code+Error'">
            </div>

            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 mb-6 text-left">
                <div class="flex justify-between mb-2">
                    <span class="text-xs text-slate-400">Ngân hàng</span>
                    <span class="text-sm font-bold">${qrData.bankInfo.bankCode}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-xs text-slate-400">Số tài khoản</span>
                    <span class="text-sm font-bold font-mono">${qrData.bankInfo.accountNumber}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-xs text-slate-400">Chủ tài khoản</span>
                    <span class="text-sm font-bold">${qrData.bankInfo.accountName}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-xs text-slate-400">Số tiền</span>
                    <span class="text-lg font-black text-primary">${formatCurrency(PaymentState.orderDetails.total)}</span>
                </div>
            </div>

            <div class="flex items-center justify-center gap-2 mb-4 text-accent-coral">
                <span class="material-symbols-outlined text-xl">schedule</span>
                <span class="font-bold" id="qr-timer">${formatTime(timeRemaining)}</span>
            </div>

            <div class="flex items-center justify-center gap-2 mb-6">
                <div class="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                <span class="text-sm text-slate-500" id="qr-status-text">Đang chờ thanh toán...</span>
            </div>

            <div class="text-xs text-slate-400 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-4">
                <p class="font-bold mb-1 text-blue-600 dark:text-blue-400">Hướng dẫn:</p>
                <ol class="text-left space-y-1 list-decimal list-inside">
                    <li>Mở ứng dụng ngân hàng</li>
                    <li>Chọn "Quét QR" hoặc "Chuyển khoản QR"</li>
                    <li>Quét mã QR phía trên</li>
                    <li>Xác nhận thanh toán</li>
                </ol>
            </div>

            <div class="flex gap-2 mb-4">
                <button onclick="refreshQRCode()"
                        class="flex-1 py-3 bg-slate-100 dark:bg-white/10 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">refresh</span>
                    Làm mới
                </button>
                <button onclick="closeQRModal()"
                        class="flex-1 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-200 dark:hover:bg-red-900/30 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">close</span>
                    Hủy
                </button>
            </div>

            <button onclick="simulatePaymentSuccess()"
                    class="w-full py-3 bg-primary hover:bg-primary/90 text-background-dark rounded-xl font-bold transition-colors">
                Tôi đã thanh toán
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    startQRTimer(timeRemaining);
}

// Close modal with full state reset
function closeQRModal() {
    const modal = document.getElementById('qr-payment-modal');
    if (modal) {
        modal.style.animation = 'fade-out 0.3s ease-in';
        setTimeout(() => modal.remove(), 300);
    }

    stopPaymentPolling();

    // Reset button to initial state
    const button = document.getElementById('payment-button');
    if (button) {
        button.disabled = false;
        button.innerHTML = `
            <span class="material-symbols-outlined">check_circle</span>
            <span class="hidden sm:inline">HOÀN TẤT THANH TOÁN</span>
            <span class="sm:hidden">XÁC NHẬN</span>
        `;
    }

    PaymentState.isProcessing = false;
    console.log('✅ QR Modal closed, states reset');
}

function startQRTimer(seconds) {
    const timerEl = document.getElementById('qr-timer');
    if (!timerEl) return;

    let remaining = seconds;

    const interval = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(interval);
            timerEl.textContent = 'Hết hạn';
            timerEl.classList.add('text-red-500');

            showNotification('Mã QR đã hết hạn. Vui lòng tạo mã mới.', 'error');

            setTimeout(() => {
                closeQRModal();
            }, 3000);
            return;
        }

        timerEl.textContent = formatTime(remaining);

        if (remaining <= 30) {
            timerEl.classList.add('text-red-500', 'animate-pulse');
        }
    }, 1000);

    PaymentState.qrPayment.timerInterval = interval;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function refreshQRCode() {
    try {
        showNotification('Đang tạo mã QR mới...', 'info');
        stopPaymentPolling();
        closeQRModal();
        await processPayment();
    } catch (error) {
        console.error('❌ Lỗi refresh QR:', error);
        showNotification('Không thể làm mới mã QR', 'error');
    }
}

// ============================================================================
// PAYMENT STATUS POLLING
// ============================================================================

function startPaymentPolling(paymentId) {
    if (PaymentState.qrPayment.isPolling) return;

    PaymentState.qrPayment.isPolling = true;
    PaymentState.qrPayment.paymentId = paymentId;
    PaymentState.qrPayment.startTime = Date.now();

    const maxPollingTime = 300000; // 5 minutes

    const pollInterval = setInterval(() => {
        const elapsed = Date.now() - PaymentState.qrPayment.startTime;

        if (elapsed > maxPollingTime) {
            stopPaymentPolling();
            showNotification('Hết thời gian chờ thanh toán', 'error');
            closeQRModal();
            return;
        }

        // Update elapsed seconds display
        const statusEl = document.getElementById('qr-status-text');
        if (statusEl) {
            const elapsedSec = Math.floor(elapsed / 1000);
            statusEl.textContent = `Đang chờ thanh toán... (${elapsedSec}s)`;
        }
    }, 3000);

    PaymentState.qrPayment.pollingTimer = pollInterval;
}

function stopPaymentPolling() {
    if (PaymentState.qrPayment.pollingTimer) {
        clearInterval(PaymentState.qrPayment.pollingTimer);
        PaymentState.qrPayment.pollingTimer = null;
    }

    if (PaymentState.qrPayment.timerInterval) {
        clearInterval(PaymentState.qrPayment.timerInterval);
        PaymentState.qrPayment.timerInterval = null;
    }

    PaymentState.qrPayment.isPolling = false;
}

// ============================================================================
// CONFIRM QR PAYMENT (user confirms they paid via banking app)
// ============================================================================

async function simulatePaymentSuccess() {
    console.log('✅ User confirmed QR payment...');

    try {
        stopPaymentPolling();
        
        const sessionId = PaymentState.orderDetails.sessionId;
        
        if (!sessionId) {
            throw new Error('Không tìm thấy thông tin phiên');
        }
        
        console.log('💳 Updating bill status to paid for session:', sessionId);
        
        // Update bill status to 'paid'
        // NOTE FOR STAFF/CASHIER: This sets bill status to 'paid' after customer
        // confirms they completed QR payment. Staff should verify actual payment
        // receipt from bank statement before finalizing.
        const response = await fetch(`${API_CONFIG.baseURL}/api/guest/sessions/${sessionId}/bill/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'paid',
                payment_method: 'bank_transfer'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Không thể cập nhật trạng thái thanh toán');
        }

        console.log('✅ Bill status updated to paid');
        
        // Save confirmation data to localStorage for the confirmation page
        const confirmationData = {
            orderId: PaymentState.orderDetails.orderId,
            sessionId: PaymentState.orderDetails.sessionId,
            tableNumber: PaymentState.orderDetails.tableNumber,
            items: PaymentState.orderDetails.items,
            subtotal: PaymentState.orderDetails.subtotal,
            vat: PaymentState.orderDetails.vat,
            discount: PaymentState.orderDetails.discount,
            total: PaymentState.orderDetails.total,
            paymentMethod: 'qr',
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('payment_confirmation_data', JSON.stringify(confirmationData));
        
        // Close QR modal
        closeQRModal();
        
        // Redirect to confirmation page (serves as receipt/proof for cashier)
        const redirectUrl = window.GuestUtils?.addParamsToURL('payment_confirmation.html') || 'payment_confirmation.html';
        console.log('🔄 Redirecting to confirmation page:', redirectUrl);
        window.location.href = redirectUrl;
        
    } catch (error) {
        console.error('❌ Error confirming QR payment:', error);
        showNotification('Có lỗi khi xác nhận thanh toán. Vui lòng thử lại.', 'error');
        
        // Re-enable the confirm button in QR modal
        const confirmBtn = document.querySelector('#qr-payment-modal button[onclick*="simulatePaymentSuccess"]');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                <span class="material-symbols-outlined">check_circle</span>
                Tôi đã thanh toán
            `;
        }
    }
}


// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

async function processPayment() {
    if (PaymentState.isProcessing) return;

    if (!validatePayment()) return;

    PaymentState.isProcessing = true;
    const button = document.getElementById('payment-button');
    const originalContent = button?.innerHTML;

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <svg class="animate-spin h-5 w-5 text-background-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Đang xử lý...</span>
            `;
        }

        switch (PaymentState.selectedMethod) {
            case 'qr':
                await handleQRPayment();
                break;
            case 'momo':
                await handleMomoPayment();
                break;
            case 'cash':
                await handleCashPayment();
                break;
            default:
                throw new Error('Phương thức thanh toán không hợp lệ');
        }

    } catch (error) {
        console.error('❌ Payment error:', error);
        showNotification(error.message || 'Có lỗi xảy ra', 'error');

        if (button) {
            button.innerHTML = originalContent;
            button.disabled = false;
        }

        PaymentState.isProcessing = false;
    }
}

async function handleQRPayment() {
    console.log('💳 Processing QR bank payment...');

    // Validate bank info loaded from API
    if (!PaymentState.bankInfo.bankCode || !PaymentState.bankInfo.accountNumber || !PaymentState.bankInfo.accountName) {
        throw new Error('Chưa tải được thông tin ngân hàng. Vui lòng thử lại.');
    }

    const qrResponse = generateVietQRData();

    if (!qrResponse.success) {
        throw new Error('Không thể tạo mã QR');
    }

    PaymentState.qrPayment = {
        ...PaymentState.qrPayment,
        qrCodeUrl: qrResponse.data.qrCodeUrl,
        qrCodeData: qrResponse.data.qrCodeData,
        paymentId: qrResponse.data.paymentId,
        startTime: Date.now()
    };

    showQRCodeModal(qrResponse.data);
    startPaymentPolling(qrResponse.data.paymentId);
}

async function handleMomoPayment() {
    // MoMo removed - this should not be called
    console.error('❌ MoMo payment is no longer available');
    throw new Error('Phương thức thanh toán không khả dụng');
}

async function handleCashPayment() {
    console.log('💵 Processing cash payment...');
    
    try {
        const sessionId = PaymentState.orderDetails.sessionId;
        
        if (!sessionId) {
            throw new Error('Không tìm thấy thông tin phiên');
        }
        
        console.log('💰 Updating bill status to cash_pending for session:', sessionId);
        
        // Update bill status to cash_pending
        // NOTE FOR STAFF/CASHIER: This sets bill status to 'cash_pending' 
        // indicating customer will pay cash at the counter
        const response = await fetch(`${API_CONFIG.baseURL}/api/guest/sessions/${sessionId}/bill/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'cash_pending',
                payment_method: 'cash'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Không thể cập nhật trạng thái thanh toán');
        }

        console.log('✅ Bill status updated to cash_pending');
        
        // Show cash payment popup with invoice details
        showCashPaymentPopup();
        
        // Reset button state
        const button = document.getElementById('payment-button');
        if (button) {
            button.innerHTML = `
                <span class="material-symbols-outlined">check_circle</span>
                <span class="hidden sm:inline">HOÀN TẤT THANH TOÁN</span>
                <span class="sm:hidden">XÁC NHẬN</span>
            `;
            button.disabled = false;
        }
        PaymentState.isProcessing = false;
        
    } catch (error) {
        console.error('❌ Error processing cash payment:', error);
        throw error;
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderOrderItems(items) {
    // Target the actual tbody ID in payment_invoice.html
    const tbody = document.getElementById('order-items-list');
    if (!tbody) {
        console.warn('⚠️ order-items-list tbody not found');
        return;
    }

    tbody.innerHTML = '';

    items.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors';

        // Use menu_item_name (API field) with fallback to name (mock field)
        const itemName = item.menu_item_name || item.name || 'Không xác định';
        const itemSubtotal = item.subtotal || (item.price * item.quantity) || 0;

        row.innerHTML = `
            <td class="py-4 sm:py-5 pl-4">
                <div class="font-bold text-xs sm:text-sm">${escapeHtml(itemName)}</div>
                ${item.note ? `<div class="text-[11px] sm:text-xs text-slate-400 italic mt-1">${escapeHtml(item.note)}</div>` : ''}
            </td>
            <td class="py-4 sm:py-5 text-center font-bold text-primary text-xs sm:text-sm">
                x${item.quantity}
            </td>
            <td class="py-4 sm:py-5 text-right font-bold text-xs sm:text-sm pr-4">
                ${formatCurrency(itemSubtotal)}
            </td>
        `;

        tbody.appendChild(row);
    });
}

function updateOrderSummary(orderData) {
    const subtotalEl = document.getElementById('subtotal-amount');
    const vatEl = document.getElementById('vat-amount');
    const discountEl = document.getElementById('discount-amount');
    const totalEl = document.getElementById('total-amount');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(orderData.subtotal);
    if (vatEl) vatEl.textContent = formatCurrency(orderData.vat);
    if (discountEl) discountEl.textContent = orderData.discount > 0 ? `-${formatCurrency(orderData.discount)}` : '-0đ';
    if (totalEl) totalEl.textContent = formatCurrency(orderData.total);
}

// ============================================================================
// PAYMENT METHOD SELECTION
// ============================================================================

function selectPayment(element) {
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('payment-option-active');
        const radio = option.querySelector('.radio-button');
        const dot = option.querySelector('.radio-dot');
        if (radio && dot) {
            radio.classList.remove('radio-button-active');
            dot.classList.remove('radio-dot-active');
        }
    });

    element.classList.add('payment-option-active');
    const radio = element.querySelector('.radio-button');
    const dot = element.querySelector('.radio-dot');
    if (radio && dot) {
        radio.classList.add('radio-button-active');
        dot.classList.add('radio-dot-active');
    }

    const methodIcon = element.querySelector('.material-symbols-outlined').textContent;
    if (methodIcon === 'qr_code_2') {
        PaymentState.selectedMethod = 'qr';
    } else if (methodIcon === 'account_balance_wallet') {
        PaymentState.selectedMethod = 'momo';
    } else if (methodIcon === 'storefront') {
        PaymentState.selectedMethod = 'cash';
    }

    console.log('✅ Selected method:', PaymentState.selectedMethod);
}

// ============================================================================
// CASH PAYMENT POPUP
// ============================================================================

/**
 * Show popup for cash payment with invoice details
 * User sees this popup and is instructed to show invoice to cashier
 */
function showCashPaymentPopup() {
    const oldModal = document.getElementById('cash-payment-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'cash-payment-modal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in';

    modal.innerHTML = `
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-6 sm:p-8 max-w-lg w-full animate-scale-in shadow-2xl">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-4xl text-blue-500">storefront</span>
                </div>
                <h3 class="text-2xl font-black mb-2">Thanh toán tại quầy</h3>
                <p class="text-slate-500 dark:text-slate-400 text-sm">Vui lòng mang hóa đơn này đến quầy thu ngân</p>
            </div>

            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 mb-6 space-y-3">
                <div class="flex justify-between text-sm">
                    <span class="text-slate-500 dark:text-slate-400">Mã đơn hàng</span>
                    <span class="font-bold">#${PaymentState.orderDetails.orderId ? PaymentState.orderDetails.orderId.substring(0, 8).toUpperCase() : 'N/A'}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-slate-500 dark:text-slate-400">Bàn số</span>
                    <span class="font-bold">${PaymentState.orderDetails.tableNumber || 'N/A'}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-slate-500 dark:text-slate-400">Số món</span>
                    <span class="font-bold">${PaymentState.orderDetails.items.length} món</span>
                </div>
                <div class="flex justify-between text-sm pt-3 border-t border-slate-200 dark:border-white/10">
                    <span class="text-slate-500 dark:text-slate-400">Tổng tiền</span>
                    <span class="font-black text-xl text-primary">${formatCurrency(PaymentState.orderDetails.total)}</span>
                </div>
            </div>

            <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                <div class="flex gap-3">
                    <span class="material-symbols-outlined text-blue-500 text-xl shrink-0">info</span>
                    <div class="text-xs text-slate-600 dark:text-slate-400">
                        <p class="font-bold mb-1">Lưu ý quan trọng:</p>
                        <ul class="list-disc list-inside space-y-1">
                            <li>Nhớ mã đơn hàng hoặc chụp lại màn hình này</li>
                            <li>Đến quầy thu ngân và cung cấp mã đơn hàng</li>
                            <li>Nhân viên sẽ xác nhận và hoàn tất thanh toán</li>
                        </ul>
                    </div>
                </div>
            </div>

            <button onclick="closeCashModal()" class="w-full px-6 py-4 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined">check_circle</span>
                Đã hiểu
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeCashModal();
        }
    });
}

/**
 * Close cash payment modal
 */
function closeCashModal() {
    const modal = document.getElementById('cash-payment-modal');
    if (modal) {
        modal.style.animation = 'fade-out 0.3s ease-in';
        setTimeout(() => modal.remove(), 300);
    }
}

// ============================================================================
// SUCCESS MODAL
// ============================================================================

function showPaymentSuccess(method, transactionId) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full text-center animate-scale-in shadow-2xl">
            <div class="w-20 h-20 bg-success-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-5xl text-success-green">check_circle</span>
            </div>
            <h3 class="text-2xl font-black mb-3">Thanh toán thành công!</h3>
            <p class="text-slate-500 dark:text-slate-400 mb-2">Phương thức: ${escapeHtml(method)}</p>
            ${transactionId ? `<p class="text-xs text-slate-400 mb-4 font-mono">Mã GD: ${transactionId}</p>` : ''}
            <p class="text-3xl font-black text-primary mb-6">${formatCurrency(PaymentState.orderDetails.total)}</p>
            <p class="text-sm text-slate-400">Cảm ơn quý khách đã sử dụng dịch vụ</p>
        </div>
    `;

    document.body.appendChild(modal);

    // Redirect to menu after success
    setTimeout(() => {
        modal.remove();
        const redirectUrl = window.GuestUtils?.addParamsToURL('menu.html') || 'menu.html';
        console.log('🔄 Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
    }, 3000);
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'bg-success-green',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-4 rounded-xl shadow-lg z-50 animate-slide-in max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined">
                ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
            </span>
            <p class="font-medium">${escapeHtml(message)}</p>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slide-out 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================================
// VALIDATION
// ============================================================================

function validatePayment() {
    if (!PaymentState.selectedMethod) {
        showNotification('Vui lòng chọn phương thức thanh toán', 'error');
        return false;
    }

    if (!PaymentState.orderDetails.orderId) {
        showNotification('Không tìm thấy thông tin đơn hàng', 'error');
        return false;
    }

    if (PaymentState.orderDetails.total <= 0) {
        showNotification('Số tiền thanh toán không hợp lệ', 'error');
        return false;
    }

    return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// EVENT LISTENERS & INITIALIZATION
// ============================================================================

function initializeEventListeners() {
    const paymentButton = document.getElementById('payment-button');
    if (paymentButton) {
        paymentButton.addEventListener('click', processPayment);
    }

    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', function() {
            selectPayment(this);
        });
    });

    // ESC key closes QR modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const qrModal = document.getElementById('qr-payment-modal');
            if (qrModal) {
                closeQRModal();
            }
        }
    });
}

function addCustomAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-out {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes scale-in {
            from { transform: scale(0.9); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fade-out {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
    `;
    document.head.appendChild(style);
}

function init() {
    console.log('🚀 Khởi động Payment System...');

    initializeEventListeners();
    addCustomAnimations();
    loadOrderData();

    console.log('✅ Payment System Ready!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('beforeunload', () => {
    stopPaymentPolling();
});

// Export
window.PaymentSystem = {
    selectPayment,
    processPayment,
    showNotification,
    formatCurrency,
    refreshQRCode,
    retryLoadOrder,
    loadOrderData,
    closeQRModal,
    simulatePaymentSuccess,
    state: PaymentState,
    api: ApiService,
    config: API_CONFIG
};