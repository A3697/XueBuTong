"""Authenticate the unchanged native WebSocket through its Electron host.

The original 1.3 page sends no token and its server accepts WebSocket tokens
only in the query string. The dedicated Electron session supplies X-Token for
its exact local backend. Forward that already authenticated header as the
server's supported query argument; never accept a missing/incorrect token.
"""
import hmac
from urllib.parse import parse_qs, urlencode
from websocket_lifecycle import WebSocketLifecycle


class NativeTokenTransport(WebSocketLifecycle):
    def __init__(self, application, token):
        if not isinstance(token, str) or not token:
            raise ValueError('native transport requires a nonempty local token')
        super().__init__(application)
        self.token = token

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'websocket' and scope.get('path') == '/ws':
            query = scope.get('query_string', b'')
            arguments = parse_qs(query.decode('ascii', errors='replace'), keep_blank_values=True)
            values = [value for name, value in scope.get('headers', []) if name.lower() == b'x-token']
            if ('t' not in arguments and len(values) == 1
                    and hmac.compare_digest(values[0], self.token.encode('utf-8'))):
                scope = dict(scope)
                scope['query_string'] = query + (b'&' if query else b'') + urlencode({'t': self.token}).encode('ascii')
            await self._websocket(scope, receive, send)
            return
        await self.application(scope, receive, send)

