import csv
import math
from dataclasses import dataclass
from pathlib import Path
@dataclass(frozen=True)
class Sample:
    session:str
    seq:int
    time_s:float
    value_c:float

def load(path:Path)->list[Sample]:
    records=[];last={}
    with path.open(encoding="utf-8",newline="") as stream:
        reader=csv.DictReader(stream)
        if reader.fieldnames!=["schema","session","seq","time_s","unit","value"]:
            raise ValueError("header: expected schema,session,seq,time_s,unit,value")
        for line,row in enumerate(reader,2):
            try:
                if None in row or any(value is None for value in row.values()):raise ValueError("column count")
                if row["schema"]!="1" or row["unit"]!="C" or not row["session"]:raise ValueError("schema/unit/session")
                seq=int(row["seq"]);t=float(row["time_s"]);v=float(row["value"])
                if seq<0 or t<0 or not math.isfinite(t) or not math.isfinite(v):raise ValueError("range/nonfinite")
                previous=last.get(row["session"])
                if previous is not None and (seq<=previous[0] or t<=previous[1]):raise ValueError("duplicate/order")
                last[row["session"]]=(seq,t)
                records.append(Sample(row["session"],seq,t,v))
            except (ValueError,TypeError,KeyError) as e:raise ValueError(f"line {line}: {e}") from e
    if not records:raise ValueError("empty data")
    return records
