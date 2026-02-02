const API_BASE_URL = 'http://localhost:8000';

// Status mapping for Vietnamese
const STATUS_MAP = {
    'ordered': { text: 'Đã nhận đơn', step: 1 },
    'cooking': { text: 'Đang chế biến', step: 2 },
    'ready': { text: 'Đang phục vụ', step: 3 },
    'serving': { text: 'Đang phục vụ', step: 3 },
    'done': { text: 'Hoàn tất', step: 4 }
};

let orderData = null;
let statusPollInterval = null;

// Load order data from server
async function loadOrderData() {
    try {
        const orderId = localStorage.getItem('last_order_id');
        
        if (!orderId) {
            console.error('No order ID found');
            showError('Không tìm thấy đơn hàng');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/guest/orders/${orderId}/status`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch order');
        }
        
        orderData = await response.json();
        console.log('✅ Order data loaded:', orderData);

        // Wait for guest_utils to finish fetching the real table number before rendering.
        // guest_utils fetches table_number asynchronously; if we read localStorage before
        // that resolves we get null/stale value.
        // NOTE: order_succesfull.html loads this script in <head> before guest_utils.js in
        // <body>, so window.GuestUtils may not exist yet when DOMContentLoaded fires.
        // We poll briefly until it appears, then await its promise.
        await new Promise(resolve => {
            function check() {
                if (window.GuestUtils && window.GuestUtils.tableNumberReady) {
                    window.GuestUtils.tableNumberReady.then(resolve);
                } else {
                    setTimeout(check, 50);
                }
            }
            check();
            // Safety timeout: don't hang forever if guest_utils never loads
            setTimeout(resolve, 3000);
        });
        
        updateOrderUI();
        
        // Start polling for status updates
        startStatusPolling(orderId);
        
    } catch (error) {
        console.error('❌ Error loading order:', error);
        showError('Không thể tải thông tin đơn hàng');
    }
}

// Update UI with order data
function updateOrderUI() {
    if (!orderData) return;
    
    // Get table number from localStorage
    const tableNumber = localStorage.getItem('current_table_number') || 'N/A';
    
    // Update header table number
    const headerTableEl = document.getElementById('header-table-number');
    if (headerTableEl) {
        headerTableEl.textContent = tableNumber;
    }
    
    // Update status text
    const statusInfo = STATUS_MAP[orderData.status] || STATUS_MAP['ordered'];
    const statusTextEl = document.querySelector('h3.text-2xl.font-black.text-primary');
    if (statusTextEl) {
        statusTextEl.textContent = statusInfo.text;
    }
    
    // Update order info boxes by finding them via their label text
    // This is more robust than positional indexing which breaks if DOM order changes
    const infoBoxes = document.querySelectorAll('.p-4.rounded-2xl');
    infoBoxes.forEach(box => {
        const label = box.querySelector('.uppercase');
        if (!label) return;
        const labelText = label.textContent.trim().toUpperCase();

        const valueEl = box.querySelector('.font-bold.text-lg');
        if (!valueEl) return;

        if (labelText.includes('MÃ ĐƠN HÀNG')) {
            valueEl.textContent = `#${orderData.order_id.substring(0, 8).toUpperCase()}`;
        } else if (labelText.includes('BÀN SỐ')) {
            valueEl.textContent = tableNumber;
        }
    });
    
    // Update progress indicators
    updateProgressIndicators(statusInfo.step);
    
    // Update wait time if available
    if (orderData.wait_minutes !== undefined) {
        const timeEl = document.querySelector('.text-2xl.font-black');
        if (timeEl && timeEl.parentElement.textContent.includes('phút')) {
            timeEl.textContent = `${orderData.wait_minutes} phút`;
        }
    }
}

function updateProgressIndicators(currentStep) {
    const allDots = document.querySelectorAll('.z-10 > div:first-child');
    const allLabels = document.querySelectorAll('.z-10 > span');
    const allLines = document.querySelectorAll('.progress-line');
    
    // Update dots and labels
    allDots.forEach((dot, index) => {
        const stepNum = index + 1;
        const label = allLabels[index];
        
        if (stepNum < currentStep) {
            // Completed step
            dot.className = 'h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white';
            dot.innerHTML = '<span class="material-symbols-outlined text-xs font-bold">check</span>';
            if (label) label.className = 'text-sm font-bold';
        } else if (stepNum === currentStep) {
            // Current step
            dot.className = 'h-6 w-6 rounded-full bg-primary flex items-center justify-center';
            dot.innerHTML = '<div class="h-2 w-2 rounded-full bg-white animate-pulse"></div>';
            if (label) label.className = 'text-sm font-bold';
        } else {
            // Future step
            dot.className = 'h-6 w-6 rounded-full bg-slate-200 dark:bg-white/10';
            dot.innerHTML = '';
            if (label) label.className = 'text-sm font-medium text-slate-400';
        }
    });
    
    // Update progress lines
    allLines.forEach((line, index) => {
        if (index < currentStep - 1) {
            line.innerHTML = '<div class="progress-line-fill"></div>';
        } else {
            line.innerHTML = '';
        }
    });
}

// Start polling for status updates
function startStatusPolling(orderId) {
    // Clear any existing interval
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
    }
    
    // Poll every 5 seconds
    statusPollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/guest/orders/${orderId}/status`);
            if (response.ok) {
                const newData = await response.json();
                if (newData.status !== orderData.status) {
                    console.log('🔄 Status changed:', orderData.status, '→', newData.status);
                    orderData = newData;
                    updateOrderUI();
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 5000);
}

function showError(message) {
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20">
                <span class="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
                <p class="text-xl font-bold mb-2">Có lỗi xảy ra</p>
                <p class="text-slate-500 mb-6">${message}</p>
                <button onclick="window.location.href='menu.html'" class="px-6 py-3 bg-primary text-white rounded-xl font-bold">
                    Quay lại menu
                </button>
            </div>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Loading order status page...');
    loadOrderData();
});

// Clean up polling on page unload
window.addEventListener('beforeunload', () => {
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
    }
});