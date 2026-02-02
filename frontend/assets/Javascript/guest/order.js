// ============================================
// ORDER MANAGEMENT SYSTEM FOR GUEST ORDERING
// ============================================

// ============================================
// API CONFIGURATION
// ============================================
const ORDER_API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    USE_API: true,
};

// ============================================
// URL PARAMETER UTILITIES
// ============================================

/**
 * Get URL parameters as object
 */
function getURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        branch_id: urlParams.get('branch_id'),
        table_id: urlParams.get('table_id')
    };
}

/**
 * Build URL with parameters preserved
 */
function buildURLWithParams(baseUrl) {
    const params = getURLParams();
    const stored = {
        branch_id: localStorage.getItem('current_branch_id'),
        table_id: localStorage.getItem('current_table_id')
    };
    
    // Use URL params if available, otherwise use stored
    const branchId = params.branch_id || stored.branch_id;
    const tableId = params.table_id || stored.table_id;
    
    if (branchId && tableId) {
        return `${baseUrl}?branch_id=${branchId}&table_id=${tableId}`;
    }
    return baseUrl;
}

/**
 * Navigate to page with parameters preserved
 */
function navigateWithParams(page) {
    window.location.href = buildURLWithParams(page);
}

// ============================================
// SESSION & USER INFO
// ============================================

/**
 * Get table info from URL parameters or localStorage
 */
function getTableInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    let tableId = urlParams.get('table_id');
    let branchId = urlParams.get('branch_id');
    
    // If not in URL, try localStorage
    if (!tableId) {
        tableId = localStorage.getItem('current_table_id');
    } else {
        // Save to localStorage for future pages
        localStorage.setItem('current_table_id', tableId);
    }
    
    if (!branchId) {
        branchId = localStorage.getItem('current_branch_id');
    } else {
        // Save to localStorage for future pages
        localStorage.setItem('current_branch_id', branchId);
    }
    
    // Get table number from localStorage
    const tableNumber = localStorage.getItem('current_table_number') || 'N/A';
    
    return {
        tableId: tableId,
        branchId: branchId,
        tableNumber: tableNumber
    };
}

/**
 * Get user info - determines if GUEST or CUSTOMER
 */
function getUserInfo() {
    const customerId = localStorage.getItem('customer_id');
    const isGuest = !customerId;
    
    console.log(isGuest ? '👤 Guest user detected' : '🔐 Customer detected:', customerId);
    
    return {
        customerId: customerId || null,
        isGuest: isGuest,
        displayName: isGuest ? 'Khách' : 'Khách hàng'
    };
}

// ============================================
// ORDER SUBMISSION TO SERVER
// ============================================

/**
 * Submit order to backend API
 */
async function submitOrderToServer() {
    try {
        const tableInfo = getTableInfo();
        const userInfo = getUserInfo();
        const cartItems = window.CartStorage.getItems();
        
        console.log('📤 Submitting order to server...');
        console.log('   Table:', tableInfo);
        console.log('   User:', userInfo);
        console.log('   Items:', cartItems);
        
        if (!tableInfo.tableId) {
            throw new Error('Không tìm thấy thông tin bàn. Vui lòng quét lại mã QR.');
        }
        
        if (cartItems.length === 0) {
            throw new Error('Giỏ hàng trống');
        }
        
        // Step 1: Create or get session
        const sessionResponse = await fetch(`${ORDER_API_CONFIG.BASE_URL}/api/guest/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                table_id: tableInfo.tableId,
                customer_id: userInfo.customerId
            })
        });
        
        if (!sessionResponse.ok) {
            const error = await sessionResponse.json();
            throw new Error(error.detail || 'Không thể tạo phiên');
        }
        
        const sessionData = await sessionResponse.json();
        console.log('✅ Session created:', sessionData.session_id);
        
        // Step 2: Create order with items
        // IMPORTANT: Send price as the unit price of the menu item
        const orderItems = cartItems.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity,
            price: parseFloat(item.price), // Ensure it's a number
            note: item.note || ""  // Empty string if no note
        }));
        
        console.log('📦 Order items to send:', orderItems);
        
        const orderPayload = {
            session_id: sessionData.session_id,
            items: orderItems,
            status: "ordered"  // Set to "ordered" so kitchen can see it
        };
        
        console.log('📤 Order payload:', JSON.stringify(orderPayload, null, 2));
        
        const orderResponse = await fetch(`${ORDER_API_CONFIG.BASE_URL}/api/guest/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload)
        });
        
        if (!orderResponse.ok) {
            const error = await orderResponse.json();
            console.error('❌ Server error:', error);
            throw new Error(error.detail || 'Không thể tạo đơn hàng');
        }
        
        const orderData = await orderResponse.json();
        console.log('✅ Order created:', orderData);
        
        // Save order info to localStorage
        localStorage.setItem('current_session_id', sessionData.session_id);
        localStorage.setItem('last_order_id', orderData.order_id);
        localStorage.setItem('order_status', 'ordered');

        // Fetch and persist the real table_number from the server
        // The session details endpoint is public and returns table_number from the DB
        try {
            const detailsRes = await fetch(`${ORDER_API_CONFIG.BASE_URL}/api/guest/sessions/${sessionData.session_id}/details`);
            if (detailsRes.ok) {
                const details = await detailsRes.json();
                if (details.table_number) {
                    localStorage.setItem('current_table_number', details.table_number);
                    console.log('💾 Saved real table_number from server:', details.table_number);
                }
            }
        } catch (e) {
            console.warn('⚠️ Could not fetch table_number after order creation:', e.message);
        }
        
        return {
            success: true,
            orderId: orderData.order_id,
            sessionId: sessionData.session_id,
            message: 'Đặt món thành công!'
        };
        
    } catch (error) {
        console.error('❌ Order submission error:', error);
        return {
            success: false,
            message: error.message || 'Có lỗi xảy ra khi đặt món. Vui lòng thử lại.'
        };
    }
}

/**
 * Get order status from server
 */
async function getOrderStatus(orderId) {
    try {
        const response = await fetch(`${ORDER_API_CONFIG.BASE_URL}/api/guest/orders/${orderId}/status`);
        
        if (!response.ok) {
            throw new Error('Không thể lấy trạng thái đơn hàng');
        }
        
        const data = await response.json();
        return {
            success: true,
            status: data.status,
            data: data
        };
    } catch (error) {
        console.error('❌ Get order status error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// ============================================
// CART RENDERING & DISPLAY
// ============================================
// Rendering is handled entirely by cart_page.js, which includes
// the note textarea and character counter for each item.
// Do NOT redefine renderOrderCart here — it would overwrite
// cart_page.js's version and hide the note inputs.

// ============================================
// ORDER CONFIRMATION HANDLER
// ============================================
async function handleConfirmOrder() {
    const confirmBtn = document.getElementById('confirm_order');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
            <div class="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            Đang xử lý...
        `;
    }
    
    const result = await submitOrderToServer();
    
    if (result.success) {
        // Clear cart
        window.CartStorage.clear();
        
        // Show success modal
        showSuccessModal();
        
        // Redirect after delay with preserved parameters
        setTimeout(() => {
            navigateWithParams('order_succesfull.html');
        }, 2000);
    } else {
        window.CartUI.notify(result.message, 'error');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                XÁC NHẬN ĐẶT MÓN
                <span class="material-symbols-outlined text-[20px]">check_circle</span>
            `;
        }
    }
}

function showSuccessModal() {
    const modal = document.getElementById('success_notifaction');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
}

function closeSuccessModal() {
    const modal = document.getElementById('success_notifaction');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 Initializing Order System...');
    
    // Check user type on load
    const userInfo = getUserInfo();
    const tableInfo = getTableInfo();
    console.log('👤 Current user:', userInfo);
    console.log('🏓 Table info:', tableInfo);
    
    // Setup confirmation page if on detail_cart.html
    if (window.location.pathname.includes('detail_cart')) {
        // cart_page.js handles its own initialisation and rendering.
        // We only need to attach the confirm and modal handlers here.

        const confirmBtn = document.getElementById('confirm_order');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', handleConfirmOrder);
        }
        
        const closeModalBtn = document.getElementById('close_modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeSuccessModal);
        }
    }
    
    console.log('✅ Order System Ready');
});

// ============================================
// GLOBAL EXPORT
// ============================================
window.OrderManager = {
    submitOrder: submitOrderToServer,
    getOrderStatus,
    getUserInfo,
    getTableInfo,
    navigateWithParams,
    buildURLWithParams,
};

// increaseItemQuantity / decreaseItemQuantity / removeItem are already
// exposed globally by cart_page.js — no need to re-export them here.
window.navigateWithParams = navigateWithParams;