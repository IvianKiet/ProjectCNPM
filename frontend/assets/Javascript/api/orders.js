// assets/Javascript/api/orders.js
// Order Management API

// Use the same API config as auth.js
const API_CONFIG = window.API_CONFIG || {
    BASE_URL: 'http://localhost:8000',
    AI_BASE_URL: 'http://localhost:8001',
    USE_API: true
};

const OrderAPI = {
    /**
     * Get all orders with optional filters
     */
    async getAll(branchId = null, status = null) {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('No authentication token found');

            let url = `${API_BASE_URL}/api/orders?`;
            if (branchId) url += `branch_id=${branchId}&`;
            if (status) url += `status_filter=${status}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to fetch orders');
            }

            return await response.json();
        } catch (error) {
            console.error('OrderAPI.getAll error:', error);
            throw error;
        }
    },

    /**
     * Get specific order by ID
     */
    async getOne(orderId) {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to fetch order');
            }

            return await response.json();
        } catch (error) {
            console.error('OrderAPI.getOne error:', error);
            throw error;
        }
    },

    /**
     * Update order status
     * Kitchen: 'ordered' -> 'cooking' -> 'ready'
     * Staff: 'ready' -> 'serving' -> 'done'
     */
    async updateStatus(orderId, newStatus) {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status?new_status=${newStatus}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update order status');
            }

            return await response.json();
        } catch (error) {
            console.error('OrderAPI.updateStatus error:', error);
            throw error;
        }
    },

    /**
     * Generate random order for testing (simulates guest ordering)
     */
    async generateRandom(branchId) {
        try {
            // Get token
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('No authentication token found');
            
            const response = await fetch(`${API_BASE_URL}/api/orders/generate-random?branch_id=${branchId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to generate random order');
            }

            return await response.json();
        } catch (error) {
            console.error('OrderAPI.generateRandom error:', error);
            throw error;
        }
    },

    /**
     * Create order (for guest ordering via QR - doesn't need auth)
     */
    async create(tableId, items, customerId = null) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table_id: tableId,
                    items: items,
                    customer_id: customerId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create order');
            }

            return await response.json();
        } catch (error) {
            console.error('OrderAPI.create error:', error);
            throw error;
        }
    },

    /**
     * Get orders grouped by status for kitchen/staff display
     */
    async getGroupedByStatus(branchId) {
        try {
            const allOrders = await this.getAll(branchId);
            
            return {
                ordered: allOrders.filter(o => o.status === 'ordered'),
                cooking: allOrders.filter(o => o.status === 'cooking'),
                ready: allOrders.filter(o => o.status === 'ready'),
                serving: allOrders.filter(o => o.status === 'serving'),
                done: allOrders.filter(o => o.status === 'done')
            };
        } catch (error) {
            console.error('OrderAPI.getGroupedByStatus error:', error);
            throw error;
        }
    }
};