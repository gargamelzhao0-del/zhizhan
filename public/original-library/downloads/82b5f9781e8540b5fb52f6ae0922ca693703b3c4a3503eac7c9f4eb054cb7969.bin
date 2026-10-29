CC = gcc
CFLAGS = -std=c11 -Wall -Wextra
app: main.o stats.o
	$(CC) $(CFLAGS) main.o stats.o -o app
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@
clean:
	rm -f *.o app
