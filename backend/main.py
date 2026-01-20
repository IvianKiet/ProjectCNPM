from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid
from datetime import datetime
import bcrypt

from database import SessionLocal, engine
from models import (
    Base, User, Tenant, Branch, DiningTable, 
    QRCode, Category, MenuItem, Staff
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Scan&Order API", version="1.0.0")

# Password hashing

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change in production
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

# Restaurant/Branch Schemas
class BranchCreate(BaseModel):
    branch_name: str
    address: str
    province: str
    phone: str
    manager_name: str
    image: Optional[str] = None

class BranchUpdate(BaseModel):
    branch_name: Optional[str] = None
    address: Optional[str] = None

class BranchResponse(BaseModel):
    branch_id: str
    branch_name: str
    address: str
    created_at: datetime

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
    item_name: str
    description: Optional[str] = None
    price: float
    status: str = "available"
    image: Optional[str] = None

class MenuItemUpdate(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    status: Optional[str] = None

class MenuItemResponse(BaseModel):
    menu_item_id: str
    item_name: str
    description: Optional[str]
    price: float
    status: str
    category_id: str

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



# ============== AUTH ENDPOINTS ==============

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user and create their tenant"""
    
    # Check if email exists
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
        tenant_name=f"{user_data.full_name}'s Restaurant Group",
        status="active"
    )
    db.add(new_tenant)
    
    # Create user with hashed password
    user_id = str(uuid.uuid4())
    new_user = User(
        user_id=user_id,
        tenant_id=tenant_id,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name
    )
    db.add(new_user)
    
    try:
        db.commit()
        return {
            "message": "Registration successful",
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": user_data.email,
            "full_name": user_data.full_name
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@app.post("/api/auth/login")
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    return {
        "message": "Login successful",
        "user_id": user.user_id,
        "tenant_id": user.tenant_id,
        "email": user.email,
        "full_name": user.full_name
    }


# ============== RESTAURANT/BRANCH ENDPOINTS ==============

@app.post("/api/branches", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    branch_data: BranchCreate,
    tenant_id: str,  # TODO: Get from JWT token in production
    db: Session = Depends(get_db)
):
    """Create a new restaurant branch"""
    
    # Verify tenant
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Create branch
    branch_id = str(uuid.uuid4())
    new_branch = Branch(
        branch_id=branch_id,
        tenant_id=tenant_id,
        branch_name=branch_data.branch_name,
        address=f"{branch_data.address}, {branch_data.province}"
    )
    db.add(new_branch)
    
    # Create manager as staff
    staff_id = str(uuid.uuid4())
    # Note: Manager should have a user account, simplified here
    
    try:
        db.commit()
        db.refresh(new_branch)
        return new_branch
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/branches", response_model=List[BranchResponse])
def get_branches(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """Get all branches for a tenant"""
    branches = db.query(Branch).filter(Branch.tenant_id == tenant_id).all()
    return branches


@app.get("/api/branches/{branch_id}", response_model=BranchResponse)
def get_branch(branch_id: str, db: Session = Depends(get_db)):
    """Get specific branch"""
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )
    return branch


@app.put("/api/branches/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: str,
    branch_data: BranchUpdate,
    db: Session = Depends(get_db)
):
    """Update branch information"""
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )
    
    if branch_data.branch_name:
        branch.branch_name = branch_data.branch_name
    if branch_data.address:
        branch.address = branch_data.address
    
    db.commit()
    db.refresh(branch)
    return branch


@app.delete("/api/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: str, db: Session = Depends(get_db)):
    """Delete a branch"""
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )
    
    db.delete(branch)
    db.commit()
    return None


# ============== TABLE MANAGEMENT ENDPOINTS ==============

@app.post("/api/branches/{branch_id}/tables", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
def create_table(
    branch_id: str,
    table_data: TableCreate,
    db: Session = Depends(get_db)
):
    """Create a new dining table"""
    
    # Verify branch exists
    branch = db.query(Branch).filter(Branch.branch_id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )
    
    # Check if table number already exists in this branch
    existing = db.query(DiningTable).filter(
        DiningTable.branch_id == branch_id,
        DiningTable.table_number == table_data.table_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table_data.table_number} already exists in this branch"
        )
    
    # Create table
    table_id = str(uuid.uuid4())
    new_table = DiningTable(
        table_id=table_id,
        branch_id=branch_id,
        table_number=table_data.table_number,
        capacity=table_data.capacity,
        status=table_data.status
    )
    db.add(new_table)
    
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
def get_tables(branch_id: str, db: Session = Depends(get_db)):
    """Get all tables for a branch"""
    tables = db.query(DiningTable).filter(DiningTable.branch_id == branch_id).all()
    return tables


@app.get("/api/tables/{table_id}", response_model=TableResponse)
def get_table(table_id: str, db: Session = Depends(get_db)):
    """Get specific table"""
    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )
    return table


@app.put("/api/tables/{table_id}", response_model=TableResponse)
def update_table(
    table_id: str,
    table_data: TableUpdate,
    db: Session = Depends(get_db)
):
    """Update table information"""
    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )
    
    if table_data.table_number:
        table.table_number = table_data.table_number
    if table_data.capacity:
        table.capacity = table_data.capacity
    if table_data.status:
        table.status = table_data.status
    
    db.commit()
    db.refresh(table)
    return table


@app.delete("/api/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(table_id: str, db: Session = Depends(get_db)):
    """Delete a table"""
    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )
    
    db.delete(table)
    db.commit()
    return None


# ============== QR CODE ENDPOINTS ==============

@app.post("/api/tables/{table_id}/qr", response_model=QRCodeResponse, status_code=status.HTTP_201_CREATED)
def generate_qr_code(table_id: str, db: Session = Depends(get_db)):
    """Generate QR code for a table"""
    
    # Verify table exists
    table = db.query(DiningTable).filter(DiningTable.table_id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found"
        )
    
    # Check if QR already exists
    existing_qr = db.query(QRCode).filter(QRCode.table_id == table_id).first()
    if existing_qr:
        return existing_qr
    
    # Create QR code
    qr_id = str(uuid.uuid4())
    qr_content = f"https://scanorder.app/table/{table_id}"  # Your app URL
    
    new_qr = QRCode(
        qr_id=qr_id,
        table_id=table_id,
        qr_content=qr_content,
        is_active=True
    )
    db.add(new_qr)
    
    try:
        db.commit()
        db.refresh(new_qr)
        return new_qr
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/tables/{table_id}/qr", response_model=QRCodeResponse)
def get_qr_code(table_id: str, db: Session = Depends(get_db)):
    """Get QR code for a table"""
    qr = db.query(QRCode).filter(QRCode.table_id == table_id).first()
    if not qr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QR code not found for this table"
        )
    return qr


# ============== MENU CATEGORY ENDPOINTS ==============

@app.post("/api/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category_data: CategoryCreate,
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """Create a menu category"""
    
    category_id = str(uuid.uuid4())
    new_category = Category(
        category_id=category_id,
        tenant_id=tenant_id,
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
def get_categories(tenant_id: str, db: Session = Depends(get_db)):
    """Get all categories for a tenant"""
    categories = db.query(Category).filter(Category.tenant_id == tenant_id).all()
    return categories


# ============== MENU ITEM ENDPOINTS ==============

@app.post("/api/menu-items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    item_data: MenuItemCreate,
    db: Session = Depends(get_db)
):
    """Create a menu item"""
    
    # Verify category exists
    category = db.query(Category).filter(Category.category_id == item_data.category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    menu_item_id = str(uuid.uuid4())
    new_item = MenuItem(
        menu_item_id=menu_item_id,
        category_id=item_data.category_id,
        item_name=item_data.item_name,
        description=item_data.description,
        price=item_data.price,
        status=item_data.status
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
def get_menu_items_by_category(category_id: str, db: Session = Depends(get_db)):
    """Get all menu items in a category"""
    items = db.query(MenuItem).filter(MenuItem.category_id == category_id).all()
    return items


@app.get("/api/menu-items/{menu_item_id}", response_model=MenuItemResponse)
def get_menu_item(menu_item_id: str, db: Session = Depends(get_db)):
    """Get specific menu item"""
    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )
    return item


@app.put("/api/menu-items/{menu_item_id}", response_model=MenuItemResponse)
def update_menu_item(
    menu_item_id: str,
    item_data: MenuItemUpdate,
    db: Session = Depends(get_db)
):
    """Update menu item"""
    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )
    
    if item_data.item_name:
        item.item_name = item_data.item_name
    if item_data.description:
        item.description = item_data.description
    if item_data.price:
        item.price = item_data.price
    if item_data.status:
        item.status = item_data.status
    
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/menu-items/{menu_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(menu_item_id: str, db: Session = Depends(get_db)):
    """Delete menu item"""
    item = db.query(MenuItem).filter(MenuItem.menu_item_id == menu_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )
    
    db.delete(item)
    db.commit()
    return None


# ============== HEALTH CHECK ==============

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "message": "Scan&Order API is running",
        "version": "1.0.0"
    }


@app.get("/api/stats/{tenant_id}")
def get_dashboard_stats(tenant_id: str, db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    
    total_branches = db.query(Branch).filter(Branch.tenant_id == tenant_id).count()
    total_tables = db.query(DiningTable).join(Branch).filter(Branch.tenant_id == tenant_id).count()
    active_branches = db.query(Branch).filter(Branch.tenant_id == tenant_id).count()
    
    return {
        "total_branches": total_branches,
        "total_tables": total_tables,
        "active_branches": active_branches,
        "today_revenue": 0,  # TODO: Calculate from bills
        "today_orders": 0  # TODO: Calculate from orders
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)