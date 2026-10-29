/* B23 synthetic model; output held for dt, exact first-order plant update. */
(function(root){
  'use strict';
  function simulate(options){
    var p=Object.assign({setpoint:45,kp:0.035,ki:0.0035,tau:20,antiWindup:true,scenario:'normal',dt:0.1,duration:120},options);
    if(![p.setpoint,p.kp,p.ki,p.tau,p.dt,p.duration].every(Number.isFinite)||p.tau<=0||p.dt<=0||p.duration<=0||p.kp<0||p.ki<0)throw new Error('Invalid model parameters');
    if(['normal','cooling','recovery','sensor-fault'].indexOf(p.scenario)<0)throw new Error('Unknown scenario');
    var steps=Math.round(p.duration/p.dt);
    if(steps<1||steps>1000000||Math.abs(steps*p.dt-p.duration)>1e-8)throw new Error('Invalid number of steps');
    var y=25,integral=0,fault=false,a=Math.exp(-p.dt/p.tau),rows=[];
    for(var n=0;n<=steps;n++){
      var t=n*p.dt,r=t<5?25:p.setpoint;
      if(p.scenario==='recovery'&&t>=5&&t<60)r=95;
      var ambient=p.scenario==='cooling'&&t>=60?20:25;
      fault=fault||(p.scenario==='sensor-fault'&&t>=70);
      var error=r-y,raw=0,u=0;
      if(!fault){
        var candidate=integral+p.ki*error*p.dt,proposal=p.kp*error+candidate;
        var pushing=(proposal>1&&error>0)||(proposal<0&&error<0);
        if(!(p.antiWindup&&pushing))integral=candidate;
        raw=p.kp*error+integral;u=Math.max(0,Math.min(1,raw));
      }
      rows.push({t_s:t,setpoint_c:r,temperature_c:y,output:u,integral:integral,raw:raw,fault:fault?1:0});
      if(n<steps)y=a*y+(1-a)*(ambient+60*u);
    }
    var iae=0,saturation=0,peak=0;
    rows.forEach(function(row,i){peak=Math.max(peak,Math.abs(row.integral));if(i<steps){iae+=Math.abs(row.setpoint_c-row.temperature_c)*p.dt;if(row.t_s>=5&&(row.output<=0||row.output>=1))saturation+=p.dt;}});
    return {rows:rows,metrics:{final_error_c:rows[steps].setpoint_c-y,iae_c_s:iae,peak_integral:peak,saturation_s:saturation,fault_latched:fault}};
  }
  if(typeof module==='object'&&module.exports)module.exports={simulate:simulate};
  else root.B23ControlModel={simulate:simulate};
})(typeof window==='object'?window:this);
