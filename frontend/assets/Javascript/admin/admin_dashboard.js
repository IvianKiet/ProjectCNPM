// admin_dashboard.js - Admin Dashboard with Database Connection & AI Configuration

// ============================================
// API CONFIGURATION
// ============================================
const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    AI_BASE_URL: 'http://localhost:8001',  // ✅ NEW: Separate AI API endpoint
    
    ENDPOINTS: {
        GET_STATS: '/api/admin/dashboard',
        GET_AI_CONFIG: '/ai-config',  // ✅ NEW
        UPDATE_AI_CONFIG: '/ai-config',  // ✅ NEW
    },
    
    USE_API: true,
};

// ============================================
// AI CONFIGURATION DEFAULTS
// ============================================
const AI_DEFAULTS = {
    system_prompt: "Bạn là trợ lý AI thân thiện của nhà hàng. Trả lời câu hỏi về thực đơn, giờ mở cửa, địa chỉ, và đặt bàn một cách chuyên nghiệp và thân thiện. Luôn cung cấp thông tin chính xác dựa trên dữ liệu của nhà hàng.",
    temperature: 50
};

// ============================================
// FETCH DASHBOARD STATS
// ============================================
async function fetchDashboardStats() {
    if (!API_CONFIG.USE_API) {
        console.log('🔴 API mode disabled');
        updateStatsUI({
            total_restaurants: 128,
            total_users: 12450,
            active_restaurants: 120,
            active_users: 12100
        });
        return;
    }

    try {
        console.log('🔄 Fetching admin stats from API...');
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GET_STATS}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Stats loaded from database:', data);
        
        updateStatsUI(data);
        
    } catch (error) {
        console.error('❌ Error fetching stats:', error.message);
        showNotification('Không thể tải thống kê. Sử dụng dữ liệu mẫu.', 'warning');
        
        // Fallback to empty data
        updateStatsUI({
            total_restaurants: 0,
            total_users: 0,
            active_restaurants: 0,
            active_users: 0
        });
    }
}

// ============================================
// UPDATE UI WITH STATS
// ============================================
function updateStatsUI(stats) {
    // Update total restaurants
    const totalRestaurantsEl = document.getElementById('total-restaurants');
    if (totalRestaurantsEl) {
        totalRestaurantsEl.textContent = stats.total_restaurants.toLocaleString('vi-VN');
    }
    
    // Update active restaurants
    const activeRestaurantsEl = document.getElementById('active-restaurants');
    if (activeRestaurantsEl) {
        activeRestaurantsEl.textContent = stats.active_restaurants.toLocaleString('vi-VN');
    }
    
    // Update total users
    const totalUsersEl = document.getElementById('total-users');
    if (totalUsersEl) {
        totalUsersEl.textContent = stats.total_users.toLocaleString('vi-VN');
    }
    
    // Update active users
    const activeUsersEl = document.getElementById('active-users');
    if (activeUsersEl) {
        activeUsersEl.textContent = stats.active_users.toLocaleString('vi-VN');
    }
    
    console.log(`📊 Dashboard updated: ${stats.total_restaurants} restaurants, ${stats.total_users} users`);
}

// ============================================
// AI CONFIGURATION - FETCH
// ============================================
async function fetchAIConfig() {
    try {
        console.log('🤖 Fetching AI configuration...');
        
        const response = await fetch(`${API_CONFIG.AI_BASE_URL}${API_CONFIG.ENDPOINTS.GET_AI_CONFIG}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ AI config loaded:', data);
        
        updateAIConfigUI(data);
        updateAIStatusBadge('active');
        
    } catch (error) {
        console.error('❌ Error fetching AI config:', error.message);
        showNotification('Không thể tải cấu hình AI. Sử dụng giá trị mặc định.', 'warning');
        
        // Fallback to defaults
        updateAIConfigUI(AI_DEFAULTS);
        updateAIStatusBadge('error');
    }
}

// ============================================
// AI CONFIGURATION - UPDATE UI
// ============================================
function updateAIConfigUI(config) {
    const systemPromptEl = document.getElementById('system-prompt');
    const temperatureSliderEl = document.getElementById('temperature-slider');
    const temperatureDisplayEl = document.getElementById('temperature-display');
    
    if (systemPromptEl) {
        systemPromptEl.value = config.system_prompt || AI_DEFAULTS.system_prompt;
    }
    
    if (temperatureSliderEl && temperatureDisplayEl) {
        const temperature = config.temperature !== undefined ? config.temperature : AI_DEFAULTS.temperature;
        temperatureSliderEl.value = temperature;
        temperatureDisplayEl.textContent = temperature;
    }
    
    console.log('✅ AI Config UI updated');
}

// ============================================
// AI CONFIGURATION - UPDATE STATUS BADGE
// ============================================
function updateAIStatusBadge(status) {
    const badge = document.getElementById('ai-status-badge');
    if (!badge) return;
    
    const statusConfig = {
        active: {
            text: 'Đang hoạt động',
            classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
        },
        error: {
            text: 'Lỗi kết nối',
            classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
        },
        loading: {
            text: 'Đang tải...',
            classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
        }
    };
    
    const config = statusConfig[status] || statusConfig.loading;
    badge.textContent = config.text;
    badge.className = `px-2.5 py-1 rounded-full text-xs font-medium border ${config.classes}`;
}

// ============================================
// AI CONFIGURATION - SAVE
// ============================================
async function saveAIConfig() {
    const systemPromptEl = document.getElementById('system-prompt');
    const temperatureSliderEl = document.getElementById('temperature-slider');
    
    if (!systemPromptEl || !temperatureSliderEl) {
        showNotification('Không tìm thấy trường cấu hình', 'error');
        return;
    }
    
    const systemPrompt = systemPromptEl.value.trim();
    const temperature = parseInt(temperatureSliderEl.value);
    
    // Validation
    if (!systemPrompt) {
        showNotification('System prompt không được để trống', 'error');
        return;
    }
    
    if (temperature < 0 || temperature > 100) {
        showNotification('Temperature phải từ 0 đến 100', 'error');
        return;
    }
    
    try {
        console.log('💾 Saving AI configuration...');
        updateAIStatusBadge('loading');
        
        const response = await fetch(`${API_CONFIG.AI_BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_AI_CONFIG}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                system_prompt: systemPrompt,
                temperature: temperature
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ AI config saved:', data);
        
        showNotification('Cấu hình AI đã được lưu thành công!', 'success');
        updateAIStatusBadge('active');
        
    } catch (error) {
        console.error('❌ Error saving AI config:', error.message);
        showNotification(`Lỗi khi lưu cấu hình: ${error.message}`, 'error');
        updateAIStatusBadge('error');
    }
}

// ============================================
// AI CONFIGURATION - RESET TO DEFAULTS
// ============================================
function resetAIConfig() {
    const confirmed = confirm('Bạn có chắc muốn khôi phục cấu hình mặc định? Thao tác này sẽ xóa các thay đổi chưa lưu.');
    
    if (confirmed) {
        updateAIConfigUI(AI_DEFAULTS);
        showNotification('Đã khôi phục cấu hình mặc định. Nhấn "Lưu cấu hình" để áp dụng.', 'info');
    }
}

// ============================================
// TEMPERATURE SLIDER - REAL-TIME UPDATE
// ============================================
function setupTemperatureSlider() {
    const slider = document.getElementById('temperature-slider');
    const display = document.getElementById('temperature-display');
    
    if (slider && display) {
        slider.addEventListener('input', (e) => {
            display.textContent = e.target.value;
        });
    }
}

// ============================================
// NOTIFICATION FUNCTION
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
// EVENT LISTENERS SETUP
// ============================================
function setupEventListeners() {
    // AI Configuration - Save button
    const saveBtnAI = document.getElementById('btn-save-ai');
    if (saveBtnAI) {
        saveBtnAI.addEventListener('click', saveAIConfig);
    }
    
    // AI Configuration - Reset button
    const resetBtnAI = document.getElementById('btn-reset-ai');
    if (resetBtnAI) {
        resetBtnAI.addEventListener('click', resetAIConfig);
    }
    
    // Temperature slider real-time update
    setupTemperatureSlider();
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Admin Dashboard initialized');
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch initial data
    fetchDashboardStats();
    fetchAIConfig();
    
    // Refresh stats every 30 seconds (not AI config, as it changes less frequently)
    setInterval(fetchDashboardStats, 30000);
});