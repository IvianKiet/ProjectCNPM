// manage_table.js - Enhanced with JWT Authentication and proper initialization

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
        await loadBranchesWithTables();
        
    } catch (error) {
        console.error("Page initialization error:", error);
        alert("Lỗi khởi tạo trang. Vui lòng thử lại.");
    }
}

async function loadBranchesWithTables() {
    try {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            window.location.href = '../../index.html';
            return;
        }

        const branches = await BranchAPI.getAll();
        console.log("Loaded branches:", branches);

        // Update stats
        updateStats(branches);

        // Render branches
        await renderBranches(branches);

    } catch (error) {
        console.error("Error loading branches:", error);
        showError("Lỗi tải danh sách nhà hàng: " + error.message);
    }
}

function updateStats(branches) {
    const statsCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3 > div .text-3xl');
    if (statsCards[0]) {
        statsCards[0].textContent = branches.length;
    }
}

async function renderBranches(branches) {
    // Find where to insert branches - after the filter section
    const filterSection = document.querySelector('.bg-surface-light.dark\\:bg-surface-dark.p-4.rounded-xl');
    if (!filterSection) {
        console.error("Filter section not found");
        return;
    }

    // Remove any existing branch grid
    let existingGrid = filterSection.nextElementSibling;
    if (existingGrid && existingGrid.classList.contains('grid')) {
        existingGrid.remove();
    }

    if (!branches || branches.length === 0) {
        const noDataHTML = `
            <div class="mt-8 text-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark">
                <span class="material-icons text-gray-400 text-6xl mb-4">store</span>
                <p class="text-gray-500 dark:text-gray-400 mb-4">Chưa có nhà hàng nào. Vui lòng thêm nhà hàng trước.</p>
                <a href="manage_restaurant.html" class="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover">
                    Đến trang Quản lý nhà hàng
                </a>
            </div>
        `;
        filterSection.insertAdjacentHTML('afterend', noDataHTML);
        return;
    }

    // Create grid container
    const gridHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"></div>';
    filterSection.insertAdjacentHTML('afterend', gridHTML);
    const grid = filterSection.nextElementSibling;

    // Load and render each branch
    let totalTables = 0;
    let activeBranches = 0;

    for (const branch of branches) {
        try {
            const tables = await TableAPI.getAll(branch.branch_id);
            totalTables += tables.length;
            if (branch.status === 'active') activeBranches++;
            
            renderBranchCard(branch, tables, grid);
        } catch (error) {
            console.error(`Error loading tables for branch ${branch.branch_id}:`, error);
            renderBranchCard(branch, [], grid);
        }
    }

    // Update remaining stats
    const statsCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3 > div .text-3xl');
    if (statsCards[1]) statsCards[1].textContent = totalTables;
    if (statsCards[2]) statsCards[2].textContent = activeBranches;
}

function renderBranchCard(branch, tables, container) {
    const tableCount = tables.length;
    const statusText = branch.status === 'active' ? 'Đang hoạt động' : 'Bảo trì';
    const statusColor = branch.status === 'active' ? 'green' : 'orange';

    const card = `
        <div class="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div class="p-6">
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <span class="material-icons text-orange-600 dark:text-orange-400">restaurant</span>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800 dark:bg-${statusColor}-900/30 dark:text-${statusColor}-300">
                        ${statusText}
                    </span>
                </div>
                
                <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">${branch.branch_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center">
                    <span class="material-icons text-xs mr-1">location_on</span>
                    ${branch.address}
                </p>
                
                <div class="py-4 border-t border-border-light dark:border-border-dark">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tổng số bàn</span>
                            <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">${tableCount}</p>
                        </div>
                        <div>
                            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mã QR</span>
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">${tableCount > 0 ? tableCount + ' mã' : 'Chưa có'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex items-center justify-between border-t border-border-light dark:border-border-dark">
                <span class="text-sm text-gray-500 dark:text-gray-400">Cập nhật: ${formatDate(branch.created_at)}</span>
                <a href="table_detail.html?branch_id=${branch.branch_id}" 
                   class="text-primary hover:text-primary-hover font-medium text-sm flex items-center">
                    Quản lý bàn
                    <span class="material-icons text-sm ml-1">arrow_forward</span>
                </a>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', card);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

function showError(message) {
    const filterSection = document.querySelector('.bg-surface-light.dark\\:bg-surface-dark.p-4.rounded-xl');
    if (filterSection) {
        filterSection.insertAdjacentHTML('afterend', `
            <div class="mt-8 text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <p class="text-red-600 dark:text-red-400">${message}</p>
            </div>
        `);
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initializePage();
});