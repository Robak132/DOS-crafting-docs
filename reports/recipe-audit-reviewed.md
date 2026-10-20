# Sprawdzenie receptur w plikach gry — ustalenia po ręcznej ocenie

Data: 2026-10-20. Sprawdzono DOS1 Enhanced Edition, DOS2 **Definitive Edition**
oraz zainstalowany Workshop Crafting Overhaul [DE], a nie wersję Classic DOS2.
Definicje `ItemCombos.txt` ponownie wypakowano z lokalnych plików `.pak`.
Dla DOS2 uwzględniono nadpisania modułów Shared/Origins z patchy.
Opcjonalnych modułów Gift Bag nie włączano do podstawowego DOS2.

**Status: wszystkie dziewięć rozbieżności z pierwszego audytu poprawiono bezpośrednio w źródłowych JSON-ach aplikacji. Poniższa tabela zachowuje porównanie stanu sprzed poprawki z regułą gry. Nie dodawano plików nadpisujących nazwy ani aliasów.**

## Poprawione rozbieżności z pierwszego audytu

| Tryb | Receptura | Dane aplikacji | Definicja gry |
|---|---|---|---|
| DOS1 EE | Fire Arrowhead + Cup of Oil → Explosive Arrowhead | Brak wymagań | Crafting 2 |
| DOS1 EE | Iron Bar + Iron Bar → Large Iron Bar | Blacksmithing 1 | Brak `requires` w tej definicji |
| DOS1 EE | Rope + Magical Lucky Rabbit Paw → Lucky Rabbit Paw Belt | Crafting 3 | Crafting 1 |
| DOS1 EE | Barrel + Rope → Poorman's Best | Brak wymagań | Crafting 1 |
| DOS1 EE | Arrow Shaft + Slowdown Arrowhead → Slowdown Arrow | Crafting 2 | Crafting 1 |
| DOS1 EE | Arrowhead + Cup of Oil → Slowdown Arrowhead | Brak wymagań | Crafting 2 |
| DOS1 EE | Pixie Dust + Chicken Foot | Wynik Chicken Foot | Wynik `LOOT_Foot_Chicken_A_Magic`, Magical Chicken foot |
| Crafting Overhaul | Thread + Thread + Spinning Wheel → Cloth Scraps | Domyślnie 1 sztuka | `ResultAmount 1 = 2` |
| Crafting Overhaul | Shrieker Soul + Long Branch + Metal Scraps + Crafter's Hammer, stanowisko Anvil | Wynik Shrieker Soul | Wynik `WPN_CorpseHarvester_32_ShriekerSycthe`; `PreviewTooltip = Shrieker's Scythe` |

Podstawa dla pierwszych siedmiu pozycji:
`.pak-work/audit-current/dos1/Public/Shared/Stats/ItemCombos.txt`,
odpowiednio linie **950, 785, 880, 185, 980, 947, 840**.
Definicja z olejem zwraca również pusty kubek; tabela opisuje główny wynik,
a nie wszystkie produkty uboczne.

Podstawa dla Cloth Scraps:
`.pak-work/audit-current/overhaul/Public/Crafting_Overhaul_6aaa43a9-3a72-e82e-a6f6-8c367fd82117/Stats/Generated/ItemCombos.txt`,
linie **23954–23969**, identyfikator `Spinning_Wheel_Useful_3`.

Podstawa dla Shrieker's Scythe: ten sam plik moda, linie **25270–25295**,
identyfikator `Craft_CorpseHarvester_32_ShriekerScythe`.
W tej definicji dusza jest zużywanym składnikiem, a kosa jest wynikiem.

## Dalszy audyt i wykonane poprawki

- **96 receptur Crafting Overhaul:** używają `Crafter's Workbench` (`FUR_Workbench_2`), zamiast zwykłego `Workbench` (`FUR_Workbench`). Zwykły warsztat pozostaje jako przedmiot rozbierany kilofem.
- **10 wpisów DOS1** z progami Crafting przeniesiono z katalogu DOS2 do DOS1. Warianty prawidłowe w obu grach nadal mają osobne definicje w odpowiednich katalogach; poprawne receptury DOS2 zachowano. Nazwy Drudenae, Poisoned Arrowhead, Magic Starfish i Taser Grenade pochodzą z lokalizacji DOS1.
- **Dwa akcesoria z kurzej łapki:** Chicken Amulet i Chicken Belt wymagają Magical Chicken foot.
- **Pięć receptur flakonów oleju/trucizny:** wymagają Empty Flask, nie Empty Bottle. Wariant z beczką szlamu nie wymaga Crafting 1.
- **Thread z włosów:** poprawiono Well na Spinning Wheel.
- **Shocking Touch Scroll:** esencja musi należeć do EssenceAir, a nie dowolnej grupy Essence.
- **Tainted Stew:** usunięto niepotrzebne stanowisko i ustawiono kategorię FoodVoidwokenFish.
- **Crafting Overhaul:** wyniki Anvil i Barricade otrzymały nazwy Crafter's Anvil i Crafted Barricade. Magic Needle & Thread nie wymaga samego siebie. Cursed Frost Grenade wymaga zwykłego Frost Grenade.
- **DOS1, wytwarzane wyposażenie:** pięć ogólnych receptur Bow, Crossbow, Spear, Cloth Boots i Leather Boots zastąpiono 21 wariantami nazw/jakości i poziomów craftingu, wynikającymi z definicji gry. Przykłady: Homemade Shortbow, Superior Longbow, Superior Arbalest, Superior Spear. Nowe warianty mają własne strony.
- **DOS1, królicze amulety:** rozdzielono Lucky Rabbit Paw Amulet i Lucky Rabbit's Paw Amulet, ponieważ odpowiadają różnym Stats ID i innym składnikom. Nie są aliasami jednej strony.
- **Glass of Wine:** dwa dodatkowe warianty używają Empty Cup zamiast Empty Mug.
- **Osiem wpisów Dreamer Pipe:** usunięto z receptur wytwarzania. Zużywają zioła i nadają status postaci, nie tworzą kolejnych ziół. Właściwe receptury wytwarzania mieszanek pozostają.
- **Posąg anioła:** poprawiono odwrócony kierunek receptury. Head of Angelic Statue + Broken Angelic Statue naprawiają posąg (Curious Angelic Statue), zamiast tworzyć głowę z uszkodzonego posągu.

Dwie ostatnie poprawki opierają się również na skryptach Osiris w Origins.pak:
`Story/RawFiles/Goals/RC_DW_DreamerHole.txt` (sekcja Using HerbMixes, ApplyStatus)
oraz `Story/RawFiles/Goals/RC_GY_Statue.txt` (ItemTemplateCombinedWithItemTemplate, Transform, ItemDestroy).

Uzupełniono nazwy, strony i odpowiednie ikony w danych aplikacji. Odczyt kategorii
uwzględnia teraz także statystyki z patchy DOS2 DE, z zachowaniem pierwszeństwa moda.

## Interpretacja pozostałych przypadków

- Large Healing Potion w modzie zwraca statystykę `POTION_Large_Healing_Potion`.
  Mapowanie nazw odczytuje także ogólną nazwę Healing Potion. Nie uznaję tego
  za dowód błędnego wyniku.
- Improvised Staff ma cztery alternatywne bloki wyniku, po jednym na żywioł.
  Nie oznacza to otrzymania czterech lasek naraz. Audyt rozróżnia alternatywne
  bloki `ItemCombinationResult` od kilku produktów w jednym bloku.
- Nazwy zbiorcze i selektory aplikacji nie zawsze mają odpowiednik o identycznej
  nazwie w kategoriach gry. Takie wpisy pozostają niepotwierdzone zamiast być
  automatycznie oznaczane jako błędne.

## Zakres i ograniczenia

Raport automatyczny po poprawkach bada 438 źródłowych receptur DOS1, 585 DOS2
oraz 1510 wpisów trybu DOS2 + Crafting Overhaul, w tym 925 dodatków moda.
Znalazł zgodne definicje dla odpowiednio 218, 473 i 874 wpisów. W kontrolowanym
zakresie nie pozostały automatycznie wykryte rozbieżności ilości ani progów
craftingu. To nie oznacza pełnego potwierdzenia wszystkich pozostałych wpisów.
Bazuje na źródłowych JSON-ach przed rozwinięciem małych grup na warianty widoku.
Brak dopasowania nie jest potwierdzonym błędem. Naprawa posągu została potwierdzona ręcznie w skrypcie, mimo statusu transformation_needs_review w audycie samych ItemCombos. Pełne sprawdzenie efektów,
reguł zużywania narzędzi, losowości, wszystkich produktów ubocznych, dziedziczenia
niestandardowych grup oraz ilości DOS1 wymaga osobnej analizy tych mechanizmów.
Nie uruchamiano gry w celu wykonania receptur.

Szczegółowe dopasowania, statusy, pliki, numery linii, ścieżki pakietów i sumy
SHA-256 wypakowanych plików zapisano w `recipe-audit.json`.
Podsumowanie automatyczne: `recipe-audit.md`.

Powtórzenie audytu na przygotowanych zasobach:

```sh
python3 scripts/audit-recipes.py
python3 -m unittest discover -s src/test -p 'audit_recipes_test.py'
```

Skrypt jest narzędziem lokalnego audytu i nie jest częścią budowania aplikacji
ani wdrożenia GitHub Pages.

## Weryfikacja zmian

- 68 testów aplikacji, w tym regresje potwierdzonych błędów.
- 7 testów narzędzia audytu.
- TypeScript, formatowanie i git diff --check.
- Build z bazą /DOS-crafting-docs/ i verify:dist dla GitHub Pages.
- Ręczna kontrola poprawionej receptury Shrieker's Scythe w przeglądarce, na buildzie produkcyjnym.
