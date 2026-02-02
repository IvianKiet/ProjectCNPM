// display_user_admin.js - Admin User Management with Edit & Delete

// ============================================
// API CONFIGURATION
// ============================================
const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    
    ENDPOINTS: {
        GET_ALL: '/api/admin/users',
        UPDATE_STATUS: '/api/admin/users/:id/status',
        UPDATE: '/api/admin/users/:id',
        DELETE: '/api/admin/users/:id',
    },
    
    USE_API: true,
};

// ============================================
// DATA
// ============================================
let usersData = [];
let filteredData = [];
let isSearching = false;
let currentFilter = 'all'; // all, customer, owner, staff, chef

// ============================================
// PAGINATION
// ============================================
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalUsers = 0;
let activeUsers = 0;

function getTotalPages() {
    const data = isSearching ? filteredData : usersData;
    return Math.ceil(data.length / ITEMS_PER_PAGE);
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchUsersFromAPI(page = 1, search = null, role = null) {
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
        
        if (role && role !== 'all') {
            params.append('role', role);
        }
        
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_ALL}?${params}`;
        console.log('📄 Fetching users:', url);
        
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
        console.log('✅ Users loaded from database:', result);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        return null;
    }
}

async function updateUserStatus(userId, newStatus) {
    if (!API_CONFIG.USE_API) {
        const user = usersData.find(u => u.user_id === userId);
        if (user) {
            user.status = newStatus;
            renderUsers(currentPage);
            showNotification(
                newStatus === 'locked' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
                'success'
            );
        }
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.UPDATE_STATUS.replace(':id', userId);
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
        showNotification('Lỗi khi cập nhật trạng thái người dùng', 'error');
    }
}

async function updateUser(userId, data) {
    if (!API_CONFIG.USE_API) {
        const user = usersData.find(u => u.user_id === userId);
        if (user) {
            if (data.full_name) user.name = data.full_name;
            if (data.role) user.role = data.role;
            renderUsers(currentPage);
            showNotification('Đã cập nhật thông tin người dùng', 'success');
        }
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.UPDATE.replace(':id', userId);
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
        console.error('❌ Error updating user:', error);
        showNotification(error.message || 'Lỗi khi cập nhật người dùng', 'error');
        throw error;
    }
}

async function deleteUser(userId) {
    if (!API_CONFIG.USE_API) {
        usersData = usersData.filter(u => u.user_id !== userId);
        renderUsers(currentPage);
        showNotification('Đã xóa người dùng', 'success');
        return;
    }

    try {
        const url = API_CONFIG.ENDPOINTS.DELETE.replace(':id', userId);
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
        console.error('❌ Error deleting user:', error);
        showNotification('Lỗi khi xóa người dùng', 'error');
        throw error;
    }
}

// ============================================
// INITIALIZE DATA
// ============================================
async function initializeData() {
    const apiData = await fetchUsersFromAPI(currentPage, null, currentFilter);
    
    if (apiData && apiData.data) {
        usersData = apiData.data;
        totalUsers = apiData.total;
        activeUsers = apiData.active_users;
        console.log(`✅ Loaded ${usersData.length} users from API`);
    } else {
        usersData = [];
        totalUsers = 0;
        activeUsers = 0;
        console.log('⚠️ Using empty data (no users found)');
    }
    
    updateStats();
    renderUsers(currentPage);
    renderPageNumbers();
    updateButtons();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function updateStats() {
    document.getElementById('total-users').textContent = totalUsers.toLocaleString('vi-VN');
    document.getElementById('active-users').textContent = activeUsers.toLocaleString('vi-VN');
}

function getRoleBadge(role) {
    const roleConfig = {
        'customer': { display: 'Khách hàng', color: 'purple' },
        'owner': { display: 'Chủ nhà hàng', color: 'blue' },
        'staff': { display: 'Nhân viên', color: 'gray' },
        'chef': { display: 'Đầu bếp', color: 'orange' }
    };
    
    const config = roleConfig[role] || { display: role, color: 'gray' };
    
    const colorClasses = {
        'purple': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        'blue': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        'gray': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        'orange': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
    };
    
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[config.color]}">${config.display}</span>`;
}

function renderUsers(page) {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    
    const data = isSearching ? filteredData : usersData;
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = data.slice(start, end);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-4xl mb-2">group</span>
                    <p>Không tìm thấy người dùng</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageData.map((user, idx) => {
        const isLocked = user.status === 'locked';
        const statusBadge = isLocked
            ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Bị khóa</span>'
            : '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Hoạt động</span>';
        
        return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff" 
                         alt="${user.name}" 
                         class="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600">
                    <div>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${user.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${user.tenant_name}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <p class="text-sm text-gray-900 dark:text-white">${user.email}</p>
            </td>
            <td class="px-6 py-4">
                ${getRoleBadge(user.role)}
            </td>
            <td class="px-6 py-4">
                <p class="text-sm text-gray-900 dark:text-white">${user.created_at}</p>
            </td>
            <td class="px-6 py-4">
                ${statusBadge}
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="openEditModal('${user.user_id}', '${user.name.replace(/'/g, "\\'")}', '${user.role}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Chỉnh sửa thông tin">
                        <span class="material-icons text-sm text-blue-600">edit</span>
                    </button>
                    <button onclick="toggleUserStatus('${user.user_id}', '${user.status}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="${isLocked ? 'Mở khóa' : 'Khóa'} người dùng">
                        <span class="material-icons text-sm ${isLocked ? 'text-green-600' : 'text-orange-600'}">${isLocked ? 'lock_open' : 'lock'}</span>
                    </button>
                    <button onclick="confirmDelete('${user.user_id}', '${user.name.replace(/'/g, "\\'")}')" 
                            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Xóa người dùng">
                        <span class="material-icons text-sm text-red-600">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `;}).join('');

    // Update pagination info
    const dataStart = start + 1;
    const dataEnd = Math.min(end, data.length);
    document.getElementById('pagination-info').textContent = 
        `Hiển thị ${dataStart}-${dataEnd} trong ${data.length} người dùng`;
}

// ============================================
// EDIT MODAL
// ============================================
function openEditModal(userId, userName, userRole) {
    const modal = document.getElementById('edit-modal');
    
    // Set form values
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-name').value = userName;
    document.getElementById('edit-user-role').value = userRole;
    
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
    
    const userId = document.getElementById('edit-user-id').value;
    const userName = document.getElementById('edit-user-name').value.trim();
    const userRole = document.getElementById('edit-user-role').value;
    
    if (!userName) {
        showNotification('Vui lòng nhập tên người dùng', 'warning');
        return;
    }
    
    try {
        await updateUser(userId, {
            full_name: userName,
            role: userRole
        });
        closeEditModal();
    } catch (error) {
        // Error already handled in updateUser
    }
}

// ============================================
// DELETE CONFIRMATION
// ============================================
function confirmDelete(userId, userName) {
    if (confirm(`Bạn có chắc chắn muốn xóa người dùng "${userName}"?\n\nLưu ý: Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn!`)) {
        deleteUser(userId);
    }
}

// ============================================
// TOGGLE STATUS
// ============================================
function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
    const actionText = newStatus === 'locked' ? 'khóa' : 'mở khóa';
    
    if (confirm(`Bạn có chắc muốn ${actionText} người dùng này?`)) {
        updateUserStatus(userId, newStatus);
    }
}

// ============================================
// FILTER BY ROLE
// ============================================
async function filterByRole(role) {
    currentFilter = role;
    currentPage = 1;
    
    // Update button styles
    document.querySelectorAll('.role-filter-btn').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white', 'shadow-sm');
        btn.classList.add('text-gray-600', 'dark:text-gray-400');
    });
    
    event.target.classList.remove('text-gray-600', 'dark:text-gray-400');
    event.target.classList.add('bg-primary', 'text-white', 'shadow-sm');
    
    await initializeData();
}

// ============================================
// PAGINATION
// ============================================
function renderPageNumbers() {
    const container = document.getElementById('page-numbers');
    if (!container) return;
    
    const data = isSearching ? filteredData : usersData;
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
    renderUsers(currentPage);
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
        renderUsers(currentPage);
        renderPageNumbers();
        updateButtons();
        return;
    }
    
    isSearching = true;
    filteredData = usersData.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.tenant_name.toLowerCase().includes(searchTerm)
    );
    
    currentPage = 1;
    renderUsers(currentPage);
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