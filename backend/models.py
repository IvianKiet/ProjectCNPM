from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, DECIMAL, Integer, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Tenant(Base):
    __tablename__ = "tenant"
    
    tenant_id = Column(String(36), primary_key=True)
    tenant_name = Column(String(255), nullable=False)
    status = Column(String(29), nullable=False)
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
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="branches")
    dining_tables = relationship("DiningTable", back_populates="branch", cascade="all, delete-orphan")
    staff = relationship("Staff", back_populates="branch", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="branch", cascade="all, delete-orphan")


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
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    user = relationship("User", back_populates="customer")
    sessions = relationship("Session", back_populates="customer")
    reservations = relationship("Reservation", back_populates="customer")


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
    item_name = Column(String(255), nullable=False)
    description = Column(String(255))
    price = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    category = relationship("Category", back_populates="menu_items")
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
    
    # Relationships
    order = relationship("Order", back_populates="order_items")
    menu_item = relationship("MenuItem", back_populates="order_items")


class Bill(Base):
    __tablename__ = "bill"
    
    bill_id = Column(String(36), primary_key=True)
    session_id = Column(String(36), ForeignKey("session.session_id", ondelete="CASCADE"), nullable=False, unique=True)
    total_amount = Column(DECIMAL(12, 2), nullable=False)
    payment_method = Column(String(50))
    status = Column(String(29), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    session = relationship("Session", back_populates="bill")


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