// ============== Enhanced Authentication Utilities with JWT ==============
// This file provides reusable authentication functions for owner, staff, and customer

// API Configuration
const API_CONFIG = {
    BASE_URL: "http://localhost:8000/api",
    TIMEOUT: 10000,
};

// ============== Token Management ==============
const TokenManager = {
    /**
     * Store authentication token
     */
    setToken(token) {
        localStorage.setItem('access_token', token);
    },
    
    /**
     * Get authentication token
     */
    getToken() {
        return localStorage.getItem('access_token');
    },
    
    /**
     * Remove authentication token
     */
    clearToken() {
        localStorage.removeItem('access_token');
    },
    
    /**
     * Check if token exists
     */
    hasToken() {
        return !!this.getToken();
    },
    
    /**
     * Store token expiration time
     */
    setTokenExpiration(expiresIn) {
        const expirationTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('token_expiration', expirationTime.toString());
    },
    
    /**
     * Check if token is expired
     */
    isTokenExpired() {
        const expiration = localStorage.getItem('token_expiration');
        if (!expiration) return true;
        return Date.now() > parseInt(expiration);
    }
};

// ============== User Data Management ==============
const UserManager = {
    /**
     * Store user data
     */
    setUser(userData) {
        localStorage.setItem('user_id', userData.user_id || '');
        localStorage.setItem('tenant_id', userData.tenant_id || '');
        localStorage.setItem('full_name', userData.full_name || '');
        localStorage.setItem('email', userData.email || '');
        localStorage.setItem('role', userData.role || 'owner');
    },
    
    /**
     * Get user data
     */
    getUser() {
        return {
            user_id: localStorage.getItem('user_id'),
            tenant_id: localStorage.getItem('tenant_id'),
            full_name: localStorage.getItem('full_name'),
            email: localStorage.getItem('email'),
            role: localStorage.getItem('role')
        };
    },
    
    /**
     * Get tenant ID
     */
    getTenantId() {
        return localStorage.getItem('tenant_id');
    },
    
    /**
     * Get user ID
     */
    getUserId() {
        return localStorage.getItem('user_id');
    },
    
    /**
     * Get user role
     */
    getRole() {
        return localStorage.getItem('role') || 'owner';
    },
    
    /**
     * Get user full name
     */
    getFullName() {
        return localStorage.getItem('full_name') || 'User';
    },
    
    /**
     * Clear all user data
     */
    clearUser() {
        localStorage.removeItem('user_id');
        localStorage.removeItem('tenant_id');
        localStorage.removeItem('full_name');
        localStorage.removeItem('email');
        localStorage.removeItem('role');
    }
};

// ============== API Helper with JWT ==============
async function apiCall(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: API_CONFIG.TIMEOUT,
    };
    
    // Add JWT token to headers if it exists
    const token = TokenManager.getToken();
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = { ...defaultOptions, ...options };
    
    // Merge headers properly
    if (options.headers) {
        config.headers = { ...defaultOptions.headers, ...options.headers };
    }
    
    try {
        const response = await fetch(url, config);
        
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
            // Clear auth data and redirect to login
            Auth.logout();
            window.location.href = '../../index.html';
            throw new Error('Session expired. Please login again.');
        }
        
        // Handle 403 Forbidden - insufficient permissions
        if (response.status === 403) {
            throw new Error('You do not have permission to access this resource.');
        }
        
        // Handle 204 No Content
        if (response.status === 204) {
            return { success: true };
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// ============== Authentication API ==============
const Auth = {
    /**
     * Register a new user
     */
    async register(fullName, email, password) {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password
            })
        });
        
        // Store token and user data
        TokenManager.setToken(response.access_token);
        TokenManager.setTokenExpiration(response.expires_in);
        UserManager.setUser(response.user);
        
        return response;
    },
    
    /**
     * Login user
     */
    async login(email, password) {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        // Store token and user data
        TokenManager.setToken(response.access_token);
        TokenManager.setTokenExpiration(response.expires_in);
        UserManager.setUser(response.user);
        
        return response;
    },
    
    /**
     * Logout user
     */
    logout() {
        // Call logout endpoint (optional)
        try {
            apiCall('/auth/logout', { method: 'POST' }).catch(() => {});
        } catch (error) {
            // Ignore errors during logout
        }
        
        // Clear local storage
        TokenManager.clearToken();
        UserManager.clearUser();
        localStorage.removeItem('token_expiration');
        
        // Redirect to login
        window.location.href = '../../index.html';
    },
    
    /**
     * Get current user profile from server
     */
    async getCurrentUser() {
        try {
            const profile = await apiCall('/auth/me');
            // Update local storage with fresh data
            UserManager.setUser({
                user_id: profile.user_id,
                email: profile.email,
                full_name: profile.full_name,
                tenant_id: profile.tenant_id,
                role: profile.role
            });
            return profile;
        } catch (error) {
            console.error('Failed to get current user:', error);
            throw error;
        }
    },
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return TokenManager.hasToken() && !TokenManager.isTokenExpired();
    }
};

// ============== Branch/Restaurant API ==============
const BranchAPI = {
    /**
     * Get all branches for current tenant
     */
    async getAll() {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/branches?tenant_id=${tenantId}`);
    },
    
    /**
     * Get a single branch by ID
     */
    async getOne(branchId) {
        return apiCall(`/branches/${branchId}`);
    },
    
    /**
     * Create a new branch
     */
    async create(branchData) {
        return apiCall('/branches', {
            method: 'POST',
            body: JSON.stringify(branchData)
        });
    },
    
    /**
     * Update a branch
     */
    async update(branchId, branchData) {
        return apiCall(`/branches/${branchId}`, {
            method: 'PUT',
            body: JSON.stringify(branchData)
        });
    },
    
    /**
     * Delete a branch
     */
    async delete(branchId) {
        return apiCall(`/branches/${branchId}`, {
            method: 'DELETE'
        });
    }
};

// ============== Table API ==============
const TableAPI = {
    /**
     * Get all tables for a branch
     */
    async getAll(branchId) {
        return apiCall(`/branches/${branchId}/tables`);
    },
    
    /**
     * Get a single table by ID
     */
    async getOne(tableId) {
        return apiCall(`/tables/${tableId}`);
    },
    
    /**
     * Create a new table
     */
    async create(branchId, tableData) {
        return apiCall(`/branches/${branchId}/tables`, {
            method: 'POST',
            body: JSON.stringify(tableData)
        });
    },
    
    /**
     * Update a table
     */
    async update(tableId, tableData) {
        return apiCall(`/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify(tableData)
        });
    },
    
    /**
     * Delete a table
     */
    async delete(tableId) {
        return apiCall(`/tables/${tableId}`, {
            method: 'DELETE'
        });
    },
    
    /**
     * Generate/Get QR code for a table
     * This is the method that was missing!
     */
    async generateQR(tableId) {
        return apiCall(`/tables/${tableId}/qr-code`);
    }
};

// ============== Category API ==============
const CategoryAPI = {
    async create(categoryData) {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/categories?tenant_id=${tenantId}`, {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    },
    
    async getAll() {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/categories?tenant_id=${tenantId}`);
    }
};

// ============== Menu Item API ==============
const MenuAPI = {
    async create(menuItemData) {
        return apiCall('/menu-items', {
            method: 'POST',
            body: JSON.stringify(menuItemData)
        });
    },
    
    async getByCategory(categoryId, branchId) {
        return apiCall(`/categories/${categoryId}/menu-items?branch_id=${branchId}`);
    },

    // ALSO ADDED a new method:
    async getByBranch(branchId) {
        return apiCall(`/branches/${branchId}/menu-items`);
    },

    
    async getOne(menuItemId) {
        return apiCall(`/menu-items/${menuItemId}`);
    },
    
    async update(menuItemId, menuItemData) {
        return apiCall(`/menu-items/${menuItemId}`, {
            method: 'PUT',
            body: JSON.stringify(menuItemData)
        });
    },
    
    async delete(menuItemId) {
        return apiCall(`/menu-items/${menuItemId}`, {
            method: 'DELETE'
        });
    }
};

// ============== Cashback API ==============
const CashbackAPI = {
    async getSettings() {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/tenants/${tenantId}/cashback`);
    },
    
    async updateSettings(cashbackPercent) {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/tenants/${tenantId}/cashback`, {
            method: 'PUT',
            body: JSON.stringify({
                cashback_percent: cashbackPercent
            })
        });
    }
};

// ============== Dashboard Stats API ==============
const StatsAPI = {
    async getDashboard() {
        const tenantId = UserManager.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/stats/${tenantId}`);
    }
};

// ============== Session Management ==============

/**
 * Require user to be logged in on protected pages
 * Call this at the top of protected pages
 */
function requireAuth() {
    if (!Auth.isAuthenticated()) {
        // Redirect to login
        window.location.href = '../../index.html';
        return false;
    }
    return true;
}

/**
 * Check authentication and update UI with user info
 * Call this on page load for protected pages
 */
async function initAuthenticatedPage() {
    if (!requireAuth()) {
        return null;
    }
    
    try {
        // Refresh user data from server
        const userProfile = await Auth.getCurrentUser();
        
        // Update user display elements
        updateUserDisplay(userProfile);
        
        return userProfile;
    } catch (error) {
        console.error('Failed to initialize authenticated page:', error);
        // If we can't get user data, logout
        Auth.logout();
        return null;
    }
}

/**
 * Update user display elements in the UI
 */
function updateUserDisplay(userProfile) {
    // Update all elements with class 'user-full-name'
    document.querySelectorAll('.user-full-name').forEach(el => {
        el.textContent = userProfile.full_name;
    });
    
    // Update all elements with class 'user-email'
    document.querySelectorAll('.user-email').forEach(el => {
        el.textContent = userProfile.email;
    });
    
    // Update all elements with class 'user-role'
    document.querySelectorAll('.user-role').forEach(el => {
        const roleText = {
            'owner': 'Chủ nhà hàng',
            'staff': 'Nhân viên',
            'customer': 'Khách hàng'
        }[userProfile.role] || 'Người dùng';
        el.textContent = roleText;
    });
    
    // Update tenant name if exists
    document.querySelectorAll('.tenant-name').forEach(el => {
        el.textContent = userProfile.tenant_name || 'Restaurant Group';
    });
}

/**
 * Setup logout button
 * Call this on page load to attach logout handler
 */
function setupLogoutButton(selector = '#logout-btn') {
    const logoutBtn = document.querySelector(selector);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Bạn có chắc muốn đăng xuất?')) {
                Auth.logout();
            }
        });
    }
}

/**
 * Auto-refresh token before expiration
 * Call this once on authenticated pages
 */
function setupTokenRefresh() {
    // Check token expiration every minute
    setInterval(() => {
        if (TokenManager.isTokenExpired()) {
            alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
            Auth.logout();
        }
    }, 60000); // Check every minute
}

// ============== Staff Cash-Payment API ==============
const BillAPI = {
    /**
     * Get all cash_pending bills for a branch (staff cashier view)
     */
    async getCashPending(branchId) {
        return apiCall(`/staff/cash-pending?branch_id=${branchId}`);
    },

    /**
     * Confirm that cash has been physically collected for a bill
     */
    async confirmCashPayment(billId) {
        return apiCall(`/staff/cash-pending/${billId}/confirm`, {
            method: 'PUT'
        });
    },

    /**
     * Get all QR-paid bills waiting for staff verification for a branch
     */
    async getQRPaid(branchId) {
        return apiCall(`/staff/qr-paid?branch_id=${branchId}`);
    },

    /**
     * Verify QR payment (staff checks their bank and confirms)
     */
    async verifyQRPayment(billId) {
        return apiCall(`/staff/qr-paid/${billId}/verify`, {
            method: 'PUT'
        });
    }
};

// ============== Export for use in HTML pages ==============
// These are now available globally
window.Auth = Auth;
window.BranchAPI = BranchAPI;
window.TableAPI = TableAPI;
window.CategoryAPI = CategoryAPI;
window.MenuAPI = MenuAPI;
window.CashbackAPI = CashbackAPI;
window.StatsAPI = StatsAPI;
window.BillAPI = BillAPI;
window.UserManager = UserManager;
window.requireAuth = requireAuth;
window.initAuthenticatedPage = initAuthenticatedPage;
window.updateUserDisplay = updateUserDisplay;
window.setupLogoutButton = setupLogoutButton;
window.setupTokenRefresh = setupTokenRefresh;