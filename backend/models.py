from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, DECIMAL, Integer, Boolean, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Tenant(Base):
    __tablename__ = "tenant"
    
    tenant_id = Column(String(36), primary_key=True)
    tenant_name = Column(String(255), nullable=False)
    status = Column(String(29), nullable=False)
    cashback_percent = Column(DECIMAL(5, 2), default=1.0)  # ✅ NEW: Default 1% cashback
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    # Relationships
    branches = relationship("Branch", back_populates="tenant", cascade="all, delete-orphan")
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="tenant", cascade="all, delete-orphan")


class Branch(Base):
    __tablename__ = "branch"
    
    branch_id = Column(String(36), primary_key=True)
    tenant_id = Column(String(36), ForeignKey("tenant.tenant_id", ondelete="CASCADE"), nullable=False)
    branch_name = Column(String(255), nullable=False)
    address = Column(String(255))
    province = Column(String(100))
    phone = Column(String(20))
    manager_name = Column(String(255))
    image = Column(LONGTEXT)
    status = Column(String(29), default="active")
    cashback_percent = Column(DECIMAL(5, 2), default=1.0)  # ✅ MOVED: Now per-branch instead of per-tenant
    # ✅ NEW: VietQR Bank Information
    bank_code = Column(String(20))  # Bank code (e.g., "970436" for VCB)
    bank_account_number = Column(String(50))  # Bank account number
    bank_account_name = Column(String(255))  # Account holder name
    # ✅ NEW: Opening hours and location info
    opening_hours = Column(String(10))  # Format: "HH:MM" (24-hour format, e.g., "08:00")
    closing_hours = Column(String(10))  # Format: "HH:MM" (24-hour format, e.g., "22:00")
    google_maps_link = Column(String(500))  # Google Maps URL
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="branches")
    dining_tables = relationship("DiningTable", back_populates="branch", cascade="all, delete-orphan")
    staff = relationship("Staff", back_populates="branch", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="branch", cascade="all, delete-orphan")
    menu_items = relationship("MenuItem", back_populates="branch", cascade="all, delete-orphan")  # ✅ NEW


class User(Base):
    __tablename__ = "user"
    
    user_id = Column(String(36), primary_key=True)
    tenant_id = Column(String(36), ForeignKey("tenant.tenant_id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    staff = relationship("Staff", back_populates="user", uselist=False, cascade="all, delete-orphan")
    customer = relationship("Customer", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Staff(Base):
    __tablename__ = "staff"
    
    staff_id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, unique=True)
    branch_id = Column(String(36), ForeignKey("branch.branch_id", ondelete="CASCADE"), nullable=False)
    position = Column(String(100))
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    user = relationship("User", back_populates="staff")
    branch = relationship("Branch", back_populates="staff")


class Customer(Base):
    __tablename__ = "customer"
    
    customer_id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, unique=True)
    phone = Column(String(20))
    points_balance = Column(DECIMAL(12, 2), default=0)  # ✅ NEW: Customer loyalty points
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    user = relationship("User", back_populates="customer")
    sessions = relationship("Session", back_populates="customer")
    reservations = relationship("Reservation", back_populates="customer")
    point_transactions = relationship("PointTransaction", back_populates="customer", cascade="all, delete-orphan")  # ✅ NEW


# ✅ NEW: Point Transaction History Table
class PointTransaction(Base):
    """
    Tracks all point earning and spending transactions.
    This table is ready for future customer implementation.
    
    Usage Notes for Future:
    - When a customer completes a purchase, calculate points earned based on tenant's cashback_percent
    - Points earned = total_amount * (cashback_percent / 100)
    - Create a PointTransaction record with transaction_type = 'earn'
    - When customer redeems points, create record with transaction_type = 'redeem'
    - Always update customer.points_balance accordingly
    """
    __tablename__ = "point_transaction"
    
    transaction_id = Column(String(36), primary_key=True)
    customer_id = Column(String(36), ForeignKey("customer.customer_id", ondelete="CASCADE"), nullable=False)
    bill_id = Column(String(36), ForeignKey("bill.bill_id", ondelete="SET NULL"))  # Link to bill if points earned from purchase
    transaction_type = Column(String(20), nullable=False)  # 'earn' or 'redeem'
    points_amount = Column(DECIMAL(12, 2), nullable=False)  # Positive for earn, negative for redeem
    description = Column(String(255))  # E.g., "Earned from bill #123" or "Redeemed for discount"
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    customer = relationship("Customer", back_populates="point_transactions")
    bill = relationship("Bill", back_populates="point_transactions")


class DiningTable(Base):
    __tablename__ = "dining_table"
    
    table_id = Column(String(36), primary_key=True)
    branch_id = Column(String(36), ForeignKey("branch.branch_id", ondelete="CASCADE"), nullable=False)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer)
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    branch = relationship("Branch", back_populates="dining_tables")
    qr_code = relationship("QRCode", back_populates="dining_table", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="dining_table", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="dining_table")


class QRCode(Base):
    __tablename__ = "qr_code"
    
    qr_id = Column(String(36), primary_key=True)
    table_id = Column(String(36), ForeignKey("dining_table.table_id", ondelete="CASCADE"), nullable=False, unique=True)
    qr_content = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    dining_table = relationship("DiningTable", back_populates="qr_code")


class Category(Base):
    __tablename__ = "category"
    
    category_id = Column(String(36), primary_key=True)
    tenant_id = Column(String(36), ForeignKey("tenant.tenant_id", ondelete="CASCADE"), nullable=False)
    category_name = Column(String(255), nullable=False)
    description = Column(String(255))
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="categories")
    menu_items = relationship("MenuItem", back_populates="category", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_item"
    
    menu_item_id = Column(String(36), primary_key=True)
    category_id = Column(String(36), ForeignKey("category.category_id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(String(36), ForeignKey("branch.branch_id", ondelete="CASCADE"), nullable=False)  # ✅ ADDED
    item_name = Column(String(255), nullable=False)
    description = Column(String(255))
    price = Column(DECIMAL(10, 2), nullable=False)
    discount_percent = Column(DECIMAL(5, 2), default=0)
    status = Column(String(29), nullable=False)
    image = Column(LONGTEXT)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    category = relationship("Category", back_populates="menu_items")
    branch = relationship("Branch", back_populates="menu_items")  # ✅ ADDED
    order_items = relationship("OrderItem", back_populates="menu_item")


class Session(Base):
    __tablename__ = "session"
    
    session_id = Column(String(36), primary_key=True)
    table_id = Column(String(36), ForeignKey("dining_table.table_id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customer.customer_id", ondelete="SET NULL"))
    start_time = Column(TIMESTAMP, server_default=func.current_timestamp())
    end_time = Column(TIMESTAMP)
    status = Column(String(29), nullable=False)
    
    # Relationships
    dining_table = relationship("DiningTable", back_populates="sessions")
    customer = relationship("Customer", back_populates="sessions")
    order = relationship("Order", back_populates="session", uselist=False, cascade="all, delete-orphan")
    bill = relationship("Bill", back_populates="session", uselist=False, cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = "order"
    
    order_id = Column(String(36), primary_key=True)
    session_id = Column(String(36), ForeignKey("session.session_id", ondelete="CASCADE"), nullable=False)
    order_time = Column(TIMESTAMP, server_default=func.current_timestamp())
    status = Column(String(29), nullable=False)
    
    # Relationships
    session = relationship("Session", back_populates="order")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_item"
    
    order_item_id = Column(String(36), primary_key=True)
    order_id = Column(String(36), ForeignKey("order.order_id", ondelete="CASCADE"), nullable=False)
    menu_item_id = Column(String(36), ForeignKey("menu_item.menu_item_id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    note = Column(Text, nullable=True)  # ✅ ADD THIS LINE
    
    # Relationships
    order = relationship("Order", back_populates="order_items")
    menu_item = relationship("MenuItem", back_populates="order_items")


class Bill(Base):
    __tablename__ = "bill"
    
    bill_id = Column(String(36), primary_key=True)
    session_id = Column(String(36), ForeignKey("session.session_id", ondelete="CASCADE"), nullable=False, unique=True)
    total_amount = Column(DECIMAL(12, 2), nullable=False)
    points_earned = Column(DECIMAL(12, 2), default=0)  # ✅ NEW: Points earned from this bill
    points_redeemed = Column(DECIMAL(12, 2), default=0)  # ✅ NEW: Points used for discount
    payment_method = Column(String(50))
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    session = relationship("Session", back_populates="bill")
    point_transactions = relationship("PointTransaction", back_populates="bill", cascade="all, delete-orphan")  # ✅ NEW


class Reservation(Base):
    __tablename__ = "reservation"
    
    reservation_id = Column(String(36), primary_key=True)
    branch_id = Column(String(36), ForeignKey("branch.branch_id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customer.customer_id", ondelete="RESTRICT"), nullable=False)
    table_id = Column(String(36), ForeignKey("dining_table.table_id", ondelete="RESTRICT"), nullable=False)
    reservation_time = Column(TIMESTAMP, nullable=False)
    number_of_guests = Column(Integer, nullable=False)
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    branch = relationship("Branch", back_populates="reservations")
    customer = relationship("Customer", back_populates="reservations")
    dining_table = relationship("DiningTable", back_populates="reservations")

# ✅ AI Configuration Table (Global Settings)
class AIConfig(Base):
    """
    Global AI chatbot configuration.
    Only ONE row should exist in this table.
    
    Admin Usage Notes:
    - system_prompt: Controls AI personality and behavior (e.g., "You are a helpful restaurant assistant...")
    - temperature: Creativity level (0-100)
        - 0-20: Very conservative, factual only
        - 30-50: Balanced, professional
        - 60-80: Creative, friendly
        - 90-100: Very creative (may hallucinate)
    
    Recommended temperature: 40-60 for restaurant AI
    """
    __tablename__ = "ai_config"
    
    config_id = Column(String(36), primary_key=True)
    system_prompt = Column(Text, nullable=False, default="You are a helpful restaurant assistant. Answer questions about the restaurant professionally and friendly.")
    temperature = Column(Integer, nullable=False, default=50)  # 0-100 scale