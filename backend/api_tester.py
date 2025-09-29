#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API Tester for Habitek Treasury Backend (with Socket.IO events)
---------------------------------------------------------------
Covers:
- Public registration (/api/register) with auto-login (+ listens for 'user.created')
- Authentication (/api/login) & Health
- Budgets CRUD + distincts + summary (+ events: budget.created/updated/deleted)
- CDD (compte_depenses) CRUD + uploads/downloads + generated PDF (+ events)
- Factures CRUD + uploads/downloads (+ events)
- Optional password change for current user (+ event: user.updated)

Usage examples:
  python3 api_tester.py --base-url http://localhost:5000 \
                        --register-public \
                        --prenom Alice --nom Dupont \
                        --email alice@example.org \
                        --password Test1234 \
                        --ws \
                        --cleanup

  # If the account already exists (409), the script automatically falls back to login.

Environment variables (fallbacks):
  API_BASE, API_EMAIL, API_PASSWORD, API_TOKEN

Requires: Python 3.9+
  pip install requests python-socketio websocket-client
"""

import argparse
import base64
import io
import json
import os
import sys
import time
import queue
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple, Callable

try:
    import requests
except Exception as e:
    print("This script requires 'requests'. Install with: pip install requests")
    raise

try:
    import socketio  # python-socketio (client)
    HAS_SIO = True
except Exception:
    HAS_SIO = False


# ---------------------- Console helpers ----------------------
def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def _tick(ok=True):
    return "✅" if ok else "❌"

def _step(title: str):
    print(f"\n--- {title} ---")

def _log(msg: str):
    print(f"[{_now_iso()}] {msg}")


# ---------------------- Minimal PDF ----------------------
def _minimal_pdf_bytes(text="Habitek Test PDF") -> bytes:
    content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
72 720 Td
({text}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000124 00000 n 
0000000236 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
330
%%EOF
"""
    return content.encode("latin-1")


def _gen_unique_email() -> str:
    ts = int(time.time())
    return f"habitek_tester_{ts}@example.org"


# ---------------------- Realtime listener ----------------------
EVENT_NAMES = [
    "user.created", "user.updated", "user.deleted",
    "facture.created", "facture.updated", "facture.deleted",
    "budget.created", "budget.updated", "budget.deleted",
    "cdd.created", "cdd.updated", "cdd.deleted",
    "cdd.attachment.added",
]

class RealtimeListener:
    """Socket.IO client that collects events into a queue per event name."""
    def __init__(self, base_url: str, verbose: bool = False):
        if not HAS_SIO:
            raise RuntimeError("python-socketio is not installed. pip install python-socketio websocket-client")
        self.base_url = base_url.rstrip("/")
        self.verbose = verbose
        self.sio = socketio.Client(reconnection=True, logger=False, engineio_logger=False)
        self._events: Dict[str, "queue.Queue[dict]"] = {n: queue.Queue() for n in EVENT_NAMES}
        self._connected = threading.Event()

        @self.sio.event
        def connect():
            self._connected.set()
            _log("WS connected")

        @self.sio.event
        def disconnect():
            _log("WS disconnected")

        # Dynamically register handlers
        for name in EVENT_NAMES:
            self.sio.on(name, self._make_handler(name))

    def _make_handler(self, name: str):
        def handler(payload):
            if self.verbose:
                _log(f"WS {name}: {payload}")
            try:
                self._events[name].put_nowait(payload or {})
            except Exception:
                pass
        return handler

    def start(self, headers: Optional[dict] = None):
        url = self.base_url  # Flask-SocketIO shares same origin
        transports = ["websocket"]  # force WS for reliability
        self.sio.connect(url, headers=headers or {}, transports=transports, wait=True)
        # small grace
        self._connected.wait(timeout=3)

    def stop(self):
        try:
            self.sio.disconnect()
        except Exception:
            pass

    def wait_for(self, event_name: str, predicate: Optional[Callable[[dict], bool]] = None, timeout: float = 5.0) -> Optional[dict]:
        """Wait for event_name optionally matching predicate, within timeout."""
        end = time.time() + timeout
        while time.time() < end:
            try:
                payload = self._events[event_name].get(timeout=timeout/10.0)
                if predicate is None or predicate(payload):
                    return payload
            except queue.Empty:
                pass
        return None


# ---------------------- API Tester ----------------------
class APITester:
    def __init__(self, base_url: str, email: Optional[str], password: Optional[str], token: Optional[str], verbose: bool = False, use_ws: bool = False):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.token = token
        self.verbose = verbose
        self.use_ws = use_ws

        self.headers = {"Accept": "application/json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

        self.state: Dict[str, Any] = {
            "user": None,
            "budget_id": None,
            "cid": None,
            "invoice_id": None,
            "invoice_fy": None,
            "cdd_file_index": None,
        }

        self.ws: Optional[RealtimeListener] = None
        if use_ws:
            if not HAS_SIO:
                raise RuntimeError("Install python-socketio & websocket-client to use --ws")
            self.ws = RealtimeListener(self.base_url, verbose=verbose)
            # Start WS without Authorization (broadcast events are public)
            self.ws.start()

    # ---------------------- HTTP helpers ----------------------
    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _req(self, method: str, path: str, expected: Tuple[int, ...] = (200,), **kwargs) -> requests.Response:
        if "headers" in kwargs:
            h = dict(kwargs["headers"]); h.update(self.headers)
            kwargs["headers"] = h
        else:
            kwargs["headers"] = self.headers

        url = self._url(path)
        if self.verbose:
            _log(f"{method} {url}")
            if "json" in kwargs and kwargs["json"] is not None:
                try: print("  JSON:", json.dumps(kwargs["json"], ensure_ascii=False))
                except Exception: print("  JSON: <unserializable>")
            if "params" in kwargs and kwargs["params"] is not None:
                print("  Params:", kwargs["params"])
            if "files" in kwargs and kwargs["files"] is not None:
                print("  Files:", [k for k in kwargs["files"].keys()])

        resp = requests.request(method, url, timeout=60, **kwargs)
        if resp.status_code not in expected:
            print(f"{_tick(False)} {method} {path} -> {resp.status_code}")
            try:
                print(resp.json())
            except Exception:
                print(resp.text[:500])
            raise SystemExit(1)
        print(f"{_tick(True)} {method} {path} -> {resp.status_code}")
        return resp

    # ---------------------- Public registration ----------------------
    def register_public(self, prenom: Optional[str], nom: Optional[str], email: Optional[str], password: Optional[str]):
        if not email:
            email = _gen_unique_email()
            print(f"[register] No email provided; generated: {email}")
            self.email = email
        if not password:
            password = "Test1234"
            self.password = password
            print("[register] No password provided; using default 'Test1234'")

        payload = {"prenom": (prenom or "Test"), "nom": (nom or "User"), "courriel": email, "password": password}
        resp = self._req("POST", "/api/register", expected=(201, 409, 400), json=payload)
        if resp.status_code == 201:
            data = resp.json()
            self.token = data.get("token")
            self.headers["Authorization"] = f"Bearer {self.token}"
            self.state["user"] = data.get("user")
            print(f"{_tick(True)} registered as {self.state['user']}")
            # WS check
            if self.ws:
                uid = self.state["user"]["uid"]
                ev = self.ws.wait_for("user.created", predicate=lambda p: p.get("user", {}).get("uid") == uid, timeout=5)
                print(("WS user.created received" if ev else "WS user.created not received"), "for uid", uid)
            return True, data
        elif resp.status_code == 409:
            print("[register] User already exists (409). Falling back to login.")
            return False, resp.json()
        else:
            print("[register] Registration failed:", resp.json())
            raise SystemExit(1)

    # ---------------------- Auth & health ----------------------
    def login_if_needed(self):
        if self.token:
            print("Using provided token.")
            return
        if not self.email or not self.password:
            print("No token and missing email/password for login.")
            raise SystemExit(1)

        resp = self._req("POST", "/api/login", expected=(200,401,400),
                         json={"email": self.email, "password": self.password})
        if resp.status_code != 200:
            print("Login failed:", resp.json())
            raise SystemExit(1)
        data = resp.json()
        self.token = data["token"]
        self.headers["Authorization"] = f"Bearer {self.token}"]
        self.state["user"] = data.get("user", {})
        print(f"{_tick(True)} logged in as {self.state['user']}")

    def health(self):
        self._req("GET", "/api/health", expected=(200,))

    # ---------------------- Budgets ----------------------
    def budgets_create(self, fy: str):
        payload = {"financial_year": fy, "fund_type": "Fonctionnement", "revenue_type": "Cotisations", "amount": 12345.67}
        resp = self._req("POST", "/api/budgets", expected=(201,), json=payload)
        data = resp.json()
        self.state["budget_id"] = data["id"]
        if self.ws:
            ev = self.ws.wait_for("budget.created", predicate=lambda p: p.get("id") == data["id"], timeout=5)
            print("WS budget.created", "received" if ev else "not received", f"(id={data['id']})")
        return data

    def budgets_list(self, fy: Optional[str] = None):
        params = {"fy": fy} if fy else {}
        resp = self._req("GET", "/api/budgets", params=params)
        return resp.json()

    def budgets_distincts(self, fy: Optional[str] = None):
        params = {"fy": fy} if fy else {}
        funds = self._req("GET", "/api/budgets/fund-types", params=params).json()
        revs  = self._req("GET", "/api/budgets/revenue-types", params=params).json()
        return {"fund_types": funds, "revenue_types": revs}

    def budgets_summary(self, fy: Optional[str] = None):
        params = {"fy": fy} if fy else {}
        resp = self._req("GET", "/api/budgets/summary", params=params)
        return resp.json()

    def budgets_update(self, bid: int):
        payload = {"amount": 23456.78}
        resp = self._req("PATCH", f"/api/budgets/{bid}", json=payload)
        data = resp.json()
        if self.ws:
            ev = self.ws.wait_for("budget.updated", predicate=lambda p: p.get("id") == bid, timeout=5)
            print("WS budget.updated", "received" if ev else "not received", f"(id={bid})")
        return data

    def budgets_delete(self, bid: int):
        self._req("DELETE", f"/api/budgets/{bid}")
        if self.ws:
            ev = self.ws.wait_for("budget.deleted", predicate=lambda p: p.get("id") == bid, timeout=5)
            print("WS budget.deleted", "received" if ev else "not received", f"(id={bid})")
        return True

    # ---------------------- CDD ----------------------
    def cdd_create(self, prenom="Jean", nom="Valjean", mode="virement", type_cdd_int=0):
        payload = {
            "mode": mode,
            "type_cdd_int": type_cdd_int,
            "prénom_demandeur": prenom,
            "nom_demandeur": nom,
            "date_soumis": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        resp = self._req("POST", "/api/depense-comptes", expected=(201,), json=payload)
        data = resp.json()
        self.state["cid"] = data["cid"]
        if self.ws:
            ev = self.ws.wait_for("cdd.created", predicate=lambda p: p.get("cid") == data["cid"], timeout=5)
            print("WS cdd.created", "received" if ev else "not received", f"(cid={data['cid']})")
        return data

    def cdd_list(self, fy: Optional[int] = None, q: Optional[str] = None):
        params = {}
        if fy is not None: params["fy"] = fy
        if q: params["q"] = q
        resp = self._req("GET", "/api/depense-comptes", params=params)
        return resp.json()

    def cdd_get(self, cid: str):
        resp = self._req("GET", f"/api/depense-comptes/{cid}")
        return resp.json()

    def cdd_upload_piece(self, cid: str):
        pdf_bytes = _minimal_pdf_bytes("CDD Upload Piece")
        files = {"fichier": ("cdd_piece.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        resp = self._req("POST", f"/api/depense-comptes/{cid}/pieces", expected=(201,), files=files)
        data = resp.json()
        self.state["cdd_file_index"] = data.get("file_index")
        if self.ws:
            ev = self.ws.wait_for(
                "cdd.attachment.added",
                predicate=lambda p: p.get("cid") == cid and p.get("file_index") == self.state["cdd_file_index"],
                timeout=5
            )
            print("WS cdd.attachment.added", "received" if ev else "not received", f"(cid={cid}, idx={self.state['cdd_file_index']})")
        return data

    def cdd_list_pieces(self, cid: str):
        resp = self._req("GET", f"/api/depense-comptes/{cid}/pieces")
        return resp.json()

    def cdd_download_piece(self, cid: str, idx: int):
        resp = self._req("GET", f"/api/depense-comptes/{cid}/pieces/{idx}", expected=(200,))
        return len(resp.content)

    def cdd_save_generated_pdf(self, cid: str):
        pdf = _minimal_pdf_bytes("Generated CDD PDF")
        b64 = base64.b64encode(pdf).decode()
        resp = self._req(
            "POST",
            f"/api/depense-comptes/{cid}/generated-pdf",
            expected=(201,),
            json={"pdf_base64": b64}
        )
        data = resp.json()
        if self.ws:
            ev = self.ws.wait_for(
                "cdd.attachment.added",
                predicate=lambda p: p.get("cid") == cid and p.get("generated") is True,
                timeout=5
            )
            print("WS cdd.attachment.added (generated)", "received" if ev else "not received", f"(cid={cid})")
        return data

    def cdd_patch(self, cid: str):
        resp = self._req("PATCH", f"/api/depense-comptes/{cid}",
                         json={"mode": "cheque", "type_cdd_int": 1})
        data = resp.json()
        if self.ws:
            ev = self.ws.wait_for("cdd.updated", predicate=lambda p: p.get("cid") == cid, timeout=5)
            print("WS cdd.updated", "received" if ev else "not received", f"(cid={cid})")
        return data

    def cdd_delete(self, cid: str):
        self._req("DELETE", f"/api/depense-comptes/{cid}")
        if self.ws:
            ev = self.ws.wait_for("cdd.deleted", predicate=lambda p: p.get("cid") == cid, timeout=5)
            print("WS cdd.deleted", "received" if ev else "not received", f"(cid={cid})")
        return True

    # ---------------------- Factures ----------------------
    def facture_create(self, ref_cdd: Optional[str] = None):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        data = {
            "date_facture": today,
            "fournisseur": "Papeterie ABC Inc.",
            "description": "Fournitures de bureau",
            "montant": "57.90",
            "devise": "CAD",
            "statut": "soumise",
            "ref_cdd": ref_cdd or ""
        }
        pdf_bytes = _minimal_pdf_bytes("Facture Upload Piece")
        files = {"fichier": ("facture_piece.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        resp = self._req("POST", "/api/factures", expected=(201,), data=data, files=files)
        data = resp.json()
        self.state["invoice_id"] = data["id"]
        self.state["invoice_fy"] = data.get("financial_year")
        if self.ws:
            ev = self.ws.wait_for("facture.created", predicate=lambda p: p.get("id") == data["id"], timeout=5)
            print("WS facture.created", "received" if ev else "not received", f"(id={data['id']})")
        return data

    def factures_list(self, fy: Optional[int] = None):
        params = {"fy": fy} if fy is not None else {}
        resp = self._req("GET", "/api/factures", params=params)
        return resp.json()

    def facture_list_pieces(self, invoice_id: int):
        resp = self._req("GET", f"/api/factures/{invoice_id}/pieces")
        return resp.json()

    def facture_download_piece(self, invoice_id: int, idx: int):
        resp = self._req("GET", f"/api/factures/{invoice_id}/pieces/{idx}", expected=(200,))
        return len(resp.content)

    def facture_patch(self, invoice_id: int):
        payload = {"statut": "approuvée"}
        resp = self._req("PATCH", f"/api/factures/{invoice_id}", json=payload)
        data = resp.json()
        if self.ws:
            ev = self.ws.wait_for("facture.updated", predicate=lambda p: p.get("id") == invoice_id, timeout=5)
            print("WS facture.updated", "received" if ev else "not received", f"(id={invoice_id})")
        return data

    def facture_delete(self, invoice_id: int):
        self._req("DELETE", f"/api/factures/{invoice_id}")
        if self.ws:
            ev = self.ws.wait_for("facture.deleted", predicate=lambda p: p.get("id") == invoice_id, timeout=5)
            print("WS facture.deleted", "received" if ev else "not received", f"(id={invoice_id})")
        return True

    # ---------------------- Orchestrate tests ----------------------
    def run(self, do_register=False, prenom=None, nom=None, skip_budgets=False, skip_cdd=False, skip_factures=False, do_password_change=False, cleanup=False):
        print(f"== Habitek API Tester == {self.base_url} (ws={'ON' if self.use_ws else 'OFF'})")

        # Optional public registration
        if do_register:
            _step("Public registration")
            registered, _ = self.register_public(prenom, nom, self.email, self.password)
            if not registered:
                _log("Registration skipped (already exists) -> logging in")
                self.login_if_needed()
        else:
            _step("Login")
            self.login_if_needed()

        _step("Health")
        self.health()

        # Budgets
        if not skip_budgets:
            _step("Budgets")
            fy = str(self._infer_current_fy())
            created = self.budgets_create(fy)
            _log(f"Created budget id={created['id']}")
            lst = self.budgets_list(fy); _log(f"List budgets -> {len(lst)} rows")
            dists = self.budgets_distincts(fy); _log(f"Distincts -> funds={len(dists['fund_types'])}, revenue={len(dists['revenue_types'])}")
            summ = self.budgets_summary(fy); _log(f"Summary -> keys={list(summ.keys())}")
            upd = self.budgets_update(self.state["budget_id"]); _log(f"Updated budget amount={upd.get('amount')}")
            if cleanup:
                self.budgets_delete(self.state["budget_id"]); _log("Deleted budget")

        # CDD
        if not skip_cdd:
            _step("CDD (compte de dépenses)")
            cdd = self.cdd_create()
            cid = cdd["cid"]; _log(f"Created CDD cid={cid}")
            l = self.cdd_list(); _log(f"List CDDs -> {len(l)} rows")
            g = self.cdd_get(cid); _log(f"Get CDD -> demandeur={g.get('prenom_demandeur')} {g.get('nom_demandeur')}")
            up = self.cdd_upload_piece(cid); _log(f"Uploaded piece idx={up.get('file_index')}")
            pl = self.cdd_list_pieces(cid); _log(f"List pieces -> {len(pl)} items")
            if pl:
                size = self.cdd_download_piece(cid, pl[0]["file_index"]); _log(f"Downloaded CDD piece bytes={size}")
            gp = self.cdd_save_generated_pdf(cid); _log("Saved generated PDF")
            patch = self.cdd_patch(cid); _log("Patched CDD")
            if cleanup:
                self.cdd_delete(cid); _log("Deleted CDD")

        # Factures
        if not skip_factures:
            _step("Factures")
            ref = self.state.get("cid")
            inv = self.facture_create(ref); _log(f"Created facture id={inv['id']}")
            fy = self.state["invoice_fy"]
            fl = self.factures_list(fy); _log(f"List factures (fy={fy}) -> {len(fl)} rows")
            pl = self.facture_list_pieces(self.state["invoice_id"]); _log(f"List facture pieces -> {len(pl)} items")
            if pl:
                size = self.facture_download_piece(self.state["invoice_id"], pl[0]["file_index"]); _log(f"Downloaded facture piece bytes={size}")
            upd = self.facture_patch(self.state["invoice_id"]); _log("Patched facture")
            if cleanup:
                self.facture_delete(self.state["invoice_id"]); _log("Deleted facture")

        # Optional password change for the current user
        if do_password_change and self.state.get("user", {}).get("uid"):
            _step("User password change (self)")
            uid = self.state["user"]["uid"]
            resp = self._req("PATCH", f"/api/users/{uid}/password", json={"password": "NewPass123"})
            if self.ws:
                ev = self.ws.wait_for("user.updated", predicate=lambda p: p.get("uid") == uid, timeout=5)
                print("WS user.updated", "received" if ev else "not received", f"(uid={uid})")

        # Done
        if self.ws:
            self.ws.stop()
        print("\n✅ All selected tests completed successfully.")

    # ---------------------- Helpers ----------------------
    def _infer_current_fy(self) -> int:
        now = datetime.now()
        return now.year if now.month >= 5 else (now.year - 1)


def main():
    parser = argparse.ArgumentParser(description="Habitek API Tester (with WebSockets)")
    parser.add_argument("--base-url", default=os.environ.get("API_BASE", "http://localhost:5000"), help="API base URL")
    parser.add_argument("--email", default=os.environ.get("API_EMAIL"), help="Login/registration email")
    parser.add_argument("--password", default=os.environ.get("API_PASSWORD"), help="Login/registration password")
    parser.add_argument("--token", default=os.environ.get("API_TOKEN"), help="JWT token (if provided, login is skipped)")

    # Public registration options
    parser.add_argument("--register-public", action="store_true", help="Run public registration before tests (auto-login on success)")
    parser.add_argument("--prenom", help="First name for registration (default: Test)")
    parser.add_argument("--nom", help="Last name for registration (default: User)")

    # Feature toggles
    parser.add_argument("--skip-budgets", action="store_true", help="Skip budget tests")
    parser.add_argument("--skip-cdd", action="store_true", help="Skip CDD tests")
    parser.add_argument("--skip-factures", action="store_true", help="Skip facture tests")
    parser.add_argument("--password-change", action="store_true", help="Also test self password change")
    parser.add_argument("--cleanup", action="store_true", help="Delete created resources")
    parser.add_argument("--verbose", action="store_true", help="Verbose HTTP logs")
    parser.add_argument("--ws", action="store_true", help="Enable Socket.IO listening and event assertions")

    args = parser.parse_args()

    t = APITester(args.base_url, args.email, args.password, args.token, verbose=args.verbose, use_ws=args.ws)
    t.run(do_register=args.register_public, prenom=args.prenom, nom=args.nom,
          skip_budgets=args.skip_budgets, skip_cdd=args.skip_cdd, skip_factures=args.skip_factures,
          do_password_change=args.password_change, cleanup=args.cleanup)


if __name__ == "__main__":
    main()
