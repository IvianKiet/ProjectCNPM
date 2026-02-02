/**
 * Enhanced AI Chatbot Frontend for S2O Restaurant System
 * Version: 2.0.0
 * 
 * Features:
 * - Conversation memory with session tracking
 * - Rich message formatting (bold, lists, links)
 * - Branch info display
 * - Error handling with retry
 * - Loading states
 * - Message persistence (localStorage)
 */

// ============================================
// CONFIGURATION
// ============================================
const AI_CONFIG = {
    API_URL: 'http://localhost:8001',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    STORAGE_KEY: 'ai_chat_messages',
    SESSION_KEY: 'ai_chat_session'
};

// ============================================
// STATE MANAGEMENT
// ============================================
class ChatState {
    constructor() {
        this.branchId = null;
        this.sessionId = null;
        this.branchInfo = null;
        this.messages = [];
        this.isTyping = false;
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(AI_CONFIG.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.branchId === this.branchId) {
                    this.messages = data.messages || [];
                    this.sessionId = data.sessionId;
                    return true;
                }
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
        return false;
    }

    saveToStorage() {
        try {
            localStorage.setItem(AI_CONFIG.STORAGE_KEY, JSON.stringify({
                branchId: this.branchId,
                sessionId: this.sessionId,
                messages: this.messages,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    addMessage(role, content) {
        this.messages.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        this.saveToStorage();
    }

    clearHistory() {
        this.messages = [];
        this.sessionId = null;
        localStorage.removeItem(AI_CONFIG.STORAGE_KEY);
    }
}

const chatState = new ChatState();

// ============================================
// API CALLS
// ============================================
class ChatAPI {
    static async sendMessage(branchId, message, sessionId = null) {
        const response = await fetch(`${AI_CONFIG.API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                branch_id: branchId,
                message: message,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Network error' }));
            throw new Error(error.detail || 'Failed to send message');
        }

        return response.json();
    }

    static async getBranchInfo(branchId) {
        const response = await fetch(`${AI_CONFIG.API_URL}/branches/${branchId}/info`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch branch info');
        }

        return response.json();
    }

    static async clearHistory(branchId) {
        const response = await fetch(`${AI_CONFIG.API_URL}/chat/history/${branchId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to clear history');
        }

        return response.json();
    }
}

// ============================================
// UI COMPONENTS
// ============================================
class ChatUI {
    static getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    static formatMessage(message) {
        // Convert line breaks
        message = message.replace(/\n/g, '<br>');
        
        // Make URLs clickable
        message = message.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" class="text-primary underline hover:text-primary/80">$1</a>'
        );
        
        // Format bold text **text**
        message = message.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
        
        // Format italic text *text*
        message = message.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
        
        // Format lists (lines starting with - or •)
        message = message.replace(/^[\-•]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
        if (message.includes('<li')) {
            message = message.replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1">$1</ul>');
        }
        
        // Emoji enhancement for common patterns
        message = message.replace(/🔥/g, '<span class="inline-block animate-pulse">🔥</span>');
        
        return message;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static scrollToBottom() {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 100);
        }
    }

    static addUserMessage(message) {
        const chatContainer = document.getElementById('chatMessages');
        const time = this.getCurrentTime();
        
        const messageHTML = `
            <div class="flex gap-3 max-w-[85%] ml-auto justify-end animate-fadeIn">
                <div class="space-y-2">
                    <div class="bg-primary/20 border border-primary/30 p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed text-gray-200 shadow-sm">
                        ${this.escapeHtml(message)}
                    </div>
                    <span class="text-[10px] text-gray-500 font-medium px-1 flex justify-end">${time}</span>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    static addAIMessage(message) {
        const chatContainer = document.getElementById('chatMessages');
        const time = this.getCurrentTime();
        
        const messageHTML = `
            <div class="flex gap-3 max-w-[85%] animate-fadeIn">
                <div class="size-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/20">
                    <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">smart_toy</span>
                </div>
                <div class="space-y-2">
                    <div class="bg-chat-bubble ai-message-gradient border border-primary/20 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-gray-200 shadow-sm">
                        ${this.formatMessage(message)}
                    </div>
                    <span class="text-[10px] text-gray-500 font-medium px-1">${time}</span>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    }

    static addTypingIndicator() {
        const chatContainer = document.getElementById('chatMessages');
        const typingId = 'typing-' + Date.now();
        
        const typingHTML = `
            <div id="${typingId}" class="flex gap-3 max-w-[85%]">
                <div class="size-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/20">
                    <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1">smart_toy</span>
                </div>
                <div class="bg-chat-bubble ai-message-gradient border border-primary/20 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-gray-200 shadow-sm">
                    <div class="flex gap-1.5">
                        <div class="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                        <div class="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        <div class="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', typingHTML);
        this.scrollToBottom();
        
        return typingId;
    }

    static removeTypingIndicator(typingId) {
        const element = document.getElementById(typingId);
        if (element) {
            element.remove();
        }
    }

    static showError(message) {
        const chatContainer = document.getElementById('chatMessages');
        const time = this.getCurrentTime();
        
        const errorHTML = `
            <div class="flex gap-3 max-w-[85%] animate-fadeIn">
                <div class="size-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-sm text-red-400">error</span>
                </div>
                <div class="space-y-2">
                    <div class="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-red-300 shadow-sm">
                        ${this.escapeHtml(message)}
                    </div>
                    <span class="text-[10px] text-gray-500 font-medium px-1">${time}</span>
                </div>
            </div>
        `;
        
        chatContainer.insertAdjacentHTML('beforeend', errorHTML);
        this.scrollToBottom();
    }

    static updateBranchInfo(branchInfo) {
        const branchNameEl = document.getElementById('branchName');
        if (branchNameEl && branchInfo) {
            branchNameEl.textContent = branchInfo.branch_name;
        }
    }

    static setInputState(enabled) {
        const input = document.getElementById('messageInput');
        const button = document.getElementById('sendButton');
        
        if (input) input.disabled = !enabled;
        if (button) button.disabled = !enabled;
        
        chatState.isTyping = !enabled;
    }
}

// ============================================
// MESSAGE HANDLING
// ============================================
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || chatState.isTyping) return;
    
    if (!chatState.branchId) {
        ChatUI.showError('Không tìm thấy thông tin chi nhánh. Vui lòng tải lại trang.');
        return;
    }
    
    // Clear input and disable UI
    input.value = '';
    ChatUI.setInputState(false);
    
    // Add user message to UI and state
    ChatUI.addUserMessage(message);
    chatState.addMessage('user', message);
    
    // Show typing indicator
    const typingId = ChatUI.addTypingIndicator();
    
    let retries = 0;
    while (retries < AI_CONFIG.MAX_RETRIES) {
        try {
            // Call AI API
            const response = await ChatAPI.sendMessage(
                chatState.branchId,
                message,
                chatState.sessionId
            );
            
            // Update session ID
            if (response.session_id) {
                chatState.sessionId = response.session_id;
            }
            
            // Remove typing indicator
            ChatUI.removeTypingIndicator(typingId);
            
            // Add AI response
            ChatUI.addAIMessage(response.response);
            chatState.addMessage('assistant', response.response);
            
            // Update branch name if provided
            if (response.branch_name) {
                ChatUI.updateBranchInfo({ branch_name: response.branch_name });
            }
            
            // Re-enable input
            ChatUI.setInputState(true);
            input.focus();
            
            return; // Success, exit function
            
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed:`, error);
            retries++;
            
            if (retries < AI_CONFIG.MAX_RETRIES) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, AI_CONFIG.RETRY_DELAY));
            } else {
                // All retries failed
                ChatUI.removeTypingIndicator(typingId);
                ChatUI.showError('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau. 😔');
                ChatUI.setInputState(true);
                input.focus();
            }
        }
    }
}

function askQuestion(question) {
    const input = document.getElementById('messageInput');
    if (input) {
        input.value = question;
        sendMessage();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ============================================
// INITIALIZATION
// ============================================
async function initializeChat() {
    try {
        // Get branch_id from URL
        const urlParams = new URLSearchParams(window.location.search);
        chatState.branchId = urlParams.get('branch_id');
        
        if (!chatState.branchId) {
            ChatUI.showError('Không tìm thấy thông tin chi nhánh. Vui lòng chọn chi nhánh từ trang chủ.');
            return;
        }
        
        console.log('Initializing chat for branch:', chatState.branchId);
        
        // Set welcome time
        const welcomeTimeEl = document.getElementById('welcomeTime');
        if (welcomeTimeEl) {
            welcomeTimeEl.textContent = ChatUI.getCurrentTime();
        }
        
        // Load branch info
        try {
            chatState.branchInfo = await ChatAPI.getBranchInfo(chatState.branchId);
            ChatUI.updateBranchInfo(chatState.branchInfo);
            console.log('Branch info loaded:', chatState.branchInfo);
        } catch (error) {
            console.error('Failed to load branch info:', error);
        }
        
        // Load previous conversation from storage
        const hasHistory = chatState.loadFromStorage();
        if (hasHistory && chatState.messages.length > 0) {
            console.log('Loaded conversation history:', chatState.messages.length, 'messages');
            
            // Render previous messages
            const chatContainer = document.getElementById('chatMessages');
            // Clear welcome message and suggestions
            chatContainer.innerHTML = '';
            
            chatState.messages.forEach(msg => {
                if (msg.role === 'user') {
                    ChatUI.addUserMessage(msg.content);
                } else {
                    ChatUI.addAIMessage(msg.content);
                }
            });
        }
        
        // Focus input
        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
        }
        
        console.log('Chat initialized successfully');
        
    } catch (error) {
        console.error('Initialization error:', error);
        ChatUI.showError('Lỗi khởi tạo chat. Vui lòng tải lại trang.');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function clearChatHistory() {
    if (confirm('Bạn có chắc muốn xóa lịch sử trò chuyện?')) {
        chatState.clearHistory();
        ChatAPI.clearHistory(chatState.branchId).catch(console.error);
        location.reload();
    }
}

function goBack() {
    window.history.back();
}

// ============================================
// EVENT LISTENERS
// ============================================
window.addEventListener('DOMContentLoaded', initializeChat);

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
    }
`;
document.head.appendChild(style);

// Export for debugging
if (typeof window !== 'undefined') {
    window.ChatDebug = {
        state: chatState,
        ui: ChatUI,
        api: ChatAPI,
        clearHistory: clearChatHistory
    };
}