#!/usr/bin/env bash
# seam3_step2_proof.sh — prove Seam 3 step 2/4 end to end, no manual edits.
# Fixes from the first run: (1) login route discovered from live OpenAPI
# (/api/auth/token, not /api/auth/login); (2) all JSON parsing reads a
# temp FILE, never a pipe into a `python - <<'PY'` heredoc (stdin collision).
set -uo pipefail

BASE="http://127.0.0.1:8000"
EMAIL="kindudiisra@gmail.com"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE" || { echo "FATAL: cannot cd $HERE"; exit 2; }
PY="$HERE/venv/bin/python"
DB="$HERE/genx.db"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

say(){ printf '\n== %s ==\n' "$*"; }
fail(){ printf 'FAIL[%s]: %s\n' "$1" "$2"; exit "${3:-1}"; }
# json helper: reads JSON from file $1, runs python program $2 with args
jsonq(){ local f="$1" prog="$2"; shift 2; "$PY" -c "$prog" "$f" "$@"; }

say "0. preconditions"
[ -x "$PY" ] || fail precond "venv python missing: $PY" 2
[ -f "$DB" ] || fail precond "db missing: $DB" 2
curl -fsS -o /dev/null "$BASE/health" || fail precond "backend not healthy at $BASE/health" 2
echo "ok: venv, db, health"

say "1. read OpenAPI to a file (no stdin collision)"
curl -fsS "$BASE/openapi.json" -o "$TMP/openapi.json" || fail openapi "cannot fetch openapi.json" 2
"$PY" -c 'import json,sys; json.load(open(sys.argv[1])); print("openapi json ok")' "$TMP/openapi.json" \
  || fail openapi "openapi.json is not valid JSON" 2

say "2. discover the login route from the spec"
LOGIN_PATH="$("$PY" - "$TMP/openapi.json" <<'PY'
import json, sys
spec = json.load(open(sys.argv[1]))
best = None
for path, ops in spec.get("paths", {}).items():
    for method, op in ops.items():
        if method.lower() != "post":
            continue
        # OAuth2 password form route names username/password in the body
        rb = (op.get("requestBody") or {}).get("content") or {}
        hint = any(("login" in path) or ("token" in path) for _ in [0])
        form = any("x-www-form-urlencoded" in ct for ct in rb)
        if hint or form:
            score = (0 if "login" in path else 1 if "token" in path else 2, 0 if form else 1)
            if best is None or score < best[0]:
                best = (score, path)
print(best[1] if best else "")
PY
)"
[ -n "$LOGIN_PATH" ] || fail login_discovery "no POST login/token route in openapi" 2
echo "login path: $LOGIN_PATH"

say "3. read admin password (un-echoed, not saved)"
[ -t 0 ] || fail password "stdin is not a tty; run from an interactive shell" 2
read -rsp "admin password for $EMAIL: " GXPW; echo
[ -n "$GXPW" ] || fail password "empty password" 2

say "4. login (form first — OAuth2PasswordRequestForm — then json)"
RESP=""; HTTP=""
try_login(){ # $1=form|json ; sets RESP, HTTP
  if [ "$1" = "form" ]; then
    curl -sS -o "$TMP/login.json" -w '%{http_code}' -X POST "$BASE$LOGIN_PATH" \
      -H 'content-type: application/x-www-form-urlencoded' \
      --data-urlencode "username=$EMAIL" --data-urlencode "password=$GXPW" > "$TMP/login.code"
  else
    printf '%s' "$("$PY" -c 'import json,sys;print(json.dumps({"username":sys.argv[1],"password":sys.argv[2]}))' "$EMAIL" "$GXPW")" > "$TMP/login.req"
    curl -sS -o "$TMP/login.json" -w '%{http_code}' -X POST "$BASE$LOGIN_PATH" \
      -H 'content-type: application/json' --data @"$TMP/login.req" > "$TMP/login.code"
  fi
  HTTP="$(cat "$TMP/login.code")"; RESP="$(cat "$TMP/login.json")"
  [ "$HTTP" = "200" ]
}
LOGIN_OK=0
for k in form json; do
  if try_login "$k"; then LOGIN_OK=1; echo "login ok via $k (HTTP $HTTP)"; break; else echo "login via $k -> HTTP $HTTP"; fi
done
unset GXPW
[ "$LOGIN_OK" = "1" ] || fail login "HTTP $HTTP body=$(head -c 300 "$TMP/login.json")" 2

say "5. extract + decode token (argv, no env scope)"
TOKEN="$("$PY" - "$TMP/login.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
for k in ("access_token","accessToken","token","jwt"):
    v = d.get(k)
    if isinstance(v, str) and v: print(v); break
PY
)"
[ -n "$TOKEN" ] || fail token_extract "no token key in login response: $(head -c 300 "$TMP/login.json")" 2
echo "token length: ${#TOKEN} segments: $(( $(printf '%s' "$TOKEN" | tr -cd '.' | wc -c) + 1 ))"
"$PY" - "$TOKEN" <<'PY' || fail decode "decode_token rejected a fresh token (login/auth secret mismatch)" 2
import sys
from app.auth import decode_token
try:
    p = decode_token(sys.argv[1])
    print("decoded ok:", {k: p.get(k) for k in ("sub","exp","iat")})
except Exception as e:
    print("DECODE FAILED:", type(e).__name__, e); sys.exit(3)
PY

say "6. proof (a): register with NO jwt -> expect 401"
CODE_A="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/bridge/register" \
  -H 'content-type: application/json' -d '{"label":"unauth"}')"
echo "nojwt: $CODE_A"; [ "$CODE_A" = "401" ] || fail proof_a "expected 401, got $CODE_A"

say "7. proof (b): register WITH jwt -> expect 200 + db row"
CODE_B="$(curl -sS -o "$TMP/reg.json" -w '%{http_code}' -X POST "$BASE/api/bridge/register" \
  -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"label":"seam3"}')"
echo "register: HTTP $CODE_B body=$(head -c 300 "$TMP/reg.json")"
[ "$CODE_B" = "200" ] || fail proof_b "expected 200, got $CODE_B: $(head -c 300 "$TMP/reg.json")"
BID="$("$PY" -c 'import json,sys;print(json.load(open(sys.argv[1])).get("bridge_id",""))' "$TMP/reg.json")"
TOK="$("$PY" -c 'import json,sys;print(json.load(open(sys.argv[1])).get("token",""))' "$TMP/reg.json")"
[ -n "$BID" ] && [ -n "$TOK" ] || fail proof_b "register body missing bridge_id/token"
echo "bridge_id: $BID"
ROW="$("$PY" - "$DB" "$BID" <<'PY'
import sys, sqlite3
r = sqlite3.connect(sys.argv[1]).execute(
    "SELECT bridge_id,user_id,label FROM client_bridges WHERE bridge_id=?", (sys.argv[2],)).fetchone()
print("|".join(str(x) for x in r) if r else "")
PY
)"
echo "db row: $ROW"; [ -n "$ROW" ] || fail proof_b "no client_bridges row for $BID"

say "8. proof (c): sync with returned token -> 200 + wrote (no C:, no /app/)"
SYNC="$(curl -sS -X POST "$BASE/api/bridge/sync" \
  -H 'content-type: application/json' -H "X-Bridge-Token: $TOK" \
  -d "$("$PY" -c 'import json,sys;print(json.dumps({"bridge_id":sys.argv[1],"equity":11000.5,"balance":10000,"open_positions":0,"positions":[],"initial_capital":10000,"currency":"USD"}))' "$BID")")"
echo "sync: $SYNC"
WROTE="$("$PY" -c 'import json,sys;print(json.loads(sys.argv[1]).get("wrote",""))' "$SYNC" 2>/dev/null || true)"
[ -n "$WROTE" ] || fail proof_c "no wrote in sync response"
case "$WROTE" in *"C:"*) fail proof_c "wrote has C: $WROTE";; *"/app/client_results/"*) fail proof_c "wrote has /app/ $WROTE";; esac
[ -f "$WROTE" ] || fail proof_c "wrote file missing: $WROTE"
case "$WROTE" in *"/backend/client_results/$BID/performance.json") : ;; *) fail proof_c "unexpected wrote: $WROTE";; esac

say "9. proof (d): sync with WRONG token -> expect 403"
CODE_D="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/bridge/sync" \
  -H 'content-type: application/json' -H 'X-Bridge-Token: deadbeef' \
  -d "$("$PY" -c 'import json,sys;print(json.dumps({"bridge_id":sys.argv[1],"equity":1,"balance":1,"open_positions":0,"positions":[],"initial_capital":0,"currency":"USD"}))' "$BID")")"
echo "badtok: $CODE_D"; [ "$CODE_D" = "403" ] || fail proof_d "expected 403, got $CODE_D"

say "ALL FOUR GREEN — step 2/4 proven"
echo "nojwt:$CODE_A  register:$CODE_B  wrote:$WROTE  badtok:$CODE_D"
exit 0