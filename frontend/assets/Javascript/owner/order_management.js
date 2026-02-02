// order_management.js - Order Management for Restaurant Owner

// ============================================
// CONFIGURATION
// ============================================
const API_BASE = 'http://localhost:8000';

// ============================================
// STATE
// ============================================
let currentUser = null;
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const ordersPerPage = 10;

// ============================================
// INITIALIZATION
// ============================================
async function initializePage() {
    try {
        // Check authentication and get user profile
        currentUser = await initAuthenticatedPage();
        
        if (!currentUser) {
            return; // Will redirect to login
        }
        
        console.log("Current user:", currentUser);
        
        // Setup logout button
        setupLogoutButton('#logout-btn');
        
        // Setup token refresh check
        setupTokenRefresh();
        
        // Load page data
        await loadOrders();
        await loadBranchesForFilter();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error("Page initialization error:", error);
        alert("Lỗi khởi tạo trang. Vui lòng thử lại.");
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterOrders, 300));
    }
    
    // Filters
    const branchFilter = document.getElementById('branch-filter');
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('date-filter');
    
    if (branchFilter) branchFilter.addEventListener('change', filterOrders);
    if (statusFilter) statusFilter.addEventListener('change', filterOrders);
    if (dateFilter) dateFilter.addEventListener('change', filterOrders);
    
    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// DATA LOADING
// ============================================
async function loadOrders() {
    try {
        showLoading(true);
        
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            window.location.href = '../../index.html';
            return;
        }

        // Fetch all orders for this tenant (no tenant_id param needed - handled by auth token)
        const response = await fetch(`${API_BASE}/api/orders`, {
            method: 'GET',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load orders');
        }

        const rawOrders = await response.json();
        console.log("Loaded orders:", rawOrders);
        
        // Transform the orders to match our expected format
        allOrders = rawOrders.map(order => ({
            order_id: order.order_id,
            session_id: order.session_id,
            branch_id: order.branch_id,
            branch_name: order.branch_name,
            table_number: order.table_number,
            order_time: order.order_time,
            status: order.status,
            items: order.items || [],
            subtotal: calculateSubtotalFromItems(order.items || []),
            vat: calculateSubtotalFromItems(order.items || []) * 0.1,
            total_amount: calculateSubtotalFromItems(order.items || []) * 1.1,
            payment_method: null // Will be fetched if needed
        }));
        
        // Apply initial filters
        filterOrders();
        
        // Update statistics
        updateStatistics();
        
        showLoading(false);
        
    } catch (error) {
        console.error("Error loading orders:", error);
        showLoading(false);
        showError("Lỗi tải danh sách đơn hàng: " + error.message);
    }
}

function calculateSubtotalFromItems(items) {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

async function loadBranchesForFilter() {
    try {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) return;

        const branches = await BranchAPI.getAll();
        
        const branchFilter = document.getElementById('branch-filter');
        if (branchFilter && branches) {
            branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.branch_id;
                option.textContent = branch.branch_name;
                branchFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading branches for filter:", error);
    }
}

// ============================================
// FILTERING & SORTING
// ============================================
function filterOrders() {
    const searchText = document.getElementById('search-input')?.value.toLowerCase() || '';
    const branchId = document.getElementById('branch-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    const dateRange = document.getElementById('date-filter')?.value || 'today';
    
    filteredOrders = allOrders.filter(order => {
        // Search filter
        const matchesSearch = !searchText || 
            order.order_id.toLowerCase().includes(searchText) ||
            order.table_number.toLowerCase().includes(searchText) ||
            order.branch_name.toLowerCase().includes(searchText);
        
        // Branch filter
        const matchesBranch = !branchId || order.branch_id === branchId;
        
        // Status filter
        const matchesStatus = !status || order.status === status;
        
        // Date filter
        const matchesDate = matchesDateRange(order.order_time, dateRange);
        
        return matchesSearch && matchesBranch && matchesStatus && matchesDate;
    });
    
    // Reset to first page
    currentPage = 1;
    
    // Render filtered orders
    renderOrders();
}

function matchesDateRange(orderTime, range) {
    const orderDate = new Date(orderTime);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch(range) {
        case 'today':
            return orderDate >= today;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return orderDate >= yesterday && orderDate < today;
        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDate >= weekAgo;
        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return orderDate >= monthStart;
        case 'all':
        default:
            return true;
    }
}

// ============================================
// RENDERING
// ============================================
function renderOrders() {
    const tbody = document.getElementById('orders-table-body');
    const emptyState = document.getElementById('empty-state');
    
    if (!tbody) return;
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
    
    // Clear table
    tbody.innerHTML = '';
    
    if (paginatedOrders.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        updatePaginationInfo(0, 0, 0);
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    // Render each order
    paginatedOrders.forEach(order => {
        const row = createOrderRow(order);
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePaginationInfo(startIndex + 1, Math.min(endIndex, filteredOrders.length), filteredOrders.length);
}

function createOrderRow(order) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
    
    const statusInfo = getStatusInfo(order.status);
    const totalAmount = order.total_amount || calculateTotal(order);
    
    tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900 dark:text-white">#${order.order_id.substring(0, 8)}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${order.session_id ? 'Session: ' + order.session_id.substring(0, 8) : ''}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900 dark:text-white">${order.branch_name || 'N/A'}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <span class="material-symbols-outlined text-gray-400 text-sm mr-1">table_restaurant</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">${order.table_number}</span>
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900 dark:text-white">${formatDateTime(order.order_time)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900 dark:text-white">${order.items?.length || 0} món</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-gray-900 dark:text-white">${formatCurrency(totalAmount)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.class}">
                ${statusInfo.text}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
            <button onclick="viewOrderDetail('${order.order_id}')" class="text-primary hover:text-primary-hover font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">visibility</span>
                Xem
            </button>
        </td>
    `;
    
    return tr;
}

function getStatusInfo(status) {
    const statusMap = {
        'ordered': {
            text: 'Đã đặt',
            class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
        },
        'cooking': {
            text: 'Đang nấu',
            class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        },
        'ready': {
            text: 'Sẵn sàng',
            class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
        },
        'serving': {
            text: 'Đang phục vụ',
            class: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
        },
        'done': {
            text: 'Hoàn thành',
            class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
        },
        'cancelled': {
            text: 'Đã hủy',
            class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
        }
    };
    
    return statusMap[status] || {
        text: status,
        class: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    };
}

// ============================================
// ORDER DETAIL MODAL
// ============================================
async function viewOrderDetail(orderId) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) {
        alert('Không tìm thấy đơn hàng');
        return;
    }
    
    const modal = document.getElementById('order-detail-modal');
    const content = document.getElementById('order-detail-content');
    
    if (!modal || !content) return;
    
    const statusInfo = getStatusInfo(order.status);
    const subtotal = order.subtotal || calculateSubtotal(order);
    const vat = order.vat || (subtotal * 0.1);
    const total = order.total_amount || (subtotal + vat);
    
    content.innerHTML = `
        <!-- Order Info -->
        <div class="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Mã đơn hàng</p>
                <p class="font-semibold text-gray-900 dark:text-white">#${order.order_id.substring(0, 8)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Trạng thái</p>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.class}">${statusInfo.text}</span>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Chi nhánh</p>
                <p class="font-medium text-gray-900 dark:text-white">${order.branch_name}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Bàn số</p>
                <p class="font-medium text-gray-900 dark:text-white">${order.table_number}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Thời gian đặt</p>
                <p class="font-medium text-gray-900 dark:text-white">${formatDateTime(order.order_time)}</p>
            </div>
            <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Phương thức thanh toán</p>
                <p class="font-medium text-gray-900 dark:text-white">${formatPaymentMethod(order.payment_method)}</p>
            </div>
        </div>
        
        <!-- Order Items -->
        <div>
            <h4 class="font-semibold text-gray-900 dark:text-white mb-3">Chi tiết món ăn</h4>
            <div class="space-y-2">
                ${order.items?.map(item => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div class="flex-1">
                            <p class="font-medium text-gray-900 dark:text-white">${item.menu_item_name}</p>
                            ${item.note ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Ghi chú: ${item.note}</p>` : ''}
                        </div>
                        <div class="text-right ml-4">
                            <p class="text-sm text-gray-600 dark:text-gray-400">x${item.quantity}</p>
                            <p class="font-medium text-gray-900 dark:text-white">${formatCurrency(item.price * item.quantity)}</p>
                        </div>
                    </div>
                `).join('') || '<p class="text-gray-500 dark:text-gray-400">Không có món nào</p>'}
            </div>
        </div>
        
        <!-- Total -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">Tạm tính</span>
                    <span class="text-gray-900 dark:text-white">${formatCurrency(subtotal)}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600 dark:text-gray-400">VAT (10%)</span>
                    <span class="text-gray-900 dark:text-white">${formatCurrency(vat)}</span>
                </div>
                <div class="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span class="text-gray-900 dark:text-white">Tổng cộng</span>
                    <span class="text-primary">${formatCurrency(total)}</span>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-2 pt-4">
            <button onclick="closeOrderDetail()" class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Đóng
            </button>
            ${order.status === 'ordered' ? `
                <button onclick="updateOrderStatus('${order.order_id}', 'cooking')" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
                    Bắt đầu nấu
                </button>
            ` : ''}
            ${order.status === 'cooking' ? `
                <button onclick="updateOrderStatus('${order.order_id}', 'ready')" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
                    Món đã sẵn sàng
                </button>
            ` : ''}
            ${order.status === 'ready' ? `
                <button onclick="updateOrderStatus('${order.order_id}', 'serving')" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
                    Bắt đầu phục vụ
                </button>
            ` : ''}
            ${order.status === 'serving' ? `
                <button onclick="updateOrderStatus('${order.order_id}', 'done')" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
                    Hoàn tất đơn
                </button>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeOrderDetail() {
    const modal = document.getElementById('order-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('order-detail-modal');
    if (event.target === modal) {
        closeOrderDetail();
    }
}

// ============================================
// ORDER ACTIONS
// ============================================
async function updateOrderStatus(orderId, newStatus) {
    try {
        // The existing API expects new_status as a query parameter
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/status?new_status=${newStatus}`, {
            method: 'PUT',
            headers: authHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to update order status');
        }

        // Reload orders
        await loadOrders();
        
        // Close modal
        closeOrderDetail();
        
        alert('Cập nhật trạng thái đơn hàng thành công!');
        
    } catch (error) {
        console.error("Error updating order status:", error);
        alert('Lỗi cập nhật trạng thái: ' + error.message);
    }
}

// ============================================
// STATISTICS
// ============================================
function updateStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = allOrders.filter(order => {
        const orderDate = new Date(order.order_time);
        return orderDate >= today;
    });
    
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === 'ordered' || o.status === 'cooking').length;
    const completedOrders = allOrders.filter(o => o.status === 'done').length;
    
    const todayRevenue = todayOrders.reduce((sum, order) => {
        if (order.status === 'done') {
            return sum + (order.total_amount || calculateTotal(order));
        }
        return sum;
    }, 0);
    
    // Update UI
    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('pending-orders').textContent = pendingOrders;
    document.getElementById('completed-orders').textContent = completedOrders;
    document.getElementById('today-revenue').textContent = formatCurrency(todayRevenue);
}

// ============================================
// PAGINATION
// ============================================
function updatePaginationInfo(from, to, total) {
    document.getElementById('showing-from').textContent = from;
    document.getElementById('showing-to').textContent = to;
    document.getElementById('total-count').textContent = total;
    
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= Math.ceil(filteredOrders.length / ordersPerPage);
}

function changePage(delta) {
    const maxPage = Math.ceil(filteredOrders.length / ordersPerPage);
    const newPage = currentPage + delta;
    
    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        renderOrders();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function authHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

function formatCurrency(amount) {
    if (!amount) return '0₫';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPaymentMethod(method) {
    const methodMap = {
        'cash': 'Tiền mặt',
        'bank_transfer': 'Chuyển khoản',
        'card': 'Thẻ',
        'momo': 'MoMo',
        'zalopay': 'ZaloPay'
    };
    return methodMap[method] || method || 'Chưa thanh toán';
}

function calculateSubtotal(order) {
    if (!order.items) return 0;
    return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calculateTotal(order) {
    const subtotal = calculateSubtotal(order);
    const vat = subtotal * 0.1;
    return subtotal + vat;
}

function showLoading(show) {
    const loading = document.getElementById('loading-state');
    const table = document.getElementById('orders-table-body')?.parentElement;
    
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
    if (table) {
        table.style.display = show ? 'none' : 'table';
    }
}

function showError(message) {
    alert(message);
}

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    initializePage();
});