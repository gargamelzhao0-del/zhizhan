import argparse
import statistics
import sys
from pathlib import Path
from .data import load
def main(argv=None):
    parser=argparse.ArgumentParser(description="Validate schema-1 Celsius samples")
    parser.add_argument("input",type=Path)
    args=parser.parse_args(argv)
    try:
        records=load(args.input)
        print(f"count={len(records)} mean_C={statistics.fmean(x.value_c for x in records):.3f}")
        return 0
    except (OSError,ValueError) as e:
        print(str(e),file=sys.stderr);return 2
if __name__=="__main__":raise SystemExit(main())
