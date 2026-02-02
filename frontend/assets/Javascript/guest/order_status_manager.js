/**
 * Order Status Manager
 * Handles order status for GUEST ordering system
 * 
 * Status Flow:
 * 1. preparing (đang chế biến) - Initial status when order is placed
 * 2. serving (đang phục vụ) - When food is being served
 * 3. completed (hoàn tất) - When order is complete
 * 
 * IMPORTANT: For the "multiple orders" scenario:
 * - When a NEW order is placed, status resets to "preparing"
 * - The UI shows the status of the LATEST order only
 * - Previous orders are ignored (simplest solution for 3-day deadline)
 */

const OrderStatusManager = (function() {
    'use strict';
    
    const STATUS_KEY = 'order_status';
    const LAST_ORDER_ID_KEY = 'last_order_id';
    
    // Valid status values
    const VALID_STATUSES = {
        PREPARING: 'preparing',
        SERVING: 'serving',
        COMPLETED: 'completed'
    };
    
    // Status progression order
    const STATUS_ORDER = [
        VALID_STATUSES.PREPARING,
        VALID_STATUSES.SERVING,
        VALID_STATUSES.COMPLETED
    ];
    
    /**
     * Get current order status
     * @returns {string} - Current status
     */
    function getCurrentStatus() {
        const status = localStorage.getItem(STATUS_KEY);
        
        // If no status or invalid, default to preparing
        if (!status || !Object.values(VALID_STATUSES).includes(status)) {
            console.warn('⚠️ No valid status found, defaulting to preparing');
            setStatus(VALID_STATUSES.PREPARING);
            return VALID_STATUSES.PREPARING;
        }
        
        return status;
    }
    
    /**
     * Set order status
     * @param {string} newStatus - New status to set
     * @returns {boolean} - Success
     */
    function setStatus(newStatus) {
        if (!Object.values(VALID_STATUSES).includes(newStatus)) {
            console.error('❌ Invalid status:', newStatus);
            return false;
        }
        
        const oldStatus = getCurrentStatus();
        localStorage.setItem(STATUS_KEY, newStatus);
        
        console.log(`📊 Status changed: ${oldStatus} → ${newStatus}`);
        
        // Trigger custom event for UI updates
        window.dispatchEvent(new CustomEvent('orderStatusChanged', {
            detail: { oldStatus, newStatus }
        }));
        
        return true;
    }
    
    /**
     * Reset status to preparing
     * Called when a NEW order is placed
     */
    function resetToPreparing() {
        setStatus(VALID_STATUSES.PREPARING);
        console.log('🔄 Order status reset to: preparing (new order placed)');
    }
    
    /**
     * Advance to next status
     * @returns {boolean} - Success
     */
    function advanceStatus() {
        const currentStatus = getCurrentStatus();
        const currentIndex = STATUS_ORDER.indexOf(currentStatus);
        
        if (currentIndex === -1) {
            console.error('❌ Invalid current status');
            return false;
        }
        
        if (currentIndex >= STATUS_ORDER.length - 1) {
            console.log('ℹ️ Already at final status');
            return false;
        }
        
        const nextStatus = STATUS_ORDER[currentIndex + 1];
        return setStatus(nextStatus);
    }
    
    /**
     * Check if status can advance
     * @returns {boolean}
     */
    function canAdvance() {
        const currentStatus = getCurrentStatus();
        const currentIndex = STATUS_ORDER.indexOf(currentStatus);
        return currentIndex < STATUS_ORDER.length - 1;
    }
    
    /**
     * Check if order is complete
     * @returns {boolean}
     */
    function isCompleted() {
        return getCurrentStatus() === VALID_STATUSES.COMPLETED;
    }
    
    /**
     * Get status display info
     * @param {string} status - Optional status (defaults to current)
     * @returns {Object} - Display info
     */
    function getStatusInfo(status = null) {
        const targetStatus = status || getCurrentStatus();
        
        const statusInfo = {
            [VALID_STATUSES.PREPARING]: {
                text: 'Đang chế biến',
                textEn: 'Preparing',
                color: '#39E079',
                icon: 'restaurant',
                step: 1
            },
            [VALID_STATUSES.SERVING]: {
                text: 'Đang phục vụ',
                textEn: 'Serving',
                color: '#39E079',
                icon: 'room_service',
                step: 2
            },
            [VALID_STATUSES.COMPLETED]: {
                text: 'Hoàn tất',
                textEn: 'Completed',
                color: '#22C55E',
                icon: 'check_circle',
                step: 3
            }
        };
        
        return statusInfo[targetStatus] || statusInfo[VALID_STATUSES.PREPARING];
    }
    
    /**
     * Get progress percentage
     * @returns {number} - Progress 0-100
     */
    function getProgress() {
        const currentStatus = getCurrentStatus();
        const currentIndex = STATUS_ORDER.indexOf(currentStatus);
        
        if (currentIndex === -1) return 0;
        
        return Math.round((currentIndex / (STATUS_ORDER.length - 1)) * 100);
    }
    
    /**
     * Save order ID
     * @param {string} orderId
     */
    function saveOrderId(orderId) {
        localStorage.setItem(LAST_ORDER_ID_KEY, orderId);
        console.log('💾 Saved order ID:', orderId);
    }
    
    /**
     * Get last order ID
     * @returns {string|null}
     */
    function getOrderId() {
        return localStorage.getItem(LAST_ORDER_ID_KEY);
    }
    
    /**
     * Clear all order data
     */
    function clear() {
        localStorage.removeItem(STATUS_KEY);
        localStorage.removeItem(LAST_ORDER_ID_KEY);
        console.log('🗑️ Order status data cleared');
    }
    
    // Public API
    return {
        // Status getters/setters
        getCurrentStatus,
        setStatus,
        resetToPreparing,
        advanceStatus,
        canAdvance,
        isCompleted,
        
        // Display info
        getStatusInfo,
        getProgress,
        
        // Order ID management
        saveOrderId,
        getOrderId,
        
        // Cleanup
        clear,
        
        // Constants
        STATUSES: VALID_STATUSES,
        STATUS_ORDER
    };
})();

// Export to window
window.OrderStatusManager = OrderStatusManager;

// Log initialization
console.log('✅ OrderStatusManager loaded');
console.log('📊 Current status:', OrderStatusManager.getCurrentStatus());