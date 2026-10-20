# Divinity — katalog craftingu

Statyczna aplikacja **Vite + Preact + TypeScript** z katalogami DOS1, DOS2 Definitive Edition i DOS2 – Crafting Overhaul. Tryb Overhaul zawiera również wszystkie standardowe receptury DOS2.

## Uruchomienie

Wymagany Node.js 22 (lokalnie obsługiwany również Node.js 20.19+) i npm 10+.

```sh
npm ci
npm run dev
```

Serwer działa pod adresem podanym w terminalu (domyślnie `http://localhost:5173`). Zmiany komponentów i CSS są obsługiwane przez Vite; nie wymagają generowania tysięcy stron. Zmiany w `data/` odświeżają dane katalogu. Biblioteka jest zapisana wyłącznie w JSON; budowanie nie odczytuje Markdown ani YAML.

```sh
npm run check
npm test
npm run build
npm run verify:dist
npm run preview
```

Wynik budowania znajduje się w `dist/`. Podgląd produkcyjny domyślnie używa portu 4173.

## GitHub Actions i GitHub Pages

Workflow `.github/workflows/deploy.yml` po wysłaniu zmian na `main`:

1. Wykonuje `npm ci`, kontrolę typów i formatowania oraz testy.
2. Odczytuje konfigurację GitHub Pages i ustawia właściwy prefiks URL.
3. Buduje aplikację i sprawdza kompletność danych oraz plików dla bezpośrednich adresów.
4. Wysyła `dist/` jako artefakt i publikuje go na GitHub Pages.

W repozytorium ustaw **Settings → Pages → Build and deployment → Source: GitHub Actions**. Workflow można również uruchomić ręcznie z zakładki Actions. Publikacja nie wymaga instalacji gier, plików Steam ani katalogu `.pak-work`.

Pull requesty i pozostałe branche sprawdza `.github/workflows/ci.yml`. CI buduje także pod prefiksem `/DOS-crafting-docs/`, aby wykryć błędy ścieżek przed wdrożeniem.

Lokalna symulacja wdrożenia w podkatalogu:

```sh
VITE_BASE_PATH=/DOS-crafting-docs/ npm run build
npm run verify:dist
VITE_BASE_PATH=/DOS-crafting-docs/ npm run preview
```

## Dane i architektura

- `data/library/pages/` — metadane przedmiotów i kategorii w JSON oraz HTML stron informacyjnych.
- `data/library/recipes/` — strukturalne receptury DOS1, DOS2 DE oraz dodatki Crafting Overhaul.
- `data/recipeTagHierarchy.json` i `data/tagLabels.json` — hierarchia i nazwy tagów.
- `data/` — zapisane słowniki lokalizacji, niezależne od lokalnej instalacji gry.
- `src/main/domain/` — przetwarzanie receptur, ilości, efektów, tagów, tłumaczeń i indeksów.
- `src/main/components/` — tabele przedmiotów i receptur.
- `src/main/App.tsx` — nawigacja, filtry, wyszukiwanie, strony przedmiotów i podglądy.
- `src/test/` — testy jednostkowe logiki i komponentów, z układem odpowiadającym `src/main/`.
- `scripts/load-library.ts` — odczyt i walidacja źródłowej biblioteki JSON.
- `scripts/generate-data.ts` — generowanie katalogów, statystyk, ról craftingu i bezpiecznego HTML notatek z JSON.
- `scripts/verify-dist.ts` — kontrola wynikowego artefaktu GitHub Pages.
- `vite.config.ts` — serwer deweloperski, aktualizacja danych i generowanie plików pod istniejące adresy.

Aplikacja pobiera manifest i tylko aktualnie wybrany katalog. Szczegóły notatek są ładowane na żądanie. Filtry zapamiętywane są osobno dla każdej gry; parametry URL umożliwiają udostępnianie wyników. Działają dotychczasowe adresy `receptury`, `DOS2`, `dos2-crafting-overhaul` oraz adresy stron przedmiotów. Dla znanych adresów budowane są zarówno pliki `.html`, jak i `index.html` w podkatalogach, więc odświeżenie strony działa również na hostingu statycznym.

## Edycja biblioteki JSON

Aby zmienić recepturę, edytuj odpowiedni plik `data/library/recipes/`:

- `dos1.json` zawiera receptury DOS1.
- `dos2.json` zawiera standardowe receptury DOS2 Definitive Edition.
- `dos2-overhaul.json` zawiera wyłącznie dodatki moda. Generator automatycznie dołącza do tego trybu pełne DOS2; nie kopiuj tam podstawowych receptur.

Każdy plik ma pola `game` i `recipes`. Receptura zapisuje osobno `ingredients`,
`result`, `requirements`, `notes` (efekt), `remarks` (instrukcje), `tags` i `source`.
Przedmiot w recepturze ma `name`, opcjonalne `namePl`, `slug`, `quantity`,
`selectorTag` oraz tablicę `tags`. Identyfikator `id` zachowuje zgodność z dotychczasowymi
recepturami; różne warianty mogą mieć historycznie ten sam identyfikator.

Plik strony ma ścieżkę zgodną z adresem, np.
`data/library/pages/Skladniki/LEATHER-SCRAPS.json`. Pole `slug` musi odpowiadać
tej ścieżce bez rozszerzenia. `title`, `titlePl`, `tags`, `itemPage`
i `categoryPage` opisują stronę. Strony przedmiotów zawierają tylko metadane — receptury, efekty i opisy
pochodzą z danych strukturalnych. Pole `html` przechowuje treść stron kategorii
i informacyjnych; generator sanitizuje HTML przed publikacją. Odnośniki wewnętrzne
w tej treści używają prefiksu `__APP_BASE__/`, zastępowanego właściwą ścieżką wdrożenia.

Opisy z gry edytuje się w `data/itemDescriptions.json`, a lokalizacje i mapę ikon
w odpowiednich plikach `data/`. Liczniki filtrów, role przedmiotów, manifest,
połączony katalog Overhaul i pliki `dist/` są obliczane automatycznie.

Po edycji uruchom `npm run build` i `npm run verify:dist`. Nieprawidłowa struktura
strony lub receptury przerwie generowanie z komunikatem wskazującym źródło błędu.

## Lokalizacja

DOS2 i Crafting Overhaul korzystają wyłącznie ze słownika `data/itemLocalisation.dos2-de.en-pl.json`, pochodzącego z DOS2 Definitive Edition. Nieuzupełnione nazwy modowe pozostają angielskie. DOS1 zachowuje dotychczasowe słowniki.

Słownik DOS2 można odtworzyć z wcześniej wyodrębnionych plików XML:

```sh
python3 scripts/build-dos2-localisation.py /sciezka/english.xml /sciezka/polish.xml
```

Ta operacja służy aktualizacji danych; nie jest częścią budowania ani wdrożenia.

## Ikony przedmiotów

Ikony są zapisane jako bezstratne pliki WebP z przezroczystością w `assets/item-icons/`.
Nazwy odpowiadają angielskim nazwom przedmiotów, np. `dos2/apple.webp` lub
`dos1/minor-healing-potion.webp`. Katalogi `dos1`, `dos2` i `overhaul` wskazują
źródło grafiki. Tryb Overhaul korzysta również z ikon podstawowego DOS2 DE.
Generator kopiuje je do `dist/data/icons/`, a aplikacja uwzględnia prefiks GitHub Pages.
Obrazki są ładowane leniwie i mają zarezerwowane miejsce w tabeli.

- `data/itemIcons.json` — przypisania nazw do plików osobno dla każdego trybu.
- `data/itemIcons.provenance.json` — identyfikator ikony, atlas źródłowy i prostokąt wycięcia.
- `data/itemIcons.report.json` — pokrycie katalogu oraz lista niedopasowanych nazw.

Eksport łączy nazwy szablonów, lokalizacje wyników receptur oraz identyfikatory Stats.
Odczytuje także `PreviewTooltip` i `PreviewIcon` z wyników receptur gry,
np. dla broni Big Tongs Roped Together. Odczytuje również oficjalne ikony
i przetłumaczone etykiety z `Stats/ItemComboPreviews.lsx`, m.in. dla pustego kubka.
Usuwa znaczniki koloru z nazw, dzięki czemu rozpoznaje również barwniki moda.
Przypisania ikon są zapisane bezpośrednio w `data/itemIcons.json`, a ich
pochodzenie w pliku provenance. Eksport zachowuje zweryfikowane przypisania
z istniejących danych — kilka szablonów może współdzielić nazwę. Obejmuje również pastelowe
warianty barwników. Nazwy z gry są nadrzędne wobec arkusza receptur: katalog
używa np. `Pastel Green Dye`, a nie wcześniejszego `Green Pastel`.
Nazwy przedmiotów są zapisane bezpośrednio w danych receptur i stron.
Dotychczasowe adresy stron pozostają stabilne.
Nazwy niejednoznaczne, opisy ulepszeń i grupy składników pozostają bez obrazka.
Do zwykłego budowania wystarczają zapisane zasoby; Python, Pillow, LSLib i gry
nie są wymagane w GitHub Actions.

Aby odtworzyć eksport, przygotuj katalog roboczy z podkatalogami `dos1/`, `dos2/`
i `overhaul/`. Za pomocą LSLib wyodrębnij z odpowiednich archiwów `Icons.pak`
i `Main.pak` (DOS1), `Shared.pak` i `Origins.pak` (DOS2 Definitive Edition) oraz
`Crafting_Overhaul.pak` pliki GUI, tekstury atlasów, RootTemplates i lokalizacje
Stats i ItemCombinations, pliki `Stats/Generated/` (dane przedmiotów i receptur)
oraz `Stats/ItemComboPreviews.lsx`.
Dla DOS1 dodaj również pliki `DEFAULT.xml`, `ROOTTEMPLATES.xml` oraz
`LOCALIZATION.xml` z `Localization/Reference.pak`, zachowując katalog
`Localization/Reference/`.
Dla DOS2 DE dodaj również wyodrębniony `Localization/English/english.xml`
do katalogu zasobów `dos2/`; końcowe tłumaczenia nazw mają pierwszeństwo
wobec nazw roboczych w szablonach.
Zainstalowany mod znajduje się w `workshop/content/435150/1506420847/`.
Zachowaj oryginalne ścieżki `Public/...`; pliki RootTemplates i lokalizacji
LSB/LSF przekonwertuj do LSX. Pliki lokalizacji Stats mogą również znajdować się
w podkatalogu `localization/`. Wymagane są wszystkie RootTemplates, ponieważ
część szablonów dziedziczy ikonę po szablonie nadrzędnym.

```sh
npm run generate:data
python3 scripts/export-item-icons.py /sciezka/do/wyodrebnionych-zasobow
npm run build
npm run verify:dist
```

Skrypt eksportu wymaga lokalnego Pythona z Pillow. Odczytuje katalog wygenerowany
w `.generated/build/data`, zapisuje tylko używane ikony i usuwa nieużywane pliki
WebP z `assets/item-icons/`.

Aktualny raport brakujących ikon można odtworzyć bez plików gry:

```sh
npm run generate:data
python3 scripts/audit-item-icons.py
```

Raport `reports/item-icon-coverage.json` pomija rozpoznane grupy i opisy ulepszeń,
a dla pozostałych braków zapisuje użycie jako produkt lub składnik.

## Podgląd przedmiotu

Po najechaniu lub ustawieniu fokusu na przedmiocie podgląd pokazuje nazwę
`PL (EN)` w trybie PL (albo samo EN przy braku tłumaczenia), a w trybie EN
wyłącznie EN. Pokazuje też opis w wybranym języku oraz wszystkie receptury wytwarzania z bieżącego
trybu gry. Receptury zachowują ilości składników, wyniku i wymagania craftingu.
Opisy są pobierane w tle razem z katalogiem, osobno dla każdej gry. Ruch myszy przesuwa wyłącznie tooltip, bez ponownego renderowania aplikacji lub tabel.
Brak opisu lub receptury jest wskazany wprost. Podgląd można przewijać i zamknąć
klawiszem Escape.

Źródłem opisów jest `data/itemDescriptions.json`. Zapisane opisy są wystarczające
do wdrożenia przez GitHub Actions. Aby odtworzyć je z zasobów przygotowanych jak
do eksportu ikon, uruchom:

```sh
python3 scripts/export-item-descriptions.py /sciezka/do/wyodrebnionych-zasobow /dos1/polish.xml /dos2-definitive/polish.xml
```

Skrypt pobiera opisy z szablonów przedmiotów i łączy polskie tłumaczenia po
identyfikatorach `contentuid`. Niejednoznaczne przypisania pomija.

## Sprawdzenie wydajności tooltipów

Uruchom `npm run dev` i otwórz `/src/test/tooltip-benchmark.html`, a następnie
kliknij **Run tooltip benchmark**. Test ładuje pełną tabelę receptur Overhaul,
wykonuje 120 ruchów wskaźnika i sprawdza, że nie renderują one ponownie aplikacji,
tabel ani komponentu tooltipa. Weryfikuje również zmianę pozycji i przejście na
inny przedmiot oraz podaje czas pierwszego wyświetlenia i obsługi ruchu myszy.
Fixture służy do testowania w serwerze deweloperskim; nie jest wejściem buildu produkcyjnego.

## Grupy składników

Selektory (`#Fish`, `#Essence` itd.) i listy alternatywnych składników z co najmniej
czterema dopasowanymi przedmiotami mają fioletową ramkę oraz licznik. Kliknięcie
otwiera listę członków grupy w bieżącym katalogu; uwzględnia też składniki bez
własnej receptury. Wybór jest zapisany w parametrze URL `group`.

Grupy nie wyświetlają ikon. Obwódka i liczba członków odróżniają je od pojedynczych przedmiotów.
Grupy z 1–3 rozpoznanymi członkami są rozwijane podczas generowania danych
w osobne warianty receptury. Przy kilku małych grupach powstają wszystkie
kombinacje, z zachowaniem ilości, wymagań i uwag.

Kategorie craftingu pochodzące z gry są zapisane w polu `craftingCategories`
przedmiotów w źródłowych JSON-ach receptur. Przy odświeżaniu zasobów można je
odtworzyć poleceniem `python3 scripts/export-item-categories.py /sciezka/do/wyodrebnionych-zasobow`.
GitHub Actions korzysta z zapisanych danych i nie wymaga plików gry ani Pythona.


## Efekty przedmiotów z plików gry

`data/itemEffects.json` zawiera efekty PL/EN wyodrębnione ze Stats i akcji użycia
przedmiotów. Generator dołącza je do katalogów, więc tooltip nie wykonuje dodatkowych
zapytań ani parsowania danych gry. Istniejące efekty receptur zachowują pierwszeństwo.
Efekty różnych wariantów o tej samej nazwie (np. zatrute mikstury udające lecznicze)
są przypisywane do potwierdzonych receptur osobno.

Eksport lokalny, po przygotowaniu zasobów opisanych w sekcji ikon:

```sh
npm run generate:data
python3 scripts/export-item-effects.py
npm run build
```

Raport `reports/item-effects-audit.json` obejmuje wszystkie przedmioty bez efektów,
pomijając rozpoznane grupy i opisy ulepszeń. Rozróżnia efekty uzupełnione, dopasowania
niejednoznaczne, nierozpoznane tożsamości i definicje bez obsługiwanego efektu.
Współczynniki skalowania nie są prezentowane jako końcowe wartości leczenia,
obrażeń lub pancerza. Eksport nie jest częścią buildu ani GitHub Actions.


## Tagi wyposażenia i efektów

Tagi `Typ/Bron/*` są dziećmi „Broń”, a `Typ/Pancerz/*` — „Pancerze”.
Podtypy wynikają ze slotu i rodzaju broni w danych gry; kategorie craftingowe
uzupełniają wpisy, dla których nie ma jednoznacznego szablonu. Biżuteria zachowuje
osobne kategorie. Filtr rodzica obejmuje wszystkie jego podtypy.

Tagi właściwości są wyprowadzane ze zweryfikowanych parametrów i akcji użycia,
a nie z podobieństwa nazwy przedmiotu. Tag cechy oznacza, że przedmiot wpływa na
nią; wartość i znak bonusu są podane w efekcie. Nakładane statusy, niewrażliwości,
odporności oraz tworzone powierzchnie mają oddzielne tagi. Dla różnych przedmiotów
o tej samej nazwie wynik receptury otrzymuje właściwe tagi, a ogólny składnik —
jedynie właściwości wspólne wszystkim potwierdzonym wariantom.

Odświeżenie zapisanych tagów po aktualizacji zasobów gry:

```sh
npm run generate:data
python3 scripts/export-item-effects.py
python3 scripts/refresh-item-tags.py
npm run build
```

Zmiany źródłowych tagów opisuje `reports/effect-tags-audit.json`.


Etykiety zależne od gry znajdują się w `data/tagLocalisation.json`. Są parowane
z oryginalnymi tekstami EN i PL przez `contentuid`, z zachowaniem odrębności
DOS1 EE i DOS2 DE. Crafting Overhaul korzysta z lokalizacji DOS2 DE. Brak
potwierdzonego polskiego tłumaczenia oznacza nazwę angielską. Źródłowe identyfikatory
par oraz nierozstrzygnięte tłumaczenia zapisuje `reports/tag-localisation-audit.json`.

```sh
python3 scripts/export-tag-localisation.py
```
