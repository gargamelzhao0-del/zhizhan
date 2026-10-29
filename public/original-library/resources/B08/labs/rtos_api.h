/* rtos_api.h —— 本册自带的 FreeRTOS 风格接口子集（仅声明，供交叉编译做语法/调用约定验证）。
 *
 * 说明（证据分级）：这里声明的签名与 FreeRTOS v10.5.x 常用 API 保持一致；
 * 它让示例代码能被 arm-none-eabi-gcc / xtensa-esp32-elf-gcc 以 -Wall -Wextra 编译，
 * 从而验证“类型、参数、临界区/FromISR 用法”是否写对。它不提供真实内核实现，
 * 运行期数值由本册主机程序（host_*.c）给出。
 */
#ifndef RTOS_API_H
#define RTOS_API_H

#include <stdint.h>
#include <stddef.h>

typedef int            BaseType_t;
typedef unsigned int   UBaseType_t;
typedef uint32_t       TickType_t;
typedef uint32_t       StackType_t;
typedef uint32_t       EventBits_t;

typedef void *         TaskHandle_t;
typedef void *         SemaphoreHandle_t;
typedef void *         QueueHandle_t;
typedef void *         EventGroupHandle_t;
typedef void *         TimerHandle_t;
typedef void *         StreamBufferHandle_t;
typedef void *         MessageBufferHandle_t;

typedef struct { uint32_t dummy; } StaticTask_t;
typedef struct { uint32_t dummy; } StaticSemaphore_t;
typedef struct { uint32_t dummy; } StaticQueue_t;
typedef struct { uint32_t dummy; } StaticEventGroup_t;

typedef void (*TaskFunction_t)(void *);
typedef void (*TimerCallbackFunction_t)(TimerHandle_t);
typedef void (*PendedFunction_t)(void *, uint32_t);

#define pdTRUE          ((BaseType_t)1)
#define pdFALSE         ((BaseType_t)0)
#define pdPASS          pdTRUE
#define pdFAIL          pdFALSE
#define portMAX_DELAY   ((TickType_t)0xFFFFFFFFu)
#define configTICK_RATE_HZ            1000u
#define configMAX_PRIORITIES          8u
#define configMINIMAL_STACK_SIZE      128u
#define configCHECK_FOR_STACK_OVERFLOW 2u
#define configUSE_PREEMPTION          1u
#define configUSE_MUTEXES             1u
#define configUSE_TICKLESS_IDLE       1u
#define configMAX_SYSCALL_INTERRUPT_PRIORITY  0x50u   /* Cortex-M NVIC 优先级阈值 */
#define pdMS_TO_TICKS(ms) ((TickType_t)(((uint32_t)(ms) * configTICK_RATE_HZ) / 1000u))

/* 任务 */
BaseType_t xTaskCreate(TaskFunction_t fn, const char *name, uint16_t stack, void *arg,
                       UBaseType_t prio, TaskHandle_t *out);
TaskHandle_t xTaskCreateStatic(TaskFunction_t fn, const char *name, uint32_t stack,
                               void *arg, UBaseType_t prio, StackType_t *buf, StaticTask_t *tcb);
void       vTaskDelete(TaskHandle_t t);
void       vTaskDelay(TickType_t ticks);
void       vTaskDelayUntil(TickType_t *prev, TickType_t period);
void       vTaskSuspend(TaskHandle_t t);
void       vTaskResume(TaskHandle_t t);
TickType_t xTaskGetTickCount(void);
UBaseType_t uxTaskGetStackHighWaterMark(TaskHandle_t t);
TaskHandle_t xTaskGetCurrentTaskHandle(void);
void       taskYIELD(void);

/* 同步原语 */
SemaphoreHandle_t xSemaphoreCreateBinary(void);
SemaphoreHandle_t xSemaphoreCreateCounting(UBaseType_t max, UBaseType_t initial);
SemaphoreHandle_t xSemaphoreCreateMutex(void);
SemaphoreHandle_t xSemaphoreCreateRecursiveMutex(void);
BaseType_t xSemaphoreTake(SemaphoreHandle_t s, TickType_t wait);
BaseType_t xSemaphoreGive(SemaphoreHandle_t s);
BaseType_t xSemaphoreTakeRecursive(SemaphoreHandle_t s, TickType_t wait);
BaseType_t xSemaphoreGiveRecursive(SemaphoreHandle_t s);
BaseType_t xSemaphoreGiveFromISR(SemaphoreHandle_t s, BaseType_t *woken);
BaseType_t xSemaphoreTakeFromISR(SemaphoreHandle_t s, BaseType_t *woken);

/* 队列与缓冲 */
QueueHandle_t xQueueCreate(UBaseType_t len, UBaseType_t item_size);
BaseType_t    xQueueSend(QueueHandle_t q, const void *item, TickType_t wait);
BaseType_t    xQueueReceive(QueueHandle_t q, void *item, TickType_t wait);
BaseType_t    xQueueSendFromISR(QueueHandle_t q, const void *item, BaseType_t *woken);
BaseType_t    xQueueReceiveFromISR(QueueHandle_t q, void *item, BaseType_t *woken);
UBaseType_t   uxQueueMessagesWaiting(QueueHandle_t q);
StreamBufferHandle_t xStreamBufferCreate(size_t size, size_t trigger);
size_t xStreamBufferSend(StreamBufferHandle_t b, const void *data, size_t n, TickType_t wait);
size_t xStreamBufferReceive(StreamBufferHandle_t b, void *data, size_t n, TickType_t wait);
MessageBufferHandle_t xMessageBufferCreate(size_t size);

/* 事件组 */
EventGroupHandle_t xEventGroupCreate(void);
EventBits_t xEventGroupSetBits(EventGroupHandle_t g, EventBits_t bits);
EventBits_t xEventGroupWaitBits(EventGroupHandle_t g, EventBits_t bits,
                                BaseType_t clear, BaseType_t all, TickType_t wait);
EventBits_t xEventGroupClearBits(EventGroupHandle_t g, EventBits_t bits);

/* 软件定时器 */
TimerHandle_t xTimerCreate(const char *name, TickType_t period, UBaseType_t reload,
                           void *id, TimerCallbackFunction_t cb);
BaseType_t xTimerStart(TimerHandle_t t, TickType_t wait);
BaseType_t xTimerStop(TimerHandle_t t, TickType_t wait);
BaseType_t xTimerPendFunctionCall(PendedFunction_t fn, void *arg1, uint32_t arg2, TickType_t wait);

/* 临界区 / 调度 */
void taskENTER_CRITICAL(void);
void taskEXIT_CRITICAL(void);
UBaseType_t taskENTER_CRITICAL_FROM_ISR(void);
void taskEXIT_CRITICAL_FROM_ISR(UBaseType_t saved);
void portYIELD_FROM_ISR(BaseType_t woken);
void portYIELD(void);

/* 空闲/溢出钩子由应用实现 */
void vApplicationIdleHook(void);
void vApplicationStackOverflowHook(TaskHandle_t t, char *name);
void vApplicationTickHook(void);

#endif /* RTOS_API_H */
