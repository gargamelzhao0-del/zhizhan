/* host_container.c —— 固定容量对象池 + 侵入式链表（有界，无运行期分配）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_container.c -o host_container && ./host_container
 */
#include <stdio.h>

#define POOL_CAP 4
typedef struct node { struct node *next; int val; } node_t;

/* 对象池：POOL_CAP 个固定对象，空闲链用侵入式 next 串起，回收即可复用 */
static node_t pool[POOL_CAP];
static node_t *free_list = NULL;   /* 空闲对象链（侵入式：借对象自身的 next） */
static int used = 0;               /* 已分配计数 */

static void pool_init(void) {
    free_list = NULL;
    for (int i = POOL_CAP - 1; i >= 0; i--) { pool[i].next = free_list; free_list = &pool[i]; }
    used = 0;
}
static node_t *pool_alloc(int v) {          /* 固定内存：满时返回 NULL，绝不运行期 malloc */
    if (!free_list) return NULL;
    node_t *n = free_list; free_list = n->next; n->next = NULL; n->val = v; used++;
    return n;
}
static void pool_free(node_t *n) { n->next = free_list; free_list = n; used--; }

int main(void) {
    int ok = 1;
    pool_init();

    /* 1) 固定容量：连发 POOL_CAP 个后，再分配应为 NULL（分配失败，无碎片） */
    node_t *head = NULL;
    for (int i = 1; i <= POOL_CAP; i++) {
        node_t *n = pool_alloc(i);
        if (!n) { ok = 0; continue; }
        n->next = head; head = n;           /* 头插，构成侵入式链表（零额外分配） */
    }
    node_t *over = pool_alloc(99);
    printf("池容量=%d，满后再分配=%s（期望 NULL）\n", POOL_CAP, over ? "非空" : "NULL");
    if (over != NULL) ok = 0;

    /* 2) 侵入式链表遍历：头插 1..4 → 遍历顺序 4 3 2 1，节点数=4、元素和=10 */
    int sum = 0, cnt = 0;
    printf("遍历: ");
    for (node_t *q = head; q; q = q->next) { printf("%d ", q->val); sum += q->val; cnt++; }
    printf("(期望 4 3 2 1)\n");
    printf("节点数=%d 元素和=%d（期望 4 10）\n", cnt, sum);
    if (cnt != POOL_CAP || sum != 10) ok = 0;

    /* 3) 回收一个后可再分配（地址复用同一固定池，无运行期分配） */
    pool_free(head);
    printf("释放 1 个后 used=%d（期望 3）\n", used);
    if (used != 3) ok = 0;
    node_t *again = pool_alloc(7);
    printf("回收后可再分配: val=%d（期望 7）\n", again ? again->val : -1);
    if (!again || again->val != 7) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
