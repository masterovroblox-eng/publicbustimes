import os

# loglevel = "debug"
log_file = "-"

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

worker_tmp_dir = "/dev/shm"
timeout = 30

limit_request_field_size = 16380  # default is 8190, max is 16380
