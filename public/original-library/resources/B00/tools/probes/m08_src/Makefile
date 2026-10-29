CC = gcc
CFLAGS = -std=c11 -Wall -Wextra
app: main.o math_utils.o
	$(CC) $(CFLAGS) main.o math_utils.o -o app
main.o: main.c math_utils.h
	$(CC) $(CFLAGS) -c main.c -o main.o
math_utils.o: math_utils.c math_utils.h
	$(CC) $(CFLAGS) -c math_utils.c -o math_utils.o
clean:
	rm -f *.o app
