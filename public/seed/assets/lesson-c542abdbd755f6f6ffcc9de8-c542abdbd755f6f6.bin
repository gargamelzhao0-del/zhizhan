"""P05 actual training -> ONNX -> dynamic INT8 -> ONNX Runtime -> independent session test.
Data are synthetic two-moon points, NOT device recordings or evidence for real anomaly detection accuracy.
"""
import argparse,csv,hashlib,json,platform,time
from pathlib import Path
import numpy as np
import sklearn,onnx,onnxruntime as ort
from sklearn.datasets import make_moons
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score,f1_score
from onnx import helper as H,numpy_helper as NH,TensorProto as T
from onnxruntime.quantization import quantize_dynamic,QuantType
from onnxruntime.quantization.shape_inference import quant_pre_process
def run(output):
    output.mkdir(parents=True,exist_ok=True)
    groups=[]
    with (output/'data.csv').open('w',newline='',encoding='utf-8') as stream:
        w=csv.writer(stream);w.writerow(['session','split','x0','x1','label'])
        for i in range(6):
            x,y=make_moons(n_samples=120,noise=.12,random_state=120+i)
            split=['train','train','validation','validation','test','test'][i]
            groups.append((x,y))
            w.writerows((i,split,float(a),float(b),int(c)) for (a,b),c in zip(x,y))
    train_x=np.vstack([g[0] for g in groups[:2]]);train_y=np.hstack([g[1] for g in groups[:2]])
    valid_x=np.vstack([g[0] for g in groups[2:4]]);valid_y=np.hstack([g[1] for g in groups[2:4]])
    test_x=np.vstack([g[0] for g in groups[4:]]).astype(np.float32);test_y=np.hstack([g[1] for g in groups[4:]])
    scaler=StandardScaler().fit(train_x)
    baseline=LogisticRegression(random_state=7).fit(scaler.transform(train_x),train_y)
    model=MLPClassifier(hidden_layer_sizes=(16,),activation='relu',solver='lbfgs',max_iter=2000,random_state=7).fit(scaler.transform(train_x),train_y)
    arrays={'mean':scaler.mean_,'scale':scaler.scale_,'w0':model.coefs_[0],'b0':model.intercepts_[0],'w1':model.coefs_[1],'b1':model.intercepts_[1]}
    initializers=[NH.from_array(np.asarray(v,dtype=np.float32),k) for k,v in arrays.items()]
    nodes=[H.make_node('Sub',['input','mean'],['centered']),H.make_node('Div',['centered','scale'],['scaled']),H.make_node('MatMul',['scaled','w0'],['mm0']),H.make_node('Add',['mm0','b0'],['sum0']),H.make_node('Relu',['sum0'],['hidden']),H.make_node('MatMul',['hidden','w1'],['mm1']),H.make_node('Add',['mm1','b1'],['logit']),H.make_node('Sigmoid',['logit'],['score'])]
    graph=H.make_graph(nodes,'course_mlp',[H.make_tensor_value_info('input',T.FLOAT,['N',2])],[H.make_tensor_value_info('score',T.FLOAT,['N',1])],initializer=initializers)
    exported=H.make_model(graph,opset_imports=[H.make_opsetid('',13)],producer_name='embedded-course');exported.ir_version=10
    onnx.checker.check_model(exported);onnx.save(exported,output/'model.onnx')
    quant_pre_process(str(output/'model.onnx'),str(output/'model-ready.onnx'),skip_optimization=True)
    quantize_dynamic(str(output/'model-ready.onnx'),str(output/'model-int8.onnx'),weight_type=QuantType.QInt8,op_types_to_quantize=['MatMul'])
    options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1
    float_rt=ort.InferenceSession(str(output/'model.onnx'),options,providers=['CPUExecutionProvider'])
    int_rt=ort.InferenceSession(str(output/'model-int8.onnx'),options,providers=['CPUExecutionProvider'])
    # Release policy is decided on validation sessions BEFORE examining independent test sessions.
    valid32=valid_x.astype(np.float32)
    def scores(runtime,x):
        # Deployment contract is batch=1; dynamic quantization may change with batch range.
        return np.array([runtime.run(['score'],{'input':row[None,:]})[0][0,0] for row in x])
    vf=scores(float_rt,valid32)
    vq=scores(int_rt,valid32)
    validation_error=float(np.max(np.abs(vq-vf)))
    validation_drop=accuracy_score(valid_y,vf>=.5)-accuracy_score(valid_y,vq>=.5)
    release='int8' if validation_error<=.05 and validation_drop<=.01 else 'float'
    ref=model.predict_proba(scaler.transform(test_x))[:,1]
    fp=scores(float_rt,test_x)
    qp=scores(int_rt,test_x)
    assert float(np.max(np.abs(fp-ref)))<1e-5
    assert np.all(np.isfinite(qp)) and np.all((qp>=0)&(qp<=1))
    for _ in range(20):int_rt.run(['score'],{'input':test_x[:1]})
    times=[]
    for _ in range(100):
        start=time.perf_counter_ns();int_rt.run(['score'],{'input':test_x[:1]});times.append((time.perf_counter_ns()-start)/1000)
    report={'dataset':'synthetic make_moons; seed=120+session; dimensionless features','split':{'train':[0,1],'validation':[2,3],'test':[4,5]},'preprocessing':'fit only on train; embedded in ONNX','baseline_validation_accuracy':accuracy_score(valid_y,baseline.predict(scaler.transform(valid_x))),'mlp_validation_accuracy':accuracy_score(valid_y,model.predict(scaler.transform(valid_x))),'float_test_accuracy':accuracy_score(test_y,fp>=.5),'int8_test_accuracy':accuracy_score(test_y,qp>=.5),'int8_test_f1':f1_score(test_y,qp>=.5),'float_reference_max_error':float(np.max(np.abs(fp-ref))),'quantization_max_score_error':float(np.max(np.abs(qp-fp))),'host_batch1_us':{'p50':float(np.percentile(times,50)),'p95':float(np.percentile(times,95)),'max':max(times),'scope':'warm CPUExecutionProvider, includes Python call; not target-board WCET'},'model_bytes':{p.name:p.stat().st_size for p in [output/'model.onnx',output/'model-int8.onnx']},'versions':{'python':platform.python_version(),'numpy':np.__version__,'sklearn':sklearn.__version__,'onnx':onnx.__version__,'onnxruntime':ort.__version__},'target_board':{'latency':None,'peak_ram':None,'power':None,'status':'requires separate measurement'}}
    report['model_sha256']=hashlib.sha256((output/'model-int8.onnx').read_bytes()).hexdigest()
    candidate=release
    qualification_error=float(np.max(np.abs(qp-fp)))
    if candidate=='int8' and (qualification_error>.05 or accuracy_score(test_y,fp>=.5)-accuracy_score(test_y,qp>=.5)>.01):release='float'
    report['release_policy']={'validation_candidate':candidate,'chosen':release,'validation_max_error':validation_error,'validation_accuracy_drop':validation_drop,'independent_test_score_error':qualification_error,'allowed_score_error':.05,'allowed_accuracy_drop':.01,'decision_basis':'candidate selected on validation; independent qualification can reject int8, no retuning; batch=1; no speedup/size benefit assumed'}
    (output/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False));print('P05 train/export/runtime/quantization/group-isolated-test: RESULT: PASS')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=Path(__file__).parent/'results/p05');run(p.parse_args().output)
