"""HTTP integration tests for the chat feature alongside the existing H18 API."""
import json
from http.server import ThreadingHTTPServer
import io
import os
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend_api"))

import chat_service
from chat_service import ChatError, ChatService
import server


class ChatIntegrationTests(unittest.TestCase):
    def setUp(self):
        def provider(_messages):
            return "FinRisk test response", "mock-model"

        self.chat = ChatService(None, provider=provider)
        self.httpd = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            server.make_handler(None, "SNAPSHOT_NOT_CONFIGURED", self.chat),
        )
        self.worker = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.worker.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.worker.join()

    def request(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            self.base + path,
            data=data,
            headers={"Content-Type": "application/json"} if data is not None else {},
        )
        try:
            response = urlopen(request)
        except HTTPError as exc:
            response = exc
        with response:
            return response.status, response.read()

    def test_chat_endpoint_and_static_widget_are_available(self):
        status, body = self.request(
            "/api/chat",
            {"message": "Reply OK", "profile_id": None, "language": "en"},
        )
        payload = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(payload["answer"], "FinRisk test response")
        self.assertEqual(payload["context_mode"], "faq_only")

        status, _ = self.request("/")
        self.assertEqual(status, 200)
        status, _ = self.request("/src/finrisk-chat.js")
        self.assertEqual(status, 200)
        status, _ = self.request("/assets/finrisk-chat.css")
        self.assertEqual(status, 200)

    def test_existing_h18_endpoints_remain_available(self):
        status, body = self.request("/api/ml/health")
        payload = json.loads(body)
        self.assertEqual(status, 503)
        self.assertEqual(payload["integration_stage"], "H18")

        status, body = self.request("/api/decision/assess?sk_id_curr=100035")
        payload = json.loads(body)
        self.assertEqual(status, 503)
        self.assertEqual(payload["code"], "ML_NOT_READY")

    def test_chat_provider_error_detail_is_preserved(self):
        def provider(_messages):
            raise ChatError(502, "PROVIDER_ACCESS_DENIED", "error code: 1010")

        self.chat.provider = provider

        status, body = self.request(
            "/api/chat",
            {"message": "Reply OK", "profile_id": None, "language": "en"},
        )
        payload = json.loads(body)
        self.assertEqual(status, 502)
        self.assertEqual(payload["code"], "PROVIDER_ACCESS_DENIED")
        self.assertEqual(payload["message"], "error code: 1010")

    def test_groq_request_uses_descriptive_user_agent(self):
        captured = {}

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                pass

            def read(self, _limit):
                return json.dumps({"choices": [{"message": {"content": "OK"}}]}).encode()

        def fake_urlopen(request, timeout):
            captured["user_agent"] = request.get_header("User-agent")
            captured["accept"] = request.get_header("Accept")
            captured["timeout"] = timeout
            return Response()

        with patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}), patch.object(
            chat_service.request, "urlopen", side_effect=fake_urlopen
        ):
            answer, model = chat_service.call_groq([{"role": "user", "content": "test"}])

        self.assertEqual(answer, "OK")
        self.assertEqual(model, "openai/gpt-oss-20b")
        self.assertEqual(captured["user_agent"], "FinRisk-DSS-local-demo/1.0")
        self.assertEqual(captured["accept"], "application/json")
        self.assertEqual(captured["timeout"], 30)

    def test_cloudflare_1010_detail_is_preserved_and_key_is_redacted(self):
        key = "test-key-do-not-return"
        body = json.dumps({
            "error": {"message": f"error code: 1010 Bearer {key}"}
        }).encode()
        error = HTTPError("https://api.groq.com/", 403, "Forbidden", {}, io.BytesIO(body))

        with patch.dict(os.environ, {"GROQ_API_KEY": key}), patch.object(
            chat_service.request, "urlopen", side_effect=error
        ):
            with self.assertRaises(ChatError) as raised:
                chat_service.call_groq([{"role": "user", "content": "test"}])

        self.assertEqual(raised.exception.code, "PROVIDER_ACCESS_DENIED")
        self.assertIn("error code: 1010", raised.exception.message)
        self.assertNotIn(key, raised.exception.message)


if __name__ == "__main__":
    unittest.main()
