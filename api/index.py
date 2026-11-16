"""Vercel Python function: all account routes share the existing application API."""
from urllib.parse import parse_qs, urlencode, urlsplit
from server import Handler


class handler(Handler):
    def dispatch(self, method):
        url = urlsplit(self.path)
        query = parse_qs(url.query, keep_blank_values=True)
        endpoint = query.pop('_route', [None])[0]
        if endpoint is not None:
            self.path = '/api/' + endpoint.strip('/')
            if query:
                self.path += '?' + urlencode(query, doseq=True)
        return super().dispatch(method)
