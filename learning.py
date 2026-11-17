"""Canonical mastery replay. Client eligibility flags are deliberately ignored."""
def mastery_from_history(rows):
    levels = {}
    modern = []
    for row in rows:
        key = str(row['question_id'])
        if row['learning_session_id'] is None:
            if row['is_correct']:
                levels[key] = 1
            else:
                levels.setdefault(key, 0)
        else:
            modern.append(row)
    seen = set()
    for row in sorted(modern, key=lambda r: (r['answered_at_ms'], r['event_id'], r['id'])):
        key = str(row['question_id'])
        session_key = (row['learning_session_id'], key)
        old = levels.get(key, 0)
        levels[key] = min(3, old + int(session_key not in seen)) if row['is_correct'] else max(0, old - 2)
        seen.add(session_key)
    return levels
