import sys
import getpass
import json

try:
    import requests
except ImportError:
    print("❌ Missing dependency: requests")
    print("   Install with: pip install requests")
    sys.exit(1)


API_BASE = "http://localhost:8000"


def print_banner():
    print()
    print("=" * 60)
    print("  🧬  GenX — Admin Registration")
    print("=" * 60)
    print()


def check_backend():
    """Verify the backend is up before prompting for credentials."""
    try:
        r = requests.get(f"{API_BASE}/", timeout=5)
        data = r.json()
        print(f"✅ Backend connected: {data.get('name', 'GenX')} v{data.get('version', '?')}")
        print()
        return True
    except requests.ConnectionError:
        print(f"❌ Cannot reach backend at {API_BASE}")
        print("   Start it with: uvicorn app.main:app --reload --port 8000")
        return False
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return False


def prompt_credentials():
    """Prompt for email, password, and name interactively."""
    print("Enter the first admin's credentials:")
    print()

    email = input("  Email    : ").strip()
    while not email or "@" not in email:
        print("  ❌ Invalid email, try again.")
        email = input("  Email    : ").strip()

    password = getpass.getpass("  Password : ")
    while len(password) < 6:
        print("  ❌ Password must be at least 6 characters.")
        password = getpass.getpass("  Password : ")

    confirm = getpass.getpass("  Confirm  : ")
    while confirm != password:
        print("  ❌ Passwords don't match.")
        confirm = getpass.getpass("  Confirm  : ")

    name = input("  Name     : ").strip() or "GenX Admin"

    print()
    return email, password, name


def register(email, password, name):
    """Call /api/auth/register."""
    payload = {
        "email": email,
        "password": password,
        "full_name": name,
    }
    try:
        r = requests.post(f"{API_BASE}/api/auth/register", json=payload, timeout=10)
    except Exception as e:
        return False, f"Request failed: {e}"

    if r.status_code == 200:
        return True, r.json()
    else:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        return False, detail


def login(email, password):
    """Call /api/auth/token."""
    data = {"username": email, "password": password}
    try:
        r = requests.post(
            f"{API_BASE}/api/auth/token",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except Exception as e:
        return False, f"Request failed: {e}"

    if r.status_code == 200:
        return True, r.json()
    else:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        return False, detail


def verify(token):
    """Call /api/auth/me with the token."""
    try:
        r = requests.get(
            f"{API_BASE}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if r.status_code == 200:
            return True, r.json()
        return False, r.text
    except Exception as e:
        return False, str(e)


def print_success(user, token):
    print()
    print("=" * 60)
    print("  ✅ Registration successful")
    print("=" * 60)
    print()
    print(f"  User ID   : {user.get('id')}")
    print(f"  Email     : {user.get('email')}")
    print(f"  Name      : {user.get('full_name')}")
    print(f"  Admin     : {'yes' if user.get('is_admin') else 'no'}")
    print(f"  Created   : {user.get('created_at')}")
    print()
    print(f"  Token     : {token[:40]}…")
    print()
    print("=" * 60)
    print("  Next steps:")
    print("=" * 60)
    print()
    print(f"  1. Open the API docs:  {API_BASE}/docs")
    print(f"  2. Login at the frontend: http://localhost:3000/login")
    print(f"     (use the email & password you just entered)")
    print()


def main():
    print_banner()

    if not check_backend():
        sys.exit(1)

    email, password, name = prompt_credentials()

    # Step 1 – Register
    print("→ Registering…")
    ok, result = register(email, password, name)
    if not ok:
        print(f"  ❌ Registration failed: {result}")
        if "already registered" in str(result).lower():
            print()
            print("  → This email is already registered.")
            print("  → Attempting login with the provided password instead…")
            print()
        else:
            sys.exit(1)
    else:
        print(f"  ✅ User created (id={result.get('id')})")

    # Step 2 – Login
    print("→ Authenticating…")
    ok, result = login(email, password)
    if not ok:
        print(f"  ❌ Login failed: {result}")
        print()
        print("  → The user exists but the password doesn't match.")
        print("  → Reset it with:")
        print(f"     python -c \"from app.database import SessionLocal; \\")
        print(f"                from app.models import User; \\")
        print(f"                from app.auth import hash_password; \\")
        print(f"                db=SessionLocal(); u=db.query(User).filter(User.email=='{email}').first(); \\")
        print(f"                u.hashed_password=hash_password('{password}'); db.commit(); db.close()\"")
        sys.exit(1)

    token = result["access_token"]
    print(f"  ✅ Token received ({len(token)} chars)")

    # Step 3 – Verify
    print("→ Verifying session…")
    ok, user = verify(token)
    if not ok:
        print(f"  ❌ Verification failed: {user}")
        sys.exit(1)
    print(f"  ✅ Session verified")

    # Done
    print_success(user, token)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Aborted by user.")
        sys.exit(130)