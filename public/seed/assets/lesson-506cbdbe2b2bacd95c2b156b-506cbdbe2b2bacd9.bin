"""Real ONNX Runtime batch=1 benchmark. Measures this host, not MCU WCET/power.
Example from repository root:
python b13/labs/benchmark_ort.py --model projects/results/p05/model-int8.onnx \
  --reference projects/results/p05/model.onnx --data projects/results/p05/data.csv \
  --output verify/quality-2026-10-13/ort.json
Dependencies: projects/requirements.txt. CSV contract: split,x0,x1 columns.
"""
import argparse, csv, hashlib, json, platform, time
from pathlib import Path
import numpy as np
import onnxruntime as ort

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):
    if args.runs<100 or args.warmup<1:raise ValueError('runs>=100 and warmup>=1 required')
    if args.provider not in ort.get_available_providers():raise ValueError('requested provider unavailable')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.data.open(encoding='utf-8',newline='') as f:
        rows=[[float(r['x0']),float(r['x1'])] for r in csv.DictReader(f) if r['split']=='test']
    x=np.asarray(rows,dtype=np.float32)
    if x.ndim!=2 or x.shape[1]!=2 or not np.isfinite(x).all():raise ValueError('invalid/empty test data')
    def options(profile=False):
        o=ort.SessionOptions();o.intra_op_num_threads=1;o.inter_op_num_threads=1
        o.enable_profiling=profile;o.profile_file_prefix=str(args.output.with_suffix(''))
        return o
    start=time.perf_counter_ns()
    rt=ort.InferenceSession(str(args.model),options(),providers=[args.provider])
    creation_us=(time.perf_counter_ns()-start)/1000
    ref=ort.InferenceSession(str(args.reference),options(),providers=['CPUExecutionProvider'])
    for session in (rt,ref):
        if len(session.get_inputs())!=1 or session.get_inputs()[0].name!='input':
            raise ValueError('this exercise expects one float input named input')
    def infer(session,row):return session.run(None,{'input':row[None,:]})[0]
    start=time.perf_counter_ns();infer(rt,x[0]);cold_us=(time.perf_counter_ns()-start)/1000
    # All test rows, not one convenient tensor. Independent exported FP reference.
    error=0.0
    for row in x:
        actual,expected=infer(rt,row),infer(ref,row)
        if actual.shape!=expected.shape or not np.isfinite(actual).all():raise ValueError('invalid output')
        error=max(error,float(np.max(np.abs(actual-expected))))
    for i in range(args.warmup):infer(rt,x[i%len(x)])
    elapsed=[]
    for i in range(args.runs):
        row=x[i%len(x)];start=time.perf_counter_ns();infer(rt,row)
        elapsed.append((time.perf_counter_ns()-start)/1000)
    # Profile a separate session so tracing overhead is excluded from timings.
    profiled=ort.InferenceSession(str(args.model),options(True),providers=[args.provider])
    for row in x[:10]:infer(profiled,row)
    profile_path=Path(profiled.end_profiling())
    events=json.loads(profile_path.read_text(encoding='utf-8'))
    used=sorted({v.get('args',{}).get('provider') for v in events if v.get('args',{}).get('provider')})
    report={'scope':'real host batch=1; includes Python call, excludes file IO and external sensor preprocessing; not target WCET/power',
        'python':platform.python_version(),'platform':platform.platform(),'ort':ort.__version__,
        'model_sha256':digest(args.model),'reference_sha256':digest(args.reference),'data_sha256':digest(args.data),
        'rows':len(x),'warmup':args.warmup,'runs':args.runs,'threads':1,
        'requested_provider':args.provider,'session_providers':rt.get_providers(),'profile_node_providers':used,
        'session_creation_us':creation_us,'first_run_us':cold_us,
        'warm_us':dict(zip(['p50','p95','p99','max'],[float(v) for v in np.percentile(elapsed,[50,95,99,100])])),
        'max_abs_error':error,'allowed_abs_error':args.max_abs_error,'profile':profile_path.name,
        'output_check_passed':error<=args.max_abs_error,
        'target_board':{'latency':None,'memory':None,'power':None}}
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
    if error>args.max_abs_error:raise SystemExit('output tolerance exceeded; do not accept speed result')
    if args.require_provider_only and used!=[args.provider]:raise SystemExit('provider fallback or missing profile evidence')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ('model','reference','data','output'):p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--provider',default='CPUExecutionProvider')
    p.add_argument('--warmup',type=int,default=30);p.add_argument('--runs',type=int,default=300)
    p.add_argument('--max-abs-error',type=float,default=.05)
    p.add_argument('--require-provider-only',action='store_true')
    run(p.parse_args())
