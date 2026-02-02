// ============================================
// DOCKER-READY API CONFIGURATION FOR FRONTEND
// ============================================
// This file centralizes all API endpoints
// Easy to change for Docker deployment

const API_CONFIG = {
    // Change these to your Docker container URLs
    BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8000' 
        : `http://${window.location.hostname}:8000`,
    
    AI_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8001' 
        : `http://${window.location.hostname}:8001`,
    
    // Timeout settings
    TIMEOUT: 30000, // 30 seconds
    
    // Feature flags
    USE_API: true,
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;

console.log('🔗 API Configuration loaded:');
console.log('   Main API:', API_CONFIG.BASE_URL);
console.log('   AI API:', API_CONFIG.AI_BASE_URL);