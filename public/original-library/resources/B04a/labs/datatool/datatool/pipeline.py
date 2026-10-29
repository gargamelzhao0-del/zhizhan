import asyncio
async def collect(port,queue:asyncio.Queue):
    """Bounded queue applies backpressure; cancellation always closes the port."""
    try:
        while True:
            item=await port.read()
            await queue.put(item)
    finally:
        await port.close()
