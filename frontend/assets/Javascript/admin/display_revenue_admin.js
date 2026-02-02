// display_revenue_admin.js - Admin Revenue Management with Database

// ============================================
// API CONFIGURATION
// ============================================
const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    
    ENDPOINTS: {
        GET_REVENUE: '/api/admin/revenue',
    },
    
    USE_API: true,  // Set to true to use real database
};

// ============================================
// DATA
// ============================================
let revenueData = [];
let currentPeriod = 'today';  // ✅ NEW: Track current period filter

// ============================================
// PAGINATION
// ============================================
const ITEMS_PER_PAGE = 5;
let currentPage = 1;
let totalRestaurants = 0;
let totalOrders = 0;

function getTotalPages() {
    return Math.ceil(revenueData.length / ITEMS_PER_PAGE);
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchRevenueFromAPI(page = 1) {
    if (!API_CONFIG.USE_API) {
        console.log('🔴 API mode disabled');
        return null;
    }

    try {
        const params = new URLSearchParams({
            page: page,
            limit: ITEMS_PER_PAGE,
            period: currentPeriod  // ✅ NEW: Include period filter
        });
        
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_REVENUE}?${params}`;
        console.log('🔄 Fetching revenue data:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Revenue data loaded from database:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error fetching revenue:', error.message);
        return null;
    }
}

// ============================================
// INITIALIZE DATA
// ============================================
async function initializeData() {
    const apiData = await fetchRevenueFromAPI(currentPage);
    
    if (apiData && apiData.data) {
        revenueData = apiData.data;
        totalRestaurants = apiData.total;
        totalOrders = apiData.total_orders;
        console.log(`✅ Loaded revenue for ${revenueData.length} restaurants from API`);
    } else {
        revenueData = [];
        totalRestaurants = 0;
        totalOrders = 0;
        console.log('⚠️ Using empty data (no revenue found)');
    }
    
    updateStats();
    renderRevenue(currentPage);
    renderPageNumbers();
    updateButtons();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function formatCurrency(amount) {
    return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatNumber(num) {
    return num.toLocaleString('vi-VN');
}

function updateStats() {
    document.getElementById('total-restaurants').textContent = formatNumber(totalRestaurants);
    
    // ✅ NEW: Show period in orders label
    const ordersLabel = document.querySelector('.text-2xl + .text-sm.text-gray-500');
    if (ordersLabel) {
        const periodText = currentPeriod === 'today' ? 'hôm nay' : 
                          currentPeriod === 'month' ? 'tháng này' : 'tất cả';
        ordersLabel.textContent = `đơn hàng ${periodText}`;
    }
    
    document.getElementById('total-orders').textContent = formatNumber(totalOrders);
}

function renderRevenue(page) {
    const tbody = document.getElementById('revenue-tbody');
    if (!tbody) return;
    
    if (revenueData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2">payments</span>
                    <p>Chưa có dữ liệu doanh thu</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = revenueData.map((item, idx) => {
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined">store</span>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${item.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Tháng 01/2024</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm font-medium text-gray-900 dark:text-white">${formatNumber(item.orders)}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">đơn hàng</p>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">${formatCurrency(item.revenue)}</p>
            </td>
            <td class="px-6 py-4 text-right">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                }">
                    ${item.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                </span>
            </td>
        </tr>
    `;}).join('');

    // Update pagination info
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, revenueData.length);
    document.getElementById('pagination-info').textContent = 
        `Hiển thị ${start}-${end} trong ${totalRestaurants} nhà hàng`;
}

// ============================================
// PAGINATION
// ============================================
function renderPageNumbers() {
    const container = document.getElementById('page-numbers');
    if (!container) return;
    
    const totalPages = getTotalPages();
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let pages = [];

    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        if (currentPage <= 3) {
            pages = [1, 2, 3, 4, 5];
        } else if (currentPage >= totalPages - 2) {
            pages = [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
        }
    }

    container.innerHTML = pages.map(page => `
        <button onclick="goToPage(${page})" class="px-3 py-1 rounded text-sm font-medium transition-colors ${
            page === currentPage 
            ? 'bg-primary text-white' 
            : 'hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }">
            ${page}
        </button>
    `).join('');
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderRevenue(currentPage);
    renderPageNumbers();
    updateButtons();
}

function nextPage() {
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

function prevPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

function updateButtons() {
    const totalPages = getTotalPages();
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

// ============================================
// PERIOD FILTER
// ============================================
function changePeriod(period) {
    if (currentPeriod === period) return;
    
    currentPeriod = period;
    currentPage = 1;  // Reset to first page
    
    // Update UI button states
    document.querySelectorAll('[data-period]').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
    });
    
    const activeBtn = document.querySelector(`[data-period="${period}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('hover:bg-gray-100', 'dark:hover:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        activeBtn.classList.add('bg-primary', 'text-white');
    }
    
    initializeData();
}

// ============================================
// NOTIFICATION
// ============================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };
    
    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };
    
    const bgColor = colors[type] || colors.success;
    const icon = icons[type] || icons.success;
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-opacity duration-300`;
    notification.innerHTML = `
        <span class="material-symbols-outlined text-sm">${icon}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// EVENT LISTENERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);
});