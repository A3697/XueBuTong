import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src/backend-host"))
from session_guard import install, displacement_message, response_message, SessionDisplacedError

CASES = json.loads(Path(__file__).with_name("session_guard_cases.json").read_text(encoding="utf-8"))


class GuardTests(unittest.TestCase):
    def response(self, body, url="https://mooc1.chaoxing.com/api", status=200):
        text = json.dumps(body, ensure_ascii=False)
        return SimpleNamespace(url=url, headers={"content-type": "application/json"}, text=text, content=text.encode(), status_code=status)

    def test_shared_messages(self):
        for value in CASES["accepted"]:
            self.assertTrue(displacement_message(value), value)
        for value in CASES["rejected"]:
            self.assertFalse(displacement_message(value), value)

    def test_envelopes(self):
        self.assertIsNone(response_message({"success": True, "message": CASES["accepted"][0]}))
        self.assertIsNone(response_message({"success": False, "message": "登录已过期"}, 401))
        self.assertIsNone(response_message({"code": 403, "message": "请完成验证码"}, 403))

    def test_block_and_snapshot_no_secrets(self):
        responses = [self.response({"success": False, "message": CASES["accepted"][0]})]
        requests = []
        class Session:
            def send(self, request, **kwargs):
                requests.append(request.url)
                return responses[0]
        class Engine:
            def _session_payload(self):
                return {"logged_in": True}
        engine = Engine()
        before = Session.send
        events = []
        guard = install(events.append, session_class=Session, engine=engine)
        request = SimpleNamespace(url="https://mooc1.chaoxing.com/api")
        self.assertEqual(engine._session_payload(), {"logged_in": True})
        with self.assertRaises(SessionDisplacedError):
            Session().send(request)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["payload"], {"reason": "concurrent-login", "platform": "chaoxing", "source": "response"})
        with self.assertRaises(SessionDisplacedError):
            Session().send(request)
        self.assertEqual(len(requests), 1)
        self.assertEqual(engine._session_payload()["session_guard"], guard.snapshot())
        guard.dispose()
        self.assertIs(Session.send, before)
        self.assertEqual(engine._session_payload(), {"logged_in": True})

    def test_souti_network_expiry_and_stream_not_displacement(self):
        data = [self.response({"success": False, "msg": CASES["accepted"][0]}, "https://daxuesoutijiang.com/api")]
        class Session:
            def send(self, request, **kwargs):
                return data[0]
        events = []
        guard = install(events.append, session_class=Session)
        self.addCleanup(guard.dispose)
        Session().send(SimpleNamespace(url=data[0].url))
        data[0] = self.response({"success": False, "msg": "登录过期"}, status=401)
        Session().send(SimpleNamespace(url=data[0].url))
        data[0] = self.response({"success": False, "msg": CASES["accepted"][0]})
        Session().send(SimpleNamespace(url=data[0].url), stream=True)
        self.assertEqual(events, [])
        self.assertIsNone(guard.snapshot())

    def test_failed_event_delivery_still_blocks_and_exposes_snapshot(self):
        class Session:
            def send(self, request, **kwargs):
                return None
        def fail(_):
            raise RuntimeError("no websocket yet")
        guard = install(fail, session_class=Session)
        self.addCleanup(guard.dispose)
        with self.assertRaises(SessionDisplacedError):
            guard.inspect_response(self.response({"ok": False, "message": CASES["accepted"][0]}))
        self.assertEqual(guard.snapshot()["reason"], "concurrent-login")


if __name__ == "__main__":
    unittest.main()
