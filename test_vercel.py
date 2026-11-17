"""Checks for the Vercel entrypoint and deployment configuration."""
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
import csv
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPCookieProcessor, Request

from api.index import handler
from database import connection, DatabaseConfigurationError, PostgresDatabase, Record
import server


class VercelDeploymentTests(unittest.TestCase):
    def test_question_json_and_csv_are_consistent(self):
        questions = json.loads((server.ROOT / 'questions.json').read_text(encoding='utf-8'))
        with (server.ROOT / 'questions.csv').open(encoding='utf-8-sig', newline='') as handle:
            rows = {int(row['id']): row for row in csv.DictReader(handle)}
        self.assertEqual(len(rows), len(questions))
        for question in questions:
            row = rows[question['id']]
            self.assertEqual(row['question'], question['question'])
            self.assertEqual(row['answer'], question['answer'])
            self.assertEqual(row['correct_text'], question['correctText'])
            for key in 'ABCD':
                self.assertEqual(row['option_' + key], question['options'][key])

    def test_cloud_requires_persistent_database(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'must-not-be-created.sqlite3'
            with self.assertRaises(DatabaseConfigurationError):
                with connection(path, cloud=True):
                    self.fail('Vercel must not fall back to ephemeral SQLite')
            self.assertFalse(path.exists())

    def test_transaction_pooling_uses_explicit_schema(self):
        sql = PostgresDatabase.qualified('SELECT a.id FROM answers a JOIN attempts t ON t.id=a.attempt_id WHERE t.user_id=%s')
        self.assertIn('FROM dpl302.answers', sql)
        self.assertIn('JOIN dpl302.attempts', sql)
        # Duplicate aggregate column names must retain independent positional values.
        record = Record(['coalesce', 'coalesce'], [10, 7])
        self.assertEqual((record[0], record[1]), (10, 7))

    def test_only_public_assets_are_published(self):
        from scripts import build_static
        self.assertEqual({p.name for p in build_static.OUTPUT.iterdir()},
                         {'index.html', 'account.js', 'learning.js', 'practice-sync.js', 'math-format.js', 'question-revisions.js', 'questions.json', 'questions.csv', 'vendor'})
        config = json.loads((server.ROOT / 'vercel.json').read_text())
        self.assertEqual(config['outputDirectory'], 'public')
        self.assertEqual(config['rewrites'][0]['destination'], '/api/index?_route=:path*')

    def test_rewritten_routes_and_missing_database_response(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(server, 'DB_PATH', Path(directory) / 'test.sqlite3'), \
                 patch.object(server, 'DATABASE_URL', None), \
                 patch.object(server, '_database_ready', False), \
                 patch.dict(os.environ, {'VERCEL': '0'}):
                http = ThreadingHTTPServer(('127.0.0.1', 0), handler)
                thread = threading.Thread(target=http.serve_forever, daemon=True)
                thread.start()
                base = f'http://127.0.0.1:{http.server_port}'
                client = build_opener(HTTPCookieProcessor(CookieJar()))
                try:
                    with client.open(base + '/api/index?_route=me') as response:
                        self.assertIsNone(json.load(response)['user'])
                    body = json.dumps({'username': 'vercel-test', 'password': 'test-password-123'}).encode()
                    req = Request(base + '/api/index?_route=register', data=body,
                                  headers={'Content-Type': 'application/json'})
                    with client.open(req) as response:
                        self.assertEqual(response.status, 200)
                    with client.open(base + '/api/index?_route=history&page=2') as response:
                        self.assertEqual(json.load(response)['page'], 2)
                    with patch.dict(os.environ, {'VERCEL': '1'}):
                        with self.assertRaises(HTTPError) as caught:
                            client.open(base + '/api/index?_route=me')
                        with caught.exception as response:
                            self.assertEqual(response.status, 503)
                            self.assertEqual(json.load(response)['code'], 'DATABASE_NOT_CONFIGURED')
                finally:
                    http.shutdown()
                    http.server_close()
                    thread.join()


if __name__ == '__main__':
    unittest.main()
