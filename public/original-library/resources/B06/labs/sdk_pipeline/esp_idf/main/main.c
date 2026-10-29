#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_timer.h"
#include "sample.h"
static QueueHandle_t samples;
static void producer(void *arg) {
    (void)arg;uint32_t dropped=0;
    for(uint32_t seq=0;;++seq) {
        Sample s;
        if(sample_make(&s,seq,(uint32_t)(esp_timer_get_time()/1000),seq%4096U) &&
           xQueueSend(samples,&s,0)!=pdTRUE)
            printf("DROP %lu total=%lu\n",(unsigned long)seq,(unsigned long)++dropped);
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
void app_main(void) {
    samples=xQueueCreate(4,sizeof(Sample));
    if(!samples){puts("queue allocation failed");return;}
    if(xTaskCreate(producer,"producer",3072,NULL,5,NULL)!=pdPASS) {
        vQueueDelete(samples);puts("task allocation failed");return;
    }
    Sample s;
    while(1) {
        if(xQueueReceive(samples,&s,portMAX_DELAY)==pdTRUE)
            printf("SAMPLE %lu,%lu,%u,%u\n",(unsigned long)s.seq,(unsigned long)s.ms,
                   (unsigned)s.raw,(unsigned)s.mv);
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}
