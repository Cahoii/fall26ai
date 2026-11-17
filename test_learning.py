import unittest
import sqlite3
import tempfile
from pathlib import Path
from contextlib import closing
from unittest.mock import patch
from learning import mastery_from_history


def row(number, correct, session=None, when=None, question=1):
    return dict(id=number, question_id=question, is_correct=int(correct), learning_session_id=session,
                answered_at_ms=when, event_id=f'event-{number:03d}')


class MasteryRuleTests(unittest.TestCase):
    def test_existing_database_migration_is_repeatable_and_preserves_legacy_rows(self):
        import server
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'old.sqlite3'
            with closing(sqlite3.connect(path)) as db:
                db.execute('CREATE TABLE attempts(id INTEGER PRIMARY KEY,user_id INTEGER,event_id TEXT,mode TEXT,created_at INTEGER,total INTEGER,correct INTEGER,UNIQUE(user_id,event_id))')
                db.execute("INSERT INTO attempts VALUES(1,1,'old-event','practice',1,1,1)")
                db.commit()
            with patch.object(server, 'DB_PATH', path), patch.object(server, 'DATABASE_URL', None):
                server.init_db()
                server.init_db()
                with server.connect() as db:
                    row = db.execute('SELECT * FROM attempts').fetchone()
                    self.assertEqual(row['event_id'], 'old-event')
                    self.assertIsNone(row['learning_session_id'])
                    self.assertIsNone(row['answered_at_ms'])

    def test_legacy_any_correct_seeds_exactly_one_even_when_last_wrong(self):
        self.assertEqual(mastery_from_history([row(1, True), row(2, False), row(3, True), row(4, False, question=2)]), {'1': 1, '2': 0})

    def test_modern_promotions_and_penalties_cross_sessions(self):
        history = [row(1, True, 'practice', 100), row(2, True, 'practice', 101), row(3, True, 'test1', 200), row(4, True, 'test2', 300)]
        self.assertEqual(mastery_from_history(history)['1'], 3)
        history.append(row(5, False, 'test3', 400))
        self.assertEqual(mastery_from_history(history)['1'], 1)
        history.append(row(6, True, 'test4', 500))
        self.assertEqual(mastery_from_history(history)['1'], 2)

    def test_first_wrong_consumes_eligibility_and_late_delivery_uses_performed_time(self):
        history = [row(1, True), row(2, True, 'test', 200), row(3, False, 'practice', 100), row(4, True, 'practice', 101)]
        self.assertEqual(mastery_from_history(history)['1'], 1)
        self.assertEqual(mastery_from_history([history[3], history[1], history[0], history[2]])['1'], 1)


if __name__ == '__main__':
    unittest.main()
