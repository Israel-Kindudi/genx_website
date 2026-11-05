import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "genx.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    # Get existing columns
    cur.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cur.fetchall()]
    
    new_columns = {
        "phone_number": "TEXT",
        "country": "TEXT",
        "is_verified": "INTEGER DEFAULT 1", # Default 1 so existing users aren't locked out
        "auth_provider": "TEXT DEFAULT 'local'"
    }
    
    for col, col_type in new_columns.items():
        if col not in columns:
            print(f"Adding column: {col}")
            cur.execute(f"ALTER TABLE users ADD COLUMN {col} {col_type}")
        else:
            print(f"Column {col} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()