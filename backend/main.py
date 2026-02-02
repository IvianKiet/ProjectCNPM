from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from jwt import InvalidTokenError
import random
from typing import List
from decimal import Decimal

from database import SessionLocal, engine
from models import (
    Base, User, Tenant, Branch, DiningTable,
    QRCode, Category, MenuItem, Staff, Customer, PointTransaction, Session, Order, OrderItem, Bill
)
from models import Session as DBSession, Order, OrderItem, Bill
from models import (
    DiningTable, Session as DBSession, Order, OrderItem,
    Bill, MenuItem, Customer, Branch
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Scan&Order API", version="2.0.0")

# ============== JWT Configuration ==============
import os
  
# Docker-ready configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "CHANGE_ME_IN_ENV_FILE")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))

# CORS Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# CORS middleware
app.add_middleware(
      CORSMiddleware,
      allow_origins=ALLOWED_ORIGINS,  # Changed
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

# ============== Database Dependency ==============
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============== Pydantic Schemas ==============

# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    tenant_id: str
    role: str  # 'owner', 'staff', 'customer'

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    expires_in: int  # seconds

# ✅ NEW: User profile for displaying current user
class UserProfile(BaseModel):
    user_id: str
    email: str
    full_name: str
    tenant_id: str
    tenant_name: str
    role: str

    class Config:
        from_attributes = True


# ✅ NEW: Admin schemas for edit operations
class AdminRestaurantUpdate(BaseModel):
    tenant_name: Optional[str] = None
    owner_name: Optional[str] = None
    owner_email: Optional[EmailStr] = None

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None  # 'owner', 'staff', 'customer', 'chef'


# Cashback Settings Schema
class CashbackSettingsUpdate(BaseModel):
    cashback_percent: float

class CashbackSettingsResponse(BaseModel):
    tenant_id: str
    cashback_percent: float

    class Config:
        from_attributes = True

# Restaurant/Branch Schemas
class BranchCreate(BaseModel):
    branch_name: str
    address: str
    province: str
    phone: str
    manager_name: str
    cashback_percent: Optional[float] = 1.0
    image: Optional[str] = None
    # ✅ NEW: VietQR Bank Information
    bank_code: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    # ✅ NEW: Opening hours and location info
    opening_hours: str  # Format: "HH:MM" (e.g., "08:00")
    closing_hours: str  # Format: "HH:MM" (e.g., "22:00")
    google_maps_link: str  # Google Maps URL

class BranchUpdate(BaseModel):
    branch_name: Optional[str] = None
    address: Optional[str] = None
    province: Optional[str] = None
    phone: Optional[str] = None
    manager_name: Optional[str] = None
    cashback_percent: Optional[float] = None
    image: Optional[str] = None
    status: Optional[str] = None
    # ✅ NEW: VietQR Bank Information
    bank_code: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    # ✅ NEW: Opening hours and location info
    opening_hours: Optional[str] = None
    closing_hours: Optional[str] = None
    google_maps_link: Optional[str] = None

# ✅ UPDATED: Added menu_item_count field
class BranchResponse(BaseModel):
    branch_id: str
    branch_name: str
    address: str
    province: Optional[str] = None
    phone: Optional[str] = None
    manager_name: Optional[str] = None
    cashback_percent: Optional[float] = 1.0
    image: Optional[str] = None
    status: str = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None
    menu_item_count: int = 0  # ✅ NEW: Number of menu items in this branch
    # ✅ NEW: VietQR Bank Information
    bank_code: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    # ✅ NEW: Opening hours and location info
    opening_hours: Optional[str] = None
    closing_hours: Optional[str] = None
    google_maps_link: Optional[str] = None

    class Config:
        from_attributes = True

# Table Schemas
class TableCreate(BaseModel):
    table_number: str
    capacity: int
    status: str = "available"

class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None

class TableResponse(BaseModel):
    table_id: str
    table_number: str
    capacity: Optional[int]
    status: str
    branch_id: str

    class Config:
        from_attributes = True

class QRCodeResponse(BaseModel):
    qr_id: str
    qr_content: str
    is_active: bool

    class Config:
        from_attributes = True

# Menu Schemas
class CategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None
    status: str = "active"

class CategoryResponse(BaseModel):
    category_id: str
    category_name: str
    description: Optional[str]
    status: str

    class Config:
        from_attributes = True

class MenuItemCreate(BaseModel):
    category_id: str
    branch_id: str  # ✅ ADDED
    item_name: str
    description: Optional[str] = None
    price: float
    discount_percent: Optional[float] = 0
    status: str = "available"
    image: Optional[str] = None

class MenuItemUpdate(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    discount_percent: Optional[float] = None
    status: Optional[str] = None
    image: Optional[str] = None
    category_id: Optional[str] = None  # ✅ ADDED: Allow category updates

class MenuItemResponse(BaseModel):
    menu_item_id: str
    item_name: str
    description: Optional[str]
    price: float
    discount_percent: Optional[float] = 0
    status: str
    category_id: str
    branch_id: str  # ✅ ADDED
    image: Optional[str] = None

    class Config:
        from_attributes = True


# ============== Helper Functions ==============

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except InvalidTokenError:
        return None

def get_user_role(user, db):
    """Determine user's role from related tables"""
    from models import Staff, Customer

    # Check if user is staff/chef
    staff = db.query(Staff).filter(Staff.user_id == user.user_id).first()
    if staff:
        return "chef" if staff.position == "Chef" else "staff"

    # Check if user is customer
    customer = db.query(Customer).filter(Customer.user_id == user.user_id).first()
    if customer:
        return "customer"

    # Default to owner if no specific role found
    return "owner"

# ============== Authentication Dependency ==============
async def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get current authenticated user from JWT token"""

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ============== AUTH ENDPOINTS ==============

@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register new user (restaurant owner)"""

    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create tenant
    tenant_id = str(uuid.uuid4())
    new_tenant = Tenant(
        tenant_id=tenant_id,
        tenant_name=f"{user_data.full_name}'s Restaurant",
        status="active",
        cashback_percent=1.0
    )
    db.add(new_tenant)

    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    new_user = User(
        user_id=user_id,
        tenant_id=tenant_id,
        email=user_data.email,
        password_hash=hashed_password,
        full_name=user_data.full_name
    )
    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)

        # Create access token
        access_token = create_access_token(data={"sub": user_id})

        # Get user role
        role = get_user_role(new_user, db)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": new_user.user_id,
                "email": new_user.email,
                "full_name": new_user.full_name,
                "tenant_id": new_user.tenant_id,
                "role": role
            },
            "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""

    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.user_id})

    # Get user role
    role = get_user_role(user, db)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "full_name": user.full_name,
            "tenant_id": user.tenant_id,
            "role": role
        },
        "expires_in": ACCESS_TOKEN_EXPIRE_HOURS * 3600
    }


@app.get("/api/auth/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile"""

    tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
    role = get_user_role(current_user, db)

    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant.tenant_name if tenant else "Unknown",
        "role": role
    }
# ============== ORDER MANAGEMENT SCHEMAS ==============
class OrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int
    note: Optional[str] = None

class OrderCreate(BaseModel):
    table_id: str
    items: List[OrderItemCreate]
    customer_id: Optional[str] = None

class OrderItemResponse(BaseModel):
    order_item_id: str
    menu_item_id: str
    menu_item_name: str
    menu_item_image: Optional[str]
    quantity: int
    price: float
    note: Optional[str] = None

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    order_id: str
    session_id: str
    table_id: str
    table_number: str
    branch_id: str
    branch_name: str
    status: str  # 'ordered', 'cooking', 'ready', 'serving', 'done'
    order_time: datetime
    items: List[OrderItemResponse]
    wait_minutes: int

    class Config:
        from_attributes = True

def get_order_response(order: Order, db: Session) -> OrderResponse:
    """Helper to format order response with all details"""

    # Get session and table info
    session = db.query(DBSession).filter(DBSession.session_id == order.session_id).first()
    table = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()

    # Get order items
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()

    items_response = []
    for item in order_items:
        menu_item = db.query(MenuItem).filter(MenuItem.menu_item_id == item.menu_item_id).first()
        items_response.append(OrderItemResponse(
            order_item_id=item.order_item_id,
            menu_item_id=item.menu_item_id,
            menu_item_name=menu_item.item_name if menu_item else "Unknown",
            menu_item_image=menu_item.image if menu_item else None,
            quantity=item.quantity,
            price=float(item.price),
            note=item.note if hasattr(item, 'note') else None
        ))

    # Calculate wait time
    wait_minutes = int((datetime.now() - order.order_time).total_seconds() / 60)

    return OrderResponse(
        order_id=order.order_id,
        session_id=order.session_id,
        table_id=table.table_id,
        table_number=table.table_number,
        branch_id=branch.branch_id,
        branch_name=branch.branch_name,
        status=order.status,
        order_time=order.order_time,
        items=items_response,
        wait_minutes=wait_minutes
    )


# ============== ORDER ENDPOINTS ==============

@app.post("/api/orders", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new order (simulating guest ordering via QR code)
    For now, this doesn't require authentication (guests can order)
    """

    # Verify table exists
    table = db.query(DiningTable).filter(DiningTable.table_id == order_data.table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # Check if table is available
    if table.status not in ['available', 'occupied']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Table is not available for ordering"
        )

    # Create or get active session for this table
    active_session = db.query(DBSession).filter(
        DBSession.table_id == order_data.table_id,
        DBSession.status == 'active'
    ).first()

    if not active_session:
        session_id = str(uuid.uuid4())
        active_session = DBSession(
            session_id=session_id,
            table_id=order_data.table_id,
            customer_id=order_data.customer_id,
            status='active'
        )
        db.add(active_session)

        # Update table status to occupied
        table.status = 'occupied'
        db.flush()

    # Create order
    order_id = str(uuid.uuid4())
    new_order = Order(
        order_id=order_id,
        session_id=active_session.session_id,
        status='ordered'  # Initial status
    )
    db.add(new_order)
    db.flush()

    # Add order items
    for item_data in order_data.items:
        # Verify menu item exists
        menu_item = db.query(MenuItem).filter(
            MenuItem.menu_item_id == item_data.menu_item_id
        ).first()

        if not menu_item:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item {item_data.menu_item_id} not found"
            )

        # Calculate price with discount
        discount = Decimal(str(menu_item.discount_percent or 0))
        final_price = menu_item.price * (Decimal('1') - discount / Decimal('100'))

        order_item_id = str(uuid.uuid4())
        order_item = OrderItem(
            order_item_id=order_item_id,
            order_id=new_order.order_id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            price=final_price,
            note=item_data.note
        )
        db.add(order_item)

    try:
        db.commit()
        db.refresh(new_order)

        # Return formatted response
        return get_order_response(new_order, db)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/orders", response_model=List[OrderResponse])
async def get_all_orders(
    branch_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all orders with optional filters
    Kitchen staff can filter by branch, status
    """

    query = db.query(Order).join(DBSession).join(DiningTable).join(Branch)

    # Filter by tenant
    query = query.filter(Branch.tenant_id == current_user.tenant_id)

    # Filter by branch if specified
    if branch_id:
        query = query.filter(Branch.branch_id == branch_id)

    # Filter by status if specified
    if status_filter:
        query = query.filter(Order.status == status_filter)

    # Order by creation time
    orders = query.order_by(Order.order_time.desc()).all()

    return [get_order_response(order, db) for order in orders]


@app.get("/api/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific order details"""

    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify access
    session = db.query(DBSession).filter(DBSession.session_id == order.session_id).first()
    table = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this order"
        )

    return get_order_response(order, db)


@app.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    new_status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update order status
    - Kitchen: 'ordered' -> 'cooking' -> 'ready'
    - Staff: 'ready' -> 'serving' -> 'done'
    """

    valid_statuses = ['ordered', 'cooking', 'ready', 'serving', 'done']
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Verify access
    session = db.query(DBSession).filter(DBSession.session_id == order.session_id).first()
    table = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this order"
        )

    # Update status
    order.status = new_status

    # If order is done, mark session as ready for payment
    # NOTE: Table stays "occupied" until payment is confirmed by staff
    if new_status == 'done':
        # Check if all orders in this session are done
        all_orders = db.query(Order).filter(Order.session_id == session.session_id).all()
        if all(o.status == 'done' for o in all_orders):
            # Session is completed (food served) but table remains occupied
            # Table will become available only after payment confirmation
            session.status = 'completed'
            session.end_time = datetime.utcnow()
            # DO NOT set table.status = 'available' here
            # Table becomes available only in payment confirmation endpoints:
            # - /api/staff/cash-pending/{bill_id}/confirm
            # - /api/staff/qr-paid/{bill_id}/verify

    db.commit()

    return {
        "message": "Order status updated successfully",
        "order_id": order_id,
        "new_status": new_status
    }


@app.post("/api/orders/generate-random")
async def generate_random_order(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a random order for testing
    This simulates a guest placing an order
    """

    # Verify branch exists and user has access
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    # Get all available tables in this branch
    tables = db.query(DiningTable).filter(
        DiningTable.branch_id == branch_id,
        DiningTable.status.in_(['available', 'occupied'])
    ).all()

    if not tables:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No available tables found in this branch"
        )

    # Pick a random table
    table = random.choice(tables)

    # Get all menu items for this branch
    menu_items = db.query(MenuItem).filter(
        MenuItem.branch_id == branch_id,
        MenuItem.status == 'available'
    ).all()

    if not menu_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No menu items found for this branch"
        )

    # Generate random order items (1-4 items)
    num_items = random.randint(1, min(4, len(menu_items)))
    selected_items = random.sample(menu_items, num_items)

    items = []
    notes = [
        None,
        "Không hành",
        "Thêm sốt",
        "Ít đá",
        "Không cay",
        "Chín kỹ",
        None,
        None
    ]

    for menu_item in selected_items:
        items.append(OrderItemCreate(
            menu_item_id=menu_item.menu_item_id,
            quantity=random.randint(1, 3),
            note=random.choice(notes)
        ))

    # Create the order
    order_data = OrderCreate(
        table_id=table.table_id,
        items=items
    )

    # Call the create_order function
    return await create_order(order_data, db)

# ============== CASHBACK SETTINGS ENDPOINTS ==============

@app.get("/api/tenants/{tenant_id}/cashback-settings", response_model=CashbackSettingsResponse)
async def get_cashback_settings(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tenant cashback settings"""

    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )

    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    return {
        "tenant_id": tenant.tenant_id,
        "cashback_percent": float(tenant.cashback_percent)
    }


@app.put("/api/tenants/{tenant_id}/cashback-settings", response_model=CashbackSettingsResponse)
async def update_cashback_settings(
    tenant_id: str,
    settings: CashbackSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update tenant cashback settings"""

    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )

    if settings.cashback_percent < 0 or settings.cashback_percent > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cashback percent must be between 0 and 100"
        )

    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )

    tenant.cashback_percent = settings.cashback_percent
    db.commit()
    db.refresh(tenant)

    return {
        "tenant_id": tenant.tenant_id,
        "cashback_percent": float(tenant.cashback_percent)
    }


# ============== BRANCH/RESTAURANT ENDPOINTS ==============

@app.post("/api/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_data: BranchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new branch"""

    branch_id = str(uuid.uuid4())
    new_branch = Branch(
        branch_id=branch_id,
        tenant_id=current_user.tenant_id,
        branch_name=branch_data.branch_name,
        address=branch_data.address,
        province=branch_data.province,
        phone=branch_data.phone,
        manager_name=branch_data.manager_name,
        cashback_percent=branch_data.cashback_percent,
        image=branch_data.image,
        status="active",
        # ✅ NEW: VietQR Bank Information
        bank_code=branch_data.bank_code,
        bank_account_number=branch_data.bank_account_number,
        bank_account_name=branch_data.bank_account_name,
        # ✅ NEW: Opening hours and location info
        opening_hours=branch_data.opening_hours,
        closing_hours=branch_data.closing_hours,
        google_maps_link=branch_data.google_maps_link
    )

    db.add(new_branch)

    try:
        db.commit()
        db.refresh(new_branch)

        # ✅ Add menu_item_count to response
        response = BranchResponse.model_validate(new_branch)
        response.menu_item_count = 0  # New branch has no items
        return response
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ✅ UPDATED: Modified to include menu item count
@app.get("/api/branches", response_model=List[BranchResponse])
async def get_branches(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all branches for a tenant with menu item counts"""

    # Verify user has access to this tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )

    # Get branches with menu item counts
    branches = db.query(
        Branch,
        func.count(MenuItem.menu_item_id).label('menu_item_count')
    ).outerjoin(
        MenuItem, Branch.branch_id == MenuItem.branch_id
    ).filter(
        Branch.tenant_id == tenant_id
    ).group_by(
        Branch.branch_id
    ).all()

    # Convert to response format
    result = []
    for branch, count in branches:
        branch_dict = {
            "branch_id": branch.branch_id,
            "branch_name": branch.branch_name,
            "address": branch.address,
            "province": branch.province,
            "phone": branch.phone,
            "manager_name": branch.manager_name,
            "cashback_percent": float(branch.cashback_percent) if branch.cashback_percent else 1.0,
            "image": branch.image,
            "status": branch.status,
            "created_at": branch.created_at,
            "updated_at": None,
            "menu_item_count": count,
            # ✅ NEW: Include opening hours and location
            "opening_hours": branch.opening_hours,
            "closing_hours": branch.closing_hours,
            "google_maps_link": branch.google_maps_link,
            # ✅ NEW: Include VietQR Bank Information
            "bank_code": branch.bank_code,
            "bank_account_number": branch.bank_account_number,
            "bank_account_name": branch.bank_account_name
        }
        result.append(BranchResponse(**branch_dict))

    return result


@app.get("/api/branches/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    # ✅ Get menu item count for this branch
    menu_item_count = db.query(func.count(MenuItem.menu_item_id)).filter(
        MenuItem.branch_id == branch_id
    ).scalar()

    # Convert to response with count
    response = BranchResponse.model_validate(branch)
    response.menu_item_count = menu_item_count or 0
    return response


@app.put("/api/branches/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: str,
    branch_data: BranchUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    # Update fields
    if branch_data.branch_name is not None:
        branch.branch_name = branch_data.branch_name
    if branch_data.address is not None:
        branch.address = branch_data.address
    if branch_data.province is not None:
        branch.province = branch_data.province
    if branch_data.phone is not None:
        branch.phone = branch_data.phone
    if branch_data.manager_name is not None:
        branch.manager_name = branch_data.manager_name
    if branch_data.cashback_percent is not None:
        branch.cashback_percent = branch_data.cashback_percent
    if branch_data.image is not None:
        branch.image = branch_data.image
    if branch_data.status is not None:
        branch.status = branch_data.status
    # ✅ NEW: Update VietQR Bank Information
    if branch_data.bank_code is not None:
        branch.bank_code = branch_data.bank_code
    if branch_data.bank_account_number is not None:
        branch.bank_account_number = branch_data.bank_account_number
    if branch_data.bank_account_name is not None:
        branch.bank_account_name = branch_data.bank_account_name
    # ✅ NEW: Update opening hours and location info
    if branch_data.opening_hours is not None:
        branch.opening_hours = branch_data.opening_hours
    if branch_data.closing_hours is not None:
        branch.closing_hours = branch_data.closing_hours
    if branch_data.google_maps_link is not None:
        branch.google_maps_link = branch_data.google_maps_link

    db.commit()
    db.refresh(branch)

    # ✅ Get menu item count
    menu_item_count = db.query(func.count(MenuItem.menu_item_id)).filter(
        MenuItem.branch_id == branch_id
    ).scalar()

    response = BranchResponse.model_validate(branch)
    response.menu_item_count = menu_item_count or 0
    return response


@app.delete("/api/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    db.delete(branch)
    db.commit()
    return None


# ============== DINING TABLE ENDPOINTS ==============

@app.post("/api/branches/{branch_id}/tables", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
async def create_table(
    branch_id: str,
    table_data: TableCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a table for a branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    table_id = str(uuid.uuid4())
    new_table = DiningTable(
        table_id=table_id,
        branch_id=branch_id,
        table_number=table_data.table_number,
        capacity=table_data.capacity,
        status=table_data.status
    )

    db.add(new_table)

    # Create QR code for the table
    qr_id = str(uuid.uuid4())
    qr_content = f"{branch_id}|{table_id}"

    new_qr = QRCode(
        qr_id=qr_id,
        table_id=table_id,
        qr_content=qr_content,
        is_active=True
    )

    db.add(new_qr)

    try:
        db.commit()
        db.refresh(new_table)
        return new_table
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/branches/{branch_id}/tables", response_model=List[TableResponse])
async def get_tables(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tables for a branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    tables = db.query(DiningTable).filter(DiningTable.branch_id == branch_id).all()
    return tables


@app.get("/api/tables/{table_id}", response_model=TableResponse)
async def get_table(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific table"""

    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # Get branch to verify access
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this table"
        )

    return table


@app.put("/api/tables/{table_id}", response_model=TableResponse)
async def update_table(
    table_id: str,
    table_data: TableUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update table"""

    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # Get branch to verify access
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this table"
        )

    # Update fields
    if table_data.table_number is not None:
        table.table_number = table_data.table_number
    if table_data.capacity is not None:
        table.capacity = table_data.capacity
    if table_data.status is not None:
        table.status = table_data.status

    db.commit()
    db.refresh(table)
    return table


@app.delete("/api/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_table(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete table"""

    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # Get branch to verify access
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this table"
        )

    db.delete(table)
    db.commit()
    return None


@app.get("/api/tables/{table_id}/qr-code", response_model=QRCodeResponse)
async def get_qr_code(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get QR code for a table"""

    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # Get branch to verify access
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this table"
        )

    qr_code = db.query(QRCode).filter(QRCode.table_id == table_id).first()
    if not qr_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not found for this table"
        )

    return qr_code


# ============== CATEGORY ENDPOINTS ==============

@app.post("/api/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new category"""

    category_id = str(uuid.uuid4())
    new_category = Category(
        category_id=category_id,
        tenant_id=current_user.tenant_id,
        category_name=category_data.category_name,
        description=category_data.description,
        status=category_data.status
    )

    db.add(new_category)

    try:
        db.commit()
        db.refresh(new_category)
        return new_category
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/categories", response_model=List[CategoryResponse])
async def get_categories(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all categories for a tenant"""

    # Verify user has access to this tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )

    categories = db.query(Category).filter(Category.tenant_id == tenant_id).all()
    return categories


# ============== MENU ITEM ENDPOINTS ==============

@app.post("/api/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_item(
    item_data: MenuItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new menu item"""

    # Verify category exists and belongs to user's tenant
    category = db.query(Category).filter(Category.category_id == item_data.category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # ✅ ADDED: Verify branch exists and belongs to user's tenant
    branch = db.query(Branch).filter(Branch.branch_id == item_data.branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != category.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this category"
        )

    if item_data.discount_percent and (item_data.discount_percent < 0 or item_data.discount_percent > 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount percent must be between 0 and 100"
        )

    menu_item_id = str(uuid.uuid4())
    new_item = MenuItem(
        menu_item_id=menu_item_id,
        category_id=item_data.category_id,
        branch_id=item_data.branch_id,  # ✅ ADDED
        item_name=item_data.item_name,
        description=item_data.description,
        price=item_data.price,
        discount_percent=item_data.discount_percent or 0,
        status=item_data.status,
        image=item_data.image
    )
    db.add(new_item)

    try:
        db.commit()
        db.refresh(new_item)
        return new_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/categories/{category_id}/menu-items", response_model=List[MenuItemResponse])
async def get_menu_items_by_category(
    category_id: str,
    branch_id: str,  # ✅ ADDED query parameter
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all menu items in a category for a specific branch"""

    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != category.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this category"
        )

    # ✅ CHANGED: Filter by both category_id AND branch_id
    items = db.query(MenuItem).filter(
        MenuItem.category_id == category_id,
        MenuItem.branch_id == branch_id
    ).all()
    return items


# ✅ NEW ENDPOINT: Get all menu items by branch
@app.get("/api/branches/{branch_id}/menu-items", response_model=List[MenuItemResponse])
async def get_menu_items_by_branch(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all menu items for a specific branch"""

    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Verify user has access to this tenant
    if current_user.tenant_id != branch.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this branch"
        )

    items = db.query(MenuItem).filter(MenuItem.branch_id == branch_id).all()
    return items


@app.get("/api/menu-items/{menu_item_id}", response_model=MenuItemResponse)
async def get_menu_item(
    menu_item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific menu item"""

    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    # Get category to verify access
    category = db.query(Category).filter(Category.category_id == item.category_id).first()
    if current_user.tenant_id != category.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this menu item"
        )

    return item


@app.put("/api/menu-items/{menu_item_id}", response_model=MenuItemResponse)
async def update_menu_item(
    menu_item_id: str,
    item_data: MenuItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update menu item"""

    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    # Get category to verify access
    category = db.query(Category).filter(Category.category_id == item.category_id).first()
    if current_user.tenant_id != category.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this menu item"
        )

    # ✅ NEW: Validate new category if being changed
    if item_data.category_id is not None and item_data.category_id != item.category_id:
        new_category = db.query(Category).filter(Category.category_id == item_data.category_id).first()
        if not new_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="New category not found"
            )
        if new_category.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the new category"
            )

    if item_data.discount_percent is not None:
        if item_data.discount_percent < 0 or item_data.discount_percent > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount percent must be between 0 and 100"
            )

    if item_data.item_name is not None:
        item.item_name = item_data.item_name
    if item_data.description is not None:
        item.description = item_data.description
    if item_data.price is not None:
        item.price = item_data.price
    if item_data.discount_percent is not None:
        item.discount_percent = item_data.discount_percent
    if item_data.status is not None:
        item.status = item_data.status
    if item_data.image is not None:
        item.image = item_data.image
    if item_data.category_id is not None:  # ✅ ADDED: Update category
        item.category_id = item_data.category_id

    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/menu-items/{menu_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu_item(
    menu_item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete menu item"""

    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    # Get category to verify access
    category = db.query(Category).filter(Category.category_id == item.category_id).first()
    if current_user.tenant_id != category.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this menu item"
        )

    db.delete(item)
    db.commit()
    return None


# ============== STATS ENDPOINT ==============

@app.get("/api/stats/{tenant_id}")
async def get_dashboard_stats(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics with real revenue and order data"""

    # Verify user has access to this tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )

    today = datetime.now().date()
    first_of_month = today.replace(day=1)

    total_branches = db.query(Branch).filter(Branch.tenant_id == tenant_id).count()
    total_tables = db.query(DiningTable).join(Branch).filter(Branch.tenant_id == tenant_id).count()
    active_branches = db.query(Branch).filter(
        Branch.tenant_id == tenant_id,
        Branch.status == "active"
    ).count()

    # ── Revenue base: Bill → Session → Table → Branch, scoped to tenant + paid bills ──
    bill_base = (
        db.query(Bill)
        .join(DBSession, Bill.session_id == DBSession.session_id)
        .join(DiningTable, DBSession.table_id == DiningTable.table_id)
        .join(Branch, DiningTable.branch_id == Branch.branch_id)
        .filter(
            Branch.tenant_id == tenant_id,
            Bill.status.in_(["paid", "verified"])
        )
    )

    # Today's revenue: sum of paid bills where session ended today
    today_revenue = (
        bill_base
        .filter(func.date(DBSession.end_time) == today)
        .with_entities(func.coalesce(func.sum(Bill.total_amount), 0))
        .scalar()
    )

    # Monthly revenue: sum of paid bills where session ended from 1st of current month onward
    monthly_revenue = (
        bill_base
        .filter(func.date(DBSession.end_time) >= first_of_month)
        .with_entities(func.coalesce(func.sum(Bill.total_amount), 0))
        .scalar()
    )

    # Today's orders: count of orders placed today (all statuses — reflects activity)
    today_orders = (
        db.query(func.count(Order.order_id))
        .join(DBSession, Order.session_id == DBSession.session_id)
        .join(DiningTable, DBSession.table_id == DiningTable.table_id)
        .join(Branch, DiningTable.branch_id == Branch.branch_id)
        .filter(
            Branch.tenant_id == tenant_id,
            func.date(Order.order_time) == today
        )
        .scalar()
    )

    return {
        "total_branches": total_branches,
        "total_tables": total_tables,
        "active_branches": active_branches,
        "today_revenue": float(today_revenue),
        "today_orders": today_orders,
        "monthly_revenue": float(monthly_revenue)
    }

# ============== ADMIN ENDPOINTS (No Authentication Required) ==============
# Add these endpoints to main.py before the health check endpoint

@app.get("/api/admin/dashboard")
async def get_admin_dashboard_stats(db: Session = Depends(get_db)):
    '''Get dashboard statistics for admin - NO AUTH REQUIRED'''

    total_restaurants = db.query(Tenant).count()
    total_users = db.query(User).count()
    active_restaurants = db.query(Tenant).filter(Tenant.status == "active").count()
    active_users = db.query(User).join(Staff, User.user_id == Staff.user_id, isouter=True).filter(
        (Staff.status == "active") | (Staff.staff_id == None)
    ).count()

    return {
        "total_restaurants": total_restaurants,
        "total_users": total_users,
        "active_restaurants": active_restaurants,
        "active_users": active_users
    }

@app.get("/api/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    '''Get admin dashboard statistics - NO AUTH REQUIRED'''

    # Count total restaurants (tenants)
    total_restaurants = db.query(Tenant).count()

    # Count total users
    total_users = db.query(User).count()

    # Count active restaurants
    active_restaurants = db.query(Tenant).filter(Tenant.status == "active").count()

    # Count active users (users who are staff or customers with active status)
    active_users = db.query(User).join(Staff, User.user_id == Staff.user_id, isouter=True).filter(
        (Staff.status == "active") | (Staff.staff_id == None)
    ).count()

    return {
        "total_restaurants": total_restaurants,
        "total_users": total_users,
        "active_restaurants": active_restaurants,
        "active_users": active_users
    }


@app.get("/api/admin/restaurants")
async def get_all_restaurants(
    page: int = 1,
    limit: int = 5,
    search: str = None,
    db: Session = Depends(get_db)
):
    '''Get all restaurants with pagination - NO AUTH REQUIRED'''

    query = db.query(Tenant)

    # Search filter
    if search:
        query = query.filter(Tenant.tenant_name.contains(search))

    # Get total count
    total = query.count()

    # Pagination
    offset = (page - 1) * limit
    restaurants = query.offset(offset).limit(limit).all()

    # Format response
    results = []
    for restaurant in restaurants:
        # Get branch count and total revenue
        branch_count = db.query(Branch).filter(Branch.tenant_id == restaurant.tenant_id).count()

        # Calculate total revenue from all branches of this tenant
        total_revenue = db.query(func.sum(Bill.total_amount)).join(
            DBSession, Bill.session_id == DBSession.session_id
        ).join(
            DiningTable, DBSession.table_id == DiningTable.table_id
        ).join(
            Branch, DiningTable.branch_id == Branch.branch_id
        ).filter(
            Branch.tenant_id == restaurant.tenant_id,
            Bill.status == "paid"
        ).scalar() or 0

        # Get owner info (first user of tenant)
        owner = db.query(User).filter(User.tenant_id == restaurant.tenant_id).first()

        results.append({
            "tenant_id": restaurant.tenant_id,
            "name": restaurant.tenant_name,
            "owner_name": owner.full_name if owner else "N/A",
            "owner_email": owner.email if owner else "N/A",
            "branch_count": branch_count,
            "revenue": float(total_revenue),
            "status": restaurant.status,
            "created_at": restaurant.created_at.strftime("%d/%m/%Y") if restaurant.created_at else ""
        })

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@app.get("/api/admin/revenue")
async def get_all_revenue(
    page: int = 1,
    limit: int = 5,
    period: str = "today",  # ✅ NEW: "today" (default), "month", or "all"
    db: Session = Depends(get_db)
):
    '''Get revenue statistics for all restaurants - NO AUTH REQUIRED
    
    Args:
        page: Page number for pagination
        limit: Items per page
        period: Time period - "today" (default), "month", or "all"
    '''

    today = datetime.now().date()
    first_of_month = today.replace(day=1)

    # Get all tenants
    query = db.query(Tenant).filter(Tenant.status == "active")
    total = query.count()

    # Pagination
    offset = (page - 1) * limit
    restaurants = query.offset(offset).limit(limit).all()

    # Format response
    results = []
    total_orders_count = 0

    for restaurant in restaurants:
        # Build order query base
        order_query = db.query(Order).join(
            DBSession, Order.session_id == DBSession.session_id
        ).join(
            DiningTable, DBSession.table_id == DiningTable.table_id
        ).join(
            Branch, DiningTable.branch_id == Branch.branch_id
        ).filter(
            Branch.tenant_id == restaurant.tenant_id
        )
        
        # ✅ FIXED: Apply date filter based on period to match owner dashboard
        if period == "today":
            order_query = order_query.filter(func.date(Order.order_time) == today)
        elif period == "month":
            order_query = order_query.filter(func.date(Order.order_time) >= first_of_month)
        # "all" - no date filter
        
        order_count = order_query.count()

        # Build revenue query base
        revenue_query = db.query(func.sum(Bill.total_amount)).join(
            DBSession, Bill.session_id == DBSession.session_id
        ).join(
            DiningTable, DBSession.table_id == DiningTable.table_id
        ).join(
            Branch, DiningTable.branch_id == Branch.branch_id
        ).filter(
            Branch.tenant_id == restaurant.tenant_id,
            Bill.status.in_(["paid", "verified"])
        )
        
        # ✅ FIXED: Apply date filter based on period to match owner dashboard
        if period == "today":
            revenue_query = revenue_query.filter(func.date(Bill.created_at) == today)
        elif period == "month":
            revenue_query = revenue_query.filter(func.date(Bill.created_at) >= first_of_month)
        # "all" - no date filter
        
        revenue = revenue_query.scalar() or 0

        total_orders_count += order_count

        results.append({
            "tenant_id": restaurant.tenant_id,
            "name": restaurant.tenant_name,
            "orders": order_count,
            "revenue": float(revenue),
            "status": restaurant.status
        })

    return {
        "data": results,
        "total": total,
        "total_orders": total_orders_count,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
        "period": period  # ✅ NEW: Return which period was used
    }


@app.get("/api/admin/users")
async def get_all_users(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    role: str = None,
    db: Session = Depends(get_db)
):
    '''Get all users with filtering and pagination - NO AUTH REQUIRED'''

    query = db.query(User)

    # Search filter
    if search:
        query = query.filter(
            (User.full_name.contains(search)) |
            (User.email.contains(search))
        )

    # Get all users first
    users_list = query.all()

    # Format response
    results = []
    active_count = 0

    for user in users_list:
        # Determine role
        user_role = get_user_role(user, db)

        # Filter by role if specified
        if role and role != 'all' and user_role != role:
            continue

        # Get status from staff if exists
        staff = db.query(Staff).filter(Staff.user_id == user.user_id).first()
        user_status = staff.status if staff else "active"

        if user_status == "active":
            active_count += 1

        # Get tenant name
        tenant = db.query(Tenant).filter(Tenant.tenant_id == user.tenant_id).first()

        results.append({
            "user_id": user.user_id,
            "name": user.full_name,
            "email": user.email,
            "role": user_role,
            "tenant_name": tenant.tenant_name if tenant else "N/A",
            "status": user_status,
            "created_at": user.created_at.strftime("%d/%m/%Y") if user.created_at else ""
        })

    # Pagination after filtering
    total = len(results)
    offset = (page - 1) * limit
    paginated_results = results[offset:offset + limit]

    return {
        "data": paginated_results,
        "total": total,
        "active_users": active_count,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1
    }


@app.patch("/api/admin/users/{user_id}/status")
async def update_user_status_admin(
    user_id: str,
    status_data: dict,
    db: Session = Depends(get_db)
):
    '''Update user status (lock/unlock) - NO AUTH REQUIRED'''

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update staff status if user is staff
    staff = db.query(Staff).filter(Staff.user_id == user_id).first()
    if staff:
        staff.status = status_data.get("status", "active")

    db.commit()

    return {
        "message": "User status updated successfully",
        "user_id": user_id,
        "status": status_data.get("status")
    }


@app.patch("/api/admin/restaurants/{tenant_id}/status")
async def update_restaurant_status_admin(
    tenant_id: str,
    status_data: dict,
    db: Session = Depends(get_db)
):
    '''Update restaurant status (lock/unlock) - NO AUTH REQUIRED'''

    restaurant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    restaurant.status = status_data.get("status", "active")
    db.commit()

    return {
        "message": "Restaurant status updated successfully",
        "tenant_id": tenant_id,
        "status": status_data.get("status")
    }

# ✅ NEW: Admin edit restaurant endpoint
@app.patch("/api/admin/restaurants/{tenant_id}")
async def update_restaurant_admin(
    tenant_id: str,
    update_data: AdminRestaurantUpdate,
    db: Session = Depends(get_db)
):
    '''Update restaurant information - NO AUTH REQUIRED'''

    restaurant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    # Update restaurant name if provided
    if update_data.tenant_name is not None:
        restaurant.tenant_name = update_data.tenant_name

    # Update owner information if provided
    if update_data.owner_name is not None or update_data.owner_email is not None:
        owner = db.query(User).filter(User.tenant_id == tenant_id).first()
        if owner:
            if update_data.owner_name is not None:
                owner.full_name = update_data.owner_name
            if update_data.owner_email is not None:
                # Check if email already exists for another user
                existing_email = db.query(User).filter(
                    User.email == update_data.owner_email,
                    User.user_id != owner.user_id
                ).first()
                if existing_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email already in use by another user"
                    )
                owner.email = update_data.owner_email

    db.commit()

    return {
        "message": "Restaurant updated successfully",
        "tenant_id": tenant_id
    }


# ✅ NEW: Admin delete restaurant endpoint
@app.delete("/api/admin/restaurants/{tenant_id}")
async def delete_restaurant_admin(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    '''Delete restaurant and all associated data - NO AUTH REQUIRED'''

    restaurant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    # Delete restaurant (cascade will handle related data)
    db.delete(restaurant)
    db.commit()

    return {
        "message": "Restaurant deleted successfully",
        "tenant_id": tenant_id
    }


# ✅ NEW: Admin edit user endpoint
@app.patch("/api/admin/users/{user_id}")
async def update_user_admin(
    user_id: str,
    update_data: AdminUserUpdate,
    db: Session = Depends(get_db)
):
    '''Update user information - NO AUTH REQUIRED'''

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update full name if provided
    if update_data.full_name is not None:
        user.full_name = update_data.full_name

    # Update role if provided
    if update_data.role is not None:
        current_role = get_user_role(user, db)

        # Handle role changes
        if current_role != update_data.role:
            # Remove from current role
            if current_role == "staff" or current_role == "chef":
                staff = db.query(Staff).filter(Staff.user_id == user_id).first()
                if staff:
                    db.delete(staff)
            elif current_role == "customer":
                customer = db.query(Customer).filter(Customer.user_id == user_id).first()
                if customer:
                    db.delete(customer)

            # Add to new role
            if update_data.role == "staff":
                # Get first branch of the user's tenant
                branch = db.query(Branch).filter(Branch.tenant_id == user.tenant_id).first()
                if branch:
                    new_staff = Staff(
                        staff_id=str(uuid.uuid4()),
                        user_id=user_id,
                        branch_id=branch.branch_id,
                        position="Staff",
                        status="active"
                    )
                    db.add(new_staff)
            elif update_data.role == "chef":
                # Get first branch of the user's tenant
                branch = db.query(Branch).filter(Branch.tenant_id == user.tenant_id).first()
                if branch:
                    new_staff = Staff(
                        staff_id=str(uuid.uuid4()),
                        user_id=user_id,
                        branch_id=branch.branch_id,
                        position="Chef",
                        status="active"
                    )
                    db.add(new_staff)
            elif update_data.role == "customer":
                new_customer = Customer(
                    customer_id=str(uuid.uuid4()),
                    user_id=user_id,
                    points_balance=0
                )
                db.add(new_customer)
            # If role is "owner", no additional record needed

    db.commit()

    return {
        "message": "User updated successfully",
        "user_id": user_id
    }


# ✅ NEW: Admin delete user endpoint
@app.delete("/api/admin/users/{user_id}")
async def delete_user_admin(
    user_id: str,
    db: Session = Depends(get_db)
):
    '''Delete user - NO AUTH REQUIRED'''

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Delete user (cascade will handle related data)
    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully",
        "user_id": user_id
    }

# ============================================
# PYDANTIC SCHEMAS FOR GUEST ORDERING
# ============================================

class GuestBranchResponse(BaseModel):
    """Public branch information for guest selection"""
    branch_id: str
    branch_name: str
    address: str
    province: Optional[str]
    phone: Optional[str]
    image: Optional[str]
    cashback_percent: float
    menu_item_count: int
    tenant_name: str
    # ✅ NEW: Additional fields for AI chatbot and restaurant view
    opening_hours: Optional[str] = None
    closing_hours: Optional[str] = None
    google_maps_link: Optional[str] = None
    manager_name: Optional[str] = None
    bank_code: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None

    class Config:
        from_attributes = True


class GuestSessionCreate(BaseModel):
    """
    Create a new dining session
    NOTE: customer_id is OPTIONAL
    - If provided: Session is linked to customer (can earn points)
    - If None: Session is for a guest (anonymous)
    """
    table_id: str
    customer_id: Optional[str] = None  # None for guests, UUID for customers

class GuestSessionResponse(BaseModel):
    session_id: str
    table_id: str
    customer_id: Optional[str]
    start_time: datetime
    status: str

    class Config:
        from_attributes = True

class GuestOrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int
    price: float
    note: Optional[str] = None

class GuestOrderCreate(BaseModel):
    session_id: str
    items: List[GuestOrderItemCreate]
    status: str = "pending"

class GuestOrderResponse(BaseModel):
    order_id: str
    session_id: str
    order_time: datetime
    status: str
    total_items: int
    total_amount: float

    class Config:
        from_attributes = True

class GuestMenuItemResponse(BaseModel):
    menu_item_id: str
    item_name: str
    description: Optional[str]
    price: float
    discount_percent: float
    status: str
    category_id: str
    category_name: str
    image: Optional[str]

    class Config:
        from_attributes = True

class GuestOrderStatusResponse(BaseModel):
    order_id: str
    status: str
    order_time: datetime

    class Config:
        from_attributes = True

# ============================================
# DATABASE DEPENDENCY
# ============================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================
# GUEST ORDERING ENDPOINTS
# ============================================

@app.get("/api/guest/branches", response_model=List[GuestBranchResponse])
async def get_guest_branches(db: Session = Depends(get_db)):
    """
    Get all active branches for guest selection
    PUBLIC ENDPOINT - No authentication required

    This is used by guests to select which restaurant branch to order from.
    Returns branch info including menu item count.
    """

    # Get all active branches with menu counts
    branches = db.query(
        Branch,
        func.count(MenuItem.menu_item_id).label('menu_item_count'),
        Tenant.tenant_name
    ).outerjoin(
        MenuItem, Branch.branch_id == MenuItem.branch_id
    ).join(
        Tenant, Branch.tenant_id == Tenant.tenant_id
    ).filter(
        Branch.status == 'active',
        Tenant.status == 'active'
    ).group_by(
        Branch.branch_id,
        Tenant.tenant_name
    ).all()

    result = []
    for branch, count, tenant_name in branches:
        result.append({
            "branch_id": branch.branch_id,
            "branch_name": branch.branch_name,
            "address": branch.address,
            "province": branch.province,
            "phone": branch.phone,
            "image": branch.image,
            "cashback_percent": float(branch.cashback_percent) if branch.cashback_percent else 1.0,
            "menu_item_count": count,
            "tenant_name": tenant_name,
            # ✅ NEW: Additional fields for AI chatbot
            "opening_hours": branch.opening_hours,
            "closing_hours": branch.closing_hours,
            "google_maps_link": branch.google_maps_link,
            "manager_name": branch.manager_name,
            "bank_code": branch.bank_code,
            "bank_account_number": branch.bank_account_number,
            "bank_account_name": branch.bank_account_name
        })

    print(f"📋 Retrieved {len(result)} active branches for guest selection")
    return result


@app.post("/api/guest/sessions", response_model=GuestSessionResponse)
async def create_guest_session(
    session_data: GuestSessionCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new dining session for guest or customer

    Flow:
    1. Check if table exists and is available
    2. Check for existing ACTIVE session
    3. If exists: return existing session (allows multiple orders in same session)
    4. If not: create new session
    5. Return session details

    NOTE: This is the CRITICAL point where we distinguish guests from customers!
    """

    # Verify table exists
    table = db.query(DiningTable).filter(
        DiningTable.table_id == session_data.table_id
    ).first()

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    # If customer_id provided, verify customer exists
    if session_data.customer_id:
        customer = db.query(Customer).filter(
            Customer.customer_id == session_data.customer_id
        ).first()

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found"
            )

        print(f"🔐 Creating session for CUSTOMER: {session_data.customer_id}")
    else:
        print(f"👤 Creating session for GUEST (anonymous)")

    # Check if there's already an active session for this table
    existing_session = db.query(DBSession).filter(
        DBSession.table_id == session_data.table_id,
        DBSession.status == "active"
    ).first()

    if existing_session:
        # ✅ FIXED: Return existing session to allow multiple orders
        print(f"♻️ Reusing existing active session: {existing_session.session_id}")
        print(f"   → This allows accumulating multiple orders in one dining session")
        return existing_session

    # Create new session
    new_session = DBSession(
        session_id=str(uuid.uuid4()),
        table_id=session_data.table_id,
        customer_id=session_data.customer_id,  # None for guests, UUID for customers
        start_time=datetime.now(),
        status="active"
    )

    db.add(new_session)

    # Update table status
    table.status = "occupied"

    db.commit()
    db.refresh(new_session)

    print(f"✅ Session created: {new_session.session_id}")
    print(f"   - Table: {table.table_number}")
    print(f"   - Customer ID: {new_session.customer_id or 'GUEST'}")

    return new_session


@app.post("/api/guest/orders", response_model=GuestOrderResponse)
async def create_guest_order(
    order_data: GuestOrderCreate,
    db: Session = Depends(get_db)
):
    """
    ✅ FIXED: Add items to order (accumulative)

    Flow:
    1. Verify session exists and is active
    2. Get or create ONE order for this session
    3. Add new order items to the order
    4. Calculate CUMULATIVE total (add to existing total)
    5. Update bill with new total
    6. If customer: calculate and record points earned
    7. Return order details

    KEY CHANGES:
    - Always uses ONE order per session
    - Accumulates items instead of replacing
    - Updates bill total cumulatively
    - Kitchen sees one growing order, not multiple separate orders
    """

    # Verify session exists and is active
    session = db.query(DBSession).filter(
        DBSession.session_id == order_data.session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is {session.status}. Cannot add items to completed session."
        )

    # ✅ FIXED: Get or create ONE order for this session
    order = db.query(Order).filter(
        Order.session_id == order_data.session_id
    ).first()

    if order:
        # ✅ FIXED: Accumulate items in existing order
        print(f"♻️ Adding items to existing order: {order.order_id}")
        print(f"   → Status: {order.status}")
    else:
        # Create new order (first order for this session)
        order = Order(
            order_id=str(uuid.uuid4()),
            session_id=order_data.session_id,
            order_time=datetime.now(),
            status="ordered"  # ✅ Always start as "ordered" so kitchen sees it
        )
        db.add(order)
        print(f"✅ New order created: {order.order_id}")

    # ✅ FIXED: Add new order items (accumulative)
    new_items_total = Decimal('0')

    for item_data in order_data.items:
        # Verify menu item exists
        menu_item = db.query(MenuItem).filter(
            MenuItem.menu_item_id == item_data.menu_item_id
        ).first()

        if not menu_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item {item_data.menu_item_id} not found"
            )

        # ✅ FIXED: Create new order item (don't check for duplicates)
        # If guest orders the same dish twice, create two separate order items
        order_item = OrderItem(
            order_item_id=str(uuid.uuid4()),
            order_id=order.order_id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            price=Decimal(str(item_data.price)),
            note=item_data.note
        )

        db.add(order_item)
        new_items_total += Decimal(str(item_data.price)) * item_data.quantity

    print(f"💰 New items total: {new_items_total}đ")

    # ✅ FIXED: Create or update bill (ACCUMULATIVE)
    bill = db.query(Bill).filter(
        Bill.session_id == order_data.session_id
    ).first()

    if bill:
        # ✅ FIXED: Add to existing total (accumulative)
        old_total = bill.total_amount
        bill.total_amount += new_items_total
        print(f"♻️ Updated bill: {old_total}đ → {bill.total_amount}đ (+{new_items_total}đ)")
    else:
        # Create new bill (first order)
        bill = Bill(
            bill_id=str(uuid.uuid4()),
            session_id=order_data.session_id,
            total_amount=new_items_total,
            status="pending",
            payment_method=None
        )
        db.add(bill)
        print(f"✅ New bill created: {new_items_total}đ")

    # ✅ FIXED: Calculate points on CUMULATIVE total
    if session.customer_id:
        # Get branch's cashback percentage
        table = db.query(DiningTable).filter(
            DiningTable.table_id == session.table_id
        ).first()

        branch = db.query(Branch).filter(
            Branch.branch_id == table.branch_id
        ).first()

        cashback_percent = branch.cashback_percent if branch else Decimal('1.0')

        # ✅ FIXED: Calculate points on FULL bill total (not just new items)
        points_earned = (bill.total_amount * cashback_percent) / Decimal('100')
        bill.points_earned = points_earned

        print(f"💰 Customer will earn {points_earned} points")
        print(f"   - Bill total: {bill.total_amount}đ")
        print(f"   - Cashback: {cashback_percent}%")
    else:
        print(f"👤 Guest order - no points earned")

    db.commit()
    db.refresh(order)

    # ✅ FIXED: Return cumulative totals
    all_items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()

    return {
        "order_id": order.order_id,
        "session_id": order.session_id,
        "order_time": order.order_time,
        "status": order.status,
        "total_items": len(all_items),  # ✅ Count ALL items
        "total_amount": float(bill.total_amount)  # ✅ Return cumulative total
    }


# ==============================================================================
# USAGE NOTES:
# ==============================================================================
#
# Replace the existing functions in main.py (lines 2269-2475) with these fixed versions.
#
# SCENARIO 1: Guest orders, then orders more (first order not served yet)
# -----------------------------------------------------------------------
# Order 1: Burger + Fries
#   → Creates: Session A, Order X, Bill (50,000đ)
#   → Kitchen sees: Order X with 2 items
#
# Order 2: Pizza + Drink
#   → Reuses: Session A, Order X
#   → Updates: Bill (50,000đ → 100,000đ)
#   → Kitchen sees: Order X with 4 items (accumulated)
#   ✅ Result: ONE order, ONE bill, correct total
#
# SCENARIO 2: Guest orders, gets served, then orders more
# --------------------------------------------------------
# Order 1: Burger + Fries
#   → Creates: Session A, Order X, Bill (50,000đ)
#   → Staff marks as served
#   → Session A becomes "completed"
#
# Order 2: Pizza + Drink
#   → Session A is completed, so creates: Session B, Order Y, Bill (50,000đ)
#   → Kitchen sees: New Order Y with 2 items
#   ✅ Result: TWO separate sessions, TWO bills (correct for separate visits)
#
# ==============================================================================



@app.get("/api/guest/orders/{order_id}/status", response_model=GuestOrderStatusResponse)
async def get_guest_order_status(
    order_id: str,
    db: Session = Depends(get_db)
):
    """
    Get current status of an order
    Used for real-time order tracking
    """

    order = db.query(Order).filter(Order.order_id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    return {
        "order_id": order.order_id,
        "status": order.status,
        "order_time": order.order_time
    }


@app.get("/api/guest/menu-items", response_model=List[GuestMenuItemResponse])
async def get_guest_menu_items(
    branch_id: str,
    db: Session = Depends(get_db)
):
    """
    Get all available menu items for a specific branch
    PUBLIC ENDPOINT - No authentication required

    Used by guests to browse menu before ordering.
    Includes category information.
    """

    # Verify branch exists
    branch = db.query(Branch).filter(
        Branch.branch_id == branch_id,
        Branch.status == 'active'
    ).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found or inactive"
        )

    # Get menu items for this branch
    menu_items = db.query(MenuItem).join(Category).filter(
        MenuItem.branch_id == branch_id,
        MenuItem.status == "available"
    ).all()

    result = []
    for item in menu_items:
        result.append({
            "menu_item_id": item.menu_item_id,
            "item_name": item.item_name,
            "description": item.description,
            "price": float(item.price),
            "discount_percent": float(item.discount_percent) if item.discount_percent else 0,
            "status": item.status,
            "category_id": item.category_id,
            "category_name": item.category.category_name,
            "image": item.image
        })

    print(f"📋 Retrieved {len(result)} menu items for branch {branch.branch_name}")
    return result

@app.get("/api/guest/tables/{table_id}")
async def get_guest_table_info(
    table_id: str,
    db: Session = Depends(get_db)
):
    """
    Get table information for display
    PUBLIC ENDPOINT - No authentication required
    """

    table = db.query(DiningTable).filter(
        DiningTable.table_id == table_id
    ).first()

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )

    return {
        "table_id": table.table_id,
        "table_number": table.table_number,
        "capacity": table.capacity,
        "status": table.status,
        "branch_id": table.branch_id
    }

# Schema for order details with items
class GuestOrderItemDetail(BaseModel):
    order_item_id: str
    menu_item_id: str
    menu_item_name: str
    quantity: int
    price: float
    note: Optional[str]
    subtotal: float

    class Config:
        from_attributes = True

class GuestOrderDetail(BaseModel):
    order_id: str
    session_id: str
    order_time: datetime
    status: str
    items: List[GuestOrderItemDetail]
    subtotal: float
    vat: float
    total: float

    class Config:
        from_attributes = True

class GuestBillDetail(BaseModel):
    bill_id: str
    session_id: str
    total_amount: float
    payment_method: Optional[str]
    status: str

    # Bank information from branch
    bank_code: Optional[str]
    bank_account_number: Optional[str]
    bank_account_name: Optional[str]

    class Config:
        from_attributes = True

@app.get("/api/guest/sessions/{session_id}/details")
async def get_guest_session_details(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    ✅ FIXED: Get complete session details including ALL unpaid orders at this table

    Key Changes:
    1. Aggregates all UNPAID sessions at the same table from today
    2. Excludes sessions that are already paid (prevents mixing customers)
    3. Calculates cumulative total for all unpaid orders
    """
    from datetime import datetime, time

    # Get current session
    session = db.query(DBSession).filter(
        DBSession.session_id == session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Get table and branch for bank info
    table = db.query(DiningTable).filter(
        DiningTable.table_id == session.table_id
    ).first()

    branch = db.query(Branch).filter(
        Branch.branch_id == table.branch_id
    ).first() if table else None

    # ✅ FIXED: Get ALL UNPAID sessions for this table from today
    # Key difference: We exclude sessions with paid bills to prevent mixing customers
    today_start = datetime.combine(datetime.now().date(), time.min)

    # First, get all sessions at this table from today
    all_table_sessions = db.query(DBSession).filter(
        DBSession.table_id == session.table_id,
        DBSession.start_time >= today_start
    ).all()

    # ✅ NEW: Filter out sessions that have already been paid
    unpaid_sessions = []
    for tbl_session in all_table_sessions:
        # Check if this session has a paid bill
        bill = db.query(Bill).filter(
            Bill.session_id == tbl_session.session_id
        ).first()

        # Include session if:
        # 1. No bill exists yet (pending), OR
        # 2. Bill exists but not paid (status = 'pending', 'cash_pending', etc.)
        if not bill or bill.status not in ['paid', 'verified', 'completed']:
            unpaid_sessions.append(tbl_session)
        else:
            print(f"⏭️  Skipping session {tbl_session.session_id} - already paid (bill status: {bill.status})")

    print(f"🔍 Found {len(unpaid_sessions)} UNPAID sessions for table {table.table_number if table else 'N/A'}")
    print(f"   (Total sessions today: {len(all_table_sessions)}, Paid: {len(all_table_sessions) - len(unpaid_sessions)})")

    # ✅ FIXED: Aggregate ALL order items from ALL UNPAID sessions
    all_items = []
    all_orders_data = []
    cumulative_subtotal = Decimal('0')

    for tbl_session in unpaid_sessions:
        order = db.query(Order).filter(
            Order.session_id == tbl_session.session_id
        ).first()

        if not order:
            continue

        all_orders_data.append({
            "order_id": order.order_id,
            "session_id": tbl_session.session_id,
            "order_time": order.order_time,
            "status": order.status
        })

        order_items = db.query(OrderItem, MenuItem).join(
            MenuItem, OrderItem.menu_item_id == MenuItem.menu_item_id
        ).filter(
            OrderItem.order_id == order.order_id
        ).all()

        for order_item, menu_item in order_items:
            item_subtotal = Decimal(str(order_item.price)) * order_item.quantity
            cumulative_subtotal += item_subtotal

            all_items.append({
                "order_item_id": order_item.order_item_id,
                "menu_item_id": order_item.menu_item_id,
                "menu_item_name": menu_item.item_name,
                "quantity": order_item.quantity,
                "price": float(order_item.price),
                "note": order_item.note,
                "subtotal": float(item_subtotal),
                "from_order_id": order.order_id,
                "from_session_id": tbl_session.session_id
            })

    print(f"💰 Cumulative subtotal from {len(all_items)} items across {len(unpaid_sessions)} sessions: {cumulative_subtotal}đ")

    # Calculate VAT and total
    vat = cumulative_subtotal * Decimal('0.1')
    total = cumulative_subtotal + vat

    # Get or update bill
    bill = db.query(Bill).filter(
        Bill.session_id == session_id
    ).first()

    # If no bill for current session, check other unpaid sessions
    if not bill and len(unpaid_sessions) > 1:
        for tbl_session in unpaid_sessions:
            existing_bill = db.query(Bill).filter(
                Bill.session_id == tbl_session.session_id
            ).first()
            if existing_bill and existing_bill.status not in ['paid', 'verified', 'completed']:
                bill = existing_bill
                print(f"♻️ Using existing unpaid bill from session {tbl_session.session_id}")
                break

    # Update bill total to match cumulative total
    if bill:
        if bill.total_amount != total:
            old_total = bill.total_amount
            bill.total_amount = total
            print(f"📝 Updated bill total: {old_total}đ → {total}đ")
            db.commit()

    return {
        "session_id": session.session_id,
        "table_id": session.table_id,
        "table_number": table.table_number if table else "N/A",
        "order": {
            "order_id": all_orders_data[-1]["order_id"] if all_orders_data else None,
            "session_id": session.session_id,
            "order_time": all_orders_data[-1]["order_time"] if all_orders_data else None,
            "status": all_orders_data[-1]["status"] if all_orders_data else None,
            "items": all_items,
            "subtotal": float(cumulative_subtotal),
            "vat": float(vat),
            "total": float(total),
            "all_orders": all_orders_data,
            "unpaid_sessions_count": len(unpaid_sessions)  # ✅ NEW: For debugging
        },
        "bill": {
            "bill_id": bill.bill_id if bill else None,
            "session_id": session_id,
            "total_amount": float(total),
            "payment_method": bill.payment_method if bill else None,
            "status": bill.status if bill else "pending",
            "bank_code": branch.bank_code if branch else None,
            "bank_account_number": branch.bank_account_number if branch else None,
            "bank_account_name": branch.bank_account_name if branch else None
        } if bill else {
            "bill_id": None,
            "session_id": session_id,
            "total_amount": float(total),
            "payment_method": None,
            "status": "pending",
            "bank_code": branch.bank_code if branch else None,
            "bank_account_number": branch.bank_account_number if branch else None,
            "bank_account_name": branch.bank_account_name if branch else None
        }
    }

    # Calculate VAT and total on CUMULATIVE amount
    vat = cumulative_subtotal * Decimal('0.1')
    total = cumulative_subtotal + vat

    # ✅ FIXED: Get or create cumulative bill
    # Check if there's an existing bill for the current session
    bill = db.query(Bill).filter(
        Bill.session_id == session_id
    ).first()

    # If no bill exists for current session, check if there's a bill
    # from a previous session at this table
    if not bill and len(all_table_sessions) > 1:
        for tbl_session in all_table_sessions:
            existing_bill = db.query(Bill).filter(
                Bill.session_id == tbl_session.session_id
            ).first()
            if existing_bill:
                bill = existing_bill
                print(f"♻️ Using existing bill from session {tbl_session.session_id}")
                break

    # Update bill total to match cumulative total
    if bill:
        if bill.total_amount != total:
            old_total = bill.total_amount
            bill.total_amount = total
            print(f"📝 Updated bill total: {old_total}đ → {total}đ")
            db.commit()

    # Return response with CUMULATIVE data
    return {
        "session_id": session.session_id,
        "table_id": session.table_id,
        "table_number": table.table_number if table else "N/A",
        "order": {
            "order_id": all_orders_data[-1]["order_id"] if all_orders_data else None,  # Most recent order
            "session_id": session.session_id,
            "order_time": all_orders_data[-1]["order_time"] if all_orders_data else None,
            "status": all_orders_data[-1]["status"] if all_orders_data else None,
            "items": all_items,  # ✅ ALL items from ALL orders
            "subtotal": float(cumulative_subtotal),  # ✅ Cumulative subtotal
            "vat": float(vat),  # ✅ VAT on cumulative amount
            "total": float(total),  # ✅ Cumulative total
            "all_orders": all_orders_data  # ✅ List of all orders contributing to this bill
        },
        "bill": {
            "bill_id": bill.bill_id if bill else None,
            "session_id": session_id,
            "total_amount": float(total),  # ✅ Always use cumulative total
            "payment_method": bill.payment_method if bill else None,
            "status": bill.status if bill else "pending",
            # Bank information from branch
            "bank_code": branch.bank_code if branch else None,
            "bank_account_number": branch.bank_account_number if branch else None,
            "bank_account_name": branch.bank_account_name if branch else None
        } if bill else {
            "bill_id": None,
            "session_id": session_id,
            "total_amount": float(total),
            "payment_method": None,
            "status": "pending",
            "bank_code": branch.bank_code if branch else None,
            "bank_account_number": branch.bank_account_number if branch else None,
            "bank_account_name": branch.bank_account_name if branch else None
        }
    }



# Schema for updating bill status
class BillStatusUpdate(BaseModel):
    status: str  # 'cash_pending', 'paid', etc.
    payment_method: str  # 'cash', 'bank_transfer', etc.

@app.put("/api/guest/sessions/{session_id}/bill/status")
async def update_bill_status(
    session_id: str,
    bill_update: BillStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    ✅ FIXED: Update bill status for ALL sessions at this table

    When a guest pays, we need to:
    1. Mark ALL unpaid sessions at this table as paid
    2. Update/create bills for all those sessions
    3. This ensures next customer at same table starts fresh
    """
    from datetime import datetime, time

    # Get the current session
    session = db.query(DBSession).filter(
        DBSession.session_id == session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Get table
    table = db.query(DiningTable).filter(
        DiningTable.table_id == session.table_id
    ).first()

    # ✅ NEW: Find ALL unpaid sessions at this table from today
    today_start = datetime.combine(datetime.now().date(), time.min)

    all_table_sessions = db.query(DBSession).filter(
        DBSession.table_id == session.table_id,
        DBSession.start_time >= today_start
    ).all()

    # Filter for unpaid sessions
    unpaid_sessions = []
    for tbl_session in all_table_sessions:
        bill = db.query(Bill).filter(
            Bill.session_id == tbl_session.session_id
        ).first()

        if not bill or bill.status not in ['paid', 'verified', 'completed']:
            unpaid_sessions.append(tbl_session)

    print(f"💳 Marking {len(unpaid_sessions)} unpaid sessions as {bill_update.status}")

    # ✅ NEW: Calculate total from ALL unpaid sessions
    cumulative_total = Decimal('0')

    for tbl_session in unpaid_sessions:
        order = db.query(Order).filter(
            Order.session_id == tbl_session.session_id
        ).first()

        if order:
            order_items = db.query(OrderItem).filter(
                OrderItem.order_id == order.order_id
            ).all()

            subtotal = sum(
                Decimal(str(item.price)) * item.quantity
                for item in order_items
            )
            cumulative_total += subtotal

    # Add VAT
    vat = cumulative_total * Decimal('0.1')
    total_with_vat = cumulative_total + vat

    print(f"💰 Total amount for all unpaid sessions: {total_with_vat}đ")

    # ✅ NEW: Update/create bills for ALL unpaid sessions
    main_bill = None

    for tbl_session in unpaid_sessions:
        bill = db.query(Bill).filter(
            Bill.session_id == tbl_session.session_id
        ).first()

        if not bill:
            # Create bill for this session
            order = db.query(Order).filter(
                Order.session_id == tbl_session.session_id
            ).first()

            if order:
                bill = Bill(
                    bill_id=str(uuid.uuid4()),
                    session_id=tbl_session.session_id,
                    total_amount=float(total_with_vat),  # Use cumulative total
                    status=bill_update.status,
                    payment_method=bill_update.payment_method,
                    points_earned=0,
                    points_redeemed=0
                )
                db.add(bill)
                print(f"  ✅ Created bill for session {tbl_session.session_id}")
        else:
            # Update existing bill
            bill.status = bill_update.status
            bill.payment_method = bill_update.payment_method
            bill.total_amount = float(total_with_vat)  # Update to cumulative total
            print(f"  ✅ Updated bill for session {tbl_session.session_id}")

        # Mark session as completed
        tbl_session.status = "completed"
        tbl_session.end_time = datetime.utcnow()

        # Keep reference to any bill (we'll return this)
        if not main_bill:
            main_bill = bill

    # ✅ NEW: Mark table as available when payment is made
    # This ensures the table is ready for the next customer
    if table and bill_update.status in ['paid', 'cash_pending']:
        # Don't mark as available immediately for cash_pending
        # Staff will clear it after verifying payment
        if bill_update.status == 'paid':
            print(f"  ℹ️  Table {table.table_number} will be cleared after staff verification")
        else:
            print(f"  ℹ️  Table {table.table_number} waiting for cash payment confirmation")

    try:
        db.commit()
        if main_bill:
            db.refresh(main_bill)

        return {
            "success": True,
            "message": f"Bill status updated for {len(unpaid_sessions)} sessions",
            "bill_id": main_bill.bill_id if main_bill else None,
            "session_id": session_id,
            "sessions_updated": len(unpaid_sessions),
            "status": bill_update.status,
            "payment_method": bill_update.payment_method,
            "total_amount": float(total_with_vat)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bill status: {str(e)}"
        )

@app.get("/api/guest/orders/{order_id}/details")
async def get_guest_order_details(
    order_id: str,
    db: Session = Depends(get_db)
):
    """
    Get complete order details by order ID
    Alternative endpoint if you only have order_id
    """

    order = db.query(Order).filter(Order.order_id == order_id).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Get session
    session = db.query(DBSession).filter(
        DBSession.session_id == order.session_id
    ).first()

    # Get table and branch
    table = db.query(DiningTable).filter(
        DiningTable.table_id == session.table_id
    ).first()

    branch = db.query(Branch).filter(
        Branch.branch_id == table.branch_id
    ).first() if table else None

    # Get order items
    order_items = db.query(OrderItem, MenuItem).join(
        MenuItem, OrderItem.menu_item_id == MenuItem.menu_item_id
    ).filter(
        OrderItem.order_id == order.order_id
    ).all()

    items = []
    subtotal = Decimal('0')

    for order_item, menu_item in order_items:
        item_subtotal = Decimal(str(order_item.price)) * order_item.quantity
        subtotal += item_subtotal

        items.append({
            "order_item_id": order_item.order_item_id,
            "menu_item_id": order_item.menu_item_id,
            "menu_item_name": menu_item.item_name,
            "quantity": order_item.quantity,
            "price": float(order_item.price),
            "note": order_item.note,
            "subtotal": float(item_subtotal)
        })

    vat = subtotal * Decimal('0.1')
    total = subtotal + vat

    # Get bill
    bill = db.query(Bill).filter(
        Bill.session_id == order.session_id
    ).first()

    return {
        "order_id": order.order_id,
        "session_id": order.session_id,
        "table_number": table.table_number if table else "N/A",
        "order_time": order.order_time,
        "status": order.status,
        "items": items,
        "subtotal": float(subtotal),
        "vat": float(vat),
        "total": float(total),
        "bank_info": {
            "bank_code": branch.bank_code if branch else None,
            "bank_account_number": branch.bank_account_number if branch else None,
            "bank_account_name": branch.bank_account_name if branch else None
        }
    }

# ============== STAFF CASH-PAYMENT ENDPOINTS ==============

class StaffCashBillResponse(BaseModel):
    """Bill info returned to staff for cash-payment confirmation"""
    bill_id: str
    session_id: str
    order_id: str
    table_number: str
    branch_name: str
    order_time: datetime
    items: List[OrderItemResponse]          # reuse the existing schema
    subtotal: float
    vat: float
    total_amount: float
    payment_method: str
    status: str                             # should be 'cash_pending'

    class Config:
        from_attributes = True


@app.get("/api/staff/cash-pending", response_model=List[StaffCashBillResponse])
async def get_cash_pending_bills(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return every bill with status='cash_pending' for the given branch,
    enriched with order details so the cashier can visually verify
    the order before collecting cash.
    """

    # ── authorisation: branch must belong to the logged-in user's tenant ──
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have access to this branch")

    # ── query: bills → session → table (must be in this branch) ──
    pending_bills = (
        db.query(Bill)
        .join(DBSession, Bill.session_id == DBSession.session_id)
        .join(DiningTable, DBSession.table_id == DiningTable.table_id)
        .filter(
            DiningTable.branch_id == branch_id,
            Bill.status == "cash_pending"
        )
        .order_by(Bill.created_at.asc())   # oldest first – cashier works FIFO
        .all()
    )

    result = []
    for bill in pending_bills:
        session   = db.query(DBSession).filter(DBSession.session_id == bill.session_id).first()
        table     = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()

        # ✅ FIXED: fetch ALL orders in this session, not just .first()
        all_orders = db.query(Order).filter(Order.session_id == bill.session_id).all()

        if not all_orders:
            continue          # safety: skip orphaned bills

        # ── build merged item list from every order in the session ──
        items_response = []
        subtotal = Decimal('0')
        earliest_order_time = None
        first_order_id = all_orders[0].order_id

        for order in all_orders:
            if earliest_order_time is None or order.order_time < earliest_order_time:
                earliest_order_time = order.order_time

            order_items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()
            for oi in order_items:
                menu_item = db.query(MenuItem).filter(MenuItem.menu_item_id == oi.menu_item_id).first()
                item_subtotal = Decimal(str(oi.price)) * oi.quantity
                subtotal += item_subtotal
                items_response.append(OrderItemResponse(
                    order_item_id=oi.order_item_id,
                    menu_item_id=oi.menu_item_id,
                    menu_item_name=menu_item.item_name if menu_item else "Unknown",
                    menu_item_image=menu_item.image if menu_item else None,
                    quantity=oi.quantity,
                    price=float(oi.price),
                    note=oi.note
                ))

        vat   = subtotal * Decimal('0.1')
        total = subtotal + vat

        result.append(StaffCashBillResponse(
            bill_id=bill.bill_id,
            session_id=bill.session_id,
            order_id=first_order_id,
            table_number=table.table_number,
            branch_name=branch.branch_name,
            order_time=earliest_order_time,
            items=items_response,
            subtotal=float(subtotal),
            vat=float(vat),
            total_amount=float(total),
            payment_method=bill.payment_method or "cash",
            status=bill.status
        ))

    return result


@app.put("/api/staff/cash-pending/{bill_id}/confirm")
async def confirm_cash_payment(
    bill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Staff physically collected cash and now confirms it.
    Transitions:  bill.status  cash_pending → paid
                  session.status            → completed
                  table.status              → available
    """

    bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")

    # ── guard: only cash_pending bills can be confirmed this way ──
    if bill.status != "cash_pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bill is already '{bill.status}'. Only 'cash_pending' bills can be confirmed."
        )

    # ── authorisation: trace bill → session → table → branch → tenant ──
    session = db.query(DBSession).filter(DBSession.session_id == bill.session_id).first()
    table   = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()
    branch  = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You don't have access to this bill")

    # ── apply state changes ──
    bill.status = "paid"
    # payment_method stays "cash" (already set by the guest endpoint)

    session.status   = "completed"
    session.end_time = datetime.utcnow()

    table.status = "available"

    # ── points: if the session belonged to a customer, award points now ──
    if session.customer_id:
        customer = db.query(Customer).filter(Customer.customer_id == session.customer_id).first()
        if customer and bill.points_earned and bill.points_earned > 0:
            customer.points_balance += bill.points_earned
            # record a PointTransaction for the ledger
            pt = PointTransaction(
                transaction_id=str(uuid.uuid4()),
                customer_id=session.customer_id,
                bill_id=bill.bill_id,
                transaction_type="earn",
                points_amount=bill.points_earned,
                description=f"Earned from cash payment – bill {bill.bill_id}"
            )
            db.add(pt)

    db.commit()

    return {
        "success": True,
        "message": "Cash payment confirmed",
        "bill_id": bill.bill_id,
        "bill_status": bill.status,
        "session_id": bill.session_id,
        "table_number": table.table_number
    }


# ================== QR PAYMENT VERIFICATION ==================

@app.get("/api/staff/qr-paid")
async def get_qr_paid_bills(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return every bill with status='paid' and payment_method='bank_transfer' for the given branch.
    These are QR payments that guests confirmed but staff hasn't verified yet.

    Status: 'paid' means guest clicked "I paid via QR" but staff hasn't manually
            checked their bank app to verify the money arrived.
    """

    # Verify branch access
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                          detail="You don't have access to this branch")

    # Get all QR-paid bills for this branch
    bills = (
        db.query(Bill)
        .join(DBSession, Bill.session_id == DBSession.session_id)
        .join(DiningTable, DBSession.table_id == DiningTable.table_id)
        .filter(
            DiningTable.branch_id == branch_id,
            Bill.status == "paid",
            Bill.payment_method == "bank_transfer"
        )
        .all()
    )

    result = []
    for bill in bills:
        session = db.query(DBSession).filter(DBSession.session_id == bill.session_id).first()
        table = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()

        # ✅ FIXED: fetch ALL orders in this session, not just .first()
        all_orders = db.query(Order).filter(Order.session_id == session.session_id).all()

        if not all_orders:
            continue

        # ── build merged item list from every order in the session ──
        items_data = []
        subtotal = Decimal('0')
        earliest_order_time = None
        first_order_id = all_orders[0].order_id

        for order in all_orders:
            if earliest_order_time is None or order.order_time < earliest_order_time:
                earliest_order_time = order.order_time

            order_items = db.query(OrderItem).filter(OrderItem.order_id == order.order_id).all()
            for oi in order_items:
                menu_item = db.query(MenuItem).filter(MenuItem.menu_item_id == oi.menu_item_id).first()
                item_subtotal = Decimal(str(oi.price)) * oi.quantity
                subtotal += item_subtotal
                items_data.append({
                    "menu_item_name": menu_item.item_name if menu_item else "Unknown",
                    "quantity": oi.quantity,
                    "price": float(oi.price),
                    "note": oi.note
                })

        vat = subtotal * Decimal('0.1')
        total = subtotal + vat

        result.append({
            "bill_id": bill.bill_id,
            "order_id": first_order_id,
            "session_id": session.session_id,
            "table_number": table.table_number,
            "branch_name": branch.branch_name,
            "order_time": earliest_order_time.isoformat(),
            "total_amount": float(total),
            "subtotal": float(subtotal),
            "vat": float(vat),
            "payment_method": bill.payment_method,
            "status": bill.status,
            "created_at": bill.created_at.isoformat() if bill.created_at else None,
            "items": items_data,
            # Bank info for verification
            "bank_code": branch.bank_code,
            "bank_account_number": branch.bank_account_number,
            "bank_account_name": branch.bank_account_name
        })

    return result


@app.put("/api/staff/qr-paid/{bill_id}/verify")
async def verify_qr_payment(
    bill_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Staff manually verified QR payment in their bank app.
    Transitions:  bill.status  paid → verified
                  session.status     → completed
                  table.status       → available
    """

    bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")

    # Guard: only paid QR bills can be verified
    if bill.status != "paid" or bill.payment_method != "bank_transfer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bill status is '{bill.status}' with payment method '{bill.payment_method}'. Only 'paid' bank_transfer bills can be verified."
        )

    # Authorization check
    session = db.query(DBSession).filter(DBSession.session_id == bill.session_id).first()
    table = db.query(DiningTable).filter(DiningTable.table_id == session.table_id).first()
    branch = db.query(Branch).filter(Branch.branch_id == table.branch_id).first()

    if branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                          detail="You don't have access to this bill")

    # Apply state changes
    bill.status = "verified"

    session.status = "completed"
    session.end_time = datetime.utcnow()

    table.status = "available"

    # Award points if this was a customer session
    if session.customer_id:
        customer = db.query(Customer).filter(Customer.customer_id == session.customer_id).first()
        if customer and bill.points_earned and bill.points_earned > 0:
            customer.points_balance += bill.points_earned
            # Record point transaction
            pt = PointTransaction(
                transaction_id=str(uuid.uuid4()),
                customer_id=session.customer_id,
                bill_id=bill.bill_id,
                transaction_type="earn",
                points_amount=bill.points_earned,
                description=f"Earned from QR payment – bill {bill.bill_id}"
            )
            db.add(pt)

    db.commit()

    return {
        "success": True,
        "message": "QR payment verified",
        "bill_id": bill.bill_id,
        "bill_status": bill.status,
        "session_id": bill.session_id,
        "table_number": table.table_number
    }



# ============== PUBLIC ENDPOINTS FOR FRONTEND ==============

@app.get("/api/branches")
async def get_all_branches(db: Session = Depends(get_db)):
    """
    Get all active branches for restaurant view (public endpoint)
    Used by restaurant_view.html to display branch list
    """
    branches = db.query(Branch).filter(Branch.status == "active").all()
    
    result = []
    for branch in branches:
        # Count menu items for this branch
        menu_count = db.query(MenuItem).filter(
            MenuItem.branch_id == branch.branch_id,
            MenuItem.status == "active"
        ).count()
        
        result.append({
            "branch_id": branch.branch_id,
            "branch_name": branch.branch_name,
            "address": branch.address,
            "province": branch.province,
            "phone": branch.phone,
            "manager_name": branch.manager_name,
            "opening_hours": branch.opening_hours,
            "closing_hours": branch.closing_hours,
            "google_maps_link": branch.google_maps_link,
            "cashback_percent": float(branch.cashback_percent) if branch.cashback_percent else 1.0,
            "status": branch.status,
            "image": branch.image,
            "menu_item_count": menu_count
        })
    
    return result

# ============== HEALTH CHECK ==============

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "message": "Scan&Order API v2.0 is running with JWT authentication",
        "version": "2.0.0"
    }

# ============================================
# GUEST ORDERING API ENDPOINTS
# ============================================
# These endpoints are added to the existing main.py file
# They handle order creation for BOTH guests and customers
#
# GUEST vs CUSTOMER distinction:
# - GUESTS: customer_id = None (NULL in database)
# - CUSTOMERS: customer_id = valid UUID (from authentication)
#
# Key endpoints:
# 1. POST /api/guest/sessions - Create dining session
# 2. POST /api/guest/orders - Create order with items
# 3. GET /api/guest/orders/{order_id}/status - Get order status
# 4. GET /api/guest/menu-items - Get menu for table's branch
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)