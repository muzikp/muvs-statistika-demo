# Zadání pro Codex: Simulátor intervalů spolehlivosti

## Cíl
Vytvoř plně funkční, přehlednou, responzivní **výukovou aplikaci v Svelte + TypeScript**, běžící **výhradně ve front-endu** (bez backendu, databáze, API a autentizace). Aplikace simuluje opakovaný náhodný výběr z konečné populace s kategoriální proměnnou a demonstruje, že intervaly spolehlivosti s nominálním pokrytím např. 95 % dlouhodobě obsahují skutečný populační podíl přibližně v 95 % případů. UI a vysvětlivky jsou v **češtině**.

Použij SvelteKit se statickým/client-side provozem nebo Vite + Svelte, TypeScript a vhodnou knihovnu grafů (např. Chart.js). Veškeré simulace běží lokálně v prohlížeči. Preferuj Web Worker pro simulace, aby UI nezamrzalo.

## 1. Nastavení experimentu

### Populace
- Uživatel nastaví **velikost populace N** (celé číslo, výchozí 10 000).
- Editovatelná tabulka s libovolným počtem kategorií (minimálně 2), řádky lze přidávat/mazat.
- Sloupce: **Kategorie** (text) a **Podíl v populaci (%)** (číslo).
- Výchozí příklad: Škoda 50 %, Toyota 20 %, Hyundai 30 %.
- Součet vah musí být 100 % (s malou tolerancí na zaokrouhlení); zobraz validaci a součet. Nepřepočítávej váhy potichu. Nabídni explicitní tlačítko „Normalizovat na 100 %“.
- Protože populace je konečná, převeď procenta na **celočíselné počty osob/jednotek** tak, aby jejich součet byl přesně N (metoda největších zbytků; deterministické řešení shod). Zobraz skutečně realizované počty a podíly. **Pro vyhodnocení pokrytí používej skutečný realizovaný populační podíl**, nikoliv původně zadané procento, které se může při malém N lišit.
- Nepotřebujeme materializovat pole N respondentů: populaci reprezentuj pouze počty kategorií.

### Parametry simulace
- **Velikost jednoho vzorku n** (výchozí 100; 1 ≤ n ≤ N).
- **Úroveň spolehlivosti** (výchozí 95 %; např. předvolby 90/95/99 % a volitelná vlastní hodnota). Zobraz vztah α = 1 − confidence, např. 95 % ⇒ α = 0,05.
- **Počet vzorků v jedné dávce** (výchozí 20).
- **Počet dávek** (výchozí 1000).
- **Metoda intervalu spolehlivosti:** jako výchozí **Wilsonův skórový interval** pro podíl; volitelně „normální/Waldův interval (jednodušší, méně přesný)“ pro didaktické srovnání. Uveď zvolenou metodu u výsledků.
- **Způsob výběru:** prostý náhodný výběr **bez vracení** z konečné populace, přesně n jednotek v každém vzorku.
- Volitelný **seed** pro reprodukovatelnost; pokud není zadán, vygeneruj ho a zobraz. Při stejném seedu a parametrech musí být výsledky totožné.
- Tlačítka „Spustit“, „Pozastavit / Pokračovat“, „Zastavit“ a „Nová simulace“; během běhu zobraz progres (zpracované dávky, vzorky, procenta a průběžné statistiky).
- Validace vstupů, rozumné bezpečnostní limity a upozornění při velkém počtu simulací.

## 2. Simulační jádro – statistická korektnost

### Generování vzorků
- Pro každý vzorek vygeneruj **přesně n jednotek bez vracení** z konečné populace se známými kategoriálními počty.
- Preferuj efektivní **sekvenční multivariační hypergeometrický výběr** (po kategoriích hypergeometricky z aktuálního zbývajícího počtu) nebo jiný matematicky ekvivalentní přesný postup. **Nepoužívej** nezávislé Bernoulliho zařazování každého respondenta: to negarantuje n. **Nepoužívej** nezávislé multinomické losování s vracením jako náhradu za výběr bez vracení.
- Výstupem každého vzorku je jen vektor celočíselných četností kategorií se součtem n; vypočti výběrové podíly.
- Neuchovávej jednotlivé respondenty ani jejich ID.

### Intervaly spolehlivosti
- Pro každou kategorii a každý vzorek spočítej **samostatný marginální interval spolehlivosti pro populační podíl dané kategorie**.
- Wilsonův interval pro x úspěchů z n, p̂ = x/n a z = Φ⁻¹(1 − α/2):

  center = (p̂ + z²/(2n)) / (1 + z²/n)

  halfWidth = z / (1 + z²/n) × sqrt[p̂(1 − p̂)/n + z²/(4n²)]

  CI = [center − halfWidth, center + halfWidth]

- Volitelný Waldův interval: p̂ ± z × sqrt[p̂(1 − p̂)/n], ořízni na [0,1]; upozorni, že zejména při malém n nebo podílech blízko 0/1 může mít výrazně nepřesné pokrytí.
- **Pozor na konečnou populaci:** standardní Wilsonův interval je odvozen pro binomické modelování (výběr s vracením / přibližně malý výběrový podíl). Při výběru bez vracení a velkém n/N nemusí mít nominální pokrytí. Pro hlavní didaktický režim buď (a) použij adekvátní metodu intervalu pro konečnou populaci / hypergeometrické rozdělení (inverzi hypergeometrického testu), anebo (b) transparentně omez n/N na např. ≤ 5 % a v UI označ Wilsonův interval jako aproximaci. **Preferovaná implementace MVP: varianta (b)** s validací/varováním a výslovnou poznámkou o aproximaci. Neprezentuj „přesně 5 %“ jako matematickou garanci.
- U každé kategorie označ interval jako „mimo“, pokud **skutečný realizovaný populační podíl neleží uvnitř včetně krajních mezí**.
- **Důležité:** 95 % se týká dlouhodobého pokrytí *jednotlivých* intervalů. Neznamená to, že přesně 5 % intervalů v každé dávce musí být mimo; ani že pravděpodobnost alespoň jednoho chybného intervalu napříč všemi kategoriemi je 5 %. U více kategorií jde o **marginální**, nikoliv společné 95% pokrytí. Veškeré agregace a popisky musí tuto skutečnost respektovat.

## 3. Průběh simulace a paměť
- Simulace zpracovává dávky postupně; v každé dávce provede definovaný počet nezávislých vzorků.
- **Nedrž v paměti všechna individuální pozorování.** Vždy uchovej pouze četnosti kategorií pro aktuální vzorek, jeho podíly a intervaly potřebné pro agregaci.
- Pro každou dávku ukládej agregované statistiky: počet vzorků; pro každou kategorii počet intervalů mimo, procento mimo, průměr výběrových podílů, min/max podíl, průměrnou šířku CI; dále průměrný počet chybných intervalů na vzorek napříč kategoriemi (jasně označit jinou metriku).
- Kvůli přehledu jednotlivých dávek ukládej také **agregované rozdělení výběrových podílů** (např. histogramové biny pro každou kategorii) a volitelně reprezentativní omezený počet intervalů (např. prvních 20 z každé dávky). Nepřekračuj předem stanovený paměťový rozpočet.
- Průběžně aktualizuj globální agregace bez opakovaného procházení všech vzorků.
- Simulace běží v **Web Workeru**; posílej UI progres po dávkách nebo v rozumných časových intervalech. Podporuj přerušení a pozastavení, včetně korektního stavu výsledků.
- Paměťová složitost má být přibližně O(počet dávek × počet kategorií × počet histogramových binů), nikoliv O(počet vzorků × n).

## 4. Výsledková stránka

### Hlavní přehled
Zobraz nahoře souhrn konfigurace: N, n, skutečné populační podíly, spolehlivost/α, počet vzorků na dávku, počet dávek, metoda CI a seed.

KPI karty:
- Počet zpracovaných vzorků a dávek.
- **Průměrný počet intervalů mimo skutečný podíl na dávku** pro každou kategorii zvlášť (např. při 20 vzorcích a 95 % očekáváme orientačně 1, ne přesně 1).
- **Celkový podíl intervalů mimo (%)** pro každou kategorii zvlášť, vedle referenční hodnoty α × 100 %.
- Průměrný výběrový podíl každé kategorie versus skutečný populační podíl.

Grafy:
1. **Histogram rozdělení dávkových průměrů výběrového podílu** pro vybranou kategorii: jedna dávka = jeden průměr z jejích vzorků. Osa X = průměrný podíl kategorie v dávce (%), osa Y = počet dávek. Svislá referenční čára = skutečný populační podíl. **Tento graf není histogram jednotlivých intervalů ani histogram jejich pokrytí.**
2. **Histogram počtu intervalů mimo v jedné dávce** pro vybranou kategorii: X = 0,1,2,... až počet vzorků v dávce, Y = počet dávek. Svislá referenční čára = očekávaná hodnota `vzorků_v_dávce × α` (přibližná, pokud je skutečné pokrytí metody blízké nominálnímu). Tento graf je klíčový pro výuku a zákon velkých čísel.
3. **Průběžný vývoj podílu intervalů mimo** napříč zpracovanými dávkami pro vybranou kategorii, vodorovná referenční čára α × 100 %. Při větším počtu dávek vhodně decimuj body grafu.
- Přepínač/select kategorie pro všechny grafy a souhrny.
- Vysvětlení pod grafy: „Při 95% spolehlivosti očekáváme dlouhodobě přibližně 5 % intervalů mimo skutečný podíl. V jedné dávce může být počet vyšší i nižší. Skutečné pokrytí navíc závisí na metodě a velikosti vzorku.“

### Detail jednotlivé dávky
- Pod hlavním přehledem **select „Vybrat dávku“** (1…počet dokončených dávek).
- Po výběru dávky ukaž pro každou kategorii tabulku: skutečný populační podíl, průměrný výběrový podíl v dávce, průměrnou šířku CI, počet a procento intervalů mimo.
- Zobraz histogram výběrových podílů **uvnitř vybrané dávky** pro zvolenou kategorii.
- Volitelně vykresli „intervalový les“ (forest plot) omezeného počtu uchovaných intervalů z dané dávky, s čarou skutečného podílu a barevným označením, zda ho interval zahrnuje. Uveď, že jde o omezený výřez, ne nutně všechny vzorky.
- Při 20 vzorcích na dávku můžeš v MVP ukládat a zobrazovat všech 20 CI na kategorii; při velkých dávkách používej limit.

## 5. UX a vzhled
- Moderní, čisté vzdělávací rozhraní, čeština, desktop i mobil.
- Logické kroky „1. Populace → 2. Parametry → 3. Simulace → 4. Výsledky“; nastavení a výsledky mohou být na jedné stránce v sekcích.
- Čitelná editovatelná tabulka kategorií, průběhový indikátor, tooltipy s vysvětlením CI, α, výběru bez vracení a pokrytí.
- Barvy kategorií konzistentní napříč grafy, nespoléhej pouze na barvu (přístupnost).
- Grafy s českými popisky, jednotkami %, legendami a vysvětlenými referenčními čarami.
- Prázdné stavy, validační chyby, možnost resetu; neztrácej výsledky při pouhém přepnutí detailu dávky.
- Bonus: export agregovaných výsledků do CSV a konfigurace + agregací do JSON; bez exportu osobních dat (žádná se negenerují).

## 6. Architektura a kvalita
- Odděl čisté statistické funkce od Svelte komponent.
- Navrhni typy `PopulationCategory`, `SimulationConfig`, `BatchSummary`, `GlobalSummary`, `SimulationProgress`.
- Statistické jádro musí být deterministické se seedovaným PRNG; nepoužívej `Math.random()` tam, kde má fungovat reprodukovatelnost.
- Testuj: součet realizovaných počtů = N; součet četností vzorku = n; četnosti v rozmezí 0 až populační počet; přesně n bez vracení; validace 100 %; hranice CI v [0,1]; reprodukovatelnost; agregace dávek; korektní počítání „mimo“.
- Přidej statistický integrační test s velkým počtem opakování, který ověří, že empirické pokrytí je **blízko** očekávané hodnotě za podmínek, kde je aproximace vhodná. Nevyžaduj přesně 95 % a používej přiměřenou toleranci.
- Pro extrémní vstupy zajisti rozumnou výkonnost; optimalizuj hypergeometrické losování, případně nastav transparentní limity, pokud by naivní implementace byla příliš pomalá.
- Zajisti přístupnost ovládání (labels, klávesnice, kontrast), žádné runtime chyby a žádné zbytečné externí služby.
- Přidej README s instalací, spuštěním (`npm install`, `npm run dev`), buildem, testy a krátkým vysvětlením metodiky a omezení.

## 7. Akceptační scénář
1. Zadám populaci N = 10 000, Škoda 50 %, Toyota 20 %, Hyundai 30 %.
2. Zadám n = 100, spolehlivost 95 %, 20 vzorků v dávce a 1000 dávek.
3. Spustím simulaci; proběhne **20 000 vzorků**, každý přesně o 100 jednotkách bez vracení.
4. Vidím postupný progres bez zamrzání UI.
5. Ve výsledcích pro každou kategorii vidím průměrný počet CI mimo na dávku, celkový podíl CI mimo, histogram dávkových průměrů, histogram počtu CI mimo na dávku a konvergenci kumulativního podílu mimo.
6. Selectem přepínám jednotlivé dávky a vidím jejich agregované výsledky, případně omezený přehled konkrétních CI.
7. Při opakování se stejným seedem dostanu stejné výsledky.
8. Aplikace nikde netvrdí, že v každé dávce 20 vzorků musí být právě jeden interval mimo, ani že 5 % je maximum.

## 8. Postup práce pro Codex
- Nejprve vytvoř strukturu projektu a čisté statistické jádro s testy.
- Pak implementuj simulaci ve Workeru a průběžnou agregaci.
- Potom vstupní formulář, hlavní dashboard a detail dávky.
- Nakonec spusť testy a produkční build, oprav chyby, doplň README.
- Dodávej **fungující aplikaci**, ne pouze mockup. Pokud se některý bonus nestihne, explicitně ho uveď jako odložený; základní funkce a statistická správnost jsou povinné.
