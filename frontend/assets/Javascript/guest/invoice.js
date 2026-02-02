/**
 * Scan&Order Payment System - Updated Version
 * JavaScript for managing payment interface with server data integration
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_CONFIG = {
    baseURL: 'https://api.scanorder.com', // Thay đổi URL API của bạn
    endpoints: {
        getOrder: '/api/orders/{orderId}',
        getOrderByTable: '/api/tables/{tableNumber}/order',
        processPayment: '/api/payments/process',
        notifyStaff: '/api/notifications/staff'
    },
    timeout: 10000, // 10 seconds
    retryAttempts: 3
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const PaymentState = {
    selectedMethod: 'qr', // Default selected payment method
    orderDetails: {
        orderId: null,
        tableNumber: 5,
        items: [],
        subtotal: 0,
        vat: 0,
        discount: 0,
        total: 0
    },
    isProcessing: false,
    isLoading: false
};

// ============================================================================
// API SERVICE
// ============================================================================

/**
 * API Service for making HTTP requests
 */
const ApiService = {
    /**
     * Make a GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {Promise} Response data
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${API_CONFIG.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

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

    /**
     * Make a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response data
     */
    async post(endpoint, data = {}) {
        const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(API_CONFIG.timeout)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    },

    /**
     * Retry a request with exponential backoff
     * @param {Function} requestFn - Function that returns a promise
     * @param {number} retries - Number of retry attempts
     * @returns {Promise} Response data
     */
    async retryRequest(requestFn, retries = API_CONFIG.retryAttempts) {
        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retries - 1) throw error;
                const delay = Math.pow(2, i) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
};

// ============================================================================
// ORDER DATA FETCHING
// ============================================================================

/**
 * Fetch order data from server by table number
 * @param {number} tableNumber - Table number
 * @returns {Promise<Object>} Order data
 */
async function fetchOrderByTable(tableNumber) {
    try {
        const endpoint = API_CONFIG.endpoints.getOrderByTable.replace('{tableNumber}', tableNumber);
        const data = await ApiService.retryRequest(() => ApiService.get(endpoint));
        
        return data;
    } catch (error) {
        console.error('Error fetching order by table:', error);
        throw error;
    }
}

/**
 * Fetch order data from server by order ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order data
 */
async function fetchOrderById(orderId) {
    try {
        const endpoint = API_CONFIG.endpoints.getOrder.replace('{orderId}', orderId);
        const data = await ApiService.retryRequest(() => ApiService.get(endpoint));
        
        return data;
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        throw error;
    }
}

/**
 * Mock function to simulate server response
 * Use this for testing when server is not available
 */
async function fetchOrderMock(tableNumber) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock data structure that matches expected API response
    return {
        success: true,
        data: {
            orderId: 'ORD-2026-001234',
            tableNumber: tableNumber,
            items: [
                {
                    id: 'item-1',
                    name: 'Phở Bò Đặc Biệt',
                    note: 'Nhiều hành, ít bánh',
                    quantity: 2,
                    price: 99000,
                    subtotal: 198000
                },
                {
                    id: 'item-2',
                    name: 'Gỏi Cuốn Tôm Thịt',
                    note: 'Tương đậu phộng',
                    quantity: 1,
                    price: 85000,
                    subtotal: 85000
                },
                {
                    id: 'item-3',
                    name: 'Chả Giò Rế',
                    note: '',
                    quantity: 1,
                    price: 125000,
                    subtotal: 125000
                },
                {
                    id: 'item-4',
                    name: 'Trà Sen Vàng',
                    note: '',
                    quantity: 2,
                    price: 55000,
                    subtotal: 110000
                }
            ],
            subtotal: 518000,
            vat: 51800,
            vatRate: 0.10,
            discount: 25000,
            discountReason: 'Giảm giá thành viên',
            total: 544800,
            status: 'pending',
            createdAt: new Date().toISOString()
        }
    };
}

/**
 * Load order data and update UI
 */
async function loadOrderData() {
    PaymentState.isLoading = true;
    
    const loadingEl = document.getElementById('order-loading');
    const containerEl = document.getElementById('order-items-container');
    const errorEl = document.getElementById('order-error');
    
    // Show loading state
    loadingEl.classList.remove('hidden');
    containerEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    
    try {
        // Try to fetch from server, fallback to mock data if fails
        let response;
        try {
            // Uncomment this line when server is ready:
            // response = await fetchOrderByTable(PaymentState.orderDetails.tableNumber);
            
            // Using mock data for now:
            response = await fetchOrderMock(PaymentState.orderDetails.tableNumber);
        } catch (serverError) {
            console.warn('Server fetch failed, using mock data:', serverError);
            response = await fetchOrderMock(PaymentState.orderDetails.tableNumber);
        }
        
        if (!response.success || !response.data) {
            throw new Error('Invalid response format');
        }
        
        // Update payment state with fetched data
        PaymentState.orderDetails = {
            orderId: response.data.orderId,
            tableNumber: response.data.tableNumber,
            items: response.data.items,
            subtotal: response.data.subtotal,
            vat: response.data.vat,
            discount: response.data.discount,
            total: response.data.total
        };
        
        // Render order items to UI
        renderOrderItems(response.data.items);
        updateOrderSummary(response.data);
        
        // Hide loading, show content
        loadingEl.classList.add('hidden');
        containerEl.classList.remove('hidden');
        
        console.log('Order loaded successfully:', PaymentState.orderDetails);
        
    } catch (error) {
        console.error('Failed to load order:', error);
        
        // Show error state
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        
        showNotification('Không thể tải thông tin đơn hàng', 'error');
    } finally {
        PaymentState.isLoading = false;
    }
}

/**
 * Retry loading order (called from error state button)
 */
function retryLoadOrder() {
    loadOrderData();
}

// ============================================================================
// UI RENDERING
// ============================================================================

/**
 * Render order items to the table
 * @param {Array} items - Array of order items
 */
function renderOrderItems(items) {
    const tbody = document.getElementById('order-items-body');
    tbody.innerHTML = '';
    
    items.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'group';
        
        row.innerHTML = `
            <td class="py-4 sm:py-5">
                <div class="font-bold text-xs sm:text-sm">${escapeHtml(item.name)}</div>
                ${item.note ? `<div class="text-[11px] sm:text-xs text-slate-400 italic">${escapeHtml(item.note)}</div>` : ''}
            </td>
            <td class="py-4 sm:py-5 text-center font-bold text-primary text-xs sm:text-sm">
                ${String(item.quantity).padStart(2, '0')}
            </td>
            <td class="py-4 sm:py-5 text-right text-xs sm:text-sm">
                ${formatCurrency(item.price)}
            </td>
            <td class="py-4 sm:py-5 text-right font-bold text-xs sm:text-sm">
                ${formatCurrency(item.subtotal || item.price * item.quantity)}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Update order summary (subtotal, VAT, discount, total)
 * @param {Object} orderData - Order data object
 */
function updateOrderSummary(orderData) {
    document.getElementById('subtotal-amount').textContent = formatCurrency(orderData.subtotal);
    document.getElementById('vat-amount').textContent = formatCurrency(orderData.vat);
    document.getElementById('discount-amount').textContent = `-${formatCurrency(orderData.discount)}`;
    document.getElementById('total-amount').textContent = formatCurrency(orderData.total);
}

// ============================================================================
// PAYMENT METHOD SELECTION
// ============================================================================

/**
 * Select payment method and update UI
 * @param {HTMLElement} element - The payment option element clicked
 */
function selectPayment(element) {
    // Remove active class from all payment options
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('payment-option-active');
        const radio = option.querySelector('.radio-button');
        const dot = option.querySelector('.radio-dot');
        if (radio && dot) {
            radio.classList.remove('radio-button-active');
            dot.classList.remove('radio-dot-active');
        }
    });

    // Add active class to selected option
    element.classList.add('payment-option-active');
    const radio = element.querySelector('.radio-button');
    const dot = element.querySelector('.radio-dot');
    if (radio && dot) {
        radio.classList.add('radio-button-active');
        dot.classList.add('radio-dot-active');
    }

    // Update state based on selected method
    const methodIcon = element.querySelector('.material-symbols-outlined').textContent;
    if (methodIcon === 'qr_code_2') {
        PaymentState.selectedMethod = 'qr';
    } else if (methodIcon === 'account_balance_wallet') {
        PaymentState.selectedMethod = 'momo';
    } else if (methodIcon === 'storefront') {
        PaymentState.selectedMethod = 'cash';
    }

    console.log('Selected payment method:', PaymentState.selectedMethod);
}

// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

/**
 * Process payment based on selected method
 */
async function processPayment() {
    if (PaymentState.isProcessing) {
        return;
    }

    PaymentState.isProcessing = true;
    const button = document.getElementById('payment-button');
    const originalContent = button.innerHTML;

    try {
        // Update button state
        button.disabled = true;
        button.innerHTML = `
            <svg class="animate-spin h-5 w-5 text-background-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Đang xử lý...</span>
        `;

        // Handle different payment methods
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
        }

    } catch (error) {
        console.error('Payment error:', error);
        showNotification('Có lỗi xảy ra. Vui lòng thử lại!', 'error');
        button.innerHTML = originalContent;
        button.disabled = false;
    } finally {
        PaymentState.isProcessing = false;
    }
}

/**
 * Handle QR code payment
 */
async function handleQRPayment() {
    console.log('Processing QR payment...');
    showNotification('Vui lòng quét mã QR để hoàn tất thanh toán', 'info');
    
    // Send payment request to server
    try {
        const paymentData = {
            orderId: PaymentState.orderDetails.orderId,
            tableNumber: PaymentState.orderDetails.tableNumber,
            amount: PaymentState.orderDetails.total,
            method: 'qr_bank',
            timestamp: new Date().toISOString()
        };
        
        // Uncomment when server is ready:
        // const response = await ApiService.post(API_CONFIG.endpoints.processPayment, paymentData);
        
        // Simulate for now:
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        showPaymentSuccess('QR Code');
    } catch (error) {
        throw new Error('QR payment failed: ' + error.message);
    }
}

/**
 * Handle Momo payment
 */
async function handleMomoPayment() {
    console.log('Processing Momo payment...');
    
    showNotification('Đang chuyển đến ứng dụng Momo...', 'info');
    
    try {
        const paymentData = {
            orderId: PaymentState.orderDetails.orderId,
            tableNumber: PaymentState.orderDetails.tableNumber,
            amount: PaymentState.orderDetails.total,
            method: 'momo',
            timestamp: new Date().toISOString()
        };
        
        // Uncomment when server is ready:
        // const response = await ApiService.post(API_CONFIG.endpoints.processPayment, paymentData);
        
        // Simulate for now:
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showPaymentSuccess('Momo');
    } catch (error) {
        throw new Error('Momo payment failed: ' + error.message);
    }
}

/**
 * Handle cash payment
 */
async function handleCashPayment() {
    console.log('Processing cash payment...');
    showNotification('Nhân viên đã được thông báo. Vui lòng thanh toán tại quầy.', 'success');
    
    // Notify staff
    await notifyStaff();
    
    // Redirect to confirmation page
    setTimeout(() => {
        // window.location.href = '/cash-payment-confirmed';
        showPaymentSuccess('Tiền mặt');
    }, 2000);
}

/**
 * Show payment success modal/notification
 */
function showPaymentSuccess(method) {
    const modal = createSuccessModal(method);
    document.body.appendChild(modal);
    
    // Auto close and redirect after 3 seconds
    setTimeout(() => {
        modal.remove();
        // window.location.href = '/order-completed';
        console.log('Payment completed, would redirect to /order-completed');
    }, 3000);
}

/**
 * Create success modal
 */
function createSuccessModal(method) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full text-center animate-scale-in shadow-2xl">
            <div class="w-20 h-20 bg-success-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-5xl text-success-green">check_circle</span>
            </div>
            <h3 class="text-2xl font-black mb-3">Thanh toán thành công!</h3>
            <p class="text-slate-500 dark:text-slate-400 mb-2">Phương thức: ${method}</p>
            <p class="text-3xl font-black text-primary mb-6">${formatCurrency(PaymentState.orderDetails.total)}</p>
            <p class="text-sm text-slate-400">Cảm ơn quý khách đã sử dụng dịch vụ</p>
        </div>
    `;
    return modal;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, info)
 */
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

/**
 * Notify staff about payment
 */
async function notifyStaff() {
    try {
        const notification = {
            type: 'payment_pending',
            orderId: PaymentState.orderDetails.orderId,
            tableNumber: PaymentState.orderDetails.tableNumber,
            amount: PaymentState.orderDetails.total,
            method: PaymentState.selectedMethod,
            timestamp: new Date().toISOString()
        };
        
        // Uncomment when server is ready:
        // await ApiService.post(API_CONFIG.endpoints.notifyStaff, notification);
        
        // Simulate for now:
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('Staff notified:', notification);
        return notification;
    } catch (error) {
        console.error('Failed to notify staff:', error);
        throw error;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency in Vietnamese Dong
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + 'đ';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Calculate order totals
 * @param {Array} items - Order items
 * @param {number} vatRate - VAT rate (default 0.1 = 10%)
 * @param {number} discount - Discount amount
 * @returns {Object} Calculated totals
 */
function calculateTotals(items, vatRate = 0.1, discount = 0) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat - discount;
    
    return { subtotal, vat, discount, total };
}

/**
 * Validate payment before processing
 * @returns {boolean} Whether payment is valid
 */
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
    
    if (PaymentState.orderDetails.items.length === 0) {
        showNotification('Đơn hàng không có món ăn nào', 'error');
        return false;
    }
    
    return true;
}

// ============================================================================
// QR CODE MANAGEMENT
// ============================================================================

/**
 * Generate QR code for payment
 * @param {number} amount - Payment amount
 * @param {string} description - Payment description
 * @returns {string} QR code data URL
 */
function generateQRCode(amount, description) {
    // In production, this would call a QR generation library or API
    // For now, return the placeholder image
    return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBl1QKm1rsv6APZ37nOwm8THCMWa96QULvpAgI73zuwfgYIyxCvZliZWvadAIRuhYOvAl4h2MMxhKlh6jdUXh2bzl3klqZMYa2h_uW5HAYvOOMJshnO6smpbBiTEBPG7jYPBHSGLpJEbkDjCrvW8X6_gDR4JWgCV0rjiIw_cu4VwPcxHzaWLatSElgDnJooHQMoHSVa5sxf5ed_4AFn8c2kfFHxv7ymz5oJ_5jJF7gIOqRG8_kXTQDWNngfHYoVUQMNPzJ6xgjZp2c';
}

/**
 * Refresh QR code (if expired)
 */
function refreshQRCode() {
    const qrImage = document.querySelector('img[alt="QR Code Payment"]');
    if (qrImage) {
        const newQR = generateQRCode(
            PaymentState.orderDetails.total,
            `Thanh toán Bàn ${PaymentState.orderDetails.tableNumber}`
        );
        qrImage.src = newQR;
        showNotification('Mã QR đã được làm mới', 'success');
    }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

/**
 * Initialize theme from localStorage
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        // Default to system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Payment button click
    const paymentButton = document.getElementById('payment-button');
    if (paymentButton) {
        paymentButton.addEventListener('click', async () => {
            if (validatePayment()) {
                await processPayment();
            }
        });
    }

    // Payment option clicks
    document.querySelectorAll('.payment-option').forEach(option => {
        option.addEventListener('click', function() {
            selectPayment(this);
        });
    });

    // Keyboard accessibility
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement.classList.contains('payment-option')) {
            selectPayment(document.activeElement);
        }
    });

    // QR code refresh (right-click on QR)
    const qrImage = document.querySelector('img[alt="QR Code Payment"]');
    if (qrImage) {
        qrImage.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            refreshQRCode();
        });
    }
}

// ============================================================================
// ANALYTICS & TRACKING
// ============================================================================

/**
 * Track payment events for analytics
 */
function trackPaymentEvent(eventName, data) {
    console.log('Analytics Event:', eventName, data);
    
    // In production, send to analytics service
    // Example: gtag('event', eventName, data);
    // Example: analytics.track(eventName, data);
}

/**
 * Track page view
 */
function trackPageView() {
    trackPaymentEvent('payment_page_view', {
        tableNumber: PaymentState.orderDetails.tableNumber,
        orderId: PaymentState.orderDetails.orderId
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the payment system
 */
function init() {
    console.log('Initializing Scan&Order Payment System...');
    
    // Initialize theme
    initializeTheme();
    
    // Setup event listeners
    initializeEventListeners();
    
    // Add CSS animations
    addCustomAnimations();
    
    // Load order data from server
    loadOrderData();
    
    // Track page view
    trackPageView();
    
    console.log('Payment System Ready!');
}

/**
 * Add custom CSS animations
 */
function addCustomAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slide-in {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slide-out {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        @keyframes scale-in {
            from {
                transform: scale(0.9);
                opacity: 0;
            }
            to {
                transform: scale(1);
                opacity: 1;
            }
        }
        
        .animate-slide-in {
            animation: slide-in 0.3s ease-out;
        }
        
        .animate-scale-in {
            animation: scale-in 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// AUTO-INITIALIZE
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export functions for external use
window.PaymentSystem = {
    selectPayment,
    processPayment,
    showNotification,
    toggleTheme,
    formatCurrency,
    refreshQRCode,
    retryLoadOrder,
    loadOrderData,
    fetchOrderByTable,
    fetchOrderById,
    state: PaymentState,
    api: ApiService
};