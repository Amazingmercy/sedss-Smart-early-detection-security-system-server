# time_short.py

print("⏰ TIME EMOJI\n")

h = int(input("Hour (1-12): "))
t = input("AM or PM? ").upper()

print("\n" + "="*20)

if t == "AM":
    if h < 5: print("🌙 Good night!")
    elif h < 8: print("🌅 Good morning!")
    else: print("☀️ Morning!")
else:
    if h < 3: print("☀️ Afternoon!")
    elif h < 6: print("🌇 Evening!")
    else: print("🌙 Night!")

print("="*20)