"""
Enhanced AI Chatbot Backend for S2O Restaurant System
Uses Google Gemini API with improved context and conversation memory

Key Improvements:
- Rich menu context with categories and pricing details
- Conversation history for contextual responses
- Better error handling and logging
- More detailed restaurant information
- Support for special queries (discounts, recommendations, etc.)
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid
import os
import google.genai as genai
from datetime import datetime
from collections import defaultdict

from database import SessionLocal
from models import Branch, MenuItem, Category, AIConfig, DiningTable

# ============== FastAPI App ==============
app = FastAPI(title="S2O AI Chatbot API - Enhanced", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== Gemini API Configuration ==============
GEMINI_API_KEY = "AIzaSyBrYI36zXT9sQXLP5kUkf9mMda57rbQUCM"
client = genai.Client(api_key=GEMINI_API_KEY)

# ============== Conversation Memory ==============
# Store conversation history per branch (in-memory for now)
conversation_history: Dict[str, List[Dict]] = defaultdict(list)
MAX_HISTORY_LENGTH = 10  # Keep last 10 messages for context

# ============== Database Dependency ==============
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============== Pydantic Schemas ==============
class ChatMessage(BaseModel):
    branch_id: str
    message: str
    session_id: Optional[str] = None  # For conversation tracking

class ChatResponse(BaseModel):
    response: str
    branch_name: str
    session_id: str

class AIConfigResponse(BaseModel):
    config_id: str
    system_prompt: str
    temperature: int

class AIConfigUpdate(BaseModel):
    system_prompt: Optional[str] = None
    temperature: Optional[int] = None

class BranchInfo(BaseModel):
    branch_id: str
    branch_name: str
    address: str
    phone: Optional[str]
    opening_hours: Optional[str]
    closing_hours: Optional[str]

# ============== Helper Functions ==============

def get_rich_branch_context(branch_id: str, db: Session) -> tuple[str, Branch]:
    """
    Build comprehensive branch context with all relevant information
    Returns: (context_string, branch_object)
    """
    try:
        # Get branch info
        branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        
        print(f"✅ Found branch: {branch.branch_name}")
        print(f"   Branch ID: {branch.branch_id}")
        print(f"   Tenant ID: {branch.tenant_id}")
        
        # Get menu items with categories
        # First, get all categories for this tenant
        tenant_id = branch.tenant_id
        
        # Debug: Check categories
        all_categories = db.query(Category).filter(Category.tenant_id == tenant_id).all()
        print(f"   Found {len(all_categories)} categories for tenant")
        
        # Debug: Check all menu items for this branch (regardless of status)
        all_branch_items = db.query(MenuItem).filter(MenuItem.branch_id == branch_id).all()
        print(f"   Found {len(all_branch_items)} total menu items for branch")
        for item in all_branch_items[:3]:  # Show first 3
            print(f"     - {item.item_name} (status: {item.status}, category: {item.category_id})")
        
        # Query menu items that belong to both this branch AND this tenant's categories
        # Note: Check for both 'active' and 'available' status
        menu_query = db.query(MenuItem, Category).join(
            Category, MenuItem.category_id == Category.category_id
        ).filter(
            MenuItem.branch_id == branch_id,
            Category.tenant_id == tenant_id,
            MenuItem.status.in_(["active", "available"])  # Accept both statuses
        ).order_by(Category.category_name, MenuItem.item_name).all()
        
        print(f"✅ Found {len(menu_query)} active menu items with categories")
        
        # Get dining tables
        tables = db.query(DiningTable).filter(
            DiningTable.branch_id == branch_id
        ).all()
        
        print(f"✅ Found {len(tables)} tables")
        
        # Build comprehensive context
        context = f"""
=== THÔNG TIN NHÀ HÀNG ===
Tên: {branch.branch_name}
Địa chỉ: {branch.address or 'Chưa cập nhật'}, {branch.province or ''}
Số điện thoại: {branch.phone or 'Chưa cập nhật'}
Quản lý: {branch.manager_name or 'Chưa cập nhật'}
Trạng thái: {'Đang hoạt động' if branch.status == 'active' else 'Bảo trì'}

=== GIỜ MỞ CỬA ===
Giờ mở cửa: {branch.opening_hours or 'Chưa cập nhật'}
Giờ đóng cửa: {branch.closing_hours or 'Chưa cập nhật'}
Hiện tại: {datetime.now().strftime('%H:%M')}
{_get_open_status(branch.opening_hours, branch.closing_hours)}

=== THÔNG TIN THANH TOÁN ===
Mã ngân hàng: {branch.bank_code or 'Chưa cập nhật'}
Số tài khoản: {branch.bank_account_number or 'Chưa cập nhật'}
Tên tài khoản: {branch.bank_account_name or 'Chưa cập nhật'}
Hoàn tiền: {branch.cashback_percent or 0}% cho mọi giao dịch

=== GOOGLE MAPS ===
{branch.google_maps_link or 'Chưa có link Google Maps'}

=== THỰC ĐƠN CHI TIẾT ===
"""
        
        # Group menu items by category with detailed info
        categories_data = defaultdict(list)
        total_items = 0
        discounted_items = []
        
        for item, category in menu_query:
            total_items += 1
            
            # Calculate price info
            original_price = float(item.price)
            discount = float(item.discount_percent or 0)
            
            item_info = {
                'name': item.item_name,
                'description': item.description or "Món ăn ngon",
                'price': original_price,
                'discount': discount,
                'final_price': original_price * (1 - discount/100) if discount > 0 else original_price,
                'status': item.status
            }
            
            categories_data[category.category_name].append(item_info)
            
            if discount > 0:
                discounted_items.append(item_info)
        
        # Format menu by category
        if categories_data:
            for cat_name, items in sorted(categories_data.items()):
                context += f"\n📁 {cat_name} ({len(items)} món):\n"
                for item in items:
                    price_str = f"{item['final_price']:,.0f}đ"
                    if item['discount'] > 0:
                        price_str = f"~{item['final_price']:,.0f}đ~ (Giảm {item['discount']}% từ {item['price']:,.0f}đ)"
                    
                    context += f"  • {item['name']}: {price_str}\n"
                    context += f"    Mô tả: {item['description']}\n"
        else:
            context += "\nChưa có món ăn nào trong thực đơn.\n"
        
        # Add statistics
        context += f"\n=== THỐNG KÊ THỰC ĐƠN ===\n"
        context += f"Tổng số món: {total_items}\n"
        context += f"Số danh mục: {len(categories_data)}\n"
        context += f"Món đang giảm giá: {len(discounted_items)}\n"
        
        if discounted_items:
            context += f"\n=== MÓN ĐANG GIẢM GIÁ ĐẶC BIỆT ===\n"
            for item in sorted(discounted_items, key=lambda x: x['discount'], reverse=True):
                context += f"  🔥 {item['name']}: Giảm {item['discount']}% - Chỉ còn {item['final_price']:,.0f}đ (từ {item['price']:,.0f}đ)\n"
        
        # Table information
        context += f"\n=== THÔNG TIN BÀN ĂN ===\n"
        context += f"Tổng số bàn: {len(tables)}\n"
        
        available_tables = [t for t in tables if t.status == "available"]
        occupied_tables = [t for t in tables if t.status == "occupied"]
        reserved_tables = [t for t in tables if t.status == "reserved"]
        
        context += f"Bàn trống: {len(available_tables)}\n"
        context += f"Bàn đang sử dụng: {len(occupied_tables)}\n"
        context += f"Bàn đã đặt: {len(reserved_tables)}\n"
        
        if available_tables:
            context += f"Các bàn có thể đặt: {', '.join([t.table_number for t in available_tables[:5]])}\n"
        
        print("✅ Rich context built successfully")
        return context, branch
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_rich_branch_context: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error building branch context: {str(e)}")


def _get_open_status(opening_hours: str, closing_hours: str) -> str:
    """Determine if restaurant is currently open"""
    if not opening_hours or not closing_hours:
        return "Trạng thái: Chưa cập nhật giờ mở cửa"
    
    try:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        
        if opening_hours <= current_time <= closing_hours:
            return "Trạng thái: 🟢 ĐANG MỞ CỬA"
        else:
            return "Trạng thái: 🔴 ĐANG ĐÓNG CỬA"
    except:
        return "Trạng thái: Không xác định"


def get_ai_config(db: Session) -> tuple:
    """Get AI configuration from database"""
    config = db.query(AIConfig).first()
    
    if not config:
        config = AIConfig(
            config_id=str(uuid.uuid4()),
            system_prompt="""Bạn là trợ lý AI thông minh của hệ thống nhà hàng S2O. 
Nhiệm vụ của bạn là:
- Trả lời mọi câu hỏi về nhà hàng một cách thân thiện, chuyên nghiệp
- Giới thiệu món ăn hấp dẫn, gợi ý dựa trên sở thích khách hàng
- Cung cấp thông tin chính xác về giờ mở cửa, địa chỉ, liên hệ
- Hỗ trợ khách hàng đặt bàn và thanh toán
- Luôn nhiệt tình, vui vẻ và hữu ích

Quy tắc quan trọng:
- Chỉ trả lời dựa trên thông tin được cung cấp
- Nếu không biết, hãy thừa nhận một cách lịch sự
- Luôn dùng tiếng Việt trừ khi khách hỏi bằng tiếng Anh
- Giữ câu trả lời ngắn gọn nhưng đầy đủ thông tin
- Thêm emoji để thân thiện hơn (nhưng đừng lạm dụng)""",
            temperature=60
        )
        db.add(config)
        db.commit()
    
    gemini_temperature = config.temperature / 100.0
    return config.system_prompt, gemini_temperature


def add_to_conversation_history(branch_id: str, role: str, content: str):
    """Add message to conversation history"""
    conversation_history[branch_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
    
    # Keep only last N messages
    if len(conversation_history[branch_id]) > MAX_HISTORY_LENGTH * 2:
        conversation_history[branch_id] = conversation_history[branch_id][-MAX_HISTORY_LENGTH * 2:]


def get_conversation_context(branch_id: str) -> str:
    """Build conversation history context"""
    history = conversation_history.get(branch_id, [])
    if not history:
        return ""
    
    context = "\n=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY ===\n"
    for msg in history[-6:]:  # Last 3 exchanges
        role_text = "Khách hàng" if msg["role"] == "user" else "Bạn"
        context += f"{role_text}: {msg['content']}\n"
    
    return context


# ============== API Endpoints ==============

@app.post("/chat", response_model=ChatResponse)
async def chat_with_ai(chat: ChatMessage, db: Session = Depends(get_db)):
    """
    Enhanced chat endpoint with conversation memory and rich context
    """
    try:
        print(f"\n🔵 New chat request for branch: {chat.branch_id}")
        print(f"🔵 Message: {chat.message}")
        
        # Generate or use session ID
        session_id = chat.session_id or str(uuid.uuid4())
        
        # Get rich branch context
        branch_context, branch = get_rich_branch_context(chat.branch_id, db)
        
        # Get AI configuration
        system_prompt, temperature = get_ai_config(db)
        print(f"✅ AI config loaded. Temperature: {temperature}")
        
        # Get conversation history
        conversation_context = get_conversation_context(chat.branch_id)
        
        # Build full prompt
        full_prompt = f"""{system_prompt}

{branch_context}

{conversation_context}

HƯỚNG DẪN TRẢ LỜI:
- Dựa vào thông tin trên để trả lời chính xác
- Nếu khách hỏi về món ăn, hãy mô tả chi tiết và nêu giá
- Nếu khách hỏi giảm giá, ưu tiên giới thiệu các món đang sale
- Nếu khách hỏi đường, cung cấp địa chỉ và link Google Maps
- Nếu khách hỏi giờ mở cửa, check xem hiện tại có mở không
- Nếu khách cần đặt bàn, hỏi thông tin: số người, giờ muốn đến
- Giữ câu trả lời súc tích, thân thiện, dễ đọc

Câu hỏi của khách: {chat.message}

Trả lời của bạn:"""
        
        print("✅ Calling Gemini API...")
        
        # Generate response
        response = client.models.generate_content(
            model='gemini-2.5-flash',  # Using stable model instead of experimental
            contents=full_prompt,
            config=genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=800,
            )
        )
        
        ai_response = response.text
        print(f"✅ Gemini response received: {ai_response[:100]}...")
        
        # Add to conversation history
        add_to_conversation_history(chat.branch_id, "user", chat.message)
        add_to_conversation_history(chat.branch_id, "assistant", ai_response)
        
        return ChatResponse(
            response=ai_response,
            branch_name=branch.branch_name,
            session_id=session_id
        )
        
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"AI Error: {str(e)}"
        )


@app.delete("/chat/history/{branch_id}")
async def clear_conversation_history(branch_id: str):
    """Clear conversation history for a branch"""
    if branch_id in conversation_history:
        del conversation_history[branch_id]
        return {"message": "Conversation history cleared", "branch_id": branch_id}
    return {"message": "No history found", "branch_id": branch_id}


@app.get("/branches/{branch_id}/info", response_model=BranchInfo)
async def get_branch_info(branch_id: str, db: Session = Depends(get_db)):
    """Get basic branch information for the UI"""
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    return BranchInfo(
        branch_id=branch.branch_id,
        branch_name=branch.branch_name,
        address=branch.address or "",
        phone=branch.phone,
        opening_hours=branch.opening_hours,
        closing_hours=branch.closing_hours
    )


@app.get("/ai-config", response_model=AIConfigResponse)
async def get_ai_configuration(db: Session = Depends(get_db)):
    """Get current AI configuration"""
    config = db.query(AIConfig).first()
    
    if not config:
        config = AIConfig(
            config_id=str(uuid.uuid4()),
            system_prompt="Bạn là trợ lý AI thân thiện của nhà hàng.",
            temperature=50
        )
        db.add(config)
        db.commit()
    
    return AIConfigResponse(
        config_id=config.config_id,
        system_prompt=config.system_prompt,
        temperature=config.temperature
    )


@app.put("/ai-config")
async def update_ai_configuration(
    config_update: AIConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update AI configuration (Admin only)"""
    config = db.query(AIConfig).first()
    
    if not config:
        raise HTTPException(status_code=404, detail="AI Config not found")
    
    if config_update.system_prompt is not None:
        config.system_prompt = config_update.system_prompt
    
    if config_update.temperature is not None:
        if config_update.temperature < 0 or config_update.temperature > 100:
            raise HTTPException(
                status_code=400,
                detail="Temperature must be between 0 and 100"
            )
        config.temperature = config_update.temperature
    
    db.commit()
    
    return {
        "message": "AI configuration updated successfully",
        "system_prompt": config.system_prompt,
        "temperature": config.temperature
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "S2O AI Chatbot Enhanced",
        "version": "2.0.0",
        "active_conversations": len(conversation_history)
    }


# ============== RUN SERVER ==============
if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting S2O AI Chatbot Enhanced Server...")
    print("📍 Server will run on: http://localhost:8001")
    print("📚 API Docs available at: http://localhost:8001/docs")
    print("\nEnhancements:")
    print("  ✅ Rich menu context with categories")
    print("  ✅ Conversation memory")
    print("  ✅ Discount tracking")
    print("  ✅ Table availability")
    print("  ✅ Opening hours check")
    print("\nPress CTRL+C to stop\n")
    
    uvicorn.run(
        "ai_chatbot_improved:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )