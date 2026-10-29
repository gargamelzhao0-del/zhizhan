ENTRY(Reset_Handler)
MEMORY {
 FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 64K
 RAM (rwx) : ORIGIN = 0x20000000, LENGTH = 20K
}
_estack = ORIGIN(RAM) + LENGTH(RAM);
SECTIONS {
 .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
 .text : { *(.text*) *(.rodata*) } > FLASH
 .data : { _sdata = .; *(.data*) _edata = .; } > RAM AT> FLASH
 _sidata = LOADADDR(.data);
 .bss (NOLOAD) : { _sbss = .; *(.bss*) *(COMMON) _ebss = .; } > RAM
 ASSERT(_ebss <= _estack-1024, "RAM exceeded reserved 1KiB stack")
}
