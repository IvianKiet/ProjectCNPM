// Enhanced Owner Dashboard with JWT Authentication

// ============================================
// CONFIGURATION
// ============================================
const API_BASE = 'http://localhost:8000';

// ============================================
// AUTH HELPERS  (thin wrappers — auth.js sets
// localStorage keys; we just read them here)
// ============================================
function getToken() {
    return localStorage.getItem('access_token');
}

function getTenantId() {
    // 1. Prefer the global set by initAuthenticatedPage() — always populated first
    if (currentUser && currentUser.tenant_id) {
        return currentUser.tenant_id;
    }
    // 2. Fall back to whatever key auth.js might use in localStorage
    try {
        const stored = localStorage.getItem('current_user')
            || localStorage.getItem('user');
        if (stored) {
            const user = JSON.parse(stored);
            return user.tenant_id || null;
        }
    } catch {
        // ignore JSON parse errors
    }
    return null;
}

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

// ============================================
// STATE
// ============================================
let currentUser = null;

// ============================================
// INITIALISE
// ============================================
async function initializeDashboard() {
    try {
        // If auth.js exposes initAuthenticatedPage, use it;
        // otherwise fall back to reading localStorage directly.
        if (typeof initAuthenticatedPage === 'function') {
            currentUser = await initAuthenticatedPage();
            if (!currentUser) return; // redirected to login
        } else {
            // Minimal fallback: verify token is present
            if (!getToken()) {
                window.location.href = 'login.html';
                return;
            }
        }

        console.log("Current user:", currentUser);

        // Setup logout button (auth.js helper)
        if (typeof setupLogoutButton === 'function') {
            setupLogoutButton('#logout-btn');
        }

        // Setup token refresh (auth.js helper)
        if (typeof setupTokenRefresh === 'function') {
            setupTokenRefresh();
        }

        // Load real dashboard data
        await loadDashboardStats();

    } catch (error) {
        console.error("Dashboard initialization error:", error);
        alert("Lỗi khởi tạo dashboard. Vui lòng thử lại.");
    }
}

// ============================================
// FETCH STATS FROM BACKEND
// ============================================
async function fetchStats() {
    const tenantId = getTenantId();
    if (!tenantId) {
        console.error("No tenant_id available");
        return null;
    }

    const url = `${API_BASE}/api/stats/${tenantId}`;
    console.log("📊 Fetching stats:", url);

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) {
        console.error("Stats API error:", res.status, await res.text());
        return null;
    }

    return res.json();
}

// ============================================
// FETCH BRANCHES FROM BACKEND
// ============================================
async function fetchBranches() {
    const tenantId = getTenantId();
    if (!tenantId) {
        console.error("No tenant_id available");
        return [];
    }

    const url = `${API_BASE}/api/branches?tenant_id=${tenantId}`;
    console.log("🏢 Fetching branches:", url);

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) {
        console.error("Branches API error:", res.status, await res.text());
        return [];
    }

    return res.json();
}

// ============================================
// LOAD & RENDER DASHBOARD
// ============================================
async function loadDashboardStats() {
    try {
        const stats = await fetchStats();
        if (!stats) {
            showDashboardError();
            return;
        }

        console.log("Dashboard stats:", stats);

        // ── Orders today ──
        const ordersElement = document.querySelector(
            '.grid.grid-cols-1.md\\:grid-cols-2 > div:nth-child(1) .text-2xl'
        );
        if (ordersElement) {
            ordersElement.textContent = stats.today_orders || 0;
        }

        // ── Monthly revenue (real value from DB, not an estimate) ──
        const monthlyElement = document.querySelector(
            '.grid.grid-cols-1.md\\:grid-cols-2 > div:nth-child(2) .text-2xl'
        );
        if (monthlyElement) {
            monthlyElement.textContent = formatCurrency(stats.monthly_revenue || 0);
        }

        // Load branch summary section
        await loadBranchSummary();

    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        showDashboardError();
    }
}

// ============================================
// BRANCH SUMMARY SECTION
// ============================================
async function loadBranchSummary() {
    try {
        const branches = await fetchBranches();

        const summaryContainer = document.querySelector('.max-w-7xl.mx-auto');
        if (!summaryContainer) return;

        // Remove any previously rendered summary
        const existingSummary = summaryContainer.querySelector('.branch-summary-section');
        if (existingSummary) existingSummary.remove();

        const summaryHTML = `
            <div class="mt-8 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-6 branch-summary-section">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Chi nhánh hoạt động</h2>
                    <a href="manage_restaurant.html" class="text-primary hover:text-primary-hover text-sm font-medium">
                        Xem tất cả →
                    </a>
                </div>
                <div class="space-y-3">
                    ${branches.length === 0
                        ? '<p class="text-gray-500 dark:text-gray-400 text-center py-4">Chưa có chi nhánh nào. <a href="manage_restaurant.html" class="text-primary hover:text-primary-hover">Thêm chi nhánh</a></p>'
                        : branches.slice(0, 5).map(branch => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-primary/10 rounded-lg">
                                        <span class="material-symbols-outlined text-primary text-xl">restaurant</span>
                                    </div>
                                    <div>
                                        <h3 class="font-medium text-gray-900 dark:text-white">${branch.branch_name}</h3>
                                        <p class="text-xs text-gray-500 dark:text-gray-400">${branch.address}</p>
                                    </div>
                                </div>
                                <span class="px-2 py-1 text-xs font-medium rounded-full ${
                                    branch.status === 'active'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                }">
                                    ${branch.status === 'active' ? 'Hoạt động' : 'Bảo trì'}
                                </span>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;

        // Insert right after the stats cards grid
        const statsGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
        if (statsGrid) {
            statsGrid.insertAdjacentHTML('afterend', summaryHTML);
        }

    } catch (error) {
        console.error("Error loading branch summary:", error);
    }
}

// ============================================
// FORMATTING
// ============================================
function formatCurrency(amount) {
    if (amount === 0) return '0₫';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// ============================================
// ERROR STATE
// ============================================
function showDashboardError() {
    document.querySelectorAll('.text-2xl').forEach(el => {
        if (el.textContent === '--') {
            el.textContent = 'N/A';
            el.classList.add('text-gray-400');
        }
    });
}

// ============================================
// AUTO-REFRESH (every 5 minutes)
// ============================================
let refreshInterval;

function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        loadDashboardStats();
    }, 300000);
}

function stopAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
}

// ============================================
// LIFECYCLE
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    initializeDashboard().then(() => {
        startAutoRefresh();
    });
});

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});