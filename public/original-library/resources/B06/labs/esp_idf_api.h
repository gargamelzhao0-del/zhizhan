/* esp_idf_api.h —— ESP-IDF / Xtensa 侧用到的接口子集（仅声明，供交叉编译验证）。 */
#ifndef ESP_IDF_API_H
#define ESP_IDF_API_H

#include <stdint.h>
#include <stddef.h>
#include "rtos_api.h"

#define IRAM_ATTR __attribute__((section(".iram1")))
#define MALLOC_CAP_8BIT (1u << 2)
#define MALLOC_CAP_DMA  (1u << 3)

typedef struct { int owner; } portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED { -1 }

void       portENTER_CRITICAL(portMUX_TYPE *m);
void       portEXIT_CRITICAL(portMUX_TYPE *m);
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t fn, const char *name, uint32_t stack,
                                   void *arg, UBaseType_t prio, TaskHandle_t *out, BaseType_t core);
BaseType_t xPortGetCoreID(void);
uint32_t   esp_get_free_heap_size(void);
void      *heap_caps_malloc(size_t size, uint32_t caps);
uint32_t   heap_caps_get_free_size(uint32_t caps);
int        esp_task_wdt_add(void *handle);
int        esp_task_wdt_reset(void);
void       esp_sleep_enable_timer_wakeup(uint64_t us);
void       esp_deep_sleep_start(void);

#endif /* ESP_IDF_API_H */
