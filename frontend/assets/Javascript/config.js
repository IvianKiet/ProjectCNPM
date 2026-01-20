// API Configuration
const API_CONFIG = {
    BASE_URL: "http://localhost:8000/api",
    TIMEOUT: 10000, // 10 seconds
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: API_CONFIG.TIMEOUT,
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, config);
        
        // Handle non-JSON responses (like 204 No Content)
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

// Storage using localStorage (this is a standard web page, not an artifact)
const Storage = {
    setUser(userData) {
        localStorage.setItem('user_id', userData.user_id || '');
        localStorage.setItem('tenant_id', userData.tenant_id || '');
        localStorage.setItem('full_name', userData.full_name || '');
        localStorage.setItem('email', userData.email || '');
    },
    
    getUser() {
        return {
            user_id: localStorage.getItem('user_id'),
            tenant_id: localStorage.getItem('tenant_id'),
            full_name: localStorage.getItem('full_name'),
            email: localStorage.getItem('email'),
        };
    },
    
    getTenantId() {
        return localStorage.getItem('tenant_id');
    },
    
    getUserId() {
        return localStorage.getItem('user_id');
    },
    
    isLoggedIn() {
        return !!localStorage.getItem('user_id');
    },
    
    clearUser() {
        localStorage.removeItem('user_id');
        localStorage.removeItem('tenant_id');
        localStorage.removeItem('full_name');
        localStorage.removeItem('email');
    }
};

// Auth API calls
const AuthAPI = {
    async register(fullName, email, password) {
        return apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password
            })
        });
    },
    
    async login(email, password) {
        return apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
    },
    
    logout() {
        Storage.clearUser();
        window.location.href = '/index.html';
    }
};

// Branch/Restaurant API calls
const BranchAPI = {
    async create(branchData) {
        const tenantId = Storage.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/branches?tenant_id=${tenantId}`, {
            method: 'POST',
            body: JSON.stringify(branchData)
        });
    },
    
    async getAll() {
        const tenantId = Storage.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/branches?tenant_id=${tenantId}`);
    },
    
    async getOne(branchId) {
        return apiCall(`/branches/${branchId}`);
    },
    
    async update(branchId, branchData) {
        return apiCall(`/branches/${branchId}`, {
            method: 'PUT',
            body: JSON.stringify(branchData)
        });
    },
    
    async delete(branchId) {
        return apiCall(`/branches/${branchId}`, {
            method: 'DELETE'
        });
    }
};

// Table API calls
const TableAPI = {
    async create(branchId, tableData) {
        return apiCall(`/branches/${branchId}/tables`, {
            method: 'POST',
            body: JSON.stringify(tableData)
        });
    },
    
    async getAll(branchId) {
        return apiCall(`/branches/${branchId}/tables`);
    },
    
    async getOne(tableId) {
        return apiCall(`/tables/${tableId}`);
    },
    
    async update(tableId, tableData) {
        return apiCall(`/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify(tableData)
        });
    },
    
    async delete(tableId) {
        return apiCall(`/tables/${tableId}`, {
            method: 'DELETE'
        });
    },
    
    async generateQR(tableId) {
        return apiCall(`/tables/${tableId}/qr`, {
            method: 'POST'
        });
    },
    
    async getQR(tableId) {
        return apiCall(`/tables/${tableId}/qr`);
    }
};

// Category API calls
const CategoryAPI = {
    async create(categoryData) {
        const tenantId = Storage.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/categories?tenant_id=${tenantId}`, {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    },
    
    async getAll() {
        const tenantId = Storage.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/categories?tenant_id=${tenantId}`);
    }
};

// Menu Item API calls
const MenuAPI = {
    async create(menuItemData) {
        return apiCall('/menu-items', {
            method: 'POST',
            body: JSON.stringify(menuItemData)
        });
    },
    
    async getByCategory(categoryId) {
        return apiCall(`/categories/${categoryId}/menu-items`);
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

// Dashboard Stats API
const StatsAPI = {
    async getDashboard() {
        const tenantId = Storage.getTenantId();
        if (!tenantId) {
            throw new Error('Not logged in');
        }
        return apiCall(`/stats/${tenantId}`);
    }
};

// Check if user is logged in on protected pages
function requireLogin() {
    if (!Storage.isLoggedIn()) {
        window.location.href = '/index.html';
    }
}

// Call this at the top of protected pages
// Uncomment the line below if you want to enforce login on all pages
// requireLogin();