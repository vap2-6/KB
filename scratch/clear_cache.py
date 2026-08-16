import os, glob

for f in glob.glob('/app/**/*.pyc', recursive=True):
    try:
        os.remove(f)
        print("Removed pyc:", f)
    except Exception:
        pass
