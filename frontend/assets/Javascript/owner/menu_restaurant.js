// menu_restaurant.js - Enhanced with JWT Authentication and proper initialization

// Initialize authentication on page load
let currentUser = null;

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
        await loadBranchesForMenu();
        
    } catch (error) {
        console.error("Page initialization error:", error);
        alert("Lỗi khởi tạo trang. Vui lòng thử lại.");
    }
}

// Load all branches for menu management
async function loadBranchesForMenu() {
    try {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            window.location.href = '../../index.html';
            return;
        }

        const branches = await BranchAPI.getAll();
        console.log("Loaded branches for menu:", branches);

        const mainContainer = document.querySelector('.max-w-7xl.mx-auto');
        if (!mainContainer) {
            console.error("Main container not found");
            return;
        }

        // Remove search input and add button
        const searchDiv = document.querySelector('.flex.gap-3');
        if (searchDiv) {
            searchDiv.remove();
        }

        // Clear existing restaurant cards
        let existingCards = mainContainer.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
        if (existingCards) {
            existingCards.remove();
        }

        if (!branches || branches.length === 0) {
            const noDataHTML = `
                <div class="text-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark">
                    <span class="material-symbols-outlined text-gray-400 text-6xl mb-4">store</span>
                    <p class="text-gray-500 dark:text-gray-400 mb-4">Chưa có nhà hàng nào. Vui lòng thêm nhà hàng trước.</p>
                    <a href="manage_restaurant.html" class="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
                        Đến trang Quản lý nhà hàng
                    </a>
                </div>
            `;
            mainContainer.insertAdjacentHTML('beforeend', noDataHTML);
            return;
        }

        // Create container for restaurant cards
        const cardsHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6"></div>';
        mainContainer.insertAdjacentHTML('beforeend', cardsHTML);
        const cardsContainer = mainContainer.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');

        // ✅ FIXED: Use menu_item_count from API response instead of manually counting
        for (const branch of branches) {
            // The API already returns menu_item_count for each branch
            const menuItemCount = branch.menu_item_count || 0;
            console.log(`Branch ${branch.branch_name} has ${menuItemCount} menu items`);
            
            renderMenuBranchCard(branch, menuItemCount, cardsContainer);
        }

    } catch (error) {
        console.error("Error loading branches for menu:", error);
        alert("Lỗi tải danh sách nhà hàng: " + error.message);
    }
}

// Render a branch card for menu management
function renderMenuBranchCard(branch, menuItemCount, container) {
    if (!container) return;

    const activeStatus = branch.status === 'active' ? 'Đang hoạt động' : 'Bảo trì';
    const statusColor = branch.status === 'active' ? 'green' : 'orange';

    const card = `
        <div class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all group cursor-pointer overflow-hidden flex flex-col h-full">
            <div class="h-32 bg-gradient-to-r from-emerald-500 to-teal-500 relative">
                <div class="absolute bottom-4 left-5 w-16 h-16 rounded-full bg-white dark:bg-gray-800 p-1 shadow-lg flex items-center justify-center">
                    <div class="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                        ${branch.branch_name.substring(0, 2).toUpperCase()}
                    </div>
                </div>
                <div class="absolute top-4 right-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-${statusColor}-700 shadow-sm backdrop-blur-sm flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-${statusColor}-500"></span>
                        ${activeStatus}
                    </span>
                </div>
            </div>
            
            <div class="p-5 pt-8 flex-1 flex flex-col">
                <div class="mb-4">
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">${branch.branch_name}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                        <span class="material-symbols-outlined text-[16px] mr-1.5">location_on</span>
                        ${branch.address}
                    </p>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <div class="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Số lượng món</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${menuItemCount} món</p>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-lg">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Cập nhật cuối</p>
                        <p class="font-semibold text-gray-900 dark:text-white">${formatRelativeTime(branch.updated_at || branch.created_at)}</p>
                    </div>
                </div>
                
                <div class="mt-auto">
                    <a href="detail_menu.html?branch_id=${branch.branch_id}"
                       role="button"
                       aria-label="Quản lý thực đơn"
                       class="w-full py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-primary hover:text-white hover:border-primary dark:hover:bg-primary dark:hover:border-primary transition-all font-medium text-sm flex items-center justify-center group-button">
                        <span class="material-symbols-outlined text-[18px] mr-2">restaurant_menu</span>
                        Quản lý thực đơn
                        <span class="material-symbols-outlined text-[16px] ml-1 transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </a>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', card);
}

// Format relative time
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}p trước`;
    if (diffHours < 24) return `${diffHours}h trước`;
    if (diffDays < 7) return `${diffDays}d trước`;
    return date.toLocaleDateString('vi-VN');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initializePage();
});