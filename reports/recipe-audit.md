# Audyt receptur na podstawie plików gry

Audyt źródłowych JSON-ów, przed rozwinięciem grup w widoku. Overhaul obejmuje bazowe DOS2 i dodatki moda. Dopasowania używają nazw gry, Stats ID i kategorii, bez podobieństwa tekstowego. Dopasowanie oznacza znalezienie zgodnej definicji, a nie pełną weryfikację działania gry. Ilości DOS1, efekty, zużywanie narzędzi, losowe wyniki i ulepszenia wyposażenia nie są w pełni sprawdzane. Brak dopasowania nie oznacza błędu. Opcjonalne Gift Bagi pominięto. Różne wyniki są kandydatami do oceny, nie automatycznym dowodem błędu.

| Katalog | Wpisy źródłowe | Definicje gry | Dopasowane | Rozbieżne ilości/wymagania | Inny wynik | Pozostałe do sprawdzenia |
|---|---:|---:|---:|---:|---:|---:|
| dos1 | 438 | 1481 | 218 | 0 | 0 | 220 |
| dos2 | 585 | 909 | 473 | 0 | 0 | 112 |
| dos2-overhaul | 1510 | 2370 | 874 | 0 | 1 | 635 |

## dos1: przypadki do oceny


## dos2: przypadki do oceny


## dos2-overhaul: przypadki do oceny

- **Large Healing Potion**: Empty Potion Bottle + Penny Bun Mushroom + Penny Bun Mushroom + Penny Bun Mushroom + Penny Bun Mushroom — `different_result`. 
  - `.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt:1064` (`CON_Potion_Empty_A_CON_Herb_Mushroom_A_3`). Wyniki: Healing Potion
