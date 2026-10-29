import asyncio
import contextlib
import tempfile
import unittest
from pathlib import Path
from datatool.data import load
from datatool.cli import main
from datatool.pipeline import collect
HEADER="schema,session,seq,time_s,unit,value\n"
class DataTests(unittest.TestCase):
    def write(self,text):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        p=Path(temp.name)/"data.csv";p.write_text(text,encoding="utf-8");return p
    def test_normal(self):
        p=self.write(HEADER+"1,a,0,0,C,20\n1,a,1,0.1,C,30\n")
        self.assertEqual([x.value_c for x in load(p)],[20,30]);self.assertEqual(main([str(p)]),0)
    def test_invalid(self):
        for line in ("1,a,0,0,C,NaN\n","1,a,0,0,F,20\n","2,a,0,0,C,20\n","1,a,0,0,C,20,unexpected\n","1,a,0,0,C\n","1,a,0,0,C,20\n1,a,0,0.1,C,30\n"):
            with self.subTest(line=line),self.assertRaises(ValueError):load(self.write(HEADER+line))
    def test_empty_and_missing(self):
        with self.assertRaises(ValueError):load(self.write(HEADER))
        self.assertEqual(main(["file-that-does-not-exist.csv"]),2)
class CancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_cancel_closes_blocked_producer(self):
        class Port:
            closed=False
            async def read(self):return 1
            async def close(self):self.closed=True
        port=Port();queue=asyncio.Queue(maxsize=1)
        task=asyncio.create_task(collect(port,queue))
        await asyncio.sleep(0)
        self.assertEqual(queue.qsize(),1)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):await task
        self.assertTrue(port.closed)
if __name__=="__main__":unittest.main()
