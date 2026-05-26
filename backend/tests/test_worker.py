import unittest

from backend.app.worker import dispatch


class PythonWorkerTests(unittest.TestCase):
    def test_dispatches_named_action_without_http_server(self):
        result = dispatch({"action": "health", "params": {}, "body": None})

        self.assertTrue(result["ok"])
        self.assertEqual(result["code"], 200)
        self.assertEqual(result["body"], {"status": "ok"})

    def test_rejects_unknown_actions_before_calling_domain_code(self):
        with self.assertRaises(ValueError):
            dispatch({"action": "does_not_exist", "params": {}, "body": None})

    def test_validates_action_params(self):
        result = dispatch({"action": "get_backend_log", "params": {"limit": "0"}, "body": None})

        self.assertFalse(result["ok"])
        self.assertEqual(result["code"], 422)
        self.assertIn("greater than or equal", result["body"]["detail"])


if __name__ == "__main__":
    unittest.main()
