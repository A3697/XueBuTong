"""End local event subscriptions on disconnect, in both backend modes."""
import asyncio


class WebSocketLifecycle:
    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'websocket' and scope.get('path') == '/ws':
            await self._websocket(scope, receive, send)
        else:
            await self.application(scope, receive, send)

    async def _websocket(self, scope, receive, send):
        # The upstream stream waits on EventHub, not on receive(). A disconnected
        # panel must release that subscription even when there are no new events.
        messages = asyncio.Queue(maxsize=32)

        async def read_messages():
            while True:
                message = await receive()
                if message['type'] == 'websocket.disconnect':
                    return
                await messages.put(message)

        application = asyncio.create_task(self.application(scope, messages.get, send))
        reader = asyncio.create_task(read_messages())
        try:
            done, _ = await asyncio.wait((application, reader), return_when=asyncio.FIRST_COMPLETED)
            if application in done:
                await application  # Preserve real application errors.
            else:
                await reader
        finally:
            for task in (application, reader):
                if not task.done():
                    task.cancel()
            await asyncio.gather(application, reader, return_exceptions=True)
