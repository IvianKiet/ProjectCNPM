from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

# ============================================
# DOCKER-READY DATABASE CONFIGURATION
# ============================================
# These values will be read from environment variables in Docker
# For local development, they fall back to default values

DB_USER = os.getenv("DB_USER", "s2o_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "s2o_password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "s2o_saas")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"🔗 Connecting to database: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()