#include <stdio.h>

typedef struct { int x, y; } Point;          /* typedef：给类型起短名 */
enum Color { RED, GREEN, BLUE };             /* 枚举：一组命名常量 */

double dist2(const Point *p) {               /* 传指针，省拷贝 */
    return (double)p->x * p->x + (double)p->y * p->y;
}

int main(void)
{
    Point pts[3] = { {0, 0}, {3, 4}, {1, 1} };
    for (int i = 0; i < 3; i++)
        printf("P%d=(%d,%d)  dist2=%.0f\n", i, pts[i].x, pts[i].y, dist2(&pts[i]));

    enum Color c = GREEN;
    printf("color index = %d\n", c);
    return 0;
}
