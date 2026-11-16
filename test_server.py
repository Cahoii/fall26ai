"""Integration tests: python -m unittest -v"""
import copy
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPCookieProcessor, Request

import server


class DatabaseFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.previous_db = server.DB_PATH
        server.DB_PATH = Path(cls.temp.name) / 'test.sqlite3'
        server.init_db()
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'
        cls.question = json.loads((server.ROOT / 'questions.json').read_text(encoding='utf-8'))[0]

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        server.DB_PATH = cls.previous_db
        cls.temp.cleanup()

    def setUp(self):
        self.client = build_opener(HTTPCookieProcessor(CookieJar()))
        self.username = self.id().split('.')[-1][:40]

    def request(self, path, method='GET', body=None, client=None, origin=None, account_id=None):
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        if account_id is not None:
            headers['X-Account-ID'] = str(account_id)
        request = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                          headers=headers, method=method)
        try:
            response = (client or self.client).open(request)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def register(self):
        code, data = self.request('/api/register', 'POST', {'username': self.username, 'password': 'testing-12345'})
        self.assertEqual(code, 200, data)
        return data

    def payload(self, event='test-event-00000001', mode='practice'):
        return {'eventId': event, 'mode': mode, 'answers': [{'question': copy.deepcopy(self.question), 'selected': self.question['answer']}]}

    def test_authentication_and_persistence(self):
        self.assertEqual(self.request('/api/history')[0], 401)
        data = self.register()
        self.assertEqual(self.request('/api/me')[1]['user'], data['user'])
        self.assertEqual(self.request('/api/register', 'POST', {'username': self.username.upper(), 'password': 'testing-12345'})[0], 409)
        self.assertEqual(self.request('/api/attempts', 'POST', self.payload())[0], 200)
        self.assertEqual(self.request('/api/logout', 'POST', {})[0], 200)
        self.assertIsNone(self.request('/api/me')[1]['user'])
        self.assertEqual(self.request('/api/login', 'POST', {'username': self.username, 'password': 'wrong-password'})[0], 401)
        code, data = self.request('/api/login', 'POST', {'username': self.username, 'password': 'testing-12345'})
        self.assertEqual(code, 200)
        self.assertEqual(data['progress']['attempts'], 1)
        server.init_db()  # Reinitializing the database must preserve data.
        self.assertEqual(self.request('/api/history')[1]['total'], 1)
        with server.connect() as db:
            row = db.execute('SELECT password_hash FROM users WHERE username=?', (self.username,)).fetchone()
            self.assertNotEqual(row[0], 'testing-12345')

    def test_answers_snapshots_and_idempotency(self):
        self.register()
        payload = self.payload(mode='test')
        q2 = copy.deepcopy(self.question)
        q2['id'] = 999
        payload['answers'].append({'question': q2, 'selected': None})
        code, result = self.request('/api/attempts', 'POST', payload)
        self.assertEqual(code, 200)
        self.assertEqual(result['progress']['attempts'], 2)
        self.assertEqual(result['progress']['correct'], 1)
        self.assertIn(999, result['progress']['wrong'])
        self.assertEqual(self.request('/api/attempts', 'POST', payload)[1]['progress']['attempts'], 2)
        item = self.request('/api/history')[1]['items'][0]
        details = self.request('/api/history/' + str(item['id']))[1]
        self.assertEqual(details['answers'][0]['options'], self.question['options'])
        self.assertEqual(details['answers'][0]['selected_answer'], self.question['answer'])
        self.assertIsNone(details['answers'][1]['selected_answer'])
        payload['answers'][0]['question']['question'] = 'Changed later'
        self.assertEqual(self.request('/api/history/' + str(item['id']))[1]['answers'][0]['question'], self.question['question'])

    def test_account_isolation(self):
        self.register()
        self.request('/api/attempts', 'POST', self.payload())
        attempt_id = self.request('/api/history')[1]['items'][0]['id']
        other = build_opener(HTTPCookieProcessor(CookieJar()))
        self.request('/api/register', 'POST', {'username': 'another-user', 'password': 'testing-12345'}, client=other)
        self.assertEqual(self.request('/api/history', client=other)[1]['total'], 0)
        self.assertEqual(self.request('/api/history/' + str(attempt_id), client=other)[0], 404)
        # A tab still showing another account must never write into the new session.
        self.assertEqual(self.request('/api/attempts', 'POST', self.payload(), client=other, account_id=-1)[0], 409)
        self.assertEqual(self.request('/api/history', client=other)[1]['total'], 0)
        self.assertEqual(self.request('/api/known', 'PUT', {'known': [1, 2, 2]})[1]['progress']['known'], [1, 2])
        self.assertEqual(self.request('/api/me', client=other)[1]['progress']['known'], [])

    def test_validation_and_private_files(self):
        self.register()
        payload = self.payload()
        payload['answers'][0]['selected'] = 'Z'
        self.assertEqual(self.request('/api/attempts', 'POST', payload)[0], 400)
        self.assertEqual(self.request('/api/history')[1]['total'], 0)
        self.assertEqual(self.request('/api/known', 'PUT', {'known': ['bad']})[0], 400)
        self.assertEqual(self.request('/api/attempts', 'POST', self.payload(), origin='https://unrelated.example')[0], 403)
        for path in ('/data/study.sqlite3', '/server.py', '/.git/config', '/../server.py'):
            self.assertEqual(self.request(path)[0], 404)

    def test_math_assets_are_public_but_vendor_paths_are_restricted(self):
        for path, kind in [('/math-format.js', 'text/javascript'),
                           ('/question-revisions.js', 'text/javascript'),
                           ('/vendor/katex/katex.min.js', 'text/javascript'),
                           ('/vendor/katex/katex.min.css', 'text/css'),
                           ('/vendor/katex/fonts/KaTeX_Main-Regular.woff2', 'font/woff2')]:
            with self.client.open(self.base + path) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(kind, response.headers['Content-Type'])
        self.assertEqual(self.request('/vendor/katex/../../server.py')[0], 404)

    def test_history_pagination_and_latest_answer(self):
        self.register()
        payload = self.payload()
        wrong = next(k for k in self.question['options'] if k != self.question['answer'])
        payload['answers'][0]['selected'] = wrong
        self.request('/api/attempts', 'POST', payload)
        self.assertIn(self.question['id'], self.request('/api/me')[1]['progress']['wrong'])
        for i in range(21):
            self.request('/api/attempts', 'POST', self.payload(event=f'pagination-event-{i:05d}'))
        first = self.request('/api/history')[1]
        second = self.request('/api/history?page=2')[1]
        self.assertEqual((len(first['items']), len(second['items']), first['total']), (20, 2, 22))
        self.assertNotIn(self.question['id'], self.request('/api/me')[1]['progress']['wrong'])


if __name__ == '__main__':
    unittest.main()
