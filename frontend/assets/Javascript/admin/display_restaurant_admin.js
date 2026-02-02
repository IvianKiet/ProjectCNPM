// display_restaurant_admin.js - Admin Restaurant Management with Edit & Delete

// ============================================
// API CONFIGURATION
// ============================================
const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    
    ENDPOINTS: {
        GET_ALL: '/api/admin/restaurants',
        UPDATE_STATUS: '/api/admin/restaurants/:id/status',
        UPDATE: '/api/admin/restaurants/:id',
        DELETE: '/api/admin/restaurants/:id',
    },
    
    USE_API: true,
};

// ============================================
// DATA
// ============================================
let restaurantsData = [];
let filteredData = [];
let isSearching = false;

// ============================================
// PAGINATION
// ============================================
const ITEMS_PER_PAGE = 5;
let currentPage = 1;

function getTotalPages() {
    const data = isSearching ? filteredData : restaurantsData;
    return Math.ceil(data.length / ITEMS_PER_PAGE);
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchRestaurantsFromAPI(page = 1, search = null) {
    if (!API_CONFIG.USE_API) {
        console.log('🔴 API mode disabled');
        return null;
    }

    try {
        const params = new URLSearchParams({
            page: page,
            limit: ITEMS_PER_PAGE
        });
        
        if (search) {
            params.append('search', search);
        }
        
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_ALL}?${params}`;
        console.log('📄 Fetching restaurants:', url);
        
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
        console.log('✅ Restaurants loaded from database:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error fetching restaurants:', error.message);
        return null;
    }
}

async function updateRestaurantStatus(tenantId, newStatus) {
    if (!API_CONFIG.USE_API) {
        const restaurant = restaurantsData.find(r => r.tenant_id === tenantId);
        if (restaurant) {
            restaurant.status = newStatus;
            renderRestaurants(currentPage);
            showNotification(
                newStatus === 'locked' ? 'Đã khóa nhà hàng' : 'Đã mở khóa nhà hàng',
                'success'
            );
        }
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.UPDATE_STATUS.replace(':id', tenantId);
        const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        await initializeData();
        showNotification(result.message, 'success');
        
    } catch (error) {
        console.error('❌ Error updating status:', error);
        showNotification('Lỗi khi cập nhật trạng thái nhà hàng', 'error');
    }
}

async function updateRestaurant(tenantId, data) {
    if (!API_CONFIG.USE_API) {
        const restaurant = restaurantsData.find(r => r.tenant_id === tenantId);
        if (restaurant) {
            if (data.tenant_name) restaurant.name = data.tenant_name;
            if (data.owner_name) restaurant.owner_name = data.owner_name;
            if (data.owner_email) restaurant.owner_email = data.owner_email;
            renderRestaurants(currentPage);
            showNotification('Đã cập nhật thông tin nhà hàng', 'success');
        }
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.UPDATE.replace(':id', tenantId);
        const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Cập nhật thất bại');
        }
        
        const result = await response.json();
        await initializeData();
        showNotification(result.message, 'success');
        
    } catch (error) {
        console.error('❌ Error updating restaurant:', error);
        showNotification(error.message || 'Lỗi khi cập nhật nhà hàng', 'error');
        throw error;
    }
}

async function deleteRestaurant(tenantId) {
    if (!API_CONFIG.USE_API) {
        restaurantsData = restaurantsData.filter(r => r.tenant_id !== tenantId);
        renderRestaurants(currentPage);
        showNotification('Đã xóa nhà hàng', 'success');
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.DELETE.replace(':id', tenantId);
        const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        await initializeData();
        showNotification(result.message, 'success');
        
    } catch (error) {
        console.error('❌ Error deleting restaurant:', error);
        showNotification('Lỗi khi xóa nhà hàng', 'error');
        throw error;
    }
}

// ============================================
// INITIALIZE DATA
// ============================================
async function initializeData() {
    const apiData = await fetchRestaurantsFromAPI(currentPage);
    
    if (apiData && apiData.data) {
        restaurantsData = apiData.data;
        console.log(`✅ Loaded ${restaurantsData.length} restaurants from API`);
    } else {
        restaurantsData = [];
        console.log('⚠️ Using empty data (no restaurants found)');
    }
    
    renderRestaurants(currentPage);
    renderPageNumbers();
    updateButtons();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderRestaurants(page) {
    const tbody = document.getElementById('restaurant-tbody');
    if (!tbody) return;
    
    const data = isSearching ? filteredData : restaurantsData;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2">store</span>
                    <p>Chưa có nhà hàng nào trong hệ thống</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((restaurant, idx) => {
        const isLocked = restaurant.status === 'locked';
        const statusBadge = isLocked
            ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Bị khóa</span>'
            : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Hoạt động</span>';
        
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined">store</span>
                    </div>
                    <div>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${restaurant.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${restaurant.branch_count} chi nhánh</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm text-gray-900 dark:text-white">${restaurant.owner_name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${restaurant.owner_email}</p>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm text-gray-900 dark:text-white">${restaurant.created_at}</p>
            </td>
            <td class="px-6 py-4">
                ${statusBadge}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openEditModal('${restaurant.tenant_id}', '${restaurant.name.replace(/'/g, "\\'")}', '${restaurant.owner_name.replace(/'/g, "\\'")}', '${restaurant.owner_email}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Chỉnh sửa thông tin">
                        <span class="material-icons text-sm text-blue-600">edit</span>
                    </button>
                    <button onclick="toggleRestaurantStatus('${restaurant.tenant_id}', '${restaurant.status}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="${isLocked ? 'Mở khóa' : 'Khóa'} nhà hàng">
                        <span class="material-icons text-sm ${isLocked ? 'text-green-600' : 'text-orange-600'}">${isLocked ? 'lock_open' : 'lock'}</span>
                    </button>
                    <button onclick="confirmDelete('${restaurant.tenant_id}', '${restaurant.name.replace(/'/g, "\\'")}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Xóa nhà hàng">
                        <span class="material-icons text-sm text-red-600">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `;}).join('');

    // Update pagination info
    const start = (page - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(page * ITEMS_PER_PAGE, data.length);
    document.getElementById('pagination-info').textContent = 
        `Hiển thị ${start}-${end} trong ${data.length} nhà hàng`;
}

// ============================================
// EDIT MODAL
// ============================================
function openEditModal(tenantId, restaurantName, ownerName, ownerEmail) {
    const modal = document.getElementById('edit-modal');
    const form = document.getElementById('edit-form');
    
    // Set form values
    document.getElementById('edit-tenant-id').value = tenantId;
    document.getElementById('edit-restaurant-name').value = restaurantName;
    document.getElementById('edit-owner-name').value = ownerName;
    document.getElementById('edit-owner-email').value = ownerEmail;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    const tenantId = document.getElementById('edit-tenant-id').value;
    const restaurantName = document.getElementById('edit-restaurant-name').value.trim();
    const ownerName = document.getElementById('edit-owner-name').value.trim();
    const ownerEmail = document.getElementById('edit-owner-email').value.trim();
    
    if (!restaurantName || !ownerName || !ownerEmail) {
        showNotification('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        await updateRestaurant(tenantId, {
            tenant_name: restaurantName,
            owner_name: ownerName,
            owner_email: ownerEmail
        });
        closeEditModal();
    } catch (error) {
        // Error already handled in updateRestaurant
    }
}

// ============================================
// DELETE CONFIRMATION
// ============================================
function confirmDelete(tenantId, restaurantName) {
    if (confirm(`Bạn có chắc chắn muốn xóa nhà hàng "${restaurantName}"?\n\nLưu ý: Tất cả dữ liệu liên quan (chi nhánh, bàn, menu, đơn hàng) sẽ bị xóa vĩnh viễn!`)) {
        deleteRestaurant(tenantId);
    }
}

// ============================================
// TOGGLE STATUS
// ============================================
function toggleRestaurantStatus(tenantId, currentStatus) {
    const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
    const actionText = newStatus === 'locked' ? 'khóa' : 'mở khóa';
    
    if (confirm(`Bạn có chắc muốn ${actionText} nhà hàng này?`)) {
        updateRestaurantStatus(tenantId, newStatus);
    }
}

// ============================================
// PAGINATION
// ============================================
function renderPageNumbers() {
    const container = document.getElementById('page-numbers');
    if (!container) return;
    
    const data = isSearching ? filteredData : restaurantsData;
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
    renderRestaurants(currentPage);
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
// SEARCH
// ============================================
function handleSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        isSearching = false;
        filteredData = [];
        currentPage = 1;
        renderRestaurants(currentPage);
        renderPageNumbers();
        updateButtons();
        return;
    }
    
    isSearching = true;
    filteredData = restaurantsData.filter(restaurant => 
        restaurant.name.toLowerCase().includes(searchTerm) ||
        restaurant.owner_name.toLowerCase().includes(searchTerm) ||
        restaurant.owner_email.toLowerCase().includes(searchTerm)
    );
    
    currentPage = 1;
    renderRestaurants(currentPage);
    renderPageNumbers();
    updateButtons();
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
    const searchInput = document.getElementById('search-input');
    const editForm = document.getElementById('edit-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (editForm) editForm.addEventListener('submit', handleEditSubmit);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    
    // Close modal on background click
    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
    }
});