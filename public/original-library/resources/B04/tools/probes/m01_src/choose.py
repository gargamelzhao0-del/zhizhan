def where_to_run(need_hard_realtime, offline, ms_latency):
    if need_hard_realtime or offline or ms_latency:
        return "device (MicroPython)"
    return "host (CPython)"

print(where_to_run(True, False, False))
print(where_to_run(False, False, False))
