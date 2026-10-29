/* Same B23ControlModel; mobile SVG coordinates follow the actual plot width. */
(() => {
  const panel=document.getElementById('thermalSimulator');if(!panel)return;
  const svg=document.getElementById('thermalPlot');let scheduled=false,lastWidth=0;
  function draw(){
    scheduled=false;
    try{
      const parameters={setpoint:+document.getElementById('simSetpoint').value,kp:+document.getElementById('simKp').value,ki:+document.getElementById('simKi').value,tau:+document.getElementById('simTau').value,antiWindup:document.getElementById('simAw').checked,scenario:document.getElementById('simScenario').value};
      for(const id of ['Setpoint','Kp','Ki','Tau'])document.getElementById('value'+id).textContent=document.getElementById('sim'+id).value;
      const current=window.B23ControlModel.simulate(parameters),comparison=window.B23ControlModel.simulate({...parameters,antiWindup:!parameters.antiWindup});
      const width=Math.max(240,Math.round(svg.clientWidth||panel.clientWidth-28)),left=42,right=width-10,height=355;
      lastWidth=width;svg.setAttribute('viewBox','0 0 '+width+' '+height);
      const high=Math.ceil((Math.max(...current.rows.flatMap(r=>[r.temperature_c,r.setpoint_c]),...comparison.rows.map(r=>r.temperature_c))+5)/10)*10;
      const x=t=>left+t/120*(right-left),temperature=v=>215-(v-10)/(high-10)*180,duty=v=>320-v*65;
      function path(rows,key,y){
        if(key==='setpoint_c'||key==='output'){let result='M'+left+','+y(rows[0][key]).toFixed(2);rows.forEach((row,i)=>{if(i&&row[key]!==rows[i-1][key])result+=' H'+x(row.t_s).toFixed(2)+' V'+y(row[key]).toFixed(2);});return result+' H'+right;}
        const stride=Math.max(1,Math.round(rows.length/Math.max(240,width)));
        return rows.filter((r,i)=>i%stride===0||i===rows.length-1).map((r,i)=>(i?'L':'M')+x(r.t_s).toFixed(2)+','+y(r[key]).toFixed(2)).join(' ');
      }
      let plot='<title>温度、设定温度、抗饱和对照和加热占空比</title><desc>同一阶热模型，120 秒；指标保持与本地原书一致。</desc>';
      for(let i=0;i<=4;i++){const value=10+(high-10)*i/4,yy=temperature(value);plot+='<line class="grid" x1="'+left+'" x2="'+right+'" y1="'+yy+'" y2="'+yy+'"/><text x="1" y="'+(yy+4)+'">'+value.toFixed(0)+'°C</text>';}
      for(const time of [0,30,60,90,120]){const xx=x(time);plot+='<line class="grid" x1="'+xx+'" x2="'+xx+'" y1="35" y2="320"/><text text-anchor="'+(time===120?'end':time===0?'start':'middle')+'" x="'+xx+'" y="343">'+time+'s</text>';}
      plot+='<path class="comparison" d="'+path(comparison.rows,'temperature_c',temperature)+'"/><path class="reference" d="'+path(current.rows,'setpoint_c',temperature)+'"/><path class="temperature" d="'+path(current.rows,'temperature_c',temperature)+'"/>';
      plot+='<line class="grid" x1="'+left+'" x2="'+right+'" y1="255" y2="255"/><line class="grid" x1="'+left+'" x2="'+right+'" y1="320" y2="320"/><text x="1" y="259">100%</text><text x="12" y="320">0%</text><path class="duty" d="'+path(current.rows,'output',duty)+'"/>';
      svg.innerHTML=plot;
      const m=current.metrics;document.getElementById('simError').textContent=m.final_error_c.toFixed(3)+' °C';document.getElementById('simIae').textContent=m.iae_c_s.toFixed(1)+' °C·s';document.getElementById('simIntegral').textContent=m.peak_integral.toFixed(3)+' duty';
      document.getElementById('simComparison').textContent='灰色虚线：'+(parameters.antiWindup?'关闭':'开启')+'抗饱和的温度';
      document.getElementById('simFault').textContent=m.fault_latched?'70 s 起故障锁存，加热输出为 0；重新选择场景即重新开始模型。':'无故障锁存；指标由当前 120 s 模型计算。';
    }catch(error){for(const id of ['simError','simIae','simIntegral'])document.getElementById(id).textContent='暂不可用';document.getElementById('simFault').textContent='仿真未能完成，请重新打开本页。';console.error(error);}
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
  panel.addEventListener('input',schedule);panel.addEventListener('change',schedule);
  new ResizeObserver(()=>{if(Math.abs(svg.clientWidth-lastWidth)>1)schedule();}).observe(panel);
  draw();
})();
