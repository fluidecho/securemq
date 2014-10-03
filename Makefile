SIZE=200
DURATION=5000
PER_TICK=10

bench:
	node benchmark/pub --size $(SIZE) --duration $(DURATION) --per-tick $(PER_TICK) &
	sleep 3
	node benchmark/sub --size $(SIZE) --duration $(DURATION)
	
benchbatch:
	node benchmark/pubbatch --size $(SIZE) --duration $(DURATION) &
	sleep 3
	node benchmark/subbatch --size $(SIZE) --duration $(DURATION)
