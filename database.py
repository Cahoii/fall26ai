"""SQLite locally, persistent PostgreSQL for Vercel deployments."""
from contextlib import contextmanager
import re
import sqlite3

try:
    import psycopg
except ImportError:
    psycopg = None

DATABASE_ERRORS = (sqlite3.Error,) + ((psycopg.Error,) if psycopg else ())
INTEGRITY_ERRORS = (sqlite3.IntegrityError,) + ((psycopg.IntegrityError,) if psycopg else ())


class DatabaseConfigurationError(Exception):
    pass


class Record(dict):
    """Keep both column-name access and positional access used by sqlite3.Row."""
    def __init__(self, names, values):
        super().__init__(zip(names, values))
        self.values_tuple = values

    def __getitem__(self, key):
        return self.values_tuple[key] if isinstance(key, int) else super().__getitem__(key)


def record_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    return lambda values: Record(names, values)


class PostgresCursor:
    def __init__(self, cursor, inserted=False):
        self.cursor = cursor
        self.rowcount = cursor.rowcount
        self.lastrowid = None
        if inserted and self.rowcount:
            self.lastrowid = cursor.fetchone()[0]

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __iter__(self):
        return iter(self.cursor)


class PostgresDatabase:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, statement, parameters=()):
        sql = statement.replace('?', '%s')
        inserted = sql.startswith(('INSERT INTO users(', 'INSERT OR IGNORE INTO attempts('))
        if sql.startswith('INSERT OR IGNORE INTO attempts('):
            sql = sql.replace('INSERT OR IGNORE', 'INSERT', 1) + ' ON CONFLICT (user_id,event_id) DO NOTHING'
        if inserted:
            sql += ' RETURNING id'
        return PostgresCursor(self.connection.execute(self.qualified(sql), parameters), inserted)

    @staticmethod
    def qualified(statement):
        # Explicit schemas work with Neon transaction pooling; session search_path does not.
        return re.sub(r'\b(users|sessions|attempts|answers|known_questions)\b', r'dpl302.\1', statement)

    def executemany(self, statement, parameters):
        with self.connection.cursor() as cursor:
            cursor.executemany(self.qualified(statement.replace('?', '%s')), parameters)

    def executescript(self, script):
        for statement in script.split(';'):
            if statement.strip():
                self.connection.execute(self.qualified(statement))

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()


@contextmanager
def connection(path, database_url=None, cloud=False):
    if database_url:
        if psycopg is None:
            raise DatabaseConfigurationError('Chưa cài driver PostgreSQL. Chạy pip install -r requirements.txt.')
        with psycopg.connect(database_url, connect_timeout=10, prepare_threshold=None,
                             row_factory=record_factory) as db:
            yield PostgresDatabase(db)
    else:
        if cloud:
            raise DatabaseConfigurationError('Vercel chưa được kết nối database. Kết nối Neon với project và redeploy để có DATABASE_URL.')
        db = sqlite3.connect(path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys = ON')
        try:
            with db:
                yield db
        finally:
            db.close()
