num = 100010291820984190248192

for i in range(1, num + 1):
    n = i
    sequence = [n]
    while n != 1:
        if n % 2 == 0:
            n = n // 2
        else:
            n = 3 * n + 1
        sequence.append(n)
    print(f"Starting number: {i}, Sequence: {sequence}")