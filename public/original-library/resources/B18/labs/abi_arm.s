	.cpu cortex-m3
	.arch armv7-m
	.fpu softvfp
	.eabi_attribute 20, 1
	.eabi_attribute 21, 1
	.eabi_attribute 23, 3
	.eabi_attribute 24, 1
	.eabi_attribute 25, 1
	.eabi_attribute 26, 1
	.eabi_attribute 30, 2
	.eabi_attribute 34, 1
	.eabi_attribute 18, 4
	.file	"_abi_probe.c"
	.text
	.align	1
	.p2align 2,,3
	.global	leaf
	.syntax unified
	.thumb
	.thumb_func
	.type	leaf, %function
leaf:
	@ args = 0, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	add	r1, r1, r1, lsl #1
	add	r0, r0, r1
	bx	lr
	.size	leaf, .-leaf
	.align	1
	.p2align 2,,3
	.global	five
	.syntax unified
	.thumb
	.thumb_func
	.type	five, %function
five:
	@ args = 4, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	add	r0, r0, r1
	add	r0, r0, r2
	add	r0, r0, r3
	ldr	r3, [sp]
	add	r0, r0, r3
	bx	lr
	.size	five, .-five
	.align	1
	.p2align 2,,3
	.global	sum_loop
	.syntax unified
	.thumb
	.thumb_func
	.type	sum_loop, %function
sum_loop:
	@ args = 0, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	mov	r3, r0
	cbz	r1, .L7
	movs	r0, #0
	subs	r3, r3, #4
	add	r1, r3, r1, lsl #2
.L6:
	ldr	r2, [r3, #4]!
	cmp	r3, r1
	add	r0, r0, r2
	bne	.L6
	bx	lr
.L7:
	mov	r0, r1
	bx	lr
	.size	sum_loop, .-sum_loop
	.ident	"GCC: (Arm GNU Toolchain 13.3.Rel1 (Build arm-13.24)) 13.3.1 20240614"
