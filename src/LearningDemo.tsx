import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ArrowRight, Sparkles } from "lucide-react";
import { reducedMotion } from "./motion";

export interface DemoSpec {
  title: string;
  badge?: string;
  labels: readonly string[];
  text: readonly string[];
}

export const demos: Record<string, DemoSpec> = {
  archive: {
    title: "一个归档怎样安全离开 SD",
    badge: "可靠传输事务",
    labels: ["封存", "开始", "传片", "提交", "删除"],
    text: [
      "writer 封存为 ready。现在本地持有待补传副本，网络失败不应删除它。",
      "begin 协商能力并取得恢复偏移。请求 ID 用于匹配本次事务。",
      "发送归档片段并等待确认；ACK 丢失时按约定重试，不能重复追加已有数据。",
      "commit 请求交给对端做完整性确认。只有匹配本段和连接代次的成功 ACK 才构成提交证据。",
      "提交成功后还要满足本地清理条件。删除失败则保留文件，后续通过幂等流程重试，不冒充已清理。",
    ],
  },
  session: {
    title: "断网后，哪些身份变化",
    badge: "会话与代次",
    labels: ["在线会议", "断网", "恢复申请", "继续同场"],
    text: [
      "示意：逻辑会话 S，开启请求 R1，连接代次 E1。音频记录属于 S。",
      "原模式仍存续，设备保存离线音频。网络连接中断不等于用户结束这场会议。",
      "连接进入 E2，恢复使用新请求 R2，仍提交原 audio_session_id=S。旧 E1 的 ACK 不可完成 R2。",
      "归档和实时流以会话及采集边界关联。若此前已主动停止或八小时上限退出，则重新开启要按新会话处理。",
    ],
  },
  lease: {
    title: "缓冲何时可以再次使用",
    badge: "零拷贝生命周期",
    labels: ["空闲", "写入", "交付", "消费者使用", "归还"],
    text: [
      "缓冲槽空闲，生产者可以取得写入权。",
      "生产者写完整数据及必要元信息，此时消费者不能把半帧当作完整帧。",
      "通过队列或发布语义交付。转移的是使用责任，指针值相同不代表双方都能修改。",
      "消费者、DMA 或补传重试仍可能访问数据。生产者不得提前覆盖。具体归还条件由路径契约决定。",
      "确认消费完成或取消后真正退出，再归还槽位。超时本身不是消费者已停止的证明。",
    ],
  },
  ownership: {
    title: "看见所有权的转移",
    badge: "RAII 与移动语义",
    labels: ["创建", "借用", "移动", "释放"],
    text: [
      "A 创建并拥有资源。资源只能由一个 unique_ptr 拥有。",
      "view 借用同一资源，不负责释放，也不延长生命周期。",
      "所有权从 A 转移给 B；A 变空。资源本身没有移动，view 仍有效。",
      "B 离开作用域，资源被释放。view 已悬空，不能继续访问。",
    ],
  },
  tcp: {
    title: "一次接收，不等于一条消息",
    badge: "流式协议拆包",
    labels: ["等待", "收到 2 字节", "再收 5 字节", "再收 3 字节"],
    text: [
      "协议：4 字节大端长度 + UTF-8 正文。消息“你好”编码后是 6 字节。",
      "只收到了长度头的前 2 字节。还不能解释长度，更不能解析正文。",
      "长度头齐了，知道正文要 6 字节；但目前只到了 3 字节，仍需等待。",
      "收齐 4 字节头 + 6 字节正文，这才向上层交付一条完整消息。",
    ],
  },
  boot: {
    title: "从上电到应用可服务",
    badge: "Linux 启动链路",
    labels: ["ROM", "Bootloader", "Kernel", "rootfs", "init", "App"],
    text: [
      "芯片启动代码按平台规则寻找下一阶段，先检查供电、启动介质和串口。",
      "加载内核与设备树，准备启动参数。看见引导输出不代表 Linux 已运行。",
      "初始化调度、内存与驱动。驱动内建或模块加载时机必须匹配启动依赖。",
      "挂载 rootfs；核对 root 参数、文件系统支持以及存储驱动。",
      "执行初始化程序，准备用户环境。动态解释器、权限与配置都可能阻止启动。",
      "服务启动后仍要验证功能、停止、重启和失败恢复，开机画面不等于交付验收。",
    ],
  },
  queue: {
    title: "有界队列如何保护数据",
    badge: "并发与背压",
    labels: ["空队列", "写入", "写满", "背压", "消费", "关闭排空"],
    text: [
      "队列最多容纳 4 条。内存边界在开始前就确定。",
      "生产者提交 2 条记录，成功提交后才转移处理责任。",
      "4 个槽位都已使用，下一次写入不能直接覆盖旧数据。",
      "本例选择阻塞等待：生产者暂停，等待空位或关闭通知，不把等待算成丢弃。",
      "消费者取走 1 条并通知可写。等待者重新检查条件，不能假定被唤醒就一定有空位。",
      "关闭后拒绝新记录，已有记录处理完再退出。join 完成之后才释放共享队列。",
    ],
  },
  "freertos-context-switch": {
    title: "FreeRTOS 任务上下文切换全过程：SysTick → PendSV 压栈 → 切 TCB → 恢复现场",
    badge: "RTOS 内核核心 · 栈帧与寄存器搬运",
    labels: [
      "Task A 运行中",
      "SysTick 挂起 PendSV",
      "保存 R4-R11 到栈 A",
      "pxCurrentTCB 切向 B",
      "从栈 B 弹出恢复运行",
    ],
    text: [
      "Task A 在 Thread 模式运行，CPU 的进程栈指针 PSP 指向 Task A 的私有栈顶，全局变量 pxCurrentTCB 指向 TCB_A。",
      "SysTick 定时中断触发（或调用 taskYIELD）：内核发现更高优先级或同优先级时间片到期的 Task B 就绪，向 SCB->ICSR 写 PENDSVSET 挂起最低优先级的 PendSV 异常。",
      "进入 PendSV_Handler：Cortex-M 硬件已自动将 8 个寄存器 (xPSR, PC, LR, R12, R3..R0) 压入栈 A；汇编代码再执行 STMDB r0!, {r4-r11} 手动把剩余 8 个寄存器压入栈 A，并将新栈顶写回 TCB_A->pxTopOfStack。",
      "调用 C 函数 vTaskSwitchContext()：从就绪链表找出最高优先级任务 Task B，将全局指针 pxCurrentTCB 从 TCB_A 切换指向 TCB_B。",
      "读取 TCB_B->pxTopOfStack，执行 LDMIA r0!, {r4-r11} 从栈 B 弹出软件保存的 R4..R11，更新 PSP 指向栈 B，最后执行 bx lr (EXC_RETURN=0xFFFFFFFD)，硬件自动从栈 B 弹出 R0..R3/PC/xPSR，CPU 无缝从 Task B 上次暂停的那行代码继续运行！",
    ],
  },
  "clock-tree": {
    title: "STM32 时钟树倍频、分频与 Flash 等待周期",
    badge: "时钟与启动 · 动态信号流",
    labels: ["HSI 上电默认", "HSE 起振检测", "Flash 等待周期", "PLL×9 锁相", "切换 SYSCLK"],
    text: [
      "上电复位后 CPU 默认跑在内部 8 MHz RC 振荡器（HSI），此时外设时钟全部默认门控关闭（RCC_APBxENR=0）。",
      "置位 RCC_CR.HSEON 启动外部 8 MHz 晶振，循环检查 HSERDY 必须带超时计数；若晶振虚焊超时则安全回退 HSI。",
      "关键前置：切入 72 MHz 前必须先设 FLASH_ACR.LATENCY=2（2 个等待周期），否则高频下 CPU 取指跟不上 Flash 速度会直接触发 HardFault。",
      "配置 AHB÷1、APB2÷1、APB1÷2（36 MHz，但挂载其上的定时器硬件自动×2 仍为 72 MHz），启动 PLL×9 并等待 PLLRDY 锁定。",
      "写 RCC_CFGR.SW=PLL 并轮询 SWS 回读确认，SYSCLK 正式工作在 72 MHz；可通过 PA8 (MCO=PLL/2=36 MHz) 接示波器实测验证。",
    ],
  },
  "gpio-circuit": {
    title: "GPIO 推挽 / 开漏 / 上下拉内部电路与电流路径",
    badge: "引脚电气 · 晶体管桥",
    labels: ["浮空输入", "上拉输入", "推挽输出高", "推挽输出低", "开漏输出 (I²C)"],
    text: [
      "浮空输入（Floating）：上/下拉电阻均断开，引脚呈高阻态；外部悬空时极易耦合环境电磁噪声导致电平随机跳变。",
      "内部上拉输入（Pull-Up）：内部约 40 kΩ 弱上拉接通 VDD，按键未按下时引脚稳定读为 1，按键接地时电流经上拉流向 GND 读为 0。",
      "推挽输出高（Push-Pull High）：P-MOS 导通、N-MOS 截止，电流从 VDD 经 P-MOS 主动灌向外部负载，具备强高电平驱动能力。",
      "推挽输出低（Push-Pull Low）：P-MOS 截止、N-MOS 导通，外部电流经引脚被 N-MOS 吸入 GND（Sink），高低电平均由芯片主动驱动。",
      "开漏输出（Open-Drain）：P-MOS 永久关闭！写 1 时 N-MOS 截止呈高阻，靠外部上拉电阻拉高；写 0 时 N-MOS 导通拉低，支持多设备线与（如 I²C 总线）且绝不会发生推挽对顶短路。",
    ],
  },
  "nvic-tailchain": {
    title: "Cortex-M 中断硬件压栈、抢占与咬尾中断 (Tail-Chaining)",
    badge: "NVIC 实时响应 · 零软件开销",
    labels: ["主线程运行", "硬件自动压栈", "高优先级抢占", "咬尾切换", "异常返回出栈"],
    text: [
      "CPU 在 Thread 模式使用 MSP/PSP 运行主循环；外设触发 IRQ_Low（优先级 2）且 IRQ_High（优先级 1）随后到达。",
      "硬件自动把 8 个调用者保存寄存器（xPSR, PC, LR, R12, R3..R0）压入栈帧，同时并行从向量表取 ISR 入口地址（仅需 12 周期）。",
      "若高优先级 IRQ_High 在压栈阶段到达（Late-Arriving），NVIC 直接把取指目标切换为 IRQ_High_ISR，无需额外再压一次栈！",
      "IRQ_High 执行完毕退出（EXC_RETURN=0xFFFFFFF9）时，因 IRQ_Low 仍在挂起（Pending），硬件跳过先出栈再入栈的 24 周期，仅用 6 周期直接咬尾切入 IRQ_Low_ISR。",
      "所有挂起中断处理完毕后，硬件通过 EXC_RETURN 自动弹出 8 寄存器恢复现场，无缝回到被中断的指令继续执行。",
    ],
  },
  "dma-ring": {
    title: "DMA 环形缓冲双指针追逐与乒乓半满/全满中断",
    badge: "零 CPU 搬运 · 环形防丢数",
    labels: ["初始化就绪", "前半区搬运", "HT 半满乒乓", "TC 全满回绕", "边界与防覆盖"],
    text: [
      "配置 DMA 为 Circular（环形）模式，绑定 8 槽 SRAM 缓冲区；外设每产生一次数据请求，DMA 硬件直接搬运 1 字节并递减 NDTR，CPU 全程零参与。",
      "DMA 写指针（WR）依次填充槽位 0..3；此时 CPU 可休眠或执行控制算法，无需每字节进中断。",
      "写满前 4 槽（NDTR 减半）触发 HT（Half-Transfer 半传输）中断：DMA 继续往后半区 4..7 写入，CPU 同时安全读取前半区 0..3，构成无锁乒乓流水线。",
      "DMA 写满槽位 7 触发 TC（Transfer-Complete 全传输）中断并硬件自动回绕到槽位 0；CPU 紧接着消费后半区 4..7。",
      "工程铁律：CPU 消费耗时必须小于半区填满时间（T_consume < N/(2·f_sample)），否则 DMA 回绕追上读指针将发生静默覆盖（Overrun）。",
    ],
  },
  "serial-waveform": {
    title: "UART / I²C / SPI 帧波形与采样边沿对齐",
    badge: "数字通信 · 示波器时序",
    labels: ["总线空闲", "起始与同步", "中点过采样", "数据位与应答", "停止与恢复"],
    text: [
      "空闲态：UART TX 与 I²C SDA/SCL 均维持高电平（上拉或推挽高）；在发数前先确认总线未被挂死。",
      "起始条件：UART 拉低 1 bit 起始位触发接收端状态机；I²C 则在 SCL 高电平期间将 SDA 拉低构成 START 信号。",
      "采样对齐：UART 接收器以 16× 波特率时钟对起始位下降沿计数，精准定位到第 8 个采样脉冲（Bit 正中央），避开边沿振铃与RC上升延时。",
      "数据移位：UART 按 LSB First 依次采样 D0..D7；SPI 按 CPOL/CPHA 约定的时钟边沿移位；I²C 每发完 8 位由接收方在第 9 个时钟拉低 SDA 回复 ACK。",
      "停止与帧边界：UART 拉高至少 1 bit 停止位；若采样到停止位为低则报 Framing Error（波特率偏差过大或电磁干扰）。",
    ],
  },
  "rtos-scheduler": {
    title: "RTOS 抢占调度、优先级反转与互斥锁优先级继承",
    badge: "实时内核 · 甘特图时序推演",
    labels: ["低优持锁", "高优抢占阻塞", "中优插队反转", "优先级继承", "释放恢复"],
    text: [
      "低优先级任务 Task_L 先运行并获取共享硬件资源互斥锁 Mutex（例如 SPI Flash 锁）。",
      "高优先级紧急任务 Task_H 就绪并立即抢占 CPU，但在尝试获取同一把 Mutex 时被迫进入 Blocked（阻塞等待）状态。",
      "若无保护机制：中优先级 Task_M 此时就绪，因优先级高于 Task_L 而抢占 CPU 长时间运行，导致持锁的 Task_L 无法执行，间接卡死最高优先级的 Task_H（优先级反转事故）！",
      "启用 Mutex 优先级继承（Priority Inheritance）：当 Task_H 阻塞在 Task_L 持有的锁上时，内核临时将 Task_L 的优先级抬升至与 Task_H 相同，阻止 Task_M 插队。",
      "Task_L 以高优先级快速执行完临界区并释放 Mutex，立即恢复原优先级；Task_H 随即获得锁并在确定性时限内完成响应。",
    ],
  },
  "memory-layout": {
    title: "MCU 内存分区（Flash / SRAM）与 Reset_Handler 启动搬运",
    badge: "链接脚本 · 启动搬运动画",
    labels: ["编译链接分区", "上电硬件取栈", "搬运 .data 段", "清零 .bss 段", "进入 main 运行"],
    text: [
      "链接器按 .ld 脚本划分区域：代码 (.text)、常量 (.rodata) 和已初始化全局变量的初值镜像 (LMA) 存入掉电不丢的 Flash (0x0800_0000)。",
      "上电第一拍：Cortex-M 硬件自动从 0x0800_0000 读取初始主栈指针 MSP（指向 SRAM 顶），从 0x0800_0004 读取 Reset_Handler 入口地址。",
      "Reset_Handler 第一步：通过循环把已初始化全局变量的初值从 Flash (_sidata) 逐字拷贝到 SRAM 的运行地址 (_sdata ~ _edata)。",
      "Reset_Handler 第二步：把未初始化全局变量区 (.bss: _sbss ~ _ebss) 全部写 0；只有完成这两步，C 语言全局变量的初始值才符合标准约定！",
      "正式调用 main()：局部变量与函数调用帧从栈顶向下增长（MSP↓），动态分配（若启用）从堆底向上增长（Heap↑），必须严防栈向下撞穿 .bss/.data。",
    ],
  },
  "bit-ops": {
    title: "寄存器位域掩码（读-改-写）与 BSRR 原子置位/清零防竞态",
    badge: "寄存器编程 · 硬件位流水线",
    labels: ["原始寄存器", "构造清除掩码", "按位与清零", "按位或写入", "BSRR 原子写"],
    text: [
      "目标：修改 8 位控制寄存器的 Bit[4:2]（3 位字段）为二进制 101 (0x5)，同时绝对不能破坏其余位的当前硬件状态。",
      "第一步：用位移和按位取反构造掩码 ~(0x7u << 2) = 1110_0011b；目标位域为 0，其余保护位全为 1。",
      "第二步（Clear）：执行 tmp = REG & ~(0x7u << 2)，将 Bit[4:2] 干净清零，其余位原样保留（切勿直接写 REG |= (0x5u<<2)，否则原有 1 位无法变 0）。",
      "第三步（Set）：执行 REG = tmp | ((0x5u & 0x7u) << 2)，将新值精准填入 Bit[4:2] 并写回 volatile 寄存器地址。",
      "进阶防竞态：若中断 ISR 在 LDR 读出之后、STR 写回之前修改了同一寄存器的其他引脚，普通读-改-写会覆盖 ISR 的修改；改用 GPIOx_BSRR 单条 STR 指令原子置位/清零则绝无竞态。",
    ],
  },
  "data-endian": {
    title: "数据在 SRAM 中的真实字节排布：小端序与结构体对齐",
    badge: "内存模型 · 字节透视动画",
    labels: ["32位整数声明", "小端序低址低位", "结构体自然对齐", "重排消除空洞"],
    text: [
      "声明 uint32_t val = 0x12345678：高字节 MSB 是 0x12，最低有效字节 LSB 是 0x78，占用连续 4 个字节。",
      "Cortex-M / x86 / RISC-V 默认采用小端序（Little-Endian）：最低字节 0x78 存放在最低地址 +0x00，高字节 0x12 存放在 +0x03；网络大端协议收发时必须转换字节序。",
      "结构体对齐规则：struct { uint8_t a; uint32_t b; uint8_t c; } 中，4 字节的 b 必须对齐到 4 的整数倍地址，编译器会在 a 后自动插入 3 字节 Padding，总大小变成 12 字节！",
      "内存优化习惯：按成员对齐宽度从大到小排列 struct { uint32_t b; uint8_t a; uint8_t c; }，尾部仅补 2 字节对齐，总大小立减至 8 字节，且无需牺牲对齐访问性能。",
    ],
  },
  "adc-pid-loop": {
    title: "从物理传感器采样、数字滤波到闭环控制输出",
    badge: "信号与控制 · 闭环信号流",
    labels: ["定时器触发采样", "ADC 量化校准", "移动平均/RC滤波", "PI 误差计算", "限幅与安全输出"],
    text: [
      "禁止用延时函数凑采样周期！由硬件定时器 TRGO 严格按固定周期 Ts 触发 ADC 转换，消除调度抖动对微分/积分项的污染。",
      "ADC 将模拟电压量化为 12 位原始码（0..4095），先检查断线/短路越界阈值，再结合参考电压与标定系数换算为带物理单位的测量值 y(k)。",
      "原始信号叠加有电源纹波与尖峰毛刺：经一阶数字低通滤波 y_f(k) = α·y(k) + (1-α)·y_f(k-1) 平滑高频噪声，同时权衡相位滞后。",
      "计算设定值与反馈值误差 e(k) = r - y_f(k)，由比例项 Kp·e(k) 提供即时响应，积分项 Ki·∑e·Ts 消除稳态静差。",
      "输出保护：当执行器（PWM 占空比 0~100%）达到饱和边界时立即冻结同向积分（Anti-Windup），若触发传感器故障锁存则强制输出安全态 0%。",
    ],
  },
  "can-arbitration": {
    title: "CAN 总线非破坏性逐位仲裁与差分显性/隐性电平",
    badge: "工业现场总线 · 多主无损仲裁",
    labels: ["双绞线差分空闲", "多节点同步发 SOF", "逐位对比 ID", "隐性节点无损退避", "CRC 与 ACK 应答"],
    text: [
      "物理层采用 CAN_H 与 CAN_L 双绞差分线，两端各跨接 120 Ω 终端电阻消除反射；空闲时两线均为 2.5V（压差 0V，代表隐性位 1）。",
      "节点 A (ID=0x120) 与节点 B (ID=0x125) 同时监测到总线空闲，同时驱动 CAN_H=3.5V、CAN_L=1.5V（压差 2V，显性位 0）发送帧起始 SOF。",
      "从最高位 MSB 开始逐位发送 11 位标识符，同时硬件回读总线实际电平：前 8 位两节点相同（00100100），共同推进无冲突。",
      "第 9 位（Bit 2）：节点 A 发显性 0，节点 B 发隐性 1；总线呈显性 0（线与逻辑）。节点 B 回读发现总线(0)≠自身发送(1)，立即停发转为接收态，节点 A 零延时继续发完该帧！",
      "节点 A 发送数据段与 15 位硬件 CRC；总线上所有正常接收节点在 ACK 槽主动拉出 1 bit 显性 0，向发送方确认物理帧已被至少一个节点完整接收。",
    ],
  },
  "power-modes": {
    title: "MCU 低功耗模式（Run / Sleep / Stop / Standby）功耗谱与唤醒延时",
    badge: "低功耗架构 · 能量与电源域门控",
    labels: ["Run 全速运行", "Sleep 停核保外设", "Stop 关锁相环保RAM", "Standby 仅留RTC", "平均功耗与续航"],
    text: [
      "Run 模式（72 MHz）：CPU 内核、PLL 与总线外设全开，电流约 24 mA；若仅靠睡眠死循环 delay() 等待事件，220 mAh 纽扣电池不到 9 小时即耗尽。",
      "Sleep 模式（WFI/WFE）：仅关闭 Cortex-M 内核时钟，DMA 与串口/定时器照常工作，电流降至 ~4.5 mA，任意中断可在 ~1.5 µs 内零上下文丢失唤醒。",
      "Stop 深度睡眠：关闭 PLL、HSI 与 HSE 高速晶振，仅保留 LDO 低功耗供电维持 SRAM 变量与寄存器不丢失；电流骤降至 ~14 µA，由 EXTI/RTC 在 ~12 µs 内唤醒（注意唤醒后需重配 PLL）！",
      "Standby 待机模式：主电压域彻底断电，SRAM 与普通寄存器清零（仅保留备份域 BKP 与 RTC/IWUP），静态电流仅 ~1.8 µA；唤醒等价于芯片硬件复位。",
      "工程能量定律：平均电流 I_avg = (I_run·T_run + I_stop·T_stop) / T_period。把单次采样发包压缩到 5 ms 内完成并立即进 Stop（每秒 1 次），平均电流仅 134 µA，续航从 9 小时跃升至 68 天！",
    ],
  },
  "pcb-return-path": {
    title: "PCB 高速信号回流路径、参考平面割裂与去耦电容最短环路",
    badge: "硬件与 SI/EMC · 电流环路定律",
    labels: ["低频最小电阻路径", "高频最小电感回流", "跨分割地弹灾难", "0.1µF 去耦最短环", "过孔换层伴随地孔"],
    text: [
      "直流与低频信号（< 10 kHz）的返回电流在 GND 平面上散开，优先走铜皮电阻最小（R 最小）的直线捷径回到源端。",
      "高速数字边沿（tr < 2 ns，等效百 MHz 频谱）：受交变磁场互感支配，返回电流紧紧贴在信号走线正下方的 GND 参考平面流动，以使环路面积 A 最小（感抗 ωL 最小）！",
      "致命忌讳：若信号线下方的 GND 平面被长槽割裂（如模拟/数字地乱割槽），镜像回流被迫绕行大圈，环路面积暴增数十倍，形成强力环形发射天线并诱发严重串扰与地弹。",
      "电源去耦铁律：芯片引脚瞬间翻转（高 di/dt）需就近取电；0.1 µF 陶瓷电容必须紧贴 IC 电源/地引脚（环路 < 2 mm），若走细长引线则寄生电感 L_trace 会让去耦电容高频完全失效。",
      "高速信号换层时，返回电流也必须从参考层切换；必须在信号过孔旁紧挨着打 1~2 个伴随地过孔（Stitching Via），为回流提供低感抗垂直通道。",
    ],
  },
  "secure-boot": {
    title: "硬件信任根（RoT）、Secure Boot 逐级验签与双区 A/B 防回滚 OTA",
    badge: "嵌入式安全 · 固件全生命周期",
    labels: ["OTP 硬件信任根", "BootROM 验签引导", "Slot B 镜像验签", "防回滚单调计数器", "试运行自检与回退"],
    text: [
      "产线烧录阶段：将厂商公钥的 SHA-256 哈希写入芯片一次性可编程熔丝（OTP / eFuse）并锁定写保护，任何软件均无法篡改该信任锚点。",
      "上电第一拍：固化在芯片掩膜 ROM 中的 BootROM 用 OTP 公钥哈希校验一级 Bootloader 的 ECDSA/RSA 数字签名，验签失败直接拒绝执行并进入安全告警态。",
      "OTA 下载新固件写入非活动分区 Slot B 后，Bootloader 先算 Slot B 镜像 SHA-256 并用公钥验签，确保固件既未在传输中损坏、也绝非攻击者伪造。",
      "防降级攻击（Anti-Rollback）：比较新固件头部的安全版本号 security_version 与芯片 OTP 单调递增计数器；严禁刷入存在已知漏洞的旧版合法签名固件。",
      "断电安全切换：新固件首次启动标记为 pending_verify（试运行态）；只有 App 启动后完成外设与联网自检并显式调用 confirm_image_ok() 才正式提交，否则看门狗复位后自动回退 Slot A！",
    ],
  },
  "linux-dtree": {
    title: "Linux 设备树（Device Tree）compatible 匹配、ioremap 与驱动 probe 绑定",
    badge: "Linux 内核驱动 · 板级与驱动解耦",
    labels: ["编写 .dts 硬件节点", "DTC 编译为 .dtb", "compatible 匹配", "probe 资源映射", "注册字符/子系统设备"],
    text: [
      "在板级设备树 (.dts) 中声明外设节点的物理地址 reg = <0x40013000 0x400>、中断号 interrupts、引脚复用 pinctrl 以及身份标识 compatible = \"vendor,fast-adc\"。",
      "构建时由 dtc 编译器将文本 .dts 编译为二进制 .dtb，由 U-Boot 在启动内核时通过寄存器传参交给 Linux 内核展开为 device_node 树。",
      "内核 platform 总线对比设备节点的 compatible 字符串与已注册 platform_driver 的 of_match_table 表，一旦匹配成功即触发驱动绑定。",
      "内核自动调用驱动的 probe(pdev) 函数：驱动通过 devm_platform_ioremap_resource() 将物理寄存器地址映射为内核虚拟地址，严禁在 Linux 下直接解引用物理地址！",
      "完成中断申请（devm_request_threaded_irq）后向 IIO / Input / 字符设备子系统注册句柄，用户态即可通过 /dev/* 或 /sys/bus/* 安全访问硬件。",
    ],
  },
  "cache-dma": {
    title: "Cortex-M7 / SoC：DMA 与 CPU L1 D-Cache 一致性（Clean / Invalidate）机制",
    badge: "体系结构 · 缓存与物理内存同步",
    labels: ["CPU 写命中 Cache", "未 Clean 直接发 DMA", "发送前 Clean 刷回", "DMA 接收写 SRAM", "接收后 Invalidate"],
    text: [
      "在带数据缓存（D-Cache）的 Cortex-M7 或 Linux SoC 上，CPU 往发送缓冲区 tx_buf 写入新帧时，数据仅停留在 L1 D-Cache 的 Dirty 行中，物理 SRAM 仍是旧数据。",
      "典型事故：若此时直接启动 DMA 发送，由于 DMA 控制器绕过 CPU Cache 直接从物理 SRAM 搬运，发出去的将是全 0 或上次残留的脏数据！",
      "正确发送纪律（TX Clean）：启动 DMA 发送前必须调用 SCB_CleanDCache_by_Addr(tx_buf, len)，强制把 Cache 中的脏行写回（Write-Back）到物理 SRAM。",
      "DMA 接收方向（RX）：外设数据由 DMA 直接写入物理 SRAM 的 rx_buf，但 CPU 的 D-Cache 可能仍缓存着该地址此前的旧副本。",
      "正确接收纪律（RX Invalidate）：收到 DMA 完成中断后、CPU 读取 rx_buf 前，必须调用 SCB_InvalidateDCache_by_Addr(rx_buf, len) 作废缓存行（缓冲区须按 32 字节 Cache-Line 对齐）！",
    ],
  },
  "tinyml-quant": {
    title: "端侧 AI：FP32 → INT8 对称量化、CMSIS-NN 加速与静态 tensor_arena 规划",
    badge: "TinyML · 算力与内存压缩",
    labels: ["FP32 原始模型超限", "校准与 INT8 量化", "体积缩减 75%", "SIMD SMLAD 4路乘加", "静态 Arena 零分配"],
    text: [
      "PC 端训练的 FP32 模型每个权重占 4 字节：3.2 万参数即占 128 KB Flash，且大量浮点乘加在无双精度 FPU 的 MCU 上推理耗时长达数百毫秒。",
      "使用代表性传感器数据集统计各层激活值分布，按线性映射 q = clamp(round(r / Scale) + ZeroPoint, -128, 127) 将权重与激活全部量化为 8 位整数。",
      "量化收益立竿见影：模型权重体积直接缩减 4 倍（128 KB → 32 KB），轻松塞进 64 KB Flash 的低成本 MCU，且精度损失通常控制在 < 1%。",
      "算子硬件加速：Cortex-M4/M7/M33 利用 DSP 指令（如 __SMLAD）将 4 个 INT8 权重打包进 32 位寄存器，单周期并行完成多次乘加，推理速度提升 3~6 倍。",
      "严禁推理期 malloc！在 SRAM 中预分配一块静态数组 uint8_t tensor_arena[16384]，由解释器在编译期静态规划各层输入/输出张量的乒乓复用偏移。",
    ],
  },
  "motor-pwm": {
    title: "三相逆变桥互补 PWM、硬件死区插入（Dead-Time）与低端电流采样窗",
    badge: "电机与功率控制 · 防炸管时序",
    labels: ["上下桥臂互补拓扑", "MOS 关断延迟直通风险", "硬件 DTG 死区插入", "PWM 中心对齐模式", "TIM 触发 ADC 采样"],
    text: [
      "半桥电路由上桥臂（High-Side）与下桥臂（Low-Side）两颗功率 MOSFET 串联在母线电压 V_BUS 与 GND 之间，由高级定时器 TIM1_CH1 与 CH1N 互补驱动。",
      "物理器件陷阱：MOSFET 关断时间（t_off）往往慢于开通时间（t_on）；若理想反相切换，切换瞬间上下管会同时导通，造成母线对地直接短路（Shoot-Through 直通炸管）！",
      "硬件死区保护（BDTR.DTG）：定时器在关断一管后、开通另一管前强制插入一段上下管全关的安全死区（如 500 ns），并在刹车引脚 BKIN 触发过流时硬件级纳秒关断。",
      "采用中心对齐（Center-Aligned）三角波计数模式生成对称 PWM，有效降低电流谐波纹波，并为电流采样创造稳定的对称窗口。",
      "采样同步：下管导通期间电流流经下桥臂采样电阻 R_shunt；必须利用 TIM1_CCR4 在下管导通正中央（避开开关振铃）硬件触发 ADC 注入通道采样！",
    ],
  },
  "fsm-watchdog": {
    title: "工业高可靠状态机（正常 / 降级 / 故障锁存）与多任务看门狗喂狗契约",
    badge: "高可靠架构 · 故障安全状态迁移",
    labels: ["上电自检 INIT", "NORMAL 闭环运行", "异常退化 DEGRADED", "FAULT_LATCH 锁存", "事件位图喂狗纪律"],
    text: [
      "系统上电先进入 INIT_SELF_TEST 态：校验配置区 CRC、检测传感器在位与执行器零位，任何自检不通过绝不盲目开启功率输出。",
      "自检通过后切入 NORMAL 态运行；状态转移由查表法（State Transition Table）显式驱动，消除深层嵌套 if-else 带来的未定义死角。",
      "当检测到可恢复瞬态异常（如单次通信 CRC 错误或电压轻度欠压），转入 DEGRADED（降级限功率运行）态并记录事件计数器。",
      "一旦触发安全红线（如超温、过流或传感器断线超阈值），立即进入 FAULT_LATCH（故障锁存）态：硬件关断输出，且必须满足显式人工复位或迟滞恢复条件才允许退出。",
      "看门狗铁律：严禁在硬件定时器中断里无脑喂狗（主循环卡死也照喂不误）！应由各关键任务设置完成标志位，仅当低优先级监控任务核对所有标志位齐全时才执行喂狗。",
    ],
  },
  "dsp-aliasing": {
    title: "奈奎斯特采样定理、频谱混叠（Aliasing）假象与抗混叠滤波 + 加窗 FFT",
    badge: "数字信号处理 · 采样与频谱",
    labels: ["高频干扰未滤波", "欠采样混叠折叠", "模拟抗混叠滤波 AAF", "截断与频谱泄漏", "Hann 窗函数抑制"],
    text: [
      "现场信号除有用的 50 Hz 振动基波外，往往混有开关电源或电机换相产生的 900 Hz 高频干扰。",
      "混叠灾难：若直接用 fs = 1000 Hz（奈奎斯特频率 fs/2 = 500 Hz）采样，900 Hz 干扰会镜像折叠成 |1000 - 900| = 100 Hz 的虚假低频正弦波！一旦进入数字域，任何数字滤波器都无法再将其与真实 100 Hz 信号区分。",
      "硬件前置防线：必须在 ADC 引脚前设计模拟抗混叠低通滤波器（AAF，截止频率 fc < fs/2），在模拟域先把 > 500 Hz 的高频分量衰减掉。",
      "有限长 FFT 频谱泄漏：对非整周期截断的采样序列直接做 FFT，相当于乘以矩形窗，主瓣能量会向两侧旁瓣大面积泄漏，淹没微弱故障特征频率。",
      "工程标准流程：先减去直流偏置（去均值），再乘以汉宁窗（Hann Window）使首尾平滑归零，最后执行实数 FFT 并按采样率换算频率轴 f_k = k·fs/N。",
    ],
  },
};

/** Maps textbook article IDs to recommended interactive micro-animations. */
export const CHAPTER_DEMOS: Record<string, string[]> = {
  // B00 编程与 C 语言基础
  "course-b00-m01": ["memory-layout"],
  "course-b00-m02": ["data-endian"],
  "course-b00-m06": ["bit-ops"],
  "course-b00-m08": ["data-endian"],
  "course-b00-m10": ["memory-layout"],
  // B01 嵌入式 C 精读
  "course-b01-ch1": ["data-endian"],
  "course-b01-ch3": ["memory-layout"],
  "course-b01-ch4": ["memory-layout"],
  "course-b01-ch6": ["bit-ops"],
  "course-b01-ch7": ["memory-layout"],
  // B02a & B02 C++
  "course-b02a-m04": ["ownership"],
  "course-b02a-m08": ["ownership"],
  "course-b02-m01": ["memory-layout"],
  "course-b02-m02": ["ownership"],
  // B03a & B03 Rust
  "course-b03a-m02": ["ownership"],
  "course-b03a-m03": ["ownership"],
  "course-b03-m01": ["ownership"],
  "course-b03-m02": ["bit-ops"],
  "course-b03-m05": ["dma-ring"],
  // B04a & B04 Python
  "course-b04a-m05": ["queue"],
  "course-b04-m02": ["memory-layout"],
  "course-b04-m03": ["tcp", "serial-waveform"],
  // B05 单片机裸机与外设驱动
  "course-b05-m01": ["clock-tree"],
  "course-b05-m02": ["gpio-circuit"],
  "course-b05-m03": ["nvic-tailchain"],
  "course-b05-m04": ["motor-pwm"],
  "course-b05-m05": ["adc-pid-loop"],
  "course-b05-m06": ["dma-ring"],
  "course-b05-m07": ["serial-waveform"],
  "course-b05-m08": ["serial-waveform"],
  "course-b05-m09": ["serial-waveform"],
  "course-b05-m10": ["power-modes", "fsm-watchdog"],
  "course-b05-m15": ["memory-layout"],
  "course-b05-m16": ["gpio-circuit"],
  "course-b05-m17": ["can-arbitration"],
  "course-b05-m18": ["tcp"],
  "course-b05-m21": ["secure-boot"],
  // B06 RTOS 与实时系统
  "course-b06-m01": ["freertos-context-switch", "rtos-scheduler"],
  "course-b06-m02": ["freertos-context-switch", "rtos-scheduler"],
  "course-b06-m03": ["rtos-scheduler"],
  "course-b06-m04": ["queue"],
  "course-b06-m05": ["nvic-tailchain", "freertos-context-switch"],
  "course-b06-m06": ["lease"],
  // B07 通信协议与系统集成
  "course-b07-m01": ["tcp", "serial-waveform"],
  "course-b07-m03": ["serial-waveform"],
  "course-b07-m04": ["can-arbitration"],
  "course-b07-m07": ["secure-boot"],
  "course-b07-m08": ["secure-boot", "archive"],
  "course-b07-m12": ["session", "queue"],
  // B08 单片机应用开发实战
  "course-b08-m01": ["fsm-watchdog"],
  "course-b08-m02": ["clock-tree"],
  "course-b08-m04": ["dma-ring"],
  "course-b08-m05": ["adc-pid-loop", "motor-pwm"],
  // B09 嵌入式 Linux 系统
  "course-b09-m01": ["boot"],
  "course-b09-m03": ["linux-dtree"],
  "course-b09-m04": ["boot"],
  // B10 嵌入式 Linux 驱动开发
  "course-b10-m01": ["linux-dtree"],
  "course-b10-m03": ["rtos-scheduler"],
  "course-b10-m04": ["nvic-tailchain"],
  "course-b10-m05": ["linux-dtree"],
  "course-b10-m06": ["gpio-circuit"],
  "course-b10-m07": ["serial-waveform"],
  "course-b10-m08": ["cache-dma"],
  "course-b10-m12": ["power-modes"],
  // B11 嵌入式 Linux 应用开发
  "course-b11-m02": ["queue"],
  "course-b11-m03": ["tcp"],
  "course-b11-m05": ["rtos-scheduler"],
  // B12 工程化、测试与量产
  "course-b12-m03": ["fsm-watchdog"],
  "course-b12-m04": ["fsm-watchdog"],
  "course-b12-m05": ["secure-boot"],
  // B13 端侧 AI 与数据闭环
  "course-b13-m01": ["tinyml-quant"],
  "course-b13-m03": ["dsp-aliasing"],
  "course-b13-m05": ["tinyml-quant"],
  "course-b13-m06": ["tinyml-quant"],
  "course-b13-m07": ["tinyml-quant"],
  // B14 数据平台与云边协同
  "course-b14-m01": ["session"],
  "course-b14-m02": ["archive"],
  // B15 前沿与专项技术
  "course-b15-m01": ["memory-layout"],
  "course-b15-m02": ["secure-boot"],
  "course-b15-m03": ["fsm-watchdog"],
  "course-b15-m04": ["can-arbitration"],
  // B16 开发环境与工程工具
  "course-b16-m01": ["memory-layout"],
  "course-b16-m05": ["memory-layout"],
  // B17 电子电路与硬件调试基础
  "course-b17-m02": ["gpio-circuit"],
  "course-b17-m03": ["pcb-return-path", "power-modes"],
  "course-b17-m04": ["clock-tree"],
  "course-b17-m05": ["dsp-aliasing"],
  "course-b17-m06": ["serial-waveform", "can-arbitration"],
  "course-b17-m07": ["motor-pwm"],
  "course-b17-m09": ["pcb-return-path"],
  // B18 处理器与计算机体系结构
  "course-b18-m01": ["memory-layout"],
  "course-b18-m03": ["nvic-tailchain"],
  "course-b18-m04": ["cache-dma"],
  "course-b18-m05": ["memory-layout"],
  "course-b18-m06": ["cache-dma"],
  // B19 数据结构、算法与应用数学
  "course-b19-m02": ["data-endian"],
  "course-b19-m03": ["dma-ring", "queue"],
  "course-b19-m05": ["fsm-watchdog"],
  // B20 传感器、信号处理与控制
  "course-b20-m01": ["dsp-aliasing"],
  "course-b20-m03": ["adc-pid-loop"],
  "course-b20-m04": ["dsp-aliasing"],
  "course-b20-m05": ["dsp-aliasing"],
  "course-b20-m08": ["adc-pid-loop"],
  "course-b20-m09": ["motor-pwm", "adc-pid-loop"],
  // B21 机器学习与数据工程基础
  "course-b21-m04": ["dsp-aliasing"],
  "course-b21-m05": ["tinyml-quant"],
  // B22 嵌入式安全与设备生命周期
  "course-b22-m01": ["secure-boot"],
  "course-b22-m04": ["secure-boot"],
  "course-b22-m06": ["secure-boot"],
  // B23 算法、数据与控制实战
  "course-b23-b23-m01": ["adc-pid-loop"],
  "course-b23-b23-m03": ["dma-ring"],
  "course-b23-b23-m05": ["fsm-watchdog"],
  "course-b23-b23-m06": ["tinyml-quant"],
  "course-b23-b23-m09": ["dsp-aliasing"],
  "course-b23-b23-m10": ["dsp-aliasing"],
  "course-b23-b23-m12": ["adc-pid-loop"],
  "course-b23-b23-m18": ["motor-pwm"],
};

function EmbeddedDemoScene({ kind, step }: { kind: string; step: number }) {
  if (kind === "freertos-context-switch") {
    const tcbPointsToB = step >= 3;
    const stackAHasHw = step >= 1 && step <= 4;
    const stackAHasSw = step >= 2 && step <= 4;
    const stackBPopped = step === 4;
    const cursorX = [68, 175, 290, 405, 520][step];

    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 222" className="demo-vector" aria-hidden="true">
          {/* Left: Cortex-M CPU Core & Registers */}
          <rect
            x="12"
            y="12"
            width="168"
            height="146"
            rx="10"
            className={`demo-svg-box ${step === 0 || step === 4 ? "active" : ""}`}
          />
          <text x="96" y="31" textAnchor="middle" className="demo-svg-title">
            Cortex-M CPU 内核
          </text>
          <rect x="24" y="40" width="144" height="26" rx="5" className="demo-svg-box active" />
          <text x="96" y="57" textAnchor="middle" className="demo-svg-sub">
            {step === 0
              ? "PC → Task_A() 运行中"
              : step < 4
                ? "PC → PendSV_Handler"
                : "PC → Task_B() 恢复运行"}
          </text>
          <rect
            x="24"
            y="72"
            width="144"
            height="26"
            rx="5"
            className={`demo-svg-box ${step === 1 || step === 4 ? "warn" : ""}`}
          />
          <text x="96" y="89" textAnchor="middle" className="demo-svg-sub">
            HW 8寄存器: R0-R3,LR,PC,xPSR
          </text>
          <rect
            x="24"
            y="104"
            width="144"
            height="26"
            rx="5"
            className={`demo-svg-box ${step === 2 || step === 4 ? "active" : ""}`}
          />
          <text x="96" y="121" textAnchor="middle" className="demo-svg-sub">
            SW 8寄存器: R4 - R11 (手动)
          </text>
          <text x="96" y="148" textAnchor="middle" className="demo-svg-sub">
            PSP → {tcbPointsToB ? "0x2000_1800 (栈B)" : "0x2000_0800 (栈A)"}
          </text>

          {/* Center: pxCurrentTCB & Bus Transfer */}
          <rect
            x="202"
            y="12"
            width="144"
            height="54"
            rx="8"
            className={`demo-svg-box ${step === 3 ? "warn" : ""}`}
          />
          <text x="274" y="32" textAnchor="middle" className="demo-svg-title">
            pxCurrentTCB 指针
          </text>
          <text x="274" y="51" textAnchor="middle" className="demo-svg-sub">
            {tcbPointsToB ? "➔ 指向 TCB_B (最高优)" : "➔ 指向 TCB_A (当前)"}
          </text>

          {/* Animated Register Transfer Arrows */}
          <path
            d="M 180 85 H 366"
            className={`demo-bus ${step === 1 ? "is-hot" : ""}`}
          />
          <path
            d="M 180 117 H 366"
            className={`demo-bus ${step === 2 ? "is-hot" : ""}`}
          />
          <path
            d="M 484 117 H 360 L 180 117"
            className={`demo-bus ${step === 4 ? "is-hot" : ""}`}
          />
          {step === 1 && (
            <text x="274" y="80" textAnchor="middle" className="demo-svg-sub">
              硬件自动压栈 8 寄存器 ➔
            </text>
          )}
          {step === 2 && (
            <text x="274" y="112" textAnchor="middle" className="demo-svg-sub">
              STMDB r0!, {"{r4-r11}"} ➔
            </text>
          )}
          {step === 4 && (
            <text x="274" y="112" textAnchor="middle" className="demo-svg-sub">
              ◄── LDMIA 弹出 R4-R11 & EXC_RETURN
            </text>
          )}

          {/* Right: Task A Stack & Task B Stack in SRAM */}
          <rect
            x="368"
            y="12"
            width="104"
            height="146"
            rx="8"
            className={`demo-svg-box ${step <= 2 ? "active" : ""}`}
          />
          <text x="420" y="30" textAnchor="middle" className="demo-svg-title">
            Task A 栈 (SRAM)
          </text>
          <rect
            x="376"
            y="42"
            width="88"
            height="34"
            rx="5"
            className={`demo-svg-box ${stackAHasHw ? "warn" : ""}`}
          />
          <text x="420" y="57" textAnchor="middle" className="demo-svg-sub">
            {stackAHasHw ? "HW: xPSR..R0" : "栈空闲区"}
          </text>
          <text x="420" y="70" textAnchor="middle" className="demo-svg-sub">
            {stackAHasHw ? "(硬件自动入栈)" : ""}
          </text>
          <rect
            x="376"
            y="82"
            width="88"
            height="34"
            rx="5"
            className={`demo-svg-box ${stackAHasSw ? "active" : ""}`}
          />
          <text x="420" y="97" textAnchor="middle" className="demo-svg-sub">
            {stackAHasSw ? "SW: R11..R4" : "栈空闲区"}
          </text>
          <text x="420" y="110" textAnchor="middle" className="demo-svg-sub">
            {stackAHasSw ? "← pxTopOfStack" : ""}
          </text>
          <text x="420" y="144" textAnchor="middle" className="demo-svg-sub">
            TCB_A 保存栈顶
          </text>

          <rect
            x="484"
            y="12"
            width="104"
            height="146"
            rx="8"
            className={`demo-svg-box ${step >= 3 ? "active" : ""}`}
          />
          <text x="536" y="30" textAnchor="middle" className="demo-svg-title">
            Task B 栈 (SRAM)
          </text>
          <rect
            x="492"
            y="42"
            width="88"
            height="34"
            rx="5"
            className={`demo-svg-box ${!stackBPopped ? "warn" : ""}`}
          />
          <text x="536" y="57" textAnchor="middle" className="demo-svg-sub">
            {stackBPopped ? "已弹出恢复 CPU" : "HW: xPSR..R0"}
          </text>
          <text x="536" y="70" textAnchor="middle" className="demo-svg-sub">
            {stackBPopped ? "EXC_RETURN" : "(上次挂起现场)"}
          </text>
          <rect
            x="492"
            y="82"
            width="88"
            height="34"
            rx="5"
            className={`demo-svg-box ${!stackBPopped ? "active" : ""}`}
          />
          <text x="536" y="97" textAnchor="middle" className="demo-svg-sub">
            {stackBPopped ? "LDMIA 已出栈" : "SW: R11..R4"}
          </text>
          <text x="536" y="110" textAnchor="middle" className="demo-svg-sub">
            {!stackBPopped ? "← pxTopOfStack" : "PSP 已上移 ↑"}
          </text>
          <text x="536" y="144" textAnchor="middle" className="demo-svg-sub">
            TCB_B 恢复运行
          </text>

          {/* Bottom Timeline Track */}
          <rect x="12" y="168" width="576" height="42" rx="8" className="demo-svg-box" />
          <line x1="28" y1="189" x2="572" y2="189" stroke="var(--line-strong)" strokeWidth="2" />
          {[
            { x: 68, t: "1.Task_A" },
            { x: 175, t: "2.SysTick" },
            { x: 290, t: "3.压栈R4-11" },
            { x: 405, t: "4.切TCB_B" },
            { x: 520, t: "5.恢复Task_B" },
          ].map((node, idx) => (
            <g key={node.t}>
              <circle
                cx={node.x}
                cy="189"
                r={idx === step ? 6 : 4}
                fill={idx <= step ? "var(--accent)" : "var(--line-strong)"}
              />
              <text x={node.x} y="205" textAnchor="middle" className="demo-svg-sub">
                {node.t}
              </text>
            </g>
          ))}
          <circle
            cx={cursorX}
            cy="189"
            r="9"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  if (kind === "clock-tree") {
    const activeStage = step;
    const freq = ["8 MHz (HSI)", "8 MHz (HSE)", "8 MHz (Wait=2)", "VCO 72 MHz", "SYSCLK 72 MHz"][step];
    const pulseDur = step >= 3 ? "0.45s" : "1.4s";
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 165" className="demo-vector" aria-hidden="true">
          <path d="M118 52 H168" className={`demo-bus ${activeStage >= 1 ? "is-hot" : ""}`} />
          <path d="M278 52 H328" className={`demo-bus ${activeStage >= 3 ? "is-hot" : ""}`} />
          <path d="M438 52 H482" className={`demo-bus ${activeStage >= 4 ? "is-hot" : ""}`} />
          <path d="M383 82 V122 H482" className={`demo-bus ${activeStage >= 2 ? "is-warn" : ""}`} />

          <g className={`demo-box-group ${activeStage <= 1 ? "is-focus" : "is-done"}`}>
            <rect x="14" y="24" width="104" height="56" rx="10" className="demo-svg-box" />
            <text x="66" y="47" textAnchor="middle" className="demo-svg-title">
              {step === 0 ? "HSI 8MHz" : "HSE 8MHz"}
            </text>
            <text x="66" y="66" textAnchor="middle" className="demo-svg-sub">
              {step === 0 ? "内部 RC 默认" : "HSERDY=1 已就绪"}
            </text>
          </g>

          <g className={`demo-box-group ${activeStage === 3 ? "is-focus" : activeStage > 3 ? "is-done" : ""}`}>
            <rect x="168" y="24" width="110" height="56" rx="10" className="demo-svg-box" />
            <text x="223" y="47" textAnchor="middle" className="demo-svg-title">PLL 倍频 ×9</text>
            <text x="223" y="66" textAnchor="middle" className="demo-svg-sub">
              {step >= 3 ? "PLLRDY=1 锁定" : "等待配置"}
            </text>
          </g>

          <g className={`demo-box-group ${activeStage === 4 ? "is-focus" : ""}`}>
            <rect x="328" y="24" width="110" height="56" rx="10" className="demo-svg-box" />
            <text x="383" y="47" textAnchor="middle" className="demo-svg-title">SYSCLK</text>
            <text x="383" y="66" textAnchor="middle" className="demo-svg-sub">{freq}</text>
          </g>

          <g className={`demo-box-group ${activeStage >= 4 ? "is-done" : ""}`}>
            <rect x="482" y="16" width="104" height="68" rx="10" className="demo-svg-box" />
            <text x="534" y="38" textAnchor="middle" className="demo-svg-title">AHB 72M</text>
            <text x="534" y="55" textAnchor="middle" className="demo-svg-sub">APB1: 36M (TIM×2)</text>
            <text x="534" y="71" textAnchor="middle" className="demo-svg-sub">APB2: 72M / MCO</text>
          </g>

          <g className={`demo-box-group ${activeStage === 2 ? "is-focus" : activeStage > 2 ? "is-done" : ""}`}>
            <rect x="482" y="96" width="104" height="52" rx="10" className="demo-svg-box" />
            <text x="534" y="118" textAnchor="middle" className="demo-svg-title">FLASH_ACR</text>
            <text x="534" y="136" textAnchor="middle" className="demo-svg-sub">
              {step >= 2 ? "LATENCY = 2WS" : "LATENCY = 0WS"}
            </text>
          </g>

          <rect x="14" y="102" width="444" height="44" rx="8" fill="var(--accent-soft)" stroke="var(--line)" />
          <text x="26" y="128" className="demo-svg-sub">实时脉冲示意 ({freq})</text>
          <path
            d={
              step >= 3
                ? "M195 134 V114 H210 V134 H225 V114 H240 V134 H255 V114 H270 V134 H285 V114 H300 V134 H315 V114 H330 V134 H345 V114 H360 V134 H375 V114 H390 V134 H405 V114 H420 V134 H435 V114 H445"
                : "M195 134 V114 H235 V134 H275 V114 H315 V134 H355 V114 H395 V134 H435"
            }
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            style={{ animationDuration: pulseDur }}
          />
        </svg>
      </div>
    );
  }

  if (kind === "gpio-circuit") {
    const modeName = ["浮空输入 (Hi-Z)", "内部上拉输入", "推挽输出高 (1)", "推挽输出低 (0)", "开漏输出 (I²C 线与)"][step];
    const pmosOn = step === 2;
    const nmosOn = step === 3 || step === 4;
    const pullUpOn = step === 1 || step === 4;
    const pinLevel = step === 0 ? "不确定 (易受干扰)" : step === 3 ? "0 V (低电平)" : "VDD 3.3V (高/上拉)";
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 170" className="demo-vector" aria-hidden="true">
          <rect x="16" y="14" width="356" height="142" rx="12" className="demo-svg-box" strokeDasharray="5 4" />
          <text x="30" y="34" className="demo-svg-sub">MCU 内部 I/O 单元 ({modeName})</text>

          <g className={`demo-box-group ${pmosOn ? "is-focus" : ""}`}>
            <rect x="170" y="26" width="112" height="44" rx="8" className="demo-svg-box" />
            <text x="226" y="46" textAnchor="middle" className="demo-svg-title">P-MOS 上管</text>
            <text x="226" y="62" textAnchor="middle" className="demo-svg-sub">
              {pmosOn ? "导通 (拉高至 VDD)" : step === 4 ? "开漏永久关闭" : "截止"}
            </text>
          </g>

          <g className={`demo-box-group ${nmosOn ? "is-focus" : ""}`}>
            <rect x="170" y="98" width="112" height="44" rx="8" className="demo-svg-box" />
            <text x="226" y="118" textAnchor="middle" className="demo-svg-title">N-MOS 下管</text>
            <text x="226" y="134" textAnchor="middle" className="demo-svg-sub">
              {nmosOn ? "导通 (灌入 GND)" : "截止 (高阻)"}
            </text>
          </g>

          <g className={`demo-box-group ${step <= 1 ? "is-focus" : "is-done"}`}>
            <rect x="30" y="62" width="114" height="50" rx="8" className="demo-svg-box" />
            <text x="87" y="84" textAnchor="middle" className="demo-svg-title">施密特触发器</text>
            <text x="87" y="101" textAnchor="middle" className="demo-svg-sub">读 IDR 寄存器</text>
          </g>

          <g className="demo-box-group is-focus">
            <rect x="396" y="58" width="188" height="58" rx="10" className="demo-svg-box" />
            <text x="490" y="82" textAnchor="middle" className="demo-svg-title">GPIO 引脚 PAD</text>
            <text x="490" y="102" textAnchor="middle" className="demo-svg-sub">{pinLevel}</text>
          </g>

          {pullUpOn && (
            <g className="demo-box-group is-done">
              <rect x="416" y="14" width="148" height="32" rx="7" className="demo-svg-box" />
              <text x="490" y="34" textAnchor="middle" className="demo-svg-sub">
                {step === 1 ? "内部上拉电阻 ~40kΩ → VDD" : "外部总线拉电阻 4.7kΩ → VDD"}
              </text>
            </g>
          )}

          <path d="M282 48 H340 V87 H396" className={`demo-bus ${pmosOn ? "is-hot" : ""}`} />
          <path d="M282 120 H340 V87 H396" className={`demo-bus ${nmosOn ? "is-warn" : ""}`} />
          <path d="M144 87 H340" className={`demo-bus ${step <= 1 ? "is-hot" : ""}`} />
        </svg>
      </div>
    );
  }

  if (kind === "nvic-tailchain") {
    const phases = [
      { active: "Thread: main()", stack: "MSP 空闲 (0 字)", cycles: "正常执行" },
      { active: "硬件自动压栈 (8 字)", stack: "xPSR, PC, LR, R12, R3..R0", cycles: "12 周期并行取向量" },
      { active: "ISR_High (高优抢占)", stack: "复用同一份 8 字现场", cycles: "Late-Arriving 零额外压栈" },
      { active: "Tail-Chaining 咬尾切换", stack: "保持 8 字栈帧不出栈", cycles: "仅用 6 周期直入 ISR_Low" },
      { active: "EXC_RETURN 自动出栈", stack: "恢复 R0..R3, R12, LR, PC, xPSR", cycles: "12 周期无缝返回 main()" },
    ][step];
    const cursorX = [48, 155, 265, 395, 525][step];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 188" className="demo-vector" aria-hidden="true">
          {/* Timeline boxes */}
          <rect x="14" y="16" width="84" height="54" rx="7" className={`demo-svg-box ${step === 0 ? "active" : ""}`} />
          <text x="56" y="39" textAnchor="middle" className="demo-svg-title">main()</text>
          <text x="56" y="56" textAnchor="middle" className="demo-svg-sub">Thread 态</text>

          <rect x="108" y="16" width="96" height="54" rx="7" className={`demo-svg-box ${step === 1 ? "warn" : ""}`} />
          <text x="156" y="39" textAnchor="middle" className="demo-svg-title">硬件压栈</text>
          <text x="156" y="56" textAnchor="middle" className="demo-svg-sub">12 周期入栈</text>

          <rect x="214" y="16" width="106" height="54" rx="7" className={`demo-svg-box ${step === 2 ? "active" : ""}`} />
          <text x="267" y="39" textAnchor="middle" className="demo-svg-title">ISR_High</text>
          <text x="267" y="56" textAnchor="middle" className="demo-svg-sub">高优抢占执行</text>

          <rect x="330" y="16" width="130" height="54" rx="7" className={`demo-svg-box ${step === 3 ? "active" : ""}`} />
          <text x="395" y="39" textAnchor="middle" className="demo-svg-title">咬尾 6 周期 → ISR_Low</text>
          <text x="395" y="56" textAnchor="middle" className="demo-svg-sub">省去 24 周期出入栈!</text>

          <rect x="470" y="16" width="116" height="54" rx="7" className={`demo-svg-box ${step === 4 ? "active" : ""}`} />
          <text x="528" y="39" textAnchor="middle" className="demo-svg-title">EXC_RETURN</text>
          <text x="528" y="56" textAnchor="middle" className="demo-svg-sub">12 周期出栈回 main</text>

          {/* Animated playhead arrow */}
          <path d={`M ${cursorX} 74 V 92`} className="demo-bus is-hot" />
          <circle cx={cursorX} cy="74" r="5" fill="var(--accent)" />

          {/* Bottom Hardware Stack Frame Visualizer */}
          <rect x="14" y="96" width="572" height="78" rx="9" className="demo-svg-box" />
          <text x="28" y="117" className="demo-svg-title">
            当前状态：{phases.active}（{phases.cycles}）
          </text>
          <text x="28" y="135" className="demo-svg-sub">
            硬件栈帧 (MSP/PSP)：{phases.stack}
          </text>
          {["R0", "R1", "R2", "R3", "R12", "LR", "PC", "xPSR"].map((reg, idx) => (
            <g key={reg}>
              <rect
                x={28 + idx * 67}
                y="142"
                width="60"
                height="24"
                rx="4"
                className={`demo-svg-box ${step >= 1 && step <= 3 ? "active" : ""}`}
              />
              <text x={58 + idx * 67} y="158" textAnchor="middle" className="demo-svg-sub">
                {reg}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (kind === "dma-ring") {
    const wr = [0, 4, 5, 0, 2][step];
    const rd = [0, 0, 2, 4, 2][step];
    const filled = [
      [false, false, false, false, false, false, false, false],
      [true, true, true, true, false, false, false, false],
      [false, false, true, true, true, true, false, false],
      [true, false, false, false, true, true, true, true],
      [true, true, false, false, false, false, false, false],
    ][step];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 185" className="demo-vector" aria-hidden="true">
          {/* Top 8 Ring Buffer Slots */}
          <text x="16" y="22" className="demo-svg-title">
            SRAM 8 槽环形缓冲区（前半区 Slot 0..3 触发 HT · 后半区 Slot 4..7 触发 TC）
          </text>
          {filled.map((isFull, idx) => {
            const x = 16 + idx * 71;
            const isWr = wr === idx;
            const isRd = rd === idx;
            return (
              <g key={idx}>
                <rect
                  x={x}
                  y="32"
                  width="65"
                  height="68"
                  rx="7"
                  className={`demo-svg-box ${isWr ? "warn" : isFull ? "active" : ""}`}
                />
                <text x={x + 32} y="50" textAnchor="middle" className="demo-svg-sub">
                  Slot {idx}
                </text>
                <text x={x + 32} y="69" textAnchor="middle" className="demo-svg-title">
                  {isWr && isRd ? "WR/RD" : isWr ? "DMA↓" : isRd ? "CPU↑" : isFull ? "DATA" : "空"}
                </text>
                <text x={x + 32} y="88" textAnchor="middle" className="demo-svg-sub">
                  {idx < 4 ? "Half-A" : "Half-B"}
                </text>
              </g>
            );
          })}

          {/* Ping-Pong Parallel Pipeline Box */}
          <rect x="16" y="114" width="276" height="58" rx="8" className={`demo-svg-box ${step === 1 || step === 3 ? "active" : ""}`} />
          <text x="154" y="136" textAnchor="middle" className="demo-svg-title">
            前半区 Half-A (Slot 0..3)
          </text>
          <text x="154" y="156" textAnchor="middle" className="demo-svg-sub">
            {step === 1 ? "DMA 正在写入前半区..." : step === 2 ? "✔ HT 中断：CPU 安全读取前半区" : "就绪等待"}
          </text>

          <rect x="308" y="114" width="276" height="58" rx="8" className={`demo-svg-box ${step === 2 || step === 3 ? "active" : ""}`} />
          <text x="446" y="136" textAnchor="middle" className="demo-svg-title">
            后半区 Half-B (Slot 4..7)
          </text>
          <text x="446" y="156" textAnchor="middle" className="demo-svg-sub">
            {step === 2 ? "DMA 并行写入后半区 (无冲突)" : step === 3 ? "✔ TC 中断回绕：CPU 读取后半区" : "空闲"}
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "serial-waveform") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 148" className="demo-vector" aria-hidden="true">
          <text x="16" y="26" className="demo-svg-sub">TX / SDA 信号线</text>
          <path
            d="M 20 44 H 95 V 92 H 155 V 44 H 215 V 92 H 275 V 44 H 335 V 92 H 395 V 44 H 455 V 44 H 575"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.8"
          />
          <rect
            x={[18, 85, 110, 165, 445][step]}
            y="32"
            width={[72, 75, 50, 275, 125][step]}
            height="74"
            rx="8"
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeDasharray="4 3"
          />
          {[125, 185, 245, 305, 365, 425, 485].map((x, idx) => (
            <g key={x} opacity={step >= 2 ? 1 : 0.25}>
              <line x1={x} y1="92" x2={x} y2="118" stroke="var(--accent)" strokeWidth="1.5" />
              <circle cx={x} cy="92" r="3" fill="var(--accent)" />
              <text x={x} y="134" textAnchor="middle" className="demo-svg-sub">
                {idx === 0 ? "Start" : idx === 6 ? "Stop" : `D${idx - 1}`}
              </text>
            </g>
          ))}
          <text x="56" y="72" textAnchor="middle" className="demo-svg-sub">IDLE (1)</text>
        </svg>
      </div>
    );
  }

  if (kind === "rtos-scheduler") {
    const states = [
      { h: "休眠挂起", m: "休眠挂起", l: "运行中 · 持有 Mutex", prio: "Task_L 优先级 = 低" },
      { h: "抢占后阻塞等锁", m: "休眠挂起", l: "就绪 · 持有 Mutex", prio: "Task_H 等待 Task_L 释放" },
      { h: "被无限期卡死!", m: "插队抢占运行!", l: "被 Task_M 饿死", prio: "⚠ 发生优先级反转" },
      { h: "阻塞等锁 (受保护)", m: "就绪 (无法插队)", l: "继承高优 · 快速跑完临界区", prio: "✔ 优先级继承：Task_L 临时升为高优" },
      { h: "获得 Mutex 立即运行!", m: "等待 Task_H 结束", l: "让出锁并恢复低优", prio: "✔ 确定性实时响应完成" },
    ][step];
    const playheadX = [155, 245, 345, 445, 535][step];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 190" className="demo-vector" aria-hidden="true">
          {/* 3 Swimlanes */}
          <text x="14" y="38" className="demo-svg-title">Task_H (高)</text>
          <rect x="105" y="18" width="475" height="30" rx="5" className="demo-svg-box" />
          <rect x="205" y="21" width="55" height="24" rx="4" className={`demo-svg-box ${step === 1 ? "active" : ""}`} />
          <text x="232" y="37" textAnchor="middle" className="demo-svg-sub">抢占等锁</text>
          {step === 2 && (
            <rect x="265" y="21" width="120" height="24" rx="4" className="demo-svg-box bad" />
          )}
          {step === 2 && (
            <text x="325" y="37" textAnchor="middle" className="demo-svg-sub">⚠ 被卡死阻塞!</text>
          )}
          <rect x="485" y="21" width="88" height="24" rx="4" className={`demo-svg-box ${step === 4 ? "active" : ""}`} />
          <text x="529" y="37" textAnchor="middle" className="demo-svg-sub">获锁运行 ✔</text>

          <text x="14" y="82" className="demo-svg-title">Task_M (中)</text>
          <rect x="105" y="62" width="475" height="30" rx="5" className="demo-svg-box" />
          <rect
            x="270"
            y="65"
            width="115"
            height="24"
            rx="4"
            className={`demo-svg-box ${step === 2 ? "bad" : step === 3 ? "warn" : ""}`}
          />
          <text x="327" y="81" textAnchor="middle" className="demo-svg-sub">
            {step === 3 ? "被继承拦截 (禁插队)" : "中优插队抢占!"}
          </text>

          <text x="14" y="126" className="demo-svg-title">Task_L (低)</text>
          <rect x="105" y="106" width="475" height="30" rx="5" className="demo-svg-box" />
          <rect x="112" y="109" width="88" height="24" rx="4" className={`demo-svg-box ${step === 0 ? "active" : ""}`} />
          <text x="156" y="125" textAnchor="middle" className="demo-svg-sub">持锁运行 🔒</text>
          <rect x="392" y="109" width="88" height="24" rx="4" className={`demo-svg-box ${step === 3 ? "active" : ""}`} />
          <text x="436" y="125" textAnchor="middle" className="demo-svg-sub">升至高优解锁⚡</text>

          {/* Playhead line */}
          <line x1={playheadX} y1="12" x2={playheadX} y2="142" stroke="var(--accent)" strokeWidth="2.2" strokeDasharray="4 2" />

          {/* Status Footer */}
          <rect x="14" y="148" width="566" height="32" rx="6" className="demo-svg-box active" />
          <text x="297" y="168" textAnchor="middle" className="demo-svg-title">
            {states.prio} · Task_H: {states.h} | Task_L: {states.l}
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "memory-layout") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 186" className="demo-vector" aria-hidden="true">
          {/* Left: Flash */}
          <rect x="14" y="12" width="225" height="162" rx="9" className="demo-svg-box" />
          <text x="126" y="32" textAnchor="middle" className="demo-svg-title">
            Flash 掉电非易失区 (0x0800_0000)
          </text>
          <rect x="26" y="42" width="201" height="34" rx="5" className={`demo-svg-box ${step === 1 ? "active" : ""}`} />
          <text x="126" y="63" textAnchor="middle" className="demo-svg-sub">
            .isr_vector (MSP初值 + Reset_Handler)
          </text>
          <rect x="26" y="82" width="201" height="38" rx="5" className={`demo-svg-box ${step === 0 || step === 4 ? "active" : ""}`} />
          <text x="126" y="105" textAnchor="middle" className="demo-svg-sub">
            .text (机器码) + .rodata (const常量)
          </text>
          <rect x="26" y="126" width="201" height="36" rx="5" className={`demo-svg-box ${step === 2 ? "warn" : ""}`} />
          <text x="126" y="148" textAnchor="middle" className="demo-svg-sub">
            .data LMA (全局变量初值镜像 _sidata)
          </text>

          {/* Center Animated Copy Arrows */}
          <path d="M 239 59 H 355" className={`demo-bus ${step === 1 ? "is-hot" : ""}`} />
          <path d="M 239 144 C 295 144, 295 62, 355 62" className={`demo-bus ${step === 2 ? "is-hot" : ""}`} />
          <text x="297" y="110" textAnchor="middle" className="demo-svg-sub">
            {step === 1 ? "硬件取 MSP/PC ➔" : step === 2 ? "Reset 拷贝初值 ➔" : step === 3 ? "循环写 0 清零 ➔" : "地址总线映射"}
          </text>

          {/* Right: SRAM */}
          <rect x="355" y="12" width="231" height="162" rx="9" className="demo-svg-box" />
          <text x="470" y="32" textAnchor="middle" className="demo-svg-title">
            SRAM 运行时读写区 (0x2000_0000)
          </text>
          <rect x="367" y="42" width="207" height="36" rx="5" className={`demo-svg-box ${step === 2 ? "active" : ""}`} />
          <text x="470" y="64" textAnchor="middle" className="demo-svg-sub">
            .data VMA ({step >= 2 ? "✔ 已从 Flash 拷贝初值" : "上电随机值"})
          </text>
          <rect x="367" y="84" width="207" height="36" rx="5" className={`demo-svg-box ${step === 3 ? "active" : ""}`} />
          <text x="470" y="106" textAnchor="middle" className="demo-svg-sub">
            .bss ({step >= 3 ? "✔ Reset_Handler 已清零" : "上电随机值"})
          </text>
          <rect x="367" y="126" width="207" height="36" rx="5" className={`demo-svg-box ${step === 4 ? "active" : ""}`} />
          <text x="470" y="148" textAnchor="middle" className="demo-svg-sub">
            Heap ↑ ··· 空闲栈空间 ··· ↓ Stack (MSP)
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "bit-ops") {
    const bits = [
      ["1", "0", "1", "1", "1", "0", "1", "0"],
      ["1", "1", "1", "0", "0", "0", "1", "1"],
      ["1", "0", "1", "0", "0", "0", "1", "0"],
      ["1", "0", "1", "1", "0", "1", "1", "0"],
      ["0", "0", "0", "1", "0", "1", "0", "0"],
    ][step];
    const opLabels = [
      "1. 原始寄存器 REG (Bit[4:2] = 110b)",
      "2. 清除掩码 ~(0x7u << 2) = 1110_0011b",
      "3. 按位与清零 REG & ~(0x7u << 2) → Bit[4:2]=000b",
      "4. 按位或写入 | (0x5u << 2) → Bit[4:2]=101b",
      "5. BSRR 硬件原子写：写 1 生效、写 0 忽略（防中断打断竞态）",
    ][step];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 155" className="demo-vector" aria-hidden="true">
          <text x="300" y="24" textAnchor="middle" className="demo-svg-title">
            {opLabels}
          </text>
          {bits.map((b, i) => {
            const bitNum = 7 - i;
            const inTarget = bitNum >= 2 && bitNum <= 4;
            const x = 24 + i * 69;
            return (
              <g key={bitNum}>
                <rect
                  x={x}
                  y="38"
                  width="61"
                  height="68"
                  rx="8"
                  className={`demo-svg-box ${inTarget ? "warn" : b === "1" ? "active" : ""}`}
                />
                <text x={x + 30} y="58" textAnchor="middle" className="demo-svg-sub">
                  Bit {bitNum}
                </text>
                <text x={x + 30} y="84" textAnchor="middle" className="demo-svg-title">
                  {b}
                </text>
                <text x={x + 30} y="100" textAnchor="middle" className="demo-svg-sub">
                  {inTarget ? "目标域" : "保护位"}
                </text>
              </g>
            );
          })}
          <rect x="24" y="116" width="544" height="28" rx="6" className="demo-svg-box" />
          <text x="296" y="134" textAnchor="middle" className="demo-svg-sub">
            C 表达式：REG = (REG &amp; ~(0x7U &lt;&lt; 2)) | ((0x5U &amp; 0x7U) &lt;&lt; 2);
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "data-endian") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 168" className="demo-vector" aria-hidden="true">
          {step <= 1 ? (
            <>
              <text x="300" y="24" textAnchor="middle" className="demo-svg-title">
                uint32_t val = 0x12345678 ➔ 小端序 (Little-Endian)：低有效字节存低地址
              </text>
              {[
                { a: "+0x00 (低址)", v: "0x78", sub: "LSB 最低字节" },
                { a: "+0x01", v: "0x56", sub: "次低字节" },
                { a: "+0x02", v: "0x34", sub: "次高字节" },
                { a: "+0x03 (高址)", v: "0x12", sub: "MSB 最高字节" },
              ].map((c, idx) => (
                <g key={c.a}>
                  <rect x={24 + idx * 140} y="42" width="128" height="98" rx="8" className="demo-svg-box active" />
                  <text x={88 + idx * 140} y="66" textAnchor="middle" className="demo-svg-sub">{c.a}</text>
                  <text x={88 + idx * 140} y="96" textAnchor="middle" className="demo-svg-title">{c.v}</text>
                  <text x={88 + idx * 140} y="122" textAnchor="middle" className="demo-svg-sub">{c.sub}</text>
                </g>
              ))}
            </>
          ) : (
            <>
              <text x="300" y="24" textAnchor="middle" className="demo-svg-title">
                {step === 2
                  ? "未重排 struct { uint8_t a; uint32_t b; uint8_t c; } → 占 12 字节 (浪费 6 字节 Padding!)"
                  : "重排后 struct { uint32_t b; uint8_t a; uint8_t c; } → 仅占 8 字节 (立省 33% SRAM)"}
              </text>
              {(step === 2
                ? [
                    { l: "a (1B)", w: 50, bad: false },
                    { l: "PAD 空洞 (3B)", w: 130, bad: true },
                    { l: "uint32_t b (4B)", w: 175, bad: false },
                    { l: "c(1B)+PAD(3B)", w: 175, bad: true },
                  ]
                : [
                    { l: "uint32_t b (4B 对齐)", w: 240, bad: false },
                    { l: "a (1B)", w: 80, bad: false },
                    { l: "c (1B)", w: 80, bad: false },
                    { l: "尾部 PAD (2B)", w: 130, bad: true },
                  ]
              ).map((blk, idx, arr) => {
                const startX = 24 + arr.slice(0, idx).reduce((s, x) => s + x.w + 8, 0);
                return (
                  <g key={blk.l}>
                    <rect
                      x={startX}
                      y="52"
                      width={blk.w}
                      height="82"
                      rx="8"
                      className={`demo-svg-box ${blk.bad ? "bad" : "active"}`}
                    />
                    <text x={startX + blk.w / 2} y="97" textAnchor="middle" className="demo-svg-title">
                      {blk.l}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    );
  }

  if (kind === "adc-pid-loop") {
    const stages = [
      { k: "1. TIM TRGO", v: "Ts=10ms 定时触发" },
      { k: "2. ADC 12-bit", v: "2480 → 45.2°C" },
      { k: "3. IIR 低通", v: "滤除高频毛刺" },
      { k: "4. PI 控制律", v: "Kp·e + Ki·∑e" },
      { k: "5. PWM 抗饱和", v: "0~100% 安全输出" },
    ];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 155" className="demo-vector" aria-hidden="true">
          {stages.map((s, idx) => {
            const x = 14 + idx * 116;
            return (
              <g key={s.k}>
                {idx > 0 && (
                  <path d={`M ${x - 12} 62 H ${x}`} className={`demo-bus ${idx <= step ? "is-hot" : ""}`} />
                )}
                <rect
                  x={x}
                  y="24"
                  width="104"
                  height="76"
                  rx="8"
                  className={`demo-svg-box ${idx === step ? "warn" : idx < step ? "active" : ""}`}
                />
                <text x={x + 52} y="52" textAnchor="middle" className="demo-svg-title">
                  {s.k}
                </text>
                <text x={x + 52} y="74" textAnchor="middle" className="demo-svg-sub">
                  {s.v}
                </text>
              </g>
            );
          })}
          {/* Closed-loop feedback path */}
          <path
            d="M 546 100 V 134 H 180 V 100"
            className={`demo-bus ${step >= 3 ? "is-hot" : ""}`}
          />
          <text x="360" y="128" textAnchor="middle" className="demo-svg-sub">
            ◄── 传感器实时反馈闭环 y(k)（误差 e(k) = r - y_f(k)）
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "can-arbitration") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 420 135" className="demo-vector">
          <rect
            x="10"
            y="12"
            width="115"
            height="42"
            rx="6"
            className={`demo-svg-box ${step >= 1 ? "active" : ""}`}
          />
          <text x="67" y="30" textAnchor="middle" className="demo-svg-title">
            Node A (ID=0x120)
          </text>
          <text x="67" y="45" textAnchor="middle" className="demo-svg-sub">
            {step >= 3 ? "✔ 仲裁胜出继续发" : "Bit[2]=0 (显性)"}
          </text>

          <rect
            x="10"
            y="72"
            width="115"
            height="42"
            rx="6"
            className={`demo-svg-box ${step === 1 || step === 2 ? "active" : step >= 3 ? "warn" : ""}`}
          />
          <text x="67" y="90" textAnchor="middle" className="demo-svg-title">
            Node B (ID=0x125)
          </text>
          <text x="67" y="105" textAnchor="middle" className="demo-svg-sub">
            {step >= 3 ? "⏸ 转为接收态" : "Bit[2]=1 (隐性)"}
          </text>

          <rect x="145" y="14" width="265" height="100" rx="8" className="demo-svg-box" />
          <text x="277" y="32" textAnchor="middle" className="demo-svg-title">
            CAN_H / CAN_L 双绞差分总线 (120Ω 终端)
          </text>
          <path
            d={
              step === 0
                ? "M 160 62 L 395 62"
                : "M 160 62 L 185 62 L 185 45 L 225 45 L 225 62 L 265 62 L 265 45 L 340 45 L 340 62 L 395 62"
            }
            className="demo-wave cyn"
          />
          <path
            d={
              step === 0
                ? "M 160 72 L 395 72"
                : "M 160 72 L 185 72 L 185 89 L 225 89 L 225 72 L 265 72 L 265 89 L 340 89 L 340 72 L 395 72"
            }
            className="demo-wave amb"
          />
          <text x="277" y="105" textAnchor="middle" className="demo-svg-sub">
            {step === 0
              ? "空闲隐性 1：CAN_H = CAN_L = 2.5V (ΔV = 0V)"
              : step <= 2
                ? "显性 0：CAN_H=3.5V, CAN_L=1.5V (ΔV = 2.0V)"
                : step === 3
                  ? "Bit[2] 线与结果=0 → Node B 无损退避，零重传冲突"
                  : "CRC15 校验通过 → 接收节点拉低 ACK 槽确认"}
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "power-modes") {
    const modes = [
      { m: "Run (72M)", i: "24 mA", w: "0 µs", bar: 110 },
      { m: "Sleep (WFI)", i: "4.5 mA", w: "1.5 µs", bar: 62 },
      { m: "Stop (保RAM)", i: "14 µA", w: "12 µs", bar: 24 },
      { m: "Standby", i: "1.8 µA", w: "4.5 ms", bar: 12 },
    ];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 160" className="demo-vector" aria-hidden="true">
          {modes.map((item, idx) => {
            const x = 20 + idx * 144;
            const active = step === idx || (step === 4 && idx === 2);
            return (
              <g key={item.m}>
                <rect
                  x={x}
                  y="14"
                  width="132"
                  height="132"
                  rx="8"
                  className={`demo-svg-box ${active ? "active" : ""}`}
                />
                <text x={x + 66} y="36" textAnchor="middle" className="demo-svg-title">
                  {item.m}
                </text>
                <rect
                  x={x + 16}
                  y={104 - item.bar * 0.45}
                  width="100"
                  height={item.bar * 0.45}
                  rx="4"
                  fill={active ? "var(--accent)" : "var(--line-strong)"}
                />
                <text x={x + 66} y="122" textAnchor="middle" className="demo-svg-title">
                  {item.i}
                </text>
                <text x={x + 66} y="138" textAnchor="middle" className="demo-svg-sub">
                  唤醒 {item.w}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (kind === "pcb-return-path") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 420 135" className="demo-vector">
          <rect x="15" y="16" width="390" height="36" rx="5" className="demo-svg-box" />
          <text x="30" y="38" className="demo-svg-title">
            Top 层：高速信号线 (IC1 → IC2)
          </text>
          <path d="M 195 34 L 385 34" className="demo-bus active" />

          <rect
            x="15"
            y="68"
            width="390"
            height="52"
            rx="5"
            className={`demo-svg-box ${step === 2 ? "bad" : "active"}`}
          />
          <text x="30" y="90" className="demo-svg-title">
            L2 参考层：完整 GND 平面
          </text>
          {step === 2 ? (
            <>
              <rect x="265" y="68" width="28" height="52" fill="var(--red-bg)" stroke="var(--red)" />
              <text x="279" y="96" textAnchor="middle" className="demo-svg-sub">
                割裂槽!
              </text>
              <path d="M 385 88 C 340 128, 220 128, 195 88" className="demo-bus bad" />
            </>
          ) : (
            <path d="M 385 86 L 195 86" className="demo-bus active" />
          )}
          <text x="210" y="112" textAnchor="middle" className="demo-svg-sub">
            {step === 2
              ? "⚠ 跨分割迫使镜像回流绕大圈 → 环路面积剧增（EMI辐射+地弹）"
              : step === 3
                ? "✔ 0.1µF MLCC 紧贴芯片引脚（< 2mm），最小化高频 di/dt 环路电感"
                : "✔ 高频返回电流紧贴信号线正下方流动（最小电感路径 L = μ·A/d）"}
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "secure-boot") {
    const chain = [
      { k: "1. OTP / eFuse", v: "公钥 SHA-256 锚点" },
      { k: "2. BootROM", v: "ECDSA 验签 BL" },
      { k: "3. Slot B 验签", v: "防回滚计数器核对" },
      { k: "4. Trial 自检", v: "置位 boot_ok 或回退" },
    ];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 140" className="demo-vector" aria-hidden="true">
          {chain.map((c, idx) => {
            const x = 16 + idx * 145;
            return (
              <g key={c.k}>
                {idx > 0 && (
                  <path d={`M ${x - 15} 70 H ${x}`} className={`demo-bus ${idx <= step ? "is-hot" : ""}`} />
                )}
                <rect
                  x={x}
                  y="24"
                  width="130"
                  height="92"
                  rx="9"
                  className={`demo-svg-box ${idx === Math.min(step, 3) ? "warn" : idx < step ? "active" : ""}`}
                />
                <text x={x + 65} y="58" textAnchor="middle" className="demo-svg-title">
                  {c.k}
                </text>
                <text x={x + 65} y="84" textAnchor="middle" className="demo-svg-sub">
                  {c.v}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (kind === "linux-dtree") {
    const stages = [
      { k: "1. board.dts", v: "reg=<0x40013000>" },
      { k: "2. dtc → .dtb", v: "U-Boot 传参展开" },
      { k: "3. compatible", v: "of_match_table 匹配" },
      { k: "4. probe() 映射", v: "ioremap → /dev 节点" },
    ];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 140" className="demo-vector" aria-hidden="true">
          {stages.map((s, idx) => {
            const x = 16 + idx * 145;
            return (
              <g key={s.k}>
                {idx > 0 && (
                  <path d={`M ${x - 15} 70 H ${x}`} className={`demo-bus ${idx <= step ? "is-hot" : ""}`} />
                )}
                <rect
                  x={x}
                  y="24"
                  width="130"
                  height="92"
                  rx="9"
                  className={`demo-svg-box ${idx === Math.min(step, 3) ? "warn" : idx < step ? "active" : ""}`}
                />
                <text x={x + 65} y="58" textAnchor="middle" className="demo-svg-title">
                  {s.k}
                </text>
                <text x={x + 65} y="84" textAnchor="middle" className="demo-svg-sub">
                  {s.v}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (kind === "cache-dma") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 155" className="demo-vector" aria-hidden="true">
          <rect x="16" y="20" width="165" height="115" rx="9" className="demo-svg-box active" />
          <text x="98" y="48" textAnchor="middle" className="demo-svg-title">Cortex-M7 / A核</text>
          <rect
            x="28"
            y="64"
            width="141"
            height="56"
            rx="6"
            className={`demo-svg-box ${step === 1 ? "bad" : "warn"}`}
          />
          <text x="98" y="88" textAnchor="middle" className="demo-svg-title">L1 D-Cache (32B)</text>
          <text x="98" y="108" textAnchor="middle" className="demo-svg-sub">
            {step <= 1 ? "Dirty: 新帧 0xA5" : step === 2 ? "✔ Clean 写回" : "✔ Invalidate 作废"}
          </text>

          <path d="M 181 78 H 235" className={`demo-bus ${step === 2 || step === 4 ? "is-hot" : ""}`} />

          <rect
            x="235"
            y="20"
            width="165"
            height="115"
            rx="9"
            className={`demo-svg-box ${step === 1 ? "bad" : "active"}`}
          />
          <text x="317" y="48" textAnchor="middle" className="demo-svg-title">物理 SRAM 缓冲区</text>
          <text x="317" y="84" textAnchor="middle" className="demo-svg-title">
            {step === 1 ? "⚠ 仍是旧值 0x00!" : step <= 2 ? "tx_buf = 0xA5" : "rx_buf = 0x5A"}
          </text>
          <text x="317" y="110" textAnchor="middle" className="demo-svg-sub">
            32 字节 Cache-Line 对齐
          </text>

          <path d="M 400 78 H 445" className="demo-bus is-hot" />

          <rect x="445" y="20" width="139" height="115" rx="9" className="demo-svg-box active" />
          <text x="514" y="54" textAnchor="middle" className="demo-svg-title">DMA 控制器</text>
          <text x="514" y="84" textAnchor="middle" className="demo-svg-sub">绕过 CPU Cache</text>
          <text x="514" y="106" textAnchor="middle" className="demo-svg-sub">直连物理 SRAM</text>
        </svg>
      </div>
    );
  }

  if (kind === "tinyml-quant") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 150" className="demo-vector" aria-hidden="true">
          <rect x="16" y="22" width="168" height="106" rx="9" className={`demo-svg-box ${step === 0 ? "warn" : ""}`} />
          <text x="100" y="50" textAnchor="middle" className="demo-svg-title">FP32 浮点权重</text>
          <text x="100" y="78" textAnchor="middle" className="demo-svg-title">128 KB (4B/参数)</text>
          <text x="100" y="104" textAnchor="middle" className="demo-svg-sub">算力与 Flash 超标</text>

          <path d="M 184 75 H 224" className="demo-bus is-hot" />

          <rect x="224" y="22" width="168" height="106" rx="9" className={`demo-svg-box ${step >= 1 && step <= 2 ? "active" : ""}`} />
          <text x="308" y="50" textAnchor="middle" className="demo-svg-title">INT8 对称量化</text>
          <text x="308" y="78" textAnchor="middle" className="demo-svg-title">32 KB (省 75%)</text>
          <text x="308" y="104" textAnchor="middle" className="demo-svg-sub">q = round(r/S) + Z</text>

          <path d="M 392 75 H 432" className={`demo-bus ${step >= 3 ? "is-hot" : ""}`} />

          <rect x="432" y="22" width="152" height="106" rx="9" className={`demo-svg-box ${step >= 3 ? "active" : ""}`} />
          <text x="508" y="50" textAnchor="middle" className="demo-svg-title">CMSIS-NN + Arena</text>
          <text x="508" y="78" textAnchor="middle" className="demo-svg-sub">__SMLAD 4路乘加</text>
          <text x="508" y="104" textAnchor="middle" className="demo-svg-sub">静态乒乓零 malloc</text>
        </svg>
      </div>
    );
  }

  if (kind === "motor-pwm") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 420 130" className="demo-vector">
          <text x="14" y="34" className="demo-svg-title">TIM1_CH1 (上管)</text>
          <path d="M 115 42 L 155 42 L 155 18 L 275 18 L 275 42 L 395 42" className="demo-wave cyn" />

          <text x="14" y="76" className="demo-svg-title">TIM1_CH1N (下管)</text>
          <path
            d={
              step === 1
                ? "M 115 60 L 155 60 L 155 84 L 275 84 L 275 60 L 395 60"
                : "M 115 60 L 138 60 L 138 84 L 292 84 L 292 60 L 395 60"
            }
            className={`demo-wave ${step === 1 ? "amb" : "grn"}`}
          />

          <rect x="138" y="14" width="17" height="74" fill="var(--amb-bg)" opacity={step >= 2 ? 0.85 : 0.25} />
          <rect x="275" y="14" width="17" height="74" fill="var(--amb-bg)" opacity={step >= 2 ? 0.85 : 0.25} />
          <text x="255" y="112" textAnchor="middle" className="demo-svg-sub">
            {step === 1
              ? "⚠ 关断延迟 t_off > t_on：无死区时切换瞬间上下管直通短路炸管！"
              : step >= 4
                ? "✔ 死区 500ns 防直通 + TIM1_CCR4 在下管导通中心点触发 ADC 电流采样"
                : "✔ BDTR.DTG 硬件插入上下管全关安全死区 (Dead-Time = 500 ns)"}
          </text>
        </svg>
      </div>
    );
  }

  if (kind === "fsm-watchdog") {
    const states = [
      { s: "1. INIT 自检", d: "CRC 与传感器核对" },
      { s: "2. NORMAL", d: "查表驱动闭环运行" },
      { s: "3. DEGRADED", d: "瞬态异常限功率降级" },
      { s: "4. FAULT_LATCH", d: "硬件关断 + 位图喂狗" },
    ];
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 140" className="demo-vector" aria-hidden="true">
          {states.map((st, idx) => {
            const x = 16 + idx * 145;
            return (
              <g key={st.s}>
                {idx > 0 && (
                  <path d={`M ${x - 15} 70 H ${x}`} className={`demo-bus ${idx <= step ? "is-hot" : ""}`} />
                )}
                <rect
                  x={x}
                  y="24"
                  width="130"
                  height="92"
                  rx="9"
                  className={`demo-svg-box ${idx === 3 && step >= 3 ? "bad" : idx === step ? "warn" : idx < step ? "active" : ""}`}
                />
                <text x={x + 65} y="58" textAnchor="middle" className="demo-svg-title">
                  {st.s}
                </text>
                <text x={x + 65} y="84" textAnchor="middle" className="demo-svg-sub">
                  {st.d}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (kind === "dsp-aliasing") {
    return (
      <div className="demo-svg-wrap">
        <svg viewBox="0 0 600 155" className="demo-vector" aria-hidden="true">
          <rect x="16" y="18" width="272" height="118" rx="9" className={`demo-svg-box ${step === 1 ? "bad" : "active"}`} />
          <text x="152" y="42" textAnchor="middle" className="demo-svg-title">
            采样率 fs = 1000 Hz (Nyquist 500 Hz)
          </text>
          <path
            d="M 32 82 Q 62 42, 92 82 T 152 82 T 212 82 T 272 82"
            className={`demo-wave ${step === 1 ? "amb" : "cyn"}`}
          />
          <text x="152" y="118" textAnchor="middle" className="demo-svg-sub">
            {step <= 1 ? "⚠ 900 Hz 干扰折叠成 100 Hz 混叠假波!" : "✔ ADC 前置模拟低通 AAF 滤除 >500 Hz"}
          </text>

          <rect x="312" y="18" width="272" height="118" rx="9" className={`demo-svg-box ${step >= 4 ? "active" : ""}`} />
          <text x="448" y="42" textAnchor="middle" className="demo-svg-title">
            加窗 FFT 频谱分析 (Hann Window)
          </text>
          <path
            d={
              step >= 4
                ? "M 332 100 L 420 100 L 432 46 L 444 100 L 560 100"
                : "M 332 100 L 395 78 L 415 62 L 432 48 L 450 62 L 470 78 L 560 100"
            }
            className="demo-wave grn"
          />
          <text x="448" y="118" textAnchor="middle" className="demo-svg-sub">
            {step >= 4 ? "✔ 去均值 + Hann 窗抑制旁瓣泄漏" : "矩形直接截断导致严重频谱旁瓣泄漏"}
          </text>
        </svg>
      </div>
    );
  }

  return null;
}

export function LearningDemo({ kind }: { kind: string }) {
  const demo = Object.prototype.hasOwnProperty.call(demos, kind)
    ? demos[kind as keyof typeof demos]
    : undefined;
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [kind]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopForPreference = () => {
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", stopForPreference);
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) setPlaying(false);
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", stop);
      preference.removeEventListener("change", stopForPreference);
    };
  }, []);
  useEffect(() => {
    if (!playing || !demo) return;
    const timer = window.setTimeout(
      () => setStep((value) => (value + 1) % demo.text.length),
      2100,
    );
    return () => clearTimeout(timer);
  }, [playing, step, demo]);
  if (!demo) return <p>此原理演示暂不支持，请阅读下方文字说明。</p>;
  const next = () => {
    setPlaying(false);
    setStep(Math.min(step + 1, demo.text.length - 1));
  };
  const customScene = EmbeddedDemoScene({ kind, step });
  return (
    <figure className="learning-demo" ref={root} aria-label={demo.title}>
      <figcaption>
        <span className="eyebrow">
          <Sparkles size={13} />
          {demo.badge || "动手理解 · 动态机制推演"}
        </span>
        <strong>{demo.title}</strong>
      </figcaption>
      <ol className="demo-steps">
        {demo.labels.map((label, index) => (
          <li
            key={label}
            data-active={index === step}
            data-done={index < step}
            onClick={() => {
              setPlaying(false);
              setStep(index);
            }}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="demo-scene" aria-hidden="true">
        {customScene ? (
          customScene
        ) : kind === "ownership" ? (
          <>
            <div className={`demo-node ${step < 2 ? "on" : ""}`}>
              owner A<br />
              <small>{step < 2 ? "拥有资源" : "空"}</small>
            </div>
            <ArrowRight />
            <div className={`demo-resource ${step < 3 ? "on" : ""}`}>
              {step < 3 ? "资源 42" : "已释放"}
              <small>
                {step === 1 || step === 2
                  ? "view 借用"
                  : step === 3
                    ? "view 失效"
                    : ""}
              </small>
            </div>
            <ArrowRight />
            <div className={`demo-node ${step === 2 ? "on" : ""}`}>
              owner B<br />
              <small>{step === 2 ? "拥有资源" : "空"}</small>
            </div>
          </>
        ) : kind === "tcp" ? (
          <div className="byte-stream">
            {["00", "00", "00", "06", "E4", "BD", "A0", "E5", "A5", "BD"].map(
              (byte, i) => (
                <span
                  key={i}
                  data-filled={i < [0, 2, 7, 10][step]}
                  data-header={i < 4}
                >
                  {byte}
                </span>
              ),
            )}
          </div>
        ) : kind === "queue" ? (
          <div className="queue-slots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} data-filled={i < [0, 2, 4, 4, 3, 0][step]}>
                {i + 1}
              </span>
            ))}
          </div>
        ) : (
          <div className="boot-stage">
            <span>{String(step + 1).padStart(2, "0")}</span>
            <strong>{demo.labels[step]}</strong>
            <small>
              {kind === "boot"
                ? "只证明当前阶段，继续检查下一层"
                : "教学示意 · 点击下一步追踪边界"}
            </small>
          </div>
        )}
      </div>
      <p className="demo-explanation" aria-live="polite" aria-atomic="true">
        {demo.text[step]}
      </p>
      <div className="demo-controls">
        <button
          className="button"
          onClick={next}
          disabled={step === demo.text.length - 1}
        >
          下一步
          <ArrowRight size={16} />
        </button>
        <button
          className="button quiet"
          aria-label={playing ? "暂停演示" : "播放演示"}
          aria-pressed={playing}
          onClick={() => {
            if (reducedMotion()) {
              setPlaying(false);
              setStep((value) =>
                value === demo.text.length - 1 ? 0 : value + 1,
              );
            } else {
              if (step === demo.text.length - 1) setStep(0);
              setPlaying(!playing);
            }
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span>{playing ? "暂停" : "播放"}</span>
        </button>
        <button
          className="icon-button"
          aria-label="重新开始演示"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </figure>
  );
}
