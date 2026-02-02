// ============================================
// GUEST PAGES UTILITIES
// Fix navigation and placeholder images
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // URL PARAMETER PRESERVATION
    // ============================================
    
    /**
     * Get current URL parameters
     */
    function getCurrentParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            branch_id: urlParams.get('branch_id') || localStorage.getItem('current_branch_id'),
            table_id: urlParams.get('table_id') || localStorage.getItem('current_table_id')
        };
    }
    
    // Stored promise so other scripts can await the table number being ready
    let tableNumberReadyResolve;
    const tableNumberReady = new Promise(resolve => { tableNumberReadyResolve = resolve; });

    /**
     * Save parameters to localStorage
     */
    function saveParamsToStorage() {
        const urlParams = new URLSearchParams(window.location.search);
        const branchId = urlParams.get('branch_id');
        const tableId = urlParams.get('table_id');
        const tableNumber = urlParams.get('table_number');
        
        if (branchId) {
            localStorage.setItem('current_branch_id', branchId);
            console.log('💾 Saved branch_id:', branchId);
        }
        
        if (tableId) {
            localStorage.setItem('current_table_id', tableId);
            console.log('💾 Saved table_id:', tableId);
        }

        // If table_number is already in localStorage or came via URL, resolve immediately
        if (tableNumber) {
            localStorage.setItem('current_table_number', tableNumber);
            console.log('💾 Saved table_number from URL:', tableNumber);
            tableNumberReadyResolve(tableNumber);
            return;
        }

        if (localStorage.getItem('current_table_number')) {
            tableNumberReadyResolve(localStorage.getItem('current_table_number'));
            return;
        }

        // Otherwise fetch it from the API
        fetchTableNumber();
    }

    /**
     * Fetch table_number from the session details API and persist it.
     * Uses the session details endpoint which is public (no auth required).
     */
    async function fetchTableNumber() {
        try {
            const sessionId = localStorage.getItem('current_session_id');
            if (sessionId) {
                const res = await fetch(`http://localhost:8000/api/guest/sessions/${sessionId}/details`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.table_number) {
                        localStorage.setItem('current_table_number', data.table_number);
                        console.log('💾 Fetched & saved table_number from session details:', data.table_number);
                        tableNumberReadyResolve(data.table_number);
                        updateTableDisplay();
                        return;
                    }
                }
            }
            // No session yet — resolve with null so awaiting code doesn't hang
            console.log('ℹ️ No session yet, table_number not available');
            tableNumberReadyResolve(null);
        } catch (e) {
            console.warn('⚠️ Could not fetch table_number:', e.message);
            tableNumberReadyResolve(null);
        }
    }
    
    /**
     * Add parameters to URL
     */
    function addParamsToURL(url) {
        const params = getCurrentParams();
        
        // If no params, return original URL
        if (!params.branch_id || !params.table_id) {
            return url;
        }
        
        // Check if URL already has parameters
        const separator = url.includes('?') ? '&' : '?';
        
        // Build parameter string
        let paramString = '';
        if (params.branch_id) {
            paramString += `branch_id=${params.branch_id}`;
        }
        if (params.table_id) {
            paramString += (paramString ? '&' : '') + `table_id=${params.table_id}`;
        }
        
        return url + separator + paramString;
    }
    
    /**
     * Fix all links on the page to include parameters
     */
    function fixPageLinks() {
        // Get all anchor tags
        const links = document.querySelectorAll('a[href]');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            // Skip external links and anchors
            if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) {
                return;
            }
            
            // Skip if already has parameters
            if (href.includes('branch_id') && href.includes('table_id')) {
                return;
            }
            
            // Check if it's a guest page
            const guestPages = ['menu.html', 'detail_cart.html', 'order_succesfull.html', 'payment_invoice.html'];
            const isGuestPage = guestPages.some(page => href.includes(page));
            
            if (isGuestPage) {
                const newHref = addParamsToURL(href);
                link.setAttribute('href', newHref);
                console.log('🔗 Fixed link:', href, '→', newHref);
            }
        });
    }
    
    /**
     * Fix onclick handlers that navigate
     */
    function fixOnclickHandlers() {
        // Override window.location.href setter
        const originalLocationSetter = Object.getOwnPropertyDescriptor(window, 'location').set;
        
        // Don't override if already overridden
        if (window.__locationSetterFixed) return;
        window.__locationSetterFixed = true;
        
        // We can't actually override location.href, so we'll provide a helper function instead
    }
    
    // ============================================
    // PLACEHOLDER IMAGE FIX
    // ============================================
    
    /**
     * Replace broken placeholder images with local fallback
     */
    function fixPlaceholderImages() {
        // Create a simple SVG placeholder
        const placeholderSVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect fill='%23f1f5f9' width='300' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='16' fill='%2394a3b8'%3ENo Image%3C/text%3E%3C/svg%3E`;
        
        // Find all images
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // Skip if already has valid src
            if (img.src && !img.src.includes('placeholder.com')) {
                return;
            }
            
            // Check for error events
            img.addEventListener('error', function() {
                console.log('🖼️ Image failed to load, using fallback:', this.src);
                this.src = placeholderSVG;
            });
            
            // If src contains placeholder.com, replace immediately
            if (img.src.includes('placeholder.com')) {
                console.log('🖼️ Replacing placeholder.com image');
                img.src = placeholderSVG;
            }
        });
        
        // Also fix background images in inline styles
        const elementsWithBg = document.querySelectorAll('[style*="background-image"]');
        
        elementsWithBg.forEach(el => {
            const style = el.getAttribute('style');
            if (style && style.includes('placeholder.com')) {
                console.log('🖼️ Replacing placeholder.com background');
                const newStyle = style.replace(/url\(['"]?https?:\/\/.*?placeholder\.com.*?['"]?\)/g, `url('${placeholderSVG}')`);
                el.setAttribute('style', newStyle);
            }
        });
    }
    
    // ============================================
    // UPDATE UI WITH CURRENT TABLE INFO
    // ============================================
    
    function updateTableDisplay() {
        const params = getCurrentParams();
        const tableNumber = localStorage.getItem('current_table_number') || '';
        
        console.log('🏓 Updating table display with:', tableNumber);
        
        // Update specific table info elements by ID
        const tableInfoDesktop = document.getElementById('table-info-desktop');
        const tableInfoMobile = document.getElementById('table-info-mobile');
        const headerTableNumber = document.getElementById('header-table-number');
        
        if (tableInfoDesktop) {
            tableInfoDesktop.textContent = tableNumber ? `BÀN #${tableNumber}` : 'BÀN #';
        }
        
        if (tableInfoMobile) {
            tableInfoMobile.textContent = tableNumber ? `BÀN #${tableNumber}` : 'BÀN #';
        }
        
        if (headerTableNumber) {
            headerTableNumber.textContent = tableNumber ? `BÀN SỐ ${tableNumber}` : 'BÀN SỐ';
        }
        
        // Also update generic table displays
        document.querySelectorAll('.table-number, .table-display').forEach(el => {
            if (el.textContent.includes('BÀN #')) {
                el.textContent = tableNumber ? `BÀN #${tableNumber}` : 'BÀN #';
            } else if (el.textContent.includes('BÀN SỐ')) {
                el.textContent = tableNumber ? `BÀN SỐ ${tableNumber}` : 'BÀN SỐ';
            } else {
                el.textContent = tableNumber;
            }
        });
        
        console.log('✅ Table display updated');
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    function initialize() {
        console.log('🔧 Guest Pages Utilities initialized');
        
        // Save parameters immediately
        saveParamsToStorage();
        
        // Fix links
        fixPageLinks();
        
        // Fix images
        fixPlaceholderImages();
        
        // Update table display
        updateTableDisplay();
        
        // Re-fix links after any dynamic content loads
        setTimeout(fixPageLinks, 1000);
        setTimeout(fixPageLinks, 3000);
        
        // Watch for DOM changes and fix new links
        const observer = new MutationObserver((mutations) => {
            fixPageLinks();
            fixPlaceholderImages();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // ============================================
    // GLOBAL EXPORTS
    // ============================================
    
    window.GuestUtils = {
        getCurrentParams,
        addParamsToURL,
        fixPageLinks,
        fixPlaceholderImages,
        updateTableDisplay,
        tableNumberReady,
        navigateTo: function(url) {
            window.location.href = addParamsToURL(url);
        }
    };
    
})();