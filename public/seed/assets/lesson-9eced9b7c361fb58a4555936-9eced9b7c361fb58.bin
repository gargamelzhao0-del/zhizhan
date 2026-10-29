CC := arm-none-eabi-gcc
OBJCOPY := arm-none-eabi-objcopy
CFLAGS := -mcpu=cortex-m3 -mthumb -std=c11 -Os -Wall -Wextra -Werror -ffreestanding -ffunction-sections -fdata-sections
node.elf: startup.c main.c linker.ld
	$(CC) $(CFLAGS) -nostdlib -T linker.ld -Wl,--gc-sections,-Map=node.map startup.c main.c -o $@
node.bin: node.elf
	$(OBJCOPY) -O binary $< $@
.PHONY: all
all: node.bin
