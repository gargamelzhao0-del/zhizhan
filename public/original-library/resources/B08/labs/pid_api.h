/* pid_api.h —— PID 控制器接口（跨平台共享的实现声明）。 */
#ifndef PID_API_H
#define PID_API_H

typedef struct { float kp, ki, kd, I, last_e; } pid_t;

int pid_step(pid_t *p, float sp, float y, float dt, int out_min, int out_max);

#endif /* PID_API_H */
