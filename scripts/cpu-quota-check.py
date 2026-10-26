"""Approximate a Linux 50ms/100ms CPU quota for one server process.

Child test clients run separately. This is a local scheduler stress fixture,
not a substitute for production host measurements. The sampling interval permits a small overshoot at each quota boundary.
"""
import os
import ctypes
import signal
import subprocess
import sys
import time

process = subprocess.Popen(sys.argv[1:])
clock_value = ctypes.c_int()
error = ctypes.CDLL(None).clock_getcpuclockid(process.pid, ctypes.byref(clock_value))
if error:
    process.terminate()
    raise OSError(error, 'Process CPU clock unavailable')
clock_id = clock_value.value
period = 0.1
budget = 0.05

def cpu_seconds():
    return time.clock_gettime(clock_id)

start = time.monotonic()
window = start
used = cpu_seconds()
stopped = False
pauses = 0
try:
    while process.poll() is None:
        now = time.monotonic()
        if now - window >= period:
            window += int((now - window) / period) * period
            used = cpu_seconds()
            if stopped:
                os.kill(process.pid, signal.SIGCONT)
                stopped = False
        if not stopped and cpu_seconds() - used >= budget:
            os.kill(process.pid, signal.SIGSTOP)
            stopped = True
            pauses += 1
        time.sleep(0.002)
except (FileNotFoundError, ProcessLookupError, OSError):
    pass
finally:
    if stopped and process.poll() is None:
        os.kill(process.pid, signal.SIGCONT)
print(f'Local CPU quota approximation: {budget*1000:.0f}/{period*1000:.0f} ms, {pauses} pauses', flush=True)
sys.exit(process.wait())
